import AsyncStorage from '@react-native-async-storage/async-storage';
import { logActivity } from './activityStore';
import { sha256 } from './shopStore';

// Admin / staff sign-in for the shop.
// Only the owner (OWNER_EMAIL) can create staff accounts, and every staff email must end in STAFF_DOMAIN.
// The owner password is NOT written in this file: only a salted SHA-256 hash of it is.

export const STAFF_DOMAIN = '@bakerthriftshop.com';
export const OWNER_EMAIL = 'zara@bakerthriftshop.com';
const OWNER_NAME = 'Zara';
const OWNER_SALT = 'bt-owner-v1';
const OWNER_HASH = 'a8f596d676dc16d15094136a0b18c347ac0ba9618d1d046d6b5837c076edbd9d';

export type StaffRole = 'Cashier' | 'Inventory Clerk' | 'Manager';

export interface StaffAccount {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
  added: string; // ISO date
  salt: string;
  passwordHash: string;
}
// What the screens get to see: never the password data.
export type PublicStaff = Omit<StaffAccount, 'salt' | 'passwordHash'>;

export interface StaffSession {
  email: string;
  name: string;
  role: 'Owner' | StaffRole;
  isOwner: boolean;
}

const STAFF_KEY = 'bt_staff';
const SESSION_KEY = 'bt_staff_session';
const LOCK_KEY = 'bt_admin_lock';
const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 30;

export const STAFF_EMAIL_PATTERN = /^[a-z0-9._-]+@bakerthriftshop\.com$/;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
const writeJson = async (key: string, value: unknown) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable
  }
};

const toPublic = (a: StaffAccount): PublicStaff => ({
  id: a.id,
  name: a.name,
  email: a.email,
  role: a.role,
  active: a.active,
  added: a.added,
});

// ---------- session ----------
export async function getStaffSession(): Promise<StaffSession | null> {
  const s = await readJson<StaffSession | null>(SESSION_KEY, null);
  return s && s.email ? s : null;
}

export async function logoutStaff(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
    await AsyncStorage.removeItem('userRole');
  } catch {
    // nothing to do
  }
}

// ---------- sign in ----------
export type LoginResult = { ok: true; session: StaffSession } | { ok: false; error: string };

export async function loginStaff(emailInput: string, password: string): Promise<LoginResult> {
  const lock = await readJson<{ fails: number; until: number }>(LOCK_KEY, { fails: 0, until: 0 });
  if (lock.until > Date.now()) {
    const seconds = Math.ceil((lock.until - Date.now()) / 1000);
    return { ok: false, error: `Too many failed attempts. Try again in ${seconds} seconds.` };
  }

  const email = emailInput.trim().toLowerCase();
  let session: StaffSession | null = null;

  if (email && password) {
    if (email === OWNER_EMAIL) {
      if (sha256(`${OWNER_SALT}:${password}`) === OWNER_HASH) {
        session = { email: OWNER_EMAIL, name: OWNER_NAME, role: 'Owner', isOwner: true };
      }
    } else {
      const accounts = await readJson<StaffAccount[]>(STAFF_KEY, []);
      const account = accounts.find((a) => a.email === email);
      if (account && account.active && sha256(`${account.salt}:${password}`) === account.passwordHash) {
        session = { email: account.email, name: account.name, role: account.role, isOwner: false };
      }
    }
  }

  if (!session) {
    const fails = lock.fails + 1;
    if (fails >= MAX_ATTEMPTS) {
      await writeJson(LOCK_KEY, { fails: 0, until: Date.now() + LOCK_SECONDS * 1000 });
      return { ok: false, error: `Too many failed attempts. Try again in ${LOCK_SECONDS} seconds.` };
    }
    await writeJson(LOCK_KEY, { fails, until: 0 });
    return { ok: false, error: 'Incorrect email or password.' };
  }

  await writeJson(LOCK_KEY, { fails: 0, until: 0 });
  await writeJson(SESSION_KEY, session);
   await AsyncStorage.setItem('userRole', 'employee');
  await logActivity('staff', `${session.name} (${session.role})`, 'Staff sign in');
  return { ok: true, session };
}

// ---------- staff accounts (owner only) ----------
export async function loadStaff(): Promise<PublicStaff[]> {
  const list = await readJson<StaffAccount[]>(STAFF_KEY, []);
  return list.map(toPublic);
}

export type StaffResult = { ok: true; staff: PublicStaff } | { ok: false; error: string };

export async function createStaff(input: {
  name: string;
  email: string;
  password: string;
  role: StaffRole;
}): Promise<StaffResult> {
  const session = await getStaffSession();
  if (!session?.isOwner) return { ok: false, error: 'Only the owner can create staff accounts.' };

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 2) return { ok: false, error: 'Enter the full name of the staff member.' };
  if (!STAFF_EMAIL_PATTERN.test(email)) return { ok: false, error: `Staff emails must end in ${STAFF_DOMAIN}.` };
  if (email === OWNER_EMAIL) return { ok: false, error: 'This email already has an account.' };
  if (input.password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };

  const accounts = await readJson<StaffAccount[]>(STAFF_KEY, []);
  if (accounts.some((a) => a.email === email)) return { ok: false, error: 'This email already has an account.' };

  const salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const account: StaffAccount = {
    id: `st${Date.now()}${Math.floor(Math.random() * 1000)}`,
    name,
    email,
    role: input.role,
    active: true,
    added: new Date().toISOString(),
    salt,
    passwordHash: sha256(`${salt}:${input.password}`),
  };
  await writeJson(STAFF_KEY, [account, ...accounts]);
  return { ok: true, staff: toPublic(account) };
}

export async function setStaffActive(id: string, active: boolean): Promise<void> {
  const session = await getStaffSession();
  if (!session?.isOwner) return;
  const accounts = await readJson<StaffAccount[]>(STAFF_KEY, []);
  await writeJson(STAFF_KEY, accounts.map((a) => (a.id === id ? { ...a, active } : a)));
}

export async function removeStaff(id: string): Promise<void> {
  const session = await getStaffSession();
  if (!session?.isOwner) return;
  const accounts = await readJson<StaffAccount[]>(STAFF_KEY, []);
  await writeJson(STAFF_KEY, accounts.filter((a) => a.id !== id));
}