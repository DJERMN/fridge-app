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

export default function StockTab({ items, apiKey, onItemsChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [loading, setLoading] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleScan = async () => {
    if (!imageBase64) return toast.error('No image selected.');
    if (!apiKey) return toast.error('Please add your OpenRouter API key in Settings first.');
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
            updated[idx] = { ...updated[idx], currentQty: d.quantity, unit: d.unit };
          } else {
            newCount++;
            updated.push({
              id: crypto.randomUUID(),
              name: d.name,
              unit: d.unit,
              targetQty: 0,
              currentQty: d.quantity,
              addedAt: Date.now(),
            });
          }
        }
        onItemsChange(updated);
        toast.success(`${detected.length} item(s) scanned${newCount > 0 ? `, ${newCount} new` : ''}`);
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

  const adjustCurrent = (id: string, delta: number) =>
    onItemsChange(items.map((item) =>
      item.id === id ? { ...item, currentQty: Math.max(0, item.currentQty + delta) } : item
    ));

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">

      {/* IST scan */}
      <div className="bg-slate-800 rounded-2xl border border-blue-500/30 overflow-hidden">
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
            <button onClick={handleScan} disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold flex items-center justify-center gap-2 transition">
              {loading
                ? <><Loader2 size={18} className="animate-spin" /> Scanning...</>
                : <><ScanLine size={18} /> Scan current fridge (IST)</>}
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <p className="text-blue-300 text-xs font-semibold tracking-wider">CURRENT STATE (IST)</p>
            <p className="text-slate-400 text-sm">Photo your fridge to update the current stock.</p>
            <div className="flex gap-3">
              <button
                onClick={() => { fileInputRef.current?.removeAttribute('capture'); fileInputRef.current?.click(); }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition border border-slate-600"
              >
                <Upload size={15} /> Upload
              </button>
              <button
                onClick={() => { fileInputRef.current?.setAttribute('capture', 'environment'); fileInputRef.current?.click(); }}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition"
              >
                <Camera size={15} /> Camera
              </button>
            </div>
          </div>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {/* Items */}
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-base">
          Current Stock
          {items.length > 0 && <span className="text-slate-500 font-normal text-sm ml-2">({items.length})</span>}
        </h2>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-14 space-y-2">
          <div className="text-5xl">{'\u{1F9CA}'}</div>
          <p className="text-slate-400 text-sm">No items yet.</p>
          <p className="text-slate-500 text-xs">Scan your fridge or define target stock in Settings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => {
            const deficit = item.targetQty - item.currentQty;
            const hasTarget = item.targetQty > 0;
            return (
              <div key={item.id}
                className={`bg-slate-800 border rounded-2xl p-3 flex flex-col gap-2 ${hasTarget && deficit > 0 ? 'border-red-500/40' : hasTarget ? 'border-emerald-500/30' : 'border-slate-700'}`}>
                <span className="text-2xl">{getFoodEmoji(item.name)}</span>
                <p className="text-white font-semibold text-sm leading-tight">{item.name}</p>
                {/* qty controls */}
                <div className="flex items-center gap-1 mt-auto">
                  <button onClick={() => adjustCurrent(item.id, -1)}
                    className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition flex-shrink-0">
                    <Minus size={12} />
                  </button>
                  <span className="flex-1 text-center text-white font-bold text-base">{item.currentQty}</span>
                  <button onClick={() => adjustCurrent(item.id, 1)}
                    className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition flex-shrink-0">
                    <Plus size={12} />
                  </button>
                </div>
                <p className="text-slate-500 text-xs text-center -mt-1">{item.unit}</p>
                {hasTarget && deficit > 0 && (
                  <span className="text-xs font-bold text-center px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                    -{deficit} needed
                  </span>
                )}
                {hasTarget && deficit <= 0 && (
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