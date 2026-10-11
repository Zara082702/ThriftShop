import AsyncStorage from '@react-native-async-storage/async-storage';

// One shared product list for the customer shop (index) and the admin screen.
// Both screens read and write the same AsyncStorage key, so stock always matches.

export type ProductCategory = 'BEDSHEETS' | 'PILLOWCASES' | 'COMFORTERS' | 'BLANKETS';
export const PRODUCT_CATEGORIES: ProductCategory[] = ['BEDSHEETS', 'PILLOWCASES', 'COMFORTERS', 'BLANKETS'];

export interface InventoryItem {
  id: string; // must not contain "-" (the cart uses it as a prefix)
  sku: string;
  name: string;
  category: ProductCategory;
  basePrice: number;
  available: number;
  colors: string[];
  sizes: string[];
  style?: string; // e.g. "Classic Plain"
  texture?: string; // e.g. "Soft Cotton"
  active: boolean; // admin "Status" switch: inactive products are hidden from customers
  isNew?: boolean;
}

export const DEFAULT_INVENTORY: InventoryItem[] = [
  { id: 'b1', sku: 'BT-BS-001', name: 'Premium Cotton Sheet', category: 'BEDSHEETS', basePrice: 48.0, available: 12, colors: ['Earth Brown', 'Pure White'], sizes: ['S', 'M', 'L'], style: 'Classic Plain', texture: 'Soft Cotton', active: true },
  { id: 'b2', sku: 'BT-BS-002', name: 'Terracotta Fitted Sheet', category: 'BEDSHEETS', basePrice: 52.5, available: 8, colors: ['Terracotta'], sizes: ['S', 'M', 'L'], style: 'Fitted', texture: 'Brushed Cotton', active: true },
  { id: 'p1', sku: 'BT-PC-001', name: 'Sateen Pillowcase Set', category: 'PILLOWCASES', basePrice: 24.5, available: 24, colors: ['Cream', 'Coffee'], sizes: ['S', 'M', 'L'], style: 'Piped Edge', texture: 'Silky Sateen', active: true },
  { id: 'p2', sku: 'BT-PC-002', name: 'Golden Edge Luxury Cover', category: 'PILLOWCASES', basePrice: 28.0, available: 0, colors: ['Golden'], sizes: ['S', 'M', 'L'], style: 'Golden Edge', texture: 'Satin', active: true },
  { id: 'c1', sku: 'BT-CF-001', name: 'Weighted Cloud Comforter', category: 'COMFORTERS', basePrice: 85.0, available: 5, colors: ['Beige', 'Charcoal'], sizes: ['S', 'M', 'L'], style: 'Quilted', texture: 'Plush Fill', active: true },
  { id: 'bl1', sku: 'BT-BL-001', name: 'Oversized Knit Throw Blanket', category: 'BLANKETS', basePrice: 32.8, available: 16, colors: ['Mocha', 'Sandy'], sizes: ['S', 'M', 'L'], style: 'Chunky Knit', texture: 'Cozy Wool Blend', active: true },
];

const INVENTORY_KEY = 'bt_inventory';

// Fills in style and texture for products that were saved before those fields existed.
const normalize = (items: InventoryItem[]): InventoryItem[] =>
  items.map((i) => {
    const d = DEFAULT_INVENTORY.find((x) => x.id === i.id);
    return { ...i, style: i.style || d?.style || 'Standard', texture: i.texture || d?.texture || 'Standard' };
  });

export async function loadInventory(): Promise<InventoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(INVENTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalize(parsed as InventoryItem[]);
    }
  } catch {
    // fall through to the default list
  }
  return DEFAULT_INVENTORY;
}

export async function saveInventory(items: InventoryItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(INVENTORY_KEY, JSON.stringify(items));
  } catch {
    // storage unavailable: nothing else to do
  }
}

// Every stock change goes through this queue: it reads the latest stock, applies your change
// and saves it, one change at a time, so the admin and the customers never overwrite each other.
let queue: Promise<unknown> = Promise.resolve();
export function mutateInventory(change: (items: InventoryItem[]) => InventoryItem[]): Promise<InventoryItem[]> {
  const run = queue.then(async () => {
    const next = change(await loadInventory());
    await saveInventory(next);
    return next;
  });
  queue = run.catch(() => undefined);
  return run;
}

// Called when a customer places an order: checks stock, then deducts it.
export async function purchaseItems(
  lines: { productId: string; quantity: number }[]
): Promise<{ ok: boolean; message?: string; inventory: InventoryItem[] }> {
  const wanted: Record<string, number> = {};
  lines.forEach((l) => {
    wanted[l.productId] = (wanted[l.productId] || 0) + l.quantity;
  });

  const problem = { text: '' };
  const inventory = await mutateInventory((current) => {
    for (const productId of Object.keys(wanted)) {
      const product = current.find((i) => i.id === productId);
      if (!product || !product.active) {
        problem.text = 'An item in your cart is no longer available.';
        return current;
      }
      if (product.available < wanted[productId]) {
        problem.text = `Only ${product.available} of ${product.name} left. Please update your cart.`;
        return current;
      }
    }
    return current.map((i) => (wanted[i.id] ? { ...i, available: Math.max(0, i.available - wanted[i.id]) } : i));
  });

  return problem.text ? { ok: false, message: problem.text, inventory } : { ok: true, inventory };
}