import React from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { BANK_DETAILS, GCASH_INSTRUCTIONS, GCASH_QR } from './paymentConfig';
import type { PaymentMethod } from './shopStore';

const Colors = { primary: '#5d3a1a', secondary: '#8b5e34', cream: '#F3E9E0', border: '#E3D9CF', muted: '#8E8E93' };

interface Props {
  method: PaymentMethod;
  reference?: string;
  onReferenceChange?: (value: string) => void; // pass this to show the reference box (checkout only)
}

export default function PaymentInstructions({ method, reference, onReferenceChange }: Props) {
  if (method === 'GCash') {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>Pay with GCash</Text>
        <Image source={GCASH_QR} style={styles.qr} resizeMode="contain" />
        <Text style={styles.text}>{GCASH_INSTRUCTIONS}</Text>
        {onReferenceChange && (
          <TextInput
            value={reference}
            onChangeText={onReferenceChange}
            placeholder="GCash reference number (optional now)"
            placeholderTextColor="#999"
            style={styles.input}
          />
        )}
      </View>
    );
  }
  if (method === 'Bank Transfer') {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>Pay by bank transfer</Text>
        <View style={styles.row}><Text style={styles.label}>Bank</Text><Text style={styles.value}>{BANK_DETAILS.bankName}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Account name</Text><Text style={styles.value}>{BANK_DETAILS.accountName}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Account number</Text><Text style={styles.value}>{BANK_DETAILS.accountNumber}</Text></View>
        <Text style={styles.text}>Send the exact total, then message us your proof of payment in the chat.</Text>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 16 },
  title: { fontSize: 15, fontWeight: 'bold', color: Colors.primary, marginBottom: 10 },
  qr: { width: 220, height: 420, alignSelf: 'center', marginBottom: 10 },
  text: { fontSize: 12, color: Colors.muted, lineHeight: 18, marginTop: 4 },
  input: { backgroundColor: Colors.cream, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, padding: 12, marginTop: 12, color: '#000' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  label: { fontSize: 13, color: Colors.muted },
  value: { fontSize: 14, fontWeight: 'bold', color: Colors.primary },
});
