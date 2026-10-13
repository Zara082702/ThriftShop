import React, { useEffect, useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { parseCartId } from './inventoryStore';
import PaymentInstructions from './PaymentInstructions';
import {
  formatDate,
  formatDateTime,
  OnlineOrder,
  PAYMENT_METHODS,
  PaymentMethod,
  peso,
  placeOrder,
  PublicCustomer,
} from './shopStore';
import type { CartItem } from './types';

const Colors = {
  primary: '#5d3a1a',
  secondary: '#8b5e34',
  cream: '#F3E9E0',
  background: '#F8F5F2',
  border: '#E3D9CF',
  danger: '#d9534f',
  success: '#2E9E6B',
  white: '#FFFFFF',
  muted: '#8E8E93',
};

interface Props {
  visible: boolean;
  items: CartItem[];
  customer: PublicCustomer | null;
  onClose: () => void;
  onPlaced: () => void;
  onViewOrders: () => void;
}

const daysFromNow = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatDate(d.toISOString());
};

export default function CheckoutModal({ visible, items, customer, onClose, onPlaced, onViewOrders }: Props) {
  const [address, setAddress] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('Cash on Delivery');
  const [paymentRef, setPaymentRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [placed, setPlaced] = useState<OnlineOrder | null>(null);

  useEffect(() => {
    if (visible) {
      setPlaced(null);
      setError('');
    }
  }, [visible]);

  const total = items.reduce((t, i) => t + i.price * i.quantity, 0);

  const submit = async () => {
    if (!customer || busy) return;
    setBusy(true);
    setError('');
    const result = await placeOrder({
      customer,
      address,
      payment,
      paymentRef,
      lines: items.map((i) => {
        const p = parseCartId(i.id);
        return { productId: p.productId, size: p.size, texture: p.texture, style: p.style, quantity: i.quantity };
      }),
    });
    setBusy(false);
    if (!result.ok || !result.order) {
      setError(result.message || 'We could not place your order. Please try again.');
      return;
    }
    setPlaced(result.order);
    onPlaced();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{placed ? 'Order confirmed' : 'Checkout'}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {placed ? (
            <View>
              <View style={styles.card}>
                <Text style={styles.check}>✅</Text>
                <Text style={styles.thanks}>Thank you, {customer?.firstName}!</Text>
                <Text style={styles.small}>Receipt / Order No.</Text>
                <Text style={styles.receiptId}>{placed.id}</Text>
                <Text style={styles.small}>{formatDateTime(placed.placedAt)}</Text>

                <View style={styles.divider} />
                {placed.items.map((l, i) => (
                  <View key={i} style={styles.lineRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lineName}>{l.quantity}× {l.name}</Text>
                      <Text style={styles.small}>{l.size} · {l.texture} · {l.style}</Text>
                    </View>
                    <Text style={styles.lineName}>{peso(l.price * l.quantity)}</Text>
                  </View>
                ))}
                <View style={styles.divider} />

                <View style={styles.infoRow}><Text style={styles.infoLabel}>Payment</Text><Text style={styles.infoValue}>{placed.payment}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Deliver to</Text><Text style={[styles.infoValue, { flex: 1, textAlign: 'right' }]}>{placed.address}</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Expected delivery</Text><Text style={styles.infoValue}>{formatDate(placed.etaFrom)} - {formatDate(placed.etaTo)}</Text></View>
                <View style={styles.infoRow}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>{peso(placed.total)}</Text></View>
              </View>

              {!placed.paid && <PaymentInstructions method={placed.payment} />}
              <TouchableOpacity style={styles.primaryBtn} onPress={onViewOrders}>
                <Text style={styles.primaryBtnText}>TRACK MY ORDER</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineBtn} onPress={onClose}>
                <Text style={styles.outlineBtnText}>CONTINUE SHOPPING</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={styles.sectionTitle}>1. Delivery details</Text>
              <View style={styles.card}>
                <Text style={styles.infoValue}>{customer ? `${customer.firstName} ${customer.lastName}` : ''}</Text>
                <Text style={styles.small}>{customer?.phone} · {customer?.email}</Text>
                <Text style={styles.label}>Delivery address</Text>
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="House no., street, barangay, city, province"
                  placeholderTextColor="#999"
                  multiline
                  style={styles.addressInput}
                />
              </View>

              <Text style={styles.sectionTitle}>2. Payment method</Text>
              {PAYMENT_METHODS.map((p) => (
                <TouchableOpacity
                  key={p.method}
                  style={[styles.payCard, payment === p.method && styles.payCardActive]}
                  onPress={() => setPayment(p.method)}
                >
                  <Text style={styles.payEmoji}>{p.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.payTitle}>{p.method}</Text>
                    <Text style={styles.small}>{p.hint}</Text>
                  </View>
                  <View style={[styles.radio, payment === p.method && styles.radioOn]} />
                </TouchableOpacity>
              ))}

              <PaymentInstructions method={payment} reference={paymentRef} onReferenceChange={setPaymentRef} />
              <Text style={styles.sectionTitle}>3. Order summary</Text>
              <View style={styles.card}>
                {items.map((i) => (
                  <View key={i.id} style={styles.lineRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lineName}>{i.quantity}× {i.name}</Text>
                      <Text style={styles.small}>{i.size} · {i.color}</Text>
                    </View>
                    <Text style={styles.lineName}>{peso(i.price * i.quantity)}</Text>
                  </View>
                ))}
                <View style={styles.divider} />
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Estimated delivery</Text><Text style={styles.infoValue}>{daysFromNow(3)} - {daysFromNow(5)}</Text></View>
                <View style={styles.infoRow}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>{peso(total)}</Text></View>
              </View>

              {!!error && <Text style={styles.error}>{error}</Text>}

              <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
                <Text style={styles.primaryBtnText}>{busy ? 'PLACING ORDER...' : `PLACE ORDER · ${peso(total)}`}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 22, fontWeight: 'bold', color: Colors.primary },
  close: { fontSize: 22, color: Colors.primary },
  content: { padding: 20, paddingBottom: 40, width: '100%', maxWidth: 640, alignSelf: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: Colors.primary, marginTop: 6, marginBottom: 10 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: 'bold', color: Colors.primary, marginTop: 14, marginBottom: 6 },
  addressInput: { backgroundColor: Colors.cream, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, padding: 12, minHeight: 80, textAlignVertical: 'top', color: '#000' },
  payCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, padding: 14, marginBottom: 10 },
  payCardActive: { borderColor: Colors.secondary, backgroundColor: Colors.cream },
  payEmoji: { fontSize: 24, marginRight: 12 },
  payTitle: { fontSize: 14, fontWeight: 'bold', color: Colors.primary },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border },
  radioOn: { borderColor: Colors.secondary, backgroundColor: Colors.secondary },
  lineRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  lineName: { fontSize: 13, fontWeight: '600', color: '#000' },
  small: { fontSize: 11, color: Colors.muted, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, gap: 12 },
  infoLabel: { fontSize: 13, color: Colors.muted },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#000' },
  totalLabel: { fontSize: 15, fontWeight: 'bold', color: Colors.primary },
  totalValue: { fontSize: 18, fontWeight: 'bold', color: Colors.secondary },
  error: { color: Colors.danger, fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  primaryBtn: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 10, alignItems: 'center' },
  primaryBtnText: { color: Colors.white, fontWeight: 'bold', letterSpacing: 1 },
  outlineBtn: { borderWidth: 1, borderColor: Colors.primary, paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  outlineBtnText: { color: Colors.primary, fontWeight: 'bold', letterSpacing: 1 },
  check: { fontSize: 34, textAlign: 'center' },
  thanks: { fontSize: 20, fontWeight: 'bold', color: Colors.primary, textAlign: 'center', marginVertical: 6 },
  receiptId: { fontSize: 22, fontWeight: 'bold', color: Colors.secondary, marginVertical: 2 },
});