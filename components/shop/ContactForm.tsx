import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { sendInquiry } from './inquiryStore';
import type { PublicCustomer } from './shopStore';

const Colors = { primary: '#5d3a1a', background: '#F8F5F2', danger: '#d9534f', success: '#2E9E6B' };

export default function ContactForm({ customer }: { customer: PublicCustomer | null }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (customer) {
      setName((n) => n || `${customer.firstName} ${customer.lastName}`);
      setEmail((e) => e || customer.email);
    }
  }, [customer]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    setSent(false);
    const result = await sendInquiry({ name, email, message, customerId: customer?.id });
    setBusy(false);
    if (result.ok) {
      setSent(true);
      setMessage('');
    } else {
      setError(result.error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>Have questions? Send us a message and we'll get back to you shortly.</Text>
      <TextInput style={styles.input} placeholder="Your Full Name" placeholderTextColor="#999" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Email Address" placeholderTextColor="#999" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
      <TextInput style={[styles.input, styles.messageInput]} placeholder="How can we help you?" placeholderTextColor="#999" multiline numberOfLines={4} value={message} onChangeText={setMessage} />
      {!!error && <Text style={styles.error}>{error}</Text>}
      {sent && <Text style={styles.success}>Thank you! Your message was sent. Our team will reply soon.</Text>}
      <TouchableOpacity style={[styles.btn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
        <Text style={styles.btnText}>{busy ? 'SENDING...' : 'SEND MESSAGE'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 30, backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: '#e0d8cf' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 25, lineHeight: 20 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 15, marginBottom: 15, fontSize: 14, color: '#000' },
  messageInput: { height: 120, textAlignVertical: 'top' },
  error: { color: Colors.danger, fontSize: 13, fontWeight: '600', marginBottom: 10, textAlign: 'center' },
  success: { color: Colors.success, fontSize: 13, fontWeight: '600', marginBottom: 10, textAlign: 'center' },
  btn: { backgroundColor: Colors.primary, padding: 18, borderRadius: 8, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: 'bold', letterSpacing: 1 },
});