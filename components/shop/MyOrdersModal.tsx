import React, { useEffect, useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
    formatDate,
    formatDateTime,
    loadOrdersFor,
    OnlineOrder,
    ORDER_STEPS,
    OrderStatus,
    peso,
    PublicCustomer,
    subscribeToChanges,
} from './shopStore';

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

const SHORT: Record<OrderStatus, string> = {
  'Order placed': 'Placed',
  Packed: 'Packed',
  'Out for delivery': 'On the way',
  Delivered: 'Delivered',
  Cancelled: 'Cancelled',
};

interface Props {
  visible: boolean;
  customer: PublicCustomer | null;
  onClose: () => void;
}

export default function MyOrdersModal({ visible, customer, onClose }: Props) {
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Refreshes by itself while this screen is open, so status changes appear live
  useEffect(() => {
    if (!visible || !customer) return;
    let alive = true;
    const refresh = async () => {
      const list = await loadOrdersFor(customer.id);
      if (alive) {
        setOrders(list);
        setLoaded(true);
      }
    };
    refresh();
    const stop = subscribeToChanges(refresh, 2500);
    return () => {
      alive = false;
      stop();
    };
  }, [visible, customer]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>My Orders</Text>
            <Text style={styles.live}>● Live · updates automatically</Text>
          </View>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {!loaded ? (
            <Text style={styles.empty}>Loading your orders...</Text>
          ) : orders.length === 0 ? (
            <Text style={styles.empty}>You have not placed any orders yet.</Text>
          ) : (
            orders.map((o) => {
              const current = ORDER_STEPS.indexOf(o.status);
              const cancelled = o.status === 'Cancelled';
              const deliveredAt = o.history.find((h) => h.status === 'Delivered')?.at;
              return (
                <View key={o.id} style={styles.card}>
                  <View style={styles.cardHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.receipt}>{o.id}</Text>
                      <Text style={styles.small}>Placed {formatDateTime(o.placedAt)}</Text>
                    </View>
                    <View style={[styles.pill, { backgroundColor: cancelled ? '#FDECEC' : o.status === 'Delivered' ? '#E6F5EE' : Colors.cream }]}>
                      <Text style={[styles.pillText, { color: cancelled ? Colors.danger : o.status === 'Delivered' ? Colors.success : Colors.secondary }]}>
                        {o.status}
                      </Text>
                    </View>
                  </View>

                  {cancelled ? (
                    <Text style={styles.cancelled}>This order was cancelled. Please contact us if you have questions.</Text>
                  ) : (
                    <View style={{ marginVertical: 14 }}>
                      <View style={styles.trackRow}>
                        {ORDER_STEPS.map((s, i) => (
                          <React.Fragment key={s}>
                            {i > 0 && <View style={[styles.trackLine, i <= current && styles.trackLineOn]} />}
                            <View style={[styles.trackDot, i <= current && styles.trackDotOn]}>
                              {i <= current && <Text style={styles.trackCheck}>✓</Text>}
                            </View>
                          </React.Fragment>
                        ))}
                      </View>
                      <View style={styles.trackLabels}>
                        {ORDER_STEPS.map((s, i) => (
                          <Text key={s} style={[styles.trackLabel, i <= current && styles.trackLabelOn]}>{SHORT[s]}</Text>
                        ))}
                      </View>
                    </View>
                  )}

                  {!cancelled && (
                    <View style={styles.etaBox}>
                      <Text style={styles.etaLabel}>{o.status === 'Delivered' ? 'Delivered on' : 'Expected delivery'}</Text>
                      <Text style={styles.etaValue}>
                        {o.status === 'Delivered' && deliveredAt ? formatDate(deliveredAt) : `${formatDate(o.etaFrom)} - ${formatDate(o.etaTo)}`}
                      </Text>
                    </View>
                  )}

                  <View style={styles.divider} />
                  {o.items.map((l, i) => (
                    <View key={i} style={styles.lineRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.lineName}>{l.quantity}× {l.name}</Text>
                        <Text style={styles.small}>{l.size} · {l.color} · {l.style} · {l.texture}</Text>
                      </View>
                      <Text style={styles.lineName}>{peso(l.price * l.quantity)}</Text>
                    </View>
                  ))}
                  <View style={styles.divider} />

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Payment</Text>
                    <Text style={styles.infoValue}>{o.payment} · {o.paid ? 'Paid' : 'Awaiting payment'}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Deliver to</Text>
                    <Text style={[styles.infoValue, { flex: 1, textAlign: 'right' }]}>{o.address}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>{peso(o.total)}</Text>
                  </View>
                </View>
              );
            })
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
  live: { fontSize: 11, color: Colors.success, marginTop: 2, fontWeight: '600' },
  close: { fontSize: 22, color: Colors.primary },
  content: { padding: 20, paddingBottom: 40, width: '100%', maxWidth: 640, alignSelf: 'center' },
  empty: { textAlign: 'center', color: Colors.muted, paddingVertical: 50, fontSize: 14 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  receipt: { fontSize: 16, fontWeight: 'bold', color: Colors.secondary },
  small: { fontSize: 11, color: Colors.muted, marginTop: 2 },
  pill: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 14 },
  pillText: { fontSize: 11, fontWeight: 'bold' },
  cancelled: { color: Colors.danger, fontSize: 13, marginVertical: 12 },
  trackRow: { flexDirection: 'row', alignItems: 'center' },
  trackDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  trackDotOn: { backgroundColor: Colors.success },
  trackCheck: { color: Colors.white, fontSize: 12, fontWeight: 'bold' },
  trackLine: { flex: 1, height: 3, backgroundColor: Colors.border },
  trackLineOn: { backgroundColor: Colors.success },
  trackLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  trackLabel: { fontSize: 10, color: Colors.muted, width: 62, textAlign: 'center' },
  trackLabelOn: { color: Colors.success, fontWeight: 'bold' },
  etaBox: { backgroundColor: Colors.cream, borderRadius: 10, padding: 12 },
  etaLabel: { fontSize: 11, color: Colors.muted },
  etaValue: { fontSize: 15, fontWeight: 'bold', color: Colors.primary, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  lineRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  lineName: { fontSize: 13, fontWeight: '600', color: '#000' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, gap: 12 },
  infoLabel: { fontSize: 13, color: Colors.muted },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#000' },
  totalLabel: { fontSize: 15, fontWeight: 'bold', color: Colors.primary },
  totalValue: { fontSize: 18, fontWeight: 'bold', color: Colors.secondary },
});