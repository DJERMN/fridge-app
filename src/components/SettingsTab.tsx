import { useRef, useState } from 'react';
import { Eye, EyeOff, Save, Key, ExternalLink, Camera, Upload, Loader2, Plus, X, Minus, ScanLine } from 'lucide-react';
import toast from 'react-hot-toast';
import type { AppSettings, StockItem } from '../types';
import { analyzeImage, normalizeItems } from '../services/gemini';
import { compressImage } from '../utils/compressImage';

interface Props {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  items: StockItem[];
  onItemsChange: (items: StockItem[]) => void;
}

function getFoodEmoji(name: string): string {
  const n = name.toLowerCase();
  if (/milk|yogurt|cream|kefir|dairy/.test(n)) return '\u{1F95B}';
  if (/cheese|gouda|cheddar|mozzarella|brie/.test(n)) return '\u{1F9C0}';
  if (/butter|margarine/.test(n)) return '\u{1F9C8}';
  if (/egg|eggs/.test(n)) return '\u{1F95A}';
  if (/meat|beef|pork|chicken|turkey|salmon|fish|tuna|ham|sausage|steak/.test(n)) return '\u{1F969}';
  if (/vegetable|carrot|pepper|cucumber|tomato|lettuce|spinach|broccoli|zucchini|onion/.test(n)) return '\u{1F96C}';
  if (/apple|pear|orange|lemon|berry|grape|strawberry|cherry|mango|pineapple|fruit/.test(n)) return '\u{1F34E}';
  if (/juice|cola|beer|wine|soda|water|drink|bottle/.test(n)) return '\u{1F9C3}';
  if (/ketchup|mustard|mayo|sauce|dressing|jam|honey|condiment/.test(n)) return '\u{1FAD9}';
  if (/bread|roll|toast/.test(n)) return '\u{1F35E}';
  if (/pizza|pasta|noodle|leftover/.test(n)) return '\u{1F355}';
  if (/can|canned|tin/.test(n)) return '\u{1F96B}';
  if (/chocolate|pudding|dessert|cake/.test(n)) return '\u{1F36B}';
  if (/tofu|tempeh/.test(n)) return '\u{1FAD8}';
  return '\u{1F371}';
}

export default function SettingsTab({ settings, onSave, items, onItemsChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [apiKey, setApiKey] = useState(settings.openRouterApiKey);
  const [showKey, setShowKey] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newUnit, setNewUnit] = useState('pcs');

  const handleSave = () => {
    onSave({ ...settings, openRouterApiKey: apiKey.trim() });
    toast.success('Settings saved!');
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { base64, mimeType: mt, originalKB, compressedKB } = await compressImage(file);
      setMimeType(mt);
      setImageBase64(base64);
      setPreview(`data:${mt};base64,${base64}`);
      if (originalKB > compressedKB)
        toast(`Image compressed: ${originalKB}KB \u2192 ${compressedKB}KB`, { icon: '\u{1F5DC}' });
    } catch {
      toast.error('Failed to load image.');
    }
  };

  const handleScan = async () => {
    if (!imageBase64) return toast.error('No image selected.');
    if (!apiKey.trim()) return toast.error('Please enter your API key first and save.');
    setLoading(true);
    try {
      const detected = await analyzeImage(imageBase64, mimeType, apiKey.trim());
      if (detected.length === 0) {
        toast('No items detected. Try a clearer photo.', { icon: '\u{1F4F7}' });
      } else {
        // Normalize against existing names to prevent duplicates
        const existingNames = items.map((i) => i.name);
        const normalized = await normalizeItems(existingNames, detected, apiKey.trim());

        const updated = [...items];
        let newCount = 0;
        for (const d of normalized) {
          const idx = updated.findIndex((i) => i.name.toLowerCase() === d.name.toLowerCase());
          if (idx >= 0) {
            updated[idx] = { ...updated[idx], targetQty: d.quantity, unit: d.unit };
          } else {
            newCount++;
            updated.push({
              id: crypto.randomUUID(),
              name: d.name,
              unit: d.unit,
              targetQty: d.quantity,
              currentQty: 0,
              addedAt: Date.now(),
            });
          }
        }
        onItemsChange(updated);
        toast.success(`${normalized.length} target items set${newCount > 0 ? ` (${newCount} new)` : ''}`);
      }
      setPreview(null);
      setImageBase64(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const adjustTarget = (id: string, delta: number) =>
    onItemsChange(items.map((item) =>
      item.id === id ? { ...item, targetQty: Math.max(0, item.targetQty + delta) } : item
    ));

  const removeItem = (id: string) => onItemsChange(items.filter((i) => i.id !== id));

  const addManual = () => {
    if (!newName.trim()) return toast.error('Please enter a name.');
    const qty = parseInt(newQty, 10) || 1;
    const existing = items.findIndex((i) => i.name.toLowerCase() === newName.trim().toLowerCase());
    if (existing >= 0) {
      onItemsChange(items.map((item, idx) =>
        idx === existing ? { ...item, targetQty: qty, unit: newUnit.trim() || 'pcs' } : item
      ));
      toast.success(`"${newName.trim()}" updated!`);
    } else {
      onItemsChange([...items, {
        id: crypto.randomUUID(),
        name: newName.trim(),
        unit: newUnit.trim() || 'pcs',
        targetQty: qty,
        currentQty: 0,
        addedAt: Date.now(),
      }]);
      toast.success(`"${newName.trim()}" added to target stock!`);
    }
    setNewName(''); setNewQty('1'); setShowAddForm(false);
  };

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto">

      {/* API Key */}
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Settings</h2>
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
        <p className="text-slate-500 text-xs">Stored locally in your browser only.</p>
        <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs transition">
          <ExternalLink size={13} /> Get your free key at openrouter.ai/keys
        </a>
        <button onClick={handleSave}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition text-sm">
          <Save size={16} /> Save API Key
        </button>
      </div>

      {/* SOLL - Target Stock Definition */}
      <div className="space-y-3">
        <div>
          <h3 className="text-white font-bold text-base">Target Stock (SOLL)</h3>
          <p className="text-slate-500 text-xs mt-0.5">Define what should always be in your fridge. Scan a photo of your ideal stock.</p>
        </div>

        {/* SOLL scan */}
        <div className="bg-slate-800 rounded-2xl border border-purple-500/30 overflow-hidden">
          {preview ? (
            <div>
              <div className="relative">
                <img src={preview} alt="SOLL preview" className="w-full max-h-44 object-cover" />
                <button onClick={() => { setPreview(null); setImageBase64(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="absolute top-2 right-2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full p-1.5 transition">
                  <X size={16} />
                </button>
              </div>
              <button onClick={handleScan} disabled={loading}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-semibold flex items-center justify-center gap-2 transition text-sm">
                {loading
                  ? <><Loader2 size={16} className="animate-spin" /> Scanning...</>
                  : <><ScanLine size={16} /> Set as SOLL Stock</>}
              </button>
            </div>
          ) : (
            <div className="p-4 flex gap-3">
              <button
                onClick={() => { fileInputRef.current?.removeAttribute('capture'); fileInputRef.current?.click(); }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition border border-slate-600"
              >
                <Upload size={14} /> Upload
              </button>
              <button
                onClick={() => { fileInputRef.current?.setAttribute('capture', 'environment'); fileInputRef.current?.click(); }}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition"
              >
                <Camera size={14} /> Scan SOLL
              </button>
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        {/* Target items list */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-sm">
            {items.length === 0 ? 'No target items defined yet.' : `${items.length} item${items.length !== 1 ? 's' : ''} defined`}
          </span>
          <button onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition font-medium">
            <Plus size={15} /> Add
          </button>
        </div>

        {showAddForm && (
          <div className="bg-slate-800 rounded-2xl p-4 border border-purple-500/30 space-y-3">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Product name..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500 transition" />
            <div className="flex gap-2">
              <input value={newQty} onChange={(e) => setNewQty(e.target.value)} placeholder="Qty" type="number" min="1"
                className="w-20 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500 transition" />
              <input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="Unit (pcs, bottles...)"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500 transition" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowAddForm(false); setNewName(''); setNewQty('1'); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-400 text-sm font-medium hover:border-slate-500 transition">Cancel</button>
              <button onClick={addManual}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition">Add</button>
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 flex items-center gap-3">
                <span className="text-xl flex-shrink-0">{getFoodEmoji(item.name)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{item.name}</p>
                  <p className="text-slate-500 text-xs">{item.unit}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => adjustTarget(item.id, -1)}
                    className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition">
                    <Minus size={12} />
                  </button>
                  <span className="w-7 text-center text-white font-bold text-sm">{item.targetQty}</span>
                  <button onClick={() => adjustTarget(item.id, 1)}
                    className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition">
                    <Plus size={12} />
                  </button>
                </div>
                <button onClick={() => removeItem(item.id)} className="text-slate-600 hover:text-red-400 transition ml-1">
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}