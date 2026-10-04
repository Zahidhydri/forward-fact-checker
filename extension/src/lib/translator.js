/**
 * Real-time Multi-Language Translation Utility for WhatsApp Debunk Cards
 */

const translationCache = new Map();

/**
 * Translates English text to Hindi or Marathi
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language ('hi' | 'mr' | 'en' | 'hinglish')
 * @returns {Promise<string>} Translated text
 */
export async function translateText(text, targetLang) {
  if (!text || typeof text !== 'string' || !text.trim() || targetLang === 'en') {
    return text;
  }

  // Hinglish handles translation via custom formatting or Hindi base
  const langPair = targetLang === 'mr' ? 'en|mr' : 'en|hi';
  const cleanQuery = text.trim();
  const cacheKey = `${langPair}:${cleanQuery}`;

  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  try {
    const encoded = encodeURIComponent(cleanQuery.slice(0, 500));
    const url = `https://api.mymemory.translated.net/get?q=${encoded}&langpair=${langPair}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Translation API status ${response.status}`);
    }

    const data = await response.json();
    if (data?.responseData?.translatedText) {
      const translated = data.responseData.translatedText;
      translationCache.set(cacheKey, translated);
      return translated;
    }
  } catch (err) {
    console.warn(`Translation to ${targetLang} failed, using original:`, err);
  }

  return text;
}
