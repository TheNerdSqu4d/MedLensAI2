import React, { useState, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Pressable, Animated, PanResponder, Alert, TextInput } from 'react-native';
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
  Search,
  X,
  Users,
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

  let containerModifier = 'border-slate-200/60 bg-white';
  if (expiry.isExpired) {
    containerModifier = 'border-red-300 bg-red-50/30';
  } else if (expiry.isExpiringSoon) {
    containerModifier = 'border-amber-300 bg-amber-50/20';
  }

  // Xóa trực tiếp ngay khi vuốt hoặc bấm Xóa (Không hiện popup confirm)
  const executeDirectDelete = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    Animated.timing(translateX, {
      toValue: -500,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onDelete(med);
    });
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

        // 1. Full swipe dứt khoát sang trái (kéo dài > 130px hoặc vuốt nhanh vx < -0.6) -> Xóa luôn!
        if (gestureState.dx < -130 || (gestureState.dx < -60 && gestureState.vx < -0.6)) {
          executeDirectDelete();
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

  // Dải đỏ liền mạch chỉ hiện khi bắt đầu vuốt (ở trạng thái 0 ẩn hoàn toàn 100%)
  const deleteZoneOpacity = translateX.interpolate({
    inputRange: [-8, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View className="mb-3 overflow-hidden rounded-3xl relative bg-transparent">
      {/* Background Revealed Action: Dải đỏ toàn phần liền mạch phủ kín theo đà kéo */}
      <Animated.View
        style={{ opacity: deleteZoneOpacity }}
        className="absolute inset-0 bg-red-600 rounded-3xl flex-row justify-end items-center overflow-hidden"
      >
        <Pressable
          onPress={executeDirectDelete}
          className="w-[90px] h-full items-center justify-center active:bg-red-700"
        >
          <Trash2 size={22} color="#FFFFFF" strokeWidth={2.2} />
          <Text className="text-xs font-bold text-white mt-1">Xóa</Text>
        </Pressable>
      </Animated.View>

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
                className="text-xs text-zinc-400 font-medium mb-1"
                numberOfLines={1}
              >
                Hoạt chất: {med.activeIngredient}
              </Text>

              {/* Tác dụng ngắn gọn của thuốc */}
              <Text
                className="text-xs text-zinc-600 font-medium mb-2"
                numberOfLines={1}
              >
                Tác dụng: {med.purpose || 'Hỗ trợ điều trị y khoa'}
              </Text>

              {/* Stock & Expiry dạng Pill */}
              <View className="flex-row items-center gap-2 flex-wrap">
                <View
                  className={`px-3 py-1 rounded-full border ${
                    stock.isOut
                      ? 'bg-red-50 border-red-200'
                      : stock.variant === 'warning'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-slate-100 border-slate-200'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      stock.isOut
                        ? 'text-red-700'
                        : stock.variant === 'warning'
                        ? 'text-amber-800'
                        : 'text-zinc-700'
                    }`}
                  >
                    {stock.isOut ? 'Hết thuốc' : `Còn ${med.remainingCount} viên`}
                  </Text>
                </View>

                <View
                  className={`px-3 py-1 rounded-full border flex-row items-center gap-1 ${
                    expiry.isExpired
                      ? 'bg-red-50 border-red-200'
                      : expiry.isExpiringSoon
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-slate-100 border-slate-200'
                  }`}
                >
                  {expiry.isExpired ? (
                    <AlertTriangle size={11} color="#DC2626" />
                  ) : (
                    <Calendar size={11} color="#64748B" />
                  )}
                  <Text
                    className={`text-xs font-semibold ${
                      expiry.isExpired
                        ? 'text-red-700 font-bold'
                        : expiry.isExpiringSoon
                        ? 'text-amber-800'
                        : 'text-zinc-700'
                    }`}
                  >
                    {expiry.isExpired
                      ? `HSD: ${med.expiryDate || 'N/A'} (Hết hạn)`
                      : expiry.isExpiringSoon
                      ? `HSD: ${med.expiryDate} (Sắp hết)`
                      : med.expiryDate
                      ? `HSD: ${med.expiryDate}`
                      : 'Chưa rõ HSD'}
                  </Text>
                </View>
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
  const familyMembers = useMedStore((state) => state.familyMembers) || [];
  const setSelectedMedicine = useMedStore((state) => state.setSelectedMedicine);
  const removeMedicineFromCabinet = useMedStore((state) => state.removeMedicineFromCabinet);

  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [lastDeletedMed, setLastDeletedMed] = useState<Medicine | null>(null);

  const memberFilters = useMemo(() => [
    { id: 'all', label: 'Tất cả' },
    { id: 'shared', label: 'Tủ dự phòng chung' },
    ...familyMembers.map((m) => ({ id: m.id, label: m.name })),
  ], [familyMembers]);

  const filteredMedicines = useMemo(() => {
    let list = cabinet;
    if (selectedOwnerFilter !== 'all') {
      list = list.filter((m) => {
        if (selectedOwnerFilter === 'shared') {
          return m.ownerId === 'shared' || !m.ownerId;
        }
        return m.ownerId === selectedOwnerFilter;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.activeIngredient && m.activeIngredient.toLowerCase().includes(q)) ||
          (m.purpose && m.purpose.toLowerCase().includes(q))
      );
    }
    return list;
  }, [cabinet, selectedOwnerFilter, searchQuery]);

  const handleSelectOwnerFilter = (filterId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedOwnerFilter(filterId);
  };

  const handleSelectMedicine = (med: Medicine) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedMedicine(med);
  };

  const handleDeleteMedicine = (med: Medicine) => {
    setLastDeletedMed(med);
    removeMedicineFromCabinet(med.id);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    // Tự động tắt thông báo sau 5 giây
    setTimeout(() => {
      setLastDeletedMed((prev) => (prev?.id === med.id ? null : prev));
    }, 5000);
  };

  const handleUndoDelete = () => {
    if (!lastDeletedMed) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    useMedStore.getState().addSingleMedicine(lastDeletedMed, undefined, true, false, lastDeletedMed.ownerId);
    setLastDeletedMed(null);
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
      <View className="px-4 pt-2 pb-2.5 flex-row items-center justify-between">
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

      {/* Search Bar */}
      <View className="px-4 pb-2">
        <View className="flex-row items-center bg-white px-3.5 py-2.5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <Search size={18} color="#94A3B8" />
          <TextInput
            placeholder="Tìm theo tên thuốc hoặc hoạt chất..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94A3B8"
            className="flex-1 ml-2 text-sm text-zinc-900 font-medium py-0"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8} className="p-1">
              <X size={16} color="#94A3B8" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Pill Filter Row: Theo người trong gia đình */}
      <View className="py-2">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          className="flex-row gap-2"
        >
          {memberFilters.map((filter) => {
            const isSelected = selectedOwnerFilter === filter.id;
            return (
              <Pressable
                key={filter.id}
                onPress={() => handleSelectOwnerFilter(filter.id)}
                className={`flex-row items-center gap-1.5 px-3.5 py-2 rounded-full border transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-zinc-900 border-zinc-900 shadow-2xs'
                    : 'bg-white border-slate-200/80 shadow-2xs'
                }`}
              >
                {filter.id === 'all' ? (
                  <Layers size={14} color={isSelected ? '#FFFFFF' : '#475569'} />
                ) : filter.id === 'shared' ? (
                  <Package size={14} color={isSelected ? '#FFFFFF' : '#475569'} />
                ) : (
                  <User size={14} color={isSelected ? '#FFFFFF' : '#475569'} />
                )}
                <Text
                  className={`text-xs ${
                    isSelected ? 'font-bold text-white' : 'font-medium text-slate-700'
                  }`}
                >
                  {filter.label}
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
              {cabinet.length === 0 ? 'Tủ thuốc đang trống' : 'Không tìm thấy thuốc phù hợp'}
            </Text>
            <Text className="text-xs text-zinc-500 text-center mt-1">
              {cabinet.length === 0
                ? 'Hãy quét toa thuốc hoặc nạp đơn mẫu từ Tab Quét Toa để thêm thuốc vào tủ.'
                : 'Thử tìm với từ khóa khác hoặc chọn "Tất cả" thành viên để xem danh sách.'}
            </Text>
          </Card>
        ) : (
          <View>
            <View className="flex-row items-center justify-between px-1 mb-2">
              <Text className="text-3xs text-slate-400 font-medium">
                💡 Vuốt sang trái để xóa thuốc khỏi tủ
              </Text>
              <Text className="text-3xs text-zinc-500 font-semibold">
                Hiển thị {filteredMedicines.length} loại
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

      {/* Toast thông báo Hoàn tác khi xóa thuốc khỏi tủ */}
      {lastDeletedMed && (
        <View className="absolute bottom-6 left-4 right-4 bg-zinc-900 py-3.5 px-4 rounded-2xl flex-row items-center justify-between shadow-2xl z-40 border border-white/10">
          <Text className="text-white text-xs sm:text-sm font-semibold flex-1 pr-2" numberOfLines={1}>
            Đã xóa "{lastDeletedMed.name}" khỏi tủ thuốc
          </Text>
          <Pressable
            onPress={handleUndoDelete}
            className="bg-blue-600 px-3.5 py-1.5 rounded-xl active:bg-blue-700"
          >
            <Text className="text-white text-xs font-bold">Hoàn tác</Text>
          </Pressable>
        </View>
      )}

      {/* Medicine Detail Modal */}
      <MedicineDetailModal />
    </SafeAreaView>
  );
}

