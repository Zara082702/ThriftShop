import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const { width } = Dimensions.get('window');

// Color Palette closely mimicking the "Coppie" Dashboard Design (image_d829c9.png)
const Colors = {
  primary: '#E2875E',       // Terracotta accent color for highlights
  primaryLight: '#FCEFE9',  // Light orange background tint
  background: '#F9F6F3',    // Soft cream dashboard background
  surface: '#FFFFFF',       // Clean white cards
  textDark: '#1A1A1A',      // High-contrast primary text
  textMuted: '#8E8E93',     // Muted secondary text
  border: '#EBEBEB',        // Subdued section dividers
  disabled: '#D1D1D6',
  danger: '#E53935'
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

type AdminTool = 'customer-report' | 'inventory' | 'inquiries' | 'sales-report' | 'stocks' | 'staff-accounts' | null;

export default function AdminPOSScreen() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuthorization, setIsCheckingAuthorization] = useState(true);
  // --- States ---
  const [activeTab, setActiveTab] = useState<'ALL' | 'BEDSHEETS' | 'PILLOWCASES' | 'COMFORTERS' | 'BLANKETS'>('ALL');
  const [productSelections, setProductSelections] = useState<Record<string, { size: string; color: string; qty: number }>>({});
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [adminTool, setAdminTool] = useState<AdminTool>(null);
  const [resolvedInquiries, setResolvedInquiries] = useState<string[]>([]);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffCount, setStaffCount] = useState(3);

  // Shop inventory used by the POS and the administration tools.
  const [inventoryItems, setInventoryItems] = useState([
    { id: 'b1', name: 'Premium Cotton Sheet', category: 'BEDSHEETS', basePrice: 48.00, available: 12, colors: ['Earth Brown', 'Pure White'], sizes: ['S', 'M', 'L'] },
    { id: 'b2', name: 'Terracotta Fitted Sheet', category: 'BEDSHEETS', basePrice: 52.50, available: 8, colors: ['Terracotta'], sizes: ['S', 'M', 'L'] },
    { id: 'p1', name: 'Sateen Pillowcase Set', category: 'PILLOWCASES', basePrice: 24.50, available: 24, colors: ['Cream', 'Coffee'], sizes: ['S', 'M', 'L'] },
    { id: 'p2', name: 'Golden Edge Luxury Cover', category: 'PILLOWCASES', basePrice: 28.00, available: 0, colors: ['Golden'], sizes: ['S', 'M', 'L'] }, // Sold Out Example
    { id: 'c1', name: 'Weighted Cloud Comforter', category: 'COMFORTERS', basePrice: 85.00, available: 5, colors: ['Beige', 'Charcoal'], sizes: ['S', 'M', 'L'] },
    { id: 'bl1', name: 'Oversized Knit Throw Blanket', category: 'BLANKETS', basePrice: 32.80, available: 16, colors: ['Mocha', 'Sandy'], sizes: ['S', 'M', 'L'] },
  ]);

  useEffect(() => {
    initializeSelections();
  }, []);

  useEffect(() => {
    const verifyAdminAccess = async () => {
      const userRole = await AsyncStorage.getItem('userRole');

      if (userRole === 'employee') {
        setIsAuthorized(true);
      } else {
        router.replace('/');
      }

      setIsCheckingAuthorization(false);
    };

    verifyAdminAccess();
  }, [router]);

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
    const uniqueId = `₱{item.id}-₱{selection.size}-₱{selection.color}`;
    
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
    Alert.alert("Success", `Added ₱{selection.qty}x ₱{item.name} to Bill Details.`);
  };

  const calculateTotal = () => {
    return cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  };

  const updateStock = (id: string, change: number) => {
    setInventoryItems((items) => items.map((item) => item.id === id
      ? { ...item, available: Math.max(0, item.available + change) }
      : item));
  };

  const createStaffAccount = () => {
    if (!staffName.trim() || !staffEmail.endsWith('@bakerthriftship.com')) {
      Alert.alert('Invalid staff details', 'Enter a name and a @bakerthriftship.com email address.');
      return;
    }
    setStaffCount((count) => count + 1);
    setStaffName('');
    setStaffEmail('');
    Alert.alert('Staff account created', 'The new staff member can now sign in.');
  };

  const filteredItems = activeTab === 'ALL' 
    ? inventoryItems 
    : inventoryItems.filter(item => item.category === activeTab);
  const totalStock = inventoryItems.reduce((total, item) => total + item.available, 0);
  const adminToolTitle: Record<Exclude<AdminTool, null>, string> = {
    'customer-report': 'Customer Report', inventory: 'Inventory', inquiries: 'Customer Inquiries',
    'sales-report': 'Sales Report', stocks: 'Stocks', 'staff-accounts': 'Create Staff Account',
  };

  if (isCheckingAuthorization || !isAuthorized) {
    return null;
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

            <Text style={styles.adminSectionLabel}>ADMINISTRATION</Text>
            <TouchableOpacity style={styles.sidebarBtn} onPress={() => setAdminTool('customer-report')}><Text style={styles.sidebarBtnText}>Customer Report</Text></TouchableOpacity>
            <TouchableOpacity style={styles.sidebarBtn} onPress={() => setAdminTool('inventory')}><Text style={styles.sidebarBtnText}>Inventory</Text></TouchableOpacity>
            <TouchableOpacity style={styles.sidebarBtn} onPress={() => setAdminTool('inquiries')}><Text style={styles.sidebarBtnText}>Customer Inquiries</Text></TouchableOpacity>
            <TouchableOpacity style={styles.sidebarBtn} onPress={() => setAdminTool('sales-report')}><Text style={styles.sidebarBtnText}>Sales Report</Text></TouchableOpacity>
            <TouchableOpacity style={styles.sidebarBtn} onPress={() => setAdminTool('stocks')}><Text style={styles.sidebarBtnText}>Stocks</Text></TouchableOpacity>
            <TouchableOpacity style={styles.sidebarBtn} onPress={() => setAdminTool('staff-accounts')}><Text style={styles.sidebarBtnText}>Create Staff Account</Text></TouchableOpacity>

            <TouchableOpacity style={styles.sidebarBtn} onPress={() => Alert.alert("History", "Viewing past records...")}>
              <Text style={styles.sidebarBtnText}>🕒 History</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sidebarBtn} onPress={() => Alert.alert("Payment", "Payment gateways configuration.")}>
              <Text style={styles.sidebarBtnText}>💳 Payment</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sidebarBtn} onPress={() => Alert.alert("FAQ", "Info & Support Docs.")}>
              <Text style={styles.sidebarBtnText}>❓ Info & FAQ</Text>
            </TouchableOpacity>
          </View>

          <View>
            <TouchableOpacity style={styles.logoutBtn} onPress={() => Alert.alert("Notice", "Logout managed via Main tab.")}>
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
              />
            </View>
          </View>

          <Text style={styles.mainMenuTitle}>Choose Menu</Text>

          {/* Horizontal Category Nav Chips from image_d829c9.png */}
          <View style={styles.categoryTabRow}>
            {(['ALL', 'BEDSHEETS', 'PILLOWCASES', 'COMFORTERS', 'BLANKETS'] as const).map((tab) => (
              <TouchableOpacity 
                key={tab} 
                style={[styles.categoryTabCard, activeTab === tab && styles.categoryTabCardActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.categoryTabLabel, activeTab === tab && styles.categoryTabLabelActive]}>
                  {tab === 'ALL' ? '📦' : tab === 'BEDSHEETS' ? '🛏️' : tab === 'PILLOWCASES' ? '☁️' : tab === 'COMFORTERS' ? '🧥' : '🧣'}
                </Text>
                <Text style={[styles.categoryTabText, activeTab === tab && styles.categoryTabTextActive]}>
                  {tab === 'ALL' ? 'All Menu' : tab.charAt(0) + tab.slice(1).toLowerCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Product Grid Layout */}
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
                    <Text style={styles.itemCardAvailability}>
                      {isSoldOut ? '0 Avaible' : `₱{item.available} Avaible`}
                    </Text>
                    <Text style={styles.itemCardPrice}>₱{item.basePrice.toFixed(2)}</Text>
                  </View>

                  <View style={styles.cardControlRow}>
                    <View style={styles.quantityContainer}>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => updateCardQty(item.id, -1)} disabled={isSoldOut}>
                        <Text style={styles.qtyBtnText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{currentSelection.qty}</Text>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => updateCardQty(item.id, 1)} disabled={isSoldOut}>
                        <Text style={styles.qtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.sizeContainer}>
                      {item.sizes.map((sz) => (
                        <TouchableOpacity 
                          key={sz} 
                          style={[styles.sizeChip, currentSelection.size === sz && styles.sizeChipActive]}
                          onPress={() => updateCardSize(item.id, sz)}
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
            <Text style={styles.billingReceiptNo}>#234199</Text>
          </View>

          <ScrollView style={styles.billingScrollItems} showsVerticalScrollIndicator={false}>
            {cartItems.length === 0 ? (
              <View style={styles.emptyBillingContainer}>
                <Text style={{fontSize: 32, marginBottom: 10}}>🛒</Text>
                <Text style={styles.emptyBillingText}>No Items in Billing</Text>
              </View>
            ) : (
              cartItems.map((cartItem) => (
                <View key={cartItem.id} style={styles.billingItemRow}>
                  <View style={styles.billingItemLeft}>
                    <Text style={styles.billingItemName}>{cartItem.name}</Text>
                    <Text style={styles.billingItemSub}>Size: {cartItem.size}</Text>
                    <Text style={styles.billingItemPrice}>₱{(cartItem.price * cartItem.quantity).toFixed(2)}</Text>
                  </View>
                  <View style={styles.billingItemRight}>
                    <Text style={styles.billingItemQty}>x{cartItem.quantity}</Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.billingFooter}>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Amount Order :</Text>
              <Text style={styles.summaryValue}>
                {cartItems.reduce((acc, item) => acc + item.quantity, 0)}
              </Text>
            </View>
            
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Total Price :</Text>
              <Text style={[styles.summaryValue, {color: Colors.primary, fontSize: 20}]}>
                ₱{calculateTotal().toFixed(2)}
              </Text>
            </View>

            <TouchableOpacity style={styles.processTxBtn} onPress={() => { Alert.alert("Success", "Transaction Processed!"); setCartItems([]); }}>
              <Text style={styles.processTxBtnText}>Process Transaction</Text>
            </TouchableOpacity>
          </View>
        </View>

      </View>
      <Modal visible={adminTool !== null} animationType="slide" transparent onRequestClose={() => setAdminTool(null)}>
        <View style={styles.toolBackdrop}>
          <View style={styles.toolPanel}>
            <View style={styles.toolHeader}>
              <Text style={styles.toolTitle}>{adminTool ? adminToolTitle[adminTool] : ''}</Text>
              <TouchableOpacity onPress={() => setAdminTool(null)}><Text style={styles.toolClose}>×</Text></TouchableOpacity>
            </View>

            {adminTool === 'customer-report' && <View><Text style={styles.toolText}>Registered customers</Text><Text style={styles.toolMetric}>128</Text><Text style={styles.toolText}>Repeat customers this month: 42</Text><Text style={styles.toolText}>Most purchased category: Bedsheets</Text></View>}
            {adminTool === 'sales-report' && <View><Text style={styles.toolText}>Today's POS sales</Text><Text style={styles.toolMetric}>PHP {calculateTotal().toFixed(2)}</Text><Text style={styles.toolText}>Items currently in bill: {cartItems.reduce((total, item) => total + item.quantity, 0)}</Text><Text style={styles.toolText}>Use the billing panel to process the current transaction.</Text></View>}
            {adminTool === 'inquiries' && <View><Text style={styles.inquiryTitle}>Delivery question from Maria S.</Text><Text style={styles.toolText}>"Do you deliver Queen-size bedsheets in Manila?"</Text><TouchableOpacity style={styles.toolAction} onPress={() => setResolvedInquiries((items) => [...items, 'maria'])}><Text style={styles.toolActionText}>{resolvedInquiries.includes('maria') ? 'RESOLVED' : 'MARK AS RESOLVED'}</Text></TouchableOpacity></View>}
            {(adminTool === 'inventory' || adminTool === 'stocks') && <ScrollView style={styles.toolList}>{inventoryItems.map((item) => <View key={item.id} style={styles.stockRow}><View><Text style={styles.stockName}>{item.name}</Text><Text style={styles.toolText}>{item.category}</Text></View><View style={styles.stockControls}><TouchableOpacity style={styles.stockButton} onPress={() => updateStock(item.id, -1)}><Text>-</Text></TouchableOpacity><Text style={styles.stockValue}>{item.available}</Text><TouchableOpacity style={styles.stockButton} onPress={() => updateStock(item.id, 1)}><Text>+</Text></TouchableOpacity></View></View>)}<Text style={styles.stockTotal}>Total available units: {totalStock}</Text></ScrollView>}
            {adminTool === 'staff-accounts' && <View><Text style={styles.toolText}>Active staff accounts: {staffCount}</Text><TextInput value={staffName} onChangeText={setStaffName} placeholder="Staff full name" style={styles.toolInput} /><TextInput value={staffEmail} onChangeText={setStaffEmail} placeholder="Staff work email" autoCapitalize="none" keyboardType="email-address" style={styles.toolInput} /><TouchableOpacity style={styles.toolAction} onPress={createStaffAccount}><Text style={styles.toolActionText}>CREATE STAFF ACCOUNT</Text></TouchableOpacity></View>}
          </View>
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
  adminSectionLabel: { color: Colors.textMuted, fontWeight: 'bold', fontSize: 10, marginTop: 14, marginBottom: 6, paddingHorizontal: 12 },
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
  billingItemRight: { marginLeft: 10 },
  billingItemQty: { fontSize: 13, fontWeight: 'bold', color: Colors.textDark },

  billingFooter: { paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 13, color: Colors.textMuted },
  summaryValue: { fontSize: 15, fontWeight: 'bold', color: Colors.textDark },
  processTxBtn: { backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  processTxBtnText: { color: Colors.surface, fontWeight: 'bold', fontSize: 14 },
  toolBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  toolPanel: { backgroundColor: Colors.surface, borderRadius: 16, width: '100%', maxWidth: 520, padding: 24, maxHeight: '80%' },
  toolHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  toolTitle: { color: Colors.textDark, fontSize: 22, fontWeight: 'bold' },
  toolClose: { color: Colors.textMuted, fontSize: 30, lineHeight: 30 },
  toolText: { color: Colors.textMuted, fontSize: 14, marginBottom: 10 },
  toolMetric: { color: Colors.primary, fontSize: 30, fontWeight: 'bold', marginBottom: 12 },
  toolAction: { backgroundColor: Colors.primary, padding: 13, borderRadius: 8, alignItems: 'center', marginTop: 14 },
  toolActionText: { color: Colors.surface, fontWeight: 'bold', fontSize: 12 },
  toolList: { maxHeight: 400 },
  stockRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  stockName: { color: Colors.textDark, fontWeight: 'bold', fontSize: 14 },
  stockControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stockButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  stockValue: { color: Colors.textDark, fontWeight: 'bold', minWidth: 20, textAlign: 'center' },
  stockTotal: { color: Colors.primary, fontWeight: 'bold', paddingTop: 14, textAlign: 'right' },
  inquiryTitle: { color: Colors.textDark, fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  toolInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 12, color: Colors.textDark, marginTop: 10 },
});
