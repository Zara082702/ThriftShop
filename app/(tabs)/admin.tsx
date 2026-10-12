import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import OrdersPanel from '../../components/admin/OrdersPanel';
import {
  DEFAULT_INVENTORY,
  InventoryItem,
  loadInventory,
  mutateInventory,
  PRODUCT_CATEGORIES,
  ProductCategory,
} from '../../components/shop/inventoryStore';
import { loadCustomers, loadOrders, OnlineOrder, PublicCustomer, subscribeToChanges } from '../../components/shop/shopStore';
import {
  createStaff,
  getStaffSession,
  loadStaff,
  logoutStaff,
  PublicStaff,
  removeStaff as removeStaffAccount,
  setStaffActive,
  STAFF_DOMAIN,
  STAFF_EMAIL_PATTERN,
  StaffRole,
  StaffSession,
} from '../../components/shop/staffStore';

// Color palette (BakerThrift terracotta + cream)
const Colors = {
  primary: '#E2875E',
  primaryLight: '#FCEFE9',
  background: '#F9F6F3',
  surface: '#FFFFFF',
  textDark: '#1A1A1A',
  textMuted: '#8E8E93',
  border: '#EBEBEB',
  disabled: '#D1D1D6',
  danger: '#E53935',
  success: '#2E9E6B',
  successLight: '#E6F5EE',
  warning: '#E8A13A',
};

type Category = ProductCategory;
const CATEGORIES = PRODUCT_CATEGORIES;

interface CartItem {
  id: string;
  productId: string;
  name: string;
  category: Category;
  size: string;
  color: string;
  price: number;
  quantity: number;
}

interface Sale {
  id: string; // transaction id, e.g. #234198
  customer: string;
  items: CartItem[];
  total: number;
  date: string; // ISO string
  source?: 'ONLINE'; // set for online orders
  payment?: string; // payment method of online orders
}

interface Inquiry {
  id: string;
  customer: string;
  subject: string;
  message: string;
  date: string;
  replies: { text: string; date: string }[];
  resolved: boolean;
}

type AdminTool = 'customer-report' | 'inventory' | 'inquiries' | 'sales-report' | 'stocks' | 'staff-accounts' | 'orders' | null;
type SortKey = 'name' | 'stock' | 'price';

const WALK_IN = 'Walk-in Customer';
const LOW_STOCK_LIMIT = 8;
const AVATAR_COLORS = ['#E2875E', '#C9694A', '#D9A066', '#B5835A', '#9C6B4E'];

// ---------- helpers ----------
const peso = (n: number) => '₱' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};
const formatTime = (iso: string) => {
  const d = new Date(iso);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
};

const STAFF_ROLES: { role: StaffRole; emoji: string; desc: string }[] = [
  { role: 'Cashier', emoji: '🧾', desc: 'Handles sales and billing' },
  { role: 'Inventory Clerk', emoji: '📦', desc: 'Manages products and stock' },
  { role: 'Manager', emoji: '⭐', desc: 'Full access to reports' },
];
const passwordStrength = (pw: string) => {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ['Enter a password', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = [Colors.disabled, Colors.danger, Colors.warning, '#8DB255', Colors.success];
  return { score, label: labels[score], color: colors[score] };
};

const capitalize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const categoryEmoji = (c: Category) =>
  c === 'BEDSHEETS' ? '🛏️' : c === 'PILLOWCASES' ? '☁️' : c === 'COMFORTERS' ? '🧥' : '🧣';
const skuPrefix: Record<Category, string> = { BEDSHEETS: 'BS', PILLOWCASES: 'PC', COMFORTERS: 'CF', BLANKETS: 'BL' };
const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

export default function AdminPOSScreen() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuthorization, setIsCheckingAuthorization] = useState(true);
  const [session, setSession] = useState<StaffSession | null>(null);

  // --- POS states ---
  const [activeTab, setActiveTab] = useState<'ALL' | Category>('ALL');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [productSelections, setProductSelections] = useState<Record<string, { size: string; color: string; qty: number }>>({});
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [billCustomer, setBillCustomer] = useState('');
  const [receiptNo, setReceiptNo] = useState(234199);

  // --- Admin tool states ---
  const [adminTool, setAdminTool] = useState<AdminTool>(null);
  const [staffName, setStaffName] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState<StaffRole>('Cashier');
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [staffSubmitted, setStaffSubmitted] = useState(false);
  const [staffError, setStaffError] = useState('');

  // Sales report
  const [salesQuery, setSalesQuery] = useState('');

  // Stocks / inventory table
  const [stockQuery, setStockQuery] = useState('');
  const [stockCategory, setStockCategory] = useState<'ALL' | Category>('ALL');
  const [stockSort, setStockSort] = useState<SortKey>('name');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newStock, setNewStock] = useState('');
  const [newCategory, setNewCategory] = useState<Category>('BEDSHEETS');

  // Inquiries
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [inquiries, setInquiries] = useState<Inquiry[]>([
    {
      id: 'q1',
      customer: 'Maria S.',
      subject: 'Delivery question',
      message: 'Do you deliver Queen-size bedsheets in Manila?',
      date: '2026-10-10T09:15:00',
      replies: [],
      resolved: false,
    },
    {
      id: 'q2',
      customer: 'Jerome D.',
      subject: 'Restock inquiry',
      message: 'Is the Golden Edge Luxury Cover coming back in stock soon?',
      date: '2026-10-10T14:40:00',
      replies: [],
      resolved: false,
    },
    {
      id: 'q3',
      customer: 'Aileen R.',
      subject: 'Payment options',
      message: 'Do you accept GCash for in-store purchases?',
      date: '2026-10-09T16:05:00',
      replies: [{ text: 'Hi Aileen! Yes, we accept GCash and cash in-store.', date: '2026-10-09T17:00:00' }],
      resolved: true,
    },
  ]);

  // Toast (Alert.alert does not show on web, so we use our own banner)
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  };

  // --- Only a signed-in admin or staff member may be here. Checked every time this screen is shown. ---
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const role = await AsyncStorage.getItem('userRole');
        const staff = await getStaffSession();
        if (!active) return;
        if (role === 'employee' && staff) {
          setSession(staff);
          setIsAuthorized(true);
        } else {
          setSession(null);
          setIsAuthorized(false);
          router.replace('/');
        }
        setIsCheckingAuthorization(false);
      })();
      return () => {
        active = false;
      };
    }, [router])
  );

  const handleLogout = async () => {
    await logoutStaff();
    setIsAuthorized(false);
    setSession(null);
    router.replace('/');
  };

  // Shared data: stock, online orders, registered customers and staff. Refreshed every few seconds,
  // so new orders from the customer page show up here live.
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(DEFAULT_INVENTORY);
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrder[]>([]);
  const [customers, setCustomers] = useState<PublicCustomer[]>([]);
  const [staffList, setStaffList] = useState<PublicStaff[]>([]);
  const knownOrderIds = useRef<string[] | null>(null);

  const refreshShared = useCallback(async () => {
    const [items, orders, people, team] = await Promise.all([loadInventory(), loadOrders(), loadCustomers(), loadStaff()]);
    setInventoryItems(items);
    setOnlineOrders(orders);
    setCustomers(people);
    setStaffList(team);
    const known = knownOrderIds.current;
    knownOrderIds.current = orders.map((o) => o.id);
    if (known) {
      const fresh = orders.filter((o) => !known.includes(o.id));
      if (fresh.length > 0) showToast(`New order ${fresh[0].id} from ${fresh[0].customerName}!`);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshShared();
      return subscribeToChanges(refreshShared, 3000);
    }, [refreshShared])
  );

  // Stock changes: read the latest stock, apply the change, save it, then show it
  const changeInventory = (change: (items: InventoryItem[]) => InventoryItem[]) =>
    mutateInventory(change).then(setInventoryItems);

  // Sales history (newest first). New transactions are added when you press "Process Transaction".
  const [posSales, setSales] = useState<Sale[]>([
    {
      id: '#234198', customer: 'Maria S.', total: 120.5, date: '2026-10-10T15:42:00',
      items: [
        { id: 's1', productId: 'b1', name: 'Premium Cotton Sheet', category: 'BEDSHEETS', size: 'L', color: 'Pure White', price: 48.0, quantity: 2 },
        { id: 's2', productId: 'p1', name: 'Sateen Pillowcase Set', category: 'PILLOWCASES', size: 'M', color: 'Cream', price: 24.5, quantity: 1 },
      ],
    },
    {
      id: '#234197', customer: 'Carlo B.', total: 85.0, date: '2026-10-10T11:08:00',
      items: [{ id: 's3', productId: 'c1', name: 'Weighted Cloud Comforter', category: 'COMFORTERS', size: 'M', color: 'Beige', price: 85.0, quantity: 1 }],
    },
    {
      id: '#234196', customer: WALK_IN, total: 65.6, date: '2026-10-09T17:25:00',
      items: [{ id: 's4', productId: 'bl1', name: 'Oversized Knit Throw Blanket', category: 'BLANKETS', size: 'M', color: 'Mocha', price: 32.8, quantity: 2 }],
    },
    {
      id: '#234195', customer: 'Aileen R.', total: 154.0, date: '2026-10-09T13:10:00',
      items: [
        { id: 's5', productId: 'b2', name: 'Terracotta Fitted Sheet', category: 'BEDSHEETS', size: 'M', color: 'Terracotta', price: 52.5, quantity: 2 },
        { id: 's6', productId: 'p1', name: 'Sateen Pillowcase Set', category: 'PILLOWCASES', size: 'S', color: 'Coffee', price: 24.5, quantity: 2 },
      ],
    },
    {
      id: '#234194', customer: 'Maria S.', total: 48.0, date: '2026-10-08T10:30:00',
      items: [{ id: 's8', productId: 'b1', name: 'Premium Cotton Sheet', category: 'BEDSHEETS', size: 'M', color: 'Earth Brown', price: 48.0, quantity: 1 }],
    },
  ]);

  useEffect(() => {
    initializeSelections();
  }, []);

  const initializeSelections = () => {
    const initial: Record<string, { size: string; color: string; qty: number }> = {};
    inventoryItems.forEach((item) => {
      initial[item.id] = { size: 'M', color: item.colors[0], qty: 1 };
    });
    setProductSelections(initial);
  };

  const getSelection = (item: InventoryItem) =>
    productSelections[item.id] || { size: 'M', color: item.colors[0], qty: 1 };

  // ---------- POS actions ----------
  const updateCardQty = (item: InventoryItem, delta: number) => {
    setProductSelections((prev) => {
      const current = prev[item.id] || { size: 'M', color: item.colors[0], qty: 1 };
      const nextQty = Math.min(Math.max(1, current.qty + delta), Math.max(1, item.available));
      return { ...prev, [item.id]: { ...current, qty: nextQty } };
    });
  };

  const updateCardSize = (item: InventoryItem, size: string) => {
    setProductSelections((prev) => {
      const current = prev[item.id] || { size: 'M', color: item.colors[0], qty: 1 };
      return { ...prev, [item.id]: { ...current, size } };
    });
  };

  const handleAddToBilling = (item: InventoryItem) => {
    const selection = getSelection(item);
    const inCart = cartItems.filter((c) => c.productId === item.id).reduce((t, c) => t + c.quantity, 0);
    if (inCart + selection.qty > item.available) {
      showToast(`Only ${item.available} of ${item.name} in stock.`);
      return;
    }
    const uniqueId = `${item.id}-${selection.size}-${selection.color}`;

    setCartItems((prev) => {
      const exists = prev.find((i) => i.id === uniqueId);
      if (exists) {
        return prev.map((i) => (i.id === uniqueId ? { ...i, quantity: i.quantity + selection.qty } : i));
      }
      return [
        ...prev,
        {
          id: uniqueId,
          productId: item.id,
          name: item.name,
          category: item.category,
          size: selection.size,
          color: selection.color,
          price: item.basePrice,
          quantity: selection.qty,
        },
      ];
    });
    showToast(`Added ${selection.qty}x ${item.name} to Bill Details.`);
  };

  const handleRemoveFromBilling = (uniqueId: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== uniqueId));
  };

  const calculateTotal = () => cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const processTransaction = () => {
    if (cartItems.length === 0) {
      showToast('Add at least one item to the bill first.');
      return;
    }
    const sale: Sale = {
      id: `#${receiptNo}`,
      customer: billCustomer.trim() || WALK_IN,
      items: cartItems,
      total: calculateTotal(),
      date: new Date().toISOString(),
    };
    setSales((prev) => [sale, ...prev]);
    // Deduct sold quantities from stock
    changeInventory((items) =>
      items.map((it) => {
        const sold = cartItems.filter((c) => c.productId === it.id).reduce((t, c) => t + c.quantity, 0);
        return sold ? { ...it, available: Math.max(0, it.available - sold) } : it;
      })
    );
    setReceiptNo((n) => n + 1);
    setCartItems([]);
    setBillCustomer('');
    showToast(`Transaction ${sale.id} processed!`);
  };

  // ---------- Stock actions ----------
  const updateStock = (id: string, change: number) => {
    changeInventory((items) =>
      items.map((item) => (item.id === id ? { ...item, available: Math.max(0, item.available + change) } : item))
    );
  };

  const toggleActive = (id: string) => {
    changeInventory((items) => items.map((item) => (item.id === id ? { ...item, active: !item.active } : item)));
  };

  const deleteProducts = (ids: string[]) => {
    changeInventory((items) => items.filter((item) => !ids.includes(item.id)));
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    showToast(ids.length === 1 ? 'Product removed.' : `${ids.length} products removed.`);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const addProduct = () => {
    const price = parseFloat(newPrice);
    const stock = parseInt(newStock, 10);
    if (!newName.trim() || isNaN(price) || price <= 0 || isNaN(stock) || stock < 0) {
      showToast('Enter a product name, a price above 0, and a stock count.');
      return;
    }
    const count = inventoryItems.filter((i) => i.category === newCategory).length + 1;
    const item: InventoryItem = {
      id: `n${Date.now()}`,
      sku: `BT-${skuPrefix[newCategory]}-${String(count).padStart(3, '0')}`,
      name: newName.trim(),
      category: newCategory,
      basePrice: price,
      available: stock,
      colors: ['Assorted'],
      sizes: ['S', 'M', 'L'],
      active: true,
      isNew: true,
    };
    changeInventory((prev) => [item, ...prev]);
    setProductSelections((prev) => ({ ...prev, [item.id]: { size: 'M', color: 'Assorted', qty: 1 } }));
    setNewName('');
    setNewPrice('');
    setNewStock('');
    setShowAddForm(false);
    showToast(`${item.name} added to inventory.`);
  };

  // ---------- Inquiry actions ----------
  const sendReply = (id: string) => {
    const text = (replyDrafts[id] || '').trim();
    if (!text) {
      showToast('Type a reply before sending.');
      return;
    }
    setInquiries((items) =>
      items.map((q) => (q.id === id ? { ...q, replies: [...q.replies, { text, date: new Date().toISOString() }] } : q))
    );
    setReplyDrafts((prev) => ({ ...prev, [id]: '' }));
    showToast('Reply sent.');
  };

  const toggleResolved = (id: string) => {
    setInquiries((items) => items.map((q) => (q.id === id ? { ...q, resolved: !q.resolved } : q)));
  };

  // ---------- Staff (owner only) ----------
  const createStaffAccount = async () => {
    setStaffSubmitted(true);
    setStaffError('');
    const email = staffEmail.trim().toLowerCase();
    const valid =
      staffName.trim().length >= 2 &&
      STAFF_EMAIL_PATTERN.test(email) &&
      !staffList.some((m) => m.email === email) &&
      staffPassword.length >= 8;
    if (!valid) {
      showToast('Please fix the highlighted fields.');
      return;
    }
    const role = staffRole;
    const result = await createStaff({ name: staffName, email, password: staffPassword, role });
    if (!result.ok) {
      setStaffError(result.error);
      return;
    }
    setStaffName('');
    setStaffPassword('');
    setStaffEmail('');
    setStaffRole('Cashier');
    setShowStaffPassword(false);
    setStaffSubmitted(false);
    await refreshShared();
    showToast(`${result.staff.name} was added as ${role}.`);
  };

  const toggleStaffActive = async (member: PublicStaff) => {
    await setStaffActive(member.id, !member.active);
    await refreshShared();
  };

  const removeStaff = async (id: string) => {
    await removeStaffAccount(id);
    await refreshShared();
    showToast('Staff account removed.');
  };

  // ---------- Export (opens the share sheet where supported) ----------
  const exportCsv = async (title: string, rows: (string | number)[][]) => {
    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
    try {
      await Share.share({ title, message: csv });
    } catch {
      showToast('Export is not supported on this device or browser.');
    }
  };

  const exportSales = () =>
    exportCsv('Sales Report', [
      ['Transaction ID', 'Customer', 'Items', 'Amount', 'Date', 'Time'],
      ...filteredSales.map((s) => [
        s.id,
        s.customer,
        s.items.map((i) => `${i.quantity}x ${i.name} (${i.size}, ${i.color})`).join(' | '),
        s.total.toFixed(2),
        formatDate(s.date),
        formatTime(s.date),
      ]),
    ]);

  const exportStocks = () =>
    exportCsv('Stocks', [
      ['Product', 'Category', 'SKU', 'Stock', 'Price', 'Status'],
      ...visibleStock.map((i) => [i.name, capitalize(i.category), i.sku, i.available, i.basePrice.toFixed(2), i.active ? 'Active' : 'Inactive']),
    ]);

  // ---------- Derived data ----------
  // POS sales + online orders in one list (cancelled online orders are left out)
  const onlineAsSales: Sale[] = onlineOrders
    .filter((o) => o.status !== 'Cancelled')
    .map((o) => ({
      id: o.id,
      customer: o.customerName,
      total: o.total,
      date: o.placedAt,
      source: 'ONLINE' as const,
      payment: o.payment,
      items: o.items.map((l, i) => ({
        id: `${o.id}-${i}`,
        productId: l.productId,
        name: l.name,
        category: l.category,
        size: l.size,
        color: l.color,
        price: l.price,
        quantity: l.quantity,
      })),
    }));
  const sales: Sale[] = [...onlineAsSales, ...posSales].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const pendingOrders = onlineOrders.filter((o) => o.status === 'Order placed').length;

  const filteredItems = inventoryItems
    .filter((item) => item.active)
    .filter((item) => activeTab === 'ALL' || item.category === activeTab)
    .filter((item) => item.name.toLowerCase().includes(catalogQuery.trim().toLowerCase()));

  const totalStock = inventoryItems.reduce((total, item) => total + item.available, 0);

  const visibleStock = inventoryItems
    .filter((i) => stockCategory === 'ALL' || i.category === stockCategory)
    .filter((i) => (i.name + i.sku).toLowerCase().includes(stockQuery.trim().toLowerCase()))
    .sort((a, b) =>
      stockSort === 'name' ? a.name.localeCompare(b.name) : stockSort === 'stock' ? a.available - b.available : a.basePrice - b.basePrice
    );
  const allVisibleSelected = visibleStock.length > 0 && visibleStock.every((i) => selectedIds.includes(i.id));

  const filteredSales = sales.filter((s) => (s.customer + s.id).toLowerCase().includes(salesQuery.trim().toLowerCase()));
  const totalSales = sales.reduce((t, s) => t + s.total, 0);
  const totalItemsSold = sales.reduce((t, s) => t + s.items.reduce((n, i) => n + i.quantity, 0), 0);
  const avgOrder = sales.length ? totalSales / sales.length : 0;

  // Customer report data (built from the sales list)
  const customerMap: Record<string, { orders: number; spent: number; last: string }> = {};
  sales.forEach((s) => {
    if (s.customer === WALK_IN) return;
    const c = customerMap[s.customer] || { orders: 0, spent: 0, last: s.date };
    c.orders += 1;
    c.spent += s.total;
    if (new Date(s.date) > new Date(c.last)) c.last = s.date;
    customerMap[s.customer] = c;
  });
  const topCustomers = Object.entries(customerMap)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);
  const topSpent = topCustomers.length ? topCustomers[0].spent : 1;
  const repeatCustomers = Object.values(customerMap).filter((c) => c.orders >= 2).length;

  const categoryRevenue: Record<Category, number> = { BEDSHEETS: 0, PILLOWCASES: 0, COMFORTERS: 0, BLANKETS: 0 };
  sales.forEach((s) => s.items.forEach((i) => (categoryRevenue[i.category] += i.price * i.quantity)));
  const categoryTotal = CATEGORIES.reduce((t, c) => t + categoryRevenue[c], 0) || 1;
  const topCategory = [...CATEGORIES].sort((a, b) => categoryRevenue[b] - categoryRevenue[a])[0];

  const adminToolTitle: Record<Exclude<AdminTool, null>, string> = {
    'customer-report': 'Customer Report',
    inventory: 'Inventory',
    inquiries: 'Customer Inquiries',
    'sales-report': 'Sales Report',
    stocks: 'Stocks',
    orders: 'Online Orders',
    'staff-accounts': 'Create Staff Account',
  };

  const closeTool = () => {
    setAdminTool(null);
    setShowAddForm(false);
  };

  if (isCheckingAuthorization || !isAuthorized) {
    return null;
  }

  const toastEl = toast ? (
    <View style={styles.toast} pointerEvents="none">
      <Text style={styles.toastText}>{toast}</Text>
    </View>
  ) : null;

  const panelStyle =
    adminTool === 'sales-report' || adminTool === 'inventory' || adminTool === 'stocks' || adminTool === 'orders'
      ? styles.toolPanelWide
      : adminTool === 'customer-report' || adminTool === 'inquiries' || adminTool === 'staff-accounts'
      ? styles.toolPanelMid
      : null;

  // ================= TOOL: CUSTOMER REPORT =================
  const renderCustomerReport = () => (
    <View>
      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>👥</Text>
          <Text style={styles.statValue}>{customers.length}</Text>
          <Text style={styles.statLabel}>Registered customers</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>🔁</Text>
          <Text style={styles.statValue}>{repeatCustomers}</Text>
          <Text style={styles.statLabel}>Repeat customers</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>🛍️</Text>
          <Text style={styles.statValue}>{Object.keys(customerMap).length}</Text>
          <Text style={styles.statLabel}>Named buyers on record</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>🧾</Text>
          <Text style={styles.statValue}>{peso(avgOrder)}</Text>
          <Text style={styles.statLabel}>Average order value</Text>
        </View>
      </View>

      <View style={styles.highlightBox}>
        <Text style={styles.highlightEmoji}>{categoryEmoji(topCategory)}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.highlightLabel}>Most purchased category</Text>
          <Text style={styles.highlightValue}>{capitalize(topCategory)}</Text>
        </View>
        <Text style={styles.highlightPct}>{Math.round((categoryRevenue[topCategory] / categoryTotal) * 100)}% of sales</Text>
      </View>

      <Text style={styles.sectionTitle}>Top customers</Text>
      {topCustomers.length === 0 ? (
        <Text style={styles.toolText}>No named customers yet. Add a customer name when you process a transaction.</Text>
      ) : (
        topCustomers.map((c, idx) => (
          <View key={c.name} style={styles.customerRow}>
            <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }]}>
              <Text style={styles.avatarText}>{c.name.charAt(0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.customerTop}>
                <Text style={styles.customerName}>{c.name}</Text>
                <Text style={styles.customerSpent}>{peso(c.spent)}</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.max(6, (c.spent / topSpent) * 100)}%` as `${number}%` }]} />
              </View>
              <Text style={styles.customerMeta}>
                {c.orders} {c.orders === 1 ? 'order' : 'orders'} · last purchase {formatDate(c.last)}
              </Text>
            </View>
          </View>
        ))
      )}

      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Sales by category</Text>
      {CATEGORIES.map((cat) => {
        const pct = Math.round((categoryRevenue[cat] / categoryTotal) * 100);
        return (
          <View key={cat} style={styles.categoryRow}>
            <Text style={styles.categoryRowLabel}>
              {categoryEmoji(cat)} {capitalize(cat)}
            </Text>
            <View style={[styles.barTrack, { flex: 1, marginHorizontal: 12 }]}>
              <View style={[styles.barFill, { width: `${pct}%` as `${number}%` }]} />
            </View>
            <Text style={styles.categoryRowPct}>{pct}%</Text>
          </View>
        );
      })}
    </View>
  );

  // ================= TOOL: INQUIRIES =================
  const renderInquiries = () => {
    const openCount = inquiries.filter((q) => !q.resolved).length;
    return (
      <View>
        <Text style={styles.toolText}>
          {openCount} open · {inquiries.length - openCount} resolved
        </Text>
        {inquiries.map((q, idx) => (
          <View key={q.id} style={styles.inquiryCard}>
            <View style={styles.inquiryHeader}>
              <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }]}>
                <Text style={styles.avatarText}>{q.customer.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inquiryTitle}>{q.subject} from {q.customer}</Text>
                <Text style={styles.inquiryDate}>{formatDate(q.date)} · {formatTime(q.date)}</Text>
              </View>
              <View style={[styles.pill, q.resolved ? styles.pillGreen : styles.pillOrange]}>
                <Text style={[styles.pillText, { color: q.resolved ? Colors.success : Colors.primary }]}>
                  {q.resolved ? 'Resolved' : 'Open'}
                </Text>
              </View>
            </View>

            <View style={styles.customerBubble}>
              <Text style={styles.bubbleText}>"{q.message}"</Text>
            </View>

            {q.replies.map((r, i) => (
              <View key={i} style={styles.staffBubble}>
                <Text style={styles.staffBubbleText}>{r.text}</Text>
                <Text style={styles.staffBubbleMeta}>You · {formatDate(r.date)}, {formatTime(r.date)}</Text>
              </View>
            ))}

            <TextInput
              value={replyDrafts[q.id] || ''}
              onChangeText={(t) => setReplyDrafts((prev) => ({ ...prev, [q.id]: t }))}
              placeholder={`Write a reply to ${q.customer}...`}
              placeholderTextColor={Colors.textMuted}
              multiline
              style={styles.replyInput}
            />
            <View style={styles.inquiryActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => toggleResolved(q.id)}>
                <Text style={styles.secondaryBtnText}>{q.resolved ? 'Reopen' : 'Mark as resolved'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => sendReply(q.id)}>
                <Text style={styles.primaryBtnText}>Send reply</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    );
  };

  // ================= TOOL: SALES REPORT =================
  const renderSalesReport = () => (
    <View>
      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{peso(totalSales)}</Text>
          <Text style={styles.statLabel}>Total sales</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{sales.length}</Text>
          <Text style={styles.statLabel}>Transactions</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalItemsSold}</Text>
          <Text style={styles.statLabel}>Items sold</Text>
        </View>
      </View>

      <View style={styles.tableToolbar}>
        <View style={styles.toolbarSearch}>
          <TextInput
            value={salesQuery}
            onChangeText={setSalesQuery}
            placeholder="Search customer or transaction ID..."
            placeholderTextColor={Colors.textMuted}
            style={styles.toolbarSearchInput}
          />
        </View>
        <Text style={styles.countText}>{filteredSales.length} transactions</Text>
        <TouchableOpacity style={styles.exportBtn} onPress={exportSales}>
          <Text style={styles.exportBtnText}>⬇ Export</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.tableWrap}>
          <View style={styles.tableHeadRow}>
            <Text style={[styles.th, { flex: 1.1 }]}>Transaction ID</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>Customer</Text>
            <Text style={[styles.th, { flex: 3 }]}>Items bought</Text>
            <Text style={[styles.th, { flex: 1 }]}>Amount</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>Date & time</Text>
            <Text style={[styles.th, { flex: 0.8 }]}>Status</Text>
          </View>

          {filteredSales.length === 0 ? (
            <Text style={styles.emptyTable}>No transactions match your search.</Text>
          ) : (
            filteredSales.map((s) => (
              <View key={s.id} style={styles.tableRow}>
                <View style={{ flex: 1.1, paddingRight: 8 }}>
                  <Text style={styles.tdId}>{s.id}</Text>
                  <Text style={styles.saleItemSub}>{s.source === 'ONLINE' ? `Online · ${s.payment}` : 'In-store POS'}</Text>
                </View>
                <View style={{ flex: 1.2, paddingRight: 8 }}>
                  <Text style={styles.tdBold}>{s.customer}</Text>
                </View>
                <View style={{ flex: 3, paddingRight: 12 }}>
                  {s.items.map((i) => (
                    <View key={i.id} style={styles.saleItemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.saleItemName}>{i.quantity}× {i.name}</Text>
                        <Text style={styles.saleItemSub}>Size {i.size} · {i.color}</Text>
                      </View>
                      <Text style={styles.saleItemPrice}>{peso(i.price * i.quantity)}</Text>
                    </View>
                  ))}
                </View>
                <Text style={[styles.tdAmount, { flex: 1 }]}>{peso(s.total)}</Text>
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.tdBold}>{formatDate(s.date)}</Text>
                  <Text style={styles.saleItemSub}>{formatTime(s.date)}</Text>
                </View>
                <View style={{ flex: 0.8, alignItems: 'flex-start' }}>
                  <View style={[styles.pill, styles.pillGreen]}>
                    <Text style={[styles.pillText, { color: Colors.success }]}>Paid</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );

  // ================= TOOL: STOCKS / INVENTORY =================
  const renderStockTable = (subtitle: string) => (
    <View>
      <Text style={styles.toolSubtitle}>{subtitle}</Text>

      <View style={styles.tableToolbar}>
        <View style={styles.toolbarSearch}>
          <TextInput
            value={stockQuery}
            onChangeText={setStockQuery}
            placeholder="Search name or SKU..."
            placeholderTextColor={Colors.textMuted}
            style={styles.toolbarSearchInput}
          />
        </View>
        <TouchableOpacity
          style={styles.sortPill}
          onPress={() => setStockSort((s) => (s === 'name' ? 'stock' : s === 'stock' ? 'price' : 'name'))}
        >
          <Text style={styles.sortPillText}>Sort: {capitalize(stockSort)} ▾</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportBtn} onPress={exportStocks}>
          <Text style={styles.exportBtnText}>⬇ Export</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addProductBtn} onPress={() => setShowAddForm((v) => !v)}>
          <Text style={styles.addProductBtnText}>{showAddForm ? '× Close' : '+ Add product'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, flexGrow: 0 }}>
        {(['ALL', ...CATEGORIES] as const).map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.filterChip, stockCategory === c && styles.filterChipActive]}
            onPress={() => setStockCategory(c)}
          >
            <Text style={[styles.filterChipText, stockCategory === c && styles.filterChipTextActive]}>
              {c === 'ALL' ? 'All categories' : capitalize(c)}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={[styles.countText, { alignSelf: 'center', marginLeft: 8 }]}>{visibleStock.length} products</Text>
      </ScrollView>

      {showAddForm && (
        <View style={styles.addForm}>
          <Text style={styles.sectionTitle}>New product</Text>
          <TextInput value={newName} onChangeText={setNewName} placeholder="Product name" placeholderTextColor={Colors.textMuted} style={styles.toolInput} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput value={newPrice} onChangeText={setNewPrice} placeholder="Price (₱)" keyboardType="numeric" placeholderTextColor={Colors.textMuted} style={[styles.toolInput, { flex: 1 }]} />
            <TextInput value={newStock} onChangeText={setNewStock} placeholder="Stock" keyboardType="numeric" placeholderTextColor={Colors.textMuted} style={[styles.toolInput, { flex: 1 }]} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity key={c} style={[styles.filterChip, newCategory === c && styles.filterChipActive]} onPress={() => setNewCategory(c)}>
                <Text style={[styles.filterChipText, newCategory === c && styles.filterChipTextActive]}>{capitalize(c)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.toolAction} onPress={addProduct}>
            <Text style={styles.toolActionText}>Save product</Text>
          </TouchableOpacity>
        </View>
      )}

      {selectedIds.length > 0 && (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionText}>{selectedIds.length} selected</Text>
          <TouchableOpacity onPress={() => deleteProducts(selectedIds)}>
            <Text style={styles.selectionDelete}>Remove selected</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.tableWrap}>
          <View style={styles.tableHeadRow}>
            <TouchableOpacity
              style={[styles.checkbox, allVisibleSelected && styles.checkboxOn, { marginRight: 14 }]}
              onPress={() =>
                setSelectedIds(allVisibleSelected ? selectedIds.filter((id) => !visibleStock.some((v) => v.id === id)) : Array.from(new Set([...selectedIds, ...visibleStock.map((v) => v.id)])))
              }
            >
              {allVisibleSelected && <Text style={styles.checkMark}>✓</Text>}
            </TouchableOpacity>
            <Text style={[styles.th, { flex: 2.6 }]}>Product</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>Category</Text>
            <Text style={[styles.th, { flex: 1.2 }]}>SKU</Text>
            <Text style={[styles.th, { flex: 1.5 }]}>Stock</Text>
            <Text style={[styles.th, { flex: 1 }]}>Price</Text>
            <Text style={[styles.th, { flex: 0.9 }]}>Status</Text>
            <View style={{ width: 36 }} />
          </View>

          {visibleStock.length === 0 ? (
            <Text style={styles.emptyTable}>No products found. Try another search or add a new product.</Text>
          ) : (
            visibleStock.map((item) => {
              const stockColor = item.available === 0 ? Colors.danger : item.available <= LOW_STOCK_LIMIT ? Colors.warning : Colors.textDark;
              const checked = selectedIds.includes(item.id);
              return (
                <View key={item.id} style={[styles.tableRow, { alignItems: 'center' }, !item.active && { opacity: 0.55 }]}>
                  <TouchableOpacity style={[styles.checkbox, checked && styles.checkboxOn, { marginRight: 14 }]} onPress={() => toggleSelected(item.id)}>
                    {checked && <Text style={styles.checkMark}>✓</Text>}
                  </TouchableOpacity>

                  <View style={{ flex: 2.6, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.thumb}>
                      <Text style={{ fontSize: 22 }}>{categoryEmoji(item.category)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.stockName} numberOfLines={1}>{item.name}</Text>
                        {item.isNew && (
                          <View style={styles.newBadge}>
                            <Text style={styles.newBadgeText}>NEW</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.saleItemSub}>{item.colors.join(', ')}</Text>
                    </View>
                  </View>

                  <Text style={[styles.td, { flex: 1.2 }]}>{capitalize(item.category)}</Text>
                  <Text style={[styles.tdMuted, { flex: 1.2 }]}>{item.sku}</Text>

                  <View style={[styles.stockControls, { flex: 1.5 }]}>
                    <TouchableOpacity style={styles.stockButton} onPress={() => updateStock(item.id, -1)}>
                      <Text style={styles.stockButtonText}>−</Text>
                    </TouchableOpacity>
                    <Text style={[styles.stockValue, { color: stockColor }]}>{item.available}</Text>
                    <TouchableOpacity style={styles.stockButton} onPress={() => updateStock(item.id, 1)}>
                      <Text style={styles.stockButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.tdBold, { flex: 1 }]}>{peso(item.basePrice)}</Text>

                  <View style={{ flex: 0.9, alignItems: 'flex-start' }}>
                    <Switch
                      value={item.active}
                      onValueChange={() => toggleActive(item.id)}
                      trackColor={{ false: Colors.disabled, true: Colors.success }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  <TouchableOpacity style={{ width: 36, alignItems: 'center' }} onPress={() => deleteProducts([item.id])}>
                    <Text style={{ fontSize: 15 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <Text style={styles.stockTotal}>Total available units: {totalStock}</Text>
    </View>
  );

  // ================= TOOL: STAFF ACCOUNTS (owner only) =================
  const renderStaffAccounts = () => {
    const email = staffEmail.trim().toLowerCase();
    const strength = passwordStrength(staffPassword);
    const nameError = staffSubmitted && staffName.trim().length < 2 ? 'Enter the full name of the staff member.' : '';
    const emailError = !staffSubmitted
      ? ''
      : !STAFF_EMAIL_PATTERN.test(email)
      ? `Use a work email that ends in ${STAFF_DOMAIN}.`
      : staffList.some((m) => m.email === email)
      ? 'This email already has an account.'
      : '';
    const passError = staffSubmitted && staffPassword.length < 8 ? 'Password must be at least 8 characters.' : '';
    const activeCount = staffList.filter((m) => m.active).length;
    const checks: [string, boolean][] = [
      ['At least 8 characters', staffPassword.length >= 8],
      ['Upper and lowercase letters', /[a-z]/.test(staffPassword) && /[A-Z]/.test(staffPassword)],
      ['A number or symbol', /\d/.test(staffPassword) || /[^A-Za-z0-9]/.test(staffPassword)],
    ];
    const previewRole = STAFF_ROLES.find((r) => r.role === staffRole)!;

    return (
      <View>
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>👥</Text>
            <Text style={styles.statValue}>{staffList.length}</Text>
            <Text style={styles.statLabel}>Staff accounts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>✅</Text>
            <Text style={styles.statValue}>{activeCount}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>⏸️</Text>
            <Text style={styles.statValue}>{staffList.length - activeCount}</Text>
            <Text style={styles.statLabel}>Disabled</Text>
          </View>
        </View>

        <View style={styles.staffColumns}>
          {/* ---------- New account form ---------- */}
          <View style={styles.staffFormCard}>
            <View style={styles.staffPreview}>
              <View style={[styles.avatarLarge, { backgroundColor: staffName.trim() ? Colors.primary : Colors.disabled }]}>
                <Text style={styles.avatarLargeText}>{staffName.trim() ? staffName.trim().charAt(0).toUpperCase() : '👤'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.staffPreviewName} numberOfLines={1}>{staffName.trim() || 'New staff member'}</Text>
                <Text style={styles.staffPreviewRole}>{previewRole.emoji} {staffRole}</Text>
              </View>
            </View>

            <Text style={styles.staffNote}>Staff emails must end in {STAFF_DOMAIN}. Only the owner can create staff accounts.</Text>

            <Text style={styles.fieldLabel}>Full name</Text>
            <TextInput
              value={staffName}
              onChangeText={setStaffName}
              placeholder="e.g. Maria Dela Cruz"
              placeholderTextColor={Colors.textMuted}
              style={[styles.fieldInput, !!nameError && styles.fieldInputError]}
            />
            {!!nameError && <Text style={styles.errorText}>{nameError}</Text>}

            <Text style={styles.fieldLabel}>Work email</Text>
            <TextInput
              value={staffEmail}
              onChangeText={setStaffEmail}
              placeholder={`name${STAFF_DOMAIN}`}
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={[styles.fieldInput, !!emailError && styles.fieldInputError]}
            />
            {!!emailError && <Text style={styles.errorText}>{emailError}</Text>}

            <Text style={styles.fieldLabel}>Password</Text>
            <View style={[styles.passwordWrap, !!passError && styles.fieldInputError]}>
              <TextInput
                value={staffPassword}
                onChangeText={setStaffPassword}
                placeholder="Create a password"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showStaffPassword}
                autoCapitalize="none"
                style={styles.passwordInput}
              />
              <TouchableOpacity onPress={() => setShowStaffPassword((v) => !v)}>
                <Text style={styles.showBtnText}>{showStaffPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            {!!passError && <Text style={styles.errorText}>{passError}</Text>}

            <View style={styles.strengthRow}>
              {[1, 2, 3, 4].map((n) => (
                <View key={n} style={[styles.strengthSeg, { backgroundColor: n <= strength.score ? strength.color : Colors.border }]} />
              ))}
              <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
            </View>
            {checks.map(([label, ok]) => (
              <Text key={label} style={[styles.checkText, ok && { color: Colors.success }]}>
                {ok ? '✓' : '○'} {label}
              </Text>
            ))}

            <Text style={styles.fieldLabel}>Role</Text>
            <View style={styles.roleRow}>
              {STAFF_ROLES.map((r) => (
                <TouchableOpacity
                  key={r.role}
                  style={[styles.roleCard, staffRole === r.role && styles.roleCardActive]}
                  onPress={() => setStaffRole(r.role)}
                >
                  <Text style={styles.roleEmoji}>{r.emoji}</Text>
                  <Text style={[styles.roleTitle, staffRole === r.role && { color: Colors.primary }]}>{r.role}</Text>
                  <Text style={styles.roleDesc}>{r.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {!!staffError && <Text style={[styles.errorText, { marginTop: 14, fontSize: 12 }]}>{staffError}</Text>}

            <TouchableOpacity style={styles.createStaffBtn} onPress={createStaffAccount}>
              <Text style={styles.createStaffBtnText}>Create staff account</Text>
            </TouchableOpacity>
          </View>

          {/* ---------- Existing staff ---------- */}
          <View style={styles.staffListCol}>
            <Text style={styles.sectionTitle}>Your team</Text>
            {staffList.length === 0 ? (
              <Text style={styles.toolText}>No staff accounts yet. Create the first one using the form.</Text>
            ) : (
              staffList.map((m, idx) => (
                <View key={m.id} style={[styles.staffCard, !m.active && { opacity: 0.55 }]}>
                  <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }]}>
                    <Text style={styles.avatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.staffName} numberOfLines={1}>{m.name}</Text>
                    <Text style={styles.staffEmail} numberOfLines={1}>{m.email}</Text>
                    <View style={styles.staffMetaRow}>
                      <View style={[styles.pill, styles.pillOrange]}>
                        <Text style={[styles.pillText, { color: Colors.primary }]}>{m.role}</Text>
                      </View>
                      <Text style={styles.staffAdded}>Added {formatDate(m.added)}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <Switch
                      value={m.active}
                      onValueChange={() => toggleStaffActive(m)}
                      trackColor={{ false: Colors.disabled, true: Colors.success }}
                      thumbColor="#FFFFFF"
                    />
                    <TouchableOpacity onPress={() => removeStaff(m.id)}>
                      <Text style={{ fontSize: 15 }}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.mainLayout}>
        {/* ================= LEFT SIDEBAR MENU ================= */}
        <View style={styles.sidebar}>
          <View>
            <View style={styles.logoContainer}>
              <Text style={styles.logoIcon}>🧺</Text>
              <Text style={styles.logoText}>Baker's Thrift Shop</Text>
            </View>

            <TouchableOpacity style={[styles.sidebarBtn, styles.sidebarBtnActive]}>
              <Text style={[styles.sidebarBtnText, styles.sidebarBtnTextActive]}>🏠 Overview</Text>
            </TouchableOpacity>

            <Text style={styles.adminSectionLabel}>ADMINISTRATION</Text>
            <TouchableOpacity style={styles.sidebarBtn} onPress={() => setAdminTool('customer-report')}><Text style={styles.sidebarBtnText}>Customer Report</Text></TouchableOpacity>
            <TouchableOpacity style={styles.sidebarBtn} onPress={() => setAdminTool('inventory')}><Text style={styles.sidebarBtnText}>Inventory</Text></TouchableOpacity>
            <TouchableOpacity style={styles.sidebarBtn} onPress={() => setAdminTool('inquiries')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.sidebarBtnText}>Customer Inquiries</Text>
                {inquiries.some((q) => !q.resolved) && (
                  <View style={styles.sidebarBadge}>
                    <Text style={styles.sidebarBadgeText}>{inquiries.filter((q) => !q.resolved).length}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sidebarBtn} onPress={() => setAdminTool('sales-report')}><Text style={styles.sidebarBtnText}>Sales Report</Text></TouchableOpacity>
            <TouchableOpacity style={styles.sidebarBtn} onPress={() => setAdminTool('orders')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.sidebarBtnText}>Online Orders</Text>
                {pendingOrders > 0 && (
                  <View style={styles.sidebarBadge}>
                    <Text style={styles.sidebarBadgeText}>{pendingOrders}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sidebarBtn} onPress={() => setAdminTool('stocks')}><Text style={styles.sidebarBtnText}>Stocks</Text></TouchableOpacity>
            {session?.isOwner && (
              <TouchableOpacity style={styles.sidebarBtn} onPress={() => setAdminTool('staff-accounts')}><Text style={styles.sidebarBtnText}>Create Staff Account</Text></TouchableOpacity>
            )}
          </View>

          <View>
            <View style={styles.signedInBox}>
              <Text style={styles.signedInLabel}>Signed in as</Text>
              <Text style={styles.signedInName} numberOfLines={1}>{session?.name} · {session?.role}</Text>
            </View>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutBtnText}>🚪 Log Out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ================= CENTER PRODUCT CATALOG MATRIX ================= */}
        <View style={styles.centerCatalog}>
          <View style={styles.catalogHeader}>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Where do you want to go? Search items..."
                placeholderTextColor={Colors.textMuted}
                value={catalogQuery}
                onChangeText={setCatalogQuery}
              />
            </View>
          </View>

          <Text style={styles.mainMenuTitle}>Choose Menu</Text>

          {/* Horizontal Category Nav Chips */}
          <View style={styles.categoryTabRow}>
            {(['ALL', ...CATEGORIES] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.categoryTabCard, activeTab === tab && styles.categoryTabCardActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.categoryTabLabel, activeTab === tab && styles.categoryTabLabelActive]}>
                  {tab === 'ALL' ? '📦' : categoryEmoji(tab)}
                </Text>
                <Text style={[styles.categoryTabText, activeTab === tab && styles.categoryTabTextActive]}>
                  {tab === 'ALL' ? 'All Menu' : capitalize(tab)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Product Grid Layout */}
          <ScrollView contentContainerStyle={styles.catalogGrid} showsVerticalScrollIndicator={false}>
            {filteredItems.map((item) => {
              const currentSelection = getSelection(item);
              const isSoldOut = item.available === 0;

              return (
                <View key={item.id} style={styles.itemCard}>
                  <View style={[styles.itemImageMock, { backgroundColor: isSoldOut ? '#EFEFEF' : Colors.primaryLight }]}>
                    <Text style={{ fontSize: 32 }}>{categoryEmoji(item.category)}</Text>
                  </View>

                  <View style={styles.itemMetaInfo}>
                    <Text style={styles.itemCardTitle} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.itemCardAvailability}>
                      {isSoldOut ? '0 Available' : `${item.available} Available`}
                    </Text>
                    <Text style={styles.itemCardPrice}>{peso(item.basePrice)}</Text>
                  </View>

                  <View style={styles.cardControlRow}>
                    <View style={styles.quantityContainer}>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => updateCardQty(item, -1)} disabled={isSoldOut}>
                        <Text style={styles.qtyBtnText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{currentSelection.qty}</Text>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => updateCardQty(item, 1)} disabled={isSoldOut}>
                        <Text style={styles.qtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.sizeContainer}>
                      {item.sizes.map((sz) => (
                        <TouchableOpacity
                          key={sz}
                          style={[styles.sizeChip, currentSelection.size === sz && styles.sizeChipActive]}
                          onPress={() => updateCardSize(item, sz)}
                          disabled={isSoldOut}
                        >
                          <Text style={[styles.sizeChipText, currentSelection.size === sz && styles.sizeChipTextActive]}>
                            {sz}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {isSoldOut ? (
                    <View style={styles.soldOutBtn}>
                      <Text style={styles.soldOutBtnText}>Sold Out</Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.addToBillingBtn} onPress={() => handleAddToBilling(item)}>
                      <Text style={styles.addToBillingBtnText}>Add to Billing</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* ================= RIGHT BILLING SIDE PANEL ================= */}
        <View style={styles.billingSection}>
          <View style={styles.billingHeader}>
            <Text style={styles.billingTitle}>Bill Details</Text>
            <Text style={styles.billingReceiptNo}>#{receiptNo}</Text>
          </View>

          <ScrollView style={styles.billingScrollItems} showsVerticalScrollIndicator={false}>
            {cartItems.length === 0 ? (
              <View style={styles.emptyBillingContainer}>
                <Text style={{ fontSize: 32, marginBottom: 10 }}>🛒</Text>
                <Text style={styles.emptyBillingText}>No Items in Billing</Text>
              </View>
            ) : (
              cartItems.map((cartItem) => (
                <View key={cartItem.id} style={styles.billingItemRow}>
                  <View style={styles.billingItemLeft}>
                    <Text style={styles.billingItemName}>{cartItem.name}</Text>
                    <Text style={styles.billingItemSub}>Size: {cartItem.size}</Text>
                    <Text style={styles.billingItemPrice}>{peso(cartItem.price * cartItem.quantity)}</Text>
                  </View>
                  <View style={styles.billingItemRight}>
                    <Text style={styles.billingItemQty}>x{cartItem.quantity}</Text>
                    <TouchableOpacity style={styles.removeCartBtn} onPress={() => handleRemoveFromBilling(cartItem.id)}>
                      <Text style={styles.removeCartBtnText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.billingFooter}>
            <TextInput
              value={billCustomer}
              onChangeText={setBillCustomer}
              placeholder="Customer name (optional)"
              placeholderTextColor={Colors.textMuted}
              style={styles.billCustomerInput}
            />

            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Amount Order :</Text>
              <Text style={styles.summaryValue}>{cartItems.reduce((acc, item) => acc + item.quantity, 0)}</Text>
            </View>

            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Total Price :</Text>
              <Text style={[styles.summaryValue, { color: Colors.primary, fontSize: 20 }]}>{peso(calculateTotal())}</Text>
            </View>

            <TouchableOpacity style={styles.processTxBtn} onPress={processTransaction}>
              <Text style={styles.processTxBtnText}>Process Transaction</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {adminTool === null && toastEl}

      {/* ================= ADMIN TOOLS MODAL ================= */}
      <Modal visible={adminTool !== null} animationType="slide" transparent onRequestClose={closeTool}>
        <View style={styles.toolBackdrop}>
          <View style={[styles.toolPanel, panelStyle]}>
            <View style={styles.toolHeader}>
              <Text style={styles.toolTitle}>{adminTool ? adminToolTitle[adminTool] : ''}</Text>
              <TouchableOpacity onPress={closeTool}><Text style={styles.toolClose}>×</Text></TouchableOpacity>
            </View>

            <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
              {adminTool === 'customer-report' && renderCustomerReport()}
              {adminTool === 'inquiries' && renderInquiries()}
              {adminTool === 'sales-report' && renderSalesReport()}
              {adminTool === 'inventory' && renderStockTable('Manage your product catalog and stock levels.')}
              {adminTool === 'stocks' && renderStockTable('Track what is in stock and switch products on or off.')}
              {adminTool === 'staff-accounts' && session?.isOwner && renderStaffAccounts()}
              {adminTool === 'orders' && (
                <OrdersPanel orders={onlineOrders} customers={customers} onToast={showToast} onChanged={refreshShared} />
              )}
            </ScrollView>
          </View>
          {toastEl}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  mainLayout: { flex: 1, flexDirection: 'row' },

  sidebar: { width: 220, backgroundColor: Colors.surface, borderRightWidth: 1, borderRightColor: Colors.border, padding: 20, justifyContent: 'space-between' },
  logoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  logoIcon: { fontSize: 22, marginRight: 8 },
  logoText: { fontSize: 18, fontWeight: 'bold', color: Colors.primary },
  sidebarBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginBottom: 6 },
  sidebarBtnActive: { backgroundColor: Colors.primaryLight },
  sidebarBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  sidebarBtnTextActive: { color: Colors.primary },
  sidebarBadge: { backgroundColor: Colors.primary, borderRadius: 9, minWidth: 18, height: 18, paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center' },
  sidebarBadgeText: { color: Colors.surface, fontSize: 10, fontWeight: 'bold' },
  adminSectionLabel: { color: Colors.textMuted, fontWeight: 'bold', fontSize: 10, marginTop: 14, marginBottom: 6, paddingHorizontal: 12 },
  signedInBox: { backgroundColor: Colors.primaryLight, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 8 },
  signedInLabel: { color: Colors.textMuted, fontSize: 10 },
  signedInName: { color: Colors.primary, fontSize: 12, fontWeight: 'bold', marginTop: 1 },
  logoutBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#FFF0F0' },
  logoutBtnText: { color: Colors.danger, fontWeight: '600', fontSize: 13 },

  centerCatalog: { flex: 1, padding: 20 },
  catalogHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  searchContainer: { flex: 1, maxWidth: 350 },
  searchInput: { backgroundColor: Colors.surface, height: 40, borderRadius: 20, paddingHorizontal: 15, borderWidth: 1, borderColor: Colors.border, fontSize: 13, color: Colors.textDark },
  mainMenuTitle: { fontSize: 24, fontWeight: 'bold', color: Colors.textDark, marginBottom: 15 },

  categoryTabRow: { flexDirection: 'row', marginBottom: 20 },
  categoryTabCard: { backgroundColor: Colors.surface, paddingVertical: 10, paddingHorizontal: 15, borderRadius: 12, marginRight: 10, alignItems: 'center', minWidth: 85, borderWidth: 1, borderColor: Colors.border },
  categoryTabCardActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryTabLabel: { fontSize: 16, marginBottom: 2 },
  categoryTabLabelActive: { color: Colors.surface },
  categoryTabText: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  categoryTabTextActive: { color: Colors.surface },

  catalogGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingBottom: 20 },
  itemCard: { backgroundColor: Colors.surface, width: '48%', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  itemImageMock: { height: 100, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  itemMetaInfo: { marginBottom: 10 },
  itemCardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textDark, marginBottom: 2 },
  itemCardAvailability: { fontSize: 11, color: Colors.textMuted, marginBottom: 4 },
  itemCardPrice: { fontSize: 15, fontWeight: 'bold', color: Colors.primary },

  cardControlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  quantityContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 6, padding: 2 },
  qtyBtn: { width: 24, height: 24, borderRadius: 4, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 14, fontWeight: 'bold', color: Colors.textDark },
  qtyText: { marginHorizontal: 8, fontSize: 13, fontWeight: 'bold', color: Colors.textDark },
  sizeContainer: { flexDirection: 'row' },
  sizeChip: { width: 24, height: 24, borderRadius: 4, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginLeft: 4 },
  sizeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sizeChipText: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
  sizeChipTextActive: { color: Colors.surface },

  addToBillingBtn: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.primary, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  addToBillingBtnText: { color: Colors.primary, fontWeight: 'bold', fontSize: 12 },
  soldOutBtn: { backgroundColor: Colors.disabled, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  soldOutBtnText: { color: Colors.surface, fontWeight: 'bold', fontSize: 12 },

  billingSection: { width: 280, backgroundColor: Colors.surface, borderLeftWidth: 1, borderLeftColor: Colors.border, padding: 20, justifyContent: 'space-between' },
  billingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  billingTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.textDark },
  billingReceiptNo: { fontSize: 12, color: Colors.textMuted },
  billingScrollItems: { flex: 1, marginVertical: 12 },
  emptyBillingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  emptyBillingText: { color: Colors.textMuted, fontSize: 13 },
  billingItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.background },
  billingItemLeft: { flex: 1 },
  billingItemName: { fontSize: 13, fontWeight: '600', color: Colors.textDark, marginBottom: 2 },
  billingItemSub: { fontSize: 10, color: Colors.textMuted, marginBottom: 2 },
  billingItemPrice: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  billingItemRight: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  billingItemQty: { fontSize: 13, fontWeight: 'bold', color: Colors.textDark, marginRight: 8 },
  removeCartBtn: { padding: 4, marginLeft: 4 },
  removeCartBtnText: { fontSize: 14 },

  billingFooter: { paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  billCustomerInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, color: Colors.textDark, marginBottom: 12, backgroundColor: Colors.background },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 13, color: Colors.textMuted },
  summaryValue: { fontSize: 15, fontWeight: 'bold', color: Colors.textDark },
  processTxBtn: { backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  processTxBtnText: { color: Colors.surface, fontWeight: 'bold', fontSize: 14 },

  // ----- Toast -----
  toast: { position: 'absolute', top: 24, alignSelf: 'center', backgroundColor: Colors.textDark, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 24, maxWidth: '85%', zIndex: 999, elevation: 10 },
  toastText: { color: Colors.surface, fontSize: 13, fontWeight: '600' },

  // ----- Admin modal -----
  toolBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  toolPanel: { backgroundColor: Colors.surface, borderRadius: 16, width: '100%', maxWidth: 520, padding: 24, maxHeight: '88%' },
  toolPanelMid: { maxWidth: 760 },
  toolPanelWide: { maxWidth: 1040 },
  toolHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  toolTitle: { color: Colors.textDark, fontSize: 22, fontWeight: 'bold' },
  toolSubtitle: { color: Colors.textMuted, fontSize: 13, marginTop: -12, marginBottom: 16 },
  toolClose: { color: Colors.textMuted, fontSize: 30, lineHeight: 30 },
  toolText: { color: Colors.textMuted, fontSize: 14, marginBottom: 10 },
  toolAction: { backgroundColor: Colors.primary, padding: 13, borderRadius: 8, alignItems: 'center', marginTop: 14 },
  toolActionText: { color: Colors.surface, fontWeight: 'bold', fontSize: 12 },
  toolInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 12, color: Colors.textDark, marginTop: 10 },
  sectionTitle: { color: Colors.textDark, fontSize: 16, fontWeight: 'bold', marginBottom: 10 },

  // ----- Stat cards -----
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
  statCard: { flexGrow: 1, flexBasis: 140, backgroundColor: Colors.background, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  statEmoji: { fontSize: 20, marginBottom: 6 },
  statValue: { color: Colors.primary, fontSize: 24, fontWeight: 'bold', marginBottom: 2 },
  statLabel: { color: Colors.textMuted, fontSize: 12 },

  highlightBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryLight, borderRadius: 14, padding: 16, marginBottom: 22 },
  highlightEmoji: { fontSize: 28, marginRight: 14 },
  highlightLabel: { color: Colors.textMuted, fontSize: 12 },
  highlightValue: { color: Colors.textDark, fontSize: 18, fontWeight: 'bold' },
  highlightPct: { color: Colors.primary, fontWeight: 'bold', fontSize: 13 },

  customerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: Colors.surface, fontWeight: 'bold', fontSize: 16 },
  customerTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  customerName: { color: Colors.textDark, fontWeight: '700', fontSize: 14 },
  customerSpent: { color: Colors.primary, fontWeight: 'bold', fontSize: 14 },
  customerMeta: { color: Colors.textMuted, fontSize: 11, marginTop: 5 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: Colors.primaryLight, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  categoryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  categoryRowLabel: { width: 130, color: Colors.textDark, fontSize: 13, fontWeight: '600' },
  categoryRowPct: { width: 40, textAlign: 'right', color: Colors.textMuted, fontSize: 12, fontWeight: '600' },

  // ----- Inquiries -----
  inquiryCard: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 16, marginBottom: 14, backgroundColor: Colors.surface },
  inquiryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  inquiryTitle: { color: Colors.textDark, fontSize: 15, fontWeight: 'bold' },
  inquiryDate: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  customerBubble: { backgroundColor: Colors.background, borderRadius: 12, padding: 12, marginBottom: 10, alignSelf: 'flex-start', maxWidth: '90%' },
  bubbleText: { color: Colors.textDark, fontSize: 14 },
  staffBubble: { backgroundColor: Colors.primaryLight, borderRadius: 12, padding: 12, marginBottom: 10, alignSelf: 'flex-end', maxWidth: '90%' },
  staffBubbleText: { color: Colors.textDark, fontSize: 14 },
  staffBubbleMeta: { color: Colors.textMuted, fontSize: 10, marginTop: 4, textAlign: 'right' },
  replyInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, minHeight: 70, color: Colors.textDark, textAlignVertical: 'top', backgroundColor: Colors.surface, marginTop: 4 },
  inquiryActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  primaryBtn: { backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
  primaryBtnText: { color: Colors.surface, fontWeight: 'bold', fontSize: 12 },
  secondaryBtn: { borderWidth: 1, borderColor: Colors.primary, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
  secondaryBtnText: { color: Colors.primary, fontWeight: 'bold', fontSize: 12 },
  pill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  pillGreen: { backgroundColor: Colors.successLight },
  pillOrange: { backgroundColor: Colors.primaryLight },
  pillText: { fontSize: 11, fontWeight: 'bold' },

  // ----- Tables (sales + stocks) -----
  tableToolbar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  toolbarSearch: { flexGrow: 1, flexBasis: 220, maxWidth: 360 },
  toolbarSearchInput: { backgroundColor: Colors.surface, height: 40, borderRadius: 20, paddingHorizontal: 16, borderWidth: 1, borderColor: Colors.border, fontSize: 13, color: Colors.textDark },
  countText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  sortPill: { height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', backgroundColor: Colors.surface },
  sortPillText: { color: Colors.textDark, fontSize: 12, fontWeight: '600' },
  exportBtn: { height: 40, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', backgroundColor: Colors.surface },
  exportBtnText: { color: Colors.textDark, fontSize: 12, fontWeight: '600' },
  addProductBtn: { height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center' },
  addProductBtnText: { color: Colors.surface, fontSize: 12, fontWeight: 'bold' },
  filterChip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, marginRight: 8, marginBottom: 6, backgroundColor: Colors.surface },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: Colors.surface },
  addForm: { backgroundColor: Colors.background, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  selectionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.primaryLight, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 10 },
  selectionText: { color: Colors.primary, fontWeight: 'bold', fontSize: 13 },
  selectionDelete: { color: Colors.danger, fontWeight: 'bold', fontSize: 13 },

  tableWrap: { minWidth: 820, flexGrow: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, overflow: 'hidden', backgroundColor: Colors.surface },
  tableHeadRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border },
  th: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
  tableRow: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  td: { color: Colors.textDark, fontSize: 13 },
  tdMuted: { color: Colors.textMuted, fontSize: 12 },
  tdBold: { color: Colors.textDark, fontSize: 13, fontWeight: '700' },
  tdId: { color: Colors.primary, fontSize: 13, fontWeight: 'bold' },
  tdAmount: { color: Colors.textDark, fontSize: 14, fontWeight: 'bold' },
  emptyTable: { color: Colors.textMuted, fontSize: 13, padding: 24, textAlign: 'center' },

  saleItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  saleItemName: { color: Colors.textDark, fontSize: 13, fontWeight: '600' },
  saleItemSub: { color: Colors.textMuted, fontSize: 11, marginTop: 1 },
  saleItemPrice: { color: Colors.textDark, fontSize: 12, fontWeight: '600', marginLeft: 10 },

  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.disabled, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkMark: { color: Colors.surface, fontSize: 11, fontWeight: 'bold', lineHeight: 13 },
  thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  newBadge: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 8 },
  newBadgeText: { color: Colors.surface, fontSize: 9, fontWeight: 'bold' },

  stockName: { color: Colors.textDark, fontWeight: 'bold', fontSize: 14 },
  stockControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stockButton: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  stockButtonText: { color: Colors.primary, fontWeight: 'bold', fontSize: 14, lineHeight: 16 },
  stockValue: { fontWeight: 'bold', fontSize: 14, minWidth: 24, textAlign: 'center' },
  stockTotal: { color: Colors.primary, fontWeight: 'bold', paddingTop: 14, textAlign: 'right' },

  // ----- Staff accounts -----
  staffColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' },
  staffFormCard: { flexGrow: 1, flexBasis: 320, backgroundColor: Colors.background, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.border },
  staffListCol: { flexGrow: 1, flexBasis: 300 },
  staffNote: { color: Colors.textMuted, fontSize: 11, marginTop: 8 },
  staffPreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 6, borderWidth: 1, borderColor: Colors.border },
  avatarLarge: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  avatarLargeText: { color: Colors.surface, fontSize: 22, fontWeight: 'bold' },
  staffPreviewName: { color: Colors.textDark, fontSize: 16, fontWeight: 'bold' },
  staffPreviewRole: { color: Colors.primary, fontSize: 12, fontWeight: '600', marginTop: 2 },
  fieldLabel: { color: Colors.textDark, fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  fieldInput: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, color: Colors.textDark, fontSize: 14 },
  fieldInputError: { borderColor: Colors.danger },
  errorText: { color: Colors.danger, fontSize: 11, marginTop: 5 },
  passwordWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 14 },
  passwordInput: { flex: 1, paddingVertical: 11, color: Colors.textDark, fontSize: 14 },
  showBtnText: { color: Colors.primary, fontWeight: 'bold', fontSize: 12, paddingLeft: 10 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, marginBottom: 6 },
  strengthSeg: { flex: 1, height: 5, borderRadius: 3 },
  strengthLabel: { fontSize: 11, fontWeight: 'bold', marginLeft: 6, minWidth: 88, textAlign: 'right' },
  checkText: { color: Colors.textMuted, fontSize: 11, marginTop: 3 },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleCard: { flexGrow: 1, flexBasis: 90, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, padding: 10, alignItems: 'center' },
  roleCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  roleEmoji: { fontSize: 20, marginBottom: 4 },
  roleTitle: { color: Colors.textDark, fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
  roleDesc: { color: Colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: 2 },
  createStaffBtn: { backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  createStaffBtnText: { color: Colors.surface, fontWeight: 'bold', fontSize: 14 },
  staffCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 14, marginBottom: 10 },
  staffName: { color: Colors.textDark, fontSize: 14, fontWeight: 'bold' },
  staffEmail: { color: Colors.textMuted, fontSize: 12, marginTop: 1, marginBottom: 6 },
  staffMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  staffAdded: { color: Colors.textMuted, fontSize: 10 },
});