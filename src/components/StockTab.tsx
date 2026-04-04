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

interface ImageSlot {
  preview: string;
  base64: string;
  mimeType: string;
}

function applyDetected(
  items: StockItem[],
  detected: Awaited<ReturnType<typeof analyzeImage>>,
  mode: 'soll' | 'ist'
): StockItem[] {
  const updated = [...items];
  for (const d of detected) {
    const idx = updated.findIndex((i) => i.name.toLowerCase() === d.name.toLowerCase());
    if (idx >= 0) {
      if (mode === 'soll') updated[idx] = { ...updated[idx], targetQty: d.quantity, unit: d.unit };
      else updated[idx] = { ...updated[idx], currentQty: d.quantity, unit: d.unit };
    } else {
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
  return updated;
}

export default function StockTab({ items, apiKey, onItemsChange }: Props) {
  const sollInputRef = useRef<HTMLInputElement>(null);
  const istInputRef = useRef<HTMLInputElement>(null);
  const [sollSlot, setSollSlot] = useState<ImageSlot | null>(null);
  const [istSlot, setIstSlot] = useState<ImageSlot | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<Mode>('soll');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newUnit, setNewUnit] = useState('pcs');

  const readFile = (file: File): Promise<ImageSlot> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        resolve({ preview: result, base64: result.split(',')[1], mimeType: file.type || 'image/jpeg' });
      };
      reader.readAsDataURL(file);
    });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>, mode: 'soll' | 'ist') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const slot = await readFile(file);
    if (mode === 'soll') setSollSlot(slot);
    else setIstSlot(slot);
  };

  const handleScan = async () => {
    if (!sollSlot && !istSlot) return toast.error('Please select at least one image.');
    if (!apiKey) return toast.error('Please add an OpenRouter API key in Settings first.');
    setLoading(true);
    try {
      const [sollResult, istResult] = await Promise.all([
        sollSlot ? analyzeImage(sollSlot.base64, sollSlot.mimeType, apiKey) : Promise.resolve([]),
        istSlot ? analyzeImage(istSlot.base64, istSlot.mimeType, apiKey) : Promise.resolve([]),
      ]);

      let updated = [...items];
      if (sollResult.length > 0) updated = applyDetected(updated, sollResult, 'soll');
      if (istResult.length > 0) updated = applyDetected(updated, istResult, 'ist');
      onItemsChange(updated);

      const parts = [];
      if (sollResult.length > 0) parts.push(`SOLL: ${sollResult.length} items`);
      if (istResult.length > 0) parts.push(`IST: ${istResult.length} items`);
      if (parts.length > 0) toast.success(parts.join(' | '));
      else toast('No items detected. Try clearer photos.', { icon: '\u{1F4F7}' });

      setSollSlot(null);
      setIstSlot(null);
      if (sollInputRef.current) sollInputRef.current.value = '';
      if (istInputRef.current) istInputRef.current.value = '';
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const adjustQty = (id: string, delta: number) => {
    onItemsChange(items.map((item) => {
      if (item.id !== id) return item;
      if (viewMode === 'soll') return { ...item, targetQty: Math.max(0, item.targetQty + delta) };
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
      targetQty: viewMode === 'soll' ? qty : 0,
      currentQty: viewMode === 'ist' ? qty : 0,
      addedAt: Date.now(),
    }]);
    setNewName(''); setNewQty('1'); setShowAddForm(false);
    toast.success(`"${newName.trim()}" added!`);
  };

  const hasImages = sollSlot || istSlot;

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">

      {/* Dual upload */}
      <div className="grid grid-cols-2 gap-3">
        {/* SOLL slot */}
        <div className="bg-slate-800 border border-purple-500/30 rounded-2xl overflow-hidden">
          <div className="bg-purple-600/20 px-3 py-1.5 flex items-center justify-between">
            <span className="text-purple-300 text-xs font-bold tracking-wider">SOLL</span>
            {sollSlot && (
              <button onClick={() => { setSollSlot(null); if (sollInputRef.current) sollInputRef.current.value = ''; }}
                className="text-slate-500 hover:text-red-400 transition">
                <X size={13} />
              </button>
            )}
          </div>
          {sollSlot ? (
            <img src={sollSlot.preview} alt="SOLL" className="w-full h-28 object-cover" />
          ) : (
            <div className="p-3 space-y-2">
              <button
                onClick={() => { sollInputRef.current?.removeAttribute('capture'); sollInputRef.current?.click(); }}
                className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition border border-slate-600"
              >
                <Upload size={13} /> Upload
              </button>
              <button
                onClick={() => { sollInputRef.current?.setAttribute('capture', 'environment'); sollInputRef.current?.click(); }}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition"
              >
                <Camera size={13} /> Camera
              </button>
            </div>
          )}
        </div>

        {/* IST slot */}
        <div className="bg-slate-800 border border-blue-500/30 rounded-2xl overflow-hidden">
          <div className="bg-blue-600/20 px-3 py-1.5 flex items-center justify-between">
            <span className="text-blue-300 text-xs font-bold tracking-wider">IST</span>
            {istSlot && (
              <button onClick={() => { setIstSlot(null); if (istInputRef.current) istInputRef.current.value = ''; }}
                className="text-slate-500 hover:text-red-400 transition">
                <X size={13} />
              </button>
            )}
          </div>
          {istSlot ? (
            <img src={istSlot.preview} alt="IST" className="w-full h-28 object-cover" />
          ) : (
            <div className="p-3 space-y-2">
              <button
                onClick={() => { istInputRef.current?.removeAttribute('capture'); istInputRef.current?.click(); }}
                className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition border border-slate-600"
              >
                <Upload size={13} /> Upload
              </button>
              <button
                onClick={() => { istInputRef.current?.setAttribute('capture', 'environment'); istInputRef.current?.click(); }}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition"
              >
                <Camera size={13} /> Camera
              </button>
            </div>
          )}
        </div>
      </div>

      <input ref={sollInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, 'soll')} />
      <input ref={istInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, 'ist')} />

      {/* Scan button */}
      {hasImages && (
        <button
          onClick={handleScan}
          disabled={loading}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition"
        >
          {loading
            ? <><Loader2 size={18} className="animate-spin" /> Scanning{sollSlot && istSlot ? ' both' : ''}...</>
            : <><ScanLine size={18} /> Scan{sollSlot && istSlot ? ' Both' : sollSlot ? ' SOLL' : ' IST'}</>}
        </button>
      )}

      {/* SOLL / IST inventory toggle */}
      <div className="flex bg-slate-800 rounded-xl p-1 border border-slate-700">
        <button
          onClick={() => setViewMode('soll')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${viewMode === 'soll' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-300'}`}
        >
          SOLL
        </button>
        <button
          onClick={() => setViewMode('ist')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${viewMode === 'ist' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-300'}`}
        >
          IST
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-base">
          {viewMode === 'soll' ? 'Target Stock' : 'Current Stock'}
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
          <p className="text-slate-500 text-xs">Upload photos above or add manually.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => {
            const qty = viewMode === 'soll' ? item.targetQty : item.currentQty;
            const deficit = item.targetQty - item.currentQty;
            return (
              <div key={item.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-3 flex flex-col gap-2 relative">
                <button onClick={() => removeItem(item.id)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400 transition">
                  <X size={13} />
                </button>
                <span className="text-2xl">{getFoodEmoji(item.name)}</span>
                <p className="text-white font-semibold text-sm leading-tight pr-4">{item.name}</p>
                <div className="flex items-center gap-1 mt-auto">
                  <button onClick={() => adjustQty(item.id, -1)}
                    className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition flex-shrink-0">
                    <Minus size={12} />
                  </button>
                  <span className="flex-1 text-center text-white font-bold text-base">{qty}</span>
                  <button onClick={() => adjustQty(item.id, 1)}
                    className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition flex-shrink-0">
                    <Plus size={12} />
                  </button>
                </div>
                <p className="text-slate-500 text-xs text-center -mt-1">{item.unit}</p>
                {viewMode === 'ist' && item.targetQty > 0 && deficit > 0 && (
                  <span className="text-xs font-bold text-center px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                    -{deficit} needed
                  </span>
                )}
                {viewMode === 'ist' && item.targetQty > 0 && deficit <= 0 && (
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