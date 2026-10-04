const http = require('http');
const assert = require('assert');
const app = require('./index');

const EXPECTED_STAGES = ['extracting', 'searching', 'reading', 'cross-checking', 'writing'];

const server = app.listen(0, async () => {
  const port = server.address().port;
  console.log(`Test server running on port ${port}`);

  const postData = JSON.stringify({
    text: "Drinking warm lemon water cures all viral infections within 24 hours."
  });

  const options = {
    hostname: '127.0.0.1',
    port: port,
    path: '/verify?mock=1',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  console.log('Sending POST /verify request...');
  const startTime = Date.now();
  let lastEventTime = startTime;
  const eventsReceived = [];

  const req = http.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Content-Type: ${res.headers['content-type']}`);
    console.log(`Access-Control-Allow-Origin: ${res.headers['access-control-allow-origin']}`);

    assert.strictEqual(res.statusCode, 200, 'Status code must be 200');
    assert.ok(res.headers['content-type'].includes('text/event-stream'), 'Content-Type must be text/event-stream');
    assert.strictEqual(res.headers['access-control-allow-origin'], '*', 'CORS origin must be *');

    let buffer = '';

    res.on('data', (chunk) => {
      buffer += chunk.toString();

      // SSE frames end with double newlines
      const parts = buffer.split('\n\n');
      buffer = parts.pop(); // keep trailing partial frame

      for (const part of parts) {
        if (!part.trim()) continue;

        const lines = part.split('\n');
        let eventType = 'message';
        let dataStr = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            dataStr = line.slice(6).trim();
          }
        }

        const now = Date.now();
        const deltaMs = now - lastEventTime;
        const deltaSec = Math.round(deltaMs / 1000);
        lastEventTime = now;

        const parsed = JSON.parse(dataStr);
        eventsReceived.push({ eventType, data: parsed, deltaMs, deltaSec });

        if (eventType === 'step') {
          console.log(`[+${deltaSec}s] Event: ${eventType} | Stage: "${parsed.stage}" | Message: "${parsed.message}"`);
        } else if (eventType === 'verdict') {
          console.log(`[+${deltaSec}s] Event: ${eventType} | Label: "${parsed.label}" | Confidence: ${parsed.confidence}`);
        } else {
          console.log(`[+${deltaSec}s] Event: ${eventType} | ${dataStr}`);
        }
      }
    });

    res.on('end', () => {
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      console.log(`\nStream completed in ${totalTime}s. Total events received: ${eventsReceived.length}`);

      const stepEvents = eventsReceived.filter(e => e.eventType === 'step');
      const verdictEvents = eventsReceived.filter(e => e.eventType === 'verdict');

      try {
        // 1. Check event counts
        assert.strictEqual(stepEvents.length, 5, 'Must receive exactly 5 step events');
        assert.strictEqual(verdictEvents.length, 1, 'Must receive exactly 1 verdict event');

        // 2. Validate step events schema and stage values
        stepEvents.forEach((stepEvent, index) => {
          const { data } = stepEvent;
          assert.ok(data && typeof data === 'object', `Step ${index + 1} data must be an object`);
          assert.strictEqual(typeof data.stage, 'string', `Step ${index + 1} must have a string "stage"`);
          assert.strictEqual(typeof data.message, 'string', `Step ${index + 1} must have a string "message"`);
          assert.strictEqual(data.stage, EXPECTED_STAGES[index], `Step ${index + 1} stage must be "${EXPECTED_STAGES[index]}", got "${data.stage}"`);
          assert.ok(data.message.trim().length > 0, `Step ${index + 1} message must not be empty`);
        });
        console.log('PASS: All 5 step events match schema {"stage": "...", "message": "..."} in correct stage order.');

        // 3. Validate verdict event schema
        const verdict = verdictEvents[0].data;
        assert.ok(verdict && typeof verdict === 'object', 'Verdict data must be an object');

        // Check required fields: label, confidence, claims, sources, card_text
        assert.ok('label' in verdict, 'Verdict must contain "label"');
        assert.strictEqual(typeof verdict.label, 'string', 'Verdict "label" must be a string');

        assert.ok('confidence' in verdict, 'Verdict must contain "confidence"');
        assert.strictEqual(typeof verdict.confidence, 'number', 'Verdict "confidence" must be a number');
        assert.ok(verdict.confidence >= 0 && verdict.confidence <= 1, 'Verdict "confidence" must be between 0 and 1');

        assert.ok('claims' in verdict, 'Verdict must contain "claims"');
        assert.ok(Array.isArray(verdict.claims), 'Verdict "claims" must be an array');
        assert.ok(verdict.claims.length > 0, 'Verdict "claims" array must not be empty');

        assert.ok('sources' in verdict, 'Verdict must contain "sources"');
        assert.ok(Array.isArray(verdict.sources), 'Verdict "sources" must be an array');
        assert.ok(verdict.sources.length > 0, 'Verdict "sources" array must not be empty');
        verdict.sources.forEach((src, idx) => {
          assert.strictEqual(typeof src.title, 'string', `Source ${idx} must have title string`);
          assert.strictEqual(typeof src.url, 'string', `Source ${idx} must have url string`);
          assert.strictEqual(typeof src.snippet, 'string', `Source ${idx} must have snippet string`);
        });

        assert.ok('card_text' in verdict, 'Verdict must contain "card_text"');
        assert.strictEqual(typeof verdict.card_text, 'string', 'Verdict "card_text" must be a string');
        assert.ok(verdict.card_text.trim().length > 0, 'Verdict "card_text" must not be empty');

        console.log('PASS: Verdict event matches exact schema (label, confidence, claims, sources, card_text).');
        console.log('\nAll assertions passed successfully!');
      } catch (err) {
        console.error('\nFAIL: Contract verification failed:', err.message);
        process.exitCode = 1;
      } finally {
        server.close();
      }
    });
  });

  req.on('error', (e) => {
    console.error(`Request error: ${e.message}`);
    server.close();
    process.exit(1);
  });

  req.write(postData);
  req.end();
});
