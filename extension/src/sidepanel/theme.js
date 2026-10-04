export const ACCENT_THEMES = [
  { 
    id: 'blue', 
    name: 'Electric Blue', 
    primary: '#3b82f6',
    gradient: 'from-blue-600 via-indigo-600 to-cyan-500',
    bgClass: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20',
    tonalBgDark: 'bg-blue-950/80 border-blue-800/80 text-blue-300',
    tonalBgLight: 'bg-blue-50 border-blue-200 text-blue-900',
    textClass: 'text-blue-400',
    badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30'
  },
  { 
    id: 'emerald', 
    name: 'Emerald Mint', 
    primary: '#10b981',
    gradient: 'from-emerald-600 via-teal-600 to-cyan-500',
    bgClass: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-500/20',
    tonalBgDark: 'bg-emerald-950/80 border-emerald-800/80 text-emerald-300',
    tonalBgLight: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    textClass: 'text-emerald-400',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  },
  { 
    id: 'indigo', 
    name: 'Neon Violet', 
    primary: '#6366f1',
    gradient: 'from-indigo-600 via-purple-600 to-pink-500',
    bgClass: 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-500/20',
    tonalBgDark: 'bg-indigo-950/80 border-indigo-800/80 text-indigo-300',
    tonalBgLight: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    textClass: 'text-indigo-400',
    badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
  },
  { 
    id: 'amber', 
    name: 'Sunset Orange', 
    primary: '#f59e0b',
    gradient: 'from-amber-600 via-orange-600 to-rose-500',
    bgClass: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-md shadow-amber-500/20',
    tonalBgDark: 'bg-amber-950/80 border-amber-800/80 text-amber-300',
    tonalBgLight: 'bg-amber-50 border-amber-200 text-amber-900',
    textClass: 'text-amber-400',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
  },
  { 
    id: 'slate', 
    name: 'Steel Slate', 
    primary: '#64748b',
    gradient: 'from-slate-700 via-slate-800 to-slate-900',
    bgClass: 'bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white shadow-md',
    tonalBgDark: 'bg-slate-900 border-slate-700 text-slate-300',
    tonalBgLight: 'bg-slate-200 border-slate-300 text-slate-900',
    textClass: 'text-slate-400',
    badgeClass: 'bg-slate-700/40 text-slate-300 border-slate-600'
  },
];

export function getAccentStyles(accentId = 'blue') {
  return ACCENT_THEMES.find(t => t.id === accentId) || ACCENT_THEMES[0];
}
