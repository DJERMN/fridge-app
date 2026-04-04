import { useRef, useState } from 'react';
import { Camera, Upload, Loader2, Plus, X, Minus, ScanLine } from 'lucide-react';
import toast from 'react-hot-toast';
import type { StockItem } from '../types';
import { analyzeImage } from '../services/gemini';

interface Props {
  items: StockItem[];
  apiKey: string;
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

type Mode = 'soll' | 'ist';

export default function StockTab({ items, apiKey, onItemsChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>('soll');
  const [preview, setPreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newUnit, setNewUnit] = useState('pcs');

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
        toast('No items detected. Try a clearer photo.', { icon: '\u{1F4F7}' });
      } else {
        const updated = [...items];
        let newCount = 0;
        for (const d of detected) {
          const idx = updated.findIndex((i) => i.name.toLowerCase() === d.name.toLowerCase());
          if (idx >= 0) {
            if (mode === 'soll') updated[idx] = { ...updated[idx], targetQty: d.quantity, unit: d.unit };
            else updated[idx] = { ...updated[idx], currentQty: d.quantity, unit: d.unit };
          } else {
            newCount++;
            updated.push({
              id: crypto.randomUUID(),
              name: d.name,
              unit: d.unit,
              targetQty: mode === 'soll' ? d.quantity : 0,
              currentQty: mode === 'ist' ? d.quantity : 0,
              addedAt: Date.now(),
            });
          }
        }
        onItemsChange(updated);
        toast.success(`${detected.length} item(s) detected${newCount > 0 ? `, ${newCount} new` : ''}`);
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

  const adjustQty = (id: string, delta: number) => {
    onItemsChange(items.map((item) => {
      if (item.id !== id) return item;
      if (mode === 'soll') return { ...item, targetQty: Math.max(0, item.targetQty + delta) };
      return { ...item, currentQty: Math.max(0, item.currentQty + delta) };
    }));
  };

  const removeItem = (id: string) => onItemsChange(items.filter((i) => i.id !== id));

  const addManual = () => {
    if (!newName.trim()) return toast.error('Please enter a name.');
    const qty = parseInt(newQty, 10) || 1;
    onItemsChange([...items, {
      id: crypto.randomUUID(),
      name: newName.trim(),
      unit: newUnit.trim() || 'pcs',
      targetQty: mode === 'soll' ? qty : 0,
      currentQty: mode === 'ist' ? qty : 0,
      addedAt: Date.now(),
    }]);
    setNewName(''); setNewQty('1'); setShowAddForm(false);
    toast.success(`"${newName.trim()}" added!`);
  };

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      {/* SOLL / IST toggle */}
      <div className="flex bg-slate-800 rounded-xl p-1 border border-slate-700">
        <button
          onClick={() => setMode('soll')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${mode === 'soll' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-300'}`}
        >
          SOLL
        </button>
        <button
          onClick={() => setMode('ist')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${mode === 'ist' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-300'}`}
        >
          IST
        </button>
      </div>
      <p className="text-slate-500 text-xs px-1">
        {mode === 'soll' ? 'Define what should always be in your fridge.' : 'Scan or set your current fridge contents.'}
      </p>

      {/* Scan section */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        {preview ? (
          <div>
            <div className="relative">
              <img src={preview} alt="Preview" className="w-full max-h-52 object-cover" />
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
              className={`w-full py-3 ${mode === 'soll' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-blue-600 hover:bg-blue-500'} disabled:opacity-60 text-white font-semibold flex items-center justify-center gap-2 transition`}
            >
              {loading
                ? <><Loader2 size={18} className="animate-spin" /> Analyzing...</>
                : <><ScanLine size={18} /> Scan as {mode.toUpperCase()}</>}
            </button>
          </div>
        ) : (
          <div className="p-5 flex gap-3">
            <button
              onClick={() => { fileInputRef.current?.removeAttribute('capture'); fileInputRef.current?.click(); }}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition border border-slate-600"
            >
              <Upload size={15} /> Upload
            </button>
            <button
              onClick={() => { fileInputRef.current?.setAttribute('capture', 'environment'); fileInputRef.current?.click(); }}
              className={`flex-1 ${mode === 'soll' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-blue-600 hover:bg-blue-500'} text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition`}
            >
              <Camera size={15} /> Scan {mode.toUpperCase()}
            </button>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-base">
          {mode === 'soll' ? 'Target Stock (SOLL)' : 'Current Stock (IST)'}
          {items.length > 0 && <span className="text-slate-500 font-normal text-sm ml-2">({items.length})</span>}
        </h2>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition font-medium"
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Manual add form */}
      {showAddForm && (
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Product name..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition" />
          <div className="flex gap-2">
            <input value={newQty} onChange={(e) => setNewQty(e.target.value)} placeholder="Qty" type="number" min="0"
              className="w-20 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition" />
            <input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="Unit (pcs, bottles...)"
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowAddForm(false); setNewName(''); setNewQty('1'); }}
              className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-400 text-sm font-medium hover:border-slate-500 transition">Cancel</button>
            <button onClick={addManual}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition">Add</button>
          </div>
        </div>
      )}

      {/* Items grid */}
      {items.length === 0 ? (
        <div className="text-center py-14 space-y-2">
          <div className="text-5xl">{'\u{1F9CA}'}</div>
          <p className="text-slate-400 text-sm">No items yet.</p>
          <p className="text-slate-500 text-xs">Scan a photo or add manually.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => {
            const qty = mode === 'soll' ? item.targetQty : item.currentQty;
            const deficit = item.targetQty - item.currentQty;
            return (
              <div key={item.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-3 flex flex-col gap-2 relative">
                <button onClick={() => removeItem(item.id)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400 transition">
                  <X size={13} />
                </button>
                <span className="text-2xl">{getFoodEmoji(item.name)}</span>
                <p className="text-white font-semibold text-sm leading-tight pr-4">{item.name}</p>
                {/* qty controls */}
                <div className="flex items-center gap-1 mt-auto">
                  <button
                    onClick={() => adjustQty(item.id, -1)}
                    className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition flex-shrink-0"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="flex-1 text-center text-white font-bold text-base">{qty}</span>
                  <button
                    onClick={() => adjustQty(item.id, 1)}
                    className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition flex-shrink-0"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <p className="text-slate-500 text-xs text-center -mt-1">{item.unit}</p>
                {/* deficit badge - only in IST mode */}
                {mode === 'ist' && item.targetQty > 0 && deficit > 0 && (
                  <span className="text-xs font-bold text-center px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                    -{deficit} needed
                  </span>
                )}
                {mode === 'ist' && item.targetQty > 0 && deficit <= 0 && (
                  <span className="text-xs font-bold text-center px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    OK
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}