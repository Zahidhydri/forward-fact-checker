/**
 * SSE Parser and Stream Client for Forward Fact-Checker
 */

/**
 * Parse an SSE chunk stream supporting both event-based (`event: ...`) and data-only streams.
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader
 * @param {Function} onEvent - (event: { type: string, payload: any, raw: string }) => void
 */
export async function parseSSEStream(reader, onEvent) {
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let currentEventType = 'message';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) {
          continue;
        }

        if (trimmed.startsWith('event: ')) {
          currentEventType = trimmed.slice(7).trim();
          continue;
        }

        if (trimmed.startsWith('data: ')) {
          const rawData = trimmed.slice(6);
          if (rawData === '[DONE]') {
            onEvent({ type: 'DONE', payload: null, raw: rawData });
            currentEventType = 'message';
            continue;
          }

          try {
            const parsed = JSON.parse(rawData);

            // Handle structured payload format { type: 'STEP', payload: ... }
            if (parsed.type && parsed.payload) {
              onEvent(parsed);
            } else {
              // Handle named event stream (event: step, event: verdict, event: error)
              onEvent({
                type: currentEventType.toUpperCase(),
                payload: parsed,
                raw: rawData
              });
            }
          } catch (e) {
            onEvent({
              type: currentEventType.toUpperCase(),
              payload: rawData,
              raw: rawData
            });
          }
          currentEventType = 'message';
        }
      }
    }

    if (buffer.trim().startsWith('data: ')) {
      const rawData = buffer.trim().slice(6);
      if (rawData !== '[DONE]') {
        try {
          const parsed = JSON.parse(rawData);
          if (parsed.type && parsed.payload) {
            onEvent(parsed);
          } else {
            onEvent({ type: currentEventType.toUpperCase(), payload: parsed, raw: rawData });
          }
        } catch {
          onEvent({ type: currentEventType.toUpperCase(), payload: rawData, raw: rawData });
        }
      }
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('SSE Stream reading error:', error);
      throw error;
    }
  }
}

/**
 * Fetch and stream verification results from backend
 * @param {string} url 
 * @param {object} payload 
 * @param {object} callbacks 
 * @param {AbortSignal} [signal]
 */
export async function streamVerification(url, payload, callbacks = {}, signal = null) {
  const {
    onStart = () => {},
    onStep = () => {},
    onVerdict = () => {},
    onCard = () => {},
    onStats = () => {},
    onError = () => {},
    onDone = () => {}
  } = callbacks;

  onStart();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        text: payload.text || payload.content || '',
        lang: payload.lang || 'en'
      }),
      signal
    });

    if (!response.ok) {
      throw new Error(`Backend status: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('ReadableStream not supported by response body');
    }

    const reader = response.body.getReader();

    await parseSSEStream(reader, (event) => {
      switch (event.type) {
        case 'STEP':
          onStep(event.payload);
          break;
        case 'VERDICT':
          onVerdict(event.payload);
          break;
        case 'CARD':
          onCard(event.payload);
          break;
        case 'STATS':
          onStats(event.payload);
          break;
        case 'ERROR':
          onError(event.payload?.message || event.payload || 'An error occurred during verification');
          break;
        case 'DONE':
          onDone();
          break;
        default:
          console.log('Unrecognized SSE Event:', event);
      }
    });

    onDone();
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('Stream aborted by user');
    } else {
      console.error('Verification stream failed:', err);
      onError(err.message || 'Failed to connect to verification backend');
    }
  }
}
