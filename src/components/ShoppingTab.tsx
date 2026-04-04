import { useState } from 'react';
import { Copy, CheckSquare, ShoppingCart, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import type { FridgeItem } from '../types';

interface Props {
  items: FridgeItem[];
  onItemsChange: (items: FridgeItem[]) => void;
}

export default function ShoppingTab({ items, onItemsChange }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const lowItems = items.filter((i) => i.status === 'low');
  const emptyItems = items.filter((i) => i.status === 'empty');
  const shoppingItems = [...emptyItems, ...lowItems];

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const markAllOk = () => {
    onItemsChange(items.map((item) =>
      item.status === 'low' || item.status === 'empty' ? { ...item, status: 'ok' } : item
    ));
    setChecked(new Set());
    toast.success('All items marked as good!');
  };

  const copyToClipboard = () => {
    if (shoppingItems.length === 0) return toast.error('Shopping list is empty.');
    const lines: string[] = [];
    if (emptyItems.length > 0) {
      lines.push('Out of stock:');
      emptyItems.forEach((i) => lines.push(`  • ${i.name} (${i.quantity})`));
    }
    if (lowItems.length > 0) {
      lines.push('⚠️ Running low:');
      lowItems.forEach((i) => lines.push(`  • ${i.name} (${i.quantity})`));
    }
    navigator.clipboard.writeText(lines.join('\n'))
      .then(() => toast.success('Shopping list copied!'))
      .catch(() => toast.error('Copy failed.'));
  };

  if (shoppingItems.length === 0) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-3">
        <div className="text-6xl">ðŸŽ‰</div>
        <p className="text-white font-semibold text-lg">All good!</p>
        <p className="text-slate-400 text-sm">Your fridge is well stocked.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg flex items-center gap-2">
          <ShoppingCart size={20} className="text-blue-400" />
          Shopping List
          <span className="text-slate-500 font-normal text-base">({shoppingItems.length})</span>
        </h2>
      </div>

      <div className="flex gap-2">
        <button onClick={copyToClipboard}
          className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition">
          <Copy size={15} /> Copy
        </button>
        <button onClick={markAllOk}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition">
          <CheckSquare size={15} /> All done
        </button>
      </div>

      {emptyItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-red-400 font-semibold text-xs uppercase tracking-widest px-1">Out of Stock</p>
          {emptyItems.map((item) => (
            <ShoppingItem key={item.id} item={item} checked={checked.has(item.id)} onToggle={() => toggleCheck(item.id)} variant="empty" />
          ))}
        </div>
      )}

      {lowItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-amber-400 font-semibold text-xs uppercase tracking-widest px-1">Running Low</p>
          {lowItems.map((item) => (
            <ShoppingItem key={item.id} item={item} checked={checked.has(item.id)} onToggle={() => toggleCheck(item.id)} variant="low" />
          ))}
        </div>
      )}
    </div>
  );
}

interface ShoppingItemProps {
  item: FridgeItem;
  checked: boolean;
  onToggle: () => void;
  variant: 'empty' | 'low';
}

function ShoppingItem({ item, checked, onToggle, variant }: ShoppingItemProps) {
  return (
    <button onClick={onToggle}
      className={`w-full bg-slate-800 border ${variant === 'empty' ? 'border-red-500/30' : 'border-amber-500/30'} rounded-2xl px-4 py-3 flex items-center gap-3 transition hover:bg-slate-700 text-left ${checked ? 'opacity-50' : ''}`}>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
        {checked && <Check size={12} className="text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-white text-sm font-medium ${checked ? 'line-through' : ''}`}>{item.name}</p>
        <p className="text-slate-500 text-xs truncate">{item.quantity}</p>
      </div>
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${variant === 'empty' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
        {variant === 'empty' ? 'Empty' : 'Low'}
      </span>
    </button>
  );
}
