import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { ActivityEntry } from '../shop/activityStore';
import { formatDateTime } from '../shop/shopStore';

const Colors = { primary: '#E2875E', light: '#FCEFE9', background: '#F9F6F3', text: '#1A1A1A', muted: '#8E8E93', border: '#EBEBEB', success: '#2E9E6B' };
const TYPES = ['ALL', 'customer', 'staff', 'system'] as const;

export default function ActivityPanel({ entries }: { entries: ActivityEntry[] }) {
  const [filter, setFilter] = useState<(typeof TYPES)[number]>('ALL');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const shown = entries
    .filter((e) => filter === 'ALL' || e.actorType === filter)
    .filter((e) => !q || `${e.actor} ${e.action} ${e.details}`.toLowerCase().includes(q))
    .slice(0, 200);

  return (
    <View>
      <Text style={styles.intro}>A record of what customers and staff do on the website. {entries.length} entries saved.</Text>
      <TextInput value={query} onChangeText={setQuery} placeholder="Search who, what or details..." placeholderTextColor={Colors.muted} style={styles.search} />
      <View style={styles.chipRow}>
        {TYPES.map((t) => (
          <TouchableOpacity key={t} style={[styles.chip, filter === t && styles.chipActive]} onPress={() => setFilter(t)}>
            <Text style={[styles.chipText, filter === t && { color: '#fff' }]}>{t === 'ALL' ? 'All' : t === 'customer' ? 'Customers' : t === 'staff' ? 'Staff' : 'System'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {shown.length === 0 ? (
        <Text style={styles.empty}>No activity yet.</Text>
      ) : (
        shown.map((e) => (
          <View key={e.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <View style={styles.top}>
                <Text style={styles.action}>{e.action}</Text>
                <View style={[styles.pill, { backgroundColor: e.actorType === 'staff' ? Colors.light : '#E6F5EE' }]}>
                  <Text style={[styles.pillText, { color: e.actorType === 'staff' ? Colors.primary : Colors.success }]}>{e.actorType}</Text>
                </View>
              </View>
              <Text style={styles.who}>{e.actor}</Text>
              {!!e.details && <Text style={styles.details}>{e.details}</Text>}
            </View>
            <Text style={styles.time}>{formatDateTime(e.at)}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { color: Colors.muted, fontSize: 13, marginBottom: 12 },
  search: { backgroundColor: '#fff', height: 40, borderRadius: 20, paddingHorizontal: 16, borderWidth: 1, borderColor: Colors.border, fontSize: 13, color: Colors.text, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, marginRight: 8, marginBottom: 6, backgroundColor: '#fff' },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.muted, fontSize: 12, fontWeight: '600' },
  empty: { color: Colors.muted, textAlign: 'center', padding: 30 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  action: { color: Colors.text, fontWeight: 'bold', fontSize: 13 },
  pill: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 10 },
  pillText: { fontSize: 10, fontWeight: 'bold' },
  who: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  details: { color: Colors.text, fontSize: 12, marginTop: 2 },
  time: { color: Colors.muted, fontSize: 11, textAlign: 'right', maxWidth: 130 },
});