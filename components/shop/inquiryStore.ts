import AsyncStorage from '@react-native-async-storage/async-storage';
import { logActivity, logStaffActivity } from './activityStore';
import { EMAIL_PATTERN } from './shopStore';

// Messages sent with the "Get in touch" form on the main page. The admin reads them in Inquiries & Chat.

export interface InquiryReply {
  text: string;
  date: string;
  by: string;
}

export interface Inquiry {
  id: string;
  name: string;
  email: string;
  message: string;
  customerId?: string; // set when the sender was logged in
  date: string;
  replies: InquiryReply[];
  resolved: boolean;
}

const INQUIRIES_KEY = 'bt_inquiries';

// One change at a time, so two messages at the same moment never overwrite each other
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job);
  queue = run.catch(() => undefined);
  return run;
}

async function read(): Promise<Inquiry[]> {
  try {
    const raw = await AsyncStorage.getItem(INQUIRIES_KEY);
    return raw ? (JSON.parse(raw) as Inquiry[]) : [];
  } catch {
    return [];
  }
}
const write = async (list: Inquiry[]) => {
  try {
    await AsyncStorage.setItem(INQUIRIES_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable
  }
};

export const loadInquiries = read;

export type InquiryResult = { ok: true; inquiry: Inquiry } | { ok: false; error: string };

export function sendInquiry(input: { name: string; email: string; message: string; customerId?: string }): Promise<InquiryResult> {
  return enqueue(async () => {
    const name = input.name.trim();
    const email = input.email.trim();
    const message = input.message.trim();
    if (name.length < 2) return { ok: false, error: 'Please enter your full name.' } as InquiryResult;
    if (!EMAIL_PATTERN.test(email)) return { ok: false, error: 'Please enter a valid email address.' } as InquiryResult;
    if (message.length < 10) return { ok: false, error: 'Please write a little more (at least 10 characters).' } as InquiryResult;
    if (message.length > 1000) return { ok: false, error: 'Your message is too long (1000 characters maximum).' } as InquiryResult;

    const inquiry: Inquiry = {
      id: `q${Date.now()}${Math.floor(Math.random() * 1000)}`,
      name,
      email,
      message,
      ...(input.customerId ? { customerId: input.customerId } : {}),
      date: new Date().toISOString(),
      replies: [],
      resolved: false,
    };
    await write([inquiry, ...(await read())]);
    await logActivity('customer', input.customerId ? name : `${name} (guest)`, 'Sent inquiry', message.slice(0, 80));
    return { ok: true, inquiry } as InquiryResult;
  });
}

export function replyToInquiry(id: string, text: string, by: string): Promise<void> {
  return enqueue(async () => {
    const reply = text.trim();
    if (!reply) return;
    const list = await read();
    const target = list.find((q) => q.id === id);
    if (!target) return;
    await write(list.map((q) => (q.id === id ? { ...q, replies: [...q.replies, { text: reply, date: new Date().toISOString(), by }] } : q)));
    await logStaffActivity('Replied to inquiry', `${target.name}: ${reply.slice(0, 60)}`);
  });
}

export function setInquiryResolved(id: string, resolved: boolean): Promise<void> {
  return enqueue(async () => {
    const list = await read();
    const target = list.find((q) => q.id === id);
    if (!target) return;
    await write(list.map((q) => (q.id === id ? { ...q, resolved } : q)));
    await logStaffActivity(resolved ? 'Resolved inquiry' : 'Reopened inquiry', target.name);
  });
}