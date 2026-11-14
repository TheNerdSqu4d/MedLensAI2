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
  Bell,
  X,
  Settings,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Card, Badge, BadgeVariant, Button } from '@/components/ui';
import { useMedStore } from '@/store/useMedStore';
import { TimeSlot, Medicine, MealTiming, FamilyMember } from '@/types/medlens';
import { MOCK_WEEKLY_MATRIX, MOCK_ALL_WEEKS } from '@/mocks/mockData';
import { MedicineDetailModal } from '@/components/features/MedicineDetailModal';
import { checkExpiryStatus, calculateAdherence } from '@/services/clinical';

export { calculateAdherence };

// Helper calculates gradient color from Red -> Yellow -> Green based on adherence percentage
export function getAdherenceProgressColor(percentage: number): string {
  const p = Math.max(0, Math.min(100, percentage)) / 100;
  let r: number, g: number, b: number;
  if (p < 0.5) {
    // Red (239, 68, 68) to Yellow (234, 179, 8)
    const factor = p * 2;
    r = Math.round(239 + (234 - 239) * factor);
    g = Math.round(68 + (179 - 68) * factor);
    b = Math.round(68 + (8 - 68) * factor);
  } else {
    // Yellow (234, 179, 8) to Green (16, 185, 129)
    const factor = (p - 0.5) * 2;
    r = Math.round(234 + (16 - 234) * factor);
    g = Math.round(179 + (185 - 179) * factor);
    b = Math.round(8 + (129 - 8) * factor);
  }
  return `rgb(${r}, ${g}, ${b})`;
}

// Slot presentation configuration conforming to Apple HIG & user card layout
const SLOT_CONFIG: Record<
  TimeSlot,
  {
    title: string;
    timeRange: string;
    slotTime: string;
    icon: typeof Sun;
    iconColor: string;
    iconBgColor: string;
  }
> = {
  morning: {
    title: 'BUỔI SÁNG',
    timeRange: '06:00 - 11:59',
    slotTime: '07:30',
    icon: Sun,
    iconColor: '#D97706',
    iconBgColor: 'bg-amber-100/60',
  },
  noon: {
    title: 'BUỔI TRƯA',
    timeRange: '12:00 - 17:59',
    slotTime: '12:30',
    icon: SunMedium,
    iconColor: '#EA580C',
    iconBgColor: 'bg-orange-100/60',
  },
  evening: {
    title: 'BUỔI TỐI',
    timeRange: '18:00 - 23:59',
    slotTime: '20:00',
    icon: Moon,
    iconColor: '#4F46E5',
    iconBgColor: 'bg-indigo-100/60',
  },
};

// Formats medicine dosage and meal instruction text
function getMealTimingInstruction(med: Medicine): string {
  const dosage = med.dosage || '1 viên';
  let mealText = 'Uống sau khi ăn';
  if (med.mealTiming === 'before_meal') {
    mealText = 'Uống trước khi ăn';
  } else if (med.mealTiming === 'with_meal') {
    mealText = 'Uống trong khi ăn';
  } else if (med.mealTiming === 'after_meal') {
    mealText = 'Uống sau khi ăn';
  } else if (med.instructions && med.instructions.length < 25) {
    mealText = med.instructions;
  }
  return `${dosage} • ${mealText}`;
}

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



export default function TodayScheduleScreen() {
  const router = useRouter();
  const schedule = useMedStore((state) => state.schedule);
  const toggleDoseSlot = useMedStore((state) => state.toggleDoseSlot);
  const toggleMedicineTaken = useMedStore((state) => state.toggleMedicineTaken);
  const snoozeMedicine = useMedStore((state) => state.snoozeMedicine);
  const skipMedicine = useMedStore((state) => state.skipMedicine);
  const resetToDemo = useMedStore((state) => state.resetToDemo);
  const setSelectedMedicine = useMedStore((state) => state.setSelectedMedicine);

  // Multi-profile family state
  const familyMembers = useMedStore((state) => state.familyMembers) || [];
  const activeMemberId = useMedStore((state) => state.activeMemberId) || 'tam';
  const setActiveMember = useMedStore((state) => state.setActiveMember);

  // Tab View Mode: L.ngày vs L.tuần
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [isMemberModalVisible, setIsMemberModalVisible] = useState(false);

  // Week navigation & selection state: 4 tuần tròn 1 tháng (0: Tuần 1, 1: Tuần 2, 2: Tuần 3, 3: Tuần 4)
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(1);
  const [selectedDayIndex, setSelectedDayIndex] = useState(2); // default select T4

  // Center Prompt Reminder Modal state
  const [isReminderPromptVisible, setIsReminderPromptVisible] = useState(false);
  const [promptSlot, setPromptSlot] = useState<TimeSlot>('morning');
  const [promptMedicine, setPromptMedicine] = useState<Medicine | null>(null);

  // Undo skipped medicine state
  const [lastSkippedItem, setLastSkippedItem] = useState<{ slot: TimeSlot; medicine: Medicine } | null>(null);

  // Trigger popup nhắc nhở tự động 1 lần khi có cữ thuốc cần uống
  React.useEffect(() => {
    const firstPendingSlot = schedule.find((s) => s.medicines.some((m) => !m.isTaken && !m.isSkipped));
    const pendingMed = firstPendingSlot?.medicines.find((m) => !m.isTaken && !m.isSkipped);
    if (pendingMed && firstPendingSlot) {
      setPromptSlot(firstPendingSlot.slot);
      setPromptMedicine(pendingMed);
      setIsReminderPromptVisible(true);
    }
  }, []);

  const activeMember = useMemo(() => {
    return familyMembers.find((m) => m.id === activeMemberId) || familyMembers[0] || {
      id: 'tam',
      name: 'Tâm',
      relation: 'Tôi',
    };
  }, [familyMembers, activeMemberId]);

  const activeWeekData = useMemo(() => {
    return MOCK_ALL_WEEKS[selectedWeekIndex] || MOCK_ALL_WEEKS[1];
  }, [selectedWeekIndex]);

  const selectedDayData = useMemo(() => {
    return activeWeekData.matrix[selectedDayIndex] || activeWeekData.matrix[0];
  }, [activeWeekData, selectedDayIndex]);

  const formattedDate = useMemo(() => getFormattedVietnameseDate(), []);
  const adherence = useMemo(() => calculateAdherence(schedule), [schedule]);
  const progressColor = useMemo(
    () => getAdherenceProgressColor(adherence.percentage),
    [adherence.percentage]
  );

  const handleOpenReminderPrompt = (slot: TimeSlot, med: Medicine) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setPromptSlot(slot);
    setPromptMedicine(med);
    setIsReminderPromptVisible(true);
  };

  const handleConfirmPromptTaken = () => {
    if (promptMedicine) {
      handleToggleMedicine(promptSlot, promptMedicine);
    }
    setIsReminderPromptVisible(false);
  };

  const handleConfirmPromptSnooze = () => {
    if (promptMedicine) {
      handleSnoozeMedicine(promptSlot, promptMedicine);
    }
    setIsReminderPromptVisible(false);
  };

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

  const handleSnoozeMedicine = (slot: TimeSlot, med: Medicine) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    snoozeMedicine(slot, med.id, 10);
  };

  const handleSkipMedicine = (slot: TimeSlot, med: Medicine) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    skipMedicine(slot, med.id);
    setLastSkippedItem({ slot, medicine: med });
    // Tự động ẩn thanh hoàn tác sau 5 giây
    setTimeout(() => {
      setLastSkippedItem((prev) => (prev?.medicine.id === med.id ? null : prev));
    }, 5000);
  };

  const handleUndoSkip = () => {
    if (!lastSkippedItem) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    // Khôi phục lại trạng thái chưa bỏ qua
    useMedStore.setState((state) => ({
      schedule: state.schedule.map((s) => {
        if (s.slot !== lastSkippedItem.slot) return s;
        return {
          ...s,
          medicines: s.medicines.map((m) =>
            m.id === lastSkippedItem.medicine.id ? { ...m, isSkipped: false } : m
          ),
        };
      }),
    }));
    setLastSkippedItem(null);
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
            {/* Adherence Progress Card with Gradient Dynamic Color */}
            <Card className="mb-3.5 p-4 bg-white">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Tiến độ hôm nay
                </Text>
                <Text
                  className="text-xl font-extrabold"
                  style={{ color: progressColor }}
                >
                  {adherence.percentage}%
                </Text>
              </View>

              <Text className="text-sm font-bold text-zinc-900 mb-2.5">
                {adherence.label}
              </Text>

              {/* Gradient-mapped Progress Bar from Red to Green */}
              <View className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${adherence.percentage}%`,
                    backgroundColor: progressColor,
                  }}
                />
              </View>
            </Card>

            {/* Dose Slots (Sáng, Trưa, Tối) with photo layout */}
            {schedule.map((doseSlot) => {
              const config = SLOT_CONFIG[doseSlot.slot];
              const SlotIcon = config.icon;
              // Bỏ thuốc quá hạn sử dụng và thuốc đã bấm bỏ qua khỏi danh sách uống hôm nay
              const activeMedicines = doseSlot.medicines.filter(
                (m) => !checkExpiryStatus(m.expiryDate).isExpired && !m.isSkipped
              );
              const count = activeMedicines.length;

              return (
                <View key={doseSlot.slot} className="mb-3.5">
                  {/* Slot Group Header (e.g. ☀️ BUỔI SÁNG       06:00 - 11:59) */}
                  <View className="flex-row items-center justify-between px-1 mb-2.5 mt-1">
                    <View className="flex-row items-center gap-1.5">
                      <SlotIcon size={16} color={config.iconColor} />
                      <Text className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                        {config.title}
                      </Text>
                    </View>
                    <Text className="text-xs font-semibold text-zinc-400">
                      {config.timeRange}
                    </Text>
                  </View>

                  {/* Medicines List in this slot */}
                  {count === 0 ? (
                    <View className="rounded-3xl border border-slate-200/60 bg-white p-4 items-center justify-center mb-2">
                      <Text className="text-xs text-zinc-400 italic">
                        Không có thuốc cho cữ này
                      </Text>
                    </View>
                  ) : (
                    activeMedicines.map((med) => {
                      const isTaken = Boolean(med.isTaken);
                      const isSnoozed = Boolean(med.snoozedUntil);

                      return (
                        <Pressable
                          key={med.id}
                          onPress={() => handleSelectMedicine(med)}
                          className={`overflow-hidden rounded-3xl border p-4 shadow-sm mb-3.5 transition-all ${
                            isTaken
                              ? 'border-emerald-300 bg-white'
                              : isSnoozed
                              ? 'border-purple-300 bg-purple-50/10'
                              : 'border-amber-300/80 bg-white'
                          }`}
                        >
                          {/* Line 1: Tên hộp thuốc - Gạch ngang khi đã uống theo Ảnh 5 */}
                          <Text
                            className={`text-xl font-bold tracking-tight mb-0.5 ${
                              isTaken ? 'text-zinc-400 line-through' : 'text-zinc-900'
                            }`}
                          >
                            {med.name}
                          </Text>

                          {/* Line 2: Dosage & Meal instruction */}
                          <Text className="text-sm text-zinc-500 font-medium mb-3">
                            {getMealTimingInstruction(med)}
                          </Text>

                          {/* Line 3: Pills row */}
                          <View className="flex-row items-center gap-2 mb-3.5 flex-wrap">
                            {/* Time pill */}
                            <View className="flex-row items-center gap-1.5 px-3 py-1 rounded-full border border-slate-200 bg-slate-50">
                              <Clock size={12} color="#64748B" />
                              <Text className="text-xs font-semibold text-zinc-700">
                                {config.slotTime}
                              </Text>
                            </View>

                            {/* Status pill: chuẩn Ảnh 5 khi đã uống */}
                            {isTaken ? (
                              <View className="flex-row items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300">
                                <Check size={12} color="#065F46" strokeWidth={3} />
                                <Text className="text-xs font-bold text-emerald-800">
                                  Đã uống ({formatTakenTime(doseSlot.takenAt) || '14:46'})
                                </Text>
                              </View>
                            ) : isSnoozed ? (
                              <View className="flex-row items-center gap-1 px-3 py-1 rounded-full bg-purple-100 border border-purple-200">
                                <Bell size={12} color="#6B21A8" />
                                <Text className="text-xs font-bold text-purple-900">
                                  Nhắc lại sau 10 phút
                                </Text>
                              </View>
                            ) : (
                              <View className="flex-row items-center gap-1 px-3 py-1 rounded-full bg-amber-100/70 border border-amber-200">
                                <AlertTriangle size={12} color="#D97706" />
                                <Text className="text-xs font-bold text-amber-800">
                                  Quá giờ uống
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* Line 4: Action Buttons chuẩn theo Ảnh 5 */}
                          {isTaken ? (
                            <View className="flex-row items-center gap-2 pt-0.5">
                              {/* Nút 1: [ ✓ Hoàn thành cữ này ] */}
                              <View className="flex-1 flex-row items-center justify-center gap-1.5 py-3 px-4 rounded-2xl bg-[#ECFDF5] border border-emerald-200/80">
                                <Check size={18} color="#065F46" strokeWidth={2.5} />
                                <Text className="text-base font-bold text-[#065F46]">
                                  Hoàn thành cữ này
                                </Text>
                              </View>

                              {/* Nút 2: [ ⟲ Hoàn tác ] */}
                              <Pressable
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleToggleMedicine(doseSlot.slot, med);
                                }}
                                accessibilityLabel={`Hoàn tác cữ thuốc ${med.name}`}
                                className="flex-row items-center justify-center gap-1.5 py-3 px-4 rounded-2xl bg-[#F1F5F9] border border-slate-200/60 active:bg-slate-200 active:scale-[0.98]"
                              >
                                <RotateCcw size={16} color="#475569" strokeWidth={2.2} />
                                <Text className="text-sm font-semibold text-[#475569]">
                                  Hoàn tác
                                </Text>
                              </Pressable>
                            </View>
                          ) : (
                            <View className="flex-row items-center gap-2 pt-0.5">
                              {/* Button 1: [ ✓ Đã uống ] */}
                              <Pressable
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleToggleMedicine(doseSlot.slot, med);
                                }}
                                accessibilityLabel={`Đánh dấu đã uống ${med.name}`}
                                className="flex-1 flex-row items-center justify-center gap-1.5 py-3 px-4 rounded-2xl bg-[#2D7A58] active:bg-emerald-800 active:scale-[0.98]"
                              >
                                <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
                                <Text className="text-base font-semibold text-white">
                                  Đã uống
                                </Text>
                              </Pressable>

                              {/* Button 2: [ 🔔 Nhắc lại ] */}
                              <Pressable
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleSnoozeMedicine(doseSlot.slot, med);
                                }}
                                accessibilityLabel={`Nhắc lại sau 10 phút ${med.name}`}
                                className={`flex-row items-center justify-center gap-1.5 py-3 px-4 rounded-2xl border active:scale-[0.98] ${
                                  isSnoozed
                                    ? 'bg-purple-100 border-purple-300'
                                    : 'bg-[#F5F0FF] border border-purple-200/80 active:bg-purple-100'
                                }`}
                              >
                                <Bell size={16} color="#7C3AED" strokeWidth={2.2} />
                                <Text className="text-sm font-semibold text-[#7C3AED]">
                                  Nhắc lại
                                </Text>
                              </Pressable>

                              {/* Button 3: [ ✕ Bỏ qua ] */}
                              <Pressable
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleSkipMedicine(doseSlot.slot, med);
                                }}
                                accessibilityLabel={`Bỏ qua cữ thuốc ${med.name}`}
                                className="flex-row items-center justify-center gap-1 py-3 px-3.5 rounded-2xl bg-[#F1F5F9] border border-slate-200/60 active:bg-slate-200 active:scale-[0.98]"
                              >
                                <X size={15} color="#475569" strokeWidth={2.2} />
                                <Text className="text-sm font-semibold text-[#475569]">
                                  Bỏ qua
                                </Text>
                              </Pressable>
                            </View>
                          )}
                        </Pressable>
                      );
                    })
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ========================================================= */}
        {/* CHẾ ĐỘ 2: L.TUẦN (MA TRẬN LỊCH TUẦN 7 NGÀY - TẤT CẢ TUẦN) */}
        {/* ========================================================= */}
        {viewMode === 'week' && (
          <View className="gap-3.5">
            {/* Week Navigation Selector */}
            <View className="flex-row items-center justify-between p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
              <Pressable
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                  setSelectedWeekIndex((prev) => Math.max(0, prev - 1));
                }}
                disabled={selectedWeekIndex === 0}
                className={`px-3 py-1.5 rounded-xl border ${
                  selectedWeekIndex === 0
                    ? 'bg-slate-50 border-slate-100 opacity-40'
                    : 'bg-slate-100 border-slate-200 active:bg-slate-200'
                }`}
              >
                <Text className="text-xs font-bold text-zinc-700">← Tuần trước</Text>
              </Pressable>

              <View className="items-center">
                <Text className="text-sm font-bold text-zinc-900">{activeWeekData.label}</Text>
                <Text className="text-3xs text-zinc-400 font-medium">{activeWeekData.dateRange}</Text>
              </View>

              <Pressable
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                  setSelectedWeekIndex((prev) => Math.min(MOCK_ALL_WEEKS.length - 1, prev + 1));
                }}
                disabled={selectedWeekIndex === MOCK_ALL_WEEKS.length - 1}
                className={`px-3 py-1.5 rounded-xl border ${
                  selectedWeekIndex === MOCK_ALL_WEEKS.length - 1
                    ? 'bg-slate-50 border-slate-100 opacity-40'
                    : 'bg-slate-100 border-slate-200 active:bg-slate-200'
                }`}
              >
                <Text className="text-xs font-bold text-zinc-700">Tuần sau →</Text>
              </Pressable>
            </View>

            {/* 7-Day Weekly Grid Matrix Card */}
            <Card className="p-4 bg-white">
              <View className="flex-row items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <View className="flex-row items-center gap-2">
                  <Calendar size={16} color="#2563EB" />
                  <Text className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                    MA TRẬN TUÂN THỦ (THỨ 2 - CHỦ NHẬT)
                  </Text>
                </View>
                <Text className="text-xs font-medium text-zinc-400">{activeWeekData.label}</Text>
              </View>

              {/* Matrix Table */}
              <View className="gap-2.5">
                {/* Header row: Days of week */}
                <View className="flex-row items-center">
                  <View className="w-14 items-center">
                    <Text className="text-2xs font-bold text-zinc-400">CỮ</Text>
                  </View>
                  <View className="flex-1 flex-row justify-between">
                    {activeWeekData.matrix.map((col, idx) => {
                      const isSelected = selectedDayIndex === idx;
                      return (
                        <Pressable
                          key={col.dayLabel}
                          onPress={() => {
                            try {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            } catch {}
                            setSelectedDayIndex(idx);
                          }}
                          className={`items-center py-1 px-1.5 rounded-xl border ${
                            isSelected
                              ? 'bg-blue-600 border-blue-700 shadow-2xs'
                              : col.isToday
                              ? 'bg-blue-50 border-blue-300'
                              : 'bg-slate-50 border-transparent'
                          }`}
                        >
                          <Text
                            className={`text-2xs font-bold ${
                              isSelected ? 'text-white' : 'text-zinc-700'
                            }`}
                          >
                            {col.dayLabel}
                          </Text>
                          <Text
                            className={`text-3xs font-medium ${
                              isSelected ? 'text-blue-100' : 'text-zinc-400'
                            }`}
                          >
                            {col.dateLabel}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Row 1: Sáng */}
                <View className="flex-row items-center py-1 border-t border-slate-50">
                  <View className="w-14 flex-row items-center gap-1">
                    <Sun size={12} color="#D97706" />
                    <Text className="text-xs font-bold text-zinc-700">Sáng</Text>
                  </View>
                  <View className="flex-1 flex-row justify-between">
                    {activeWeekData.matrix.map((col, idx) => (
                      <Pressable
                        key={`morning-${idx}`}
                        onPress={() => setSelectedDayIndex(idx)}
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
                      </Pressable>
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
                    {activeWeekData.matrix.map((col, idx) => (
                      <Pressable
                        key={`noon-${idx}`}
                        onPress={() => setSelectedDayIndex(idx)}
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
                      </Pressable>
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
                    {activeWeekData.matrix.map((col, idx) => (
                      <Pressable
                        key={`evening-${idx}`}
                        onPress={() => setSelectedDayIndex(idx)}
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
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            </Card>

            {/* Chi tiết cữ uống của ngày được bấm chọn trong ma trận */}
            {(() => {
              const isMissed =
                selectedDayData.morning === false ||
                selectedDayData.noon === false ||
                selectedDayData.evening === false;

              return (
                <Card className={`p-4 ${isMissed ? 'bg-red-50/70 border-red-200' : 'bg-white'}`}>
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center gap-2">
                      {isMissed ? (
                        <AlertTriangle size={18} color="#DC2626" />
                      ) : (
                        <CheckCircle2 size={18} color="#059669" />
                      )}
                      <Text
                        className={`text-sm font-bold ${
                          isMissed ? 'text-red-950' : 'text-zinc-900'
                        }`}
                      >
                        Chi tiết ngày {selectedDayData.dayLabel} ({selectedDayData.dateLabel})
                      </Text>
                    </View>
                    <Badge
                      label={
                        isMissed
                          ? 'Có cữ chưa uống'
                          : selectedDayData.morning === null
                          ? 'Chưa tới ngày'
                          : 'Đã uống đủ'
                      }
                      variant={
                        isMissed
                          ? 'danger'
                          : selectedDayData.morning === null
                          ? 'default'
                          : 'success'
                      }
                    />
                  </View>

                  {isMissed ? (
                    <View className="gap-2 mt-2">
                      {selectedDayData.missedDetails && selectedDayData.missedDetails.length > 0 ? (
                        selectedDayData.missedDetails.map((item, mIdx) => (
                          <View
                            key={mIdx}
                            className="p-3 bg-white rounded-2xl border border-red-100 flex-row items-center justify-between"
                          >
                            <View className="flex-1 pr-2">
                              <Text className="text-xs font-bold text-zinc-900">
                                {item.slotTitle} ({item.time}): {item.medicineName}
                              </Text>
                            </View>
                            <Badge label="Chưa uống" variant="danger" />
                          </View>
                        ))
                      ) : (
                        <View className="p-3 bg-white rounded-2xl border border-red-100">
                          <Text className="text-xs font-bold text-red-700">
                            Ghi nhận bỏ lỡ cữ thuốc trong ngày này. Vui lòng kiểm tra lại đơn thuốc.
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : selectedDayData.morning === null ? (
                    <Text className="text-xs text-zinc-500 mt-1 italic">
                      Cữ thuốc của các ngày sắp tới trong tuần.
                    </Text>
                  ) : (
                    <Text className="text-xs font-medium text-emerald-800 mt-1">
                      ✓ Bạn đã hoàn thành đầy đủ tất cả các cữ uống thuốc đúng giờ trong ngày này.
                    </Text>
                  )}
                </Card>
              );
            })()}
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
                    className={`flex-row items-center justify-between px-4 py-3.5 rounded-2xl border active:scale-[0.99] ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-500'
                        : 'bg-slate-50 border-slate-200/80'
                    }`}
                  >
                    <View className="flex-row items-center gap-3 flex-1 mr-3">
                      <View
                        className="size-10 rounded-xl items-center justify-center shrink-0"
                        style={{ backgroundColor: member.avatarColor || '#2563EB' }}
                      >
                        <Text className="text-sm font-bold text-white">
                          {member.name.charAt(0)}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-bold text-zinc-900">{member.name}</Text>
                        <Text className="text-xs text-zinc-500 mt-0.5">
                          {member.relation}
                        </Text>
                      </View>
                    </View>
                    {isSelected && (
                      <View className="shrink-0 pl-1">
                        <Check size={20} color="#2563EB" strokeWidth={3.5} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Floating Settings Button matching photo */}
      <Pressable
        onPress={handleOpenSettings}
        hitSlop={8}
        accessibilityLabel="Cài đặt ứng dụng"
        accessibilityRole="button"
        className="absolute right-5 bottom-8 size-14 rounded-full bg-blue-600 items-center justify-center shadow-lg shadow-blue-600/40 active:scale-95 active:bg-blue-700 z-30"
      >
        <Settings size={24} color="#FFFFFF" strokeWidth={2.2} />
      </Pressable>

      {/* Toast thông báo Hoàn tác khi bỏ qua cữ thuốc */}
      {lastSkippedItem && (
        <View className="absolute bottom-24 left-4 right-4 bg-zinc-900 py-3.5 px-4 rounded-2xl flex-row items-center justify-between shadow-2xl z-40 border border-white/10">
          <Text className="text-white text-xs sm:text-sm font-semibold flex-1 pr-2" numberOfLines={1}>
            Đã bỏ qua cữ "{lastSkippedItem.medicine.name}"
          </Text>
          <Pressable
            onPress={handleUndoSkip}
            className="bg-blue-600 px-3.5 py-1.5 rounded-xl active:bg-blue-700"
          >
            <Text className="text-white text-xs font-bold">Hoàn tác</Text>
          </Pressable>
        </View>
      )}

      {/* ========================================================= */}
      {/* MODAL: THÔNG BÁO NHẮC UỐNG THUỐC GIỮA MÀN HÌNH (CENTER)   */}
      {/* ========================================================= */}
      <Modal
        visible={isReminderPromptVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsReminderPromptVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/60 justify-center items-center px-4"
          onPress={() => setIsReminderPromptVisible(false)}
        >
          <Pressable
            className="bg-white rounded-3xl w-full max-w-[390px] p-6 border border-slate-200 shadow-2xl items-center"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header Icon */}
            <View className="size-16 rounded-3xl bg-blue-50 border border-blue-100 items-center justify-center mb-3">
              <Bell size={32} color="#2563EB" strokeWidth={2.4} />
            </View>

            <Text className="text-2xl font-black text-zinc-900 text-center tracking-tight">
              Đến Giờ Uống Thuốc
            </Text>
            <Text className="text-xs font-semibold text-zinc-500 text-center mt-1 mb-4">
              Cữ thuốc của {activeMember.name} • {formattedDate}
            </Text>

            {/* Target Medicine Card */}
            {promptMedicine ? (
              <View className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200/80 mb-5">
                <Text className="text-lg font-bold text-zinc-900 mb-1" numberOfLines={2}>
                  {promptMedicine.name}
                </Text>
                <Text className="text-xs text-zinc-600 font-medium mb-1.5">
                  {getMealTimingInstruction(promptMedicine)}
                </Text>
                <View className="flex-row items-center gap-2">
                  <Badge
                    label={promptMedicine.category || 'Thuốc định kỳ'}
                    variant="primary"
                  />
                  {promptMedicine.purpose ? (
                    <Text className="text-3xs text-zinc-500 font-medium flex-1" numberOfLines={1}>
                      Tác dụng: {promptMedicine.purpose}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* 2 Big Action Buttons */}
            <View className="w-full gap-2.5">
              {/* Option 1: Đã uống */}
              <Pressable
                onPress={handleConfirmPromptTaken}
                accessibilityLabel="Xác nhận đã uống thuốc"
                className="w-full flex-row items-center justify-center gap-2 py-4 px-5 rounded-2xl bg-[#2D7A58] shadow-sm shadow-emerald-700/20 active:bg-emerald-800 active:scale-[0.98]"
              >
                <Check size={20} color="#FFFFFF" strokeWidth={2.5} />
                <Text className="text-base font-bold text-white">Đã uống</Text>
              </Pressable>

              {/* Option 2: Nhắc lại sau 10 phút */}
              <Pressable
                onPress={handleConfirmPromptSnooze}
                accessibilityLabel="Hẹn nhắc lại sau 10 phút"
                className="w-full flex-row items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-[#F5F0FF] border border-purple-200/90 active:bg-purple-100 active:scale-[0.98]"
              >
                <Bell size={18} color="#7C3AED" strokeWidth={2.2} />
                <Text className="text-base font-bold text-[#7C3AED]">
                  Nhắc lại sau 10 phút
                </Text>
              </Pressable>

              {/* Close Button */}
              <Pressable
                onPress={() => setIsReminderPromptVisible(false)}
                className="w-full py-2.5 items-center justify-center active:opacity-75"
              >
                <Text className="text-xs font-semibold text-zinc-400">Đóng thông báo</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Medicine Detail Modal bottom sheet */}
      <MedicineDetailModal />
    </SafeAreaView>
  );
}
