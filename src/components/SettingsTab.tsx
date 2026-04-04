import { useState } from 'react';
import { Eye, EyeOff, Save, Key, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import type { AppSettings } from '../types';

interface Props {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

export default function SettingsTab({ settings, onSave }: Props) {
  const [apiKey, setApiKey] = useState(settings.openRouterApiKey);
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    onSave({ ...settings, openRouterApiKey: apiKey.trim() });
    toast.success('Settings saved!');
  };

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Settings</h2>
        <p className="text-slate-400 text-sm">Configure your app</p>
      </div>

      <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
        <div className="flex items-center gap-2">
          <Key size={18} className="text-emerald-400" />
          <span className="font-semibold text-sm text-white">OpenRouter API Key</span>
          <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">Free</span>
        </div>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-or-v1-..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm pr-12 focus:outline-none focus:border-blue-500 transition"
          />
          <button type="button" onClick={() => setShowKey((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition">
            {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <p className="text-slate-500 text-xs">No credit card needed. Stored locally in your browser only.</p>
        <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs transition">
          <ExternalLink size={13} />
          Get your free key → openrouter.ai/keys
        </a>
      </div>

      <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-2">
        <span className="font-semibold text-sm text-white">AI Model</span>
        <p className="text-slate-400 text-xs">Llama 4 Scout (Meta) via OpenRouter — free, vision-capable</p>
      </div>

      <button onClick={handleSave}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition">
        <Save size={18} /> Save
      </button>
    </div>
  );
}
