# 🛡️ Forward Fact-Checker - Chrome Extension (Person B Role)

AI-powered Chrome Extension (Manifest V3) that detects scams, viral fake news, and manipulated forwards directly inside **WhatsApp Web** and across any webpage.

---

## 🏗️ Architecture & Component Overview

```
extension/
├── public/                     # Static Extension Icons (16x16, 48x48, 128x128)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── src/
│   ├── background/
│   │   └── background.js       # Manifest V3 Service Worker (Context Menus, Tab Events, Relay)
│   ├── content/
│   │   ├── content.js          # WhatsApp Web MutationObserver + In-Chat "🛡️ Verify" Button
│   │   └── content.css         # WhatsApp UI Injected Button Styling & Animations
│   ├── sidepanel/
│   │   ├── components/
│   │   │   ├── AgentSteps.jsx      # Live Animated Multi-Agent Reasoning Pipeline
│   │   │   ├── VerdictCard.jsx     # High-Impact Verdict Card (SCAM/FAKE/MISLEADING/TRUE)
│   │   │   ├── ReplyGenerator.jsx  # 1-Click WhatsApp Debunk Cards (Hindi, English, Marathi, Hinglish)
│   │   │   └── ScamCounter.jsx     # Scam Statistics & Quick Interactive Viral Samples
│   │   ├── App.jsx             # Main React Application & State Machine
│   │   ├── main.jsx            # React Entry Point
│   │   ├── index.css           # Tailwind + Custom Glassmorphism Styles
│   │   └── index.html          # Side Panel HTML Page
│   └── lib/
│       └── sse-parser.js       # Resilient Server-Sent Events (SSE) Stream Consumer
├── mock-server.js              # Express + SSE Mock Backend for Local Testing
├── manifest.json               # Manifest V3 Specification
├── vite.config.js              # Vite Multi-Entry Chrome Extension Bundler
└── package.json
```

---

## 🚀 How to Run & Test

### 1. Install Dependencies & Build Extension
```bash
cd extension
npm install
npm run build
```
This outputs the complete, ready-to-load Chrome Extension into `extension/dist/`.

---

### 2. Load Unpacked in Google Chrome
1. Open Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the `extension/dist` folder (or `extension` folder).
5. Open [WhatsApp Web](https://web.whatsapp.com) or any webpage!

---

### 3. Run Mock SSE Backend (For Testing)
To test live real-time streaming steps and verdicts before backend integration:
```bash
cd extension
npm run mock-backend
```
Server will start on `http://localhost:3000`. The side panel connects to `POST http://localhost:3000/verify` and streams live agent steps!

---

## 📡 Backend Integration Contract (Person A Specification)

The Side Panel expects an **SSE (Server-Sent Events)** stream from `POST /verify`:

```json
// Headers:
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

// 1. Agent Reasoning Step Event:
data: {"type":"STEP","payload":{"step":"extract_claims","status":"running","label":"Extracting Core Claims"}}
data: {"type":"STEP","payload":{"step":"extract_claims","status":"done","duration":0.7,"details":"Found 2 claims"}}

// 2. Final Verdict Event:
data: {"type":"VERDICT","payload":{"status":"SCAM","confidence":0.98,"risk_level":"critical","headline":"Phishing Scam","explanation":"Government does not offer free 5G recharge.","evidence":["No TRAI circular","Phishing domain"],"sources":[{"name":"PIB Fact Check","url":"https://factcheck.pib.gov.in"}]}}

// 3. Multi-Lingual WhatsApp Reply Cards:
data: {"type":"CARD","payload":{"hi":"⚠️ *सावधान! यह दावा फेक है*...","en":"⚠️ *WARNING: FAKE*...","mr":"⚠️ *सावधान! हा मेसेज खोटा आहे*...","hinglish":"⚠️ *Caution! Fake forward*..."}}

// 4. Stream Completion:
data: [DONE]
```
