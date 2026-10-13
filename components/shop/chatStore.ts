import AsyncStorage from '@react-native-async-storage/async-storage';
import { logActivity } from './activityStore';

// Live chat between a logged-in customer and the shop staff (one conversation per customer).

export interface ChatMessage {
  id: string;
  from: 'customer' | 'staff';
  sender: string;
  text: string;
  at: string;
  attachment?: 'gcash-qr'; // shows the GCash QR code image in the chat
}

export interface ChatThread {
  customerId: string;
  customerName: string;
  username: string;
  messages: ChatMessage[];
  lastAt: string;
  customerUnread: number; // staff messages the customer has not opened yet
  staffUnread: number; // customer messages the staff has not opened yet
}

const CHAT_KEY = 'bt_chats';

let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job);
  queue = run.catch(() => undefined);
  return run;
}

async function read(): Promise<ChatThread[]> {
  try {
    const raw = await AsyncStorage.getItem(CHAT_KEY);
    return raw ? (JSON.parse(raw) as ChatThread[]) : [];
  } catch {
    return [];
  }
}
const write = async (list: ChatThread[]) => {
  try {
    await AsyncStorage.setItem(CHAT_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable
  }
};

const newMessage = (from: 'customer' | 'staff', sender: string, text: string, attachment?: 'gcash-qr'): ChatMessage => ({
  id: `m${Date.now()}${Math.floor(Math.random() * 1000)}`,
  from,
  sender,
  text,
  at: new Date().toISOString(),
  ...(attachment ? { attachment } : {}),
});

export async function loadThreads(): Promise<ChatThread[]> {
  return (await read()).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export async function loadThread(customerId: string): Promise<ChatThread | null> {
  return (await read()).find((t) => t.customerId === customerId) || null;
}

export type ChatResult = { ok: true } | { ok: false; error: string };

export function sendCustomerMessage(
  customer: { id: string; firstName: string; lastName: string; username: string },
  text: string
): Promise<ChatResult> {
  return enqueue(async () => {
    const clean = text.trim();
    if (!clean) return { ok: false, error: 'Type a message first.' } as ChatResult;
    if (clean.length > 1000) return { ok: false, error: 'Message is too long (1000 characters maximum).' } as ChatResult;
    const list = await read();
    const name = `${customer.firstName} ${customer.lastName}`;
    const msg = newMessage('customer', name, clean);
    const existing = list.find((t) => t.customerId === customer.id);
    if (existing) {
      await write(list.map((t) => (t.customerId === customer.id ? { ...t, messages: [...t.messages, msg], lastAt: msg.at, staffUnread: t.staffUnread + 1 } : t)));
    } else {
      const thread: ChatThread = {
        customerId: customer.id,
        customerName: name,
        username: customer.username,
        messages: [msg],
        lastAt: msg.at,
        customerUnread: 0,
        staffUnread: 1,
      };
      await write([thread, ...list]);
      await logActivity('customer', customer.username, 'Started chat', clean.slice(0, 60));
    }
    return { ok: true } as ChatResult;
  });
}

export function sendStaffMessage(customerId: string, text: string, staffName: string, attachment?: 'gcash-qr'): Promise<ChatResult> {
  return enqueue(async () => {
    const clean = text.trim();
    if (!clean) return { ok: false, error: 'Type a message first.' } as ChatResult;
    if (clean.length > 1000) return { ok: false, error: 'Message is too long (1000 characters maximum).' } as ChatResult;
    const list = await read();
    if (!list.some((t) => t.customerId === customerId)) return { ok: false, error: 'Conversation not found.' } as ChatResult;
    const msg = newMessage('staff', staffName, clean, attachment);
    await write(list.map((t) => (t.customerId === customerId ? { ...t, messages: [...t.messages, msg], lastAt: msg.at, customerUnread: t.customerUnread + 1 } : t)));
    return { ok: true } as ChatResult;
  });
}

export function markChatRead(customerId: string, reader: 'customer' | 'staff'): Promise<void> {
  return enqueue(async () => {
    const list = await read();
    const t = list.find((x) => x.customerId === customerId);
    if (!t) return;
    if (reader === 'customer' ? t.customerUnread === 0 : t.staffUnread === 0) return;
    await write(list.map((x) => (x.customerId === customerId ? { ...x, ...(reader === 'customer' ? { customerUnread: 0 } : { staffUnread: 0 }) } : x)));
  });
}