import { useRef, useState } from 'react';
import { Camera, Upload, Loader2, Plus, X, Trash2, ScanLine } from 'lucide-react';
import toast from 'react-hot-toast';
import type { FridgeItem, ItemStatus } from '../types';
import { analyzeImage } from '../services/gemini';

interface Props {
  items: FridgeItem[];
  apiKey: string;
  onItemsChange: (items: FridgeItem[]) => void;
}

function getFoodEmoji(name: string): string {
  const n = name.toLowerCase();
  if (/milk|yogurt|cream|kefir|dairy/.test(n)) return 'ðŸ¥›';
  if (/cheese|gouda|cheddar|mozzarella|brie/.test(n)) return 'ðŸ§€';
  if (/butter|margarine/.test(n)) return 'ðŸ§ˆ';
  if (/egg|eggs/.test(n)) return 'ðŸ¥š';
  if (/meat|beef|pork|chicken|turkey|salmon|fish|tuna|ham|sausage|steak/.test(n)) return 'ðŸ¥©';
  if (/vegetable|carrot|pepper|cucumber|tomato|lettuce|spinach|broccoli|zucchini|onion/.test(n)) return 'ðŸ¥¬';
  if (/apple|pear|orange|lemon|berry|grape|strawberry|cherry|mango|pineapple|fruit/.test(n)) return 'ðŸŽ';
  if (/juice|cola|beer|wine|soda|water|drink|bottle/.test(n)) return 'ðŸ§ƒ';
  if (/ketchup|mustard|mayo|sauce|dressing|jam|honey|condiment/.test(n)) return 'ðŸ«™';
  if (/bread|roll|toast/.test(n)) return 'ðŸž';
  if (/pizza|pasta|noodle|leftover/.test(n)) return 'ðŸ•';
  if (/can|canned|tin/.test(n)) return 'ðŸ¥«';
  if (/chocolate|pudding|dessert|cake/.test(n)) return 'ðŸ«';
  if (/tofu|tempeh/.test(n)) return 'ðŸ«˜';
  return 'ðŸ±';
}

const STATUS_CYCLE: Record<ItemStatus, ItemStatus> = { ok: 'low', low: 'empty', empty: 'ok' };
const STATUS_LABEL: Record<ItemStatus, string> = { ok: 'Good', low: 'Low', empty: 'Empty' };
const STATUS_CLASS: Record<ItemStatus, string> = {
  ok: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  low: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  empty: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default function FridgeTab({ items, apiKey, onItemsChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMimeType(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setPreview(result);
      setImageBase64(result.split(',')[1]);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!imageBase64) return toast.error('No image selected.');
    if (!apiKey) return toast.error('Please add an OpenRouter API key in Settings first.');
    setLoading(true);
    try {
      const detected = await analyzeImage(imageBase64, mimeType, apiKey);
      if (detected.length === 0) {
        toast('No food items detected. Try a clearer photo.', { icon: 'ðŸ"' });
      } else {
        const existingNames = new Set(items.map((i) => i.name.toLowerCase()));
        const fresh = detected.filter((d) => !existingNames.has(d.name.toLowerCase()));
        onItemsChange([...items, ...fresh]);
        toast.success(`${detected.length} item(s) detected, ${fresh.length} new added!`);
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

  const cycleStatus = (id: string) =>
    onItemsChange(items.map((item) => item.id === id ? { ...item, status: STATUS_CYCLE[item.status] } : item));

  const deleteItem = (id: string) =>
    onItemsChange(items.filter((item) => item.id !== id));

  const addManual = () => {
    if (!newName.trim()) return toast.error('Please enter a name.');
    onItemsChange([...items, {
      id: crypto.randomUUID(),
      name: newName.trim(),
      quantity: newQty.trim() || '—',
      status: 'ok',
      addedAt: Date.now(),
    }]);
    setNewName(''); setNewQty(''); setShowAddForm(false);
    toast.success(`"${newName.trim()}" added!`);
  };

  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto">
      {/* Camera section */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        {preview ? (
          <div>
            <div className="relative">
              <img src={preview} alt="Preview" className="w-full max-h-56 object-cover" />
              <button
                onClick={() => { setPreview(null); setImageBase64(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="absolute top-2 right-2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full p-1.5 transition"
              >
                <X size={16} />
              </button>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-60 text-white font-semibold flex items-center justify-center gap-2 transition"
            >
              {loading
                ? <><Loader2 size={18} className="animate-spin" /> Analyzing…</>
                : <><ScanLine size={18} /> Analyze</>}
            </button>
          </div>
        ) : (
          <div className="p-6 text-center space-y-4">
            <div className="text-5xl">ðŸ"¸</div>
            <p className="text-slate-400 text-sm">Take a photo of your fridge or upload an image</p>
            <div className="flex gap-3">
              <button
                onClick={() => { fileInputRef.current?.removeAttribute('capture'); fileInputRef.current?.click(); }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition border border-slate-600"
              >
                <Upload size={16} /> Upload
              </button>
              <button
                onClick={() => { fileInputRef.current?.setAttribute('capture', 'environment'); fileInputRef.current?.click(); }}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition"
              >
                <Camera size={16} /> Camera
              </button>
            </div>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">
          Fridge{items.length > 0 && <span className="text-slate-500 font-normal text-base ml-2">({items.length})</span>}
        </h2>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition font-medium"
        >
          <Plus size={16} /> Add manually
        </button>
      </div>

      {/* Manual add form */}
      {showAddForm && (
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Product name…"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition" />
          <input value={newQty} onChange={(e) => setNewQty(e.target.value)} placeholder="Quantity (e.g. 2 bottles)"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition" />
          <div className="flex gap-2">
            <button onClick={() => { setShowAddForm(false); setNewName(''); setNewQty(''); }}
              className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-400 text-sm font-medium hover:border-slate-500 transition">Cancel</button>
            <button onClick={addManual}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition">Add</button>
          </div>
        </div>
      )}

      {/* Inventory */}
      {items.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="text-6xl">ðŸ§Š</div>
          <p className="text-slate-400 text-sm">Your fridge is empty.</p>
          <p className="text-slate-500 text-xs">Take a photo to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-3 flex flex-col gap-2 relative">
              <button onClick={() => deleteItem(item.id)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400 transition">
                <Trash2 size={14} />
              </button>
              <span className="text-2xl">{getFoodEmoji(item.name)}</span>
              <div>
                <p className="text-white font-semibold text-sm leading-tight pr-4">{item.name}</p>
                <p className="text-slate-500 text-xs mt-0.5 leading-snug">{item.quantity}</p>
              </div>
              <button
                onClick={() => cycleStatus(item.id)}
                className={`self-start mt-auto text-xs font-semibold px-2.5 py-1 rounded-full border transition cursor-pointer ${STATUS_CLASS[item.status]}`}
              >
                {STATUS_LABEL[item.status]}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
