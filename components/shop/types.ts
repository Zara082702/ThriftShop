import type { ImageSourcePropType } from 'react-native';

export type CartItem = {
  id: string;
  name: string;
  size: string;
  color: string;
  price: number;
  quantity: number;
};

export type ShopCategory = {
  name: string;
  sizes: string[];
  colors: string[];
  price: number;
  img: ImageSourcePropType;
};
