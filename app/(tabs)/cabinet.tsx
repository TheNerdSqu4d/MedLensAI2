import React, { useState, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Pressable, Animated, PanResponder, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import {
  Pill,
  Calendar,
  AlertTriangle,
  ChevronRight,
  PackageOpen,
  User,
  ShieldAlert,
  Layers,
  Heart,
  Activity,
  Droplets,
  ShieldCheck,
  Sparkles,
  Package,
  Trash2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Card, Badge, BadgeVariant } from '@/components/ui';
import { useMedStore } from '@/store/useMedStore';
import { Medicine } from '@/types/medlens';
import {
  CABINET_CATEGORIES,
  CabinetCategory,
  filterCabinetByCategory,
  checkExpiryStatus,
  getStockStatus,
} from '@/services/clinical';
import { MedicineDetailModal } from '@/components/features/MedicineDetailModal';

export function formatCabinetBadgeText(cabinetList: Medicine[]): string {
  if (!Array.isArray(cabinetList)) return '0 loại thuốc';
  return `${cabinetList.length} loại thuốc`;
}

// Icon helper for pill category filters
function getCategoryIcon(category: CabinetCategory, color: string) {
  switch (category) {
    case 'Tất cả':
      return <Layers size={14} color={color} />;
    case 'Huyết áp':
      return <Heart size={14} color={color} />;
    case 'Dạ dày':
      return <Activity size={14} color={color} />;
    case 'Tiểu đường':
      return <Droplets size={14} color={color} />;
    case 'Kháng sinh':
      return <ShieldCheck size={14} color={color} />;
    case 'Giảm đau':
      return <Sparkles size={14} color={color} />;
    default:
      return <Pill size={14} color={color} />;
  }
}

interface SwipeableMedicineCardProps {
  med: Medicine;
  onPress: () => void;
  onDelete: (med: Medicine) => void;
  getCategoryLabel: (category: string) => string;
  getCategoryBadgeVariant: (category: string) => BadgeVariant;
}

function SwipeableMedicineCard({
  med,
  onPress,
  onDelete,
  getCategoryLabel,
  getCategoryBadgeVariant,
}: SwipeableMedicineCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isDragging = useRef(false);
  const isOpen = useRef(false);
  const hasTriggeredDetentHaptic = useRef(false);

  const expiry = checkExpiryStatus(med.expiryDate);
  const stock = getStockStatus(med.remainingCount);

  let containerModifier = 'border-slate-200/60 opacity-100';
  if (expiry.isExpired) {
    containerModifier = 'border-red-300 opacity-80 bg-red-50/20';
  } else if (expiry.isExpiringSoon) {
    containerModifier = 'border-amber-300 opacity-95 bg-amber-50/10';
  }

  const promptConfirmDelete = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {}

    Alert.alert(
      'Xác Nhận Xóa Thuốc',
      `Bạn có chắc chắn muốn xóa thuốc "${med.name}" khỏi Tủ Thuốc Gia Đình không?\n\nThao tác này không thể hoàn tác.`,
      [
        {
          text: 'Hủy',
          style: 'cancel',
          onPress: () => {
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 4,
              speed: 14,
            }).start(() => {
              isOpen.current = false;
            });
          },
        },
        {
          text: 'Xóa thuốc',
          style: 'destructive',
          onPress: () => {
            Animated.timing(translateX, {
              toValue: -500,
              duration: 220,
              useNativeDriver: true,
            }).start(() => {
              onDelete(med);
            });
          },
        },
      ]
    );
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Chỉ nhận diện khi vuốt ngang rõ rệt (dx > 12px và dx gấp 1.8 lần dy) để không xung đột cuộn dọc của ScrollView
        return Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.8;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        isDragging.current = true;
        hasTriggeredDetentHaptic.current = false;
      },
      onPanResponderMove: (_, gestureState) => {
        const offset = isOpen.current ? -85 : 0;
        const rawX = offset + gestureState.dx;
        // Kéo sang phải: dùng cản đàn hồi (elastic friction)
        const targetX = rawX > 0 ? rawX * 0.15 : Math.max(-190, rawX);
        translateX.setValue(targetX);

        // Haptic feedback nhẹ khi vừa kéo đến mốc hé lộ nút xóa (-75px)
        if (targetX <= -75 && !hasTriggeredDetentHaptic.current) {
          hasTriggeredDetentHaptic.current = true;
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch {}
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        setTimeout(() => {
          isDragging.current = false;
        }, 80);

        // 1. Full swipe dứt khoát sang trái (kéo dài > 160px hoặc vuốt nhanh vx < -0.7)
        if (gestureState.dx < -160 || (gestureState.dx < -80 && gestureState.vx < -0.7)) {
          promptConfirmDelete();
          return;
        }

        // 2. Vuốt hé lộ nút xóa (kéo qua -35px hoặc nếu đang mở mà không vuốt đóng)
        if (
          (!isOpen.current && gestureState.dx < -35) ||
          (isOpen.current && gestureState.dx < 30)
        ) {
          Animated.spring(translateX, {
            toValue: -85,
            useNativeDriver: true,
            bounciness: 4,
            speed: 14,
          }).start(() => {
            isOpen.current = true;
          });
        } else {
          // 3. Đóng thẻ về 0
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
            speed: 14,
          }).start(() => {
            isOpen.current = false;
          });
        }
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
        Animated.spring(translateX, {
          toValue: isOpen.current ? -85 : 0,
          useNativeDriver: true,
          bounciness: 4,
        }).start();
      },
    })
  ).current;

  return (
    <View className="mb-3 overflow-hidden rounded-3xl relative bg-transparent">
      {/* Background Revealed Action: Red Delete Zone (85px wide) */}
      <View className="absolute inset-y-0 right-0 w-[85px] bg-red-600 rounded-r-3xl flex-row items-center justify-center overflow-hidden">
        <Pressable
          onPress={promptConfirmDelete}
          className="w-full h-full items-center justify-center active:bg-red-700"
        >
          <Trash2 size={20} color="#FFFFFF" strokeWidth={2.2} />
          <Text className="text-3xs font-bold text-white mt-1">Xóa</Text>
        </Pressable>
      </View>

      {/* Foreground Interactive Card with PanResponder */}
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        <Pressable
          onPress={() => {
            if (isOpen.current) {
              Animated.spring(translateX, {
                toValue: 0,
                useNativeDriver: true,
                bounciness: 4,
              }).start(() => {
                isOpen.current = false;
              });
            } else if (!isDragging.current) {
              onPress();
            }
          }}
          className={`overflow-hidden rounded-3xl border bg-white p-3.5 shadow-sm active:bg-slate-50 ${containerModifier}`}
        >
          <View className="flex-row items-center gap-3">
            {/* Left: Rectangular Thumbnail Icon matching sketch */}
            <View
              className={`size-14 rounded-2xl items-center justify-center border ${
                expiry.isExpired
                  ? 'bg-red-50 border-red-200'
                  : 'bg-blue-50/70 border-blue-100'
              }`}
            >
              {expiry.isExpired ? (
                <ShieldAlert size={22} color="#DC2626" />
              ) : (
                <Package size={22} color="#2563EB" />
              )}
            </View>

            {/* Right Details */}
            <View className="flex-1 pr-1">
              <View className="flex-row items-center justify-between mb-0.5">
                <Text
                  className="text-base font-bold text-zinc-900 flex-1 mr-1"
                  numberOfLines={1}
                >
                  {med.name}
                </Text>
                <Badge
                  label={getCategoryLabel(med.category)}
                  variant={getCategoryBadgeVariant(med.category)}
                />
              </View>

              <Text
                className="text-xs text-zinc-400 font-medium mb-1.5"
                numberOfLines={1}
              >
                Hoạt chất: {med.activeIngredient}
              </Text>

              {/* Stock & Expiry Row */}
              <View className="flex-row items-center gap-2">
                <Badge
                  label={
                    stock.isOut
                      ? 'Hết thuốc'
                      : `Còn ${med.remainingCount} viên`
                  }
                  variant={
                    stock.isOut
                      ? 'danger'
                      : stock.variant === 'warning'
                      ? 'warning'
                      : 'default'
                  }
                />
                <Badge
                  label={
                    expiry.isExpired
                      ? `HSD: ${med.expiryDate || 'Chưa rõ'} • Đã hết hạn`
                      : expiry.isExpiringSoon
                      ? `HSD: ${med.expiryDate} • Sắp hết hạn`
                      : med.expiryDate
                      ? `HSD: ${med.expiryDate}`
                      : 'Chưa rõ HSD'
                  }
                  variant={
                    expiry.isExpired
                      ? 'danger'
                      : expiry.isExpiringSoon
                      ? 'warning'
                      : 'default'
                  }
                  icon={
                    expiry.isExpired ? (
                      <AlertTriangle size={11} color="#DC2626" />
                    ) : (
                      <Calendar size={11} color="#64748B" />
                    )
                  }
                />
              </View>
            </View>

            <ChevronRight size={16} color="#94A3B8" />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default function MedicineCabinetScreen() {
  const router = useRouter();
  const cabinet = useMedStore((state) => state.cabinet);
  const setSelectedMedicine = useMedStore((state) => state.setSelectedMedicine);
  const removeMedicineFromCabinet = useMedStore((state) => state.removeMedicineFromCabinet);

  const [selectedCategory, setSelectedCategory] = useState<CabinetCategory>('Tất cả');

  const filteredMedicines = useMemo(() => {
    return filterCabinetByCategory(cabinet, selectedCategory);
  }, [cabinet, selectedCategory]);

  const handleSelectCategory = (cat: CabinetCategory) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedCategory(cat);
  };

  const handleSelectMedicine = (med: Medicine) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedMedicine(med);
  };

  const handleDeleteMedicine = (med: Medicine) => {
    removeMedicineFromCabinet(med.id);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  const handleOpenSettings = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    router.push('/settings');
  };

  const getCategoryBadgeVariant = (category: string): BadgeVariant => {
    const cat = category.toLowerCase();
    if (cat.includes('pressure') || cat.includes('huyết áp')) return 'primary';
    if (cat.includes('stomach') || cat.includes('dạ dày')) return 'warning';
    if (cat.includes('diabetes') || cat.includes('tiểu đường')) return 'purple';
    if (cat.includes('antibiotics') || cat.includes('kháng sinh')) return 'danger';
    if (cat.includes('pain') || cat.includes('giảm đau')) return 'success';
    return 'default';
  };

  const getCategoryLabel = (category: string): string => {
    const map: Record<string, string> = {
      'Blood Pressure': 'Huyết áp',
      'Stomach': 'Dạ dày',
      'Diabetes': 'Tiểu đường',
      'Antibiotics': 'Kháng sinh',
      'Pain Relief': 'Giảm đau',
      'Other': 'Khác',
    };
    return map[category] || category;
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F2F2F7]">
      <StatusBar style="dark" />

      {/* Screen Header */}
      <View className="px-4 pt-2 pb-3 flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-3xl font-bold tracking-tight text-zinc-900">
            Tủ Thuốc
          </Text>
          <Text className="text-xs font-medium text-zinc-500 mt-0.5">
            {formatCabinetBadgeText(cabinet)} trong tủ gia đình
          </Text>
        </View>

        <Pressable
          onPress={handleOpenSettings}
          hitSlop={8}
          accessibilityLabel="Cài đặt và Hồ sơ gia đình"
          accessibilityRole="button"
          className="size-12 items-center justify-center rounded-full bg-white border border-slate-200/90 shadow-sm active:scale-95"
        >
          <User size={22} color="#2563EB" strokeWidth={2.2} />
        </Pressable>
      </View>

      {/* Pill Filter Category Row */}
      <View className="py-2.5">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          className="flex-row gap-2"
        >
          {CABINET_CATEGORIES.map((category) => {
            const isSelected = selectedCategory === category;
            const iconColor = isSelected ? '#FFFFFF' : '#475569';
            return (
              <Pressable
                key={category}
                onPress={() => handleSelectCategory(category)}
                className={`flex-row items-center gap-1.5 px-3.5 py-2 rounded-full border transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-zinc-900 border-zinc-900 shadow-2xs'
                    : 'bg-white border-slate-200/80 shadow-2xs'
                }`}
              >
                {getCategoryIcon(category, iconColor)}
                <Text
                  className={`text-xs ${
                    isSelected ? 'font-bold text-white' : 'font-medium text-slate-700'
                  }`}
                >
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Medicine Cards List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1 mt-2"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      >
        {filteredMedicines.length === 0 ? (
          <Card className="items-center justify-center py-12 px-6 mt-4 bg-white">
            <View className="size-14 items-center justify-center rounded-2xl bg-slate-100 mb-3">
              <PackageOpen size={28} color="#94A3B8" />
            </View>
            <Text className="text-base font-bold text-zinc-800 text-center">
              {cabinet.length === 0 ? 'Tủ thuốc đang trống' : 'Không có thuốc trong nhóm này'}
            </Text>
            <Text className="text-xs text-zinc-500 text-center mt-1">
              {cabinet.length === 0
                ? 'Hãy quét toa thuốc hoặc nạp đơn mẫu từ Tab Quét Toa để thêm thuốc vào tủ.'
                : 'Thử chọn nhóm bệnh khác hoặc chọn "Tất cả" để xem danh sách.'}
            </Text>
          </Card>
        ) : (
          <View>
            <View className="flex-row items-center justify-between px-1 mb-2">
              <Text className="text-3xs text-slate-400 font-medium">
                💡 Vuốt sang trái để xóa thuốc khỏi tủ
              </Text>
            </View>
            {filteredMedicines.map((med) => (
              <SwipeableMedicineCard
                key={med.id}
                med={med}
                onPress={() => handleSelectMedicine(med)}
                onDelete={handleDeleteMedicine}
                getCategoryLabel={getCategoryLabel}
                getCategoryBadgeVariant={getCategoryBadgeVariant}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Medicine Detail Modal */}
      <MedicineDetailModal />
    </SafeAreaView>
  );
}

