import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import {
  Sun,
  SunMedium,
  Moon,
  Check,
  RotateCcw,
  User,
  Clock,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Pill,
  Calendar,
  AlertTriangle,
  Plus,
  Users,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Card, Badge, BadgeVariant, Button } from '@/components/ui';
import { useMedStore } from '@/store/useMedStore';
import { TimeSlot, Medicine, MealTiming, FamilyMember } from '@/types/medlens';
import { MOCK_WEEKLY_MATRIX } from '@/mocks/mockData';
import { MedicineDetailModal } from '@/components/features/MedicineDetailModal';
import { checkExpiryStatus } from '@/services/clinical';

// Slot presentation configuration conforming to Apple HIG
const SLOT_CONFIG: Record<
  TimeSlot,
  {
    title: string;
    icon: typeof Sun;
    iconColor: string;
    iconBgColor: string;
  }
> = {
  morning: {
    title: 'Cữ Sáng',
    icon: Sun,
    iconColor: '#D97706',
    iconBgColor: 'bg-amber-100/60',
  },
  noon: {
    title: 'Cữ Trưa',
    icon: SunMedium,
    iconColor: '#EA580C',
    iconBgColor: 'bg-orange-100/60',
  },
  evening: {
    title: 'Cữ Tối',
    icon: Moon,
    iconColor: '#4F46E5',
    iconBgColor: 'bg-indigo-100/60',
  },
};

// Formats today's date in localized Vietnamese format
function getFormattedVietnameseDate(date: Date = new Date()): string {
  const days = [
    'Chủ Nhật',
    'Thứ Hai',
    'Thứ Ba',
    'Thứ Tư',
    'Thứ Năm',
    'Thứ Sáu',
    'Thứ Bảy',
  ];
  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = date.getMonth() + 1;
  return `${dayName}, ${day} tháng ${month}`;
}

// Formats ISO takenAt timestamp to HH:mm
function formatTakenTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return '';
  }
}

// Maps meal timing to localized badge
function getMealTimingBadge(timing: MealTiming): { label: string; variant: BadgeVariant } {
  switch (timing) {
    case 'before_meal':
      return { label: 'Trước ăn', variant: 'warning' };
    case 'after_meal':
      return { label: 'Sau ăn no', variant: 'primary' };
    case 'with_meal':
      return { label: 'Cùng bữa ăn', variant: 'purple' };
    default:
      return { label: 'Theo chỉ định', variant: 'default' };
  }
}

// Adherence calculation helper function modeling the domain logic
// Supports progressive partial credit when individual medicine doses are taken
export function calculateAdherence(
  schedule: Array<{ isTaken?: boolean; medicines?: Array<{ isTaken?: boolean }> }>
) {
  const total = schedule.length;
  if (total === 0) {
    return {
      total: 0,
      completed: 0,
      percentage: 0,
      badgeLabel: 'Cần uống thêm',
      badgeVariant: 'primary' as BadgeVariant,
      label: 'Đã uống 0/0 cữ thuốc hôm nay',
    };
  }

  let partialScore = 0;
  for (const s of schedule) {
    if (s.isTaken) {
      partialScore += 1;
    } else if (s.medicines && s.medicines.length > 0) {
      const takenCount = s.medicines.filter((m) => Boolean(m.isTaken)).length;
      partialScore += takenCount / s.medicines.length;
    }
  }

  const completed = schedule.filter((s) => Boolean(s.isTaken)).length;
  const percentage = Math.min(100, Math.round((partialScore / total) * 100));
  const badgeLabel = percentage === 100 ? 'Tuyệt vời' : 'Cần uống thêm';
  const badgeVariant: BadgeVariant = percentage === 100 ? 'success' : 'primary';
  const label = `Đã uống ${completed}/${total} cữ thuốc hôm nay`;

  return { total, completed, percentage, badgeLabel, badgeVariant, label };
}

export default function TodayScheduleScreen() {
  const router = useRouter();
  const schedule = useMedStore((state) => state.schedule);
  const toggleDoseSlot = useMedStore((state) => state.toggleDoseSlot);
  const toggleMedicineTaken = useMedStore((state) => state.toggleMedicineTaken);
  const resetToDemo = useMedStore((state) => state.resetToDemo);
  const setSelectedMedicine = useMedStore((state) => state.setSelectedMedicine);

  // Multi-profile family state
  const familyMembers = useMedStore((state) => state.familyMembers) || [];
  const activeMemberId = useMedStore((state) => state.activeMemberId) || 'tam';
  const setActiveMember = useMedStore((state) => state.setActiveMember);

  // Tab View Mode: L.ngày vs L.tuần
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [isMemberModalVisible, setIsMemberModalVisible] = useState(false);

  const activeMember = useMemo(() => {
    return familyMembers.find((m) => m.id === activeMemberId) || familyMembers[0] || {
      id: 'tam',
      name: 'Tâm',
      relation: 'Tôi',
    };
  }, [familyMembers, activeMemberId]);

  const formattedDate = useMemo(() => getFormattedVietnameseDate(), []);
  const adherence = useMemo(() => calculateAdherence(schedule), [schedule]);

  const handleToggleSlot = (slot: TimeSlot) => {
    const targetSlot = schedule.find((s) => s.slot === slot);
    const willBeTaken = !targetSlot?.isTaken;

    toggleDoseSlot(slot);

    if (willBeTaken) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleToggleMedicine = (slot: TimeSlot, med: Medicine) => {
    const expiry = checkExpiryStatus(med.expiryDate);
    if (expiry.isExpired && !med.isTaken) {
      Alert.alert(
        'Cảnh Báo An Toàn Thuốc',
        `Thuốc "${med.name}" đã quá hạn sử dụng (${med.expiryDate || 'N/A'}). Bác sĩ khuyến cáo không nên uống thuốc quá hạn.\n\nBạn có chắc chắn muốn uống không?`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Vẫn uống',
            style: 'destructive',
            onPress: () => {
              try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              } catch {}
              toggleMedicineTaken(slot, med.id);
            },
          },
        ]
      );
    } else {
      try {
        if (!med.isTaken) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch {}
      toggleMedicineTaken(slot, med.id);
    }
  };

  const handleOpenSettings = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    router.push('/settings');
  };

  const handleSelectMedicine = (med: Medicine) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedMedicine(med);
  };

  const handleSwitchViewMode = (mode: 'day' | 'week') => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setViewMode(mode);
  };

  const handleSelectMember = (member: FamilyMember) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setActiveMember(member.id);
    setIsMemberModalVisible(false);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F2F2F7]">
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      >
        {/* ========================================================= */}
        {/* HEADER: Seamless Title with Dropdown Arrow + Large Avatar */}
        {/* ========================================================= */}
        <View className="pt-2 pb-3 flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Pressable
              onPress={() => setIsMemberModalVisible(true)}
              hitSlop={8}
              className="flex-row items-center gap-1.5 self-start py-0.5 active:opacity-75"
            >
              <Text className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
                Lịch uống thuốc của {activeMember.name}
              </Text>
              <ChevronDown size={22} color="#2563EB" strokeWidth={2.5} />
            </Pressable>
            <Text className="text-xs font-medium text-zinc-500 mt-1">
              {formattedDate} • {activeMember.relation}
            </Text>
          </View>

          {/* Right: User Avatar opening Settings (Larger size) */}
          <Pressable
            onPress={handleOpenSettings}
            hitSlop={8}
            accessibilityLabel="Mở Cài đặt và Hồ sơ gia đình"
            className="size-12 items-center justify-center rounded-full bg-white border border-slate-200/90 shadow-sm active:scale-95"
          >
            <User size={22} color="#2563EB" strokeWidth={2.2} />
          </Pressable>
        </View>

        {/* ========================================================= */}
        {/* SEGMENTED CONTROL: [ Hôm nay ] vs [ Tuần này ]            */}
        {/* ========================================================= */}
        <View className="flex-row bg-slate-200/80 p-1 rounded-2xl mb-4">
          <Pressable
            onPress={() => handleSwitchViewMode('day')}
            className={`flex-1 py-2 rounded-xl items-center justify-center transition-all ${
              viewMode === 'day' ? 'bg-white shadow-2xs' : 'bg-transparent'
            }`}
          >
            <Text
              className={`text-xs ${
                viewMode === 'day' ? 'font-bold text-zinc-900' : 'font-medium text-zinc-600'
              }`}
            >
              Hôm nay
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleSwitchViewMode('week')}
            className={`flex-1 py-2 rounded-xl items-center justify-center transition-all ${
              viewMode === 'week' ? 'bg-white shadow-2xs' : 'bg-transparent'
            }`}
          >
            <Text
              className={`text-xs ${
                viewMode === 'week' ? 'font-bold text-zinc-900' : 'font-medium text-zinc-600'
              }`}
            >
              Tuần này
            </Text>
          </Pressable>
        </View>

        {/* ========================================================= */}
        {/* CHẾ ĐỘ 1: L.NGÀY (LỊCH THEO NGÀY)                        */}
        {/* ========================================================= */}
        {viewMode === 'day' && (
          <View>
            {/* Adherence Progress Card */}
            <Card className="mb-4 p-4 bg-white">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Tiến độ hôm nay
                </Text>
                <Text className="text-xl font-extrabold text-blue-600">
                  {adherence.percentage}%
                </Text>
              </View>

              <Text className="text-sm font-bold text-zinc-900 mb-2.5">
                {adherence.label}
              </Text>

              {/* Progress Bar */}
              <View className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <View
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: `${adherence.percentage}%` }}
                />
              </View>
            </Card>

            {/* 3 Dose Slots (Sáng, Trưa, Tối) */}
            {schedule.map((doseSlot) => {
              const config = SLOT_CONFIG[doseSlot.slot];
              const SlotIcon = config.icon;
              const isSlotTaken = doseSlot.isTaken;
              const count = doseSlot.medicines.length;

              return (
                <View
                  key={doseSlot.slot}
                  className={`overflow-hidden rounded-3xl border bg-white p-4 shadow-sm mb-3.5 ${
                    isSlotTaken ? 'border-emerald-500/40 bg-emerald-50/10' : 'border-slate-200/60'
                  }`}
                >
                  {/* Slot Header: Sáng: X loại + 1-Touch Toggle Button */}
                  <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
                    <View className="flex-row items-center gap-3">
                      <View
                        className={`size-10 items-center justify-center rounded-2xl ${config.iconBgColor}`}
                      >
                        <SlotIcon size={20} color={config.iconColor} />
                      </View>
                      <View>
                        <View className="flex-row items-center gap-2">
                          <Text className="text-base font-bold text-zinc-900">
                            {config.title}: {count} loại
                          </Text>
                          <Text className="text-xs font-semibold text-zinc-400">
                            {doseSlot.timeLabel}
                          </Text>
                        </View>
                        <View className="mt-0.5">
                          {isSlotTaken ? (
                            <Badge
                              label={
                                doseSlot.takenAt
                                  ? `Đã uống lúc ${formatTakenTime(doseSlot.takenAt)}`
                                  : 'Đã uống'
                              }
                              variant="success"
                              icon={<Check size={11} color="#059669" strokeWidth={3} />}
                            />
                          ) : (
                            <Badge label="Chưa uống" variant="default" />
                          )}
                        </View>
                      </View>
                    </View>

                    {/* 1-Touch Dose Toggle Button */}
                    <Pressable
                      onPress={() => handleToggleSlot(doseSlot.slot)}
                      hitSlop={12}
                      accessibilityLabel={`Đánh dấu ${config.title}`}
                      accessibilityRole="button"
                      style={{ width: 34, height: 34, borderRadius: 17 }}
                      className={`w-[34px] h-[34px] items-center justify-center rounded-full border-2 transition-transform active:scale-90 ${
                        isSlotTaken
                          ? 'bg-emerald-50 border-emerald-500 shadow-sm shadow-emerald-500/20'
                          : 'bg-slate-100 border-slate-300 shadow-2xs active:bg-slate-200'
                      }`}
                    >
                      {isSlotTaken ? (
                        <Check size={20} color="#059669" strokeWidth={3} />
                      ) : null}
                    </Pressable>
                  </View>

                  {/* Medicines List Inside Slot */}
                  <View className="pt-2.5 gap-2">
                    {count === 0 ? (
                      <View className="py-2 items-center justify-center">
                        <Text className="text-xs text-zinc-400 italic">
                          Không có thuốc cho cữ này
                        </Text>
                      </View>
                    ) : (
                      doseSlot.medicines.map((med) => {
                        const mealBadge = getMealTimingBadge(med.mealTiming);
                        const expiry = checkExpiryStatus(med.expiryDate);

                        return (
                          <Pressable
                            key={med.id}
                            onPress={() => handleSelectMedicine(med)}
                            className={`flex-row items-center justify-between rounded-2xl p-3 border active:scale-[0.99] ${
                              expiry.isExpired
                                ? 'bg-red-50/50 border-red-200'
                                : med.isTaken
                                ? 'bg-emerald-50/40 border-emerald-200'
                                : 'bg-slate-50/80 border-slate-100/80 active:bg-slate-100'
                            }`}
                          >
                            <View className="flex-row items-center gap-3 flex-1 pr-2">
                              {/* Individual Medicine Checkbox */}
                              <Pressable
                                hitSlop={14}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleToggleMedicine(doseSlot.slot, med);
                                }}
                                accessibilityLabel={`Đánh dấu đã uống ${med.name}`}
                                style={{ width: 31, height: 31, borderRadius: 16 }}
                                className={`w-[31px] h-[31px] rounded-full border-2 items-center justify-center transition-all active:scale-90 ${
                                  med.isTaken
                                    ? 'bg-emerald-50 border-emerald-500 shadow-xs'
                                    : 'bg-slate-100 border-slate-300 shadow-2xs active:bg-slate-200'
                                }`}
                              >
                                {med.isTaken ? (
                                  <Check size={18} color="#059669" strokeWidth={2.8} />
                                ) : null}
                              </Pressable>

                              <View className="flex-1">
                                <View className="flex-row items-center gap-2 mb-0.5 flex-wrap">
                                  <Text
                                    className={`text-sm font-bold ${
                                      med.isTaken ? 'text-zinc-500 line-through' : 'text-zinc-900'
                                    }`}
                                    numberOfLines={1}
                                  >
                                    {med.name}
                                  </Text>
                                  <Badge
                                    label={mealBadge.label}
                                    variant={mealBadge.variant}
                                  />
                                </View>
                                <Text
                                  className="text-xs text-zinc-500"
                                  numberOfLines={1}
                                >
                                  Hoạt chất: {med.activeIngredient}
                                </Text>
                                <Text
                                  className="text-xs text-slate-600 font-medium mt-0.5"
                                  numberOfLines={1}
                                >
                                  {med.dosage} • {med.instructions}
                                </Text>

                                {/* Expired Warning on Today Schedule */}
                                {expiry.isExpired && (
                                  <View className="flex-row items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-red-100 self-start">
                                    <AlertTriangle size={11} color="#DC2626" />
                                    <Text className="text-3xs font-bold text-red-700">
                                      Thuốc đã quá hạn sử dụng — Không nên uống
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </View>
                            <ChevronRight size={16} color="#94A3B8" />
                          </Pressable>
                        );
                      })
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ========================================================= */}
        {/* CHẾ ĐỘ 2: L.TUẦN (MA TRẬN LỊCH TUẦN 7 NGÀY)               */}
        {/* ========================================================= */}
        {viewMode === 'week' && (
          <View className="gap-4">
            {/* Weekly Adherence Progress Card */}
            <Card className="p-4 bg-white">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Tiến độ tuần
                </Text>
                <Text className="text-xl font-extrabold text-blue-600">91%</Text>
              </View>
              <Text className="text-sm font-bold text-zinc-900 mb-2.5">
                Đã hoàn thành 10/11 cữ trong tuần
              </Text>
              <View className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <View className="h-full rounded-full bg-blue-600" style={{ width: '91%' }} />
              </View>
            </Card>

            {/* 7-Day Weekly Grid Matrix Card */}
            <Card className="p-4 bg-white">
              <View className="flex-row items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <View className="flex-row items-center gap-2">
                  <Calendar size={16} color="#2563EB" />
                  <Text className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                    MA TRẬN TUÂN THỦ (THỨ 2 - CHỦ NHẬT)
                  </Text>
                </View>
                <Text className="text-xs font-medium text-zinc-400">Tuần hiện tại</Text>
              </View>

              {/* Matrix Table */}
              <View className="gap-2.5">
                {/* Header row: Days of week */}
                <View className="flex-row items-center">
                  <View className="w-14 items-center">
                    <Text className="text-2xs font-bold text-zinc-400">CỮ</Text>
                  </View>
                  <View className="flex-1 flex-row justify-between">
                    {MOCK_WEEKLY_MATRIX.map((col) => (
                      <View
                        key={col.dayLabel}
                        className={`items-center py-1 px-1.5 rounded-xl ${
                          col.isToday ? 'bg-blue-600' : 'bg-slate-50'
                        }`}
                      >
                        <Text
                          className={`text-2xs font-bold ${
                            col.isToday ? 'text-white' : 'text-zinc-700'
                          }`}
                        >
                          {col.dayLabel}
                        </Text>
                        <Text
                          className={`text-3xs font-medium ${
                            col.isToday ? 'text-blue-100' : 'text-zinc-400'
                          }`}
                        >
                          {col.dateLabel}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Row 1: Sáng */}
                <View className="flex-row items-center py-1 border-t border-slate-50">
                  <View className="w-14 flex-row items-center gap-1">
                    <Sun size={12} color="#D97706" />
                    <Text className="text-xs font-bold text-zinc-700">Sáng</Text>
                  </View>
                  <View className="flex-1 flex-row justify-between">
                    {MOCK_WEEKLY_MATRIX.map((col, idx) => (
                      <View
                        key={`morning-${idx}`}
                        className={`size-7 rounded-xl items-center justify-center ${
                          col.morning === true
                            ? 'bg-emerald-500'
                            : col.morning === false
                            ? 'bg-red-500'
                            : 'bg-slate-100'
                        }`}
                      >
                        {col.morning === true && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                        {col.morning === false && <Text className="text-xs font-bold text-white">!</Text>}
                        {col.morning === null && <View className="size-1.5 rounded-full bg-slate-300" />}
                      </View>
                    ))}
                  </View>
                </View>

                {/* Row 2: Trưa */}
                <View className="flex-row items-center py-1 border-t border-slate-50">
                  <View className="w-14 flex-row items-center gap-1">
                    <SunMedium size={12} color="#EA580C" />
                    <Text className="text-xs font-bold text-zinc-700">Trưa</Text>
                  </View>
                  <View className="flex-1 flex-row justify-between">
                    {MOCK_WEEKLY_MATRIX.map((col, idx) => (
                      <View
                        key={`noon-${idx}`}
                        className={`size-7 rounded-xl items-center justify-center ${
                          col.noon === true
                            ? 'bg-emerald-500'
                            : col.noon === false
                            ? 'bg-red-500'
                            : 'bg-slate-100'
                        }`}
                      >
                        {col.noon === true && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                        {col.noon === false && <Text className="text-xs font-bold text-white">!</Text>}
                        {col.noon === null && <View className="size-1.5 rounded-full bg-slate-300" />}
                      </View>
                    ))}
                  </View>
                </View>

                {/* Row 3: Tối */}
                <View className="flex-row items-center py-1 border-t border-slate-50">
                  <View className="w-14 flex-row items-center gap-1">
                    <Moon size={12} color="#4F46E5" />
                    <Text className="text-xs font-bold text-zinc-700">Tối</Text>
                  </View>
                  <View className="flex-1 flex-row justify-between">
                    {MOCK_WEEKLY_MATRIX.map((col, idx) => (
                      <View
                        key={`evening-${idx}`}
                        className={`size-7 rounded-xl items-center justify-center ${
                          col.evening === true
                            ? 'bg-emerald-500'
                            : col.evening === false
                            ? 'bg-red-500'
                            : 'bg-slate-100'
                        }`}
                      >
                        {col.evening === true && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                        {col.evening === false && <Text className="text-xs font-bold text-white">!</Text>}
                        {col.evening === null && <View className="size-1.5 rounded-full bg-slate-300" />}
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </Card>

            {/* 2 Metric Cards */}
            <View className="flex-row gap-3">
              <View className="flex-1 p-4 rounded-3xl bg-white border border-slate-200/60 shadow-2xs">
                <Text className="text-2xs font-bold uppercase tracking-wider text-zinc-400">
                  Tỷ lệ tuân thủ
                </Text>
                <Text className="text-2xl font-bold text-zinc-900 mt-1">91%</Text>
                <Text className="text-2xs font-medium text-emerald-600 mt-0.5">+12% so với tuần trước</Text>
              </View>

              <View className="flex-1 p-4 rounded-3xl bg-white border border-slate-200/60 shadow-2xs">
                <Text className="text-2xs font-bold uppercase tracking-wider text-zinc-400">
                  Số cữ bỏ lỡ
                </Text>
                <Text className="text-2xl font-bold text-zinc-900 mt-1">1 cữ</Text>
                <Text className="text-2xs font-medium text-amber-600 mt-0.5">Cữ trưa Thứ Tư</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ========================================================= */}
      {/* MODAL: CHỌN THÀNH VIÊN GIA ĐÌNH (DROPDOWN)                */}
      {/* ========================================================= */}
      <Modal
        visible={isMemberModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMemberModalVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/40 justify-center px-6"
          onPress={() => setIsMemberModalVisible(false)}
        >
          <Pressable
            className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xl"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <View className="flex-row items-center gap-2">
                <Users size={18} color="#2563EB" />
                <Text className="text-base font-bold text-zinc-900">
                  Chọn Thành Viên Gia Đình
                </Text>
              </View>
              <Pressable
                onPress={() => setIsMemberModalVisible(false)}
                className="size-7 items-center justify-center rounded-full bg-slate-100"
              >
                <Text className="text-xs font-bold text-zinc-500">✕</Text>
              </Pressable>
            </View>

            <View className="gap-2">
              {familyMembers.map((member) => {
                const isSelected = member.id === activeMember.id;
                return (
                  <Pressable
                    key={member.id}
                    onPress={() => handleSelectMember(member)}
                    className={`flex-row items-center justify-between p-3.5 rounded-2xl border active:scale-[0.99] ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-500'
                        : 'bg-slate-50 border-slate-200/80'
                    }`}
                  >
                    <View className="flex-row items-center gap-3">
                      <View
                        className="size-10 rounded-xl items-center justify-center"
                        style={{ backgroundColor: member.avatarColor || '#2563EB' }}
                      >
                        <Text className="text-sm font-bold text-white">
                          {member.name.charAt(0)}
                        </Text>
                      </View>
                      <View className="flex-1 pr-2">
                        <Text className="text-sm font-bold text-zinc-900">{member.name}</Text>
                        <Text className="text-xs text-zinc-500 mt-0.5">
                          {member.relation}
                        </Text>
                      </View>
                    </View>
                    {isSelected && <Check size={18} color="#2563EB" strokeWidth={3} />}
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => {
                setIsMemberModalVisible(false);
                router.push('/settings');
              }}
              className="mt-4 py-2.5 flex-row items-center justify-center gap-1.5 rounded-2xl bg-slate-100 active:bg-slate-200"
            >
              <Plus size={16} color="#2563EB" />
              <Text className="text-xs font-bold text-blue-600">Quản lý & Thêm thành viên</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Medicine Detail Modal bottom sheet */}
      <MedicineDetailModal />
    </SafeAreaView>
  );
}
