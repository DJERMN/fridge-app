import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { ShoppingCart, Settings, Snowflake } from 'lucide-react';
import FridgeTab from './components/FridgeTab';
import ShoppingTab from './components/ShoppingTab';
import SettingsTab from './components/SettingsTab';
import useLocalStorage from './hooks/useLocalStorage';
import type { FridgeItem, AppSettings } from './types';

type Tab = 'fridge' | 'shopping' | 'settings';

const DEFAULT_SETTINGS: AppSettings = {
  openRouterApiKey: '',
  language: 'de',
};

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('fridge');
  const [items, setItems] = useLocalStorage<FridgeItem[]>('fridge-items', []);
  const [settings, setSettings] = useLocalStorage<AppSettings>('fridge-settings', DEFAULT_SETTINGS);

  const shoppingCount = items.filter((i) => i.status === 'low' || i.status === 'empty').length;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#0f172a', fontFamily: 'system-ui, sans-serif' }}
    >
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#f1f5f9',
            border: '1px solid #334155',
            borderRadius: '12px',
          },
        }}
      />

      {/* Top header */}
      <header
        className="sticky top-0 z-10 flex items-center justify-center px-4 py-3 border-b"
        style={{ background: '#0f172a', borderColor: '#1e293b' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">🧊</span>
          <span className="text-white font-bold text-lg tracking-tight">FridgeMate</span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        {activeTab === 'fridge' && (
          <FridgeTab items={items} apiKey={settings.openRouterApiKey} onItemsChange={setItems} />
        )}
        {activeTab === 'shopping' && (
          <ShoppingTab items={items} onItemsChange={setItems} />
        )}
        {activeTab === 'settings' && (
          <SettingsTab settings={settings} onSave={setSettings} />
        )}
      </main>

      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-20 flex border-t"
        style={{ background: '#0f172a', borderColor: '#1e293b' }}
      >
        <TabButton
          active={activeTab === 'fridge'}
          onClick={() => setActiveTab('fridge')}
          icon={<Snowflake size={22} />}
          label="Kühlschrank"
        />
        <TabButton
          active={activeTab === 'shopping'}
          onClick={() => setActiveTab('shopping')}
          icon={
            <div className="relative">
              <ShoppingCart size={22} />
              {shoppingCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {shoppingCount > 9 ? '9+' : shoppingCount}
                </span>
              )}
            </div>
          }
          label="Einkaufen"
        />
        <TabButton
          active={activeTab === 'settings'}
          onClick={() => setActiveTab('settings')}
          icon={<Settings size={22} />}
          label="Einstellungen"
        />
      </nav>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors"
      style={{ color: active ? '#3b82f6' : '#64748b' }}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

export default App;
