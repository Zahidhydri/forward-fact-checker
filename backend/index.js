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
  if (res.writableEnded) return;
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  if (typeof res.flush === 'function') {
    res.flush();
  }
}

/**
 * Strip markdown symbols and trim a snippet to maxLen characters.
 */
function cleanSnippet(raw, maxLen = 200) {
  return (raw || '')
    .replace(/[#*_~`>|\[\]]/g, '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/**
 * Extract URLs from a string.
 */
function extractUrls(text) {
  const re = /https?:\/\/[^\s"'<>)\]]+/gi;
  return (text.match(re) || []);
}

/**
 * POST /verify - Stream verification events via Server-Sent Events (SSE)
 * Events emitted:
 *  - 'step': {"stage": "...", "message": "..."} (5 stages)
 *  - 'verdict': {label, confidence, claims, sources, card_text}
 *  - 'error': {error, message, code}
 *
 * Query params:
 *  - ?mock=1  → use fixed mock data (fallback)
 *  - ?lang=hi → card_text in Hindi (default: en)
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

  // ── Validation ──────────────────────────────────────────────
  const { text, claim, message, query } = req.body || {};
  const rawText = text || claim || message || query || '';

  if (!rawText.trim()) {
    sendSSE(res, 'error', {
      error: 'ValidationError',
      message: 'text is required',
      code: 'VALIDATION_ERROR'
    });
    res.end();
    return;
  }

  const claimText = rawText.slice(0, 2000);

  const bodyLang = req.body && req.body.lang;
  const queryLang = req.query && req.query.lang;
  const lang = (bodyLang === 'hi' || queryLang === 'hi') ? 'hi' : 'en';

  // Track whether the stream has been finalized to avoid double-end
  let finalized = false;

  // Helper to clean up and end response
  function finalize() {
    if (finalized) return;
    finalized = true;
    clearTimeout(overallTimeout);
    if (!res.writableEnded) {
      res.end();
    }
  }

  // 20-second overall timeout – emit error if we haven't finished
  const overallTimeout = setTimeout(() => {
    if (!finalized) {
      sendSSE(res, 'error', {
        error: 'TimeoutError',
        message: 'Verification timed out after 20 seconds.',
        code: 'TIMEOUT'
      });
      finalize();
    }
  }, 20000);

  // Clean up if client prematurely terminates connection
  res.on('close', () => {
    if (!finalized) {
      finalized = true;
      clearTimeout(overallTimeout);
    }
  });

  // ──────────────────────────────────────────────────────────
  // MOCK FLOW (fallback when ?mock=1)
  // ──────────────────────────────────────────────────────────
  if (req.query && req.query.mock === '1') {
    const mockSteps = [
      { stage: 'extracting', message: 'Extracting key factual claims and analyzing language structure...' },
      { stage: 'searching', message: 'Searching fact-check databases, threat feeds, and web archives...' },
      { stage: 'reading', message: 'Reading and analyzing retrieved articles and primary evidence...' },
      { stage: 'cross-checking', message: 'Cross-checking claims against corroborating reports and consensus...' },
      { stage: 'writing', message: 'Formulating final verification verdict and shareable summary...' }
    ];
    const mockVerdict = {
      label: 'MISLEADING',
      confidence: 0.85,
      claims: [claimText],
      sources: [
        { title: 'Google Fact Check Tools Explorer', url: 'https://toolbox.google.com/factcheck/explorer', snippet: 'Multiple verified fact-checking organizations rated this claim misleading or false.' },
        { title: 'Reuters Fact Check Archive', url: 'https://www.reuters.com/fact-check', snippet: 'Independent verification indicates lack of credible source data for the viral forwarded message.' },
        { title: 'Google Safe Browsing Threat Assessment', url: 'https://safebrowsing.google.com', snippet: 'No phishing, deception, or malware detected in the analyzed message URLs.' }
      ],
      card_text: `⚠️ FACT CHECK: MISLEADING\n\nClaim: "${claimText}"\n\nVerdict: This forwarded claim is misleading. Independent fact-checkers and authoritative sources confirm there is no empirical evidence supporting this assertion.`
    };
    let stepIdx = 0;
    function emitMock() {
      if (finalized || res.writableEnded) return;
      if (stepIdx < mockSteps.length) {
        sendSSE(res, 'step', mockSteps[stepIdx]);
        stepIdx++;
        setTimeout(emitMock, 1000);
      } else {
        sendSSE(res, 'verdict', mockVerdict);
        finalize();
      }
    }
    emitMock();
    return;
  }

  // ──────────────────────────────────────────────────────────
  // REAL FLOW
  // ──────────────────────────────────────────────────────────
  (async () => {
    try {
      // (1) extracting
      sendSSE(res, 'step', {
        stage: 'extracting',
        message: 'Extracting key factual claims from the forwarded message...'
      });

      // (2) searching – Tavily + Google Fact Check + Safe Browsing in parallel
      sendSSE(res, 'step', {
        stage: 'searching',
        message: 'Searching the web, fact-check databases, and threat feeds...'
      });

      const tavilyKey = process.env.TAVILY_API_KEY;
      if (!tavilyKey) throw new Error('TAVILY_API_KEY is not configured');

      // ── Tavily search ──
      const tavilyPromise = fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: 'fact check scam: ' + claimText.slice(0, 300),
          max_results: 5
        })
      }).then(async (r) => {
        if (!r.ok) {
          const errBody = await r.text().catch(() => '');
          throw new Error(`Tavily API error (${r.status}): ${errBody.slice(0, 200)}`);
        }
        return r.json();
      });

      // ── Google Fact Check lookup (best-effort) ──
      const factCheckPromise = (async () => {
        const fcKey = process.env.GOOGLE_FACTCHECK_KEY;
        if (!fcKey) return [];
        try {
          const q = encodeURIComponent(claimText.slice(0, 200));
          const fcResp = await fetch(
            `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${q}&pageSize=3&key=${fcKey}`
          );
          if (!fcResp.ok) return [];
          const fcData = await fcResp.json();
          return (fcData.claims || []).map(c => {
            const review = (c.claimReview || [])[0] || {};
            return {
              claim: c.text || '',
              rating: review.textualRating || '',
              publisher: (review.publisher || {}).name || '',
              url: review.url || ''
            };
          });
        } catch (_) {
          return [];
        }
      })();

      // ── Safe Browsing URL check (best-effort) ──
      const safeBrowsingPromise = (async () => {
        const sbKey = process.env.SAFE_BROWSING_KEY;
        if (!sbKey) return [];
        try {
          const urls = extractUrls(claimText);
          if (urls.length === 0) return [];
          const sbResp = await fetch(
            `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${sbKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                client: { clientId: 'forward-fact-checker', clientVersion: '1.0.0' },
                threatInfo: {
                  threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
                  platformTypes: ['ANY_PLATFORM'],
                  threatEntryTypes: ['URL'],
                  threatEntries: urls.map(u => ({ url: u }))
                }
              })
            }
          );
          if (!sbResp.ok) return [];
          const sbData = await sbResp.json();
          return sbData.matches || [];
        } catch (_) {
          return [];
        }
      })();

      // Run all three in parallel
      const [tavilyData, factCheckResults, safeBrowsingMatches] = await Promise.all([
        tavilyPromise,
        factCheckPromise,
        safeBrowsingPromise
      ]);

      // Build sources list: fact-check results first, then Tavily results
      const fcSources = factCheckResults
        .filter(fc => fc.url)
        .map(fc => ({
          title: `${fc.publisher}: ${fc.rating}`.trim(),
          url: fc.url,
          snippet: cleanSnippet(fc.claim)
        }));

      const tavilySources = (tavilyData.results || []).map(r => ({
        title: r.title || '',
        url: r.url || '',
        snippet: cleanSnippet(r.content)
      }));

      const sources = [...fcSources, ...tavilySources];

      const urlsFlagged = safeBrowsingMatches.length > 0;

      if (finalized) return;

      // (3) reading
      sendSSE(res, 'step', {
        stage: 'reading',
        message: 'Reading and analyzing the retrieved articles...'
      });

      if (finalized) return;

      // (4) cross-checking – Gemini API (single call)
      sendSSE(res, 'step', {
        stage: 'cross-checking',
        message: 'Cross-checking claim against sources using Gemini...'
      });

      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) throw new Error('GEMINI_API_KEY is not configured');

      const langName = lang === 'hi' ? 'Hindi' : 'English';

      // Build Safe Browsing context for the prompt
      const sbContext = urlsFlagged
        ? '\n⚠️ SAFE BROWSING ALERT: One or more URLs in the message were flagged as MALWARE, SOCIAL_ENGINEERING, or UNWANTED_SOFTWARE. The label MUST be SCAM.'
        : '\nSafe Browsing: No URLs in the message were flagged as threats.';

      // Build Fact Check context
      const fcContext = factCheckResults.length > 0
        ? `\nOFFICIAL FACT-CHECK RESULTS:\n${JSON.stringify(factCheckResults, null, 2)}`
        : '\nNo official fact-check results found.';

      const geminiPrompt = `You are a rigorous fact-checker for viral forwarded messages (especially WhatsApp forwards common in India).

CLAIM TO VERIFY:
"${claimText}"

WEB SOURCES (use ONLY these – never fabricate or invent URLs):
${JSON.stringify(sources, null, 2)}
${fcContext}
${sbContext}

TASK:
Analyze the claim against ALL evidence above and produce a verification verdict as strict JSON matching this exact schema:

{
  "label": "<one of: TRUE, FALSE, MISLEADING, SCAM, SATIRE, UNVERIFIED>",
  "confidence": <float between 0 and 1>,
  "claims": ["<extracted claim 1>", "<extracted claim 2>", ...],
  "card_text": "<short user-facing summary>"
}

RULES:
- label MUST be UPPERCASE.
- If any URL was flagged by Safe Browsing, or the message asks for OTP, KYC details, clicking unknown links, or sending money, the label MUST be SCAM.
- Official company pages that merely show normal plans, offers, or product info do NOT prove a forwarded claim true. A company website existing is not evidence that an unsolicited viral offer from them is genuine.
- If the sources do not clearly and directly support a verdict, use "UNVERIFIED". Err on the side of UNVERIFIED when evidence is unclear or ambiguous.
- confidence: how certain you are (0 = no idea, 1 = certain).
- claims: list the key factual claims you extracted from the message (strings).
- card_text: write in ${langName}. Keep it friendly, light, and easy to share – BUT if label is SCAM, be serious and warn clearly. Use emojis sparingly.
- Do NOT invent any URLs or sources beyond what is provided above.
- Return ONLY valid JSON, no markdown fences, no extra text.`;

      // Helper: call Gemini with a given model, return Response
      const callGemini = (model) => fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: geminiPrompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        }
      );

      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      // Try gemini-flash-latest, retry once on 503/429 after 2s,
      // then fallback to gemini-flash-lite-latest
      let geminiResp = await callGemini('gemini-flash-latest');

      if (geminiResp.status === 503 || geminiResp.status === 429) {
        await delay(2000);
        geminiResp = await callGemini('gemini-flash-latest');
      }

      if (geminiResp.status === 503 || geminiResp.status === 429) {
        geminiResp = await callGemini('gemini-flash-lite-latest');
      }

      if (!geminiResp.ok) {
        const errBody = await geminiResp.text().catch(() => '');
        throw new Error(`Gemini API error (${geminiResp.status}): ${errBody.slice(0, 200)}`);
      }

      const geminiData = await geminiResp.json();
      const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('Gemini returned no content');

      let parsed;
      try {
        parsed = JSON.parse(rawText);
      } catch (parseErr) {
        throw new Error(`Failed to parse Gemini JSON: ${parseErr.message}`);
      }

      if (finalized) return;

      // Normalize and build the verdict object
      const validLabels = ['TRUE', 'FALSE', 'MISLEADING', 'SCAM', 'SATIRE', 'UNVERIFIED'];
      let label = (parsed.label || 'UNVERIFIED').toUpperCase();
      if (!validLabels.includes(label)) label = 'UNVERIFIED';

      // Force SCAM if Safe Browsing flagged any URL
      if (urlsFlagged) label = 'SCAM';

      const verdict = {
        label,
        confidence: typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0,
        claims: Array.isArray(parsed.claims)
          ? parsed.claims.map(c => String(c))
          : [claimText],
        sources: sources.map(s => ({
          title: s.title,
          url: s.url,
          snippet: cleanSnippet(s.snippet)
        })),
        card_text: typeof parsed.card_text === 'string'
          ? parsed.card_text
          : ''
      };

      // (5) writing
      sendSSE(res, 'step', {
        stage: 'writing',
        message: 'Formulating the final verdict and shareable summary...'
      });

      // (6) verdict
      sendSSE(res, 'verdict', verdict);
      finalize();

    } catch (err) {
      // On any failure, emit an error event so the stream never hangs
      if (!finalized) {
        sendSSE(res, 'error', {
          error: err.name || 'VerificationError',
          message: err.message || 'An unexpected error occurred during verification.',
          code: 'VERIFICATION_FAILURE'
        });
        finalize();
      }
    }
  })();
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
