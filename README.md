# 🛡️ Forward Fact Checker

An AI-powered real-time fact-checking verification service and Chrome Extension (Manifest V3) designed to detect viral forwarded messages, scams, deepfakes, and misleading claims on WhatsApp Web and all web pages using Server-Sent Events (SSE).

**Built by Fardeen & Zahid**

---

## 🏗️ Architecture & Repository Structure

```text
forward-fact-checker/
├── README.md             # Project documentation & full stack specifications
├── vercel.json           # Live Vercel deployment configuration
├── logo.png              # Auto-cropped official Forward Fact-Checker logo
│
├── backend/              # Live AI Agent & SSE Backend Service (Person A)
│   ├── index.js          # Express server with Tavily + Gemini 1.5/3.6 pipeline
│   ├── test-sse.js       # End-to-end SSE contract validation test script
│   ├── vercel.json       # Backend serverless configuration
│   └── package.json      # Dependencies (Express, CORS, dotenv)
│
└── extension/            # Chrome Extension Client - Manifest V3 (Person B)
    ├── manifest.json     # Extension Manifest V3 (SidePanel, Action Icons, Content Scripts)
    ├── vite.config.js    # Vite bundler configuration with static copy plugin
    ├── public/           # Extension icons (logo.png, icon16/48/128)
    ├── src/
    │   ├── background/   # Service worker for context menus & side panel triggers
    │   ├── content/      # WhatsApp Web DOM observer & in-chat "🛡️ Verify" button
    │   ├── lib/          # Custom SSE Stream Parser (sse-parser.js)
    │   └── sidepanel/    # Android 17 / Jetpack Compose Material 3 UI App
    │       ├── App.jsx   # Main React app container & theme state
    │       └── components/
    │           ├── AgentSteps.jsx      # Auto-collapsing 5-step reasoning timeline
    │           ├── VerdictCard.jsx     # Jetpack Compose Material 3 verdict banner
    │           ├── ReplyGenerator.jsx  # 1-click WhatsApp debunk reply (Hindi/English/Marathi)
    │           └── ScamCounter.jsx     # Tonal stat cards & viral test claim prompts
    └── dist/             # Production build output (Ready for Chrome "Load Unpacked")
```

---

## 🚀 Live Backend & API Contract (`https://forward-fact-checker.vercel.app/verify`)

The backend streams live multi-agent verification progress and final claims verdict via **Server-Sent Events (SSE)**.

### 1. Health Check
- **Route:** `GET /` or `GET /health`
- **Response:** JSON status and active API key diagnostics.

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
  *(Accepts `text`, `claim`, `message`, `query`, and optional target language `lang`: `"en"`, `"hi"`, or `"mr"`)*

- **Stream Events Flow:**
  1. Emits **5 `event: step` events** corresponding to agent pipeline execution.
  2. Emits **1 `event: verdict` event** upon completion.
  3. Stream ends cleanly (`res.end()`).

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
Stages sequence: `extracting` $\rightarrow$ `searching` $\rightarrow$ `reading` $\rightarrow$ `cross-checking` $\rightarrow$ `writing`.

#### B. `event: verdict`
Emitted upon completing verification with the following schema:
```http
event: verdict
data: {
  "label": "FALSE",
  "confidence": 0.95,
  "claims": ["Lemon water cures viral infections"],
  "sources": [
    {
      "title": "Google Fact Check Tools Explorer",
      "url": "https://toolbox.google.com/factcheck/explorer",
      "snippet": "Verified fact-checking organizations rated this claim false."
    }
  ],
  "card_text": "🍋❌ False! Claims that drinking water with lemon can cure viral infections have been debunked."
}
```

#### C. `event: error`
```http
event: error
data: {
  "error": "TriggeredError",
  "message": "An error occurred during verification.",
  "code": "VERIFICATION_ERROR"
}
```

---

## 🧩 Chrome Extension Setup & Installation

### Option 1: Load Built Extension into Chrome (Recommended)
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked**.
4. Select the `extension/dist` folder inside this repository.
5. The **Forward Fact-Checker** extension icon 🛡️ will appear in your extensions toolbar!

### Option 2: Build from Source
```bash
cd extension
npm install
npm run build
```

---

## ✨ Extension Features & Highlights

1. **Android 17 / Jetpack Compose Material 3 UI:**
   - 24px rounded surface cards (`compose-card`).
   - Android Material You toggle switch (`autoCheckEnabled`).
   - Multi-shade theme customizer (Electric Blue, Emerald Mint, Neon Violet, Sunset Orange, Steel Slate).

2. **WhatsApp Web In-Chat Auto-Injection:**
   - Injects a discrete `🛡️ Verify` button directly onto forwarded message bubbles in WhatsApp Web.
   - Support for dynamic `AUTO ON / AUTO OFF` toggle without reloading the tab.

3. **Auto-Collapsing Reasoning Timeline:**
   - Live stream step progress automatically collapses upon completion (`✓ Reasoning Steps Complete`) to bring the **Verdict Card** and **WhatsApp Debunk Generator** front-and-center without scrolling.

4. **Multi-Lingual Debunk Generator:**
   - Generates 1-click copyable debunk responses formatted specifically for WhatsApp chat groups in **हिन्दी (Hindi)**, **English**, **मराठी (Marathi)**, and **Hinglish**.

---

## 🛠️ Environment Variables Setup (Backend)

Create a `.env` file in `/backend`:
```env
GEMINI_API_KEY=your_gemini_api_key
TAVILY_API_KEY=your_tavily_api_key
GOOGLE_FACTCHECK_KEY=your_google_factcheck_key
SAFE_BROWSING_KEY=your_safe_browsing_key
PORT=3000
```
