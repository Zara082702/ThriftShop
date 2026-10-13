import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ChatThread, loadThread, markChatRead, sendCustomerMessage } from './chatStore';
import { GCASH_QR } from './paymentConfig';
import { formatTime, PublicCustomer, subscribeToChanges } from './shopStore';

const Colors = { primary: '#5d3a1a', secondary: '#8b5e34', cream: '#F3E9E0', border: '#E3D9CF', danger: '#d9534f', muted: '#8E8E93' };

interface Props {
  customer: PublicCustomer | null;
  onNeedLogin: () => void;
}

export default function ChatWidget({ customer, onNeedLogin }: Props) {
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Live: reload the conversation every few seconds
  useEffect(() => {
    if (!customer) {
      setThread(null);
      return;
    }
    let alive = true;
    const refresh = async () => {
      const t = await loadThread(customer.id);
      if (alive) setThread(t);
    };
    refresh();
    const stop = subscribeToChanges(refresh, 2500);
    return () => {
      alive = false;
      stop();
    };
  }, [customer]);

  // Opening the chat marks the staff messages as read
  useEffect(() => {
    if (open && customer && thread && thread.customerUnread > 0) markChatRead(customer.id, 'customer');
  }, [open, customer, thread]);

  useEffect(() => {
    if (open) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, [open, thread?.messages.length]);

  const send = async () => {
    if (!customer) return;
    const result = await sendCustomerMessage(customer, text);
    if (result.ok) {
      setText('');
      setError('');
      setThread(await loadThread(customer.id));
    } else {
      setError(result.error);
    }
  };

  const unread = thread?.customerUnread || 0;

  if (!open) {
    return (
      <TouchableOpacity style={styles.bubble} onPress={() => setOpen(true)}>
        <Text style={styles.bubbleIcon}>💬</Text>
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Chat with us</Text>
          <Text style={styles.headerSub}>Baker's Thrift Shop staff</Text>
        </View>
        <TouchableOpacity onPress={() => setOpen(false)}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </View>

      {!customer ? (
        <View style={styles.center}>
          <Text style={styles.hint}>Please log in or create an account to chat with our staff.</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => { setOpen(false); onNeedLogin(); }}>
            <Text style={styles.loginBtnText}>LOG IN</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={{ padding: 12 }}>
            {(!thread || thread.messages.length === 0) && (
              <Text style={styles.hint}>Hi {customer.firstName}! Ask us anything about your order or payment. Our staff will reply here.</Text>
            )}
            {thread?.messages.map((m) => (
              <View key={m.id} style={[styles.msg, m.from === 'customer' ? styles.mine : styles.theirs]}>
                {m.from === 'staff' && <Text style={styles.sender}>{m.sender} · Staff</Text>}
                <Text style={[styles.msgText, m.from === 'customer' && { color: '#fff' }]}>{m.text}</Text>
                {m.attachment === 'gcash-qr' && <Image source={GCASH_QR} style={styles.qr} resizeMode="contain" />}
                <Text style={[styles.time, m.from === 'customer' && { color: '#E7D9CC' }]}>{formatTime(m.at)}</Text>
              </View>
            ))}
          </ScrollView>
          {!!error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type a message..."
              placeholderTextColor="#999"
              style={styles.input}
              onSubmitEditing={send}
              returnKeyType="send"
            />
            <TouchableOpacity style={styles.sendBtn} onPress={send}>
              <Text style={styles.sendText}>Send</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { position: 'absolute', right: 18, bottom: 18, zIndex: 60, width: 58, height: 58, borderRadius: 29, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 8 },
  bubbleIcon: { fontSize: 26 },
  badge: { position: 'absolute', top: -2, right: -2, backgroundColor: Colors.danger, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  panel: { position: 'absolute', right: 18, bottom: 18, zIndex: 60, width: 330, maxWidth: '92%', height: 460, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', elevation: 10 },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, padding: 14 },
  headerTitle: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  headerSub: { color: '#E7D9CC', fontSize: 11, marginTop: 1 },
  close: { color: '#fff', fontSize: 18 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  hint: { color: Colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  loginBtn: { backgroundColor: Colors.primary, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 8, marginTop: 16 },
  loginBtnText: { color: '#fff', fontWeight: 'bold' },
  messages: { flex: 1, backgroundColor: '#F8F5F2' },
  msg: { maxWidth: '82%', padding: 10, borderRadius: 12, marginBottom: 8 },
  mine: { alignSelf: 'flex-end', backgroundColor: Colors.secondary },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border },
  sender: { fontSize: 10, fontWeight: 'bold', color: Colors.secondary, marginBottom: 2 },
  msgText: { fontSize: 13, color: '#000', lineHeight: 18 },
  qr: { width: 190, height: 360, marginTop: 8, alignSelf: 'center' },
  time: { fontSize: 9, color: Colors.muted, marginTop: 4, textAlign: 'right' },
  error: { color: Colors.danger, fontSize: 11, paddingHorizontal: 12, paddingTop: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderTopWidth: 1, borderTopColor: Colors.border, gap: 8 },
  input: { flex: 1, backgroundColor: Colors.cream, borderRadius: 20, paddingHorizontal: 14, height: 40, color: '#000' },
  sendBtn: { backgroundColor: Colors.primary, borderRadius: 20, paddingHorizontal: 16, height: 40, justifyContent: 'center' },
  sendText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
});