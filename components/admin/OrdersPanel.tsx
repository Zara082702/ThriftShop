import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
    formatDate,
    formatDateTime,
    OnlineOrder,
    ORDER_STEPS,
    OrderStatus,
    peso,
    PublicCustomer,
    updateOrder,
} from '../shop/shopStore';

const Colors = {
  primary: '#E2875E',
  primaryLight: '#FCEFE9',
  background: '#F9F6F3',
  surface: '#FFFFFF',
  textDark: '#1A1A1A',
  textMuted: '#8E8E93',
  border: '#EBEBEB',
  danger: '#E53935',
  success: '#2E9E6B',
};

const STATUS_OPTIONS: OrderStatus[] = [...ORDER_STEPS, 'Cancelled'];
const STATUS_COLORS: Record<OrderStatus, { bg: string; fg: string }> = {
  'Order placed': { bg: '#FCEFE9', fg: '#E2875E' },
  Packed: { bg: '#FFF4DD', fg: '#C98A1B' },
  'Out for delivery': { bg: '#E6EEFB', fg: '#3B6FD1' },
  Delivered: { bg: '#E6F5EE', fg: '#2E9E6B' },
  Cancelled: { bg: '#FDECEC', fg: '#E53935' },
};

interface Props {
  orders: OnlineOrder[];
  customers: PublicCustomer[];
  onToast: (message: string) => void;
  onChanged: () => void; // asks the admin screen to reload the orders
}

export default function OrdersPanel({ orders, customers, onToast, onChanged }: Props) {
  const [tab, setTab] = useState<'orders' | 'customers'>('orders');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'ALL' | OrderStatus>('ALL');

  const q = query.trim().toLowerCase();
  const visible = orders
    .filter((o) => filter === 'ALL' || o.status === filter)
    .filter((o) => !q || `${o.id} ${o.customerName} ${o.username} ${o.email} ${o.phone}`.toLowerCase().includes(q));

  const revenue = orders.filter((o) => o.status !== 'Cancelled').reduce((t, o) => t + o.total, 0);
  const toPack = orders.filter((o) => o.status === 'Order placed').length;

  const setStatus = async (o: OnlineOrder, status: OrderStatus) => {
    if (status === o.status) return;
    await updateOrder(o.id, { status });
    onChanged();
    onToast(`${o.id} is now "${status}".`);
  };

  const togglePaid = async (o: OnlineOrder) => {
    await updateOrder(o.id, { paid: !o.paid });
    onChanged();
    onToast(o.paid ? `${o.id} marked as unpaid.` : `${o.id} marked as paid.`);
  };

  return (
    <View>
      <View style={styles.statRow}>
        <View style={styles.statCard}><Text style={styles.statValue}>{orders.length}</Text><Text style={styles.statLabel}>Online orders</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{toPack}</Text><Text style={styles.statLabel}>New, to pack</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{peso(revenue)}</Text><Text style={styles.statLabel}>Online sales</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{customers.length}</Text><Text style={styles.statLabel}>Registered customers</Text></View>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, tab === 'orders' && styles.tabActive]} onPress={() => setTab('orders')}>
          <Text style={[styles.tabText, tab === 'orders' && styles.tabTextActive]}>Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'customers' && styles.tabActive]} onPress={() => setTab('customers')}>
          <Text style={[styles.tabText, tab === 'customers' && styles.tabTextActive]}>Registered customers</Text>
        </TouchableOpacity>
        <Text style={styles.live}>● Live</Text>
      </View>

      {tab === 'orders' ? (
        <View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search receipt no., name, username, email or phone..."
            placeholderTextColor={Colors.textMuted}
            style={styles.search}
          />
          <View style={styles.chipRow}>
            {(['ALL', ...STATUS_OPTIONS] as const).map((s) => (
              <TouchableOpacity key={s} style={[styles.chip, filter === s && styles.chipActive]} onPress={() => setFilter(s)}>
                <Text style={[styles.chipText, filter === s && styles.chipTextActive]}>{s === 'ALL' ? 'All' : s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {visible.length === 0 ? (
            <Text style={styles.empty}>{orders.length === 0 ? 'No online orders yet. New orders will appear here automatically.' : 'No orders match your search.'}</Text>
          ) : (
            visible.map((o) => {
              const colors = STATUS_COLORS[o.status];
              const locked = o.status === 'Cancelled';
              return (
                <View key={o.id} style={styles.card}>
                  <View style={styles.cardHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.receipt}>{o.id}</Text>
                      <Text style={styles.small}>{formatDateTime(o.placedAt)}</Text>
                    </View>
                    <View style={[styles.pill, { backgroundColor: colors.bg }]}>
                      <Text style={[styles.pillText, { color: colors.fg }]}>{o.status}</Text>
                    </View>
                  </View>

                  <View style={styles.customerBox}>
                    <Text style={styles.customerName}>{o.customerName}</Text>
                    <Text style={styles.small}>@{o.username} · {o.email} · {o.phone}</Text>
                    <Text style={styles.small}>📍 {o.address}</Text>
                  </View>

                  {o.items.map((l, i) => (
                    <View key={i} style={styles.lineRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.lineName}>{l.quantity}× {l.name}</Text>
                        <Text style={styles.small}>Size {l.size} · {l.color} · Style: {l.style} · Texture: {l.texture}</Text>
                      </View>
                      <Text style={styles.lineName}>{peso(l.price * l.quantity)}</Text>
                    </View>
                  ))}

                  <View style={styles.footRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.small}>Payment: <Text style={styles.bold}>{o.payment}</Text></Text>
                      <Text style={styles.small}>Expected delivery: <Text style={styles.bold}>{formatDate(o.etaFrom)} - {formatDate(o.etaTo)}</Text></Text>
                    </View>
                    <Text style={styles.total}>{peso(o.total)}</Text>
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.paidBtn, o.paid && styles.paidBtnOn]}
                      onPress={() => togglePaid(o)}
                      disabled={locked}
                    >
                      <Text style={[styles.paidText, o.paid && { color: Colors.success }]}>{o.paid ? '✓ Paid' : 'Mark as paid'}</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.updateLabel}>Update delivery status</Text>
                  <View style={styles.chipRow}>
                    {STATUS_OPTIONS.map((s) => {
                      const disabled = locked || (o.status === 'Delivered' && s === 'Cancelled');
                      return (
                        <TouchableOpacity
                          key={s}
                          disabled={disabled}
                          style={[styles.chip, o.status === s && styles.chipActive, disabled && o.status !== s && { opacity: 0.4 }]}
                          onPress={() => setStatus(o, s)}
                        >
                          <Text style={[styles.chipText, o.status === s && styles.chipTextActive]}>{s}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })
          )}
        </View>
      ) : customers.length === 0 ? (
        <Text style={styles.empty}>No customers have registered yet.</Text>
      ) : (
        customers.map((c) => {
          const mine = orders.filter((o) => o.customerId === c.id && o.status !== 'Cancelled');
          const spent = mine.reduce((t, o) => t + o.total, 0);
          return (
            <View key={c.id} style={styles.customerRow}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{c.firstName.charAt(0).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.customerName}>{c.firstName} {c.lastName}</Text>
                <Text style={styles.small}>@{c.username} · {c.email} · {c.phone}</Text>
                <Text style={styles.small}>Joined {formatDate(c.createdAt)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.total}>{peso(spent)}</Text>
                <Text style={styles.small}>{mine.length} {mine.length === 1 ? 'order' : 'orders'}</Text>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  statCard: { flexGrow: 1, flexBasis: 150, backgroundColor: Colors.background, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  statValue: { color: Colors.primary, fontSize: 22, fontWeight: 'bold' },
  statLabel: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  tabRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { color: Colors.textMuted, fontWeight: '600', fontSize: 12 },
  tabTextActive: { color: Colors.surface },
  live: { marginLeft: 'auto', color: Colors.success, fontSize: 11, fontWeight: 'bold' },
  search: { backgroundColor: Colors.surface, height: 40, borderRadius: 20, paddingHorizontal: 16, borderWidth: 1, borderColor: Colors.border, fontSize: 13, color: Colors.textDark, marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, marginRight: 8, marginBottom: 6, backgroundColor: Colors.surface },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: Colors.surface },
  empty: { color: Colors.textMuted, textAlign: 'center', padding: 30, fontSize: 13 },
  card: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 16, marginBottom: 14, backgroundColor: Colors.surface },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  receipt: { color: Colors.primary, fontSize: 16, fontWeight: 'bold' },
  small: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  bold: { color: Colors.textDark, fontWeight: '700' },
  pill: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 14 },
  pillText: { fontSize: 11, fontWeight: 'bold' },
  customerBox: { backgroundColor: Colors.background, borderRadius: 10, padding: 12, marginBottom: 12 },
  customerName: { color: Colors.textDark, fontSize: 14, fontWeight: 'bold' },
  lineRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  lineName: { color: Colors.textDark, fontSize: 13, fontWeight: '600' },
  footRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10, marginTop: 4 },
  total: { color: Colors.primary, fontSize: 18, fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', marginTop: 10, marginBottom: 4 },
  paidBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary },
  paidBtnOn: { borderColor: Colors.success, backgroundColor: '#E6F5EE' },
  paidText: { color: Colors.primary, fontWeight: 'bold', fontSize: 12 },
  updateLabel: { color: Colors.textDark, fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 8 },
  customerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: Colors.surface, fontWeight: 'bold', fontSize: 16 },
});