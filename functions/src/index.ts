import * as admin from "firebase-admin";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { GoogleGenAI } from "@google/genai";
import * as nodemailer from "nodemailer";
import * as logger from "firebase-functions/logger";

admin.initializeApp();

// Initialize the Google Gen AI SDK
const ai = new GoogleGenAI({});

// Configure the nodemailer transporter
// In a real application, you would use environment variables or Firebase Secrets for SMTP credentials
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.example.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || "admin@example.com",
    pass: process.env.SMTP_PASS || "password123",
  },
});

/**
 * Triggered when a new object is uploaded to Firebase Storage.
 * Ingests receipt/inventory photos and extracts line items/tags using Gemini.
 */
export const processReceiptPhoto = onObjectFinalized(async (event) => {
  const fileBucket = event.data.bucket;
  const filePath = event.data.name;
  const contentType = event.data.contentType;

  // Exit if this is triggered on a file that is not an image.
  if (!contentType?.startsWith("image/")) {
    logger.log("Not an image file. Skipping processing.");
    return;
  }

  // Only process images uploaded to pending_scans/
  if (!filePath.startsWith("pending_scans/")) {
    logger.log("File is not in pending_scans/ directory. Skipping.");
    return;
  }

  try {
    const firestore = admin.firestore();

    // Rate-limiting logic to prevent LLM spam (max 15 requests per minute)
    const rateLimitRef = firestore.collection("system").doc("geminiRateLimit");
    const isRateLimited = await firestore.runTransaction(async (transaction) => {
      const rateDoc = await transaction.get(rateLimitRef);
      const now = Date.now();
      if (!rateDoc.exists) {
        transaction.set(rateLimitRef, { count: 1, windowStart: now });
        return false;
      }
      const data = rateDoc.data()!;
      if (now - data.windowStart > 60000) {
        transaction.set(rateLimitRef, { count: 1, windowStart: now });
        return false;
      } else if (data.count >= 15) {
        return true;
      } else {
        transaction.update(rateLimitRef, { count: data.count + 1 });
        return false;
      }
    });

    if (isRateLimited) {
      logger.warn("Rate limit exceeded for Gemini ingestion pipeline. Skipping.", {
        structuredData: true,
        file: filePath,
      });
      return;
    }

    const bucket = admin.storage().bucket(fileBucket);
    const file = bucket.file(filePath);

    // Download the image file into memory
    const [buffer] = await file.download();
    const base64Image = buffer.toString("base64");

    // Fetch existing tags from Firestore to inject into the prompt (Context Optimization)
    // Use select('tags') to reduce memory usage and improve scaling
    const inventorySnapshot = await firestore.collection("inventory").select("tags").limit(50).get();
    const existingTags = new Set<string>();
    inventorySnapshot.forEach(doc => {
      const tags = doc.data().tags || [];
      tags.forEach((t: string) => existingTags.add(t));
    });
    const existingTagsList = Array.from(existingTags).join(", ");

    const prompt = `Analyze this image of a receipt or inventory item. 
Extract the items, their prices (if applicable), quantity, and bounding boxes for where they appear in the image.
If there are multiple dissimilar items in the frame, intentionally spawn multiple distinct line items in the output.
Context Optimization: Reuse these existing database tags where appropriate: [${existingTagsList}]
Return the result strictly as a JSON object with the following schema. Bounding boxes must be [ymin, xmin, ymax, xmax] format with values between 0.0 and 1.0:
{
  "lineItems": [{"name": "string", "price": "number", "quantity": "number", "boundingBox": ["number"]}],
  "tags": ["string"]
}`;

    let response;
    let timeoutId: NodeJS.Timeout;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Gemini API request timed out")), 30000);
      });

      const geminiPromise = ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: [
          prompt,
          {
            inlineData: {
              data: base64Image,
              mimeType: contentType,
            },
          },
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

      // Prevent unhandled promise rejection if Gemini fails after the timeout
      geminiPromise.catch(() => {});

      // Call the Gemini model with a race against the timeout
      response = await Promise.race([geminiPromise, timeoutPromise]) as any;
      clearTimeout(timeoutId!);
    } catch (apiError: any) {
      if (timeoutId!) clearTimeout(timeoutId);
      logger.error("Gemini API error (e.g., rate limit, timeout, or service unavailable):", apiError.message || apiError);
      return; // Stop processing so we don't save empty/corrupt analysis documents
    }

    const generatedText = response.text;
    
    let parsedData: any = {};
    if (generatedText) {
      try {
        parsedData = JSON.parse(generatedText);
        logger.info("Gemini extraction complete", {
          structuredData: true,
          metrics: {
            lineItemsCount: Array.isArray(parsedData?.lineItems) ? parsedData.lineItems.length : 0,
            tagsCount: Array.isArray(parsedData?.tags) ? parsedData.tags.length : 0,
          },
          file: filePath,
        });
      } catch (e) {
        logger.error("Failed to parse Gemini response as JSON", { text: generatedText, error: e });
      }
    }

    // Vector Deduplication: Embed the item names and tags
    let embeddingVector: number[] = [];
    const hasItems = Array.isArray(parsedData?.lineItems) && parsedData.lineItems.length > 0;
    const hasTags = Array.isArray(parsedData?.tags) && parsedData.tags.length > 0;

    if (hasItems || hasTags) {
      let embedTimeoutId: NodeJS.Timeout;
      try {
        const textToEmbed = `Items: ${JSON.stringify(parsedData?.lineItems || [])}, Tags: ${JSON.stringify(parsedData?.tags || [])}`;
        
        const embedTimeoutPromise = new Promise<never>((_, reject) => {
          embedTimeoutId = setTimeout(() => reject(new Error("Embedding API request timed out")), 15000);
        });

        const embedPromise = ai.models.embedContent({
          model: "text-embedding-004",
          contents: textToEmbed,
        });
        
        embedPromise.catch(() => {});

        const embedResponse = await Promise.race([embedPromise, embedTimeoutPromise]) as any;
        clearTimeout(embedTimeoutId!);

        if (embedResponse.embeddings && embedResponse.embeddings.length > 0) {
          embeddingVector = embedResponse.embeddings[0].values || [];
          logger.info("Generated embedding successfully", {
            structuredData: true,
            metrics: {
              vectorDimensions: embeddingVector.length,
            },
            file: filePath,
          });
        }
      } catch (e: any) {
        if (embedTimeoutId!) clearTimeout(embedTimeoutId);
        logger.error("Failed to generate embedding (e.g., rate limit or timeout):", e.message || e);
      }
    } else {
      logger.log("No line items or tags extracted, skipping embedding generation.");
    }

    // Save the extracted data to Firestore, including the embedding for real-time semantic search
    await firestore.collection("receiptAnalysis").add({
      originalFilePath: filePath,
      analysis: parsedData,
      embedding: embeddingVector.length > 0 ? admin.firestore.FieldValue.vector(embeddingVector) : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`Successfully processed and saved analysis for ${filePath}`);
  } catch (error) {
    logger.error(`Error processing image ${filePath}`, error);
  }
});

/**
 * Triggered when a user is added to the /roles/administrators ACL.
 * Dispatches a welcome email with the app URL.
 */
export const sendWelcomeEmail = onDocumentCreated(
  "roles/administrators/users/{email}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      logger.log("No data associated with the event.");
      return;
    }

    // The document ID is the email address
    const email = event.params.email;
    const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG || '{}').projectId : 'default-project';
    const appUrl = `https://${projectId}.web.app`;

    logger.info(`New administrator added: ${email}. Sending welcome email.`);

    try {
      const mailOptions = {
        from: '"App Admin" <admin@example.com>',
        to: email,
        subject: "Welcome! Administrator Access Granted",
        text: `Hello,\n\nYou have been granted administrator access to our application.\nYou can access the app here: ${appUrl}\n\nWelcome aboard!`,
        html: `<p>Hello,</p><p>You have been granted administrator access to our application.</p><p>You can access the app here: <a href="${appUrl}">${appUrl}</a></p><p>Welcome aboard!</p>`,
      };

      const info = await transporter.sendMail(mailOptions);
      logger.info(`Welcome email sent to ${email}. Message ID: ${info.messageId}`);
    } catch (error) {
      logger.error(`Failed to send welcome email to ${email}`, error);
    }
  }
);

/**
 * Triggered when a document in the inventory collection is created or updated.
 * Automatically generates or updates text embeddings for RAG operations.
 */
export const generateInventoryEmbedding = onDocumentWritten("inventory/{itemId}", async (event) => {
  const after = event.data?.after;
  const before = event.data?.before;
  
  if (!after || !after.exists) {
    logger.log("Document deleted, no embedding needed.");
    return;
  }

  const data = after.data();
  if (!data) {
    return;
  }
  const beforeData = before?.data();

  // Avoid infinite loops by checking if relevant fields changed
  if (beforeData) {
    const relevantFieldsChanged = 
      beforeData.name !== data.name ||
      JSON.stringify(beforeData.tags) !== JSON.stringify(data.tags) ||
      beforeData.description !== data.description;
    
    if (!relevantFieldsChanged) {
      logger.log("No relevant fields changed. Skipping embedding generation.");
      return;
    }
  }

  try {
    const textToEmbed = `Name: ${data.name || ''}, Tags: ${JSON.stringify(data.tags || [])}, Description: ${data.description || ''}`;
    
    const embedResponse = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: textToEmbed,
    });
    
    if (embedResponse.embeddings && embedResponse.embeddings.length > 0) {
      const vector = embedResponse.embeddings[0].values;
      if (vector) {
        await after.ref.update({
          embedding: admin.firestore.FieldValue.vector(vector),
        });
        logger.info(`Updated embedding for item ${event.params.itemId}`);
      }
    }
  } catch (error) {
    logger.error("Failed to generate embedding for inventory item", error);
  }
});

/**
 * NLP function to process raw audio blobs (sent via base64 from the client)
 * and return structured intent/items.
 */
export const processAudioIntent = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }

  const { audio, mimeType } = request.data;
  if (!audio) {
    throw new HttpsError("invalid-argument", "Audio data is required.");
  }

  const prompt = `Listen to this audio and extract the user's intent regarding inventory management.
Return a structured JSON response identifying the intent and any items mentioned:
{
  "intent": "ADD" | "CHECKOUT" | "QUERY" | "UNKNOWN",
  "items": [{"name": "string", "quantity": "number"}]
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [
        prompt,
        {
          inlineData: {
            data: audio,
            mimeType: mimeType || "audio/webm",
          },
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    logger.error("Error processing audio intent:", error);
    throw new HttpsError("internal", "Failed to process audio.");
  }
});

/**
 * Global Gemini Bar intent parser.
 * Returns structured JSON tool calls (e.g. { action: 'NAVIGATE', target: '/add' })
 * based on user text intent.
 */
export const agentCommand = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }

  const userText = request.data.text;
  if (!userText) {
    throw new HttpsError("invalid-argument", "Text input is required.");
  }

  const prompt = `You are the backend agent for an inventory management progressive web app.
The user input is: "${userText}"
Determine the appropriate action to take in the UI. Return a JSON tool call structure that the frontend can execute.
Actions include NAVIGATE, ADD_TO_QUEUE, QUERY, etc.
Example 1: "add 5 tubes of caulk" -> {"action": "NAVIGATE", "target": "/add", "payload": {"item": "caulk", "quantity": 5}}
Example 2: "go to my cart" -> {"action": "NAVIGATE", "target": "/cart"}
Example 3: "what tools do I have out?" -> {"action": "NAVIGATE", "target": "/", "payload": {"filter": "tools"}}
Return strict JSON:
{
  "action": "string",
  "target": "string",
  "payload": {}
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    logger.error("Error processing agent command:", error);
    throw new HttpsError("internal", "Failed to process agent command.");
  }
});

