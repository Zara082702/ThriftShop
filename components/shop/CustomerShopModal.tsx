import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import type { CartItem, ShopCategory } from './types';

type Props = { visible: boolean; categories: ShopCategory[]; cartItems: CartItem[]; onClose: () => void; onAddToCart: (category: ShopCategory, size: string, color: string) => void; onUpdateQuantity: (id: string, change: number) => void; onCheckout: () => void };

export function CustomerShopModal({ visible, categories, cartItems, onClose, onAddToCart, onUpdateQuantity, onCheckout }: Props) {
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [query, setQuery] = useState('');
  const products = useMemo(() => categories.filter((item) => (activeCategory === 'ALL' || item.name === activeCategory) && item.name.toLowerCase().includes(query.toLowerCase())), [activeCategory, categories, query]);
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const quantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <View style={styles.page}>
      <View style={styles.topbar}><Text style={styles.brand}>BakerThrift Shop</Text><TouchableOpacity onPress={onClose}><Text style={styles.close}>×</Text></TouchableOpacity></View>
      <View style={styles.layout}>
        <View style={styles.catalog}>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search bedsheets, pillows, blankets..." style={styles.search} />
          <Text style={styles.heading}>Choose Menu</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{['ALL', ...categories.map((item) => item.name)].map((item) => <TouchableOpacity key={item} style={[styles.filter, activeCategory === item && styles.filterActive]} onPress={() => setActiveCategory(item)}><Text style={[styles.filterText, activeCategory === item && styles.filterTextActive]}>{item === 'ALL' ? 'All Menu' : item}</Text></TouchableOpacity>)}</ScrollView>
          <ScrollView contentContainerStyle={styles.grid}>{products.map((product) => <View key={product.name} style={styles.card}><View style={styles.imagePlaceholder}><Text style={styles.productIcon}>☁</Text></View><Text style={styles.productName}>{product.name}</Text><Text style={styles.available}>Available in {product.colors.length} colors</Text><Text style={styles.price}>PHP {product.price.toFixed(2)}</Text><TouchableOpacity style={styles.addButton} onPress={() => onAddToCart(product, product.sizes[0], product.colors[0])}><Text style={styles.addText}>Add to Order</Text></TouchableOpacity></View>)}</ScrollView>
        </View>
        <View style={styles.order}><Text style={styles.orderTitle}>Order Details</Text><ScrollView style={styles.orderItems}>{cartItems.length === 0 ? <Text style={styles.empty}>No items in your order</Text> : cartItems.map((item) => <View key={item.id} style={styles.orderItem}><View><Text style={styles.orderName}>{item.name}</Text><Text style={styles.available}>{item.size} · {item.color}</Text></View><View style={styles.controls}><TouchableOpacity onPress={() => onUpdateQuantity(item.id, -1)}><Text style={styles.control}>−</Text></TouchableOpacity><Text>{item.quantity}</Text><TouchableOpacity onPress={() => onUpdateQuantity(item.id, 1)}><Text style={styles.control}>+</Text></TouchableOpacity></View></View>)}</ScrollView><View style={styles.summary}><Text>Amount Order: {quantity}</Text><Text style={styles.total}>PHP {total.toFixed(2)}</Text><TouchableOpacity style={styles.checkout} onPress={onCheckout}><Text style={styles.checkoutText}>PROCESS ORDER</Text></TouchableOpacity></View></View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({ page:{flex:1,backgroundColor:'#F9F6F3'},topbar:{height:70,backgroundColor:'#FFF',flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:24,borderBottomWidth:1,borderColor:'#EEE'},brand:{fontSize:20,fontWeight:'bold',color:'#E2875E'},close:{fontSize:32,color:'#555'},layout:{flex:1,flexDirection:'row'},catalog:{flex:1,padding:20},search:{backgroundColor:'#FFF',borderRadius:22,paddingHorizontal:16,height:42,maxWidth:360},heading:{fontSize:24,fontWeight:'bold',marginVertical:16},filters:{gap:10,paddingBottom:18},filter:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#EEE',padding:12,borderRadius:10},filterActive:{backgroundColor:'#E2875E'},filterText:{fontSize:12,color:'#666'},filterTextActive:{color:'#FFF',fontWeight:'bold'},grid:{flexDirection:'row',flexWrap:'wrap',gap:14},card:{backgroundColor:'#FFF',width:'47%',padding:14,borderRadius:14},imagePlaceholder:{height:95,backgroundColor:'#FCEFE9',borderRadius:10,alignItems:'center',justifyContent:'center'},productIcon:{fontSize:30},productName:{fontWeight:'bold',marginTop:10},available:{fontSize:11,color:'#888',marginTop:3},price:{color:'#E2875E',fontWeight:'bold',marginTop:6},addButton:{borderWidth:1,borderColor:'#E2875E',borderRadius:6,padding:9,alignItems:'center',marginTop:12},addText:{color:'#E2875E',fontWeight:'bold',fontSize:12},order:{width:280,backgroundColor:'#FFF',padding:20,borderLeftWidth:1,borderColor:'#EEE'},orderTitle:{fontSize:18,fontWeight:'bold'},orderItems:{flex:1,marginTop:14},empty:{color:'#999',textAlign:'center',marginTop:50},orderItem:{paddingVertical:12,borderBottomWidth:1,borderColor:'#EEE',flexDirection:'row',justifyContent:'space-between'},orderName:{fontSize:12,fontWeight:'bold'},controls:{flexDirection:'row',alignItems:'center',gap:10},control:{fontSize:18,color:'#E2875E',fontWeight:'bold'},summary:{borderTopWidth:1,borderColor:'#EEE',paddingTop:14,gap:12},total:{fontSize:20,fontWeight:'bold',color:'#E2875E'},checkout:{backgroundColor:'#E2875E',padding:14,borderRadius:10,alignItems:'center'},checkoutText:{color:'#FFF',fontWeight:'bold',fontSize:12} });
