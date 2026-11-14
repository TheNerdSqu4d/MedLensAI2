import React from 'react';
import { View, Text, ViewProps } from 'react-native';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'purple' | 'danger';

interface BadgeProps extends ViewProps {
  label: string;
  variant?: BadgeVariant;
  icon?: React.ReactNode;
  className?: string;
}

export function Badge({
  label,
  variant = 'default',
  icon,
  className = '',
  ...props
}: BadgeProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-blue-50 border-blue-200/60 text-blue-600';
      case 'success':
        return 'bg-emerald-50 border-emerald-200/60 text-emerald-600';
      case 'warning':
        return 'bg-amber-50 border-amber-200/60 text-amber-700';
      case 'purple':
        return 'bg-purple-50 border-purple-200/60 text-purple-600';
      case 'danger':
        return 'bg-red-50 border-red-200/60 text-red-600';
      case 'default':
      default:
        return 'bg-slate-100 border-slate-200/60 text-slate-600';
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'primary':
        return 'text-blue-600';
      case 'success':
        return 'text-emerald-700';
      case 'warning':
        return 'text-amber-800';
      case 'purple':
        return 'text-purple-700';
      case 'danger':
        return 'text-red-600';
      case 'default':
      default:
        return 'text-slate-600';
    }
  };

  return (
    <View
      className={`flex-row items-center gap-1.5 self-start rounded-full border px-2.5 py-1 ${getVariantStyles()} ${className}`}
      {...props}
    >
      {icon}
      <Text className={`text-xs font-semibold ${getTextColor()}`}>{label}</Text>
    </View>
  );
}
