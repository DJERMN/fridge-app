import { useState } from 'react';
import { Eye, EyeOff, Save, Key, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import type { AppSettings } from '../types';

interface Props {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

export default function SettingsTab({ settings, onSave }: Props) {
  const [apiKey, setApiKey] = useState(settings.geminiApiKey);
  const [language, setLanguage] = useState<'de' | 'en'>(settings.language ?? 'de');
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    onSave({ geminiApiKey: apiKey.trim(), language });
    toast.success('Einstellungen gespeichert!');
  };

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Einstellungen</h2>
        <p className="text-slate-400 text-sm">Konfiguriere deine App-Einstellungen</p>
      </div>

      {/* API Key */}
      <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
        <div className="flex items-center gap-2 text-emerald-400">
          <Key size={18} />
          <span className="font-semibold text-sm text-white">Gemini API Key</span>
        </div>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIza..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm pr-12 focus:outline-none focus:border-blue-500 transition"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
          >
            {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <p className="text-slate-500 text-xs">
          Der API Key wird ausschließlich lokal in deinem Browser gespeichert und nie an
          Dritte weitergegeben.
        </p>
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs transition"
        >
          <ExternalLink size={13} />
          Kostenlosen Gemini API Key holen
        </a>
      </div>

      {/* Language */}
      <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
        <span className="font-semibold text-sm text-white">Sprache / Language</span>
        <div className="flex gap-3">
          {(['de', 'en'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition ${
                language === lang
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              {lang === 'de' ? '🇩🇪 Deutsch' : '🇬🇧 English'}
            </button>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-2">
        <span className="font-semibold text-sm text-white">Über diese App</span>
        <p className="text-slate-400 text-xs leading-relaxed">
          📸 Mach ein Foto deines Kühlschranks, und die KI erkennt automatisch alle
          Lebensmittel. Verwalte deinen Kühlschrank-Inhalt und erstelle eine Einkaufsliste
          für fehlende Produkte.
        </p>
      </div>

      <button
        onClick={handleSave}
        className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition"
      >
        <Save size={18} />
        Speichern
      </button>
    </div>
  );
}
