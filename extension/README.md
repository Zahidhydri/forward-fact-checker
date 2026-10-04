# 🛡️ Forward Fact-Checker - Chrome Extension

AI-powered Chrome Extension (Manifest V3) that detects scams, viral fake news, and manipulated forwards directly inside **WhatsApp Web** and across any webpage.

---

## 🏗️ Architecture & Component Overview

```
extension/
├── public/                     # Static Extension Icons (logo.png, icon16, icon48, icon128)
├── src/
│   ├── background/
│   │   └── background.js       # Manifest V3 Service Worker (Context Menus, Tab Events, Relay)
│   ├── content/
│   │   ├── content.js          # WhatsApp Web MutationObserver + In-Chat "🛡️ Verify" Button
│   │   └── content.css         # WhatsApp UI Injected Button Styling & Animations
│   ├── sidepanel/
│   │   ├── components/
│   │   │   ├── AgentSteps.jsx      # Auto-Collapsing Multi-Agent Reasoning Pipeline
│   │   │   ├── VerdictCard.jsx     # High-Impact Verdict Card (SCAM/FAKE/MISLEADING/TRUE)
│   │   │   ├── ReplyGenerator.jsx  # 1-Click WhatsApp Debunk Cards (Hindi, English, Marathi, Hinglish)
│   │   │   └── ScamCounter.jsx     # Scam Statistics & Quick Interactive Viral Samples
│   │   ├── App.jsx             # Main React Application & State Machine
│   │   ├── main.jsx            # React Entry Point
│   │   ├── index.css           # Tailwind + Custom Material 3 Styling
│   │   └── index.html          # Side Panel HTML Page
│   └── lib/
│       └── sse-parser.js       # Server-Sent Events (SSE) Stream Consumer
├── manifest.json               # Manifest V3 Specification
├── vite.config.js              # Vite Chrome Extension Bundler
└── package.json
```

---

## 🚀 How to Run Frontend in Dev Mode

### 1. Install Dependencies & Start Dev Server
```bash
cd extension
npm install
npm run dev
```
Dev server will start on `http://localhost:5173/` for instant live reload and UI testing.

---

## 📦 How to Build & Load Extension in Chrome

### 1. Build Production Bundle
```bash
cd extension
npm run build
```
This generates the optimized, production-ready extension in `extension/dist/`.

### 2. Load Unpacked in Google Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the `extension/dist` folder.
5. The **Forward Fact-Checker** extension icon 🛡️ will appear in your Chrome toolbar!

---

## 📡 Live Backend Connection

The sidepanel automatically connects directly to the live AI backend:
- **Live Endpoint:** `POST https://forward-fact-checker.vercel.app/verify`
- **Streaming:** Server-Sent Events (SSE) emitting real-time agent reasoning steps and final verified verdict.
