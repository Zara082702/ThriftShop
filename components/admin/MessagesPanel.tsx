import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ChatThread, markChatRead, sendStaffMessage } from '../shop/chatStore';
import { Inquiry, replyToInquiry, setInquiryResolved } from '../shop/inquiryStore';
import { BANK_DETAILS, GCASH_QR } from '../shop/paymentConfig';
import { formatDate, formatTime } from '../shop/shopStore';

const Colors = { primary: '#E2875E', light: '#FCEFE9', background: '#F9F6F3', text: '#1A1A1A', muted: '#8E8E93', border: '#EBEBEB', danger: '#E53935', success: '#2E9E6B' };

interface Props {
  inquiries: Inquiry[];
  threads: ChatThread[];
  staffName: string;
  onToast: (message: string) => void;
  onChanged: () => void;
}

export default function MessagesPanel({ inquiries, threads, staffName, onToast, onChanged }: Props) {
  const [tab, setTab] = useState<'chat' | 'inquiries'>('chat');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState('');
  const [text, setText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const openInquiries = inquiries.filter((q) => !q.resolved).length;
  const unreadChats = threads.reduce((t, x) => t + x.staffUnread, 0);
  const current = threads.find((t) => t.customerId === selected) || threads[0];
  const first = current ? current.customerName.split(' ')[0] : '';

  useEffect(() => {
    if (tab === 'chat' && current && current.staffUnread > 0) markChatRead(current.customerId, 'staff').then(onChanged);
  }, [tab, current?.customerId, current?.staffUnread]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, [current?.messages.length, current?.customerId]);

  const send = async (message: string, attachment?: 'gcash-qr') => {
    if (!current) return;
    const result = await sendStaffMessage(current.customerId, message, staffName, attachment);
    if (result.ok) {
      setText('');
      onChanged();
    } else {
      onToast(result.error);
    }
  };

  const sendReply = async (q: Inquiry) => {
    const reply = (drafts[q.id] || '').trim();
    if (!reply) {
      onToast('Type a reply first.');
      return;
    }
    await replyToInquiry(q.id, reply, staffName);
    setDrafts((d) => ({ ...d, [q.id]: '' }));
    onChanged();
    onToast('Reply saved.');
  };

  return (
    <View>
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, tab === 'chat' && styles.tabActive]} onPress={() => setTab('chat')}>
          <Text style={[styles.tabText, tab === 'chat' && { color: '#fff' }]}>Live chat{unreadChats > 0 ? ` (${unreadChats} new)` : ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'inquiries' && styles.tabActive]} onPress={() => setTab('inquiries')}>
          <Text style={[styles.tabText, tab === 'inquiries' && { color: '#fff' }]}>Inquiries{openInquiries > 0 ? ` (${openInquiries} open)` : ''}</Text>
        </TouchableOpacity>
        <Text style={styles.live}>● Live</Text>
      </View>

      {tab === 'chat' ? (
        threads.length === 0 || !current ? (
          <Text style={styles.empty}>No chats yet. When a customer writes to you from the chat bubble, it appears here.</Text>
        ) : (
          <View style={styles.chatLayout}>
            <View style={styles.list}>
              {threads.map((t) => (
                <TouchableOpacity key={t.customerId} style={[styles.thread, current.customerId === t.customerId && styles.threadActive]} onPress={() => setSelected(t.customerId)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.threadName} numberOfLines={1}>{t.customerName}</Text>
                    <Text style={styles.small} numberOfLines={1}>{t.messages[t.messages.length - 1]?.text}</Text>
                  </View>
                  {t.staffUnread > 0 && <View style={styles.dot}><Text style={styles.dotText}>{t.staffUnread}</Text></View>}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.conversation}>
              <Text style={styles.convTitle}>{current.customerName} · @{current.username}</Text>
              <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={{ padding: 10 }}>
                {current.messages.map((m) => (
                  <View key={m.id} style={[styles.msg, m.from === 'staff' ? styles.mine : styles.theirs]}>
                    <Text style={styles.sender}>{m.from === 'staff' ? m.sender : current.customerName}</Text>
                    <Text style={[styles.msgText, m.from === 'staff' && { color: '#fff' }]}>{m.text}</Text>
                    {m.attachment === 'gcash-qr' && <Image source={GCASH_QR} style={styles.qr} resizeMode="contain" />}
                    <Text style={styles.time}>{formatTime(m.at)}</Text>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.quickRow}>
                <TouchableOpacity style={styles.quick} onPress={() => send(`Hi ${first}! Please scan this GCash QR code and send the exact amount of your order. Then reply here with your reference number. Thank you!`, 'gcash-qr')}>
                  <Text style={styles.quickText}>Send GCash QR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quick} onPress={() => send(`Hi ${first}! Bank transfer details: ${BANK_DETAILS.bankName} · Account name: ${BANK_DETAILS.accountName} · Account number: ${BANK_DETAILS.accountNumber}. Please send us your proof of payment here.`)}>
                  <Text style={styles.quickText}>Send bank details</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quick} onPress={() => send(`Hi ${first}! We received your order and we are preparing it. Thank you for shopping with us!`)}>
                  <Text style={styles.quickText}>Order received</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputRow}>
                <TextInput value={text} onChangeText={setText} placeholder={`Reply to ${first}...`} placeholderTextColor={Colors.muted} style={styles.input} onSubmitEditing={() => send(text)} />
                <TouchableOpacity style={styles.sendBtn} onPress={() => send(text)}>
                  <Text style={styles.sendText}>Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )
      ) : inquiries.length === 0 ? (
        <Text style={styles.empty}>No inquiries yet. Messages sent with the "Get in touch" form on your main page appear here.</Text>
      ) : (
        inquiries.map((q) => (
          <View key={q.id} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.threadName}>{q.name}{q.customerId ? '  (customer)' : '  (guest)'}</Text>
                <Text style={styles.small}>{q.email} · {formatDate(q.date)}, {formatTime(q.date)}</Text>
              </View>
              <View style={[styles.pill, { backgroundColor: q.resolved ? '#E6F5EE' : Colors.light }]}>
                <Text style={[styles.pillText, { color: q.resolved ? Colors.success : Colors.primary }]}>{q.resolved ? 'Resolved' : 'Open'}</Text>
              </View>
            </View>
            <View style={styles.question}><Text style={styles.msgText}>"{q.message}"</Text></View>
            {q.replies.map((r, i) => (
              <View key={i} style={styles.answer}>
                <Text style={styles.msgText}>{r.text}</Text>
                <Text style={styles.small}>{r.by} · {formatDate(r.date)}, {formatTime(r.date)}</Text>
              </View>
            ))}
            <TextInput value={drafts[q.id] || ''} onChangeText={(t) => setDrafts((d) => ({ ...d, [q.id]: t }))} placeholder={`Write a reply to ${q.name}...`} placeholderTextColor={Colors.muted} multiline style={styles.replyInput} />
            <View style={styles.actions}>
              <TouchableOpacity style={styles.outlineBtn} onPress={async () => { await setInquiryResolved(q.id, !q.resolved); onChanged(); }}>
                <Text style={styles.outlineText}>{q.resolved ? 'Reopen' : 'Mark as resolved'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sendBtn} onPress={() => sendReply(q)}>
                <Text style={styles.sendText}>Save reply</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.small}>Replies are saved here. Emailing replies to customers comes with the online database (Supabase) step.</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, backgroundColor: '#fff' },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { color: Colors.muted, fontWeight: '600', fontSize: 12 },
  live: { marginLeft: 'auto', color: Colors.success, fontSize: 11, fontWeight: 'bold' },
  empty: { color: Colors.muted, textAlign: 'center', padding: 30, fontSize: 13 },
  chatLayout: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  list: { flexGrow: 1, flexBasis: 190, maxWidth: 260 },
  thread: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, marginBottom: 8, backgroundColor: '#fff' },
  threadActive: { backgroundColor: Colors.light, borderColor: Colors.primary },
  threadName: { color: Colors.text, fontWeight: 'bold', fontSize: 13 },
  small: { color: Colors.muted, fontSize: 11, marginTop: 2 },
  dot: { backgroundColor: Colors.danger, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center' },
  dotText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  conversation: { flexGrow: 3, flexBasis: 320, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff' },
  convTitle: { padding: 12, fontWeight: 'bold', color: Colors.text, borderBottomWidth: 1, borderBottomColor: Colors.border },
  messages: { height: 300, backgroundColor: Colors.background },
  msg: { maxWidth: '82%', padding: 10, borderRadius: 12, marginBottom: 8 },
  mine: { alignSelf: 'flex-end', backgroundColor: Colors.primary },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border },
  sender: { fontSize: 10, fontWeight: 'bold', color: Colors.muted, marginBottom: 2 },
  msgText: { fontSize: 13, color: Colors.text, lineHeight: 18 },
  qr: { width: 160, height: 300, marginTop: 8, alignSelf: 'center' },
  time: { fontSize: 9, color: Colors.muted, marginTop: 4, textAlign: 'right' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  quick: { backgroundColor: Colors.light, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 14 },
  quickText: { color: Colors.primary, fontSize: 11, fontWeight: 'bold' },
  inputRow: { flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  input: { flex: 1, backgroundColor: Colors.background, borderRadius: 20, paddingHorizontal: 14, height: 40, color: Colors.text },
  sendBtn: { backgroundColor: Colors.primary, borderRadius: 20, paddingHorizontal: 16, height: 40, justifyContent: 'center' },
  sendText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  card: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 14, marginBottom: 12, backgroundColor: '#fff' },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  pill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  pillText: { fontSize: 11, fontWeight: 'bold' },
  question: { backgroundColor: Colors.background, borderRadius: 10, padding: 12, marginBottom: 8 },
  answer: { backgroundColor: Colors.light, borderRadius: 10, padding: 12, marginBottom: 8 },
  replyInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, minHeight: 60, color: Colors.text, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginVertical: 10 },
  outlineBtn: { borderWidth: 1, borderColor: Colors.primary, paddingHorizontal: 16, height: 40, borderRadius: 20, justifyContent: 'center' },
  outlineText: { color: Colors.primary, fontWeight: 'bold', fontSize: 12 },
});