import React from 'react';
import { Tabs } from 'expo-router';
import { CalendarClock, ScanLine, Pill } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = insets.bottom > 0 ? insets.bottom : 8;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#F1F5F9',
          borderTopWidth: 1,
          height: 54 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0.05,
          shadowRadius: 8,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -2 },
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hôm Nay',
          tabBarLabel: 'Hôm Nay',
          tabBarIcon: ({ color }) => (
            <CalendarClock size={22} color={color} strokeWidth={2.2} />
          ),
        }}
        listeners={{
          tabPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Quét Toa',
          tabBarLabel: 'Quét Toa',
          tabBarIcon: ({ color }) => (
            <ScanLine size={22} color={color} strokeWidth={2.2} />
          ),
        }}
        listeners={{
          tabPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        }}
      />
      <Tabs.Screen
        name="cabinet"
        options={{
          title: 'Tủ Thuốc',
          tabBarLabel: 'Tủ Thuốc',
          tabBarIcon: ({ color }) => (
            <Pill size={22} color={color} strokeWidth={2.2} />
          ),
        }}
        listeners={{
          tabPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        }}
      />
    </Tabs>
  );
}
