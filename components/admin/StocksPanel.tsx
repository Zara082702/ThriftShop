import React, { useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { logStaffActivity } from '../shop/activityStore';
import {
    InventoryItem,
    MIN_PIECES,
    priceFor,
    PRODUCT_CATEGORIES,
    ProductCategory,
    SIZE_OPTIONS,
    sizesOf,
    SKU_PREFIX,
    stockTotal,
    STYLE_OPTIONS,
    TEXTURE_OPTIONS,
} from '../shop/inventoryStore';
import { peso } from '../shop/shopStore';

const Colors = { primary: '#E2875E', light: '#FCEFE9', background: '#F9F6F3', text: '#1A1A1A', muted: '#8E8E93', border: '#EBEBEB', danger: '#E53935', success: '#2E9E6B', warning: '#E8A13A', disabled: '#D1D1D6' };
const EMOJI: Record<ProductCategory, string> = { BEDSHEETS: '🛏️', PILLOWCASES: '☁️', COMFORTERS: '🧥', BLANKETS: '🧣' };
const capitalize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

interface Props {
  items: InventoryItem[];
  onChange: (change: (items: InventoryItem[]) => InventoryItem[]) => Promise<unknown>;
  onToast: (message: string) => void;
}

export default function StocksPanel({ items, onChange, onToast }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'ALL' | ProductCategory>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [pieces, setPieces] = useState(String(MIN_PIECES));
  const [newCategory, setNewCategory] = useState<ProductCategory>('BEDSHEETS');

  const visible = items
    .filter((i) => category === 'ALL' || i.category === category)
    .filter((i) => (i.name + i.sku).toLowerCase().includes(query.trim().toLowerCase()));

  const lowSizes = items.reduce((t, i) => t + Object.values(i.stock).filter((n) => n < MIN_PIECES).length, 0);
  const totalPieces = items.reduce((t, i) => t + stockTotal(i), 0);

  const adjust = async (item: InventoryItem, size: string, delta: number) => {
    const old = item.stock[size];
    const next = Math.max(0, old + delta);
    if (next === old) return;
    await onChange((all) =>
      all.map((i) => (i.id === item.id ? { ...i, stock: { ...i.stock, [size]: Math.max(0, i.stock[size] + delta) } } : i))
    );
    await logStaffActivity('Stock updated', `${item.name} (${size}): ${old} → ${next}`);
  };

  const toggleActive = async (item: InventoryItem) => {
    await onChange((all) => all.map((i) => (i.id === item.id ? { ...i, active: !i.active } : i)));
    await logStaffActivity(item.active ? 'Product hidden' : 'Product shown', item.name);
  };

  const remove = async (item: InventoryItem) => {
    await onChange((all) => all.filter((i) => i.id !== item.id));
    await logStaffActivity('Product removed', item.name);
    onToast(`${item.name} removed.`);
  };

  const addProduct = async () => {
    const basePrice = parseFloat(price);
    const each = parseInt(pieces, 10);
    if (!name.trim() || isNaN(basePrice) || basePrice <= 0) {
      onToast('Enter a product name and a price above 0.');
      return;
    }
    if (isNaN(each) || each < MIN_PIECES) {
      onToast(`Every size needs at least ${MIN_PIECES} pieces.`);
      return;
    }
    const stock: Record<string, number> = {};
    SIZE_OPTIONS[newCategory].forEach((s) => (stock[s] = each));
    const count = items.filter((i) => i.category === newCategory).length + 1;
    const item: InventoryItem = {
      id: `n${Date.now()}`,
      sku: `BT-${SKU_PREFIX[newCategory]}-${String(count).padStart(3, '0')}`,
      name: name.trim(),
      category: newCategory,
      basePrice,
      stock,
      textures: [...TEXTURE_OPTIONS],
      styles: [...STYLE_OPTIONS],
      active: true,
      isNew: true,
    };
    await onChange((all) => [item, ...all]);
    await logStaffActivity('Product added', `${item.name} · ${each} pcs per size`);
    setName('');
    setPrice('');
    setPieces(String(MIN_PIECES));
    setShowForm(false);
    onToast(`${item.name} added.`);
  };

  return (
    <View>
      <View style={styles.statRow}>
        <View style={styles.statCard}><Text style={styles.statValue}>{items.length}</Text><Text style={styles.statLabel}>Products</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{totalPieces}</Text><Text style={styles.statLabel}>Pieces in stock</Text></View>
        <View style={styles.statCard}><Text style={[styles.statValue, lowSizes > 0 && { color: Colors.warning }]}>{lowSizes}</Text><Text style={styles.statLabel}>Sizes below {MIN_PIECES} pieces</Text></View>
      </View>

      <View style={styles.toolbar}>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search name or SKU..." placeholderTextColor={Colors.muted} style={styles.search} />
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm((v) => !v)}>
          <Text style={styles.addBtnText}>{showForm ? '× Close' : '+ Add product'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.chipRow}>
        {(['ALL', ...PRODUCT_CATEGORIES] as const).map((c) => (
          <TouchableOpacity key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}>
            <Text style={[styles.chipText, category === c && { color: '#fff' }]}>{c === 'ALL' ? 'All categories' : capitalize(c)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {showForm && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>New product</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Product name" placeholderTextColor={Colors.muted} style={styles.input} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput value={price} onChangeText={setPrice} placeholder="Price of smallest size (₱)" keyboardType="numeric" placeholderTextColor={Colors.muted} style={[styles.input, { flex: 1 }]} />
            <TextInput value={pieces} onChangeText={setPieces} placeholder="Pieces per size" keyboardType="numeric" placeholderTextColor={Colors.muted} style={[styles.input, { flex: 1 }]} />
          </View>
          <View style={[styles.chipRow, { marginTop: 10 }]}>
            {PRODUCT_CATEGORIES.map((c) => (
              <TouchableOpacity key={c} style={[styles.chip, newCategory === c && styles.chipActive]} onPress={() => setNewCategory(c)}>
                <Text style={[styles.chipText, newCategory === c && { color: '#fff' }]}>{capitalize(c)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.note}>Sizes for {capitalize(newCategory)}: {SIZE_OPTIONS[newCategory].join(', ')}</Text>
          <TouchableOpacity style={styles.saveBtn} onPress={addProduct}>
            <Text style={styles.saveText}>Save product</Text>
          </TouchableOpacity>
        </View>
      )}

      {visible.length === 0 ? (
        <Text style={styles.empty}>No products found.</Text>
      ) : (
        visible.map((item) => (
          <View key={item.id} style={[styles.card, !item.active && { opacity: 0.55 }]}>
            <View style={styles.cardHead}>
              <View style={styles.thumb}><Text style={{ fontSize: 22 }}>{EMOJI[item.category]}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{item.name}{item.isNew ? '  NEW' : ''}</Text>
                <Text style={styles.sub}>{item.sku} · {capitalize(item.category)} · from {peso(priceFor(item, sizesOf(item)[0]))}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                <Text style={styles.total}>{stockTotal(item)}</Text>
                <Text style={styles.sub}>pieces</Text>
              </View>
              <Switch value={item.active} onValueChange={() => toggleActive(item)} trackColor={{ false: Colors.disabled, true: Colors.success }} thumbColor="#FFFFFF" />
              <TouchableOpacity style={{ marginLeft: 10 }} onPress={() => remove(item)}>
                <Text style={{ fontSize: 16 }}>🗑️</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sizes}>
              {sizesOf(item).map((size) => {
                const n = item.stock[size];
                const color = n === 0 ? Colors.danger : n < MIN_PIECES ? Colors.warning : Colors.text;
                return (
                  <View key={size} style={styles.sizeBox}>
                    <Text style={styles.sizeName}>{size}</Text>
                    <View style={styles.sizeRow}>
                      <TouchableOpacity style={styles.stepBtn} onPress={() => adjust(item, size, -1)}><Text style={styles.stepText}>−</Text></TouchableOpacity>
                      <Text style={[styles.sizeCount, { color }]}>{n}</Text>
                      <TouchableOpacity style={styles.stepBtn} onPress={() => adjust(item, size, 1)}><Text style={styles.stepText}>+</Text></TouchableOpacity>
                    </View>
                    {n < MIN_PIECES && <Text style={styles.restock}>restock</Text>}
                  </View>
                );
              })}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  statCard: { flexGrow: 1, flexBasis: 140, backgroundColor: Colors.background, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  statValue: { color: Colors.primary, fontSize: 24, fontWeight: 'bold' },
  statLabel: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  toolbar: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'center' },
  search: { flex: 1, maxWidth: 360, backgroundColor: '#fff', height: 40, borderRadius: 20, paddingHorizontal: 16, borderWidth: 1, borderColor: Colors.border, fontSize: 13, color: Colors.text },
  addBtn: { height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, marginRight: 8, marginBottom: 6, backgroundColor: '#fff' },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.muted, fontSize: 12, fontWeight: '600' },
  form: { backgroundColor: Colors.background, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  formTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 12, color: Colors.text, marginTop: 10, backgroundColor: '#fff' },
  note: { color: Colors.muted, fontSize: 11, marginTop: 4 },
  saveBtn: { backgroundColor: Colors.primary, padding: 13, borderRadius: 8, alignItems: 'center', marginTop: 14 },
  saveText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  empty: { color: Colors.muted, textAlign: 'center', padding: 30 },
  card: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 14, marginBottom: 12, backgroundColor: '#fff' },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.light, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  name: { fontSize: 14, fontWeight: 'bold', color: Colors.text },
  sub: { fontSize: 11, color: Colors.muted, marginTop: 1 },
  total: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  sizes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  sizeBox: { backgroundColor: Colors.background, borderRadius: 10, padding: 8, minWidth: 104, alignItems: 'center' },
  sizeName: { fontSize: 11, fontWeight: 'bold', color: Colors.text, marginBottom: 6 },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.light, justifyContent: 'center', alignItems: 'center' },
  stepText: { color: Colors.primary, fontWeight: 'bold', fontSize: 14, lineHeight: 16 },
  sizeCount: { fontSize: 15, fontWeight: 'bold', minWidth: 22, textAlign: 'center' },
  restock: { fontSize: 9, color: Colors.warning, fontWeight: 'bold', marginTop: 4 },
});