import { useState } from 'react';
import { Copy, CheckSquare, Check, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import type { StockItem } from '../types';
import { reconcileInventory } from '../services/gemini';

interface Props {
  items: StockItem[];
  onItemsChange: (items: StockItem[]) => void;
  apiKey: string;
}

function ItemRow({ item, checked, onToggle }: {
  item: { id: string; name: string; targetQty: number; currentQty: number; unit: string; deficit: number };
  checked: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onToggle(item.id)}
      className={`w-full bg-slate-800 border border-red-500/30 rounded-2xl px-4 py-3 flex items-center gap-3 transition hover:bg-slate-700 text-left ${checked.has(item.id) ? 'opacity-50' : ''}`}
    >
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${checked.has(item.id) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
        {checked.has(item.id) && <Check size={12} className="text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-white text-sm font-medium ${checked.has(item.id) ? 'line-through' : ''}`}>{item.name}</p>
        <p className="text-slate-500 text-xs">SOLL {item.targetQty} / IST {item.currentQty} {item.unit}</p>
      </div>
      <span className="text-sm font-bold text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full flex-shrink-0 border border-red-500/20">
        -{item.deficit} {item.unit}
      </span>
    </button>
  );
}

export default function ShoppingTab({ items, onItemsChange, apiKey }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState(false);

  const deficitItems = items
    .filter((i) => i.targetQty > 0 && i.currentQty < i.targetQty)
    .map((i) => ({ ...i, deficit: i.targetQty - i.currentQty }))
    .sort((a, b) => b.deficit - a.deficit);

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const markRestocked = () => {
    const ids = new Set(checked);
    onItemsChange(items.map((item) =>
      ids.has(item.id) ? { ...item, currentQty: item.targetQty } : item
    ));
    setChecked(new Set());
    toast.success('Items marked as restocked!');
  };

  const copyList = () => {
    if (deficitItems.length === 0) return toast.error('Shopping list is empty.');
    const lines = deficitItems.map((i) => `  - ${i.name}: ${i.deficit} ${i.unit}`);
    navigator.clipboard.writeText('Shopping list:\n' + lines.join('\n'))
      .then(() => toast.success('Copied!'))
      .catch(() => toast.error('Copy failed.'));
  };

  const mergeDuplicates = async () => {
    if (!apiKey) return toast.error('Please add your OpenRouter API key in Settings first.');
    setMerging(true);
    try {
      const sollItems = items
        .filter((i) => i.targetQty > 0)
        .map((i) => ({ name: i.name, targetQty: i.targetQty, unit: i.unit }));
      const istItems = items
        .filter((i) => i.currentQty > 0)
        .map((i) => ({ name: i.name, currentQty: i.currentQty, unit: i.unit }));

      const reconciled = await reconcileInventory(sollItems, istItems, apiKey);
      if (reconciled.length === 0) return toast.error('No result from AI. Try again.');

      const updated: StockItem[] = reconciled.map((r) => ({
        id: items.find((i) => i.name.toLowerCase() === r.name.toLowerCase())?.id
          ?? crypto.randomUUID(),
        name: r.name,
        unit: r.unit,
        targetQty: r.targetQty,
        currentQty: r.currentQty,
        category: r.category,
        addedAt: new Date().getTime(),
      }));
      onItemsChange(updated);
      setChecked(new Set());
      toast.success('Duplicates merged!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error merging items.');
    } finally {
      setMerging(false);
    }
  };

  if (deficitItems.length === 0) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-3">
        <div className="text-6xl">{'\u{1F389}'}</div>
        <p className="text-white font-semibold text-lg">Fully stocked!</p>
        <p className="text-slate-400 text-sm">No deficits detected.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">
          Deficit
          <span className="text-slate-500 font-normal text-base ml-2">({deficitItems.length})</span>
        </h2>
      </div>

      <div className="flex gap-2">
        <button onClick={copyList}
          className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition">
          <Copy size={15} /> Copy list
        </button>
        <button onClick={mergeDuplicates} disabled={merging}
          className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition disabled:opacity-50">
          <RefreshCw size={15} className={merging ? 'animate-spin' : ''} />
          {merging ? 'Merging...' : 'Merge duplicates'}
        </button>
      </div>
      {checked.size > 0 && (
        <button onClick={markRestocked}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition">
          <CheckSquare size={15} /> Restocked ({checked.size})
        </button>
      )}

      <div className="space-y-4">
        {(() => {
          const hasCategories = deficitItems.some((i) => i.category);
          if (!hasCategories) {
            return (
              <div className="space-y-2">
                {deficitItems.map((item) => <ItemRow key={item.id} item={item} checked={checked} onToggle={toggleCheck} />)}
              </div>
            );
          }
          const groups: Record<string, typeof deficitItems> = {};
          for (const item of deficitItems) {
            const cat = item.category ?? 'Sonstiges';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(item);
          }
          return Object.entries(groups).map(([cat, groupItems]) => (
            <div key={cat}>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 px-1">{cat}</p>
              <div className="space-y-2">
                {groupItems.map((item) => <ItemRow key={item.id} item={item} checked={checked} onToggle={toggleCheck} />)}
              </div>
            </div>
          ));
        })()}
      </div>
    </div>
  );
}