import AsyncStorage from '@react-native-async-storage/async-storage';

// One shared product list for the customer shop (index) and the admin screen.
// Stock is counted per size. Customers also choose a texture and a style for each piece.

export type ProductCategory = 'BEDSHEETS' | 'PILLOWCASES' | 'COMFORTERS' | 'BLANKETS';
export const PRODUCT_CATEGORIES: ProductCategory[] = ['BEDSHEETS', 'PILLOWCASES', 'COMFORTERS', 'BLANKETS'];

export const SIZE_OPTIONS: Record<ProductCategory, string[]> = {
  BEDSHEETS: ['Single', 'Double', 'Semi Double', 'Full Double', 'Queen', 'King'],
  PILLOWCASES: ['Queen', 'King', 'Double', 'Body Pillow'],
  COMFORTERS: ['Twin', 'Twin XL', 'Double', 'King'],
  BLANKETS: ['Twin', 'Full Double', 'Queen', 'King'],
};
export const TEXTURE_OPTIONS = ['Tencel', 'Linen', 'Flannel', 'Cotton', 'Microfiber', 'Bamboo', 'Satin', 'Percale', 'Jersey', 'Fleece'];
export const STYLE_OPTIONS = ['Plain Color', 'Assorted Design', 'Dark Color', 'Light Color', 'Floral Print', 'Striped', 'Checkered', 'Polka Dot', 'Pastel', 'Earth Tone'];
export const MIN_PIECES = 8; // every size of every product starts with at least this many pieces

export interface InventoryItem {
  id: string; // must not contain "-" (the cart uses it as a prefix)
  sku: string;
  name: string;
  category: ProductCategory;
  basePrice: number; // price of the smallest size
  stock: Record<string, number>; // pieces in stock for each size
  textures: string[];
  styles: string[];
  active: boolean; // admin "Status" switch: inactive products are hidden from customers
  isNew?: boolean;
}

export const sizesOf = (item: InventoryItem) => Object.keys(item.stock);
export const stockTotal = (item: InventoryItem) => Object.values(item.stock).reduce((t, n) => t + n, 0);

// Bigger sizes cost more: +12% for each step up from the smallest size
export const priceFor = (item: InventoryItem, size: string) => {
  const idx = Math.max(0, SIZE_OPTIONS[item.category].indexOf(size));
  return Math.round((item.basePrice * (1 + 0.12 * idx)) / 5) * 5;
};

// Cart ids look like  bs1-Queen-Linen-Plain Color
export const cartIdOf = (productId: string, size: string, texture: string, style: string) =>
  [productId, size, texture, style].join('-');
export const parseCartId = (id: string) => {
  const [productId, size, texture, style] = id.split('-');
  return { productId, size, texture, style };
};

const NAMES: Record<ProductCategory, string[]> = {
  BEDSHEETS: ['Everyday Bedsheet', 'Sunday Morning Bedsheet', 'Hotel Style Bedsheet', 'Cottage Bedsheet', 'Earth Tone Bedsheet', 'Cloud Soft Bedsheet'],
  PILLOWCASES: ['Classic Pillowcase', 'Piped Edge Pillowcase', 'Envelope Pillowcase', 'Cozy Corner Pillowcase', 'Luxe Pillowcase', 'Daily Comfort Pillowcase'],
  COMFORTERS: ['Cloud Comforter', 'Quilted Comforter', 'Weighted Comforter', 'Hotel Comforter', 'Cabin Comforter', 'Everyday Comforter'],
  BLANKETS: ['Knit Throw Blanket', 'Cozy Fleece Blanket', 'Family Blanket', 'Travel Blanket', 'Sofa Blanket', 'Winter Blanket'],
};
const BASE_PRICES: Record<ProductCategory, number[]> = {
  BEDSHEETS: [349, 399, 449, 379, 429, 469],
  PILLOWCASES: [149, 179, 169, 159, 199, 139],
  COMFORTERS: [899, 949, 1099, 999, 929, 879],
  BLANKETS: [449, 399, 549, 349, 429, 479],
};
const ID_PREFIX: Record<ProductCategory, string> = { BEDSHEETS: 'bs', PILLOWCASES: 'pc', COMFORTERS: 'cf', BLANKETS: 'bl' };
export const SKU_PREFIX: Record<ProductCategory, string> = { BEDSHEETS: 'BS', PILLOWCASES: 'PC', COMFORTERS: 'CF', BLANKETS: 'BL' };

// 6 products in every category, and every size starts with 8 to 16 pieces (never below MIN_PIECES)
export const DEFAULT_INVENTORY: InventoryItem[] = PRODUCT_CATEGORIES.flatMap((category) =>
  NAMES[category].map((name, i) => {
    const stock: Record<string, number> = {};
    SIZE_OPTIONS[category].forEach((size, j) => {
      stock[size] = MIN_PIECES + ((i * 3 + j * 5) % 9);
    });
    return {
      id: `${ID_PREFIX[category]}${i + 1}`,
      sku: `BT-${SKU_PREFIX[category]}-${String(i + 1).padStart(3, '0')}`,
      name,
      category,
      basePrice: BASE_PRICES[category][i],
      stock,
      textures: [...TEXTURE_OPTIONS],
      styles: [...STYLE_OPTIONS],
      active: true,
    };
  })
);

const INVENTORY_KEY = 'bt_inventory_v2';

export async function loadInventory(): Promise<InventoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(INVENTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return (parsed as InventoryItem[]).filter((i) => i && i.stock);
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
    // storage unavailable
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

type StockLine = { productId: string; size: string; quantity: number };

// Checks the stock of every line and, only if everything is available, deducts it (all or nothing).
export async function purchaseItems(
  lines: StockLine[]
): Promise<{ ok: boolean; message?: string; inventory: InventoryItem[] }> {
  const wanted: Record<string, number> = {};
  lines.forEach((l) => {
    const key = `${l.productId}|${l.size}`;
    wanted[key] = (wanted[key] || 0) + l.quantity;
  });

  const problem = { text: '' };
  const inventory = await mutateInventory((current) => {
    for (const key of Object.keys(wanted)) {
      const [productId, size] = key.split('|');
      const product = current.find((i) => i.id === productId);
      if (!product || !product.active || !(size in product.stock)) {
        problem.text = 'An item in your cart is no longer available.';
        return current;
      }
      if (product.stock[size] < wanted[key]) {
        problem.text = `Only ${product.stock[size]} of ${product.name} (${size}) left. Please update your cart.`;
        return current;
      }
    }
    return current.map((i) => {
      const stock = { ...i.stock };
      let changed = false;
      Object.keys(stock).forEach((size) => {
        const q = wanted[`${i.id}|${size}`];
        if (q) {
          stock[size] = Math.max(0, stock[size] - q);
          changed = true;
        }
      });
      return changed ? { ...i, stock } : i;
    });
  });

  return problem.text ? { ok: false, message: problem.text, inventory } : { ok: true, inventory };
}

// Puts pieces back into stock (used when an order is cancelled)
export function restockItems(lines: StockLine[]): Promise<InventoryItem[]> {
  return mutateInventory((items) =>
    items.map((i) => {
      const stock = { ...i.stock };
      let changed = false;
      lines.forEach((l) => {
        if (l.productId === i.id && l.size in stock) {
          stock[l.size] += l.quantity;
          changed = true;
        }
      });
      return changed ? { ...i, stock } : i;
    })
  );
}