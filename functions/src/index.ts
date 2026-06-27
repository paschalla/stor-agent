import * as admin from "firebase-admin";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
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
    const bucket = admin.storage().bucket(fileBucket);
    const file = bucket.file(filePath);

    // Download the image file into memory
    const [buffer] = await file.download();
    const base64Image = buffer.toString("base64");

    const prompt = `Analyze this image of a receipt or inventory item. 
Extract the line items, their prices, and suggest relevant descriptive tags.
Return the result strictly as a JSON object with the following schema:
{
  "lineItems": [{"name": "string", "price": "number"}],
  "tags": ["string"]
}`;

    // Call the Gemini model
    const response = await ai.models.generateContent({
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

    const generatedText = response.text;
    
    let parsedData = {};
    if (generatedText) {
      try {
        parsedData = JSON.parse(generatedText);
      } catch (e) {
        logger.error("Failed to parse Gemini response as JSON", generatedText);
      }
    }

    // Save the extracted data to Firestore
    const firestore = admin.firestore();
    await firestore.collection("receiptAnalysis").add({
      originalFilePath: filePath,
      analysis: parsedData,
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
