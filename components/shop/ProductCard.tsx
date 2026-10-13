import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { InventoryItem, priceFor, ProductCategory, sizesOf } from './inventoryStore';
import { peso } from './shopStore';

const Colors = { primary: '#5d3a1a', secondary: '#8b5e34', background: '#F8F5F2', success: '#2E9E6B', warning: '#E8A13A', danger: '#d9534f', muted: '#8E8E93' };

// NOTE: if your Comforters and Blankets photos look swapped, swap these two lines.
const IMAGES: Record<ProductCategory, any> = {
  BEDSHEETS: require('../../assets/bedsheets3.jpg'),
  PILLOWCASES: require('../../assets/pillowcases.jpg'),
  COMFORTERS: require('../../assets/comforters.jpg'),
  BLANKETS: require('../../assets/blankets1.jpg'),
};
const EMOJI: Record<ProductCategory, string> = { BEDSHEETS: '🛏️', PILLOWCASES: '☁️', COMFORTERS: '🧥', BLANKETS: '🧣' };
const capitalize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

interface Props {
  item: InventoryItem;
  cartQty: (productId: string, size: string) => number;
  onAdd: (item: InventoryItem, size: string, texture: string, style: string, qty: number) => boolean;
}

export default function ProductCard({ item, cartQty, onAdd }: Props) {
  const sizes = sizesOf(item);
  const [size, setSize] = useState(sizes.find((s) => item.stock[s] > 0) || sizes[0]);
  const [texture, setTexture] = useState(item.textures[0]);
  const [style, setStyle] = useState(item.styles[0]);
  const [qty, setQty] = useState(1);

  const inStock = item.stock[size] || 0;
  const remaining = inStock - cartQty(item.id, size);
  const badgeText = inStock === 0 ? 'Sold out' : inStock <= 3 ? `Only ${inStock} left` : `${inStock} in stock`;
  const badgeColor = inStock === 0 ? Colors.danger : inStock <= 3 ? Colors.warning : Colors.success;

  const chips = (options: string[], value: string, pick: (v: string) => void, isOff?: (v: string) => boolean) => (
    <View style={styles.chipRow}>
      {options.map((o) => (
        <TouchableOpacity
          key={o}
          disabled={isOff ? isOff(o) : false}
          style={[styles.chip, value === o && styles.chipActive, isOff && isOff(o) && styles.chipOff]}
          onPress={() => pick(o)}
        >
          <Text style={[styles.chipText, value === o && styles.chipTextActive]}>{o}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={styles.card}>
      <View>
        <Image source={IMAGES[item.category]} style={[styles.image, inStock === 0 && { opacity: 0.45 }]} resizeMode="cover" />
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{badgeText}</Text>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{EMOJI[item.category]} {capitalize(item.category)}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.price}>{peso(priceFor(item, size))}</Text>

        <Text style={styles.label}>Size</Text>
        {chips(sizes, size, (v) => { setSize(v); setQty(1); }, (v) => item.stock[v] === 0)}
        <Text style={styles.label}>Texture</Text>
        {chips(item.textures, texture, setTexture)}
        <Text style={styles.label}>Style</Text>
        {chips(item.styles, style, setStyle)}

        {cartQty(item.id, size) > 0 && <Text style={styles.inCart}>{cartQty(item.id, size)} in your cart ({size})</Text>}

        <View style={styles.buyRow}>
          <View style={styles.qtyBox}>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty((q) => Math.max(1, q - 1))}>
              <Text style={styles.qtyBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.qtyText}>{qty}</Text>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty((q) => Math.min(Math.max(1, remaining), q + 1))}>
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          {remaining <= 0 ? (
            <View style={[styles.addBtn, styles.addBtnOff]}>
              <Text style={styles.addBtnText}>{inStock === 0 ? 'Sold out' : 'All in cart'}</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.addBtn} onPress={() => { if (onAdd(item, size, texture, style, qty)) setQty(1); }}>
              <Text style={styles.addBtnText}>Add to cart</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexGrow: 1, flexBasis: 260, maxWidth: 360, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#EADFD5' },
  image: { width: '100%', height: 160 },
  badge: { position: 'absolute', top: 10, right: 10, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  tag: { position: 'absolute', bottom: 10, left: 10, backgroundColor: 'rgba(255,255,255,0.92)', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  tagText: { color: Colors.primary, fontSize: 11, fontWeight: 'bold' },
  body: { padding: 16 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  price: { fontSize: 18, fontWeight: 'bold', color: Colors.secondary, marginTop: 4 },
  label: { fontSize: 11, fontWeight: 'bold', color: '#888', marginTop: 12, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: '#ddd', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, marginRight: 6, marginBottom: 6 },
  chipActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  chipOff: { opacity: 0.35 },
  chipText: { fontSize: 11, color: '#444' },
  chipTextActive: { color: '#fff', fontWeight: 'bold' },
  inCart: { color: Colors.success, fontSize: 11, fontWeight: '600', marginTop: 4 },
  buyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 10, padding: 3 },
  qtyBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 16, fontWeight: 'bold', color: Colors.primary, lineHeight: 18 },
  qtyText: { minWidth: 28, textAlign: 'center', fontSize: 14, fontWeight: 'bold', color: '#000' },
  addBtn: { flex: 1, backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  addBtnOff: { backgroundColor: '#C9C9CE' },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
});