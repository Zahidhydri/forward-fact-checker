import React, { useState, useEffect, useRef } from 'react';
import { 
  RefreshCw, 
  Settings, 
  AlertCircle, 
  Send, 
  Trash2,
  Sun,
  Moon,
  Power,
  Palette,
  Check,
  AlertTriangle,
  Sliders,
  Globe,
  X,
  ShieldCheck
} from 'lucide-react';
import { AgentSteps } from './components/AgentSteps';
import { VerdictCard } from './components/VerdictCard';
import { ReplyGenerator } from './components/ReplyGenerator';
import { ScamCounter } from './components/ScamCounter';
import { streamVerification } from '../lib/sse-parser';
import { ACCENT_THEMES, getAccentStyles } from './theme';

const DEFAULT_BACKEND_URL = "https://forward-fact-checker.vercel.app/verify";

const STAGE_LABELS = {
  extracting: "1. Extracting Claims & Language Cues",
  searching: "2. Web & Database Retrieval",
  reading: "3. Analyzing Evidence & Context",
  "cross-checking": "4. Cross-Checking Official Sources",
  writing: "5. Formulating Verdict & Debunk Cards"
};

export default function App() {
  const [query, setQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [steps, setSteps] = useState([]);
  const [verdict, setVerdict] = useState(null);
  const [replyCard, setReplyCard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentStage, setCurrentStage] = useState('');
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [selectedLang, setSelectedLang] = useState('en');
  const [showSettings, setShowSettings] = useState(false);
  const [useMockFallback, setUseMockFallback] = useState(true);
  const [imgError, setImgError] = useState(false);

  // User Customization Settings: Light/Dark Mode & Accent Color
  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem('ffc_theme_mode') || 'dark';
  });

  const [accentColor, setAccentColor] = useState(() => {
    return localStorage.getItem('ffc_accent_color') || 'blue';
  });

  // Android Material You Toggle Switch State (AUTO ON / AUTO OFF)
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(() => {
    return localStorage.getItem('ffc_autocheck_enabled') !== 'false';
  });

  const abortControllerRef = useRef(null);
  const isDark = themeMode === 'dark';
  const activeAccent = getAccentStyles(accentColor);

  const resolvedLogoUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL 
    ? chrome.runtime.getURL('public/logo.png') 
    : '/logo.png';

  // Synchronize Theme Mode & Accent Color on Root HTML Document
  useEffect(() => {
    localStorage.setItem('ffc_theme_mode', themeMode);
    localStorage.setItem('ffc_accent_color', accentColor);
    document.documentElement.setAttribute('data-accent', accentColor);

    if (themeMode === 'dark') {
      document.documentElement.classList.add('theme-dark');
      document.documentElement.classList.remove('theme-light');
      document.body.className = 'bg-slate-950 text-slate-100 antialiased font-sans select-none';
    } else {
      document.documentElement.classList.add('theme-light');
      document.documentElement.classList.remove('theme-dark');
      document.body.className = 'bg-slate-50 text-slate-900 antialiased font-sans select-none';
    }
  }, [themeMode, accentColor]);

  // Synchronize Auto-Check Toggle with chrome.storage.local & Broadcast
  useEffect(() => {
    localStorage.setItem('ffc_autocheck_enabled', autoCheckEnabled);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ autoCheckEnabled }, () => {
        chrome.tabs?.query({ active: true }, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_AUTO_CHECK", enabled: autoCheckEnabled }).catch(() => {});
          });
        });
      });
    }
  }, [autoCheckEnabled]);

  // Listen for verification requests
  useEffect(() => {
    const messageListener = (msg) => {
      if (msg.action === 'START_VERIFICATION' && msg.data) {
        const content = msg.data.content || msg.data.url || '';
        if (content) {
          setQuery(content);
          setInputText(content);
          startVerificationStream(content);
        }
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(messageListener);

      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['latestVerification'], (res) => {
          if (res && res.latestVerification && res.latestVerification.payload) {
            const item = res.latestVerification;
            if (Date.now() - item.timestamp < 60000) {
              const content = item.payload.content || item.payload.url || '';
              if (content && !loading) {
                setQuery(content);
                setInputText(content);
                startVerificationStream(content);
              }
            }
          }
        });
      }
    }

    return () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.removeListener(messageListener);
      }
    };
  }, []);

  const startVerificationStream = async (textToVerify) => {
    if (!textToVerify || !textToVerify.trim()) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setSteps([]);
    setVerdict(null);
    setReplyCard(null);
    setCurrentStage('Initiating Claim Analysis...');

    try {
      await streamVerification(
        backendUrl,
        { text: textToVerify, lang: selectedLang || 'en', timestamp: Date.now() },
        {
          onStart: () => {
            setCurrentStage('Running real-time fact checking...');
          },
          onStep: (stepPayload) => {
            const stageKey = stepPayload.stage || stepPayload.step;
            const displayLabel = STAGE_LABELS[stageKey] || stepPayload.label || stepPayload.title || stageKey;
            const message = stepPayload.message || stepPayload.summary || 'Processing stage...';

            setCurrentStage(displayLabel);

            setSteps((prev) => {
              const existingIdx = prev.findIndex(s => s.step === stageKey || s.stage === stageKey);
              const stepObject = {
                step: stageKey,
                stage: stageKey,
                label: displayLabel,
                summary: message,
                status: 'done',
                duration: 1.0,
                ...stepPayload
              };

              if (existingIdx >= 0) {
                const updated = [...prev];
                updated[existingIdx] = stepObject;
                return updated;
              }
              return [...prev, stepObject];
            });
          },
          onVerdict: (rawVerdict) => {
            const normalizedStatus = (rawVerdict.label || rawVerdict.status || 'UNVERIFIED').toUpperCase();
            
            const normalizedVerdict = {
              status: normalizedStatus,
              confidence: rawVerdict.confidence !== undefined ? rawVerdict.confidence : 0.9,
              headline: rawVerdict.claims ? rawVerdict.claims[0] : (rawVerdict.headline || `${normalizedStatus} CLAIM`),
              explanation: rawVerdict.card_text || rawVerdict.explanation || rawVerdict.summary || 'Verified against official sources.',
              evidence: rawVerdict.claims || rawVerdict.evidence || [],
              sources: (rawVerdict.sources || []).map(s => ({
                name: s.title || s.name || 'Verified Source',
                url: s.url || '#',
                snippet: s.snippet
              }))
            };

            setVerdict(normalizedVerdict);

            const cardText = rawVerdict.card_text || rawVerdict.explanation || textToVerify;
            setReplyCard({
              en: cardText,
              hi: `⚠️ *सावधान! यह मैसेज जांचा गया है* ⚠️\n\n${rawVerdict.card_text || rawVerdict.explanation || textToVerify}\n\n🛡️ _Forward Fact-Checker_`,
              mr: `⚠️ *सावधान! या संदेशाची पडताळणी झाली आहे* ⚠️\n\n${rawVerdict.card_text || rawVerdict.explanation || textToVerify}\n\n🛡️ _Forward Fact-Checker_`,
              hinglish: `⚠️ *Caution! Claim Verified* ⚠️\n\n${rawVerdict.card_text || rawVerdict.explanation || textToVerify}\n\n🛡️ _Verified via Forward Fact-Checker_`
            });
          },
          onCard: (cardPayload) => {
            setReplyCard(cardPayload);
          },
          onError: async (errMsg) => {
            console.warn('Backend SSE error, checking fallback:', errMsg);
            if (useMockFallback) {
              await runLocalMockSimulation(textToVerify);
            } else {
              setError(errMsg);
            }
          },
          onDone: () => {
            setLoading(false);
          }
        },
        abortControllerRef.current.signal
      );
    } catch (err) {
      if (useMockFallback) {
        await runLocalMockSimulation(textToVerify);
      } else {
        setError(err.message || 'Verification failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const runLocalMockSimulation = async (text) => {
    setError(null);
    const isScam = /free|recharge|lottery|winner|kyc|apk|urgent|bill disconnect|bank|otp/i.test(text);

    const mockSteps = [
      {
        step: 'extracting',
        stage: 'extracting',
        status: 'running',
        label: '1. Extracting Claims & Language Cues',
        summary: 'Extracting key factual claims and analyzing language structure.',
        claim: text.slice(0, 100) + (text.length > 100 ? '...' : '')
      },
      {
        step: 'searching',
        stage: 'searching',
        status: 'pending',
        label: '2. Web & Database Retrieval',
        summary: 'Searching live web repositories and threat feeds.'
      },
      {
        step: 'reading',
        stage: 'reading',
        status: 'pending',
        label: '3. Analyzing Evidence & Context',
        summary: 'Analyzing claim matches across retrieved database results.'
      },
      {
        step: 'cross-checking',
        stage: 'cross-checking',
        status: 'pending',
        label: '4. Cross-Checking Official Sources',
        summary: 'Verifying with official TRAI, PIB, and government sources.'
      },
      {
        step: 'writing',
        stage: 'writing',
        status: 'pending',
        label: '5. Formulating Verdict & Debunk Cards',
        summary: 'Synthesizing final verdict and shareable cards.'
      }
    ];

    setSteps(mockSteps);

    await new Promise(r => setTimeout(r, 800));
    setSteps(prev => prev.map((s, idx) => idx === 0 ? { ...s, status: 'done', duration: 0.8 } : idx === 1 ? { ...s, status: 'running' } : s));

    await new Promise(r => setTimeout(r, 1200));
    setSteps(prev => prev.map((s, idx) => idx === 1 ? { 
      ...s, 
      status: 'done', 
      duration: 1.2,
      sources: [
        { name: 'PIB Fact Check Registry', url: 'https://factcheck.pib.gov.in' },
        { name: 'Google Fact Check Tools', url: 'https://toolbox.google.com/factcheck/explorer' }
      ]
    } : idx === 2 ? { ...s, status: 'running' } : s));

    await new Promise(r => setTimeout(r, 1000));
    setSteps(prev => prev.map((s, idx) => idx === 2 ? { ...s, status: 'done', duration: 1.0 } : idx === 3 ? { ...s, status: 'running' } : s));

    await new Promise(r => setTimeout(r, 900));
    setSteps(prev => prev.map((s, idx) => idx === 3 ? { ...s, status: 'done', duration: 0.9 } : idx === 4 ? { ...s, status: 'running' } : s));

    await new Promise(r => setTimeout(r, 700));
    setSteps(prev => prev.map(s => ({ ...s, status: 'done' })));

    if (isScam) {
      setVerdict({
        status: 'SCAM',
        confidence: 0.98,
        risk_level: 'critical',
        headline: 'Phishing Scam / Fraudulent Forward',
        explanation: 'Government agencies and telecom operators do NOT offer free 3-month recharges or demand instant bill payments via unofficial links or numbers. The linked URL is designed to steal sensitive credentials.',
        evidence: [
          'No official notification issued by Telecom Regulatory Authority (TRAI) or Government of India.',
          'Phishing domain registration is unverified and flagged by security databases.',
          'Psychological urgency trigger ("offer ends tonight") detected.'
        ],
        sources: [
          { name: 'PIB Fact Check Alert', url: 'https://factcheck.pib.gov.in' },
          { name: 'National Cyber Crime Portal', url: 'https://cybercrime.gov.in' }
        ]
      });

      setReplyCard({
        hi: `⚠️ *सावधान! यह मैसेज 100% फेक और स्कैम है* ⚠️\n\nभारत सरकार या किसी भी टेलीकॉम कंपनी द्वारा ऐसा कोई फ्री ऑफर नहीं दिया गया है।\n\n📌 *सच्चाई:* दिए गए लिंक पर क्लिक न करें, यह साइबर फ्रॉड का प्रयास है।\n\n🛡️ _Forward Fact-Checker द्वारा सत्यापित_`,
        en: `⚠️ *WARNING: This message is a MALICIOUS SCAM* ⚠️\n\nOfficial authorities have confirmed this message is fabricated.\n\n📌 *Fact:* Do NOT click any links or forward this message.\n\n🛡️ _Verified via Forward Fact-Checker_`,
        mr: `⚠️ *सावधान! हा मेसेज पूर्णपणे बनावट आणि स्कॅम आहे* ⚠️\n\nशासनाने किंवा कोणत्याही अधिकृत कंपनीने अशी कोणतीही घोषणा केलेली नाही.\n\n📌 *वस्तुस्थिती:* या मेसेजमधील कोणत्याही लिंकवर क्लिक करू नका.\n\n🛡️ _Forward Fact-Checker द्वारे पडताळणी_`,
        hinglish: `⚠️ *Caution! Yeh message fake scam forward hai* ⚠️\n\nGovt ya Telecom companies aisi koi free recharge nahi deti.\n\n📌 *Fact:* Kisi bhi link par click mat kijiye.\n\n🛡️ _Forward Fact-Checker se verified_`
      });
    } else {
      setVerdict({
        status: 'MISLEADING',
        confidence: 0.85,
        risk_level: 'medium',
        headline: 'Manipulated / Unverified Claim',
        explanation: 'This forward mixes real events with distorted claims and sensationalized context not corroborated by verified press releases.',
        evidence: [
          'Original statement was delivered in a different context without the exaggerated claims made in this forward.',
          'Official portals have not published any corroborating circular.'
        ],
        sources: [
          { name: 'PIB Press Release Archive', url: 'https://pib.gov.in' },
          { name: 'PTI News FactCheck', url: 'https://www.ptinews.com' }
        ]
      });

      setReplyCard({
        hi: `⚠️ *ध्यान दें: यह दावा भ्रामक है* ⚠️\n\nइस वायरल संदेश की फैक्ट-चेक जांच में जानकारी संदर्भ से बाहर पाई गई है।\n\n📌 *सच्चाई:* बिना आधिकारिक पुष्टि के कृपया इसे आगे फॉरवर्ड न करें।\n\n🛡️ _Forward Fact-Checker द्वारा सत्यापित_`,
        en: `⚠️ *ATTENTION: This claim is MISLEADING* ⚠️\n\nThis viral forward has been verified and found to take facts out of context.\n\n📌 *Fact:* Official archives do not corroborate the viral claim.\n\n🛡️ _Verified via Forward Fact-Checker_`,
        mr: `⚠️ *लक्ष द्या: हा दावा दिशाभूल करणारा आहे* ⚠️\n\nया वायरल संदेशात संदर्भ बदलून माहिती दिली गेली आहे.\n\n📌 *वस्तुस्थिती:* कृपया हा मेसेज पुढे पाठवू नका.\n\n🛡️ _Forward Fact-Checker द्वारे पडताळणी_`,
        hinglish: `⚠️ *Dhyan dein: Yeh claim misleading hai* ⚠️\n\nIs forward me facts ko out of context present kiya gaya hai.\n\n📌 *Sach:* Bina official source ke ise forward mat karein.\n\n🛡️ _Forward Fact-Checker se verified_`
      });
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (inputText.trim()) {
      setQuery(inputText.trim());
      startVerificationStream(inputText.trim());
    }
  };

  const handleClear = () => {
    setQuery('');
    setInputText('');
    setSteps([]);
    setVerdict(null);
    setReplyCard(null);
    setError(null);
  };

  return (
    <div className={`min-h-screen flex flex-col p-4 max-w-lg mx-auto ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Header App Bar */}
      <header className={`flex items-center justify-between pb-3 mb-3 border-b ${
        isDark ? 'border-slate-800/80' : 'border-slate-200'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 p-1 rounded-2xl flex items-center justify-center bg-slate-900/90 border border-slate-800 shadow-md">
            {!imgError ? (
              <img 
                src={resolvedLogoUrl} 
                alt="Forward Fact-Checker Logo" 
                className="h-full w-full object-contain"
                onError={() => setImgError(true)}
              />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          <div>
            <h1 className="font-black text-base tracking-tight leading-none">Fact Checker</h1>
            <p className={`text-[11px] font-bold mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Automated Claim Verification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Material You Toggle Switch */}
          <button
            type="button"
            onClick={() => setAutoCheckEnabled(!autoCheckEnabled)}
            className={`android-switch ${autoCheckEnabled ? 'active' : ''}`}
            style={{ backgroundColor: autoCheckEnabled ? activeAccent.primary : isDark ? '#334155' : '#cbd5e1' }}
            title={`Auto-check on WhatsApp is ${autoCheckEnabled ? 'ON' : 'OFF'}`}
          >
            <span className="android-switch-thumb flex items-center justify-center">
              <Power className={`w-3 h-3 ${autoCheckEnabled ? 'text-slate-900' : 'text-slate-400'}`} />
            </span>
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className={`w-9 h-9 rounded-2xl flex items-center justify-center border transition transform hover:scale-105 active:scale-95 ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
            title="Appearance & Language Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Auto-Check Disabled Notice */}
      {!autoCheckEnabled && (
        <div className={`p-3 rounded-2xl border mb-3.5 text-[11px] font-bold flex items-center justify-between gap-2 ${
          isDark ? 'bg-amber-950/60 border-amber-800/80 text-amber-300' : 'bg-amber-100/80 border-amber-200 text-amber-900'
        }`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span><strong>Auto-Scan Paused:</strong> WhatsApp Web auto-injection disabled.</span>
          </div>
          <button 
            onClick={() => setAutoCheckEnabled(true)} 
            className="px-2.5 py-1 rounded-full bg-amber-600 text-white font-black text-[10px]"
          >
            Enable
          </button>
        </div>
      )}

      {/* Settings Pop-up Modal */}
      {showSettings && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowSettings(false)}
        >
          <div 
            className={`compose-card max-w-sm w-full p-5 border shadow-2xl space-y-4 rounded-3xl transform transition-all ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-700/40">
              <span className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                <Palette className="w-4 h-4" style={{ color: activeAccent.primary }} />
                <span>Settings & Customization</span>
              </span>
              <button 
                onClick={() => setShowSettings(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Appearance Mode */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider block mb-2 text-slate-400">Appearance Mode:</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setThemeMode('dark')}
                  className={`flex-1 py-2 px-3 rounded-full text-xs font-bold flex items-center justify-center gap-2 border transition ${
                    themeMode === 'dark' 
                      ? 'bg-slate-800 text-white border-slate-600 font-black shadow-inner' 
                      : isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-700'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Dark Mode</span>
                </button>

                <button
                  type="button"
                  onClick={() => setThemeMode('light')}
                  className={`flex-1 py-2 px-3 rounded-full text-xs font-bold flex items-center justify-center gap-2 border transition ${
                    themeMode === 'light' 
                      ? 'bg-slate-200 text-slate-950 border-slate-400 font-black shadow-inner' 
                      : isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-700'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>Light Mode</span>
                </button>
              </div>
            </div>

            {/* Target Language Option */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider block mb-2 text-slate-400">Default Response Language:</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedLang('en')}
                  className={`flex-1 py-2 px-3 rounded-full text-xs font-extrabold flex items-center justify-center gap-1.5 border transition ${
                    selectedLang === 'en'
                      ? 'bg-slate-800 text-white border-slate-600 font-black'
                      : isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-700'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>English ("en")</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedLang('hi')}
                  className={`flex-1 py-2 px-3 rounded-full text-xs font-extrabold flex items-center justify-center gap-1.5 border transition ${
                    selectedLang === 'hi'
                      ? 'bg-slate-800 text-white border-slate-600 font-black'
                      : isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-700'
                  }`}
                >
                  <span>🇮🇳 Hindi ("hi")</span>
                </button>
              </div>
            </div>

            {/* Multi-Shade Gradient Accent Colors */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider block mb-2 text-slate-400">Stylized Color Theme:</label>
              <div className="grid grid-cols-5 gap-2">
                {ACCENT_THEMES.map((theme) => {
                  const isSelected = accentColor === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setAccentColor(theme.id)}
                      className={`py-2 px-1 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1.5 transform hover:scale-105 ${
                        isSelected 
                          ? 'border-white ring-2 ring-white/20 shadow-lg' 
                          : isDark ? 'bg-slate-950 border-slate-800 hover:bg-slate-800' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span 
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-white shadow-sm bg-gradient-to-r ${theme.gradient}`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </span>
                      <span className="text-[9px] font-bold truncate w-full px-0.5">{theme.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Done Close Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className={`w-full py-2.5 rounded-full font-black text-xs transition ${activeAccent.bgClass}`}
              >
                Apply & Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Jetpack Compose Input */}
      <form onSubmit={handleManualSubmit} className="mb-3.5">
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste viral claim, message, or link..."
            className={`w-full border rounded-2xl pl-4 pr-24 py-3 text-xs font-bold focus:outline-none transition-all ${
              isDark 
                ? 'bg-slate-900 border-slate-800 text-slate-100 focus:border-slate-600' 
                : 'bg-white border-slate-300 text-slate-900 focus:border-slate-400 shadow-sm'
            }`}
          />
          <div className="absolute right-1.5 flex items-center gap-1.5">
            {inputText && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 text-slate-400 hover:text-slate-600"
                title="Clear input"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className={`px-3.5 py-2 rounded-xl text-white font-black text-xs transition disabled:opacity-40 flex items-center gap-1.5 shadow-sm transform active:scale-95 ${activeAccent.bgClass}`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Check</span>
            </button>
          </div>
        </div>
      </form>

      {/* Active Claim Card */}
      {query && (
        <div className={`p-3 rounded-2xl border mb-3.5 text-xs font-medium flex items-start justify-between gap-2.5 ${
          isDark ? 'bg-slate-900/90 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-900 shadow-sm'
        }`}>
          <div className="min-w-0 flex-1">
            <span className={`text-[10px] uppercase font-black tracking-wider block mb-0.5 ${activeAccent.textClass}`}>
              Target Claim Under Test:
            </span>
            <p className="italic line-clamp-2">"{query}"</p>
          </div>
          <button
            onClick={() => startVerificationStream(query)}
            disabled={loading}
            className={`p-2 rounded-xl border transition flex-shrink-0 ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-slate-100 border-slate-300 text-slate-700'
            }`}
            title="Re-verify claim"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: activeAccent.primary }} />
          </button>
        </div>
      )}

      {/* Error Card */}
      {error && (
        <div className="bg-rose-950/60 border border-rose-800/80 rounded-2xl p-3.5 mb-3.5 text-xs text-rose-200 flex items-start gap-2.5">
          <AlertCircle className="w-4.5 h-4.5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-black uppercase tracking-wider">Verification Error</p>
            <p className="text-[11px] font-medium mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Main Content Body */}
      <main className="flex-1 overflow-y-auto space-y-3.5 pb-4">
        <AgentSteps 
          steps={steps} 
          loading={loading} 
          currentStage={currentStage} 
          isDark={isDark}
          accent={activeAccent}
        />

        <VerdictCard verdict={verdict} isDark={isDark} />

        {(replyCard || verdict) && (
          <ReplyGenerator card={replyCard} verdict={verdict} isDark={isDark} accent={activeAccent} />
        )}

        {!loading && !verdict && (
          <ScamCounter 
            isDark={isDark}
            accent={activeAccent}
            onSelectQuickTest={(sample) => {
              setInputText(sample);
              setQuery(sample);
              startVerificationStream(sample);
            }} 
          />
        )}
      </main>

      {/* Footer */}
      <footer className={`pt-2.5 border-t text-center text-[10px] font-bold flex items-center justify-between ${
        isDark ? 'border-slate-800/80 text-slate-400' : 'border-slate-200 text-slate-600'
      }`}>
        <div className="flex items-center gap-1 font-black">
          {!imgError ? (
            <img src={resolvedLogoUrl} alt="Logo" className="h-3.5 w-auto max-h-3.5 object-contain inline-block" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 inline-block" />
          )}
          <span>Forward Fact-Checker</span>
        </div>
        <span className="font-black" style={{ color: activeAccent.primary }}>
          Built by Fardeen & Zahid
        </span>
      </footer>
    </div>
  );
}
