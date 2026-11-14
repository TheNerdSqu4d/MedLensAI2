import React, { useState } from 'react';
import { View, TextInput, Text, Pressable, TextInputProps } from 'react-native';
import { X } from 'lucide-react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
  containerClassName?: string;
}

export function Input({
  label,
  error,
  icon,
  clearable = true,
  onClear,
  containerClassName = '',
  value,
  onChangeText,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    if (onChangeText) onChangeText('');
    if (onClear) onClear();
  };

  return (
    <View className={`w-full ${containerClassName}`}>
      {label && (
        <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5 px-1">
          {label}
        </Text>
      )}

      <View
        className={`flex-row items-center rounded-2xl border bg-white px-3.5 py-2.5 shadow-sm transition-all ${
          error
            ? 'border-red-500 bg-red-50/20'
            : isFocused
            ? 'border-blue-600 ring-2 ring-blue-500/10'
            : 'border-slate-200/80'
        }`}
      >
        {icon && <View className="mr-2.5 text-zinc-400">{icon}</View>}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholderTextColor="#94A3B8"
          textAlignVertical="center"
          className="flex-1 text-base text-zinc-900 py-1"
          {...props}
        />

        {clearable && Boolean(value) && (
          <Pressable
            onPress={handleClear}
            hitSlop={8}
            className="size-5 items-center justify-center rounded-full bg-slate-200 ml-1.5 active:opacity-70"
          >
            <X size={12} color="#64748B" />
          </Pressable>
        )}
      </View>

      {error && (
        <Text className="text-xs font-medium text-red-500 mt-1 px-1">
          {error}
        </Text>
      )}
    </View>
  );
}
