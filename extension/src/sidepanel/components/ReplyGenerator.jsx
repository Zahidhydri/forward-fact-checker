import React, { useState } from 'react';
import { 
  Copy, 
  Check, 
  MessageSquare, 
  Edit3
} from 'lucide-react';

const LANGUAGES = [
  { id: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { id: 'en', label: 'English', flag: '🌐' },
  { id: 'mr', label: 'मराठी', flag: '🚩' },
  { id: 'hinglish', label: 'Hinglish', flag: '💬' },
];

export function ReplyGenerator({ card = {}, verdict = {}, isDark = true, accent = {} }) {
  const [selectedLang, setSelectedLang] = useState('hi');
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [customReplies, setCustomReplies] = useState({});

  if (!card && !verdict) return null;

  const defaultReplies = {
    hi: card?.hi || (
      `⚠️ *सावधान! यह दावा गलत/फेक है* ⚠️\n\n` +
      `इस मैसेज की AI फैक्ट-चेक द्वारा जांच की गई है।\n` +
      `📌 *सच्चाई:* ${verdict?.explanation || 'यह दावा भ्रामक है और किसी भी आधिकारिक संस्था द्वारा जारी नहीं किया गया है।'}\n\n` +
      `🛡️ कृपया इसे बिना पुष्टि किए किसी भी ग्रुप में फॉरवर्ड न करें।\n` +
      `_फैक्ट-चेक द्वारा सत्यापित - Forward Fact-Checker Agent_`
    ),
    en: card?.en || (
      `⚠️ *WARNING: This message is FAKE/MISLEADING* ⚠️\n\n` +
      `This forward was verified using the AI Fact-Checking Agent.\n` +
      `📌 *Fact:* ${verdict?.explanation || 'This claim is unsubstantiated and debunked by official sources.'}\n\n` +
      `🛡️ Please do not forward this to other groups without verification.\n` +
      `_Verified via Forward Fact-Checker Agent_`
    ),
    mr: card?.mr || (
      `⚠️ *सावधान! हा दावा खोटा/दिशाभूल करणारा आहे* ⚠️\n\n` +
      `या संदेशाची AI फॅक्ट-चेकर द्वारे पडताळणी करण्यात आली आहे.\n` +
      `📌 *वस्तुस्थिती:* ${verdict?.explanation || 'हा दावा दिशाभूल करणारा असून अधिकृत सूत्रांनी याला दुजोरा दिलेला नाही.'}\n\n` +
      `🛡️ कृपया हा मेसेज पुढे फॉरवर्ड करू नका.\n` +
      `_फॅक्ट-चेक द्वारे सत्यापित - Forward Fact-Checker Agent_`
    ),
    hinglish: card?.hinglish || (
      `⚠️ *Caution! Yeh Forward Fake/Misleading Hai* ⚠️\n\n` +
      `Is message ko AI Fact-Checker ne verify kiya hai.\n` +
      `📌 *Sach:* ${verdict?.explanation || 'Yeh claim fabricated hai aur official sources ne ise debunk kiya hai.'}\n\n` +
      `🛡️ Please ise bina verify kiye aage forward mat kijiye.\n` +
      `_Verified via Forward Fact-Checker Agent_`
    )
  };

  const activeText = customReplies[selectedLang] !== undefined 
    ? customReplies[selectedLang] 
    : defaultReplies[selectedLang] || defaultReplies.en;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleTextChange = (e) => {
    setCustomReplies(prev => ({
      ...prev,
      [selectedLang]: e.target.value
    }));
  };

  return (
    <div className={`compose-card p-4.5 mb-4 border ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl flex items-center justify-center ${
            isDark ? accent.tonalBgDark || 'bg-slate-800' : accent.tonalBgLight || 'bg-slate-100'
          }`}>
            <MessageSquare className="w-5 h-5" style={{ color: accent.primary }} />
          </div>
          <div>
            <h3 className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              WhatsApp Debunk Reply
            </h3>
            <p className={`text-[11px] font-medium mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Multi-lingual chat responses
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsEditing(!isEditing)}
          className={`px-3 py-1 rounded-full text-[11px] font-extrabold transition border flex items-center gap-1.5 ${
            isEditing 
              ? 'bg-emerald-600 text-white border-emerald-600' 
              : isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
          }`}
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>{isEditing ? 'Done' : 'Edit'}</span>
        </button>
      </div>

      {/* Material 3 Segmented Pills */}
      <div className={`flex items-center gap-1 p-1 rounded-full border mb-3.5 ${
        isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
      }`}>
        {LANGUAGES.map((lang) => {
          const isSelected = selectedLang === lang.id;
          return (
            <button
              key={lang.id}
              type="button"
              onClick={() => setSelectedLang(lang.id)}
              className={`flex-1 py-1.5 px-1.5 rounded-full text-xs font-bold transition flex items-center justify-center gap-1 ${
                isSelected
                  ? `${accent.bgClass || 'bg-blue-600 text-white'} shadow-sm font-black`
                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="text-[11px]">{lang.flag}</span>
              <span className="text-[11px] font-black">{lang.label}</span>
            </button>
          );
        })}
      </div>

      {/* Text Box Surface */}
      <div className={`p-3.5 rounded-2xl border mb-3.5 ${
        isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>
        {isEditing ? (
          <textarea
            value={activeText}
            onChange={handleTextChange}
            rows={5}
            className={`w-full text-xs font-medium p-2.5 rounded-xl border focus:outline-none resize-none font-sans ${
              isDark ? 'bg-slate-900 text-slate-200 border-slate-700 focus:border-emerald-500' : 'bg-white text-slate-800 border-slate-300 focus:border-emerald-600'
            }`}
          />
        ) : (
          <div className={`text-xs font-medium whitespace-pre-wrap leading-relaxed select-text ${
            isDark ? 'text-slate-200' : 'text-slate-800'
          }`}>
            {activeText}
          </div>
        )}
      </div>

      {/* Action Button */}
      <button
        type="button"
        onClick={handleCopy}
        className={`w-full py-3 px-4 rounded-full text-xs font-black transition flex items-center justify-center gap-2 shadow-sm ${
          copied
            ? 'bg-emerald-700 text-white'
            : accent.bgClass || 'bg-emerald-600 hover:bg-emerald-700 text-white'
        }`}
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" />
            <span>Copied to Clipboard!</span>
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            <span>Copy Reply for WhatsApp</span>
          </>
        )}
      </button>
    </div>
  );
}
