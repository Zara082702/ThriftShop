import AsyncStorage from '@react-native-async-storage/async-storage';

// Activity log: a permanent record of who did what and when (customers, staff and the system).

export type ActorType = 'customer' | 'staff' | 'system';

export interface ActivityEntry {
  id: string;
  at: string; // ISO date
  actorType: ActorType;
  actor: string;
  action: string;
  details: string;
}

const ACTIVITY_KEY = 'bt_activity';
const STAFF_SESSION_KEY = 'bt_staff_session';
const MAX_ENTRIES = 1000;

// One write at a time, so two events at the same moment never overwrite each other
let queue: Promise<void> = Promise.resolve();

export function logActivity(actorType: ActorType, actor: string, action: string, details = ''): Promise<void> {
  queue = queue.then(async () => {
    try {
      const raw = await AsyncStorage.getItem(ACTIVITY_KEY);
      const list: ActivityEntry[] = raw ? JSON.parse(raw) : [];
      const entry: ActivityEntry = {
        id: `a${Date.now()}${Math.floor(Math.random() * 1000)}`,
        at: new Date().toISOString(),
        actorType,
        actor,
        action,
        details,
      };
      await AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify([entry, ...list].slice(0, MAX_ENTRIES)));
    } catch {
      // logging must never break the app
    }
  });
  return queue;
}

// For staff actions: uses the name of whoever is signed in to the admin
export async function logStaffActivity(action: string, details = ''): Promise<void> {
  let actor = 'Staff';
  try {
    const raw = await AsyncStorage.getItem(STAFF_SESSION_KEY);
    const session = raw ? JSON.parse(raw) : null;
    if (session?.name) actor = `${session.name} (${session.role})`;
  } catch {
    // keep the default name
  }
  return logActivity('staff', actor, action, details);
}

export async function loadActivity(): Promise<ActivityEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVITY_KEY);
    return raw ? (JSON.parse(raw) as ActivityEntry[]) : [];
  } catch {
    return [];
  }
}