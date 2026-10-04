/**
 * Real-time Multi-Language Translation Utility for WhatsApp Debunk Cards
 */

const translationCache = new Map();

/**
 * Split text into chunks smaller than maxLen while preserving sentence boundaries
 */
function splitIntoSentences(text, maxLen = 400) {
  if (text.length <= maxLen) return [text];
  
  const sentences = text.match(/[^.!?\n]+[.!?\n]+/g) || [text];
  const chunks = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLen) {
      currentChunk += sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      if (sentence.length > maxLen) {
        // Force split if single sentence exceeds maxLen
        for (let i = 0; i < sentence.length; i += maxLen) {
          chunks.push(sentence.slice(i, i + maxLen));
        }
        currentChunk = '';
      } else {
        currentChunk = sentence;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}

async function fetchSingleChunk(chunk, langPair) {
  const cacheKey = `${langPair}:${chunk}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  const encoded = encodeURIComponent(chunk);
  const url = `https://api.mymemory.translated.net/get?q=${encoded}&langpair=${langPair}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Translation status: ${response.status}`);
  }

  const data = await response.json();
  if (data?.responseData?.translatedText) {
    const res = data.responseData.translatedText;
    translationCache.set(cacheKey, res);
    return res;
  }
  return chunk;
}

/**
 * Translates English text to Hindi or Marathi
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language ('hi' | 'mr' | 'en')
 * @returns {Promise<string>} Translated text
 */
export async function translateText(text, targetLang) {
  if (!text || typeof text !== 'string' || !text.trim() || targetLang === 'en') {
    return text;
  }

  const langCode = targetLang === 'mr' ? 'mr' : 'hi';
  const langPair = `en|${langCode}`;
  const cleanQuery = text.trim();
  const cacheKey = `${langPair}:${cleanQuery}`;

  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  try {
    const chunks = splitIntoSentences(cleanQuery, 400);
    const translatedChunks = await Promise.all(
      chunks.map(chunk => fetchSingleChunk(chunk, langPair).catch(() => chunk))
    );

    const fullTranslation = translatedChunks.join(' ');
    if (fullTranslation && fullTranslation.trim()) {
      translationCache.set(cacheKey, fullTranslation);
      return fullTranslation;
    }
  } catch (err) {
    console.warn(`Translation to ${targetLang} failed, falling back to original:`, err);
  }

  return text;
}

