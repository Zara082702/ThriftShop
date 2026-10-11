import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
    EMAIL_PATTERN,
    PHONE_PATTERN,
    PublicCustomer,
    registerCustomer,
    USERNAME_PATTERN,
} from './shopStore';

const Colors = {
  primary: '#5d3a1a',
  secondary: '#8b5e34',
  cream: '#F3E9E0',
  border: '#E3D9CF',
  danger: '#d9534f',
  white: '#FFFFFF',
};

interface Props {
  onRegistered: (customer: PublicCustomer) => void;
  onSwitchToLogin: () => void;
}

type FormKey = 'firstName' | 'lastName' | 'email' | 'phone' | 'username' | 'password' | 'confirm';

export default function RegisterForm({ onRegistered, onSwitchToLogin }: Props) {
  const [form, setForm] = useState<Record<FormKey, string>>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    confirm: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');

  const set = (key: FormKey) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const errors: Record<FormKey, string> = {
    firstName: form.firstName.trim() ? '' : 'Enter your first name.',
    lastName: form.lastName.trim() ? '' : 'Enter your last name.',
    email: EMAIL_PATTERN.test(form.email.trim()) ? '' : 'Enter a valid email address.',
    phone: PHONE_PATTERN.test(form.phone.trim()) ? '' : 'Enter a valid phone number, e.g. 09171234567.',
    username: USERNAME_PATTERN.test(form.username.trim()) ? '' : '3-20 letters, numbers, _ or .',
    password: form.password.length >= 8 ? '' : 'Use at least 8 characters.',
    confirm: form.confirm === form.password ? '' : 'Passwords do not match.',
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const submit = async () => {
    setSubmitted(true);
    setServerError('');
    if (hasErrors || busy) return;
    setBusy(true);
    const result = await registerCustomer({
      firstName: form.firstName,
      lastName: form.lastName,
      username: form.username,
      email: form.email,
      phone: form.phone,
      password: form.password,
    });
    setBusy(false);
    if (result.ok) onRegistered(result.customer);
    else setServerError(result.error);
  };

  const renderField = (
    label: string,
    key: FormKey,
    placeholder: string,
    options: { keyboardType?: 'default' | 'email-address' | 'phone-pad'; secure?: boolean; capitalize?: 'none' | 'words' } = {}
  ) => (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={form[key]}
        onChangeText={set(key)}
        placeholder={placeholder}
        placeholderTextColor="#999"
        keyboardType={options.keyboardType || 'default'}
        secureTextEntry={!!options.secure && !showPassword}
        autoCapitalize={options.capitalize || 'none'}
        style={[styles.input, submitted && !!errors[key] && styles.inputError]}
      />
      {submitted && !!errors[key] && <Text style={styles.error}>{errors[key]}</Text>}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create your account</Text>
      <Text style={styles.subtitle}>Sign up to buy from Baker's Thrift Shop and track your orders.</Text>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>{renderField('First name', 'firstName', 'Maria', { capitalize: 'words' })}</View>
        <View style={{ flex: 1 }}>{renderField('Last name', 'lastName', 'Santos', { capitalize: 'words' })}</View>
      </View>

      {renderField('Email address', 'email', 'name@example.com', { keyboardType: 'email-address' })}
      {renderField('Phone number', 'phone', '09171234567', { keyboardType: 'phone-pad' })}
      {renderField('Username', 'username', 'maria_s')}
      {renderField('Password', 'password', 'At least 8 characters', { secure: true })}
      {renderField('Confirm password', 'confirm', 'Type your password again', { secure: true })}

      <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
        <Text style={styles.showText}>{showPassword ? 'Hide passwords' : 'Show passwords'}</Text>
      </TouchableOpacity>

      {!!serverError && <Text style={styles.serverError}>{serverError}</Text>}

      <TouchableOpacity style={[styles.submitBtn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
        <Text style={styles.submitText}>{busy ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}</Text>
      </TouchableOpacity>

      <Text style={styles.privacy}>We only use your details to process and deliver your orders.</Text>

      <TouchableOpacity onPress={onSwitchToLogin} style={{ marginTop: 18 }}>
        <Text style={styles.loginLink}>Already have an account? Log in</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 30 },
  title: { fontSize: 30, fontWeight: 'bold', color: Colors.primary },
  subtitle: { fontSize: 13, color: '#777', marginTop: 6, marginBottom: 18, lineHeight: 19 },
  row: { flexDirection: 'row', gap: 12 },
  fieldWrap: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: 'bold', color: Colors.primary, marginBottom: 6 },
  input: { backgroundColor: Colors.cream, height: 50, borderRadius: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border, fontSize: 14, color: '#000' },
  inputError: { borderColor: Colors.danger },
  error: { color: Colors.danger, fontSize: 11, marginTop: 4 },
  showText: { color: Colors.secondary, fontWeight: 'bold', fontSize: 12, marginBottom: 6 },
  serverError: { color: Colors.danger, fontSize: 13, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  submitBtn: { backgroundColor: Colors.primary, height: 54, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 14 },
  submitText: { color: Colors.white, fontWeight: 'bold', letterSpacing: 1 },
  privacy: { color: '#999', fontSize: 11, textAlign: 'center', marginTop: 12 },
  loginLink: { textAlign: 'center', color: Colors.secondary, fontWeight: '600' },
});