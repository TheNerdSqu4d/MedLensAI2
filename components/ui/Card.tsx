import React from 'react';
import { View, Pressable, ViewProps } from 'react-native';
import * as Haptics from 'expo-haptics';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
  onPress?: () => void;
  haptic?: boolean;
}

export function Card({
  children,
  className = '',
  onPress,
  haptic = true,
  ...props
}: CardProps) {
  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        className={`overflow-hidden rounded-3xl border border-slate-200/60 bg-white p-4 shadow-sm transition-transform active:scale-[0.99] active:opacity-90 ${className}`}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View
      className={`overflow-hidden rounded-3xl border border-slate-200/60 bg-white p-4 shadow-sm ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}
