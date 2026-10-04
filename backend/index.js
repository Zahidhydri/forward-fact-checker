const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env in backend/ or root
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins and headers
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Support pre-flight across all routes
app.options('*', cors());

// Parse JSON and urlencoded request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Health check / status endpoint
 */
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Forward Fact Checker Backend',
    version: '1.0.0',
    endpoints: {
      verify: 'POST /verify (Server-Sent Events stream)'
    },
    keysConfigured: {
      GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
      TAVILY_API_KEY: Boolean(process.env.TAVILY_API_KEY),
      GOOGLE_FACTCHECK_KEY: Boolean(process.env.GOOGLE_FACTCHECK_KEY),
      SAFE_BROWSING_KEY: Boolean(process.env.SAFE_BROWSING_KEY)
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Helper to write a Server-Sent Event formatted frame
 * Format:
 *   event: <eventName>\n
 *   data: <JSON data>\n\n
 */
function sendSSE(res, eventName, data) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  if (typeof res.flush === 'function') {
    res.flush();
  }
}

/**
 * POST /verify - Stream verification events via Server-Sent Events (SSE)
 * Events emitted:
 *  - 'step': {"stage": "...", "message": "..."} (5 stages 1 second apart)
 *  - 'verdict': {label, confidence, claims, sources, card_text}
 *  - 'error': {error, message, code}
 */
app.post('/verify', (req, res) => {
  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'X-Accel-Buffering': 'no'
  });

  if (res.flushHeaders) {
    res.flushHeaders();
  }

  // Check if caller triggered an intentional error test
  if (req.body && req.body.triggerError) {
    sendSSE(res, 'error', {
      error: 'TriggeredError',
      message: req.body.errorMessage || 'An intentional test error was triggered.',
      code: 'VERIFICATION_ERROR'
    });
    res.end();
    return;
  }

  const { text, claim, message, query } = req.body || {};
  const claimText = text || claim || message || query || 'Forwarded message content';

  // 5 fixed mock steps with stages: extracting, searching, reading, cross-checking, writing
  const mockSteps = [
    {
      stage: 'extracting',
      message: 'Extracting key factual claims and analyzing language structure...'
    },
    {
      stage: 'searching',
      message: 'Searching fact-check databases, threat feeds, and web archives...'
    },
    {
      stage: 'reading',
      message: 'Reading and analyzing retrieved articles and primary evidence...'
    },
    {
      stage: 'cross-checking',
      message: 'Cross-checking claims against corroborating reports and consensus...'
    },
    {
      stage: 'writing',
      message: 'Formulating final verification verdict and shareable summary...'
    }
  ];

  // Final mock verdict matching README contract
  const mockVerdict = {
    label: 'MISLEADING',
    confidence: 0.85,
    claims: [
      claimText
    ],
    sources: [
      {
        title: 'Google Fact Check Tools Explorer',
        url: 'https://toolbox.google.com/factcheck/explorer',
        snippet: 'Multiple verified fact-checking organizations rated this claim misleading or false.'
      },
      {
        title: 'Reuters Fact Check Archive',
        url: 'https://www.reuters.com/fact-check',
        snippet: 'Independent verification indicates lack of credible source data for the viral forwarded message.'
      },
      {
        title: 'Google Safe Browsing Threat Assessment',
        url: 'https://safebrowsing.google.com',
        snippet: 'No phishing, deception, or malware detected in the analyzed message URLs.'
      }
    ],
    card_text: `⚠️ FACT CHECK: MISLEADING\n\nClaim: "${claimText}"\n\nVerdict: This forwarded claim is misleading. Independent fact-checkers and authoritative sources confirm there is no empirical evidence supporting this assertion.`
  };

  let stepIndex = 0;
  let isClosed = false;
  let timerId = null;

  // Clean up if client prematurely terminates connection
  res.on('close', () => {
    if (!res.writableEnded) {
      isClosed = true;
      if (timerId) {
        clearTimeout(timerId);
      }
    }
  });

  // Stream 5 step events 1 second apart, then one verdict
  function emitNext() {
    if (isClosed || res.writableEnded) return;

    if (stepIndex < mockSteps.length) {
      sendSSE(res, 'step', mockSteps[stepIndex]);
      stepIndex++;
      timerId = setTimeout(emitNext, 1000);
    } else {
      sendSSE(res, 'verdict', mockVerdict);
      res.end();
    }
  }

  // Start sending events
  emitNext();
});

// Start local server if run directly (node index.js)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Forward Fact Checker backend running on http://localhost:${PORT}`);
    console.log(`API Key GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'Configured' : 'Missing'}`);
    console.log(`API Key TAVILY_API_KEY: ${process.env.TAVILY_API_KEY ? 'Configured' : 'Missing'}`);
    console.log(`API Key GOOGLE_FACTCHECK_KEY: ${process.env.GOOGLE_FACTCHECK_KEY ? 'Configured' : 'Missing'}`);
    console.log(`API Key SAFE_BROWSING_KEY: ${process.env.SAFE_BROWSING_KEY ? 'Configured' : 'Missing'}`);
  });
}

module.exports = app;
