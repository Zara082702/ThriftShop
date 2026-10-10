import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { CartItem } from './types';

type CartModalProps = {
  visible: boolean;
  items: CartItem[];
  onClose: () => void;
  onUpdateQuantity: (itemId: string, change: number) => void;
  onClear: () => void;
  onCheckout: () => void;
};

export function CartModal({ visible, items, onClose, onUpdateQuantity, onClear, onCheckout }: CartModalProps) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>My Cart</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close cart"><Text style={styles.close}>×</Text></TouchableOpacity>
          </View>

          {items.length === 0 ? (
            <Text style={styles.empty}>Your cart is empty.</Text>
          ) : (
            <>
              {items.map((item) => (
                <View key={item.id} style={styles.item}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemOption}>{item.size} · {item.color}</Text>
                    <Text style={styles.itemPrice}>PHP {(item.price * item.quantity).toFixed(2)}</Text>
                  </View>
                  <View style={styles.quantityControls}>
                    <TouchableOpacity style={styles.quantityButton} onPress={() => onUpdateQuantity(item.id, -1)}><Text style={styles.quantityButtonText}>−</Text></TouchableOpacity>
                    <Text style={styles.quantity}>{item.quantity}</Text>
                    <TouchableOpacity style={styles.quantityButton} onPress={() => onUpdateQuantity(item.id, 1)}><Text style={styles.quantityButtonText}>+</Text></TouchableOpacity>
                  </View>
                </View>
              ))}
              <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalValue}>PHP {total.toFixed(2)}</Text></View>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.clearButton} onPress={onClear}><Text style={styles.clearText}>CLEAR</Text></TouchableOpacity>
                <TouchableOpacity style={styles.checkoutButton} onPress={onCheckout}><Text style={styles.checkoutText}>CHECKOUT</Text></TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#5d3a1a' },
  close: { fontSize: 30, color: '#5d3a1a', lineHeight: 30 },
  empty: { color: '#666', textAlign: 'center', paddingVertical: 32 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEEEEE' },
  itemInfo: { flex: 1 }, itemName: { fontWeight: 'bold', color: '#222' }, itemOption: { color: '#666', fontSize: 12, marginTop: 3 }, itemPrice: { color: '#8b5e34', fontWeight: 'bold', marginTop: 4 },
  quantityControls: { flexDirection: 'row', alignItems: 'center', gap: 8 }, quantityButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F8F5F2', justifyContent: 'center', alignItems: 'center' }, quantityButtonText: { color: '#5d3a1a', fontSize: 18, fontWeight: 'bold' }, quantity: { minWidth: 18, textAlign: 'center', fontWeight: 'bold' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 20 }, totalLabel: { fontSize: 16, fontWeight: 'bold' }, totalValue: { fontSize: 16, fontWeight: 'bold', color: '#5d3a1a' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 }, clearButton: { flex: 1, borderWidth: 1, borderColor: '#d9534f', borderRadius: 8, padding: 14, alignItems: 'center' }, clearText: { color: '#d9534f', fontWeight: 'bold' }, checkoutButton: { flex: 1, backgroundColor: '#5d3a1a', borderRadius: 8, padding: 14, alignItems: 'center' }, checkoutText: { color: '#FFFFFF', fontWeight: 'bold' },
});
