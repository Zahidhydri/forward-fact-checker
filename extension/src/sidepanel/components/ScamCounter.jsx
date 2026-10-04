import React from 'react';
import { ShieldCheck, Radio, AlertOctagon, Zap, ChevronRight } from 'lucide-react';

export function ScamCounter({ onSelectQuickTest, isDark = true, accent = {} }) {
  const SAMPLE_CLAIMS = [
    {
      title: '⚡ Free 3-Month 5G Recharge Scam',
      query: 'Government is giving free 3-month 5G recharge to all Indian users on PM Modi birthday. Click here to claim: http://free-recharge-pm.xyz before midnight!',
      tag: 'Phishing'
    },
    {
      title: '⚠️ Electricity Bill Disconnection SMS',
      query: 'Dear consumer, your electricity connection will be disconnected tonight at 9:30 PM because your previous month bill was not updated. Please call officer at 9876543210.',
      tag: 'Scam'
    },
    {
      title: '📢 RBI 2000 Note Status Claim',
      query: 'RBI has announced that old 500 and 100 notes will be completely banned from next month and replaced with digital currency.',
      tag: 'Rumor'
    }
  ];

  return (
    <div className="space-y-3.5">
      {/* Tonal Stats Cards */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className={`p-3 rounded-2xl border text-center ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90 shadow-sm'
        }`}>
          <div className="flex items-center justify-center text-rose-500 mb-1">
            <AlertOctagon className="w-4 h-4" />
          </div>
          <span className={`text-base font-black block ${isDark ? 'text-white' : 'text-slate-950'}`}>14.8K+</span>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Scams Blocked</span>
        </div>

        <div className={`p-3 rounded-2xl border text-center ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90 shadow-sm'
        }`}>
          <div className="flex items-center justify-center text-emerald-500 mb-1">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <span className={`text-base font-black block ${isDark ? 'text-white' : 'text-slate-950'}`}>98.4%</span>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Accuracy Rate</span>
        </div>

        <div className={`p-3 rounded-2xl border text-center ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200/90 shadow-sm'
        }`}>
          <div className="flex items-center justify-center text-teal-500 mb-1">
            <Radio className="w-4 h-4" />
          </div>
          <span className={`text-base font-black block ${isDark ? 'text-white' : 'text-slate-950'}`}>PIB Sync</span>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Live Registry</span>
        </div>
      </div>

      {/* Quick Testing Card */}
      <div className={`compose-card p-4 border ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center justify-between mb-2.5">
          <span className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
            isDark ? 'text-slate-300' : 'text-slate-800'
          }`}>
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Try Viral Samples</span>
          </span>
          <span className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Click to test</span>
        </div>

        <div className="space-y-2">
          {SAMPLE_CLAIMS.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectQuickTest(sample.query)}
              className={`w-full text-left p-2.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                isDark 
                  ? 'bg-slate-950 border-slate-800 hover:bg-slate-800 hover:border-slate-700' 
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-bold truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  {sample.title}
                </p>
                <p className={`text-[10px] font-medium truncate mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {sample.query}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${
                  isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-800 border-slate-300'
                }`}>
                  {sample.tag}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
