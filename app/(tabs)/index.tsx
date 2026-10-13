import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, ImageBackground, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { logActivity, logStaffActivity } from '../../components/shop/activityStore';
import AdminLoginForm from '../../components/shop/AdminLoginForm';
import { CartModal } from '../../components/shop/CartModal';
import ChatWidget from '../../components/shop/ChatWidget';
import CheckoutModal from '../../components/shop/CheckoutModal';
import ContactForm from '../../components/shop/ContactForm';
import { cartIdOf, InventoryItem, loadInventory, parseCartId, priceFor, PRODUCT_CATEGORIES, ProductCategory, stockTotal } from '../../components/shop/inventoryStore';
import MyOrdersModal from '../../components/shop/MyOrdersModal';
import { PaymentMethodsModal } from '../../components/shop/PaymentMethodsModal';
import ProductCard from '../../components/shop/ProductCard';
import RegisterForm from '../../components/shop/RegisterForm';
import { clearSession, getSessionCustomer, loadOrdersFor, loginCustomer, PublicCustomer, subscribeToChanges } from '../../components/shop/shopStore';
import { getStaffSession, logoutStaff, StaffSession } from '../../components/shop/staffStore';
import type { CartItem } from '../../components/shop/types';

// Initialize WebBrowser for Auth Session
WebBrowser.maybeCompleteAuthSession();

const Colors = {
  primary: '#5d3a1a',
  secondary: '#8b5e34',
  accent: '#FFC107',
  background: '#F8F5F2',
  cream: '#F3E9E0',
  white: '#FFFFFF',
  black: '#000000',
  border: '#EEEEEE',
  muted: '#8E8E93',
  danger: '#d9534f',
  success: '#2E9E6B',
  warning: '#E8A13A',
};

type Role = 'customer' | 'employee' | null;
type ShopFilter = 'ALL' | ProductCategory;
type AuthMode = 'login' | 'register' | 'admin';

const capitalize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const categoryEmoji = (c: ProductCategory) =>
  c === 'BEDSHEETS' ? '🛏️' : c === 'PILLOWCASES' ? '☁️' : c === 'COMFORTERS' ? '🧥' : '🧣';

// ======================================================================
// Left sidebar
// ======================================================================
function DrawerItem({
  icon,
  label,
  onPress,
  badge,
  sub,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  badge?: number;
  sub?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.drawerItem, sub && styles.drawerSubItem]} onPress={onPress}>
      <View style={[styles.drawerIcon, sub && styles.drawerIconSub]}>
        <Text style={styles.drawerIconText}>{icon}</Text>
      </View>
      <Text style={[styles.drawerItemText, sub && styles.drawerSubText]} numberOfLines={1}>
        {label}
      </Text>
      {badge !== undefined && badge > 0 && (
        <View style={styles.drawerBadge}>
          <Text style={styles.drawerBadgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

interface SideDrawerProps {
  userRole: Role;
  isLoggedIn: boolean;
  displayName: string;
  subtitle: string;
  hasAccount: boolean;
  cartItemCount: number;
  activeOrderCount: number;
  categoryCounts: Record<ProductCategory, number>;
  onClose: () => void;
  onShop: (filter: ShopFilter) => void;
  onOpenCart: () => void;
  onOpenOrders: () => void;
  onOpenPayments: () => void;
  onOpenAdmin: () => void;
  onLogin: () => void;
  onRegister: () => void;
  onLogout: () => void;
}

function SideDrawer(props: SideDrawerProps) {
  const { userRole, isLoggedIn, displayName, subtitle, hasAccount, cartItemCount, activeOrderCount, categoryCounts } = props;
  const slide = useRef(new Animated.Value(-300)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [slide, fade]);

  return (
    <View style={styles.drawerOverlay}>
      {/* Sidebar on the LEFT */}
      <Animated.View style={[styles.drawerContent, { transform: [{ translateX: slide }] }]}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.drawerHeader}>
            <View style={styles.drawerBrand}>
              <Text style={styles.drawerBrandIcon}>🛏️</Text>
              <View>
                <Text style={styles.drawerBrandName}>Baker's Thrift Shop</Text>
                <Text style={styles.drawerBrandTag}>Affordable linens</Text>
              </View>
            </View>
            <TouchableOpacity onPress={props.onClose} style={styles.drawerCloseBtn}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{isLoggedIn ? displayName.charAt(0).toUpperCase() : '👤'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.profileSub} numberOfLines={1}>{subtitle}</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {userRole === 'employee' ? (
              <>
                <Text style={styles.sectionLabel}>ADMINISTRATION</Text>
                <DrawerItem icon="🧰" label="Open admin dashboard" onPress={props.onOpenAdmin} />
                <DrawerItem icon="👥" label="Customer Report" onPress={props.onOpenAdmin} sub />
                <DrawerItem icon="📦" label="Inventory" onPress={props.onOpenAdmin} sub />
                <DrawerItem icon="💬" label="Inquiries & Chat" onPress={props.onOpenAdmin} sub />
                <DrawerItem icon="📈" label="Sales Report" onPress={props.onOpenAdmin} sub />
                <DrawerItem icon="🛍️" label="Online Orders" onPress={props.onOpenAdmin} sub />
                <DrawerItem icon="🗃️" label="Stocks" onPress={props.onOpenAdmin} sub />
              </>
            ) : (
              <>
                <Text style={styles.sectionLabel}>SHOP</Text>
                <DrawerItem icon="🛍️" label="All products" onPress={() => props.onShop('ALL')} />
                {PRODUCT_CATEGORIES.map((c) => (
                  <DrawerItem
                    key={c}
                    icon={categoryEmoji(c)}
                    label={capitalize(c)}
                    badge={categoryCounts[c]}
                    onPress={() => props.onShop(c)}
                    sub
                  />
                ))}
                {isLoggedIn && userRole === 'customer' && (
                  <DrawerItem icon="🛒" label="My Cart" badge={cartItemCount} onPress={props.onOpenCart} />
                )}

                <Text style={styles.sectionLabel}>MY ACCOUNT</Text>
                {hasAccount ? (
                  <DrawerItem icon="📦" label="My Orders" badge={activeOrderCount} onPress={props.onOpenOrders} />
                ) : (
                  <DrawerItem icon="✨" label="Create an account" onPress={props.onRegister} />
                )}

                <Text style={styles.sectionLabel}>PAYMENT</Text>
                <DrawerItem icon="💳" label="Payment Methods" onPress={props.onOpenPayments} />
              </>
            )}
          </ScrollView>

          <View style={styles.drawerFooter}>
            {isLoggedIn ? (
              <TouchableOpacity style={styles.logoutBtn} onPress={props.onLogout}>
                <Text style={styles.logoutBtnText}>🚪 Log out</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.loginSidebarBtn} onPress={props.onLogin}>
                <Text style={styles.loginSidebarBtnText}>Log in</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </Animated.View>

      {/* Dimmed area: tap to close */}
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={props.onClose}>
        <Animated.View style={[styles.drawerBackdrop, { opacity: fade }]} />
      </TouchableOpacity>
    </View>
  );
}

// ======================================================================
// Main page
// ======================================================================
export default function ThriftShopIndex() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  // --- Google Auth Hook ---
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
    iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
    webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
  });

  // --- States ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<Role>(null);
  const [currentCustomer, setCurrentCustomer] = useState<PublicCustomer | null>(null);
  const [staffInfo, setStaffInfo] = useState<{ name: string; role: string } | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [showPaymentMethodsModal, setShowPaymentMethodsModal] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authError, setAuthError] = useState('');

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [activeOrderCount, setActiveOrderCount] = useState(0);

  // Shop (live stock shared with the admin screen)
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoaded, setInventoryLoaded] = useState(false);
  const [shopFilter, setShopFilter] = useState<ShopFilter>('ALL');
  const [shopQuery, setShopQuery] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [shopY, setShopY] = useState(0);

  // Toast (Alert.alert does not show in a web browser, so we use our own banner)
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  // --- Login state: re-checked every time this page is shown (e.g. after logging out of the admin) ---
  const syncSession = useCallback(async () => {
    try {
      let role = await AsyncStorage.getItem('userRole');
      const staff = await getStaffSession();
      if (role === 'employee' && staff) {
        setStaffInfo({ name: staff.name, role: staff.role });
        setCurrentCustomer(null);
        setUserRole('employee');
        setIsLoggedIn(true);
        return;
      }
      if (role === 'employee') {
        // There is no valid admin sign-in behind this, so it is not trusted
        await AsyncStorage.removeItem('userRole');
        role = null;
      }
      setStaffInfo(null);
      const customer = await getSessionCustomer();
      if (customer) {
        setCurrentCustomer(customer);
        setUserRole('customer');
        setIsLoggedIn(true);
      } else if (role === 'customer') {
        setCurrentCustomer(null);
        setUserRole('customer');
        setIsLoggedIn(true);
      } else {
        setCurrentCustomer(null);
        setUserRole(null);
        setIsLoggedIn(false);
      }
    } catch (e) {
      console.log('Failed to load user data');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      syncSession();
    }, [syncSession])
  );

  // Live refresh: stock + the number of the customer's active orders, every few seconds
  const refreshShared = useCallback(async () => {
    setInventory(await loadInventory());
    setInventoryLoaded(true);
    if (currentCustomer) {
      const mine = await loadOrdersFor(currentCustomer.id);
      setActiveOrderCount(mine.filter((o) => o.status !== 'Delivered' && o.status !== 'Cancelled').length);
    } else {
      setActiveOrderCount(0);
    }
  }, [currentCustomer]);

  useFocusEffect(
    useCallback(() => {
      refreshShared();
      return subscribeToChanges(refreshShared, 3000);
    }, [refreshShared])
  );

  // Handle Google Response
  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleLoginSuccess();
    }
  }, [response]);

  const handleGoogleLoginSuccess = async () => {
    await AsyncStorage.setItem('userRole', 'customer');
    setUserRole('customer');
    setIsLoggedIn(true);
    setShowLogin(false);
    showToast('Signed in with Google. Create an account to place orders.');
  };

  const handleLogout = async () => {
    // Only remove the login data. AsyncStorage.clear() would also wipe the shared stock and orders.
    if (staffInfo) await logStaffActivity('Staff sign out');
    else if (currentCustomer) await logActivity('customer', currentCustomer.username, 'Logged out');
    await logoutStaff();
    await clearSession();
    setIsLoggedIn(false);
    setUserRole(null);
    setCurrentCustomer(null);
    setStaffInfo(null);
    setCartItems([]);
    setShowDrawer(false);
  };

  // --- Auth ---
  const openAuth = (mode: AuthMode) => {
    setAuthMode(mode);
    setAuthError('');
    setShowLogin(true);
  };

  const finishCustomerAuth = (customer: PublicCustomer, message: string) => {
    setCurrentCustomer(customer);
    setStaffInfo(null);
    setUserRole('customer');
    setIsLoggedIn(true);
    setShowLogin(false);
    setLoginId('');
    setPassword('');
    showToast(message);
  };

  const handleCustomerLogin = async () => {
    setAuthError('');
    const result = await loginCustomer(loginId, password);
    if (!result.ok) {
      setAuthError(result.error);
      return;
    }
    await AsyncStorage.setItem('userRole', 'customer');
    finishCustomerAuth(result.customer, `Welcome back, ${result.customer.firstName}!`);
  };

  const handleRegistered = async (customer: PublicCustomer) => {
    await AsyncStorage.setItem('userRole', 'customer');
    finishCustomerAuth(customer, `Account created! Welcome, ${customer.firstName}.`);
  };

  // Called only after the admin typed a correct email and password
  const handleAdminSuccess = async (session: StaffSession) => {
    await clearSession();
    setCurrentCustomer(null);
    setCartItems([]);
    setStaffInfo({ name: session.name, role: session.role });
    setUserRole('employee');
    setIsLoggedIn(true);
    setShowLogin(false);
    router.replace('/admin');
  };

  // --- Cart ---
  const cartQtyFor = (productId: string, size: string) =>
    cartItems
      .filter((c) => {
        const p = parseCartId(c.id);
        return p.productId === productId && p.size === size;
      })
      .reduce((t, c) => t + c.quantity, 0);

  // Called by the product cards. Returns true when the pieces were added.
  const addProductToCart = (item: InventoryItem, size: string, texture: string, style: string, qty: number): boolean => {
    // A registered account is required to buy
    if (!currentCustomer) {
      openAuth('register');
      showToast('Please create an account or log in to buy.');
      return false;
    }
    const remaining = (item.stock[size] || 0) - cartQtyFor(item.id, size);
    if (qty > remaining) {
      showToast(remaining <= 0 ? `You already have all available ${size} pieces in your cart.` : `Only ${remaining} more available in ${size}.`);
      return false;
    }
    const itemId = cartIdOf(item.id, size, texture, style);
    setCartItems((current) => {
      const existing = current.find((i) => i.id === itemId);
      if (existing) return current.map((i) => (i.id === itemId ? { ...i, quantity: i.quantity + qty } : i));
      return [...current, { id: itemId, name: item.name, size, color: `${texture} · ${style}`, price: priceFor(item, size), quantity: qty }];
    });
    showToast(`Added ${qty}x ${item.name} (${size}) to your cart.`);
    logActivity('customer', currentCustomer.username, 'Added to cart', `${qty}x ${item.name} · ${size} · ${texture} · ${style}`);
    return true;
  };

  const updateCartQuantity = (itemId: string, change: number) => {
    if (change > 0) {
      const { productId, size } = parseCartId(itemId);
      const product = inventory.find((p) => p.id === productId);
      const inStock = product ? product.stock[size] || 0 : 0;
      if (product && cartQtyFor(productId, size) + change > inStock) {
        showToast(`Only ${inStock} of ${product.name} (${size}) in stock.`);
        return;
      }
    }
    setCartItems((currentCart) =>
      currentCart.flatMap((item) => {
        if (item.id !== itemId) return [item];
        const quantity = item.quantity + change;
        return quantity > 0 ? [{ ...item, quantity }] : [];
      })
    );
  };

  const cartItemCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      showToast('Your cart is empty.');
      return;
    }
    setShowCartModal(false);
    if (!currentCustomer) {
      openAuth('register');
      showToast('Please create an account or log in to place your order.');
      return;
    }
    setShowCheckout(true);
  };

  // --- Shop helpers ---
  const scrollToShop = () => {
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, shopY - 100), animated: true }), 60);
  };

  const goShop = (filter: ShopFilter) => {
    setShopFilter(filter);
    setShowDrawer(false);
    scrollToShop();
  };

  const visibleProducts = inventory
    .filter((i) => i.active)
    .filter((i) => shopFilter === 'ALL' || i.category === shopFilter)
    .filter((i) => i.name.toLowerCase().includes(shopQuery.trim().toLowerCase()))
    .filter((i) => !inStockOnly || stockTotal(i) > 0);

  const categoryCounts: Record<ProductCategory, number> = { BEDSHEETS: 0, PILLOWCASES: 0, COMFORTERS: 0, BLANKETS: 0 };
  inventory.forEach((i) => {
    if (i.active && stockTotal(i) > 0) categoryCounts[i.category] += 1;
  });

  const displayName =
    userRole === 'employee'
      ? staffInfo?.name || 'Staff member'
      : currentCustomer
      ? `${currentCustomer.firstName} ${currentCustomer.lastName}`
      : isLoggedIn
      ? 'Customer'
      : 'Guest';
  const drawerSubtitle =
    userRole === 'employee'
      ? staffInfo?.role || 'Staff account'
      : currentCustomer
      ? `@${currentCustomer.username}`
      : isLoggedIn
      ? 'No account yet'
      : 'Browsing as guest';

  const toastEl = toast ? (
    <View style={styles.toast} pointerEvents="none">
      <Text style={styles.toastText}>{toast}</Text>
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {showDrawer && (
        <SideDrawer
          userRole={userRole}
          isLoggedIn={isLoggedIn}
          displayName={displayName}
          subtitle={drawerSubtitle}
          hasAccount={!!currentCustomer}
          cartItemCount={cartItemCount}
          activeOrderCount={activeOrderCount}
          categoryCounts={categoryCounts}
          onClose={() => setShowDrawer(false)}
          onShop={goShop}
          onOpenCart={() => { setShowDrawer(false); setShowCartModal(true); }}
          onOpenOrders={() => { setShowDrawer(false); setShowMyOrders(true); }}
          onOpenPayments={() => { setShowDrawer(false); setShowPaymentMethodsModal(true); }}
          onOpenAdmin={() => { setShowDrawer(false); router.push('/admin'); }}
          onLogin={() => { setShowDrawer(false); openAuth('login'); }}
          onRegister={() => { setShowDrawer(false); openAuth('register'); }}
          onLogout={handleLogout}
        />
      )}

      <View style={styles.navBar}>
        <View style={styles.navRight}>
          <TouchableOpacity onPress={() => setShowDrawer(true)} style={styles.hamburgerBtn}>
            <View style={styles.hamburgerLine} /><View style={styles.hamburgerLine} /><View style={styles.hamburgerLine} />
          </TouchableOpacity>
          <Text style={styles.logoText}>MENU</Text>
        </View>
        <View style={styles.navRight}>
          <TouchableOpacity style={styles.navLink} onPress={scrollToShop}>
            <Text style={styles.navLinkText}>SHOP</Text>
          </TouchableOpacity>
          {currentCustomer && (
            <TouchableOpacity style={styles.navCartBtn} onPress={() => setShowCartModal(true)}>
              <Text style={styles.navCartText}>🛒 {cartItemCount}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => {
              if (userRole === 'employee' && isLoggedIn) router.push('/admin');
              else if (currentCustomer) setShowMyOrders(true);
              else openAuth('login');
            }}
          >
            <Text style={styles.loginBtnText}>
              {userRole === 'employee' && isLoggedIn ? 'STAFF' : currentCustomer ? 'MY ORDERS' : 'LOGIN'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        <ImageBackground source={require('../../assets/towel_background.jpg')} style={styles.heroBackground}>
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>Pillow Paradise</Text>
            <Text style={styles.heroSubText}>Affordable Sheets in Baker's Thrift Shop</Text>
            <View style={styles.heroDivider} />
            <Text style={styles.heroDesc}>Transform your bedroom into a sanctuary with our premium collection of bedsheets, pillowcases, and comforters. High-end feel without the price tag.</Text>
            {userRole !== 'employee' && (
              <TouchableOpacity style={styles.heroShopBtn} onPress={scrollToShop}>
                <Text style={styles.heroShopBtnText}>SHOP NOW</Text>
              </TouchableOpacity>
            )}
          </View>
        </ImageBackground>

        <View style={styles.descriptionSection}>
          <Text style={styles.sectionTitleDark}>Customer Feedbacks</Text>
          <View style={styles.feedbackGrid}>
            <View style={styles.feedbackCard}><Text style={styles.feedbackName}>Jonie Jane</Text><Text style={styles.starRating}>★★★★★</Text><Text style={styles.feedbackText}>"I am satisfied with the texture! Will buy more soon."</Text></View>
            <View style={styles.feedbackCard}><Text style={styles.feedbackName}>Jhun Debri</Text><Text style={styles.starRating}>★★★★★</Text><Text style={styles.feedbackText}>"Worth the price! Will recommend this shop to my Family and Friends!"</Text></View>
          </View>
        </View>

        {/* ================= SHOP BY CATEGORY (live stock) ================= */}
        {userRole !== 'employee' && (
          <View style={styles.shopSection} onLayout={(e) => setShopY(e.nativeEvent.layout.y)}>
            <Text style={styles.shopTitle}>Shop by Category</Text>
            <Text style={styles.shopSubtitle}>Browse our bedsheets, pillowcases, comforters and blankets.</Text>
            <Text style={styles.liveText}>● Stock updates live</Text>

            {!currentCustomer && (
              <View style={styles.accountNotice}>
                <Text style={styles.accountNoticeText}>Create a free account to place orders and track your delivery.</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <TouchableOpacity style={styles.noticeBtn} onPress={() => openAuth('register')}>
                    <Text style={styles.noticeBtnText}>Sign up</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.noticeBtnOutline} onPress={() => openAuth('login')}>
                    <Text style={styles.noticeBtnOutlineText}>Log in</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TextInput
              style={styles.shopSearch}
              placeholder="Search products..."
              placeholderTextColor="#999"
              value={shopQuery}
              onChangeText={setShopQuery}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 14 }}>
              {(['ALL', ...PRODUCT_CATEGORIES] as ShopFilter[]).map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.filterChip, shopFilter === c && styles.filterChipActive]}
                  onPress={() => setShopFilter(c)}
                >
                  <Text style={[styles.filterChipText, shopFilter === c && styles.filterChipTextActive]}>
                    {c === 'ALL' ? '📦 All' : `${categoryEmoji(c)} ${capitalize(c)}`}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.filterChip, styles.stockChip, inStockOnly && styles.stockChipActive]}
                onPress={() => setInStockOnly((v) => !v)}
              >
                <Text style={[styles.filterChipText, inStockOnly && styles.filterChipTextActive]}>
                  {inStockOnly ? '✓ In stock only' : 'In stock only'}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {!inventoryLoaded ? (
              <Text style={styles.shopEmpty}>Loading available stock...</Text>
            ) : visibleProducts.length === 0 ? (
              <Text style={styles.shopEmpty}>No products match your search. Try another category.</Text>
            ) : (
              <View style={styles.productGrid}>
                {visibleProducts.map((item) => (
                  <ProductCard key={item.id} item={item} cartQty={cartQtyFor} onAdd={addProductToCart} />
                ))}
              </View>
            )}
          </View>
        )}

        <ImageBackground source={require('../../assets/index1.jpg')} style={styles.inquirySection}>
          <View style={styles.inquiryOverlay}>
            <Text style={styles.inquiryTitle}>Let's Get In Touch!</Text>
            <TouchableOpacity style={styles.downloadBtn} onPress={() => showToast('Scroll down to send us a message.')}>
              <Text style={styles.downloadText}>GET IN TOUCH</Text>
            </TouchableOpacity>
          </View>
        </ImageBackground>

        <ContactForm customer={currentCustomer} />
      </ScrollView>

      {!showLogin && toastEl}

      {/* AUTH MODAL: customer login, customer sign up, admin sign in */}
      <Modal visible={showLogin} animationType="slide" onRequestClose={() => setShowLogin(false)}>
        <SafeAreaView style={styles.authContainer}>
          <TouchableOpacity onPress={() => setShowLogin(false)} style={styles.closeAuth}>
            <Text style={{ fontSize: 24 }}>✕</Text>
          </TouchableOpacity>

          <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
            <View style={styles.authInner}>
              {authMode === 'register' ? (
                <RegisterForm onRegistered={handleRegistered} onSwitchToLogin={() => openAuth('login')} />
              ) : authMode === 'admin' ? (
                <AdminLoginForm onSuccess={handleAdminSuccess} onBack={() => openAuth('login')} />
              ) : (
                <>
                  <Text style={styles.welcomeBackTitle}>Welcome back</Text>

                  <TextInput
                    placeholder="Username or email"
                    style={[styles.loginInput, { marginTop: 20 }]}
                    placeholderTextColor="#999"
                    autoCapitalize="none"
                    value={loginId}
                    onChangeText={setLoginId}
                  />
                  <TextInput placeholder="Password" secureTextEntry style={styles.loginInput} placeholderTextColor="#999" value={password} onChangeText={setPassword} />

                  {!!authError && <Text style={styles.authError}>{authError}</Text>}

                  <TouchableOpacity style={styles.customerLoginBtn} onPress={handleCustomerLogin}>
                    <Text style={styles.customerLoginText}>CUSTOMER LOGIN</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.employeeLoginBtn} onPress={() => openAuth('admin')}>
                    <Text style={styles.employeeLoginText}>SIGN IN AS ADMIN</Text>
                  </TouchableOpacity>

                  <View style={styles.loginDividerRow}>
                    <View style={styles.dividerLine} /><Text style={styles.dividerOrText}>OR</Text><View style={styles.dividerLine} />
                  </View>

                  <TouchableOpacity style={[styles.googleSignUpBtn, { borderColor: Colors.primary }]} onPress={() => openAuth('register')}>
                    <Text style={[styles.googleSignUpText, { color: Colors.primary }]}>CREATE A CUSTOMER ACCOUNT</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.googleSignUpBtn, { marginTop: 10 }]} onPress={() => promptAsync()} disabled={!request}>
                    <Text style={styles.googleSignUpText}>SIGN IN WITH GOOGLE ACCOUNT</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
          {toastEl}
        </SafeAreaView>
      </Modal>

      {userRole !== 'employee' && <ChatWidget customer={currentCustomer} onNeedLogin={() => openAuth('login')} />}

      <CartModal
        visible={showCartModal}
        items={cartItems}
        onClose={() => setShowCartModal(false)}
        onUpdateQuantity={updateCartQuantity}
        onClear={() => setCartItems([])}
        onCheckout={handleCheckout}
      />
      <CheckoutModal
        visible={showCheckout}
        items={cartItems}
        customer={currentCustomer}
        onClose={() => setShowCheckout(false)}
        onPlaced={() => { setCartItems([]); refreshShared(); }}
        onViewOrders={() => { setShowCheckout(false); setShowMyOrders(true); }}
      />
      <MyOrdersModal visible={showMyOrders} customer={currentCustomer} onClose={() => setShowMyOrders(false)} />
      <PaymentMethodsModal visible={showPaymentMethodsModal} onClose={() => setShowPaymentMethodsModal(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },

  // ----- Top bar -----
  navBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.7)', height: 100, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 40 },
  hamburgerBtn: { marginRight: 15, width: 25, height: 18, justifyContent: 'space-between' },
  hamburgerLine: { width: '100%', height: 3, backgroundColor: 'white', borderRadius: 2 },
  navRight: { flexDirection: 'row', alignItems: 'center' },
  navLink: { marginRight: 5 },
  navLinkText: { color: 'white', fontWeight: 'bold', fontSize: 12, marginRight: 15 },
  navCartBtn: { backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, marginRight: 10 },
  navCartText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  logoText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  loginBtn: { backgroundColor: Colors.secondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 },
  loginBtnText: { color: 'white', fontWeight: 'bold', fontSize: 11 },

  // ----- Left sidebar -----
  drawerOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 100, flexDirection: 'row' },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  drawerContent: { width: 290, backgroundColor: Colors.white, height: '100%', paddingHorizontal: 18, paddingTop: 36, paddingBottom: 14, borderRightWidth: 1, borderRightColor: Colors.border },
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  drawerBrand: { flexDirection: 'row', alignItems: 'center' },
  drawerBrandIcon: { fontSize: 28, marginRight: 10 },
  drawerBrandName: { fontSize: 18, fontWeight: 'bold', color: Colors.primary },
  drawerBrandTag: { fontSize: 11, color: Colors.muted, marginTop: 1 },
  drawerCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  closeIcon: { fontSize: 14, color: Colors.primary, fontWeight: 'bold' },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.cream, borderRadius: 14, padding: 12, marginBottom: 6 },
  profileAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  profileAvatarText: { color: Colors.white, fontWeight: 'bold', fontSize: 17 },
  profileName: { color: Colors.primary, fontWeight: 'bold', fontSize: 14 },
  profileSub: { color: Colors.secondary, fontSize: 11, marginTop: 1 },
  sectionLabel: { fontSize: 10, fontWeight: 'bold', color: Colors.muted, marginTop: 18, marginBottom: 6, paddingHorizontal: 6, letterSpacing: 1 },
  drawerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 8, borderRadius: 10, marginBottom: 2 },
  drawerSubItem: { marginLeft: 18, paddingVertical: 7 },
  drawerIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: Colors.cream, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  drawerIconSub: { width: 26, height: 26, borderRadius: 7, backgroundColor: Colors.background },
  drawerIconText: { fontSize: 15 },
  drawerItemText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.primary },
  drawerSubText: { fontSize: 13, fontWeight: '500', color: Colors.secondary },
  drawerBadge: { backgroundColor: Colors.secondary, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center' },
  drawerBadgeText: { color: Colors.white, fontSize: 11, fontWeight: 'bold' },
  drawerFooter: { paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  logoutBtn: { paddingVertical: 12, borderRadius: 10, backgroundColor: '#FFF0F0', alignItems: 'center' },
  logoutBtnText: { color: Colors.danger, fontWeight: 'bold', fontSize: 13 },
  loginSidebarBtn: { paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center' },
  loginSidebarBtnText: { color: Colors.white, fontWeight: 'bold', fontSize: 13 },

  // ----- Toast -----
  toast: { position: 'absolute', top: 110, alignSelf: 'center', backgroundColor: '#212529', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 24, maxWidth: '88%', zIndex: 999, elevation: 10 },
  toastText: { color: Colors.white, fontSize: 13, fontWeight: '600', textAlign: 'center' },

  // ----- Hero / feedback -----
  heroBackground: { width: '100%', height: 600 },
  heroOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 40 },
  heroTitle: { color: 'white', fontSize: 42, fontWeight: 'bold', textAlign: 'center' },
  heroSubText: { color: Colors.accent, fontSize: 18, marginTop: 10 },
  heroDivider: { width: 50, height: 3, backgroundColor: 'white', marginVertical: 20 },
  heroDesc: { color: 'white', textAlign: 'center', fontSize: 14, lineHeight: 22 },
  heroShopBtn: { backgroundColor: Colors.white, paddingHorizontal: 30, paddingVertical: 14, borderRadius: 30, marginTop: 26 },
  heroShopBtnText: { color: Colors.primary, fontWeight: 'bold', letterSpacing: 1 },
  descriptionSection: { padding: 40, alignItems: 'center' },
  sectionTitleDark: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  feedbackGrid: { width: '100%', flexDirection: 'row', justifyContent: 'space-between' },
  feedbackCard: { width: '48%', backgroundColor: Colors.background, padding: 15, borderRadius: 8 },
  feedbackName: { fontWeight: 'bold', fontSize: 13 },
  starRating: { color: Colors.accent, marginVertical: 5 },
  feedbackText: { fontSize: 11, fontStyle: 'italic' },

  // ----- Shop -----
  shopSection: { backgroundColor: Colors.background, paddingHorizontal: 20, paddingVertical: 36 },
  shopTitle: { fontSize: 26, fontWeight: 'bold', color: Colors.primary, textAlign: 'center' },
  shopSubtitle: { fontSize: 13, color: '#666', textAlign: 'center', marginTop: 6, lineHeight: 19 },
  liveText: { fontSize: 11, color: Colors.success, fontWeight: 'bold', textAlign: 'center', marginTop: 4, marginBottom: 18 },
  accountNotice: { backgroundColor: Colors.cream, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#E3D2C3' },
  accountNoticeText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  noticeBtn: { backgroundColor: Colors.primary, paddingVertical: 9, paddingHorizontal: 20, borderRadius: 8 },
  noticeBtnText: { color: Colors.white, fontWeight: 'bold', fontSize: 12 },
  noticeBtnOutline: { borderWidth: 1, borderColor: Colors.primary, paddingVertical: 9, paddingHorizontal: 20, borderRadius: 8 },
  noticeBtnOutlineText: { color: Colors.primary, fontWeight: 'bold', fontSize: 12 },
  shopSearch: { backgroundColor: Colors.white, borderWidth: 1, borderColor: '#ddd', borderRadius: 24, paddingHorizontal: 18, height: 44, fontSize: 14, color: Colors.black, marginBottom: 14 },
  filterChip: { backgroundColor: Colors.white, borderWidth: 1, borderColor: '#ddd', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, marginRight: 8 },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: 13, fontWeight: '600', color: Colors.secondary },
  filterChipTextActive: { color: Colors.white },
  stockChip: { borderStyle: 'dashed' },
  stockChipActive: { backgroundColor: Colors.success, borderColor: Colors.success, borderStyle: 'solid' },
  shopEmpty: { textAlign: 'center', color: Colors.muted, paddingVertical: 40, fontSize: 14 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' },

  // ----- "Get in touch" banner -----
  inquirySection: { width: '100%', height: 350 },
  inquiryOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  inquiryTitle: { color: 'white', fontSize: 28, fontWeight: 'bold' },
  downloadBtn: { backgroundColor: 'white', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 30, marginTop: 30 },
  downloadText: { fontWeight: 'bold' },

  // ----- Auth -----
  authContainer: { flex: 1, backgroundColor: 'white' },
  closeAuth: { padding: 20, alignSelf: 'flex-end' },
  authContent: { paddingBottom: 40 },
  authInner: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  welcomeBackTitle: { fontSize: 32, fontWeight: 'bold', color: '#5d3a1a', paddingHorizontal: 20 },
  loginInput: { backgroundColor: '#eef4ff', height: 55, borderRadius: 2, paddingHorizontal: 15, marginBottom: 15, marginHorizontal: 20 },
  authError: { color: Colors.danger, fontSize: 13, fontWeight: '600', marginHorizontal: 20, marginBottom: 12 },
  customerLoginBtn: { backgroundColor: '#5d3a1a', height: 55, justifyContent: 'center', alignItems: 'center', marginHorizontal: 20, borderRadius: 4, marginBottom: 10 },
  employeeLoginBtn: { backgroundColor: 'white', height: 55, justifyContent: 'center', alignItems: 'center', marginHorizontal: 20, borderRadius: 4, borderWidth: 1, borderColor: '#5d3a1a' },
  customerLoginText: { color: 'white', fontWeight: 'bold' },
  employeeLoginText: { color: '#5d3a1a', fontWeight: 'bold' },
  loginDividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, marginHorizontal: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#eee' },
  dividerOrText: { marginHorizontal: 10, color: '#999' },
  googleSignUpBtn: { height: 55, borderWidth: 1, borderColor: '#ddd', justifyContent: 'center', alignItems: 'center', marginHorizontal: 20, borderRadius: 4 },
  googleSignUpText: { color: '#333', fontWeight: '600', textAlign: 'center', paddingHorizontal: 10 },
});