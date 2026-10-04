export const ACCENT_THEMES = [
  { 
    id: 'blue', 
    name: 'Bold Blue', 
    primary: '#2563eb',
    bgClass: 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 font-black',
    tonalBgDark: 'bg-blue-950/90 border-blue-800/80 text-blue-200',
    tonalBgLight: 'bg-blue-50 border-blue-200 text-blue-950',
    textClass: 'text-blue-400',
    badgeClass: 'bg-blue-600/20 text-blue-300 border-blue-500/40'
  },
  { 
    id: 'emerald', 
    name: 'Bold Emerald', 
    primary: '#059669',
    bgClass: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 font-black',
    tonalBgDark: 'bg-emerald-950/90 border-emerald-800/80 text-emerald-200',
    tonalBgLight: 'bg-emerald-50 border-emerald-200 text-emerald-950',
    textClass: 'text-emerald-400',
    badgeClass: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
  },
  { 
    id: 'indigo', 
    name: 'Bold Violet', 
    primary: '#7c3aed',
    bgClass: 'bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-600/20 font-black',
    tonalBgDark: 'bg-violet-950/90 border-violet-800/80 text-violet-200',
    tonalBgLight: 'bg-violet-50 border-violet-200 text-violet-950',
    textClass: 'text-violet-400',
    badgeClass: 'bg-violet-600/20 text-violet-300 border-violet-500/40'
  },
  { 
    id: 'amber', 
    name: 'Bold Orange', 
    primary: '#ea580c',
    bgClass: 'bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-600/20 font-black',
    tonalBgDark: 'bg-orange-950/90 border-orange-800/80 text-orange-200',
    tonalBgLight: 'bg-orange-50 border-orange-200 text-orange-950',
    textClass: 'text-orange-400',
    badgeClass: 'bg-orange-600/20 text-orange-300 border-orange-500/40'
  },
  { 
    id: 'slate', 
    name: 'Bold Slate', 
    primary: '#475569',
    bgClass: 'bg-slate-700 hover:bg-slate-800 text-white shadow-md font-black',
    tonalBgDark: 'bg-slate-900 border-slate-700 text-slate-200',
    tonalBgLight: 'bg-slate-200 border-slate-300 text-slate-950',
    textClass: 'text-slate-300',
    badgeClass: 'bg-slate-700/40 text-slate-200 border-slate-600'
  },
];

export function getAccentStyles(accentId = 'blue') {
  return ACCENT_THEMES.find(t => t.id === accentId) || ACCENT_THEMES[0];
}
