import AsyncStorage from '@react-native-async-storage/async-storage';
import { logActivity, logStaffActivity } from './activityStore';
import { InventoryItem, loadInventory, priceFor, ProductCategory, purchaseItems, restockItems } from './inventoryStore';
// Customer accounts + online orders, shared by the customer shop (index) and the admin screen.
// Everything is stored on this device/browser with AsyncStorage. See the note about a real backend.

// ---------- formatting helpers (used by several screens) ----------
export const peso = (n: number) => '₱' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};
export const formatTime = (iso: string) => {
  const d = new Date(iso);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
};
export const formatDateTime = (iso: string) => `${formatDate(iso)}, ${formatTime(iso)}`;

// ---------- types ----------
export interface CustomerAccount {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  createdAt: string;
  salt: string;
  passwordHash: string;
}
// What the admin and the screens get to see: never the password data.
export type PublicCustomer = Omit<CustomerAccount, 'salt' | 'passwordHash'>;

export type PaymentMethod = 'Cash on Delivery' | 'GCash' | 'Maya' | 'Credit / Debit Card' | 'Bank Transfer';

export const PAYMENT_METHODS: { method: PaymentMethod; emoji: string; hint: string }[] = [
  { method: 'Cash on Delivery', emoji: '💵', hint: 'Pay in cash when your order arrives' },
  { method: 'GCash', emoji: '📱', hint: 'Scan our GCash QR code to pay' },
  { method: 'Maya', emoji: '💜', hint: 'Our staff will message you the Maya details in chat' },
  { method: 'Credit / Debit Card', emoji: '💳', hint: 'Our staff will send you a secure payment link in chat' },
  { method: 'Bank Transfer', emoji: '🏦', hint: 'Send your payment to our bank account' },
];

export type OrderStatus = 'Order placed' | 'Packed' | 'Out for delivery' | 'Delivered' | 'Cancelled';
export const ORDER_STEPS: OrderStatus[] = ['Order placed', 'Packed', 'Out for delivery', 'Delivered'];

export interface OrderLine {
  productId: string;
  name: string;
  category: ProductCategory;
  size: string;
  texture: string;
  style: string;
  price: number;
  quantity: number;
  color?: string; // only on orders made before textures and styles existed
}

export interface OnlineOrder {
  id: string; // receipt / transaction number, e.g. BT-20261011-0001
  customerId: string;
  customerName: string;
  username: string;
  email: string;
  phone: string;
  address: string;
  items: OrderLine[];
  total: number;
  payment: PaymentMethod;
  paid: boolean;
  paymentRef?: string; // reference number the customer typed after paying
  status: OrderStatus;
  placedAt: string;
  etaFrom: string; // earliest expected delivery
  etaTo: string; // latest expected delivery
  history: { status: OrderStatus; at: string }[];
}

// ---------- storage helpers ----------
const ACCOUNTS_KEY = 'bt_customers';
const SESSION_KEY = 'bt_current_customer';
const ORDERS_KEY = 'bt_orders';
const SEQ_KEY = 'bt_order_seq';

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
const writeJson = async (key: string, value: unknown) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable
  }
};

// ---------- password hashing (SHA-256 with a random salt, no extra package needed) ----------
const K: number[] = [];
const H0: number[] = [];
(() => {
  let n = 2;
  let count = 0;
  while (count < 64) {
    let isPrime = true;
    for (let i = 2; i * i <= n; i++) {
      if (n % i === 0) {
        isPrime = false;
        break;
      }
    }
    if (isPrime) {
      if (count < 8) H0[count] = (Math.pow(n, 1 / 2) % 1) * 4294967296 | 0;
      K[count] = (Math.pow(n, 1 / 3) % 1) * 4294967296 | 0;
      count++;
    }
    n++;
  }
})();

function utf8Bytes(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

const rotr = (v: number, a: number) => (v >>> a) | (v << (32 - a));

export function sha256(message: string): string {
  const bytes = utf8Bytes(message);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const hi = Math.floor(bitLen / 4294967296);
  const lo = bitLen >>> 0;
  bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255);
  bytes.push((lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);

  const h = H0.slice();
  const w: number[] = new Array(64).fill(0);
  for (let off = 0; off < bytes.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0;
    h[1] = (h[1] + b) | 0;
    h[2] = (h[2] + c) | 0;
    h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0;
    h[5] = (h[5] + f) | 0;
    h[6] = (h[6] + g) | 0;
    h[7] = (h[7] + hh) | 0;
  }
  return h.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

// ---------- customer accounts ----------
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{8,14}$/;
export const USERNAME_PATTERN = /^[A-Za-z0-9_.]{3,20}$/;

export interface RegistrationInput {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  password: string;
}
export type AuthResult = { ok: true; customer: PublicCustomer } | { ok: false; error: string };
const fail = (error: string): AuthResult => ({ ok: false, error });

const toPublic = (a: CustomerAccount): PublicCustomer => ({
  id: a.id,
  firstName: a.firstName,
  lastName: a.lastName,
  username: a.username,
  email: a.email,
  phone: a.phone,
  createdAt: a.createdAt,
});

export async function loadCustomers(): Promise<PublicCustomer[]> {
  const list = await readJson<CustomerAccount[]>(ACCOUNTS_KEY, []);
  return list.map(toPublic);
}

export async function registerCustomer(input: RegistrationInput): Promise<AuthResult> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const username = input.username.trim();
  const email = input.email.trim();
  const phone = input.phone.trim();

  if (!firstName || !lastName) return fail('Please enter your first and last name.');
  if (!USERNAME_PATTERN.test(username)) return fail('Username must be 3-20 letters, numbers, _ or .');
  if (!EMAIL_PATTERN.test(email)) return fail('Please enter a valid email address.');
  if (email.toLowerCase().endsWith('@bakerthriftshop.com')) return fail('That email domain is reserved for staff. Please use your personal email.');
  if (!PHONE_PATTERN.test(phone)) return fail('Please enter a valid phone number.');
  if (input.password.length < 8) return fail('Password must be at least 8 characters.');

  const accounts = await readJson<CustomerAccount[]>(ACCOUNTS_KEY, []);
  if (accounts.some((a) => a.username.toLowerCase() === username.toLowerCase())) return fail('That username is already taken.');
  if (accounts.some((a) => a.email.toLowerCase() === email.toLowerCase())) return fail('An account with this email already exists.');

  const salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const account: CustomerAccount = {
    id: `c${Date.now()}${Math.floor(Math.random() * 1000)}`,
    firstName,
    lastName,
    username,
    email,
    phone,
    createdAt: new Date().toISOString(),
    salt,
    passwordHash: sha256(`${salt}:${input.password}`),
  };
  await writeJson(ACCOUNTS_KEY, [account, ...accounts]);
  await AsyncStorage.setItem(SESSION_KEY, account.id);
  await logActivity('customer', username, 'Registered account', `${firstName} ${lastName} · ${email}`);
  return { ok: true, customer: toPublic(account) };
}

export async function loginCustomer(identifier: string, password: string): Promise<AuthResult> {
  const id = identifier.trim().toLowerCase();
  if (!id || !password) return fail('Enter your username (or email) and password.');
  const accounts = await readJson<CustomerAccount[]>(ACCOUNTS_KEY, []);
  const account = accounts.find((a) => a.username.toLowerCase() === id || a.email.toLowerCase() === id);
  if (!account || sha256(`${account.salt}:${password}`) !== account.passwordHash) {
    return fail('Incorrect username or password.');
  }
  await AsyncStorage.setItem(SESSION_KEY, account.id);
  await logActivity('customer', account.username, 'Logged in');
  return { ok: true, customer: toPublic(account) };
}

export async function getSessionCustomer(): Promise<PublicCustomer | null> {
  try {
    const id = await AsyncStorage.getItem(SESSION_KEY);
    if (!id) return null;
    const accounts = await readJson<CustomerAccount[]>(ACCOUNTS_KEY, []);
    const account = accounts.find((a) => a.id === id);
    return account ? toPublic(account) : null;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    // nothing to do
  }
}

// ---------- online orders ----------
export async function loadOrders(): Promise<OnlineOrder[]> {
  return readJson<OnlineOrder[]>(ORDERS_KEY, []);
}

export async function loadOrdersFor(customerId: string): Promise<OnlineOrder[]> {
  return (await loadOrders()).filter((o) => o.customerId === customerId);
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');
const addDays = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

export async function placeOrder(params: {
  customer: PublicCustomer;
  address: string;
  payment: PaymentMethod;
  paymentRef?: string;
  lines: { productId: string; size: string; texture: string; style: string; quantity: number }[];
}): Promise<{ ok: boolean; message?: string; order?: OnlineOrder; inventory?: InventoryItem[] }> {
  const address = params.address.trim();
  if (address.length < 10) return { ok: false, message: 'Please enter your complete delivery address.' };
  if (params.lines.length === 0) return { ok: false, message: 'Your cart is empty.' };

  // Every piece must be a real size, texture and style of an active product
  const catalog = await loadInventory();
  for (const l of params.lines) {
    const p = catalog.find((i) => i.id === l.productId);
    if (!p || !p.active || !(l.size in p.stock) || !p.textures.includes(l.texture) || !p.styles.includes(l.style) || l.quantity < 1) {
      return { ok: false, message: 'An item in your cart is no longer available. Please add it again.' };
    }
  }

  // Checks the stock and deducts it in one step (all or nothing)
  const result = await purchaseItems(params.lines.map((l) => ({ productId: l.productId, size: l.size, quantity: l.quantity })));
  if (!result.ok) return { ok: false, message: result.message, inventory: result.inventory };

  const items: OrderLine[] = params.lines.map((l) => {
    const p = result.inventory.find((i) => i.id === l.productId)!;
    return {
      productId: p.id,
      name: p.name,
      category: p.category,
      size: l.size,
      texture: l.texture,
      style: l.style,
      price: priceFor(p, l.size),
      quantity: l.quantity,
    };
  });

  const now = new Date();
  const placedAt = now.toISOString();
  const seq = (await readJson<number>(SEQ_KEY, 0)) + 1;
  await writeJson(SEQ_KEY, seq);

  const c = params.customer;
  const ref = (params.paymentRef || '').trim().slice(0, 40);
  const order: OnlineOrder = {
    id: `BT-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(seq, 4)}`,
    customerId: c.id,
    customerName: `${c.firstName} ${c.lastName}`,
    username: c.username,
    email: c.email,
    phone: c.phone,
    address,
    items,
    total: items.reduce((t, i) => t + i.price * i.quantity, 0),
    payment: params.payment,
    paid: false,
    ...(ref ? { paymentRef: ref } : {}),
    status: 'Order placed',
    placedAt,
    etaFrom: addDays(placedAt, 3),
    etaTo: addDays(placedAt, 5),
    history: [{ status: 'Order placed', at: placedAt }],
  };
  await writeJson(ORDERS_KEY, [order, ...(await loadOrders())]);
  await logActivity('customer', c.username, 'Placed order', `${order.id} · ${peso(order.total)} · ${order.payment}`);
  return { ok: true, order, inventory: result.inventory };
}

// Used by the admin: change the delivery status and/or mark the order as paid.
export async function updateOrder(id: string, patch: { status?: OrderStatus; paid?: boolean }): Promise<OnlineOrder[]> {
  const orders = await loadOrders();
  const target = orders.find((o) => o.id === id);
  if (!target) return orders;

  const next = orders.map((o) => {
    if (o.id !== id) return o;
    const updated: OnlineOrder = { ...o };
    if (typeof patch.paid === 'boolean') updated.paid = patch.paid;
    if (patch.status && patch.status !== o.status && o.status !== 'Cancelled') {
      updated.status = patch.status;
      updated.history = [...o.history, { status: patch.status, at: new Date().toISOString() }];
      if (patch.status === 'Delivered' && o.payment === 'Cash on Delivery') updated.paid = true;
    }
    return updated;
  });
  await writeJson(ORDERS_KEY, next);

  const after = next.find((o) => o.id === id)!;
  if (after.status !== target.status) await logStaffActivity('Order status', `${id}: ${target.status} → ${after.status}`);
  if (after.paid !== target.paid) await logStaffActivity('Payment status', `${id}: marked ${after.paid ? 'paid' : 'unpaid'}`);

  // A cancelled order puts its pieces back into stock
  if (after.status === 'Cancelled' && target.status !== 'Cancelled') {
    await restockItems(target.items.map((l) => ({ productId: l.productId, size: l.size, quantity: l.quantity })));
  }
  return next;
}

// ---------- live updates ----------
// Calls `callback` every few seconds, and right away when another browser tab changes the data.
export function subscribeToChanges(callback: () => void, intervalMs = 3000): () => void {
  const timer = setInterval(callback, intervalMs);
  const w: any = (globalThis as any).window;
  const listening = !!w && typeof w.addEventListener === 'function';
  if (listening) w.addEventListener('storage', callback);
  return () => {
    clearInterval(timer);
    if (listening) w.removeEventListener('storage', callback);
  };
}
