import AsyncStorage from '@react-native-async-storage/async-storage';
import { logStaffActivity } from './activityStore';
import { ProductCategory } from './inventoryStore';

// In-store sales rung up at the admin cash register (POS). They are saved, so they survive a page refresh.

export interface PosLine {
  productId: string;
  name: string;
  category: ProductCategory;
  size: string;
  texture: string;
  style: string;
  price: number;
  quantity: number;
}

export interface PosSale {
  id: string; // receipt number, e.g. #234199
  customer: string;
  cashier: string;
  items: PosLine[];
  total: number;
  date: string;
}

export const POS_START = 234199; // number of the first receipt
const POS_KEY = 'bt_pos_sales';

let queue: Promise<unknown> = Promise.resolve();

export async function loadPosSales(): Promise<PosSale[]> {
  try {
    const raw = await AsyncStorage.getItem(POS_KEY);
    return raw ? (JSON.parse(raw) as PosSale[]) : [];
  } catch {
    return [];
  }
}

export function addPosSale(input: { customer: string; cashier: string; items: PosLine[] }): Promise<PosSale> {
  const run = queue.then(async () => {
    const list = await loadPosSales();
    const sale: PosSale = {
      id: `#${POS_START + list.length}`,
      customer: input.customer,
      cashier: input.cashier,
      items: input.items,
      total: input.items.reduce((t, i) => t + i.price * i.quantity, 0),
      date: new Date().toISOString(),
    };
    await AsyncStorage.setItem(POS_KEY, JSON.stringify([sale, ...list]));
    await logStaffActivity('POS billing', `${sale.id} · ${sale.customer} · ₱${sale.total.toFixed(2)}`);
    return sale;
  });
  queue = run.catch(() => undefined);
  return run;
}