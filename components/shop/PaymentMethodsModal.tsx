import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type PaymentMethodsModalProps = { visible: boolean; onClose: () => void };

export function PaymentMethodsModal({ visible, onClose }: PaymentMethodsModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}><Text style={styles.title}>Payment Methods</Text><TouchableOpacity onPress={onClose} accessibilityLabel="Close payment methods"><Text style={styles.close}>×</Text></TouchableOpacity></View>
          <View style={styles.method}><Text style={styles.methodTitle}>GCash</Text><Text style={styles.methodDescription}>Pay quickly through your GCash account at checkout.</Text></View>
          <View style={styles.method}><Text style={styles.methodTitle}>Bank Transfer</Text><Text style={styles.methodDescription}>Bank details will be provided after you place your order.</Text></View>
          <Text style={styles.note}>Choose your preferred method during checkout.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }, sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }, title: { fontSize: 22, fontWeight: 'bold', color: '#5d3a1a' }, close: { fontSize: 30, color: '#5d3a1a', lineHeight: 30 }, method: { borderWidth: 1, borderColor: '#E5DED8', borderRadius: 10, padding: 16, marginBottom: 12 }, methodTitle: { color: '#5d3a1a', fontWeight: 'bold', fontSize: 16 }, methodDescription: { color: '#666', marginTop: 5, lineHeight: 19 }, note: { color: '#777', fontSize: 12, textAlign: 'center', marginTop: 8 },
});
