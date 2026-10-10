import React, { useState } from 'react';
import { ImageBackground, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { ShopCategory } from './types';

type CategoryModalProps = {
  visible: boolean;
  categories: ShopCategory[];
  onClose: () => void;
  onAddToCart: (category: ShopCategory, size: string, color: string) => void;
};

export function CategoryModal({ visible, categories, onClose, onAddToCart }: CategoryModalProps) {
  const [selected, setSelected] = useState<ShopCategory | null>(null);
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');

  const selectCategory = (category: ShopCategory) => {
    setSelected(category);
    setSize(category.sizes[0]);
    setColor(category.colors[0]);
  };

  const close = () => {
    setSelected(null);
    onClose();
  };

  const addToCart = () => {
    if (!selected) return;
    onAddToCart(selected, size, color);
    setSelected(null);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{selected ? selected.name : 'Shop by Category'}</Text>
            <TouchableOpacity onPress={close} accessibilityLabel="Close categories"><Text style={styles.close}>×</Text></TouchableOpacity>
          </View>

          {selected ? (
            <>
              <Text style={styles.price}>PHP {selected.price.toFixed(2)}</Text>
              <Text style={styles.label}>SELECT SIZE</Text>
              <View style={styles.chips}>{selected.sizes.map((item) => <TouchableOpacity key={item} style={[styles.chip, size === item && styles.activeChip]} onPress={() => setSize(item)}><Text style={[styles.chipText, size === item && styles.activeChipText]}>{item}</Text></TouchableOpacity>)}</View>
              <Text style={styles.label}>SELECT COLOR</Text>
              <View style={styles.chips}>{selected.colors.map((item) => <TouchableOpacity key={item} style={[styles.chip, color === item && styles.activeChip]} onPress={() => setColor(item)}><Text style={[styles.chipText, color === item && styles.activeChipText]}>{item}</Text></TouchableOpacity>)}</View>
              <TouchableOpacity style={styles.addButton} onPress={addToCart}><Text style={styles.addButtonText}>ADD TO CART</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setSelected(null)}><Text style={styles.backText}>BACK TO CATEGORIES</Text></TouchableOpacity>
            </>
          ) : (
            <View style={styles.grid}>
              {categories.map((category) => (
                <TouchableOpacity key={category.name} style={styles.card} onPress={() => selectCategory(category)}>
                  <ImageBackground source={category.img} style={styles.cardImage} imageStyle={styles.cardImageBorder}><View style={styles.cardOverlay}><Text style={styles.cardName}>{category.name}</Text><Text style={styles.cardPrice}>From PHP {category.price.toFixed(2)}</Text></View></ImageBackground>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }, sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: '55%' }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }, title: { fontSize: 22, fontWeight: 'bold', color: '#5d3a1a' }, close: { fontSize: 30, color: '#5d3a1a', lineHeight: 30 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }, card: { width: '48%', height: 140, marginBottom: 14 }, cardImage: { flex: 1 }, cardImageBorder: { borderRadius: 10 }, cardOverlay: { flex: 1, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', padding: 12 }, cardName: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 }, cardPrice: { color: '#FFFFFF', fontSize: 11, marginTop: 4 },
  price: { color: '#8b5e34', fontWeight: 'bold', fontSize: 18 }, label: { color: '#777', fontSize: 11, fontWeight: 'bold', marginTop: 22, marginBottom: 8 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { borderWidth: 1, borderColor: '#DDD', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 }, activeChip: { backgroundColor: '#8b5e34', borderColor: '#8b5e34' }, chipText: { fontSize: 12 }, activeChipText: { color: '#FFFFFF' }, addButton: { backgroundColor: '#5d3a1a', borderRadius: 8, alignItems: 'center', padding: 16, marginTop: 28 }, addButtonText: { color: '#FFFFFF', fontWeight: 'bold' }, backText: { color: '#777', textAlign: 'center', marginTop: 16, fontWeight: 'bold', fontSize: 12 },
});
