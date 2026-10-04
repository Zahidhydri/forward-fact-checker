import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', agent: 'Forward-Fact-Checker Mock Backend', version: '1.0.0' });
});

// SSE Streaming Verification Endpoint
app.post('/verify', async (req, res) => {
  const { text } = req.body;
  console.log(`[Mock Backend] Received verification request for: "${text?.slice(0, 60)}..."`);

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    const isScam = /free|recharge|lottery|winner|kyc|apk|urgent|bill disconnect|bank|otp|banned|demoneti/i.test(text || '');

    // Step 1: Extract Claims
    sendEvent({
      type: 'STEP',
      payload: {
        step: 'extract_claims',
        status: 'running',
        label: 'Extracting Core Claims & Viral Entities',
        summary: 'Extracting named entities, promotional links, and psychological urgency triggers.',
        claim: text?.slice(0, 100) || 'Viral forwarded message claim'
      }
    });
    await delay(700);

    sendEvent({
      type: 'STEP',
      payload: {
        step: 'extract_claims',
        status: 'done',
        duration: 0.7,
        details: 'Identified 2 primary factual claims and 1 promotional URL signature.'
      }
    });

    // Step 2: Reverse Search
    sendEvent({
      type: 'STEP',
      payload: {
        step: 'reverse_search',
        status: 'running',
        label: 'Searching PIB, Google Fact Check & News Repositories',
        summary: 'Querying official fact-checking registries and press release archives.'
      }
    });
    await delay(900);

    sendEvent({
      type: 'STEP',
      payload: {
        step: 'reverse_search',
        status: 'done',
        duration: 0.9,
        sources: [
          { name: 'PIB Fact Check Registry', url: 'https://factcheck.pib.gov.in' },
          { name: 'BoomLive Truth Repository', url: 'https://www.boomlive.in' }
        ],
        details: 'Found matching debunk alerts and official advisories in the registry.'
      }
    });

    // Step 3: Source Cross Check
    sendEvent({
      type: 'STEP',
      payload: {
        step: 'source_cross_check',
        status: 'running',
        label: 'Entity Cross-Verification & Domain Analysis',
        summary: 'Cross-checking official government websites and domain WHOIS registry.'
      }
    });
    await delay(800);

    sendEvent({
      type: 'STEP',
      payload: {
        step: 'source_cross_check',
        status: 'done',
        duration: 0.8,
        details: 'Cross-checked with TRAI, Department of Telecommunications & cyber crime databases.'
      }
    });

    // Step 4: Detect Manipulation
    sendEvent({
      type: 'STEP',
      payload: {
        step: 'detect_manipulation',
        status: 'running',
        label: 'Psychological Urgency & Scam Pattern Scoring',
        summary: 'Analyzing deception tactics, social engineering cues, and financial risk level.'
      }
    });
    await delay(600);

    sendEvent({
      type: 'STEP',
      payload: {
        step: 'detect_manipulation',
        status: 'done',
        duration: 0.6,
        details: isScam 
          ? 'Critical threat detected: Phishing link designed for credential harvesting.' 
          : 'High contextual divergence detected between viral text and real press release.'
      }
    });

    // Step 5: Synthesizing Verdict
    sendEvent({
      type: 'STEP',
      payload: {
        step: 'synthesizing',
        status: 'running',
        label: 'Synthesizing Verdict & Multi-Lingual Rebuttals',
        summary: 'Compiling structured findings into Hindi, English, and Marathi reply cards.'
      }
    });
    await delay(500);

    sendEvent({
      type: 'STEP',
      payload: {
        step: 'synthesizing',
        status: 'done',
        duration: 0.5
      }
    });

    // Emit Final Verdict
    if (isScam) {
      sendEvent({
        type: 'VERDICT',
        payload: {
          status: 'SCAM',
          confidence: 0.98,
          risk_level: 'critical',
          headline: 'Malicious Phishing Scam / Fraudulent Forward',
          explanation: 'Government departments and telecom operators do NOT offer free 3-month recharges or demand instant electricity payments over unofficial phone numbers. The link in this forward is designed to install malicious malware or steal banking credentials.',
          evidence: [
            'Telecom Regulatory Authority of India (TRAI) confirmed no such scheme exists.',
            'The URL domain is an unverified phishing site hosted on suspicious infrastructure.',
            'Classic urgency mechanism: "Offer expires tonight" used to manipulate users.'
          ],
          sources: [
            { name: 'PIB Fact Check Official Advisory', url: 'https://factcheck.pib.gov.in' },
            { name: 'National Cyber Crime Reporting Portal', url: 'https://cybercrime.gov.in' }
          ]
        }
      });

      sendEvent({
        type: 'CARD',
        payload: {
          hi: `⚠️ *सावधान! यह दावा 100% फेक और स्कैम है* ⚠️\n\nभारत सरकार या किसी भी टेलीकॉम कंपनी द्वारा ऐसा कोई फ्री ऑफर नहीं दिया जा रहा है।\n\n📌 *सच्चाई:* दिए गए लिंक पर क्लिक न करें, यह आपकी निजी जानकारी चुराने का प्रयास है।\n\n🛡️ _Forward Fact-Checker AI द्वारा सत्यापित_`,
          en: `⚠️ *WARNING: This message is a MALICIOUS SCAM* ⚠️\n\nOfficial authorities have confirmed this claim is completely fabricated.\n\n📌 *Fact:* Do NOT click any links or forward this to groups.\n\n🛡️ _Verified via Forward Fact-Checker AI_`,
          mr: `⚠️ *सावधान! हा मेसेज पूर्णपणे बनावट आणि स्कॅम आहे* ⚠️\n\nशासनाने किंवा कोणत्याही कंपनीने अशी घोषणा केलेली नाही.\n\n📌 *वस्तुस्थिती:* या मेसेजमधील कोणत्याही लिंकवर क्लिक करू नका.\n\n🛡️ _Forward Fact-Checker AI द्वारे पडताळणी_`,
          hinglish: `⚠️ *Caution! Yeh message fake phishing scam hai* ⚠️\n\nGovt ya telecom companies aisi koi free scheme nahi deti.\n\n📌 *Fact:* Kisi bhi unknown link par click mat karein.\n\n🛡️ _Forward Fact-Checker AI se verified_`
        }
      });
    } else {
      sendEvent({
        type: 'VERDICT',
        payload: {
          status: 'MISLEADING',
          confidence: 0.91,
          risk_level: 'medium',
          headline: 'Misleading Forward / Distorted Facts',
          explanation: 'This message takes an outdated announcement and manipulates the details with false headlines to create panic.',
          evidence: [
            'Official press release date does not match the viral claim.',
            'No authentic circular issued on the official website.'
          ],
          sources: [
            { name: 'PIB Press Release Archive', url: 'https://pib.gov.in' },
            { name: 'PTI Fact Check', url: 'https://www.ptinews.com' }
          ]
        }
      });

      sendEvent({
        type: 'CARD',
        payload: {
          hi: `⚠️ *ध्यान दें: यह दावा भ्रामक है* ⚠️\n\nइस वायरल संदेश की AI फैक्ट-चेक जांच में जानकारी संदर्भ से बाहर पाई गई है।\n\n📌 *सच्चाई:* बिना आधिकारिक पुष्टि के कृपया इसे आगे फॉरवर्ड न करें।\n\n🛡️ _Forward Fact-Checker AI द्वारा सत्यापित_`,
          en: `⚠️ *ATTENTION: This claim is MISLEADING* ⚠️\n\nThis viral forward takes real facts out of context.\n\n📌 *Fact:* Official archives do not corroborate the viral claim.\n\n🛡️ _Verified via Forward Fact-Checker AI_`,
          mr: `⚠️ *लक्ष द्या: हा दावा दिशाभूल करणारा आहे* ⚠️\n\nया वायरल संदेशात संदर्भ बदलून माहिती दिली गेली आहे.\n\n📌 *वस्तुस्थिती:* कृपया हा मेसेज पुढे पाठवू नका.\n\n🛡️ _Forward Fact-Checker AI द्वारे पडताळणी_`,
          hinglish: `⚠️ *Dhyan dein: Yeh claim misleading hai* ⚠️\n\nIs forward me facts ko distort kiya gaya hai.\n\n📌 *Sach:* Bina verification aage forward mat karein.\n\n🛡️ _Forward Fact-Checker AI se verified_`
        }
      });
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    console.error('[Mock Backend] Error processing verification:', error);
    sendEvent({ type: 'ERROR', payload: error.message });
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`🚀 [Mock Fact-Check Backend] Listening on http://localhost:${PORT}`);
  console.log(`📡 SSE Stream available at POST http://localhost:${PORT}/verify`);
});
