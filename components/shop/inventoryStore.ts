import AsyncStorage from '@react-native-async-storage/async-storage';


export type ProductCategory = 'BEDSHEETS' | 'PILLOWCASES' | 'COMFORTERS' | 'BLANKETS';
export const PRODUCT_CATEGORIES: ProductCategory[] = ['BEDSHEETS', 'PILLOWCASES', 'COMFORTERS', 'BLANKETS'];

export interface InventoryItem {
  id: string; 
  sku: string;
  name: string;
  category: ProductCategory;
  basePrice: number;
  available: number;
  colors: string[];
  sizes: string[];
  active: boolean; 
  isNew?: boolean;
}

export const DEFAULT_INVENTORY: InventoryItem[] = [
  { id: 'b1', sku: 'BT-BS-001', name: 'Premium Cotton Sheet', category: 'BEDSHEETS', basePrice: 48.0, available: 12, colors: ['Earth Brown', 'Pure White'], sizes: ['S', 'M', 'L'], active: true },
  { id: 'b2', sku: 'BT-BS-002', name: 'Terracotta Fitted Sheet', category: 'BEDSHEETS', basePrice: 52.5, available: 8, colors: ['Terracotta'], sizes: ['S', 'M', 'L'], active: true },
  { id: 'p1', sku: 'BT-PC-001', name: 'Sateen Pillowcase Set', category: 'PILLOWCASES', basePrice: 24.5, available: 24, colors: ['Cream', 'Coffee'], sizes: ['S', 'M', 'L'], active: true },
  { id: 'p2', sku: 'BT-PC-002', name: 'Golden Edge Luxury Cover', category: 'PILLOWCASES', basePrice: 28.0, available: 0, colors: ['Golden'], sizes: ['S', 'M', 'L'], active: true },
  { id: 'c1', sku: 'BT-CF-001', name: 'Weighted Cloud Comforter', category: 'COMFORTERS', basePrice: 85.0, available: 5, colors: ['Beige', 'Charcoal'], sizes: ['S', 'M', 'L'], active: true },
  { id: 'bl1', sku: 'BT-BL-001', name: 'Oversized Knit Throw Blanket', category: 'BLANKETS', basePrice: 32.8, available: 16, colors: ['Mocha', 'Sandy'], sizes: ['S', 'M', 'L'], active: true },
];

const INVENTORY_KEY = 'bt_inventory';

export async function loadInventory(): Promise<InventoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(INVENTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as InventoryItem[];
    }
  } catch {
  }
  return DEFAULT_INVENTORY;
}

export async function saveInventory(items: InventoryItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(INVENTORY_KEY, JSON.stringify(items));
  } catch {
    
  }
}

export async function purchaseItems(
  lines: { productId: string; quantity: number }[]
): Promise<{ ok: boolean; message?: string; inventory: InventoryItem[] }> {
  const inventory = await loadInventory();

  const wanted: Record<string, number> = {};
  lines.forEach((l) => {
    wanted[l.productId] = (wanted[l.productId] || 0) + l.quantity;
  });

  for (const productId of Object.keys(wanted)) {
    const product = inventory.find((i) => i.id === productId);
    if (!product || !product.active) {
      return { ok: false, message: 'An item in your cart is no longer available.', inventory };
    }
    if (product.available < wanted[productId]) {
      return {
        ok: false,
        message: `Only ${product.available} of ${product.name} left. Please update your cart.`,
        inventory,
      };
    }
  }

  const next = inventory.map((i) =>
    wanted[i.id] ? { ...i, available: Math.max(0, i.available - wanted[i.id]) } : i
  );
  await saveInventory(next);
  return { ok: true, inventory: next };
}