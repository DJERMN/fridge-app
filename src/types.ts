export type ItemStatus = 'ok' | 'low' | 'empty';

export interface FridgeItem {
  id: string;
  name: string;
  quantity: string;
  status: ItemStatus;
  addedAt: number;
}

export interface AppSettings {
  openRouterApiKey: string;
  language: 'de' | 'en';
}
