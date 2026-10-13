import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useRef, useState } from 'react';
import { Modal, ScrollView, Share, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

import ActivityPanel from '../../components/admin/ActivityPanel';
import MessagesPanel from '../../components/admin/MessagesPanel';
import OrdersPanel from '../../components/admin/OrdersPanel';
import StocksPanel from '../../components/admin/StocksPanel';
import { ActivityEntry, loadActivity, logStaffActivity } from '../../components/shop/activityStore';
import { ChatThread, loadThreads } from '../../components/shop/chatStore';
import { Inquiry, loadInquiries } from '../../components/shop/inquiryStore';
import {
  cartIdOf,
  DEFAULT_INVENTORY,
  InventoryItem,
  loadInventory,
  mutateInventory,
  priceFor,
  PRODUCT_CATEGORIES,
  ProductCategory,
  purchaseItems,
  sizesOf,
} from '../../components/shop/inventoryStore';
import { addPosSale, loadPosSales, POS_START, PosSale } from '../../components/shop/posStore';
import { formatDate, formatTime, loadCustomers, loadOrders, OnlineOrder, peso, PublicCustomer, subscribeToChanges } from '../../components/shop/shopStore';
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

interface SaleItem {
  id: string;
  productId: string;
  name: string;
  category: Category;
  size: string;
  texture: string;
  style: string;
  price: number;
  quantity: number;
}

interface Sale {
  id: string; // transaction / receipt number
  customer: string;
  items: SaleItem[];
  total: number;
  date: string; // ISO string
  source: 'ONLINE' | 'POS';
  payment?: string;
}

type AdminTool = 'customer-report' | 'inventory' | 'messages' | 'sales-report' | 'stocks' | 'staff-accounts' | 'orders' | 'activity' | null;

const WALK_IN = 'Walk-in Customer';
const AVATAR_COLORS = ['#E2875E', '#C9694A', '#D9A066', '#B5835A', '#9C6B4E'];

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
const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
const nextOption = (options: string[], current: string) => options[(options.indexOf(current) + 1) % options.length];

type PosSel = { size: string; texture: string; style: string; qty: number };

export default function AdminPOSScreen() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuthorization, setIsCheckingAuthorization] = useState(true);
  const [session, setSession] = useState<StaffSession | null>(null);

  // --- POS states ---
  const [activeTab, setActiveTab] = useState<'ALL' | Category>('ALL');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [posSel, setPosSel] = useState<Record<string, PosSel>>({});
  const [cartItems, setCartItems] = useState<SaleItem[]>([]);
  const [billCustomer, setBillCustomer] = useState('');

  // --- Admin tool states ---
  const [adminTool, setAdminTool] = useState<AdminTool>(null);
  const [salesQuery, setSalesQuery] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState<StaffRole>('Cashier');
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [staffSubmitted, setStaffSubmitted] = useState(false);
  const [staffError, setStaffError] = useState('');

  // Toast (Alert.alert does not show on web, so we use our own banner)
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
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
    await logStaffActivity('Staff sign out');
    await logoutStaff();
    setIsAuthorized(false);
    setSession(null);
    router.replace('/');
  };

  // --- Shared data, refreshed every few seconds so customers' orders, messages and chats show up live ---
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(DEFAULT_INVENTORY);
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrder[]>([]);
  const [customers, setCustomers] = useState<PublicCustomer[]>([]);
  const [staffList, setStaffList] = useState<PublicStaff[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [posSales, setPosSales] = useState<PosSale[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const known = useRef<{ orders: string[]; inquiries: string[]; unread: number } | null>(null);

  const refreshShared = useCallback(async () => {
    const [items, orders, people, team, inq, chats, sales, log] = await Promise.all([
      loadInventory(),
      loadOrders(),
      loadCustomers(),
      loadStaff(),
      loadInquiries(),
      loadThreads(),
      loadPosSales(),
      loadActivity(),
    ]);
    setInventoryItems(items);
    setOnlineOrders(orders);
    setCustomers(people);
    setStaffList(team);
    setInquiries(inq);
    setThreads(chats);
    setPosSales(sales);
    setActivity(log);

    const unread = chats.reduce((t, c) => t + c.staffUnread, 0);
    const before = known.current;
    known.current = { orders: orders.map((o) => o.id), inquiries: inq.map((q) => q.id), unread };
    if (before) {
      const newOrder = orders.find((o) => !before.orders.includes(o.id));
      const newInquiry = inq.find((q) => !before.inquiries.includes(q.id));
      if (newOrder) showToast(`New order ${newOrder.id} from ${newOrder.customerName}!`);
      else if (newInquiry) showToast(`New inquiry from ${newInquiry.name}!`);
      else if (unread > before.unread) showToast('New chat message from a customer.');
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

  // ---------- POS actions ----------
  const getPosSel = (item: InventoryItem): PosSel =>
    posSel[item.id] || {
      size: sizesOf(item).find((s) => item.stock[s] > 0) || sizesOf(item)[0],
      texture: item.textures[0],
      style: item.styles[0],
      qty: 1,
    };
  const setPos = (item: InventoryItem, patch: Partial<PosSel>) =>
    setPosSel((prev) => ({ ...prev, [item.id]: { ...getPosSel(item), ...patch } }));

  const handleAddToBilling = (item: InventoryItem) => {
    const sel = getPosSel(item);
    const inCart = cartItems.filter((c) => c.productId === item.id && c.size === sel.size).reduce((t, c) => t + c.quantity, 0);
    if (inCart + sel.qty > (item.stock[sel.size] || 0)) {
      showToast(`Only ${item.stock[sel.size] || 0} of ${item.name} (${sel.size}) in stock.`);
      return;
    }
    const id = cartIdOf(item.id, sel.size, sel.texture, sel.style);
    setCartItems((prev) => {
      if (prev.some((i) => i.id === id)) return prev.map((i) => (i.id === id ? { ...i, quantity: i.quantity + sel.qty } : i));
      return [
        ...prev,
        { id, productId: item.id, name: item.name, category: item.category, size: sel.size, texture: sel.texture, style: sel.style, price: priceFor(item, sel.size), quantity: sel.qty },
      ];
    });
    setPos(item, { qty: 1 });
    showToast(`Added ${sel.qty}x ${item.name} (${sel.size}) to Bill Details.`);
  };

  const handleRemoveFromBilling = (id: string) => setCartItems((prev) => prev.filter((i) => i.id !== id));
  const calculateTotal = () => cartItems.reduce((t, i) => t + i.price * i.quantity, 0);

  const processTransaction = async () => {
    if (cartItems.length === 0) {
      showToast('Add at least one item to the bill first.');
      return;
    }
    // Checks the stock and deducts it; nothing is deducted if any piece is missing
    const stock = await purchaseItems(cartItems.map((c) => ({ productId: c.productId, size: c.size, quantity: c.quantity })));
    if (!stock.ok) {
      showToast(stock.message || 'Not enough stock.');
      refreshShared();
      return;
    }
    const sale = await addPosSale({
      customer: billCustomer.trim() || WALK_IN,
      cashier: session?.name || 'Staff',
      items: cartItems.map(({ id, ...line }) => line),
    });
    setCartItems([]);
    setBillCustomer('');
    await refreshShared();
    showToast(`Transaction ${sale.id} processed!`);
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
    await logStaffActivity('Created staff account', `${result.staff.name} · ${email} · ${role}`);
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
    await logStaffActivity(member.active ? 'Disabled staff account' : 'Enabled staff account', member.email);
    await refreshShared();
  };

  const removeStaff = async (member: PublicStaff) => {
    await removeStaffAccount(member.id);
    await logStaffActivity('Removed staff account', member.email);
    await refreshShared();
    showToast('Staff account removed.');
  };

  // ---------- Export (opens the share sheet where supported) ----------
  const exportSales = async () => {
    const rows: (string | number)[][] = [
      ['Transaction ID', 'Source', 'Customer', 'Items', 'Amount', 'Date', 'Time'],
      ...filteredSales.map((s) => [
        s.id,
        s.source === 'ONLINE' ? `Online (${s.payment})` : 'POS',
        s.customer,
        s.items.map((i) => `${i.quantity}x ${i.name} (${i.size}, ${i.texture}, ${i.style})`).join(' | '),
        s.total.toFixed(2),
        formatDate(s.date),
        formatTime(s.date),
      ]),
    ];
    try {
      await Share.share({ title: 'Sales Report', message: rows.map((r) => r.map(csvCell).join(',')).join('\n') });
    } catch {
      showToast('Export is not supported on this device or browser.');
    }
  };

  // ---------- Derived data ----------
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
        texture: l.texture,
        style: l.style,
        price: l.price,
        quantity: l.quantity,
      })),
    }));
  const posAsSales: Sale[] = posSales.map((s) => ({
    id: s.id,
    customer: s.customer,
    total: s.total,
    date: s.date,
    source: 'POS' as const,
    items: s.items.map((l, i) => ({ ...l, id: `${s.id}-${i}` })),
  }));
  const sales: Sale[] = [...onlineAsSales, ...posAsSales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const pendingOrders = onlineOrders.filter((o) => o.status === 'Order placed').length;
  const messageBadge = inquiries.filter((q) => !q.resolved).length + threads.reduce((t, c) => t + c.staffUnread, 0);

  const filteredItems = inventoryItems
    .filter((item) => item.active)
    .filter((item) => activeTab === 'ALL' || item.category === activeTab)
    .filter((item) => item.name.toLowerCase().includes(catalogQuery.trim().toLowerCase()));

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
    messages: 'Inquiries & Chat',
    'sales-report': 'Sales Report',
    stocks: 'Stocks',
    orders: 'Online Orders',
    activity: 'Activity Log',
    'staff-accounts': 'Create Staff Account',
  };

  const closeTool = () => setAdminTool(null);

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
      : adminTool
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
        <Text style={styles.toolText}>No named customers yet.</Text>
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
            <Text style={styles.categoryRowLabel}>{categoryEmoji(cat)} {capitalize(cat)}</Text>
            <View style={[styles.barTrack, { flex: 1, marginHorizontal: 12 }]}>
              <View style={[styles.barFill, { width: `${pct}%` as `${number}%` }]} />
            </View>
            <Text style={styles.categoryRowPct}>{pct}%</Text>
          </View>
        );
      })}
    </View>
  );

  // ================= TOOL: SALES REPORT =================
  const renderSalesReport = () => (
    <View>
      <View style={styles.statRow}>
        <View style={styles.statCard}><Text style={styles.statValue}>{peso(totalSales)}</Text><Text style={styles.statLabel}>Total sales</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{sales.length}</Text><Text style={styles.statLabel}>Transactions</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{totalItemsSold}</Text><Text style={styles.statLabel}>Items sold</Text></View>
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
            <Text style={styles.emptyTable}>No transactions yet.</Text>
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
                        <Text style={styles.saleItemSub}>{i.size} · {i.texture} · {i.style}</Text>
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
          <View style={styles.statCard}><Text style={styles.statEmoji}>👥</Text><Text style={styles.statValue}>{staffList.length}</Text><Text style={styles.statLabel}>Staff accounts</Text></View>
          <View style={styles.statCard}><Text style={styles.statEmoji}>✅</Text><Text style={styles.statValue}>{activeCount}</Text><Text style={styles.statLabel}>Active</Text></View>
          <View style={styles.statCard}><Text style={styles.statEmoji}>⏸️</Text><Text style={styles.statValue}>{staffList.length - activeCount}</Text><Text style={styles.statLabel}>Disabled</Text></View>
        </View>

        <View style={styles.staffColumns}>
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
            <TextInput value={staffName} onChangeText={setStaffName} placeholder="e.g. Maria Dela Cruz" placeholderTextColor={Colors.textMuted} style={[styles.fieldInput, !!nameError && styles.fieldInputError]} />
            {!!nameError && <Text style={styles.errorText}>{nameError}</Text>}

            <Text style={styles.fieldLabel}>Work email</Text>
            <TextInput value={staffEmail} onChangeText={setStaffEmail} placeholder={`name${STAFF_DOMAIN}`} placeholderTextColor={Colors.textMuted} autoCapitalize="none" keyboardType="email-address" style={[styles.fieldInput, !!emailError && styles.fieldInputError]} />
            {!!emailError && <Text style={styles.errorText}>{emailError}</Text>}

            <Text style={styles.fieldLabel}>Password</Text>
            <View style={[styles.passwordWrap, !!passError && styles.fieldInputError]}>
              <TextInput value={staffPassword} onChangeText={setStaffPassword} placeholder="Create a password" placeholderTextColor={Colors.textMuted} secureTextEntry={!showStaffPassword} autoCapitalize="none" style={styles.passwordInput} />
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
              <Text key={label} style={[styles.checkText, ok && { color: Colors.success }]}>{ok ? '✓' : '○'} {label}</Text>
            ))}

            <Text style={styles.fieldLabel}>Role</Text>
            <View style={styles.roleRow}>
              {STAFF_ROLES.map((r) => (
                <TouchableOpacity key={r.role} style={[styles.roleCard, staffRole === r.role && styles.roleCardActive]} onPress={() => setStaffRole(r.role)}>
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
                    <Switch value={m.active} onValueChange={() => toggleStaffActive(m)} trackColor={{ false: Colors.disabled, true: Colors.success }} thumbColor="#FFFFFF" />
                    <TouchableOpacity onPress={() => removeStaff(m)}>
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
          <ScrollView showsVerticalScrollIndicator={false}>
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
            <TouchableOpacity style={styles.sidebarBtn} onPress={() => setAdminTool('messages')}>
              <View style={styles.sidebarRow}>
                <Text style={styles.sidebarBtnText}>Inquiries & Chat</Text>
                {messageBadge > 0 && (
                  <View style={styles.sidebarBadge}><Text style={styles.sidebarBadgeText}>{messageBadge}</Text></View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sidebarBtn} onPress={() => setAdminTool('sales-report')}><Text style={styles.sidebarBtnText}>Sales Report</Text></TouchableOpacity>
            <TouchableOpacity style={styles.sidebarBtn} onPress={() => setAdminTool('orders')}>
              <View style={styles.sidebarRow}>
                <Text style={styles.sidebarBtnText}>Online Orders</Text>
                {pendingOrders > 0 && (
                  <View style={styles.sidebarBadge}><Text style={styles.sidebarBadgeText}>{pendingOrders}</Text></View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sidebarBtn} onPress={() => setAdminTool('stocks')}><Text style={styles.sidebarBtnText}>Stocks</Text></TouchableOpacity>
            <TouchableOpacity style={styles.sidebarBtn} onPress={() => setAdminTool('activity')}><Text style={styles.sidebarBtnText}>Activity Log</Text></TouchableOpacity>
            {session?.isOwner && (
              <TouchableOpacity style={styles.sidebarBtn} onPress={() => setAdminTool('staff-accounts')}><Text style={styles.sidebarBtnText}>Create Staff Account</Text></TouchableOpacity>
            )}

           
          </ScrollView>

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
              <TextInput style={styles.searchInput} placeholder="Search items..." placeholderTextColor={Colors.textMuted} value={catalogQuery} onChangeText={setCatalogQuery} />
            </View>
          </View>

          <Text style={styles.mainMenuTitle}>Choose Menu</Text>

          <View style={styles.categoryTabRow}>
            {(['ALL', ...CATEGORIES] as const).map((tab) => (
              <TouchableOpacity key={tab} style={[styles.categoryTabCard, activeTab === tab && styles.categoryTabCardActive]} onPress={() => setActiveTab(tab)}>
                <Text style={[styles.categoryTabLabel, activeTab === tab && styles.categoryTabLabelActive]}>{tab === 'ALL' ? '📦' : categoryEmoji(tab)}</Text>
                <Text style={[styles.categoryTabText, activeTab === tab && styles.categoryTabTextActive]}>{tab === 'ALL' ? 'All Menu' : capitalize(tab)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView contentContainerStyle={styles.catalogGrid} showsVerticalScrollIndicator={false}>
            {filteredItems.map((item) => {
              const sel = getPosSel(item);
              const inStock = item.stock[sel.size] || 0;
              return (
                <View key={item.id} style={styles.itemCard}>
                  <View style={[styles.itemImageMock, { backgroundColor: inStock === 0 ? '#EFEFEF' : Colors.primaryLight }]}>
                    <Text style={{ fontSize: 28 }}>{categoryEmoji(item.category)}</Text>
                  </View>
                  <Text style={styles.itemCardTitle} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.itemCardAvailability}>{inStock} in stock ({sel.size})</Text>
                  <Text style={styles.itemCardPrice}>{peso(priceFor(item, sel.size))}</Text>

                  <View style={styles.posChips}>
                    {sizesOf(item).map((sz) => (
                      <TouchableOpacity key={sz} style={[styles.posChip, sel.size === sz && styles.posChipActive]} onPress={() => setPos(item, { size: sz, qty: 1 })}>
                        <Text style={[styles.posChipText, sel.size === sz && { color: '#fff' }]}>{sz}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity style={styles.cycleBtn} onPress={() => setPos(item, { texture: nextOption(item.textures, sel.texture) })}>
                    <Text style={styles.cycleText}>Texture: {sel.texture} ›</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cycleBtn} onPress={() => setPos(item, { style: nextOption(item.styles, sel.style) })}>
                    <Text style={styles.cycleText}>Style: {sel.style} ›</Text>
                  </TouchableOpacity>

                  <View style={styles.cardControlRow}>
                    <View style={styles.quantityContainer}>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => setPos(item, { qty: Math.max(1, sel.qty - 1) })}><Text style={styles.qtyBtnText}>-</Text></TouchableOpacity>
                      <Text style={styles.qtyText}>{sel.qty}</Text>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => setPos(item, { qty: Math.min(Math.max(1, inStock), sel.qty + 1) })}><Text style={styles.qtyBtnText}>+</Text></TouchableOpacity>
                    </View>
                  </View>

                  {inStock === 0 ? (
                    <View style={styles.soldOutBtn}><Text style={styles.soldOutBtnText}>Sold Out</Text></View>
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
            <Text style={styles.billingReceiptNo}>#{POS_START + posSales.length}</Text>
          </View>

          <ScrollView style={styles.billingScrollItems} showsVerticalScrollIndicator={false}>
            {cartItems.length === 0 ? (
              <View style={styles.emptyBillingContainer}>
                <Text style={{ fontSize: 32, marginBottom: 10 }}>🛒</Text>
                <Text style={styles.emptyBillingText}>No Items in Billing</Text>
              </View>
            ) : (
              cartItems.map((c) => (
                <View key={c.id} style={styles.billingItemRow}>
                  <View style={styles.billingItemLeft}>
                    <Text style={styles.billingItemName}>{c.name}</Text>
                    <Text style={styles.billingItemSub}>{c.size} · {c.texture} · {c.style}</Text>
                    <Text style={styles.billingItemPrice}>{peso(c.price * c.quantity)}</Text>
                  </View>
                  <View style={styles.billingItemRight}>
                    <Text style={styles.billingItemQty}>x{c.quantity}</Text>
                    <TouchableOpacity style={styles.removeCartBtn} onPress={() => handleRemoveFromBilling(c.id)}>
                      <Text style={styles.removeCartBtnText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.billingFooter}>
            <TextInput value={billCustomer} onChangeText={setBillCustomer} placeholder="Customer name (optional)" placeholderTextColor={Colors.textMuted} style={styles.billCustomerInput} />
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Amount Order :</Text>
              <Text style={styles.summaryValue}>{cartItems.reduce((t, i) => t + i.quantity, 0)}</Text>
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
              {adminTool === 'sales-report' && renderSalesReport()}
              {(adminTool === 'inventory' || adminTool === 'stocks') && (
                <StocksPanel items={inventoryItems} onChange={changeInventory} onToast={showToast} />
              )}
              {adminTool === 'messages' && (
                <MessagesPanel inquiries={inquiries} threads={threads} staffName={session?.name || 'Staff'} onToast={showToast} onChanged={refreshShared} />
              )}
              {adminTool === 'orders' && <OrdersPanel orders={onlineOrders} customers={customers} onToast={showToast} onChanged={refreshShared} />}
              {adminTool === 'activity' && <ActivityPanel entries={activity} />}
              {adminTool === 'staff-accounts' && session?.isOwner && renderStaffAccounts()}
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
  sidebarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sidebarBadge: { backgroundColor: Colors.primary, borderRadius: 9, minWidth: 18, height: 18, paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center' },
  sidebarBadgeText: { color: Colors.surface, fontSize: 10, fontWeight: 'bold' },
  adminSectionLabel: { color: Colors.textMuted, fontWeight: 'bold', fontSize: 10, marginTop: 14, marginBottom: 6, paddingHorizontal: 12 },
  signedInBox: { backgroundColor: Colors.primaryLight, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 8, marginTop: 8 },
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
  itemImageMock: { height: 70, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  itemCardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textDark, marginBottom: 2 },
  itemCardAvailability: { fontSize: 11, color: Colors.textMuted, marginBottom: 4 },
  itemCardPrice: { fontSize: 15, fontWeight: 'bold', color: Colors.primary, marginBottom: 8 },
  posChips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  posChip: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: Colors.border, marginRight: 4, marginBottom: 4 },
  posChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  posChipText: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
  cycleBtn: { backgroundColor: Colors.background, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 8, marginBottom: 4 },
  cycleText: { fontSize: 11, color: Colors.textDark, fontWeight: '600' },
  cardControlRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  quantityContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 6, padding: 2 },
  qtyBtn: { width: 24, height: 24, borderRadius: 4, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 14, fontWeight: 'bold', color: Colors.textDark },
  qtyText: { marginHorizontal: 8, fontSize: 13, fontWeight: 'bold', color: Colors.textDark },
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

  toast: { position: 'absolute', top: 24, alignSelf: 'center', backgroundColor: Colors.textDark, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 24, maxWidth: '85%', zIndex: 999, elevation: 10 },
  toastText: { color: Colors.surface, fontSize: 13, fontWeight: '600' },

  toolBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  toolPanel: { backgroundColor: Colors.surface, borderRadius: 16, width: '100%', maxWidth: 520, padding: 24, maxHeight: '88%' },
  toolPanelMid: { maxWidth: 760 },
  toolPanelWide: { maxWidth: 1040 },
  toolHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  toolTitle: { color: Colors.textDark, fontSize: 22, fontWeight: 'bold' },
  toolClose: { color: Colors.textMuted, fontSize: 30, lineHeight: 30 },
  toolText: { color: Colors.textMuted, fontSize: 14, marginBottom: 10 },
  sectionTitle: { color: Colors.textDark, fontSize: 16, fontWeight: 'bold', marginBottom: 10 },

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

  pill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  pillGreen: { backgroundColor: Colors.successLight },
  pillOrange: { backgroundColor: Colors.primaryLight },
  pillText: { fontSize: 11, fontWeight: 'bold' },

  tableToolbar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  toolbarSearch: { flexGrow: 1, flexBasis: 220, maxWidth: 360 },
  toolbarSearchInput: { backgroundColor: Colors.surface, height: 40, borderRadius: 20, paddingHorizontal: 16, borderWidth: 1, borderColor: Colors.border, fontSize: 13, color: Colors.textDark },
  countText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  exportBtn: { height: 40, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', backgroundColor: Colors.surface },
  exportBtnText: { color: Colors.textDark, fontSize: 12, fontWeight: '600' },
  tableWrap: { minWidth: 820, flexGrow: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, overflow: 'hidden', backgroundColor: Colors.surface },
  tableHeadRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border },
  th: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
  tableRow: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tdBold: { color: Colors.textDark, fontSize: 13, fontWeight: '700' },
  tdId: { color: Colors.primary, fontSize: 13, fontWeight: 'bold' },
  tdAmount: { color: Colors.textDark, fontSize: 14, fontWeight: 'bold' },
  emptyTable: { color: Colors.textMuted, fontSize: 13, padding: 24, textAlign: 'center' },
  saleItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  saleItemName: { color: Colors.textDark, fontSize: 13, fontWeight: '600' },
  saleItemSub: { color: Colors.textMuted, fontSize: 11, marginTop: 1 },
  saleItemPrice: { color: Colors.textDark, fontSize: 12, fontWeight: '600', marginLeft: 10 },

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