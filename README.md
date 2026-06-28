# Stor-Agent

Stor-Agent is a modern, mobile-first, offline-ready Progressive Web Application (PWA) designed for ambient, frictionless, and AI-assisted inventory management. It targets contractors, makers, and teams who need a rapid-fire material check-in/checkout flow without database fatigue.

**Live Deployment:** [https://stor-agent.web.app](https://stor-agent.web.app)

---

## 🚀 Key Features

### 1. Ambient & Multimodal Ingestion
* **Constrained Snapshot Viewfinder:** Replaces standard page-displacement video feeds with a compact, click-to-activate snapshot preview (styled like the Gemini native Android app).
* **Text Parser Command Line:** Parses inputs like `"add 5 tubes of caulk"` into structured name-quantity queue items automatically.
* **Direct Audio Input:** Tap the mic button to capture WebM audio blobs. Silence detection (5s threshold) auto-submits intent parsing.
* **Inline Review Queue:** Vertically stacked oval cards (`rounded-3xl`) with confirmation (green check), editing (yellow pencil), and discard (red trash) actions. Includes a cancel confirmation safeguard to prevent accidental data loss.

### 2. Live Inventory & Shopping Cart
* **Walmart-Style Controls:** Increment/decrement browse items directly into a shared checkout cart.
* **OCD Tagging System:** passively guides users with auto-suggested classification chips.
* **Search & Filters:** Dynamic, horizontal tag-filtering bar to filter materials instantly.

### 3. Material Checkout & History Ledger
* **Smart Checkout Form:** Checkout logs inherit all associated item tags, require a "Job Site/Purpose" designation, and support expandable markdown comment sections.
* **Directional History Feed:** Color-coded Cash-App style indicators (green up-arrows 📥 for inbound additions, blue down-arrows 📤 for outbound checkouts) with human-friendly relative timestamps.
* **Cost Accounting Finances:** Aggregates transactions by project/job site or chronological date ranges, initializing at `$0.00` total.

---

## 🛠️ Technology Stack

* **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons, React Router 7.
* **PWA Engine:** `vite-plugin-pwa` handles service worker caching for offline access.
* **Backend:** Firebase (Authentication, Firestore Database, Cloud Storage).
* **AI Intelligence:** Gemini 2.5 Pro (Vision/OCR & Audio intent parsing) and `text-embedding-004` (Semantic deduplication and duplicate search).

---

## 📂 Firebase Architecture & Cloud Functions

* **`firestore.rules` & `storage.rules`:** Zero-trust security locks down reading/writing. Write access is restricted via ACL checks against a pre-authorized administrators document collection.
* **`processReceiptPhoto` (v2 Storage Trigger):** Parses receipt uploads to extract line items, prices, and bounding boxes via Gemini Pro Vision, applying 15 req/min rate-limiting.
* **`generateInventoryEmbedding` (v2 Firestore Trigger):** Converts item name, tags, and description strings into vectors on creation/update for real-time duplicate checks.
* **`processAudioIntent` (v2 Callable):** Receives base64 audio and extracts actions/quantities using Gemini Pro.
* **`agentCommand` (v2 Callable):** Parses chatbot entries into navigation commands (`{ action: 'NAVIGATE', target: '/cart' }`) for the UI.
* **`sendWelcomeEmail` (v2 Firestore Trigger):** Listens to new administrator registration and dispatches invite emails via NodeMailer SMTP configurations.

---

## 💻 Local Development

### 1. Prereqs
Install dependencies for both frontend and functions:
```bash
# Install PWA dependencies
npm install

# Install Functions dependencies
cd functions
npm install
cd ..
```

### 2. Run Dev Server
```bash
npm run dev
```

### 3. Run E2E Playwright Tests
Tests run over standard SPA route navigation to prevent React state context resets:
```bash
npx playwright test
```

---

## 🚢 Production Deployment

Build and push to Firebase Hosting:
```bash
# Build Vite production assets
npm run build

# Deploy Hosting and Backend services
npx firebase-tools deploy
```
