import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  ImageBackground,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CartModal } from '../../components/shop/CartModal';
import {
  InventoryItem,
  loadInventory,
  PRODUCT_CATEGORIES,
  ProductCategory,
  purchaseItems,
} from '../../components/shop/inventoryStore';
import { PaymentMethodsModal } from '../../components/shop/PaymentMethodsModal';
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

const LOW_STOCK_LIMIT = 8;

// NOTE: your old code used blankets1.jpg for Comforters and comforters.jpg for Blankets.
// I matched the file names to the category names. Swap these two lines if that was on purpose.
const CATEGORY_IMAGES: Record<ProductCategory, any> = {
  BEDSHEETS: require('../../assets/bedsheets3.jpg'),
  PILLOWCASES: require('../../assets/pillowcases.jpg'),
  COMFORTERS: require('../../assets/comforters.jpg'),
  BLANKETS: require('../../assets/blankets1.jpg'),
};

const capitalize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const categoryEmoji = (c: ProductCategory) =>
  c === 'BEDSHEETS' ? '🛏️' : c === 'PILLOWCASES' ? '☁️' : c === 'COMFORTERS' ? '🧥' : '🧣';
const peso = (n: number) => '₱' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

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
  username: string;
  cartItemCount: number;
  categoryCounts: Record<ProductCategory, number>;
  onClose: () => void;
  onShop: (filter: ShopFilter) => void;
  onOpenCart: () => void;
  onOpenPayments: () => void;
  onOpenLoyalty: () => void;
  onOpenAdmin: () => void;
  onLogin: () => void;
  onLogout: () => void;
}

function SideDrawer(props: SideDrawerProps) {
  const { userRole, isLoggedIn, username, cartItemCount, categoryCounts } = props;
  const slide = useRef(new Animated.Value(-300)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [slide, fade]);

  const displayName = isLoggedIn ? username.trim() || (userRole === 'employee' ? 'Staff member' : 'Customer') : 'Guest';
  const subtitle = !isLoggedIn ? 'Browsing as guest' : userRole === 'employee' ? 'Staff account' : 'Customer account';

  return (
    <View style={styles.drawerOverlay}>
      {/* Sidebar on the LEFT */}
      <Animated.View style={[styles.drawerContent, { transform: [{ translateX: slide }] }]}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.drawerHeader}>
            <View style={styles.drawerBrand}>
              <Text style={styles.drawerBrandIcon}>🧺</Text>
              <View>
                <Text style={styles.drawerBrandName}>BakerThrift</Text>
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
              <Text style={styles.profileSub}>{subtitle}</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {userRole === 'employee' ? (
              <>
                <Text style={styles.sectionLabel}>ADMINISTRATION</Text>
                <DrawerItem icon="🧰" label="Open admin dashboard" onPress={props.onOpenAdmin} />
                <DrawerItem icon="👥" label="Customer Report" onPress={props.onOpenAdmin} sub />
                <DrawerItem icon="📦" label="Inventory" onPress={props.onOpenAdmin} sub />
                <DrawerItem icon="💬" label="Customer Inquiries" onPress={props.onOpenAdmin} sub />
                <DrawerItem icon="📈" label="Sales Report" onPress={props.onOpenAdmin} sub />
                <DrawerItem icon="🗃️" label="Stocks" onPress={props.onOpenAdmin} sub />
                <DrawerItem icon="➕" label="Create Account for Staff" onPress={props.onOpenAdmin} sub />
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

                <Text style={styles.sectionLabel}>PAYMENT</Text>
                <DrawerItem icon="💳" label="Payment Methods" onPress={props.onOpenPayments} />

                <Text style={styles.sectionLabel}>LOYALTY PROGRAM</Text>
                <DrawerItem icon="🎁" label="Loyalty Discount" onPress={props.onOpenLoyalty} />
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
                <Text style={styles.loginSidebarBtnText}>Log in or sign up</Text>
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
  const [showLogin, setShowLogin] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [showPaymentMethodsModal, setShowPaymentMethodsModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'employee_signup'>('login');

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');

  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Shop (live stock shared with the admin screen)
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoaded, setInventoryLoaded] = useState(false);
  const [shopFilter, setShopFilter] = useState<ShopFilter>('ALL');
  const [shopQuery, setShopQuery] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [shopY, setShopY] = useState(0);
  const [selections, setSelections] = useState<Record<string, { size: string; color: string; qty: number }>>({});

  // Toast (Alert.alert does not show in a web browser, so we use our own banner)
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  // --- Effects ---
  useEffect(() => {
    loadUserData();
  }, []);

  // Refresh stock every time this screen is shown (e.g. coming back from the admin page)
  const refreshInventory = useCallback(async () => {
    const items = await loadInventory();
    setInventory(items);
    setInventoryLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshInventory();
    }, [refreshInventory])
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
    showToast('Successfully signed in with Google!');
  };

  const loadUserData = async () => {
    try {
      const storedRole = await AsyncStorage.getItem('userRole');
      if (storedRole) {
        setUserRole(storedRole as Role);
        setIsLoggedIn(true);
      }
    } catch (e) {
      console.log('Failed to load user data');
    }
  };

  const handleLogout = async () => {
    // Only remove the login role. AsyncStorage.clear() would also wipe the shared stock data.
    await AsyncStorage.removeItem('userRole');
    setIsLoggedIn(false);
    setUserRole(null);
    setCartItems([]);
    setShowDrawer(false);
  };

  // --- Cart ---
  const productIdOf = (cartId: string) => cartId.split('-')[0];
  const cartQtyFor = (productId: string) =>
    cartItems.filter((c) => productIdOf(c.id) === productId).reduce((t, c) => t + c.quantity, 0);

  const getSel = (item: InventoryItem) => selections[item.id] || { size: 'M', color: item.colors[0], qty: 1 };

  const updateSel = (item: InventoryItem, patch: Partial<{ size: string; color: string; qty: number }>) => {
    setSelections((prev) => {
      const current = prev[item.id] || { size: 'M', color: item.colors[0], qty: 1 };
      return { ...prev, [item.id]: { ...current, ...patch } };
    });
  };

  const changeQty = (item: InventoryItem, delta: number) => {
    const remaining = item.available - cartQtyFor(item.id);
    const current = getSel(item).qty;
    const next = Math.min(Math.max(1, current + delta), Math.max(1, remaining));
    updateSel(item, { qty: next });
  };

  const addProductToCart = (item: InventoryItem) => {
    if (!isLoggedIn || userRole !== 'customer') {
      setShowLogin(true);
      showToast('Please log in as a customer to add items to your cart.');
      return;
    }
    const sel = getSel(item);
    const remaining = item.available - cartQtyFor(item.id);
    if (sel.qty > remaining) {
      showToast(remaining <= 0 ? 'You already have all available stock in your cart.' : `Only ${remaining} more available.`);
      return;
    }
    const itemId = `${item.id}-${sel.size}-${sel.color}`;
    setCartItems((current) => {
      const existing = current.find((i) => i.id === itemId);
      if (existing) {
        return current.map((i) => (i.id === itemId ? { ...i, quantity: i.quantity + sel.qty } : i));
      }
      return [
        ...current,
        { id: itemId, name: item.name, size: sel.size, color: sel.color, price: item.basePrice, quantity: sel.qty },
      ];
    });
    updateSel(item, { qty: 1 });
    showToast(`Added ${sel.qty}x ${item.name} to your cart.`);
  };

  const updateCartQuantity = (itemId: string, change: number) => {
    if (change > 0) {
      const product = inventory.find((p) => p.id === productIdOf(itemId));
      if (product && cartQtyFor(product.id) + change > product.available) {
        showToast(`Only ${product.available} of ${product.name} in stock.`);
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
  const cartTotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);

  const placeOrder = async () => {
    const result = await purchaseItems(
      cartItems.map((i) => ({ productId: productIdOf(i.id), quantity: i.quantity }))
    );
    setInventory(result.inventory);
    if (!result.ok) {
      showToast(result.message || 'Some items are no longer available.');
      return;
    }
    setCartItems([]);
    setShowCartModal(false);
    showToast('Order placed! Thank you, your order has been received.');
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      showToast('Your cart is empty.');
      return;
    }
    const message = `Your total is PHP ${cartTotal.toFixed(2)}. Would you like to place this order?`;
    if (Platform.OS === 'web') {
      if ((globalThis as any).confirm?.(`Place order\n\n${message}`)) placeOrder();
    } else {
      Alert.alert('Place order', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Place order', onPress: placeOrder },
      ]);
    }
  };

  // --- Auth ---
  const handleSignUp = async () => {
    if (authMode === 'employee_signup') {
      if (!email.endsWith('@bakerthriftship.com')) {
        showToast('Employee accounts must use a @bakerthriftship.com email address.');
        return;
      }
      setUserRole('employee');
    } else {
      setUserRole('customer');
    }

    await AsyncStorage.setItem('userRole', authMode === 'employee_signup' ? 'employee' : 'customer');
    setIsLoggedIn(true);
    setShowLogin(false);
    showToast(`Welcome ${authMode === 'employee_signup' ? 'Employee' : 'Customer'}! Your account has been created.`);
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
    .filter((i) => !inStockOnly || i.available > 0);

  const categoryCounts: Record<ProductCategory, number> = { BEDSHEETS: 0, PILLOWCASES: 0, COMFORTERS: 0, BLANKETS: 0 };
  inventory.forEach((i) => {
    if (i.active && i.available > 0) categoryCounts[i.category] += 1;
  });

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
          username={username}
          cartItemCount={cartItemCount}
          categoryCounts={categoryCounts}
          onClose={() => setShowDrawer(false)}
          onShop={goShop}
          onOpenCart={() => { setShowDrawer(false); setShowCartModal(true); }}
          onOpenPayments={() => { setShowDrawer(false); setShowPaymentMethodsModal(true); }}
          onOpenLoyalty={() => { setShowDrawer(false); setShowLoyaltyModal(true); }}
          onOpenAdmin={() => { setShowDrawer(false); router.push('/admin'); }}
          onLogin={() => { setShowDrawer(false); setShowLogin(true); }}
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
          {isLoggedIn && userRole === 'customer' && (
            <TouchableOpacity style={styles.navCartBtn} onPress={() => setShowCartModal(true)}>
              <Text style={styles.navCartText}>🛒 {cartItemCount}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => (isLoggedIn && userRole === 'employee' ? router.push('/admin') : setShowLogin(true))}
          >
            <Text style={styles.loginBtnText}>{isLoggedIn ? (userRole === 'employee' ? 'STAFF' : 'PROFILE') : 'LOGIN'}</Text>
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
            <Text style={styles.shopSubtitle}>Browse our bedsheets, pillowcases, comforters and blankets. Stock shown is what we have right now.</Text>

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
                {visibleProducts.map((item) => {
                  const sel = getSel(item);
                  const inCart = cartQtyFor(item.id);
                  const remaining = item.available - inCart;
                  const soldOut = item.available === 0;
                  const low = !soldOut && item.available <= LOW_STOCK_LIMIT;
                  const badgeStyle = soldOut ? styles.badgeRed : low ? styles.badgeAmber : styles.badgeGreen;
                  const badgeText = soldOut ? 'Sold out' : low ? `Only ${item.available} left` : `${item.available} in stock`;

                  return (
                    <View key={item.id} style={styles.productCard}>
                      <View>
                        <Image source={CATEGORY_IMAGES[item.category]} style={[styles.productImage, soldOut && { opacity: 0.45 }]} resizeMode="cover" />
                        <View style={[styles.stockBadge, badgeStyle]}>
                          <Text style={styles.stockBadgeText}>{badgeText}</Text>
                        </View>
                        <View style={styles.categoryTag}>
                          <Text style={styles.categoryTagText}>{categoryEmoji(item.category)} {capitalize(item.category)}</Text>
                        </View>
                      </View>

                      <View style={styles.productBody}>
                        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                        <Text style={styles.productPrice}>{peso(item.basePrice)}</Text>

                        <Text style={styles.optionLabel}>Color</Text>
                        <View style={styles.chipRow}>
                          {item.colors.map((col) => (
                            <TouchableOpacity
                              key={col}
                              disabled={soldOut}
                              style={[styles.chip, sel.color === col && styles.activeChip]}
                              onPress={() => updateSel(item, { color: col })}
                            >
                              <Text style={[styles.chipText, sel.color === col && styles.activeChipText]}>{col}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <Text style={styles.optionLabel}>Size</Text>
                        <View style={styles.chipRow}>
                          {item.sizes.map((sz) => (
                            <TouchableOpacity
                              key={sz}
                              disabled={soldOut}
                              style={[styles.chip, styles.sizeChip, sel.size === sz && styles.activeChip]}
                              onPress={() => updateSel(item, { size: sz })}
                            >
                              <Text style={[styles.chipText, sel.size === sz && styles.activeChipText]}>{sz}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        {inCart > 0 && <Text style={styles.inCartNote}>{inCart} in your cart</Text>}

                        <View style={styles.buyRow}>
                          <View style={styles.qtyBox}>
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQty(item, -1)} disabled={soldOut}>
                              <Text style={styles.qtyBtnText}>−</Text>
                            </TouchableOpacity>
                            <Text style={styles.qtyText}>{sel.qty}</Text>
                            <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQty(item, 1)} disabled={soldOut}>
                              <Text style={styles.qtyBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>

                          {soldOut ? (
                            <View style={[styles.addBtn, styles.addBtnDisabled]}>
                              <Text style={styles.addBtnText}>Sold out</Text>
                            </View>
                          ) : remaining <= 0 ? (
                            <View style={[styles.addBtn, styles.addBtnDisabled]}>
                              <Text style={styles.addBtnText}>All in cart</Text>
                            </View>
                          ) : (
                            <TouchableOpacity style={styles.addBtn} onPress={() => addProductToCart(item)}>
                              <Text style={styles.addBtnText}>Add to cart</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
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

        <View style={styles.contactFormContainer}>
          <Text style={styles.contactFormSubtitle}>Have questions? Send us a message and we'll get back to you shortly.</Text>
          <TextInput style={styles.contactInput} placeholder="Your Full Name" placeholderTextColor="#999" value={contactName} onChangeText={setContactName} />
          <TextInput style={styles.contactInput} placeholder="Email Address" placeholderTextColor="#999" keyboardType="email-address" value={contactEmail} onChangeText={setContactEmail} />
          <TextInput style={[styles.contactInput, styles.messageInput]} placeholder="How can we help you?" placeholderTextColor="#999" multiline numberOfLines={4} value={contactMessage} onChangeText={setContactMessage} />
          <TouchableOpacity
            style={styles.submitContactBtn}
            onPress={() => {
              showToast(`Thank you ${contactName || 'for reaching out'}! Message sent.`);
              setContactName('');
              setContactEmail('');
              setContactMessage('');
            }}
          >
            <Text style={styles.submitContactText}>SEND MESSAGE</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {!showLogin && toastEl}

      {/* LOYALTY MODAL */}
      <Modal visible={showLoyaltyModal} animationType="slide" transparent={true}>
        <View style={styles.loyaltyModalBackdrop}>
          <View style={styles.loyaltyContentCard}>
            <Text style={styles.loyaltyMainTitle}>Experience Pure Luxury ✨</Text>
            <Text style={styles.loyaltyBodyText}>
              At Soft Slumber, our linens are hand-picked to ensure a rich, cloud-like texture that rivals 5-star hotel quality.
              {'\n\n'}Get that high-end silk and cotton sateen feel at an affordable price. Shop now and unlock a 20% DISCOUNT automatically on your 5th and 10th purchase!
            </Text>
            <TouchableOpacity
              style={styles.closeLoyaltyBtn}
              onPress={() => { setShowLoyaltyModal(false); scrollToShop(); }}
            >
              <Text style={styles.closeLoyaltyBtnText}>START SHOPPING</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* AUTH MODAL */}
      <Modal visible={showLogin} animationType="slide">
        <SafeAreaView style={styles.authContainer}>
          <TouchableOpacity onPress={() => setShowLogin(false)} style={styles.closeAuth}>
            <Text style={{ fontSize: 24 }}>✕</Text>
          </TouchableOpacity>

          <ScrollView contentContainerStyle={styles.authContent}>
            <Text style={styles.welcomeBackTitle}>
              {authMode === 'login' ? 'Welcome' : authMode === 'signup' ? 'Create Account' : 'Staff Registration'}
            </Text>

            <TextInput placeholder="Username" style={[styles.loginInput, { marginTop: 20 }]} placeholderTextColor="#999" value={username} onChangeText={setUsername} />

            {authMode !== 'login' && (
              <TextInput placeholder="Email Address" style={styles.loginInput} placeholderTextColor="#999" value={email} onChangeText={setEmail} autoCapitalize="none" />
            )}

            <TextInput placeholder="Password" secureTextEntry style={styles.loginInput} placeholderTextColor="#999" value={password} onChangeText={setPassword} />

            {authMode === 'login' ? (
              <>
                <TouchableOpacity
                  style={styles.customerLoginBtn}
                  onPress={async () => {
                    await AsyncStorage.setItem('userRole', 'customer');
                    setIsLoggedIn(true);
                    setUserRole('customer');
                    setShowLogin(false);
                  }}
                >
                  <Text style={styles.customerLoginText}>CUSTOMER LOGIN</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.employeeLoginBtn}
                  onPress={async () => {
                    await AsyncStorage.setItem('userRole', 'employee');
                    setIsLoggedIn(true);
                    setUserRole('employee');
                    setShowLogin(false);
                    router.replace('/admin');
                  }}
                >
                  <Text style={styles.employeeLoginText}>SIGN IN AS ADMIN</Text>
                </TouchableOpacity>

                <View style={styles.loginDividerRow}>
                  <View style={styles.dividerLine} /><Text style={styles.dividerOrText}>OR</Text><View style={styles.dividerLine} />
                </View>

                <TouchableOpacity style={styles.googleSignUpBtn} onPress={() => promptAsync()} disabled={!request}>
                  <Text style={styles.googleSignUpText}>SIGN IN WITH GOOGLE ACCOUNT</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.googleSignUpBtn, { marginTop: 10, borderColor: Colors.secondary }]}
                  onPress={() => setAuthMode('employee_signup')}
                >
                  <Text style={[styles.googleSignUpText, { color: Colors.secondary }]}>JOIN THE STAFF TEAM</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.customerLoginBtn} onPress={handleSignUp}>
                  <Text style={styles.customerLoginText}>{authMode === 'employee_signup' ? 'REGISTER' : 'CREATE ACCOUNT'}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setAuthMode('login')} style={{ marginTop: 20 }}>
                  <Text style={styles.cancelText}>Already have an account? Login</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
          {toastEl}
        </SafeAreaView>
      </Modal>

      <CartModal
        visible={showCartModal}
        items={cartItems}
        onClose={() => setShowCartModal(false)}
        onUpdateQuantity={updateCartQuantity}
        onClear={() => setCartItems([])}
        onCheckout={handleCheckout}
      />
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

  // ----- Loyalty -----
  loyaltyModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  loyaltyContentCard: { backgroundColor: '#FDFCF0', width: '100%', maxWidth: 520, borderRadius: 20, padding: 25 },
  loyaltyMainTitle: { fontSize: 22, fontWeight: 'bold', color: Colors.primary, marginBottom: 15, textAlign: 'center' },
  loyaltyBodyText: { fontSize: 15, color: '#444', lineHeight: 22, textAlign: 'center' },
  closeLoyaltyBtn: { backgroundColor: Colors.primary, padding: 15, borderRadius: 10, marginTop: 20, alignItems: 'center' },
  closeLoyaltyBtnText: { color: 'white', fontWeight: 'bold' },

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
  shopSubtitle: { fontSize: 13, color: '#666', textAlign: 'center', marginTop: 6, marginBottom: 20, lineHeight: 19 },
  shopSearch: { backgroundColor: Colors.white, borderWidth: 1, borderColor: '#ddd', borderRadius: 24, paddingHorizontal: 18, height: 44, fontSize: 14, color: Colors.black, marginBottom: 14 },
  filterChip: { backgroundColor: Colors.white, borderWidth: 1, borderColor: '#ddd', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, marginRight: 8 },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: 13, fontWeight: '600', color: Colors.secondary },
  filterChipTextActive: { color: Colors.white },
  stockChip: { borderStyle: 'dashed' },
  stockChipActive: { backgroundColor: Colors.success, borderColor: Colors.success, borderStyle: 'solid' },
  shopEmpty: { textAlign: 'center', color: Colors.muted, paddingVertical: 40, fontSize: 14 },

  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' },
  productCard: { flexGrow: 1, flexBasis: 250, maxWidth: 360, backgroundColor: Colors.white, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#EADFD5' },
  productImage: { width: '100%', height: 170 },
  stockBadge: { position: 'absolute', top: 10, right: 10, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  stockBadgeText: { color: Colors.white, fontSize: 11, fontWeight: 'bold' },
  badgeGreen: { backgroundColor: Colors.success },
  badgeAmber: { backgroundColor: Colors.warning },
  badgeRed: { backgroundColor: Colors.danger },
  categoryTag: { position: 'absolute', bottom: 10, left: 10, backgroundColor: 'rgba(255,255,255,0.92)', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  categoryTagText: { color: Colors.primary, fontSize: 11, fontWeight: 'bold' },
  productBody: { padding: 16 },
  productName: { fontSize: 16, fontWeight: 'bold', color: Colors.black },
  productPrice: { fontSize: 18, fontWeight: 'bold', color: Colors.secondary, marginTop: 4 },
  optionLabel: { fontSize: 11, fontWeight: 'bold', color: '#888', marginTop: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  chip: { borderWidth: 1, borderColor: '#ddd', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, marginRight: 8, marginBottom: 6 },
  sizeChip: { minWidth: 40, alignItems: 'center' },
  activeChip: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  chipText: { fontSize: 12, color: '#444' },
  activeChipText: { color: Colors.white, fontWeight: 'bold' },
  inCartNote: { color: Colors.success, fontSize: 11, fontWeight: '600', marginTop: 4 },
  buyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 10, padding: 3 },
  qtyBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.white, justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 16, fontWeight: 'bold', color: Colors.primary, lineHeight: 18 },
  qtyText: { minWidth: 28, textAlign: 'center', fontSize: 14, fontWeight: 'bold', color: Colors.black },
  addBtn: { flex: 1, backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  addBtnDisabled: { backgroundColor: '#C9C9CE' },
  addBtnText: { color: 'white', fontWeight: 'bold', fontSize: 13 },

  // ----- Contact -----
  inquirySection: { width: '100%', height: 350 },
  inquiryOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  inquiryTitle: { color: 'white', fontSize: 28, fontWeight: 'bold' },
  downloadBtn: { backgroundColor: 'white', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 30, marginTop: 30 },
  downloadText: { fontWeight: 'bold' },
  contactFormContainer: { padding: 30, backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: '#e0d8cf' },
  contactFormSubtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 25, lineHeight: 20 },
  contactInput: { backgroundColor: Colors.white, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 15, marginBottom: 15, fontSize: 14, color: Colors.black },
  messageInput: { height: 120, textAlignVertical: 'top' },
  submitContactBtn: { backgroundColor: Colors.primary, padding: 18, borderRadius: 8, alignItems: 'center', marginTop: 10, elevation: 5 },
  submitContactText: { color: 'white', fontWeight: 'bold', letterSpacing: 1 },

  // ----- Auth -----
  cancelText: { textAlign: 'center', color: '#999', marginTop: 15 },
  authContainer: { flex: 1, backgroundColor: 'white' },
  closeAuth: { padding: 20, alignSelf: 'flex-end' },
  welcomeBackTitle: { fontSize: 32, fontWeight: 'bold', color: '#5d3a1a', paddingHorizontal: 20 },
  loginInput: { backgroundColor: '#eef4ff', height: 55, borderRadius: 2, paddingHorizontal: 15, marginBottom: 15, marginHorizontal: 20 },
  customerLoginBtn: { backgroundColor: '#5d3a1a', height: 55, justifyContent: 'center', alignItems: 'center', marginHorizontal: 20, borderRadius: 4, marginBottom: 10 },
  employeeLoginBtn: { backgroundColor: 'white', height: 55, justifyContent: 'center', alignItems: 'center', marginHorizontal: 20, borderRadius: 4, borderWidth: 1, borderColor: '#5d3a1a' },
  customerLoginText: { color: 'white', fontWeight: 'bold' },
  employeeLoginText: { color: '#5d3a1a', fontWeight: 'bold' },
  loginDividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, marginHorizontal: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#eee' },
  dividerOrText: { marginHorizontal: 10, color: '#999' },
  googleSignUpBtn: { height: 55, borderWidth: 1, borderColor: '#ddd', justifyContent: 'center', alignItems: 'center', marginHorizontal: 20, borderRadius: 4 },
  googleSignUpText: { color: '#333', fontWeight: '600', textAlign: 'center', paddingHorizontal: 10 },
  authContent: { paddingBottom: 40 },
});