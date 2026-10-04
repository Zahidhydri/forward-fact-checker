# Forward Fact Checker

A real-time fact-checking verification service designed for evaluating forwarded messages and claims using Server-Sent Events (SSE).

---

## Architecture & Project Structure

```text
forward-fact-checker/
├── .env                  # Environment variables (ignored by git)
├── .env.example          # Environment variable template
├── vercel.json           # Root Vercel deployment configuration
├── README.md             # Project documentation & API contract
├── backend/
│   ├── .env.example      # Backend environment variable template
│   ├── vercel.json       # Backend Vercel deployment configuration
│   ├── package.json      # Express, CORS, and dotenv dependencies
│   ├── index.js          # Express app, SSE streaming handler & CORS
│   └── test-sse.js       # End-to-end SSE validation script
```

> **Note:** `/extension` is untouched and reserved for browser/extension integrations.

---

## Environment Variables

Copy `.env.example` to `.env` and supply your credentials:

```bash
cp .env.example .env
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
    "text": "Drinking warm lemon water cures all viral infections within 24 hours."
  }
  ```
  *(Accepts `text`, `claim`, `message`, or `query`)*

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

The `stage` property must be one of the following 5 pipeline stages in order:
1. `extracting`
2. `searching`
3. `reading`
4. `cross-checking`
5. `writing`

#### B. `event: verdict`
Emitted upon completing all 5 verification steps with the following required fields:
- `label`: Fact-check classification label (e.g., `"MISLEADING"`, `"FALSE"`, `"TRUE"`)
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

## Local Development & Testing

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

---

## Vercel Deployment

Deployable via Vercel with zero configuration:
- Configured with `vercel.json` (`builds` and `routes` using `@vercel/node`).
- Compatible with root repository deployment or subpath `/backend` deployment.
- Supports streaming Server-Sent Events natively.
