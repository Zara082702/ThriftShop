import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const Colors = {
  // Your POS Palette
  primary: '#E2875E',       // Terracotta accent
  primaryLight: '#FCEFE9',  // Light orange cream tint
  background: '#F9F6F3',    // Dashboard layout background
  surface: '#FFFFFF',       // Card colors
  textDark: '#1A1A1A',      // Main text
  textMuted: '#8E8E93',     // Secondary notes
  border: '#EBEBEB',        // Dividers
  disabled: '#D1D1D6',
  danger: '#E53935',

  // Reference Image Palette Matching
  imgBackground: '#3A444D', // Dark slate background from image
  imgAccent: '#14C3A2',     // Teal/emerald submit button
  imgBorder: '#E2E8F0',
};

interface CartItem {
  id: string;
  name: string;
  category: string;
  size: string;
  color: string;
  price: number;
  quantity: number;
}

interface ThriftPOSProps {
  userRole: 'customer' | 'employee' | null;
  handleLogout: () => Promise<void>;
  handleLogin: (role: 'customer' | 'employee') => void; // Added handler to clear login state
}

export function ThriftPOS({ userRole, handleLogout, handleLogin }: ThriftPOSProps) {
  const [activeTab, setActiveTab] = useState<'ALL' | 'BEDSHEETS' | 'PILLOWCASES' | 'COMFORTERS' | 'BLANKETS'>('ALL');
  const [productSelections, setProductSelections] = useState<Record<string, { size: string; color: string; qty: number }>>({});
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  
  // Custom Web-Friendly Window Toggles
  const [showPaymentWindow, setShowPaymentWindow] = useState(false);
  const [showReceiptWindow, setShowReceiptWindow] = useState(false);
  
  const [selectedMethod, setSelectedMethod] = useState<'GCASH' | 'BANK' | null>(null);
  const [currentReceiptNo, setCurrentReceiptNo] = useState('#234199');

  // Login Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const inventoryItems = [
    { id: 'b1', name: 'Premium Cotton Sheet', category: 'BEDSHEETS', basePrice: 48.00, available: 12, colors: ['Earth Brown', 'Pure White'], sizes: ['S', 'M', 'L'] },
    { id: 'b2', name: 'Terracotta Fitted Sheet', category: 'BEDSHEETS', basePrice: 52.50, available: 8, colors: ['Terracotta'], sizes: ['S', 'M', 'L'] },
    { id: 'p1', name: 'Sateen Pillowcase Set', category: 'PILLOWCASES', basePrice: 24.50, available: 24, colors: ['Cream', 'Coffee'], sizes: ['S', 'M', 'L'] },
    { id: 'p2', name: 'Golden Edge Luxury Cover', category: 'PILLOWCASES', basePrice: 28.00, available: 0, colors: ['Golden'], sizes: ['S', 'M', 'L'] }, 
    { id: 'c1', name: 'Weighted Cloud Comforter', category: 'COMFORTERS', basePrice: 85.00, available: 5, colors: ['Beige', 'Charcoal'], sizes: ['S', 'M', 'L'] },
    { id: 'bl1', name: 'Oversized Knit Throw Blanket', category: 'BLANKETS', basePrice: 32.80, available: 16, colors: ['Mocha', 'Sandy'], sizes: ['S', 'M', 'L'] },
  ];

  useEffect(() => {
    initializeSelections();
  }, []);

  const initializeSelections = () => {
    const initial: Record<string, { size: string; color: string; qty: number }> = {};
    inventoryItems.forEach(item => {
      initial[item.id] = { size: 'M', color: item.colors[0], qty: 1 };
    });
    setProductSelections(initial);
  };

  const updateCardQty = (id: string, delta: number) => {
    setProductSelections(prev => {
      const current = prev[id] ? prev[id].qty : 1;
      const nextQty = Math.max(1, current + delta);
      return { ...prev, [id]: { ...prev[id], qty: nextQty } };
    });
  };

  const updateCardSize = (id: string, size: string) => {
    setProductSelections(prev => ({ ...prev, [id]: { ...prev[id], size } }));
  };

  const handleAddToBilling = (item: typeof inventoryItems[0]) => {
    const selection = productSelections[item.id] || { size: 'M', color: item.colors[0], qty: 1 };
    const uniqueId = `${item.id}-${selection.size}-${selection.color}`;
    
    setCartItems(prev => {
      const exists = prev.find(i => i.id === uniqueId);
      if (exists) {
        return prev.map(i => i.id === uniqueId ? { ...i, quantity: i.quantity + selection.qty } : i);
      }
      return [...prev, {
        id: uniqueId,
        name: item.name,
        category: item.category,
        size: selection.size,
        color: selection.color,
        price: item.basePrice,
        quantity: selection.qty
      }];
    });
  };

  const calculateTotal = () => {
    return cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  };

  const handleProcessTransactionClick = () => {
    if (cartItems.length === 0) {
      alert("Please add items to billing before processing.");
      return;
    }
    setSelectedMethod(null);
    setShowPaymentWindow(true);
  };

  const confirmPayment = () => {
    if (!selectedMethod) {
      alert("Please select a payment option to continue.");
      return;
    }
    setCurrentReceiptNo(`TX-${Math.floor(100000 + Math.random() * 900000)}`);
    setShowPaymentWindow(false);
    setShowReceiptWindow(true);
  };

  const handlePrintReceipt = () => {
    alert("Sending E-Receipt print payload layout data to connected hardware terminal... Success!");
    setShowReceiptWindow(false);
    setCartItems([]);
  };

  const onLoginSubmit = () => {
    if (email.trim() === '' || password.trim() === '') {
      alert("Please enter credentials.");
      return;
    }
    // Simple mock logic for switching states
    if (email.includes("admin")) {
      handleLogin('employee');
    } else {
      handleLogin('customer');
    }
  };

  const filteredItems = activeTab === 'ALL' ? inventoryItems : inventoryItems.filter(item => item.category === activeTab);

  // Absolute Guard: If no user is logged in, show the styled interface frame matching your photo
  if (!userRole) {
    return (
      <View style={styles.loginScreenContainer}>
        <StatusBar style="light" />
        
        {/* Subtle Decorative Elements to match the photo layout */}
        <View style={styles.topCoffeeCupMock} />
        <View style={styles.bottomNotebookMock} />

        <View style={styles.loginCard}>
          <Text style={styles.loginHeaderTitle}>Welcome to ERP Admin</Text>
          
          <Text style={styles.inputLabelText}>Email</Text>
          <TextInput 
            style={styles.loginInputField} 
            placeholder="email@domain.com"
            placeholderTextColor="#CBD5E1"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.inputLabelText}>Password</Text>
          <TextInput 
            style={styles.loginInputField} 
            placeholder="********"
            placeholderTextColor="#CBD5E1"
            secureTextEntry={true}
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity onPress={() => alert('Reset password route initialization.')}>
            <Text style={styles.forgotPasswordLinkText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginSubmitBtn} onPress={onLoginSubmit}>
            <Text style={styles.loginSubmitBtnText}>SUBMIT</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => alert('Redirecting to registration process.')}>
            <Text style={styles.registerFootnoteText}>Don't have login? <Text style={{fontWeight: '700'}}>Register</Text></Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.mainLayout}>
        
        {/* ================= LEFT SIDEBAR MENU ================= */}
        <View style={styles.sidebar}>
          <View>
            <View style={styles.logoContainer}>
              <Text style={styles.logoIcon}>🧺</Text>
              <Text style={styles.logoText}>BakerThrift</Text>
            </View>
            <TouchableOpacity style={[styles.sidebarBtn, styles.sidebarBtnActive]}>
              <Text style={[styles.sidebarBtnText, styles.sidebarBtnTextActive]}>🏠 Overview</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sidebarBtn} onPress={() => alert("History logs are securely saved on core database local files.")}>
              <Text style={styles.sidebarBtnText}>🕒 History</Text>
            </TouchableOpacity>
          </View>
          <View>
            <TouchableOpacity 
              style={styles.logoutBtn} 
              onPress={async () => {
                try {
                  await handleLogout();
                } catch (err) {
                  alert("Logout failed. Please check backend integration threads.");
                }
              }}
            >
              <Text style={styles.logoutBtnText}>🚪 Log Out ({userRole})</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ================= CENTER PRODUCT CATALOG MATRIX ================= */}
        <View style={styles.centerCatalog}>
          <View style={styles.catalogHeader}>
            <View style={styles.searchContainer}>
              <TextInput style={styles.searchInput} placeholder="Search items..." placeholderTextColor={Colors.textMuted} />
            </View>
          </View>
          <Text style={styles.mainMenuTitle}>Choose Menu</Text>
          <View style={styles.categoryTabRow}>
            {(['ALL', 'BEDSHEETS', 'PILLOWCASES', 'COMFORTERS', 'BLANKETS'] as const).map((tab) => (
              <TouchableOpacity key={tab} style={[styles.categoryTabCard, activeTab === tab && styles.categoryTabCardActive]} onPress={() => setActiveTab(tab)}>
                <Text style={[styles.categoryTabLabel, activeTab === tab && styles.categoryTabLabelActive]}>
                  {tab === 'ALL' ? '📦' : tab === 'BEDSHEETS' ? '🛏️' : tab === 'PILLOWCASES' ? '☁️' : tab === 'COMFORTERS' ? '🧥' : '🧣'}
                </Text>
                <Text style={[styles.categoryTabText, activeTab === tab && styles.categoryTabTextActive]}>
                  {tab === 'ALL' ? 'All Menu' : tab.charAt(0) + tab.slice(1).toLowerCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView contentContainerStyle={styles.catalogGrid} showsVerticalScrollIndicator={false}>
            {filteredItems.map((item) => {
              const currentSelection = productSelections[item.id] || { size: 'M', color: item.colors[0], qty: 1 };
              const isSoldOut = item.available === 0;
              return (
                <View key={item.id} style={styles.itemCard}>
                  <View style={[styles.itemImageMock, { backgroundColor: isSoldOut ? '#EFEFEF' : Colors.primaryLight }]}>
                    <Text style={{ fontSize: 32 }}>{item.category === 'BEDSHEETS' ? '🛏️' : '☁️'}</Text>
                  </View>
                  <View style={styles.itemMetaInfo}>
                    <Text style={styles.itemCardTitle} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.itemCardAvailability}>{isSoldOut ? '0 Available' : `${item.available} Available`}</Text>
                    <Text style={styles.itemCardPrice}>${item.basePrice.toFixed(2)}</Text>
                  </View>
                  <View style={styles.cardControlRow}>
                    <View style={styles.quantityContainer}>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => updateCardQty(item.id, -1)} disabled={isSoldOut}><Text style={styles.qtyBtnText}>-</Text></TouchableOpacity>
                      <Text style={styles.qtyText}>{currentSelection.qty}</Text>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => updateCardQty(item.id, 1)} disabled={isSoldOut}><Text style={styles.qtyBtnText}>+</Text></TouchableOpacity>
                    </View>
                    <View style={styles.sizeContainer}>
                      {item.sizes.map((sz) => (
                        <TouchableOpacity key={sz} style={[styles.sizeChip, currentSelection.size === sz && styles.sizeChipActive]} onPress={() => updateCardSize(item.id, sz)} disabled={isSoldOut}>
                          <Text style={[styles.sizeChipText, currentSelection.size === sz && styles.sizeChipTextActive]}>{sz}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  {isSoldOut ? (
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
            <Text style={styles.billingReceiptNo}>{currentReceiptNo}</Text>
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
                    <Text style={styles.billingItemSub}>Size: {cartItem.size} | Qty: {cartItem.quantity}</Text>
                    <Text style={styles.billingItemPrice}>${(cartItem.price * cartItem.quantity).toFixed(2)}</Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
          <View style={styles.billingFooter}>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Total Price :</Text>
              <Text style={[styles.summaryValue, { color: Colors.primary, fontSize: 20 }]}>${calculateTotal().toFixed(2)}</Text>
            </View>
            <TouchableOpacity style={styles.processTxBtn} onPress={handleProcessTransactionClick}>
              <Text style={styles.processTxBtnText}>Process Transaction</Text>
            </TouchableOpacity>
          </View>
        </View>

      </View>

      {/* ================= OVERLAY 1: PAYMENT SELECTION ================= */}
      {showPaymentWindow && (
        <View style={styles.webModalOverlay}>
          <View style={styles.paymentModalCard}>
            <Text style={styles.modalTitle}>Select Payment Method</Text>
            <Text style={styles.modalSubTitle}>Total Due: ${calculateTotal().toFixed(2)}</Text>
            
            <View style={styles.paymentMethodsRow}>
              <TouchableOpacity style={[styles.methodCard, selectedMethod === 'GCASH' && styles.methodCardActive]} onPress={() => setSelectedMethod('GCASH')}>
                <Text style={styles.methodIcon}>📱</Text>
                <Text style={[styles.methodText, selectedMethod === 'GCASH' && styles.methodTextActive]}>GCash</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.methodCard, selectedMethod === 'BANK' && styles.methodCardActive]} onPress={() => setSelectedMethod('BANK')}>
                <Text style={styles.methodIcon}>🏦</Text>
                <Text style={[styles.methodText, selectedMethod === 'BANK' && styles.methodTextActive]}>Bank Account</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowPaymentWindow(false)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, !selectedMethod && { backgroundColor: Colors.disabled }]} onPress={confirmPayment} disabled={!selectedMethod}>
                <Text style={styles.modalConfirmBtnText}>Confirm Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ================= OVERLAY 2: E-RECEIPT LAYER ================= */}
      {showReceiptWindow && (
        <View style={styles.webModalOverlay}>
          <View style={styles.receiptModalCard}>
            <Text style={styles.receiptHeader}>⚡ E-RECEIPT</Text>
            <Text style={styles.receiptMeta}>Order Reference: {currentReceiptNo}</Text>
            <Text style={styles.receiptMeta}>Payment via: {selectedMethod}</Text>
            
            <View style={styles.receiptDivider} />
            
            <ScrollView style={styles.receiptItemsScroll}>
              {cartItems.map((item) => (
                <View key={item.id} style={styles.receiptItemLine}>
                  <Text style={styles.receiptItemNameText}>{item.name} ({item.size}) x{item.quantity}</Text>
                  <Text style={styles.receiptItemPriceText}>${(item.price * item.quantity).toFixed(2)}</Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.receiptDivider} />
            
            <View style={styles.receiptTotalLine}>
              <Text style={styles.receiptTotalLabel}>Amount Paid</Text>
              <Text style={styles.receiptTotalVal}>${calculateTotal().toFixed(2)}</Text>
            </View>

            <TouchableOpacity style={styles.printActionBtn} onPress={handlePrintReceipt}>
              <Text style={styles.printActionBtnText}>🖨️ Print E-Receipt</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, position: 'relative' },
  mainLayout: { flex: 1, flexDirection: 'row' },
  
  // --- REALISTIC IMAGE ALIGNED LOGIN SCREEN STYLES ---
  loginScreenContainer: {
    flex: 1,
    backgroundColor: Colors.imgBackground,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  topCoffeeCupMock: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 12,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  bottomNotebookMock: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 180,
    height: 180,
    backgroundColor: 'rgba(20, 195, 162, 0.2)',
    transform: [{ rotate: '45deg' }],
    borderRadius: 12,
  },
  loginCard: {
    width: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 40,
    paddingVertical: 45,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  loginHeaderTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 35,
    fontFamily: 'System',
  },
  inputLabelText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
    fontWeight: '500',
  },
  loginInputField: {
    width: '100%',
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1E293B',
    marginBottom: 24,
  },
  forgotPasswordLinkText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 30,
    fontWeight: '500',
  },
  loginSubmitBtn: {
    backgroundColor: Colors.imgAccent,
    width: '100%',
    height: 48,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  loginSubmitBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  registerFootnoteText: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
  },

  // --- POS PANEL AND SIDEBAR STYLES ---
  sidebar: { width: 220, backgroundColor: Colors.surface, borderRightWidth: 1, borderRightColor: Colors.border, padding: 20, justifyContent: 'space-between' },
  logoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  logoIcon: { fontSize: 22, marginRight: 8 },
  logoText: { fontSize: 18, fontWeight: 'bold', color: Colors.primary },
  sidebarBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginBottom: 6 },
  sidebarBtnActive: { backgroundColor: Colors.primaryLight },
  sidebarBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  sidebarBtnTextActive: { color: Colors.primary },
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

  catalogGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', paddingBottom: 20 },
  itemCard: { backgroundColor: Colors.surface, width: '31%', borderRadius: 14, padding: 14, marginBottom: 14, marginRight: '2%', borderWidth: 1, borderColor: Colors.border },
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

  billingSection: { width: 320, backgroundColor: Colors.surface, borderLeftWidth: 1, borderLeftColor: Colors.border, padding: 20, justifyContent: 'space-between' },
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
  billingFooter: { paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 13, color: Colors.textMuted },
  summaryValue: { fontSize: 15, fontWeight: 'bold', color: Colors.textDark },
  processTxBtn: { backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  processTxBtnText: { color: Colors.surface, fontWeight: 'bold', fontSize: 14 },

  webModalOverlay: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    backgroundColor: 'rgba(0, 0, 0, 0.45)', 
    justifyContent: 'center', 
    alignItems: 'center',
    zIndex: 9999 
  },
  paymentModalCard: { 
    width: 400, 
    backgroundColor: Colors.surface, 
    borderRadius: 16, 
    padding: 24, 
    borderWidth: 1, 
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.textDark, marginBottom: 4, textAlign: 'center' },
  modalSubTitle: { fontSize: 15, color: Colors.primary, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  paymentMethodsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  methodCard: { flex: 1, backgroundColor: Colors.background, padding: 16, borderRadius: 12, alignItems: 'center', marginHorizontal: 6, borderWidth: 1, borderColor: Colors.border },
  methodCardActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  methodIcon: { fontSize: 28, marginBottom: 6 },
  methodText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  methodTextActive: { color: Colors.primary, fontWeight: 'bold' },
  modalActionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginRight: 8, backgroundColor: '#F2F2F7' },
  modalCancelBtnText: { color: Colors.textDark, fontWeight: '600', fontSize: 13 },
  modalConfirmBtn: { flex: 2, backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalConfirmBtnText: { color: Colors.surface, fontWeight: 'bold', fontSize: 13 },

  receiptModalCard: { 
    width: 360, 
    backgroundColor: Colors.surface, 
    borderRadius: 12, 
    padding: 20, 
    borderWidth: 1, 
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12
  },
  receiptHeader: { fontSize: 18, fontWeight: 'bold', color: Colors.textDark, textAlign: 'center', marginBottom: 4 },
  receiptMeta: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginBottom: 2 },
  receiptDivider: { borderBottomWidth: 1, borderBottomColor: Colors.border, borderStyle: 'dashed', marginVertical: 12 },
  receiptItemsScroll: { maxHeight: 180 },
  receiptItemLine: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  receiptItemNameText: { fontSize: 12, color: Colors.textDark, flex: 1 },
  receiptItemPriceText: { fontSize: 12, fontWeight: '600', color: Colors.textDark, marginLeft: 10 },
  receiptTotalLine: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 6 },
  receiptTotalLabel: { fontSize: 14, fontWeight: 'bold', color: Colors.textDark },
  receiptTotalVal: { fontSize: 16, fontWeight: 'bold', color: Colors.primary },
  printActionBtn: { backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 15 },
  printActionBtnText: { color: Colors.surface, fontWeight: 'bold', fontSize: 13 }
});