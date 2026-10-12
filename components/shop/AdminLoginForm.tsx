import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { loginStaff, StaffSession } from './staffStore';

const Colors = {
  primary: '#5d3a1a',
  secondary: '#8b5e34',
  cream: '#F3E9E0',
  border: '#E3D9CF',
  danger: '#d9534f',
  white: '#FFFFFF',
};

interface Props {
  onSuccess: (session: StaffSession) => void;
  onBack: () => void;
}

export default function AdminLoginForm({ onSuccess, onBack }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your admin email and password.');
      return;
    }
    setBusy(true);
    const result = await loginStaff(email, password);
    setBusy(false);
    setPassword('');
    if (result.ok) onSuccess(result.session);
    else setError(result.error);
  };

  return (
    <View style={styles.container}>
      <View style={styles.lockCircle}>
        <Text style={styles.lockIcon}>🔒</Text>
      </View>
      <Text style={styles.title}>Admin Sign In</Text>
      <Text style={styles.subtitle}>AUTHORIZED STAFF ONLY</Text>

      <Text style={styles.label}>Username</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Username"
        placeholderTextColor="#999"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        style={styles.input}
      />

      <Text style={styles.label}>Password</Text>
      <View style={styles.passwordWrap}>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          placeholderTextColor="#999"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={submit}
          style={styles.passwordInput}
        />
        <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
          <Text style={styles.showText}>{showPassword ? 'Hide' : 'Show'}</Text>
        </TouchableOpacity>
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={[styles.submitBtn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
        <Text style={styles.submitText}>{busy ? 'SIGNING IN...' : 'SIGN IN'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack} style={{ marginTop: 20 }}>
        <Text style={styles.backText}>← Back to customer login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 30 },
  lockCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.cream, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  lockIcon: { fontSize: 28 },
  title: { fontSize: 30, fontWeight: 'bold', color: Colors.primary },
  subtitle: { fontSize: 13, color: '#777', marginTop: 6, marginBottom: 20, lineHeight: 19 },
  label: { fontSize: 12, fontWeight: 'bold', color: Colors.primary, marginBottom: 6, marginTop: 6 },
  input: { backgroundColor: Colors.cream, height: 52, borderRadius: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border, fontSize: 14, color: '#000', marginBottom: 8 },
  passwordWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.cream, height: 52, borderRadius: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border },
  passwordInput: { flex: 1, fontSize: 14, color: '#000', height: 52 },
  showText: { color: Colors.secondary, fontWeight: 'bold', fontSize: 12, paddingLeft: 10 },
  error: { color: Colors.danger, fontSize: 13, fontWeight: '600', marginTop: 14 },
  submitBtn: { backgroundColor: Colors.primary, height: 54, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  submitText: { color: Colors.white, fontWeight: 'bold', letterSpacing: 1 },
  backText: { textAlign: 'center', color: Colors.secondary, fontWeight: '600' },
});