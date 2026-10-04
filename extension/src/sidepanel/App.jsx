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
  ShieldCheck,
  Sparkles,
  Puzzle,
  CheckCircle2,
  ExternalLink,
  Download,
  Copy
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
  const [backendUrl] = useState(DEFAULT_BACKEND_URL);
  const [selectedLang, setSelectedLang] = useState(() => {
    return localStorage.getItem('ffc_selected_lang') || 'en';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showExtensionGuide, setShowExtensionGuide] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
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

  // Synchronize Selected Language to LocalStorage
  useEffect(() => {
    localStorage.setItem('ffc_selected_lang', selectedLang);
  }, [selectedLang]);

  const abortControllerRef = useRef(null);
  const isDark = themeMode === 'dark';
  const activeAccent = getAccentStyles(accentColor);

  const handleOpenOrCopyExtensionsUrl = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      try {
        chrome.tabs.create({ url: 'chrome://extensions' });
      } catch (e) {
        // Fallback
      }
    } else {
      try {
        window.open('chrome://extensions', '_blank');
      } catch (e) {
        // Browsers restrict navigation to chrome://
      }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText('chrome://extensions').catch(() => {});
    }
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const isExtensionEnv = typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);

  // Fallback logo URL for Chrome extension environment
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
        { text: textToVerify, lang: 'en', timestamp: Date.now() },
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
              en: cardText
            });
          },
          onCard: (cardPayload) => {
            if (cardPayload && cardPayload.en) {
              setReplyCard(cardPayload);
            }
          },
          onError: (errMsg) => {
            console.error('Backend verification error:', errMsg);
            setError(typeof errMsg === 'string' ? errMsg : 'Backend verification error. Please try again.');
          },
          onDone: () => {
            setLoading(false);
          }
        },
        abortControllerRef.current.signal
      );
    } catch (err) {
      setError(err.message || 'Verification connection failed');
    } finally {
      setLoading(false);
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
    <div className={`min-h-screen flex flex-col p-3 sm:p-4 lg:p-6 w-full max-w-lg lg:max-w-6xl mx-auto ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Header App Bar */}
      <header className={`flex items-center justify-between pb-2 mb-3 lg:mb-5 border-b ${
        isDark ? 'border-slate-800/80' : 'border-slate-200'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 p-1 rounded-xl flex items-center justify-center bg-slate-900/90 border border-slate-800 shadow-sm flex-shrink-0">
            {!imgError ? (
              <img 
                src={resolvedLogoUrl} 
                alt="Forward Fact-Checker Logo" 
                className="h-full w-auto object-contain"
                onError={() => setImgError(true)}
              />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <h1 className="font-black text-sm sm:text-base tracking-tight leading-none">
              Forward Fact-Checker
            </h1>
            <span className="hidden sm:inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Live AI Verifier
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Extension Setup Guide Button: Only visible in desktop mode, never in extension sidepanel */}
          {!isExtensionEnv && (
            <button
              type="button"
              onClick={() => setShowExtensionGuide(true)}
              className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black transition ${
                isDark ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              title="How to run as Chrome Extension"
            >
              <Puzzle className="w-3.5 h-3.5 text-blue-400" />
              <span>Extension Setup</span>
            </button>
          )}

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
            className={`w-8 h-8 rounded-xl flex items-center justify-center border transition transform hover:scale-105 active:scale-95 ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
            title="Appearance & Language Settings"
          >
            <Sliders className="w-3.5 h-3.5" />
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

            {/* WhatsApp Auto-Check Toggle */}
            <div className={`p-3 rounded-2xl border flex items-center justify-between ${
              isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${
                  autoCheckEnabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
                }`}>
                  <Power className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black block">WhatsApp Auto-Check</span>
                  <span className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {autoCheckEnabled ? 'Auto-scan incoming forwards' : 'Auto-scanning paused'}
                  </span>
                </div>
              </div>

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
            </div>

            {/* Language Selection */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider block mb-2 text-slate-400">Language:</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedLang('en')}
                  className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1 border transition ${
                    selectedLang === 'en'
                      ? `${activeAccent.bgClass || 'bg-blue-600 text-white'} border-transparent shadow-sm`
                      : isDark ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-700'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>English</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedLang('hi')}
                  className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1 border transition ${
                    selectedLang === 'hi'
                      ? `${activeAccent.bgClass || 'bg-blue-600 text-white'} border-transparent shadow-sm`
                      : isDark ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-700'
                  }`}
                >
                  <span>🇮🇳 हिन्दी</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedLang('mr')}
                  className={`py-2 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1 border transition ${
                    selectedLang === 'mr'
                      ? `${activeAccent.bgClass || 'bg-blue-600 text-white'} border-transparent shadow-sm`
                      : isDark ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-700'
                  }`}
                >
                  <span>🚩 मराठी</span>
                </button>
              </div>
            </div>

            {/* Unified Theme & Appearance Styling Card */}
            <div className={`p-3.5 rounded-2xl border ${
              isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              {/* Row 1: Mode Switcher (Dark / Light) */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/60 mb-3">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4" style={{ color: activeAccent.primary }} />
                  <span className="text-xs font-black">Theme Mode</span>
                </div>

                {/* Segmented Pill for Dark / Light */}
                <div className={`p-1 rounded-full border flex items-center gap-1 ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300 shadow-xs'
                }`}>
                  <button
                    type="button"
                    onClick={() => setThemeMode('dark')}
                    className={`px-3 py-1 rounded-full text-[11px] font-black flex items-center gap-1.5 transition ${
                      themeMode === 'dark'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Moon className="w-3 h-3 text-blue-400" />
                    <span>Dark</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setThemeMode('light')}
                    className={`px-3 py-1 rounded-full text-[11px] font-black flex items-center gap-1.5 transition ${
                      themeMode === 'light'
                        ? 'bg-amber-100 text-amber-950 shadow-sm'
                        : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Sun className="w-3 h-3 text-amber-500" />
                    <span>Light</span>
                  </button>
                </div>
              </div>

              {/* Row 2: Accent Palette */}
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider block mb-2 text-slate-400">
                  Accent Color:
                </span>
                <div className="grid grid-cols-5 gap-2">
                  {ACCENT_THEMES.map((theme) => {
                    const isSelected = accentColor === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => setAccentColor(theme.id)}
                        className={`py-2 px-1 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 transform active:scale-95 ${
                          isSelected 
                            ? 'border-white ring-2 ring-white/30 shadow-md bg-white/10' 
                            : isDark ? 'bg-slate-900 border-slate-800 hover:bg-slate-800' : 'bg-white border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span 
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white shadow-sm"
                          style={{ backgroundColor: theme.primary }}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                        <span className="text-[9.5px] font-black truncate w-full px-0.5">
                          {theme.name.split(' ')[1]}
                        </span>
                      </button>
                    );
                  })}
                </div>
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

      {/* Extension Developer Setup Modal */}
      {showExtensionGuide && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowExtensionGuide(false)}
        >
          <div 
            className={`compose-card max-w-md w-full p-5 border shadow-2xl space-y-4 rounded-3xl transform transition-all ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-700/40">
              <span className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                <Puzzle className="w-4 h-4 text-blue-400" />
                <span>Run in WhatsApp Web (Chrome Extension)</span>
              </span>
              <button 
                onClick={() => setShowExtensionGuide(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Forward Fact-Checker integrates directly into <strong>web.whatsapp.com</strong> to detect incoming forwarded messages and provide 1-click in-chat verification.
            </p>

            <div className="space-y-2.5">
              {/* Step 1: Open chrome://extensions */}
              <div className={`p-3 rounded-2xl border flex items-start gap-3 ${
                isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  1
                </span>
                <div className="text-xs flex-1">
                  <p className="font-black">Open Extensions in Chrome</p>
                  <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Navigate to{' '}
                    <button
                      type="button"
                      onClick={handleOpenOrCopyExtensionsUrl}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-blue-950/80 hover:bg-blue-900/90 text-blue-300 border border-blue-800/80 font-mono text-[11px] font-bold transition cursor-pointer group"
                      title="Click to copy & open chrome://extensions"
                    >
                      <span>chrome://extensions</span>
                      {copiedUrl ? (
                        <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                      ) : (
                        <Copy className="w-3 h-3 text-blue-400 group-hover:scale-110 transition" />
                      )}
                    </button>
                  </p>
                  {copiedUrl ? (
                    <span className="inline-block mt-1 text-[10px] font-bold text-emerald-400 animate-fade-in">
                      ✓ Copied to clipboard! Paste into your browser address bar.
                    </span>
                  ) : (
                    <span className="inline-block mt-0.5 text-[10px] text-slate-400">
                      (Click to copy URL or open in new tab)
                    </span>
                  )}
                </div>
              </div>

              {/* Step 2: Enable Developer Mode */}
              <div className={`p-3 rounded-2xl border flex items-start gap-3 ${
                isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  2
                </span>
                <div className="text-xs">
                  <p className="font-black">Enable Developer Mode</p>
                  <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Toggle on <strong>Developer mode</strong> in the top-right corner of the extensions page.
                  </p>
                </div>
              </div>

              {/* Step 3: Download & Load Unpacked */}
              <div className={`p-3 rounded-2xl border flex flex-col gap-2.5 ${
                isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    3
                  </span>
                  <div className="text-xs flex-1">
                    <p className="font-black">Download & Click "Load Unpacked"</p>
                    <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Download the pre-packaged extension zip below, extract it, then click <strong>Load Unpacked</strong> and select the extracted folder (or repo's <code className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 font-mono">extension/dist</code>).
                    </p>
                  </div>
                </div>

                {/* Prominent One-Click Download Button */}
                <div className="pl-9 pr-1">
                  <a
                    href="/forward-fact-checker-extension.zip"
                    download="forward-fact-checker-extension.zip"
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-black text-xs shadow-md shadow-emerald-950/30 transition transform active:scale-98 group no-underline"
                  >
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4 flex-shrink-0 group-hover:-translate-y-0.5 transition-transform" />
                      <span className="tracking-wide">Download Extension (ZIP)</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/30 text-emerald-100">
                      dist.zip • Ready
                    </span>
                  </a>
                  <p className={`text-[10px] mt-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    💡 <em>Extract the ZIP, then choose that folder in Chrome's "Load unpacked" dialog.</em>
                  </p>
                </div>
              </div>

              {/* Step 4: Open WhatsApp Web */}
              <div className={`p-3 rounded-2xl border flex items-start gap-3 ${
                isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  4
                </span>
                <div className="text-xs">
                  <p className="font-black">Open WhatsApp Web</p>
                  <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Visit <code className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-mono">web.whatsapp.com</code> — <strong>"Verify Claim"</strong> badges will appear automatically on forwarded messages!
                  </p>
                </div>
              </div>
            </div>

            <div className={`p-2.5 rounded-xl border text-[11px] font-medium flex items-center gap-2 ${
              isDark ? 'bg-blue-950/40 border-blue-800/60 text-blue-200' : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}>
              <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span>Official Chrome Web Store public listing is in review.</span>
            </div>

            <button
              type="button"
              onClick={() => setShowExtensionGuide(false)}
              className={`w-full py-2.5 rounded-full font-black text-xs transition ${activeAccent.bgClass}`}
            >
              Got It, Close
            </button>
          </div>
        </div>
      )}

      {/* Main Responsive Grid Layout (Single Column in Sidepanel, 2-Column on Desktop) */}
      <div className="flex-1 overflow-y-auto lg:overflow-visible">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
          
          {/* Left Column: Input, Status & Quick Tests (Full width in Sidepanel, 5-cols on Desktop) */}
          <div className="lg:col-span-5 flex flex-col space-y-3.5">
            {/* Desktop Hero intro (hidden on sidepanel, visible on lg) */}
            <div className={`hidden lg:block p-4 rounded-2xl border ${
              isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <span className={`text-[10px] uppercase font-black tracking-wider block mb-1 ${activeAccent.textClass}`}>
                Autonomous Fact-Checking
              </span>
              <h2 className="text-sm font-black leading-snug mb-1">
                Stop Misinformation Before It Spreads
              </h2>
              <p className={`text-xs font-medium leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Paste any viral claim or forwarded message below. Our AI agent retrieves live evidence and cross-checks official registries.
              </p>
            </div>

            {/* Jetpack Compose Material 3 Input Card */}
            <form onSubmit={handleManualSubmit}>
              <div className={`p-3 rounded-2xl border transition-all ${
                isDark 
                  ? 'bg-slate-900 border-slate-800 focus-within:border-slate-700' 
                  : 'bg-white border-slate-300 focus-within:border-slate-400 shadow-sm'
              }`}>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleManualSubmit(e);
                    }
                  }}
                  placeholder="Paste forwarded WhatsApp claim, viral message, or link to verify..."
                  rows={inputText.length > 80 ? 3 : 2}
                  className={`w-full bg-transparent text-xs font-medium focus:outline-none resize-none leading-relaxed ${
                    isDark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'
                  }`}
                />

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 mt-1">
                  <div className="flex items-center gap-2">
                    {inputText ? (
                      <button
                        type="button"
                        onClick={handleClear}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 ${
                          isDark 
                            ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10' 
                            : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                        }`}
                        title="Clear claim"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear</span>
                      </button>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-500">
                        Press Enter to verify
                      </span>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !inputText.trim()}
                    className={`px-4 py-2 rounded-xl text-white font-black text-xs transition disabled:opacity-40 flex items-center gap-1.5 shadow-sm transform active:scale-95 ${activeAccent.bgClass}`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Verify Claim</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Active Claim Card */}
            {query && (
              <div className={`p-3 rounded-2xl border text-xs font-medium flex items-start justify-between gap-2.5 ${
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
              <div className="bg-rose-950/60 border border-rose-800/80 rounded-2xl p-3.5 text-xs text-rose-200 flex items-start gap-2.5">
                <AlertCircle className="w-4.5 h-4.5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-black uppercase tracking-wider">Verification Error</p>
                  <p className="text-[11px] font-medium mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {/* Quick Test Viral Claims (Desktop View: always pinned on left column for judges) */}
            <div className="hidden lg:block">
              <ScamCounter 
                isDark={isDark}
                accent={activeAccent}
                onSelectQuickTest={(sample) => {
                  setInputText(sample);
                  setQuery(sample);
                  startVerificationStream(sample);
                }} 
              />
            </div>

            {/* Chrome Extension Info Card (Desktop View only) */}
            <div className={`hidden lg:block p-4 rounded-2xl border ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-xl bg-blue-500/10 text-blue-400">
                  <Puzzle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black">WhatsApp Web Chrome Extension</h4>
                  <p className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>In-chat automatic detection</p>
                </div>
              </div>
              <p className={`text-xs mb-3 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Forward Fact-Checker also runs inside WhatsApp Web as a Chrome side panel, auto-detecting forwarded claims without leaving your chat.
              </p>
              <button
                type="button"
                onClick={() => setShowExtensionGuide(true)}
                className={`w-full py-2.5 px-3 rounded-xl text-xs font-black border transition flex items-center justify-center gap-2 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
                }`}
              >
                <span>View Developer Setup Guide</span>
              </button>
            </div>
          </div>

          {/* Right Column: AI Output, Steps & Verdict Card (7-cols on Desktop, stacked in Sidepanel) */}
          <div className="lg:col-span-7 flex flex-col space-y-3.5">
            <AgentSteps 
              steps={steps} 
              loading={loading} 
              currentStage={currentStage} 
              isDark={isDark}
              accent={activeAccent}
            />

            <VerdictCard verdict={verdict} isDark={isDark} selectedLang={selectedLang} />

            {(replyCard || verdict) && (
              <ReplyGenerator 
                card={replyCard} 
                verdict={verdict} 
                isDark={isDark} 
                accent={activeAccent} 
                selectedLang={selectedLang}
                onSelectLang={setSelectedLang}
              />
            )}

            {/* Quick Test Viral Claims on Sidepanel (only visible when idle in narrow view) */}
            <div className="block lg:hidden">
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
            </div>

            {/* Desktop Idle State Illustration (when no claim has been run yet) */}
            {!loading && !verdict && steps.length === 0 && (
              <div className={`hidden lg:flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed text-center min-h-[320px] ${
                isDark ? 'border-slate-800 bg-slate-900/30' : 'border-slate-300 bg-slate-50'
              }`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${
                  isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-100 text-blue-600'
                }`}>
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-black mb-1">
                  AI Multi-Agent Verifier Ready
                </h3>
                <p className={`text-xs max-w-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Select any viral claim from the quick-test list on the left, or paste a forwarded WhatsApp claim to start live multi-source verification.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className={`pt-3 border-t text-center text-[11px] font-bold flex items-center justify-between ${
        isDark ? 'border-slate-800/80 text-slate-400' : 'border-slate-200 text-slate-600'
      }`}>
        <div className="flex items-center gap-1.5 font-black">
          {!imgError ? (
            <img 
              src={resolvedLogoUrl} 
              alt="Logo" 
              className="h-3.5 w-auto object-contain inline-block flex-shrink-0" 
              style={{ height: '14px', width: 'auto' }}
            />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 inline-block flex-shrink-0" />
          )}
          <span className="text-[11px]">Forward Fact-Checker</span>
        </div>
        <span className="font-black" style={{ color: activeAccent.primary }}>
          Built by Fardeen & Zahid
        </span>
      </footer>
    </div>
  );
}
