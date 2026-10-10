import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google'; // Added
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser'; // Added
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  ImageBackground,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CartModal } from '../../components/shop/CartModal';
import { CategoryModal } from '../../components/shop/CategoryModal';
import { PaymentMethodsModal } from '../../components/shop/PaymentMethodsModal';
import type { CartItem, ShopCategory } from '../../components/shop/types';

// Initialize WebBrowser for Auth Session
WebBrowser.maybeCompleteAuthSession();

const { width } = Dimensions.get('window');

const Colors = {
  primary: '#5d3a1a',    
  secondary: '#8b5e34',  
  accent: '#FFC107',     
  background: '#F8F5F2', 
  white: '#FFFFFF',
  black: '#000000',
  drawerBlack: '#212529',
  border: '#EEEEEE',
  googleBlue: '#4285F4',
};

type Role = 'customer' | 'employee' | null;

export default function ThriftShopIndex() {
  const router = useRouter();
  // --- Google Auth Hook ---
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: "YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com",
    iosClientId: "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com",
    webClientId: "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com",
  });

  // --- States ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<Role>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showCatDropdown, setShowCatDropdown] = useState(false);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false); 
  const [showCartModal, setShowCartModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showPaymentMethodsModal, setShowPaymentMethodsModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'employee_signup'>('login');

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // --- Effects ---
  useEffect(() => {
    loadUserData();
  }, []);

  // Handle Google Response
  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      handleGoogleLoginSuccess();
    }
  }, [response]);

  const handleGoogleLoginSuccess = async () => {
    await AsyncStorage.setItem('userRole', 'customer');
    setUserRole('customer');
    setIsLoggedIn(true);
    setShowLogin(false);
    Alert.alert("Google Login", "Successfully signed in with Google!");
  };

  const loadUserData = async () => {
    try {
      const storedRole = await AsyncStorage.getItem('userRole');
      if (storedRole) {
        setUserRole(storedRole as Role);
        setIsLoggedIn(true);
      }
    } catch (e) { console.log("Failed to load user data"); }
  };

  const handleLogout = async () =>  {
    await AsyncStorage.clear();
    setIsLoggedIn(false);
    setUserRole(null);
    setShowDrawer(false);
  };

  const categoryData: any = {
    PILLOWCASES: {
      sizes: ['Small (12x12)', 'Medium (18x18)', 'Body Pillow (20x54)'],
      colors: ['Cream', 'Coffee', 'Golden'],
      price: 249,
      img: require('../../assets/pillowcases.jpg')
    },
    BEDSHEETS: {
      sizes: ['Twin Size', 'Queen Size', 'King Size'],
      colors: ['Earth Brown', 'Pure White', 'Terracotta'],
      price: 599,
      img: require('../../assets/bedsheets3.jpg')
    },
    COMFORTERS: {
      sizes: ['Standard', 'Weighted', 'Extra Large'],
      colors: ['Charcoal', 'Caramel', 'Beige'],
      price: 1299,
      img: require('../../assets/blankets1.jpg')
    },
    BLANKETS: {
      sizes: ['Throw Blanket', 'Full Size', 'Oversized'],
      colors: ['Mocha', 'Sandy', 'Latte'],
      price: 449,
      img: require('../../assets/comforters.jpg')
    }
  };

  const categories: ShopCategory[] = (Object.entries(categoryData) as [string, Omit<ShopCategory, 'name'>][])
    .map(([name, category]) => ({ name, ...category }));

  const addToCart = (category: ShopCategory, size: string, color: string) => {
      const itemId = `${category.name}-${size}-${color}`;

      setCartItems((currentCart) => {
        const existingItem = currentCart.find((item) => item.id === itemId);

        if (existingItem) {
          return currentCart.map((item) =>
            item.id === itemId ? { ...item, quantity: item.quantity + 1 } : item
          );
        }

        return [...currentCart, {
          id: itemId,
          name: category.name,
          size,
          color,
          price: category.price,
          quantity: 1,
        }];
      });
      Alert.alert("Success", `Added ${color} ${category.name} to cart!`);
  };

  const updateCartQuantity = (itemId: string, change: number) => {
    setCartItems((currentCart) => currentCart.flatMap((item) => {
      if (item.id !== itemId) return [item];
      const quantity = item.quantity + change;
      return quantity > 0 ? [{ ...item, quantity }] : [];
    }));
  };

  const cartItemCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);

  const handleCheckout = () => {
    Alert.alert(
      'Place order',
      `Your total is PHP ${cartTotal.toFixed(2)}. Would you like to place this order?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Place order',
          onPress: () => {
            setCartItems([]);
            setShowCartModal(false);
            Alert.alert('Order placed', 'Thank you! Your order has been received.');
          },
        },
      ]
    );
  };

  const handleSignUp = async () => {
    if (authMode === 'employee_signup') {
      if (!email.endsWith('@bakerthriftship.com')) {
        Alert.alert("Invalid Email", "Employee accounts must use a @bakerthriftship.com email address.");
        return;
      }
      setUserRole('employee');
    } else {
      setUserRole('customer');
    }
    
    await AsyncStorage.setItem('userRole', authMode === 'employee_signup' ? 'employee' : 'customer');
    setIsLoggedIn(true);
    setShowLogin(false);
    Alert.alert("Account Created", `Welcome ${authMode === 'employee_signup' ? 'Employee' : 'Customer'}! Your account has been created.`);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {showDrawer && (
        <View style={styles.drawerOverlay}>
          <TouchableOpacity style={styles.drawerCloseArea} activeOpacity={1} onPress={() => setShowDrawer(false)} />
          <SafeAreaView style={styles.drawerContent}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>{userRole === 'employee' ? 'STAFF PANEL' : ' ABOUT'}</Text>
              <TouchableOpacity onPress={() => setShowDrawer(false)}><Text style={styles.closeIcon}>✕</Text></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {userRole === 'employee' ? (
                <>
                  <Text style={styles.sectionLabel}> Administration</Text>
                  <TouchableOpacity style={styles.drawerItem}><Text style={styles.drawerItemText}>  Customer Report</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.drawerItem}><Text style={styles.drawerItemText}>  Inventory</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.drawerItem}><Text style={styles.drawerItemText}>  Customer Inquiries</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.drawerItem}><Text style={styles.drawerItemText}>  Sales Report</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.drawerItem}><Text style={styles.drawerItemText}>  Stocks</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.drawerItem}><Text style={styles.drawerItemText}>  Create Account for Staff</Text></TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.sectionLabel}> INTERFACE</Text>
                  {isLoggedIn && userRole === 'customer' && (
                    <TouchableOpacity style={styles.drawerItem} onPress={() => { setShowDrawer(false); setShowCartModal(true); }}>
                      <Text style={styles.drawerItemText}>  My Cart ({cartItemCount}) </Text>
                    </TouchableOpacity>
                  )}
                  {false && showCartModal && (
                    <View style={styles.dropdownContent}>
                      {cartItems.length > 0 ? (
                        <>
                          {cartItems.map((item, i) => <Text key={i} style={styles.subItemText}>• {item.name}</Text>)}
                          {cartItems.map((item) => (
                            <View key={`${item.id}-controls`} style={styles.cartItem}>
                              <View style={styles.cartItemDetails}>
                                <Text style={styles.cartItemOption}>{item.size} · {item.color}</Text>
                                <Text style={styles.cartItemPrice}>PHP {(item.price * item.quantity).toFixed(2)}</Text>
                              </View>
                              <View style={styles.cartQuantityControls}>
                                <TouchableOpacity style={styles.cartQuantityButton} onPress={() => updateCartQuantity(item.id, -1)}>
                                  <Text style={styles.cartQuantityButtonText}>−</Text>
                                </TouchableOpacity>
                                <Text style={styles.cartQuantityText}>{item.quantity}</Text>
                                <TouchableOpacity style={styles.cartQuantityButton} onPress={() => updateCartQuantity(item.id, 1)}>
                                  <Text style={styles.cartQuantityButtonText}>+</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))}
                          <View style={styles.cartTotalRow}>
                            <Text style={styles.cartTotalLabel}>Subtotal</Text>
                            <Text style={styles.cartTotalValue}>PHP {cartTotal.toFixed(2)}</Text>
                          </View>
                          <View style={styles.cartActionRow}>
                            <TouchableOpacity style={styles.cartBtnCancel} onPress={() => setCartItems([])}><Text style={styles.cartBtnText}>CANCEL</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.cartBtnCheckout} onPress={handleCheckout}><Text style={styles.cartBtnText}>CHECKOUT</Text></TouchableOpacity>
                          </View>
                        </>
                      ) : <Text style={styles.subItemText}>Cart is empty</Text>}
                    </View>
                  )}

                  {isLoggedIn && userRole === 'customer' && (
                    <>
                      <TouchableOpacity style={styles.drawerItem} onPress={() => { setShowDrawer(false); setShowCategoryModal(true); }}>
                        <Text style={styles.drawerItemText}>  Categories </Text>
                      </TouchableOpacity>
                      {showCatDropdown && (
                        <View style={styles.dropdownContent}>
                          {Object.keys(categoryData).map((cat) => (
                            <TouchableOpacity key={cat} onPress={() => { setShowDrawer(false); setShowCategoryModal(true); }} style={styles.subItem}>
                              <Text style={styles.subItemText}>• {cat.charAt(0) + cat.slice(1).toLowerCase()}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </>
                  )}

                  <View style={styles.drawerDivider} />
                  <Text style={styles.sectionLabel}> PAYMENT METHODS</Text>
                  <TouchableOpacity style={styles.drawerItem} onPress={() => { setShowDrawer(false); setShowPaymentMethodsModal(true); }}><Text style={styles.drawerItemText}> Payment Methods</Text></TouchableOpacity>


                  <View style={styles.drawerDivider} />
                  <Text style={styles.sectionLabel}> LOYALTY PROGRAM</Text>
                  <TouchableOpacity style={styles.drawerItem} onPress={() => { setShowDrawer(false); setShowLoyaltyModal(true); }}>
                    <Text style={styles.drawerItemText}> Loyalty Discount </Text>
                  </TouchableOpacity>
                </>
              )}
              
              {isLoggedIn && (
                 <TouchableOpacity style={[styles.drawerItem, {marginTop: 20}]} onPress={handleLogout}>
                    <Text style={[styles.drawerItemText, {color: '#d9534f'}]}> Logout</Text>
                 </TouchableOpacity>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      )}

      <View style={styles.navBar}>
        <View style={styles.navRight}>
          <TouchableOpacity onPress={() => setShowDrawer(true)} style={styles.hamburgerBtn}>
            <View style={styles.hamburgerLine} /><View style={styles.hamburgerLine} /><View style={styles.hamburgerLine} />
          </TouchableOpacity>
          <Text style={styles.logoText}>MENU</Text>
        </View>
        <View style={styles.navRight}>
          <TouchableOpacity style={styles.navLink}><Text style={styles.navLinkText}>SERVICES</Text></TouchableOpacity>
          <TouchableOpacity style={styles.loginBtn} onPress={() => setShowLogin(true)}>
            <Text style={styles.loginBtnText}>{isLoggedIn ? (userRole === 'employee' ? 'STAFF' : 'PROFILE') : 'LOGIN'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <ImageBackground source={require('../../assets/towel_background.jpg')} style={styles.heroBackground}>
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>Pillow Paradise</Text>
            <Text style={styles.heroSubText}>Affordable Sheets in Baker's Thrift Shop</Text>
            <View style={styles.heroDivider} />
            <Text style={styles.heroDesc}>Transform your bedroom into a sanctuary with our premium collection of bedsheets, pillowcases, and comforters. High-end feel without the price tag.</Text>
          </View>
        </ImageBackground>

        <View style={styles.descriptionSection}>
          <Text style={styles.sectionTitleDark}>Customer Feedbacks</Text>
          <View style={styles.feedbackGrid}>
            <View style={styles.feedbackCard}><Text style={styles.feedbackName}>Jonie Jane</Text><Text style={styles.starRating}>★★★★★</Text><Text style={styles.feedbackText}>"I am satisfied with the texture! Will buy more soon."</Text></View>
            <View style={styles.feedbackCard}><Text style={styles.feedbackName}>Jhun Debri</Text><Text style={styles.starRating}>★★★★★</Text><Text style={styles.feedbackText}>"Worth the price! Will recommend this shop to my Family and Friends!"</Text></View>
          </View>
        </View>

        {isLoggedIn && userRole === 'customer' && (
          <>
            <View style={styles.categoryHeader}><Text style={styles.sectionTitleLight}>Shop by Category</Text></View>
            <View style={styles.categoryContainer}>
              <TouchableOpacity style={styles.openCategoriesButton} onPress={() => setShowCategoryModal(true)}>
                <Text style={styles.openCategoriesButtonText}>OPEN CATEGORIES</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <ImageBackground source={require('../../assets/index1.jpg')} style={styles.inquirySection}>
          <View style={styles.inquiryOverlay}>
            <Text style={styles.inquiryTitle}>Let's Get In Touch!</Text>
            <TouchableOpacity style={styles.downloadBtn} onPress={() => Alert.alert("Contact", "Form coming soon!")}>
              <Text style={styles.downloadText}>GET IN TOUCH</Text>
            </TouchableOpacity>
          </View>
        </ImageBackground>

        <View style={styles.contactFormContainer}>
          <Text style={styles.contactFormSubtitle}>Have questions? Send us a message and we'll get back to you shortly.</Text>
          <TextInput style={styles.contactInput} placeholder="Your Full Name" placeholderTextColor="#999" value={contactName} onChangeText={setContactName} />
          <TextInput style={styles.contactInput} placeholder="Email Address" placeholderTextColor="#999" keyboardType="email-address" value={contactEmail} onChangeText={setContactEmail} />
          <TextInput style={[styles.contactInput, styles.messageInput]} placeholder="How can we help you?" placeholderTextColor="#999" multiline numberOfLines={4} value={contactMessage} onChangeText={setContactMessage} />
          <TouchableOpacity style={styles.submitContactBtn} onPress={() => { Alert.alert("Sent", `Thank you ${contactName}! Message sent.`); setContactName(''); setContactEmail(''); setContactMessage(''); }}>
            <Text style={styles.submitContactText}>SEND MESSAGE</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* LOYALTY MODAL */}
      <Modal visible={showLoyaltyModal} animationType="slide" transparent={true}>
        <View style={styles.loyaltyModalBackdrop}>
            <View style={styles.loyaltyContentCard}>
                <Text style={styles.loyaltyMainTitle}>Experience Pure Luxury ✨</Text>
                <Text style={styles.loyaltyBodyText}>
                    At Soft Slumber, our linens are hand-picked to ensure a rich, cloud-like texture that rivals 5-star hotel quality.
                    {"\n\n"}Get that high-end silk and cotton sateen feel at an affordable price. Shop now and unlock a 20% DISCOUNT automatically on your 5th and 10th purchase!
                </Text>
                <TouchableOpacity style={styles.closeLoyaltyBtn} onPress={() => setShowLoyaltyModal(false)}>
                    <Text style={styles.closeLoyaltyBtnText}>START SHOPPING</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>

      {/* AUTH MODAL */}
      <Modal visible={showLogin} animationType="slide">
        <SafeAreaView style={styles.authContainer}>
          <TouchableOpacity onPress={() => setShowLogin(false)} style={styles.closeAuth}>
            <Text style={{fontSize: 24}}>✕</Text>
          </TouchableOpacity>
          
          <ScrollView contentContainerStyle={styles.authContent}>
            <Text style={styles.welcomeBackTitle}>
              {authMode === 'login' ? 'Welcome' : (authMode === 'signup' ? 'Create Account' : 'Staff Registration')}
            </Text>

            <TextInput placeholder="Username" style={[styles.loginInput, {marginTop: 20}]} placeholderTextColor="#999" value={username} onChangeText={setUsername} />
            
            {authMode !== 'login' && (
              <TextInput placeholder="Email Address" style={styles.loginInput} placeholderTextColor="#999" value={email} onChangeText={setEmail} />
            )}

            <TextInput placeholder="Password" secureTextEntry style={styles.loginInput} placeholderTextColor="#999" value={password} onChangeText={setPassword} />

            {authMode === 'login' ? (
              <>
                <TouchableOpacity style={styles.customerLoginBtn} onPress={async () => {
                  await AsyncStorage.setItem('userRole', 'customer');
                  setIsLoggedIn(true);
                  setUserRole('customer');
                  setShowLogin(false);
                }}>
                  <Text style={styles.customerLoginText}>CUSTOMER LOGIN</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.employeeLoginBtn} onPress={async () => {
                  await AsyncStorage.setItem('userRole', 'employee');
                  setIsLoggedIn(true);
                  setUserRole('employee');
                  setShowLogin(false);
                  router.replace('/admin');
                }}>
                  <Text style={styles.employeeLoginText}>SIGN IN AS ADMIN</Text>
                </TouchableOpacity>

                <View style={styles.loginDividerRow}>
                  <View style={styles.dividerLine} /><Text style={styles.dividerOrText}>OR</Text><View style={styles.dividerLine} />
                </View>
                
                {/* Updated Google Sign In Button */}
                <TouchableOpacity 
                  style={styles.googleSignUpBtn} 
                  onPress={() => promptAsync()}
                  disabled={!request}
                >
                  <Text style={styles.googleSignUpText}>SIGN IN WITH GOOGLE ACCOUNT</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.googleSignUpBtn, {marginTop: 10, borderColor: Colors.secondary}]} onPress={() => setAuthMode('employee_signup')}>
                  <Text style={[styles.googleSignUpText, {color: Colors.secondary}]}>JOIN THE STAFF TEAM</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.customerLoginBtn} onPress={handleSignUp}>
                    <Text style={styles.customerLoginText}>
                        {authMode === 'employee_signup' ? 'REGISTER' : 'CREATE ACCOUNT'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setAuthMode('login')} style={{marginTop: 20}}>
                  <Text style={styles.cancelText}>Already have an account? Login</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
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
      <CategoryModal
        visible={showCategoryModal}
        categories={categories}
        onClose={() => setShowCategoryModal(false)}
        onAddToCart={addToCart}
      />
      <PaymentMethodsModal visible={showPaymentMethodsModal} onClose={() => setShowPaymentMethodsModal(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  navBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.7)', height: 100, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 40 },
  navLeft: { flexDirection: 'row', alignItems: 'center' },
  hamburgerBtn: { marginRight: 15, width: 25, height: 18, justifyContent: 'space-between' },
  hamburgerLine: { width: '100%', height: 3, backgroundColor: 'white', borderRadius: 2 },
  navRight: { flexDirection: 'row', alignItems: 'center' },
  navLink: { marginRight: 5 },
  navLinkText: { color: 'white', fontWeight: 'bold', fontSize: 12, marginRight: 15 },
  logoText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  loginBtn: { backgroundColor: Colors.secondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 },
  loginBtnText: { color: 'white', fontWeight: 'bold', fontSize: 11 },
  drawerOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 100, flexDirection: 'row' },
  drawerCloseArea: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  drawerContent: { width: 260, backgroundColor: '#5d3a1a', height: '100%', padding: 20, borderRightWidth: 1, borderRightColor: '#5d3a1a' },
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, paddingTop: 40 },
  drawerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.primary },
  closeIcon: { fontSize: 20 },
  drawerItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#ffffff' },
  drawerItemText: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
  sectionLabel: { fontSize: 10, fontWeight: 'bold', color: '#999', marginTop: 15, marginBottom: 5 },
  dropdownContent: { backgroundColor: '#bbb263', padding: 12, borderRadius: 5, marginTop: 5 },
  subItem: { paddingVertical: 8 },
  subItemText: { fontSize: 12, color: '#0f0d0d' },
  drawerDivider: { height: 15 },
  cartActionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  cartBtnCancel: { backgroundColor: '#d9534f', padding: 8, borderRadius: 4, width: '45%', alignItems: 'center' },
  cartBtnCheckout: { backgroundColor: '#5cb85c', padding: 8, borderRadius: 4, width: '45%', alignItems: 'center' },
  cartBtnText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  cartItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#d1c899' },
  cartItemDetails: { flex: 1 },
  cartItemOption: { fontSize: 10, color: '#514c31', marginTop: 2 },
  cartItemPrice: { fontSize: 11, color: Colors.primary, fontWeight: 'bold', marginTop: 3 },
  cartQuantityControls: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  cartQuantityButton: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.white, justifyContent: 'center', alignItems: 'center' },
  cartQuantityButtonText: { color: Colors.primary, fontSize: 16, fontWeight: 'bold', lineHeight: 18 },
  cartQuantityText: { width: 24, textAlign: 'center', fontSize: 12, fontWeight: 'bold', color: Colors.black },
  cartTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, marginTop: 4 },
  cartTotalLabel: { fontSize: 12, fontWeight: 'bold', color: '#514c31' },
  cartTotalValue: { fontSize: 12, fontWeight: 'bold', color: Colors.primary },
  loyaltyModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  loyaltyContentCard: { backgroundColor: '#FDFCF0', width: '100%', borderRadius: 20, padding: 25 },
  loyaltyMainTitle: { fontSize: 22, fontWeight: 'bold', color: Colors.primary, marginBottom: 15, textAlign: 'center' },
  loyaltyBodyText: { fontSize: 15, color: '#444', lineHeight: 22, textAlign: 'center' },
  closeLoyaltyBtn: { backgroundColor: Colors.primary, padding: 15, borderRadius: 10, marginTop: 20, alignItems: 'center' },
  closeLoyaltyBtnText: { color: 'white', fontWeight: 'bold' },
  heroBackground: { width: '100%', height: 600 },
  heroOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 40 },
  heroTitle: { color: 'white', fontSize: 42, fontWeight: 'bold', textAlign: 'center' },
  heroSubText: { color: Colors.accent, fontSize: 18, marginTop: 10 },
  heroDivider: { width: 50, height: 3, backgroundColor: 'white', marginVertical: 20 },
  heroDesc: { color: 'white', textAlign: 'center', fontSize: 14, lineHeight: 22 },
  descriptionSection: { padding: 40, alignItems: 'center' },
  sectionTitleDark: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  feedbackGrid: { width: '100%', flexDirection: 'row', justifyContent: 'space-between' },
  feedbackCard: { width: '48%', backgroundColor: Colors.background, padding: 15, borderRadius: 8 },
  feedbackName: { fontWeight: 'bold', fontSize: 13 },
  starRating: { color: Colors.accent, marginVertical: 5 },
  feedbackText: { fontSize: 11, fontStyle: 'italic' },
  categoryHeader: { padding: 30, backgroundColor: 'black', alignItems: 'center' },
  sectionTitleLight: { color: 'white', fontWeight: 'bold', fontSize: 20 },
  categoryContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  openCategoriesButton: { backgroundColor: Colors.primary, margin: 24, paddingVertical: 16, borderRadius: 8, alignSelf: 'stretch', alignItems: 'center' },
  openCategoriesButtonText: { color: 'white', fontWeight: 'bold', letterSpacing: 1 },
  categoryCard: { width: width / 2, height: 220 },
  catImg: { width: '100%', height: '100%' },
  catOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' },
  catLabel: { color: 'white', fontWeight: 'bold' },
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
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  productModal: { backgroundColor: 'white', padding: 25, borderRadius: 15 },
  pModalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 15 },
  productPrice: { fontSize: 18, fontWeight: 'bold', color: Colors.secondary, marginTop: -10 },
  optionLabel: { fontSize: 11, fontWeight: 'bold', color: '#888', marginTop: 15 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  chip: { borderWidth: 1, borderColor: '#ddd', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8, marginBottom: 8 },
  activeChip: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  chipText: { fontSize: 12 },
  addBtn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 25 },
  addBtnText: { color: 'white', fontWeight: 'bold' },
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
  authContent: { paddingBottom: 40 }
});
