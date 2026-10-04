import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  XCircle, 
  HelpCircle, 
  ShieldAlert, 
  ExternalLink, 
  Sparkles,
  ShieldCheck,
  Info,
  Loader2
} from 'lucide-react';
import { translateText } from '../../lib/translator';

const VERDICT_CONFIG = {
  SCAM: {
    title: 'MALICIOUS SCAM / FRAUD',
    badge: 'SCAM DETECTED',
    badgeBg: 'bg-rose-600 text-white font-black',
    headerBgDark: 'bg-rose-950/60 border-rose-900/80',
    headerBgLight: 'bg-rose-100/90 border-rose-200',
    textColorDark: 'text-rose-300',
    textColorLight: 'text-rose-900',
    icon: ShieldAlert,
    tagline: 'High financial/security risk. Do NOT share or click links.'
  },
  FAKE: {
    title: 'FALSE / FABRICATED',
    badge: 'FABRICATED CLAIM',
    badgeBg: 'bg-rose-600 text-white font-black',
    headerBgDark: 'bg-rose-950/60 border-rose-900/80',
    headerBgLight: 'bg-rose-100/90 border-rose-200',
    textColorDark: 'text-rose-300',
    textColorLight: 'text-rose-900',
    icon: XCircle,
    tagline: 'Debunked by official fact-checking registries.'
  },
  MISLEADING: {
    title: 'MISLEADING / OUT OF CONTEXT',
    badge: 'MISLEADING',
    badgeBg: 'bg-amber-600 text-white font-black',
    headerBgDark: 'bg-amber-950/60 border-amber-900/80',
    headerBgLight: 'bg-amber-100/90 border-amber-200',
    textColorDark: 'text-amber-300',
    textColorLight: 'text-amber-900',
    icon: AlertTriangle,
    tagline: 'Contains partial truth but presented out of context.'
  },
  VERIFIED: {
    title: 'VERIFIED / AUTHENTIC',
    badge: 'VERIFIED TRUE',
    badgeBg: 'bg-emerald-600 text-white font-black',
    headerBgDark: 'bg-emerald-950/60 border-emerald-900/80',
    headerBgLight: 'bg-emerald-100/90 border-emerald-200',
    textColorDark: 'text-emerald-300',
    textColorLight: 'text-emerald-900',
    icon: ShieldCheck,
    tagline: 'Information aligns with credible official records.'
  },
  SATIRE: {
    title: 'SATIRE / PARODY',
    badge: 'SATIRE',
    badgeBg: 'bg-indigo-600 text-white font-black',
    headerBgDark: 'bg-indigo-950/60 border-indigo-900/80',
    headerBgLight: 'bg-indigo-100/90 border-indigo-200',
    textColorDark: 'text-indigo-300',
    textColorLight: 'text-indigo-900',
    icon: Sparkles,
    tagline: 'Created for humor/parody, not intended as factual news.'
  },
  UNVERIFIED: {
    title: 'UNVERIFIED / INSUFFICIENT DATA',
    badge: 'UNVERIFIED',
    badgeBg: 'bg-slate-700 text-white font-black',
    headerBgDark: 'bg-slate-900 border-slate-800',
    headerBgLight: 'bg-slate-200 border-slate-300',
    textColorDark: 'text-slate-200',
    textColorLight: 'text-slate-900',
    icon: HelpCircle,
    tagline: 'Insufficient evidence to confirm or debunk at this time.'
  }
};

export function VerdictCard({ verdict, isDark = true, selectedLang = 'en' }) {
  const [translatedData, setTranslatedData] = useState({
    headline: '',
    explanation: '',
    tagline: '',
    evidence: []
  });
  const [isTranslating, setIsTranslating] = useState(false);

  const statusKey = (verdict?.status || 'UNVERIFIED').toUpperCase();
  const config = VERDICT_CONFIG[statusKey] || VERDICT_CONFIG.UNVERIFIED;
  const IconComponent = config.icon;

  useEffect(() => {
    if (!verdict) return;
    if (!selectedLang || selectedLang === 'en') {
      setTranslatedData({ headline: '', explanation: '', tagline: '', evidence: [] });
      setIsTranslating(false);
      return;
    }

    let isMounted = true;
    setIsTranslating(true);

    const headlineToTrans = verdict.headline || config.title;
    const explanationToTrans = verdict.explanation || verdict.summary || '';
    const tagline = config.tagline || '';
    const evidenceList = verdict.evidence || [];

    const evidencePromises = evidenceList.map(item => {
      const text = typeof item === 'string' ? item : (item.point || item.summary || '');
      return text ? translateText(text, selectedLang) : Promise.resolve('');
    });

    Promise.all([
      translateText(headlineToTrans, selectedLang),
      translateText(explanationToTrans, selectedLang),
      tagline ? translateText(tagline, selectedLang) : Promise.resolve(''),
      Promise.all(evidencePromises)
    ]).then(([transHeadline, transExplanation, transTagline, transEvidence]) => {
      if (isMounted) {
        setTranslatedData({
          headline: transHeadline,
          explanation: transExplanation,
          tagline: transTagline,
          evidence: transEvidence
        });
        setIsTranslating(false);
      }
    }).catch((err) => {
      console.warn('Verdict translation error:', err);
      if (isMounted) setIsTranslating(false);
    });

    return () => {
      isMounted = false;
    };
  }, [verdict?.headline, verdict?.explanation, verdict?.summary, verdict?.evidence, selectedLang, config.title, config.tagline]);

  if (!verdict) return null;

  const confidencePercent = Math.round(
    (verdict.confidence !== undefined ? verdict.confidence : 0.95) * (verdict.confidence <= 1 ? 100 : 1)
  );

  const displayHeadline = (selectedLang !== 'en' && translatedData.headline) 
    ? translatedData.headline 
    : (verdict.headline || config.title);

  const displayExplanation = (selectedLang !== 'en' && translatedData.explanation)
    ? translatedData.explanation
    : (verdict.explanation || verdict.summary);

  const displayTagline = (selectedLang !== 'en' && translatedData.tagline)
    ? translatedData.tagline
    : config.tagline;

  const displayEvidence = (selectedLang !== 'en' && translatedData.evidence && translatedData.evidence.length > 0)
    ? translatedData.evidence
    : (verdict.evidence || []);

  return (
    <div className={`compose-card p-4.5 mb-4 border ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
      {/* Banner Box */}
      <div className={`p-3.5 rounded-2xl border mb-3.5 flex items-start justify-between gap-3 ${
        isDark ? config.headerBgDark : config.headerBgLight
      }`}>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-2xl bg-white/10 backdrop-blur-sm">
            <IconComponent className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full ${config.badgeBg}`}>
                {config.badge}
              </span>
              {verdict.risk_level && (
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase ${
                  isDark ? 'bg-slate-950/80 text-slate-200 border-slate-700' : 'bg-white text-slate-800 border-slate-300'
                }`}>
                  Risk: {verdict.risk_level}
                </span>
              )}
              {selectedLang !== 'en' && (
                isTranslating ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Translating...</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    {selectedLang === 'hi' ? '🇮🇳 हिन्दी' : '🚩 मराठी'}
                  </span>
                )
              )}
            </div>
            <h3 className={`text-sm font-black leading-snug ${isDark ? 'text-white' : 'text-slate-950'}`}>
              {displayHeadline}
            </h3>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <span className={`text-[10px] font-bold uppercase tracking-wider block ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Accuracy
          </span>
          <span className={`text-base font-black ${isDark ? config.textColorDark : config.textColorLight}`}>
            {confidencePercent}%
          </span>
        </div>
      </div>

      {/* Summary Explanation */}
      <div className={`p-3.5 rounded-2xl border text-xs font-medium leading-relaxed mb-3.5 ${
        isDark ? 'bg-slate-950/70 border-slate-800/80 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
      }`}>
        <p>{displayExplanation}</p>
        
        {displayTagline && (
          <div className={`mt-2.5 pt-2.5 border-t text-[11px] font-bold flex items-center gap-1.5 ${
            isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-600'
          }`}>
            <Info className="w-4 h-4 flex-shrink-0 text-slate-400" />
            <span>{displayTagline}</span>
          </div>
        )}
      </div>

      {/* Key Evidence */}
      {displayEvidence && displayEvidence.length > 0 && (
        <div className="mb-3.5">
          <h4 className={`text-[11px] font-black uppercase tracking-wider mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {selectedLang === 'hi' ? 'मुख्य तथ्यात्मक प्रमाण:' : selectedLang === 'mr' ? 'प्रमुख तथ्य पुरावे:' : 'Key Factual Evidence:'}
          </h4>
          <div className="space-y-1.5">
            {displayEvidence.map((item, idx) => (
              <div 
                key={idx} 
                className={`p-2.5 rounded-xl border text-xs font-medium flex items-start gap-2.5 ${
                  isDark ? 'bg-slate-950/40 border-slate-800/60 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <span className="text-emerald-500 font-black">•</span>
                <span className="flex-1">{typeof item === 'string' ? item : item.point}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verified Sources */}
      {verdict.sources && verdict.sources.length > 0 && (
        <div>
          <h4 className={`text-[11px] font-black uppercase tracking-wider mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Official Registries:
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {verdict.sources.map((src, idx) => (
              <a
                key={idx}
                href={src.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold transition ${
                  isDark 
                    ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' 
                    : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100'
                }`}
              >
                <span>{src.name || src.source || 'Official Source'}</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
