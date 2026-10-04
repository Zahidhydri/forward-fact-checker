import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Loader2, 
  CircleDot, 
  Search, 
  ShieldCheck, 
  BrainCircuit, 
  FileText, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react';

export function AgentSteps({ steps = [], loading = false, currentStage = '', isDark = true, accent = {} }) {
  const [expandedSteps, setExpandedSteps] = useState({});

  const toggleExpand = (index) => {
    setExpandedSteps(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  if (!steps || (steps.length === 0 && !loading)) {
    return null;
  }

  const completedCount = steps.filter(s => s.status === 'done').length;
  const totalCount = Math.max(steps.length, loading ? 5 : 1);
  const progressPercent = Math.min(100, Math.round((completedCount / totalCount) * 100));

  return (
    <div className={`compose-card p-4.5 mb-4 border transition-all ${
      isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90 shadow-sm'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl flex items-center justify-center ${
            isDark ? accent.tonalBgDark || 'bg-slate-800' : accent.tonalBgLight || 'bg-slate-100'
          }`}>
            <BrainCircuit className="w-5 h-5" style={{ color: accent.primary }} />
          </div>
          <div>
            <h2 className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              Reasoning Timeline
            </h2>
            <p className={`text-[11px] font-medium mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {loading ? (currentStage || 'Multi-agent verification stream...') : 'Verification Complete'}
            </p>
          </div>
        </div>

        <span className={`text-xs font-extrabold px-3 py-1 rounded-full border ${
          isDark ? accent.tonalBgDark : accent.tonalBgLight
        }`}>
          {progressPercent}%
        </span>
      </div>

      {/* Jetpack Compose Linear Progress Bar */}
      <div className={`w-full rounded-full h-2 mb-4 overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
        <div 
          className="h-full transition-all duration-300 rounded-full"
          style={{ width: `${progressPercent}%`, backgroundColor: accent.primary || '#10b981' }}
        />
      </div>

      {/* Jetpack Compose Timeline Items */}
      <div className="space-y-2.5">
        {steps.map((stepItem, idx) => {
          const isDone = stepItem.status === 'done';
          const isRunning = stepItem.status === 'running' || stepItem.status === 'in_progress';
          const isFailed = stepItem.status === 'failed' || stepItem.status === 'error';
          const isExpanded = !!expandedSteps[idx];
          const hasDetails = stepItem.details || (stepItem.sources && stepItem.sources.length > 0) || stepItem.claim;

          return (
            <div 
              key={idx}
              className={`rounded-2xl border transition-all ${
                isDark 
                  ? isRunning ? 'bg-slate-800/90 border-slate-700' : isDone ? 'bg-slate-900/60 border-slate-800/80' : 'bg-slate-950/40 border-slate-800/40'
                  : isRunning ? 'bg-slate-100 border-slate-300' : isDone ? 'bg-slate-50 border-slate-200/80' : 'bg-slate-50/50 border-slate-100'
              }`}
            >
              <div 
                className={`p-3 flex items-start justify-between gap-3 ${hasDetails ? 'cursor-pointer' : ''}`}
                onClick={() => hasDetails && toggleExpand(idx)}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-0.5 flex-shrink-0">
                    {isDone ? (
                      <CheckCircle2 className="w-4.5 h-4.5" style={{ color: accent.primary || '#10b981' }} />
                    ) : isRunning ? (
                      <Loader2 className="w-4.5 h-4.5 animate-spin" style={{ color: accent.primary || '#10b981' }} />
                    ) : isFailed ? (
                      <div className="w-4.5 h-4.5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-black">✕</div>
                    ) : (
                      <CircleDot className={`w-4.5 h-4.5 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold leading-tight ${
                        isDark 
                          ? isRunning ? 'text-slate-100' : isDone ? 'text-slate-200' : 'text-slate-400'
                          : isRunning ? 'text-slate-900' : isDone ? 'text-slate-800' : 'text-slate-500'
                      }`}>
                        {stepItem.label || stepItem.title || stepItem.step}
                      </span>
                      {stepItem.duration && (
                        <span className={`text-[10px] font-mono font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {stepItem.duration}s
                        </span>
                      )}
                    </div>

                    {stepItem.summary && (
                      <p className={`text-[11px] font-medium mt-0.5 line-clamp-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {stepItem.summary}
                      </p>
                    )}
                  </div>
                </div>

                {hasDetails && (
                  <button 
                    type="button"
                    className={`p-1.5 rounded-full ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-200'}`}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                )}
              </div>

              {/* Expandable Accordion Surface */}
              {hasDetails && isExpanded && (
                <div className={`px-3.5 pb-3.5 pt-2 border-t text-[11px] space-y-2.5 rounded-b-2xl ${
                  isDark ? 'border-slate-800/80 bg-slate-950/80 text-slate-300' : 'border-slate-200/80 bg-slate-100/70 text-slate-800'
                }`}>
                  {stepItem.claim && (
                    <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                      <span className={`text-[10px] font-black uppercase tracking-wider block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Extracted Claim:</span>
                      <p className="italic font-medium mt-0.5">"{stepItem.claim}"</p>
                    </div>
                  )}

                  {stepItem.details && (
                    <p className="leading-relaxed font-medium whitespace-pre-wrap">{stepItem.details}</p>
                  )}

                  {stepItem.sources && stepItem.sources.length > 0 && (
                    <div>
                      <span className={`text-[10px] font-black uppercase tracking-wider block mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Sources Consulted:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {stepItem.sources.map((src, sIdx) => (
                          <a 
                            key={sIdx}
                            href={src.url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition ${
                              isDark ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-100'
                            }`}
                          >
                            <span>{src.name || 'Source'}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
