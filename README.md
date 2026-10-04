# Forward Fact Checker

A real-time fact-checking verification service and Chrome Extension designed for evaluating forwarded messages, scams, deepfakes, and claims using Server-Sent Events (SSE).

**Built by Fardeen & Zahid**

---

## Architecture & Project Structure

```text
forward-fact-checker/
├── .env                  # Environment variables (ignored by git)
├── .env.example          # Environment variable template
├── vercel.json           # Root Vercel deployment configuration
├── README.md             # Project documentation & API contract
├── logo.png              # High-resolution official project logo
│
├── backend/              # Real-Time AI Agent & SSE Backend (Person A)
│   ├── .env.example      # Backend environment variable template
│   ├── vercel.json       # Backend Vercel deployment configuration
│   ├── package.json      # Express, CORS, and dotenv dependencies
│   ├── index.js          # Express app, SSE streaming handler & CORS
│   └── test-sse.js       # End-to-end SSE validation script
│
└── extension/            # Manifest V3 Chrome Extension & Side Panel (Person B)
    ├── manifest.json     # Chrome Extension Manifest V3 configuration
    ├── vite.config.js    # Vite bundler configuration & static copy targets
    ├── package.json      # Frontend dependencies (React, Lucide, Tailwind)
    ├── tailwind.config.js# Tailwind CSS configuration
    ├── public/           # Static extension icons & assets
    │   ├── logo.png      # Auto-cropped extension logo
    │   ├── icon16.png    # 16x16 toolbar icon
    │   ├── icon48.png    # 48x48 extension manager icon
    │   └── icon128.png   # 128x128 high-res store icon
    ├── src/
    │   ├── background/
    │   │   └── background.js   # Service Worker (Context menus, tab relays, storage)
    │   ├── content/
    │   │   ├── content.js      # WhatsApp Web DOM observer & in-chat verify button injection
    │   │   └── content.css     # Injected button styling & animations
    │   ├── lib/
    │   │   └── sse-parser.js   # Resilient SSE stream reader & event dispatcher
    │   └── sidepanel/          # Android 17 / Jetpack Compose Material 3 UI App
    │       ├── index.html      # Sidepanel HTML entry point
    │       ├── main.jsx        # React root mount
    │       ├── index.css       # Core design tokens, scrollbars, & switch styles
    │       ├── theme.js        # Solid bold color palettes & active accent styles
    │       ├── App.jsx         # Main application container & settings modal
    │       └── components/
    │           ├── AgentSteps.jsx      # Auto-collapsing 5-step reasoning timeline
    │           ├── VerdictCard.jsx     # High-impact verdict banner & evidence list
    │           ├── ReplyGenerator.jsx  # Multi-lingual WhatsApp debunk cards (Hindi, English, Marathi, Hinglish)
    │           └── ScamCounter.jsx     # Tonal stat cards & quick viral test prompts
    └── dist/                   # Production build output (Ready for Chrome Load Unpacked)
```

---

## Environment Variables

Copy `.env.example` to `.env` in `/backend` and supply your credentials:

```bash
cp backend/.env.example backend/.env
```

| Key | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for claim reasoning & synthesis |
| `TAVILY_API_KEY` | Tavily Search API key for real-time web retrieval |
| `GOOGLE_FACTCHECK_KEY` | Google Fact Check Tools API key for claim search |
| `SAFE_BROWSING_KEY` | Google Safe Browsing API key for URL threat checks |
| `PORT` | Local server port (defaults to `3000`) |

---

## API Contract

### 1. Health Check
- **Route:** `GET /` or `GET /health`
- **Response:** JSON status and list of configured keys

---

### 2. Fact Verification Stream
- **Route:** `POST /verify`
- **Headers:**
  - `Content-Type: application/json`
  - `Accept: text/event-stream`
- **Request Body (JSON):**
  ```json
  {
    "text": "Drinking warm lemon water cures all viral infections within 24 hours.",
    "lang": "en"
  }
  ```
  *(Accepts `text`, `claim`, `message`, or `query`, and target language `lang`: `"en"`, `"hi"`, or `"mr"`)*

- **Response Headers:**
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache, no-transform`
  - `Connection: keep-alive`
  - `Access-Control-Allow-Origin: *`
  - `X-Accel-Buffering: no`

- **Stream Flow:**
  - Emits **5 `step` events**, spaced **1 second apart**.
  - Emits **1 `verdict` event** 1 second after the final step.
  - Closes stream (`res.end()`).
  - Emits an **`error` event** if an error condition occurs or is triggered.

---

### Event Schemas

#### A. `event: step`
Emitted at each stage of the verification pipeline:
```http
event: step
data: {
  "stage": "extracting",
  "message": "Extracting key factual claims and analyzing language structure..."
}
```

The `stage` property follows the 5 pipeline stages in order:
1. `extracting`
2. `searching`
3. `reading`
4. `cross-checking`
5. `writing`

#### B. `event: verdict`
Emitted upon completing all 5 verification steps with the following required fields:
- `label`: Fact-check classification label (e.g., `"MISLEADING"`, `"FALSE"`, `"TRUE"`, `"SCAM"`)
- `confidence`: Confidence score between 0.0 and 1.0 (e.g., `0.85`)
- `claims`: Array of extracted claim strings
- `sources`: Array of source objects containing `title`, `url`, and `snippet`
- `card_text`: Shareable fact-check card text summarizing the findings

```http
event: verdict
data: {
  "label": "MISLEADING",
  "confidence": 0.85,
  "claims": [
    "Drinking warm lemon water cures all viral infections within 24 hours."
  ],
  "sources": [
    {
      "title": "Google Fact Check Tools Explorer",
      "url": "https://toolbox.google.com/factcheck/explorer",
      "snippet": "Multiple verified fact-checking organizations rated this claim misleading or false."
    },
    {
      "title": "Reuters Fact Check Archive",
      "url": "https://www.reuters.com/fact-check",
      "snippet": "Independent verification indicates lack of credible source data for the viral forwarded message."
    },
    {
      "title": "Google Safe Browsing Threat Assessment",
      "url": "https://safebrowsing.google.com",
      "snippet": "No phishing, deception, or malware detected in the analyzed message URLs."
    }
  ],
  "card_text": "⚠️ FACT CHECK: MISLEADING\n\nClaim: \"Drinking warm lemon water cures all viral infections within 24 hours.\"\n\nVerdict: This forwarded claim is misleading. Independent fact-checkers and authoritative sources confirm there is no empirical evidence supporting this assertion."
}
```

#### C. `event: error`
Emitted when an error is caught or triggered (`triggerError: true`):
```http
event: error
data: {
  "error": "TriggeredError",
  "message": "An intentional test error was triggered.",
  "code": "VERIFICATION_ERROR"
}
```

---

## Local Development & Running

### 1. Backend Server
1. Navigate to `/backend`:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start development server:
   ```bash
   npm start
   ```
   Server will run on `http://localhost:3000`.

4. Run the SSE contract test:
   ```bash
   node test-sse.js
   ```

### 2. Frontend Chrome Extension (Dev Mode)
1. Navigate to `/extension`:
   ```bash
   cd extension
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start Vite dev preview server:
   ```bash
   npm run dev
   ```
   Local preview will run on `http://localhost:5173/` with hot-module reload for rapid UI iteration.

### 3. Build Chrome Extension for Production
```bash
cd extension
npm run build
```
This generates the optimized, production-ready extension bundle in `extension/dist/`.

---

## 🧩 How to Install & Load Chrome Extension

1. Open **Google Chrome** and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the top right corner.
3. Click the **Load unpacked** button.
4. Select the `extension/dist` directory from this project.
5. The **Forward Fact-Checker** extension icon 🛡️ will now appear in your Chrome toolbar!
6. Click the icon to open the **Side Panel**, or open [WhatsApp Web](https://web.whatsapp.com) to see the in-chat `🛡️ Verify` button on forwarded messages.

---

## ✨ Frontend Key Features

- **In-Chat WhatsApp Web Injection:** Automatically identifies forwarded messages and injects a discrete `🛡️ Verify` button directly onto message bubbles.
- **Android Material You Switch:** Interactive `AUTO ON / AUTO OFF` toggle switch to pause or resume automated scanning without reloading WhatsApp.
- **Auto-Collapsing Reasoning Stepper:** Real-time 5-stage agent reasoning steps stream live and auto-collapse into a compact summary once finished so the verdict and reply cards are immediately visible without scrolling.
- **Multi-Lingual Debunk Reply Generator:** Generates 1-click formatted debunk responses tailored for WhatsApp chat groups in:
  - **हिन्दी (Hindi)**
  - **English**
  - **मराठी (Marathi)**
  - **Hinglish**
- **Solid Bold Color Customizer:** Modern settings pop-up modal supporting Light/Dark mode and solid high-contrast themes (Bold Blue, Bold Emerald, Bold Violet, Bold Orange, Bold Slate).

---

## Vercel Deployment

Deployable via Vercel with zero configuration:
- Configured with `vercel.json` (`builds` and `routes` using `@vercel/node`).
- Compatible with root repository deployment or subpath `/backend` deployment.
- Supports streaming Server-Sent Events natively.
- Live Backend Endpoint: `https://forward-fact-checker.vercel.app/verify`
