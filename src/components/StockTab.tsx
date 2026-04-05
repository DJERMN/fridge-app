import { useRef, useState } from 'react';
import { Camera, Upload, Loader2, X, Minus, Plus, ScanLine } from 'lucide-react';
import toast from 'react-hot-toast';
import type { StockItem } from '../types';
import { analyzeImage, normalizeItems } from '../services/gemini';
import { compressImage } from '../utils/compressImage';

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

  // Only show items that exist in the current fridge (IST)
  const visibleItems = items.filter((i) => i.currentQty > 0);

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
    if (!apiKey) return toast.error('Please add your OpenRouter API key in Settings first.');
    setLoading(true);
    try {
      const detected = await analyzeImage(imageBase64, mimeType, apiKey);
      if (detected.length === 0) {
        toast('No items detected. Try a clearer photo.', { icon: '\u{1F4F7}' });
      } else {
        const existingNames = items.map((i) => i.name);
        const normalized = await normalizeItems(existingNames, detected, apiKey);

        // Reset all current quantities to 0, then apply scan results
        let updated = items.map((i) => ({ ...i, currentQty: 0 }));
        let newCount = 0;
        for (const d of normalized) {
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
        toast.success(`${normalized.length} item(s) found in fridge${newCount > 0 ? `, ${newCount} new` : ''}`);
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
      {/* IST scan area */}
      <div className="bg-slate-800 rounded-2xl border border-blue-500/30 overflow-hidden">
        {preview ? (
          <div>
            <div className="relative">
              <img src={preview} alt="Preview" className="w-full max-h-52 object-cover" />
              <button
                onClick={() => { setPreview(null); setImageBase64(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="absolute top-2 right-2 bg-slate-900/80 text-white rounded-full p-1.5 transition hover:bg-slate-900"
              >
                <X size={16} />
              </button>
            </div>
            <button onClick={handleScan} disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold flex items-center justify-center gap-2 transition">
              {loading
                ? <><Loader2 size={18} className="animate-spin" /> Scanning fridge...</>
                : <><ScanLine size={18} /> Scan current fridge</>}
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <p className="text-blue-300 text-xs font-bold tracking-wider">CURRENT STATE (IST)</p>
            <p className="text-slate-400 text-sm">Photo your fridge to see what's inside right now.</p>
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

      {/* Current inventory — IST items only */}
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-base">
          In the fridge
          {visibleItems.length > 0 && <span className="text-slate-500 font-normal text-sm ml-2">({visibleItems.length})</span>}
        </h2>
      </div>

      {visibleItems.length === 0 ? (
        <div className="text-center py-14 space-y-2">
          <div className="text-5xl">{'\u{1F9CA}'}</div>
          <p className="text-slate-400 text-sm">Fridge appears empty.</p>
          <p className="text-slate-500 text-xs">Scan a photo to see what's inside.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visibleItems.map((item) => {
            const deficit = item.targetQty > 0 ? item.targetQty - item.currentQty : 0;
            return (
              <div key={item.id}
                className={`bg-slate-800 border rounded-2xl p-3 flex flex-col gap-2 ${deficit > 0 ? 'border-red-500/40' : item.targetQty > 0 ? 'border-emerald-500/30' : 'border-slate-700'}`}
              >
                <span className="text-2xl">{getFoodEmoji(item.name)}</span>
                <p className="text-white font-semibold text-sm leading-tight">{item.name}</p>
                <div className="flex items-center gap-1 mt-auto">
                  <button onClick={() => adjustCurrent(item.id, -1)}
                    className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition">
                    <Minus size={12} />
                  </button>
                  <span className="flex-1 text-center text-white font-bold text-base">{item.currentQty}</span>
                  <button onClick={() => adjustCurrent(item.id, 1)}
                    className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition">
                    <Plus size={12} />
                  </button>
                </div>
                <p className="text-slate-500 text-xs text-center -mt-1">{item.unit}</p>
                {item.targetQty > 0 && deficit > 0 && (
                  <span className="text-xs font-bold text-center px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                    -{deficit} needed
                  </span>
                )}
                {item.targetQty > 0 && deficit <= 0 && (
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