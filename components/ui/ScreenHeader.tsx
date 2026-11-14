import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/store/useAuthStore';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showAvatar?: boolean;
}

export function ScreenHeader({
  title,
  subtitle,
  showAvatar = true,
}: ScreenHeaderProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const handleAvatarPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/settings');
  };

  return (
    <View className="pt-2 pb-4 flex-row items-center justify-between">
      <View className="flex-1 pr-3">
        <Text className="text-3xl font-bold tracking-tight text-zinc-900">
          {title}
        </Text>
        {subtitle && (
          <Text className="text-sm text-zinc-500 mt-0.5" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      {showAvatar && (
        <Pressable
          onPress={handleAvatarPress}
          hitSlop={8}
          className="size-11 items-center justify-center rounded-2xl bg-white border border-slate-200/80 shadow-sm active:scale-95 active:opacity-85"
        >
          <View className="size-8 items-center justify-center rounded-xl bg-blue-50">
            <User size={18} color="#2563EB" />
          </View>
        </Pressable>
      )}
    </View>
  );
}
