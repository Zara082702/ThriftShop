import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#5d3a1a' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Shop',
          headerShown: false,
          tabBarIcon: ({ color }) => <Text style={{ color }}>🛍️</Text>,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin POS',
          // The POS is reached only after a successful admin sign-in.
          href: null,
          headerShown: false, // Hides the native header so our custom POS layout takes over the screen
          tabBarIcon: ({ color }) => <Text style={{ color }}>📊</Text>,
        }}
      />
    </Tabs>
  );
}
