export interface StockItem {
  id: string;
  name: string;
  unit: string;
  targetQty: number;  // SOLL
  currentQty: number; // IST
  category?: string;
  addedAt: number;
}

export interface AppSettings {
  openRouterApiKey: string;
}
