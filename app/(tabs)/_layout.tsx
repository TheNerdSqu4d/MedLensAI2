import React from 'react';
import { View, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Calendar, Camera, Archive } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useMedStore } from '@/store/useMedStore';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = insets.bottom > 0 ? insets.bottom : 8;

  const cabinet = useMedStore((state) => state.cabinet) || [];
  // Lượng thuốc ít hơn 20% (vd còn <= 4 viên trên 20 viên) -> thêm dấu chấm đỏ
  const hasLowStock = cabinet.some((m) => (m.remainingCount ?? 20) <= 4);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          borderTopWidth: 1,
          height: 58 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 6,
          elevation: 8,
          shadowOpacity: 0.08,
          shadowRadius: 10,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -3 },
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 2,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hôm nay',
          tabBarLabel: 'Hôm nay',
          tabBarIcon: ({ color }) => (
            <Calendar size={24} color={color} strokeWidth={2.2} />
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
          title: 'Quét',
          tabBarLabel: () => null,
          tabBarIcon: () => (
            <View
              style={{
                position: 'absolute',
                top: -26,
                width: 68,
                height: 68,
                borderRadius: 34,
                backgroundColor: '#2563EB',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 4,
                borderColor: '#FFFFFF',
                shadowColor: '#2563EB',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.4,
                shadowRadius: 10,
                elevation: 10,
              }}
            >
              <Camera size={32} color="#FFFFFF" strokeWidth={2.2} />
            </View>
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
          title: 'Tủ thuốc',
          tabBarLabel: 'Tủ thuốc',
          tabBarIcon: ({ color }) => (
            <View className="relative items-center justify-center">
              <Archive size={24} color={color} strokeWidth={2.2} />
              {hasLowStock && (
                <View className="absolute -top-1 -right-1.5 size-2.5 rounded-full bg-red-500 border-2 border-white" />
              )}
            </View>
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
