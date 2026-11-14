import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Switch,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  User,
  Users,
  Bell,
  LogOut,
  RefreshCcw,
  Plus,
  Check,
  X,
  ShieldCheck,
  CheckCircle2,
  Heart,
  Activity,
  Droplets,
  ShieldAlert,
  Edit3,
  AlertTriangle,
  Phone,
  Sun,
  SunMedium,
  Moon,
  Clock,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Card, Badge, Button, Input } from '@/components/ui';
import { useAuthStore } from '@/store/useAuthStore';
import { useMedStore } from '@/store/useMedStore';
import { FamilyMember, HealthProfile, MealTimes } from '@/types/medlens';
import { sendTestNotificationNow } from '@/services/notifications';

const ITEM_HEIGHT = 44;
const HOURS_LIST = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES_LIST = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const familyMembers = useMedStore((state) => state.familyMembers) || [];
  const addFamilyMember = useMedStore((state) => state.addFamilyMember);
  const updateHealthProfile = useMedStore((state) => state.updateHealthProfile);
  const updateMemberMealTimes = useMedStore((state) => state.updateMemberMealTimes);
  const resetToDemo = useMedStore((state) => state.resetToDemo);
  const mealTimes = useMedStore((state) => state.mealTimes) || { breakfast: '07:00', lunch: '12:00', dinner: '19:00' };
  const setMealTimes = useMedStore((state) => state.setMealTimes);
  const notificationsEnabled = useMedStore((state) => state.notificationsEnabled) ?? true;
  const setNotificationsEnabled = useMedStore((state) => state.setNotificationsEnabled);
  const morningReminderEnabled = useMedStore((state) => state.morningReminderEnabled) ?? true;
  const setMorningReminderEnabled = useMedStore((state) => state.setMorningReminderEnabled);

  // Meal time picker modal state (iOS Wheel Picker)
  const [isMealModalVisible, setIsMealModalVisible] = useState(false);
  const [editingMealKey, setEditingMealKey] = useState<'breakfast' | 'lunch' | 'dinner' | null>(null);
  const [selectedHour, setSelectedHour] = useState(7);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const hourScrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const minuteScrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const currentHourRef = useRef(7);
  const currentMinuteRef = useRef(0);
  const [isTestingNotif, setIsTestingNotif] = useState(false);

  const handleOpenMealPicker = (key: 'breakfast' | 'lunch' | 'dinner') => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setEditingMealKey(key);
    const existing =
      selectedMember?.mealTimes?.[key] ||
      mealTimes[key] ||
      (key === 'breakfast' ? '07:00' : key === 'lunch' ? '12:00' : '19:00');
    let h = 7;
    let m = 0;
    if (existing && existing.includes(':')) {
      const parts = existing.split(':');
      h = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
      if (isNaN(h)) h = 7;
      if (isNaN(m)) m = 0;
    }
    h = Math.max(0, Math.min(23, h));
    m = Math.max(0, Math.min(59, m));
    setSelectedHour(h);
    setSelectedMinute(m);
    currentHourRef.current = h;
    currentMinuteRef.current = m;
    setIsMealModalVisible(true);
  };

  useEffect(() => {
    if (isMealModalVisible) {
      const timer = setTimeout(() => {
        hourScrollRef.current?.scrollTo({ y: currentHourRef.current * ITEM_HEIGHT, animated: false });
        minuteScrollRef.current?.scrollTo({ y: currentMinuteRef.current * ITEM_HEIGHT, animated: false });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isMealModalVisible]);

  const handleSaveMealTime = (timeValue?: string) => {
    if (!editingMealKey) return;
    const timeToSave = (
      timeValue || `${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`
    ).trim();
    if (!timeToSave) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    if (selectedMember && updateMemberMealTimes) {
      updateMemberMealTimes(selectedMember.id, { [editingMealKey]: timeToSave });
      setSelectedMember((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          mealTimes: {
            ...(prev.mealTimes || { breakfast: '07:00', lunch: '12:00', dinner: '19:00' }),
            [editingMealKey]: timeToSave,
          },
        };
      });
      setProfileForm((prev) => ({ ...prev, [editingMealKey]: timeToSave }));
    } else {
      setMealTimes({ [editingMealKey]: timeToSave });
    }

    setIsMealModalVisible(false);
  };

  const handleTestNotification = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setIsTestingNotif(true);
    const sent = await sendTestNotificationNow();
    setIsTestingNotif(false);
    if (sent) {
      Alert.alert(
        'Đã gửi thông báo thử nghiệm',
        'Thông báo sẽ xuất hiện trên màn hình điện thoại của bạn trong 2 giây tới. Hãy kiểm tra thanh thông báo!',
        [{ text: 'Đã hiểu', style: 'default' }]
      );
    } else {
      Alert.alert(
        'Chưa cấp quyền thông báo',
        'Vui lòng bật quyền Thông báo cho ứng dụng MedLens AI trong Cài đặt của thiết bị để nhận nhắc nhở đúng giờ.',
        [{ text: 'Đóng', style: 'default' }]
      );
    }
  };

  const [isAddMemberVisible, setIsAddMemberVisible] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRelation, setNewMemberRelation] = useState('');
  const [newMemberAllergies, setNewMemberAllergies] = useState('');
  const [newMemberMorningTime, setNewMemberMorningTime] = useState('07:30');
  const [newMemberNoonTime, setNewMemberNoonTime] = useState('12:30');
  const [newMemberEveningTime, setNewMemberEveningTime] = useState('20:00');

  // Health Profile Sheet State
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<{
    breakfast: string;
    lunch: string;
    dinner: string;
    chronicConditions: string;
    allergies: string;
    doctorNotes: string;
  }>({
    breakfast: '07:00',
    lunch: '12:00',
    dinner: '19:00',
    chronicConditions: '',
    allergies: '',
    doctorNotes: '',
  });

  const handleBack = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    router.back();
  };

  const handleResetDemo = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    resetToDemo();
    setSelectedMember(null);
    Alert.alert(
      'Khôi phục Demo',
      'Đã làm mới dữ liệu lịch uống, tủ thuốc và gia đình về trạng thái mặc định.',
      [{ text: 'Xong', style: 'default' }]
    );
  };

  const handleLogout = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/');
          },
        },
      ]
    );
  };

  const handleSaveMember = () => {
    if (!newMemberName.trim()) {
      Alert.alert('Chưa có tên', 'Vui lòng nhập tên thành viên gia đình.');
      return;
    }
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    const allergiesList = newMemberAllergies.trim()
      ? [newMemberAllergies.trim()]
      : ['Chưa ghi nhận dị ứng thuốc'];

    const memberMealTimes: MealTimes = {
      breakfast: newMemberMorningTime.trim() || '07:30',
      lunch: newMemberNoonTime.trim() || '12:30',
      dinner: newMemberEveningTime.trim() || '20:00',
    };

    const memberHealthProfile: HealthProfile = {
      bloodType: 'Chưa rõ',
      dobYear: 1995,
      gender: 'Khác',
      chronicConditions: [],
      allergies: allergiesList,
      metrics: {},
      doctorNotes: 'Hồ sơ thành viên gia đình.',
    };

    addFamilyMember(
      newMemberName.trim(),
      newMemberRelation.trim() || 'Thành viên',
      memberHealthProfile,
      memberMealTimes
    );

    setNewMemberName('');
    setNewMemberRelation('');
    setNewMemberAllergies('');
    setNewMemberMorningTime('07:30');
    setNewMemberNoonTime('12:30');
    setNewMemberEveningTime('20:00');
    setIsAddMemberVisible(false);
  };

  // Open Health Profile Modal for a specific member
  const handleOpenHealthProfile = (member: FamilyMember) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedMember(member);
    setIsEditingProfile(false);

    const profile = member.healthProfile;
    const memberMeal = member.mealTimes || { breakfast: '07:00', lunch: '12:00', dinner: '19:00' };
    setProfileForm({
      breakfast: memberMeal.breakfast || '07:00',
      lunch: memberMeal.lunch || '12:00',
      dinner: memberMeal.dinner || '19:00',
      chronicConditions: (profile?.chronicConditions || []).join(', '),
      allergies: (profile?.allergies || []).join(', '),
      doctorNotes: profile?.doctorNotes || '',
    });
  };

  const handleSaveHealthProfile = () => {
    if (!selectedMember) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    const updatedProfile: Partial<HealthProfile> = {
      chronicConditions: profileForm.chronicConditions
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      allergies: profileForm.allergies
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      doctorNotes: profileForm.doctorNotes.trim(),
    };

    const updatedMealTimes: MealTimes = {
      breakfast: profileForm.breakfast.trim() || '07:00',
      lunch: profileForm.lunch.trim() || '12:00',
      dinner: profileForm.dinner.trim() || '19:00',
    };

    updateHealthProfile(selectedMember.id, updatedProfile);
    if (updateMemberMealTimes) {
      updateMemberMealTimes(selectedMember.id, updatedMealTimes);
    }

    // Update current selected member locally
    setSelectedMember((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        mealTimes: updatedMealTimes,
        healthProfile: {
          ...(prev.healthProfile || { chronicConditions: [], allergies: [] }),
          ...updatedProfile,
        },
      };
    });

    setIsEditingProfile(false);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} className="flex-1 bg-[#F2F2F7]">
      <StatusBar style="dark" />

      {/* Header: < Quay lại, Center Avatar, Right Settings Icon */}
      <View className="px-4 py-2.5 flex-row items-center justify-between border-b border-slate-200/60 bg-[#F2F2F7]">
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          className="flex-row items-center gap-1 py-1 pr-2 active:opacity-60"
        >
          <ChevronLeft size={24} color="#2563EB" />
          <Text className="text-base font-semibold text-blue-600">Quay lại</Text>
        </Pressable>

        {/* Center Large Avatar */}
        <View className="size-11 rounded-full bg-blue-100 border-2 border-white items-center justify-center shadow-sm">
          <User size={22} color="#2563EB" />
        </View>

        {/* Right Spacer for balance (removed gear icon) */}
        <View className="w-16" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
      >
        {/* User Info Header */}
        <View className="items-center mb-6">
          <Text className="text-xl font-bold text-zinc-900">{user.name || 'Tâm'}</Text>
          <Text className="text-xs text-zinc-500 mt-0.5">Trụ cột gia đình • {user.email || 'tam.family@medlens.ai'}</Text>
        </View>

        {/* ========================================================= */}
        {/* MỤC 1: GIA ĐÌNH & HỒ SƠ SỨC KHỎE                           */}
        {/* ========================================================= */}
        <View className="flex-row items-center justify-between px-3 mb-2">
          <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            GIA ĐÌNH & HỒ SƠ SỨC KHỎE
          </Text>
          <Text className="text-3xs font-medium text-slate-400">Chạm để xem hồ sơ</Text>
        </View>

        <View className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-2xs mb-6">
          {familyMembers.map((member, idx) => {
            const profile = member.healthProfile;
            const conditionCount = profile?.chronicConditions?.length || 0;
            const allergyCount = profile?.allergies?.length || 0;

            return (
              <Pressable
                key={member.id}
                onPress={() => handleOpenHealthProfile(member)}
                className={`flex-row items-center justify-between p-4 active:bg-slate-50 ${
                  idx < familyMembers.length - 1 ? 'border-b border-slate-100' : ''
                }`}
              >
                <View className="flex-row items-center gap-3 flex-1 pr-2">
                  <View
                    className="size-11 rounded-2xl items-center justify-center shadow-2xs"
                    style={{ backgroundColor: member.avatarColor || '#2563EB' }}
                  >
                    <Text className="text-sm font-bold text-white">{member.name.charAt(0)}</Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <Text className="text-sm font-bold text-zinc-900">
                        {member.name}
                      </Text>
                      <Badge
                        label={member.role === 'caregiver' ? 'Chăm sóc' : 'Người bệnh'}
                        variant={member.role === 'caregiver' ? 'purple' : 'primary'}
                      />
                      {profile?.bloodType && (
                        <Badge label={profile.bloodType} variant="default" />
                      )}
                    </View>
                    <Text className="text-2xs text-zinc-500 mt-0.5">
                      {member.relation} • {conditionCount > 0 ? `${conditionCount} bệnh nền` : 'Chưa có bệnh nền'} •{' '}
                      {allergyCount > 0 ? `${allergyCount} dị ứng` : '0 dị ứng'}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={18} color="#94A3B8" />
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => setIsAddMemberVisible(true)}
            className="flex-row items-center justify-center gap-1.5 py-3.5 border-t border-slate-100 active:bg-slate-50"
          >
            <Plus size={15} color="#2563EB" strokeWidth={2.5} />
            <Text className="text-xs font-bold text-blue-600">Thêm người thân</Text>
          </Pressable>
        </View>

        {/* ========================================================= */}
        {/* MỤC 2: THÔNG BÁO NHẮC UỐNG THUỐC                          */}
        {/* ========================================================= */}
        <View className="flex-row items-center justify-between px-3 mb-2">
          <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            THÔNG BÁO NHẮC UỐNG THUỐC
          </Text>
          <Text className="text-3xs font-medium text-slate-400">Thông báo trực tiếp</Text>
        </View>

        <View className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-2xs mb-6">
          {/* Switch 1: Nhắc từng liều */}
          <View className="flex-row items-center justify-between p-4 border-b border-slate-100">
            <View className="flex-row items-center gap-3 flex-1 pr-3">
              <View className="size-9 rounded-2xl items-center justify-center bg-blue-50">
                <Bell size={18} color="#2563EB" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-zinc-900">Thông báo từng liều thuốc</Text>
                <Text className="text-2xs text-zinc-500 mt-0.5">
                  Nhắc chuông và rung máy đúng giờ các cữ Sáng, Trưa, Tối
                </Text>
              </View>
            </View>
            <Switch
              trackColor={{ false: '#E2E8F0', true: '#2563EB' }}
              ios_backgroundColor="#E2E8F0"
              value={notificationsEnabled}
              onValueChange={(val) => {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch {}
                setNotificationsEnabled(val);
              }}
            />
          </View>

          {/* Switch 2: Nhắc mang thuốc buổi sáng */}
          <View className="flex-row items-center justify-between p-4 border-b border-slate-100">
            <View className="flex-row items-center gap-3 flex-1 pr-3">
              <View className="size-9 rounded-2xl items-center justify-center bg-amber-50">
                <Sparkles size={18} color="#D97706" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-zinc-900">Nhắc mang thuốc đi buổi sáng</Text>
                <Text className="text-2xs text-zinc-500 mt-0.5">
                  Báo lúc 07:15 nhắc kiểm tra mang theo thuốc cữ trưa đi làm/đi học
                </Text>
              </View>
            </View>
            <Switch
              trackColor={{ false: '#E2E8F0', true: '#2563EB' }}
              ios_backgroundColor="#E2E8F0"
              value={morningReminderEnabled}
              onValueChange={(val) => {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch {}
                setMorningReminderEnabled(val);
              }}
            />
          </View>

          {/* Action Row 3: Bắn thử nghiệm */}
          <Pressable
            onPress={handleTestNotification}
            disabled={isTestingNotif}
            className="flex-row items-center justify-between p-4 active:bg-blue-50/50"
          >
            <View className="flex-row items-center gap-3 flex-1 pr-3">
              <View className="size-9 rounded-2xl items-center justify-center bg-slate-100">
                <Clock size={18} color="#475569" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-zinc-900">Bắn thông báo thử nghiệm</Text>
                <Text className="text-2xs text-zinc-500 mt-0.5">
                  Gửi ngay 1 thông báo sau 2 giây để kiểm tra chuông & rung
                </Text>
              </View>
            </View>
            <View className="px-3 py-1.5 rounded-xl bg-blue-600 active:bg-blue-700">
              <Text className="text-xs font-semibold text-white">Thử ngay</Text>
            </View>
          </Pressable>
        </View>

        {/* ========================================================= */}
        {/* MỤC 4: THÔNG TIN ỨNG DỤNG (CHỈ HIỆN PHIÊN BẢN)             */}
        {/* ========================================================= */}
        <View className="flex-row items-center justify-between px-3 mb-2">
          <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            THÔNG TIN ỨNG DỤNG
          </Text>
        </View>

        <View className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-2xs mb-6">
          <View className="flex-row items-center justify-between p-4">
            <View className="flex-row items-center gap-3">
              <Image
                source={require('@/assets/images/icon.png')}
                className="size-11 rounded-2xl border border-slate-100"
                resizeMode="cover"
              />
              <View>
                <Text className="text-sm font-bold text-zinc-900">MedLens AI</Text>
                <Text className="text-2xs text-zinc-400 font-medium">Phiên bản 1.0.0</Text>
              </View>
            </View>
            <Badge label="Chính thức" variant="primary" />
          </View>
        </View>

        {/* Khôi phục demo */}
        <Pressable
          onPress={handleResetDemo}
          className="flex-row items-center justify-center gap-2 p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs mb-6 active:scale-98"
        >
          <RefreshCcw size={16} color="#2563EB" />
          <Text className="text-sm font-bold text-blue-600">Khôi phục trạng thái Demo</Text>
        </Pressable>

        {/* ========================================================= */}
        {/* NÚT ĐĂNG XUẤT (CAM / ĐỎ Ở ĐÁY)                           */}
        {/* ========================================================= */}
        <Pressable
          onPress={handleLogout}
          className="flex-row items-center justify-center gap-2 rounded-2xl bg-[#EA580C] py-3.5 px-6 shadow-sm active:scale-98 active:opacity-90"
        >
          <LogOut size={18} color="#FFFFFF" />
          <Text className="text-base font-bold text-white">Đăng xuất</Text>
        </Pressable>
      </ScrollView>

      {/* ========================================================= */}
      {/* MODAL: HỒ SƠ SỨC KHỎE CHI TIẾT (XEM & CHỈNH SỬA)         */}
      {/* ========================================================= */}
      <Modal
        visible={Boolean(selectedMember)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedMember(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <Pressable
            className="flex-1 bg-black/40 justify-end"
            onPress={() => {
              Keyboard.dismiss();
              setSelectedMember(null);
            }}
          >
            <Pressable
              className="bg-white rounded-t-3xl p-5 border-t border-slate-200 max-h-[90%]"
              onPress={(e) => e.stopPropagation()}
            >
              {/* Grabber pill */}
              <View className="w-12 h-1.5 rounded-full bg-slate-300 self-center mb-3" />

              {/* Header: Member Avatar, Name, Edit / View Toggle, Close */}
              <View className="flex-row items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <View className="flex-row items-center gap-3 flex-1 pr-2">
                  <View
                    className="size-12 rounded-2xl items-center justify-center shadow-xs"
                    style={{ backgroundColor: selectedMember?.avatarColor || '#2563EB' }}
                  >
                    <Text className="text-lg font-bold text-white">
                      {selectedMember?.name?.charAt(0)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5 flex-wrap">
                      <Text className="text-lg font-bold text-zinc-900" numberOfLines={1}>
                        {selectedMember?.name}
                      </Text>
                      <Badge
                        label={selectedMember?.role === 'caregiver' ? 'Người chăm sóc' : 'Người bệnh'}
                        variant={selectedMember?.role === 'caregiver' ? 'purple' : 'primary'}
                      />
                    </View>
                    <Text className="text-xs text-zinc-500">
                      {selectedMember?.relation} • Hồ sơ sức khỏe cá nhân
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center gap-2">
                  <Pressable
                    onPress={() => {
                      try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      } catch {}
                      setIsEditingProfile(!isEditingProfile);
                    }}
                    className="p-2 rounded-xl bg-blue-50 border border-blue-100 flex-row items-center gap-1 active:bg-blue-100"
                  >
                    <Edit3 size={14} color="#2563EB" />
                    <Text className="text-xs font-bold text-blue-600">
                      {isEditingProfile ? 'Xem' : 'Sửa'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setSelectedMember(null)}
                    className="size-8 items-center justify-center rounded-full bg-slate-100 active:bg-slate-200"
                  >
                    <X size={16} color="#64748B" />
                  </Pressable>
                </View>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 24 }}
                className="gap-4"
              >
              {/* --------------------------------------------------- */}
              {/* CHẾ ĐỘ 1: XEM HỒ SƠ SỨC KHỎE                       */}
              {/* --------------------------------------------------- */}
              {!isEditingProfile ? (
                <View className="gap-3.5 pb-6">
                  {/* Card 1: Giờ uống thuốc & Bữa ăn riêng từng thành viên */}
                  <Card className="p-4 bg-slate-50 border border-slate-200/70">
                    <View className="flex-row items-center justify-between mb-2.5">
                      <Text className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                        GIỜ UỐNG THUỐC & BỮA ĂN (RIÊNG TỪNG THÀNH VIÊN)
                      </Text>
                      <Pressable
                        onPress={() => setIsEditingProfile(true)}
                        className="px-2 py-0.5 rounded-lg bg-blue-100 active:bg-blue-200"
                      >
                        <Text className="text-3xs font-semibold text-blue-700">Đổi giờ</Text>
                      </Pressable>
                    </View>

                    <View className="gap-2">
                      {/* Bữa sáng */}
                      <Pressable
                        onPress={() => handleOpenMealPicker('breakfast')}
                        className="flex-row items-center justify-between p-3 rounded-2xl bg-white border border-slate-200/70 active:bg-slate-50"
                      >
                        <View className="flex-row items-center gap-2.5">
                          <View className="size-8 rounded-xl bg-amber-50 items-center justify-center">
                            <Sun size={16} color="#D97706" />
                          </View>
                          <View>
                            <Text className="text-xs font-bold text-zinc-800">Cữ sáng</Text>
                            <Text className="text-3xs text-zinc-400">Gắn với bữa ăn sáng</Text>
                          </View>
                        </View>
                        <Badge
                          label={selectedMember?.mealTimes?.breakfast || '07:00'}
                          variant="primary"
                        />
                      </Pressable>

                      {/* Bữa trưa */}
                      <Pressable
                        onPress={() => handleOpenMealPicker('lunch')}
                        className="flex-row items-center justify-between p-3 rounded-2xl bg-white border border-slate-200/70 active:bg-slate-50"
                      >
                        <View className="flex-row items-center gap-2.5">
                          <View className="size-8 rounded-xl bg-orange-50 items-center justify-center">
                            <SunMedium size={16} color="#EA580C" />
                          </View>
                          <View>
                            <Text className="text-xs font-bold text-zinc-800">Cữ trưa</Text>
                            <Text className="text-3xs text-zinc-400">Gắn với bữa ăn trưa</Text>
                          </View>
                        </View>
                        <Badge
                          label={selectedMember?.mealTimes?.lunch || '12:00'}
                          variant="primary"
                        />
                      </Pressable>

                      {/* Bữa tối */}
                      <Pressable
                        onPress={() => handleOpenMealPicker('dinner')}
                        className="flex-row items-center justify-between p-3 rounded-2xl bg-white border border-slate-200/70 active:bg-slate-50"
                      >
                        <View className="flex-row items-center gap-2.5">
                          <View className="size-8 rounded-xl bg-indigo-50 items-center justify-center">
                            <Moon size={16} color="#4F46E5" />
                          </View>
                          <View>
                            <Text className="text-xs font-bold text-zinc-800">Cữ tối</Text>
                            <Text className="text-3xs text-zinc-400">Gắn với bữa ăn tối</Text>
                          </View>
                        </View>
                        <Badge
                          label={selectedMember?.mealTimes?.dinner || '19:00'}
                          variant="primary"
                        />
                      </Pressable>
                    </View>
                  </Card>

                  {/* Card 2: Bệnh lý nền & Tiền sử mãn tính */}
                  <Card className="p-4 bg-white border border-slate-200/80">
                    <Text className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                      BỆNH LÝ NỀN & MÃN TÍNH
                    </Text>
                    {selectedMember?.healthProfile?.chronicConditions &&
                    selectedMember.healthProfile.chronicConditions.length > 0 ? (
                      <View className="flex-row flex-wrap gap-2">
                        {selectedMember.healthProfile.chronicConditions.map((condition, cIdx) => (
                          <Badge key={cIdx} label={condition} variant="primary" />
                        ))}
                      </View>
                    ) : (
                      <Text className="text-xs text-zinc-400 italic">
                        Chưa ghi nhận bệnh nền mãn tính nào.
                      </Text>
                    )}
                  </Card>

                  {/* Card 3: Tiền sử Dị Ứng Thuốc & Chống Chỉ Định (An Toàn Y Tế) */}
                  <Card className="p-4 bg-red-50/60 border border-red-200">
                    <View className="flex-row items-center gap-1.5 mb-2">
                      <ShieldAlert size={16} color="#DC2626" />
                      <Text className="text-xs font-bold uppercase tracking-wider text-red-900">
                        TIỀN SỬ DỊ ỨNG THUỐC & CHỐNG CHỈ ĐỊNH
                      </Text>
                    </View>
                    {selectedMember?.healthProfile?.allergies &&
                    selectedMember.healthProfile.allergies.length > 0 ? (
                      <View className="flex-row flex-wrap gap-2 mb-2">
                        {selectedMember.healthProfile.allergies.map((allergy, aIdx) => (
                          <Badge key={aIdx} label={allergy} variant="danger" />
                        ))}
                      </View>
                    ) : (
                      <Text className="text-xs text-emerald-700 font-semibold mb-2">
                        ✓ Chưa ghi nhận dị ứng thuốc
                      </Text>
                    )}
                    <Text className="text-3xs text-red-700/80 leading-relaxed">
                      💡 Trợ lý AI Vision sẽ tự động đối soát thông tin này khi quét đơn thuốc mới để bảo vệ an toàn tối đa cho người bệnh.
                    </Text>
                  </Card>

                  {/* Card 4: Lời dặn Bác Sĩ & Hướng Dẫn Điều Trị */}
                  <Card className="p-4 bg-white border border-slate-200/80">
                    <Text className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      LỜI DẶN BÁC SĨ & ĐIỀU TRỊ
                    </Text>
                    <Text className="text-xs text-zinc-700 leading-relaxed">
                      {selectedMember?.healthProfile?.doctorNotes ||
                        'Duy trì uống thuốc đúng cữ, ăn nhạt, vận động nhẹ nhàng và tái khám định kỳ.'}
                    </Text>
                  </Card>
                </View>
              ) : (
                /* --------------------------------------------------- */
                /* CHẾ ĐỘ 2: CHỈNH SỬA HỒ SƠ SỨC KHỎE                 */
                /* --------------------------------------------------- */
                <View className="gap-3 pb-6">
                  {/* Cài đặt giờ bữa ăn / cữ uống riêng của thành viên */}
                  <View className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 gap-2.5">
                    <Text className="text-xs font-bold text-blue-900 uppercase">
                      Giờ cữ uống thuốc riêng của {selectedMember?.name}
                    </Text>
                    <View className="flex-row gap-2">
                      <View className="flex-1">
                        <Input
                          label="Cữ Sáng"
                          placeholder="07:00"
                          value={profileForm.breakfast}
                          onChangeText={(val) => setProfileForm((prev) => ({ ...prev, breakfast: val }))}
                        />
                      </View>
                      <View className="flex-1">
                        <Input
                          label="Cữ Trưa"
                          placeholder="12:00"
                          value={profileForm.lunch}
                          onChangeText={(val) => setProfileForm((prev) => ({ ...prev, lunch: val }))}
                        />
                      </View>
                      <View className="flex-1">
                        <Input
                          label="Cữ Tối"
                          placeholder="19:00"
                          value={profileForm.dinner}
                          onChangeText={(val) => setProfileForm((prev) => ({ ...prev, dinner: val }))}
                        />
                      </View>
                    </View>
                  </View>

                  <Input
                    label="Bệnh lý nền (phân cách bởi dấu phẩy)"
                    placeholder="VD: Tăng huyết áp độ 2, Đái tháo đường..."
                    value={profileForm.chronicConditions}
                    onChangeText={(val) =>
                      setProfileForm((prev) => ({ ...prev, chronicConditions: val }))
                    }
                  />

                  <Input
                    label="Dị ứng thuốc & Chống chỉ định (phân cách bởi dấu phẩy)"
                    placeholder="VD: Dị ứng Penicillin, Nhạy cảm Aspirin..."
                    value={profileForm.allergies}
                    onChangeText={(val) => setProfileForm((prev) => ({ ...prev, allergies: val }))}
                  />

                  <Input
                    label="Lời dặn bác sĩ điều trị"
                    placeholder="VD: Uống sau ăn sáng, tái khám mỗi 3 tháng..."
                    value={profileForm.doctorNotes}
                    onChangeText={(val) =>
                      setProfileForm((prev) => ({ ...prev, doctorNotes: val }))
                    }
                  />

                  <View className="pt-2 flex-row gap-2">
                    <View className="flex-1">
                      <Button
                        title="Lưu Hồ Sơ Sức Khỏe"
                        variant="primary"
                        onPress={handleSaveHealthProfile}
                        icon={<CheckCircle2 size={18} color="#FFFFFF" />}
                      />
                    </View>
                    <View className="w-24">
                      <Button
                        title="Hủy"
                        variant="secondary"
                        onPress={() => setIsEditingProfile(false)}
                      />
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Thêm Thành Viên Mới */}
      <Modal
        visible={isAddMemberVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddMemberVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <Pressable
            className="flex-1 bg-black/40 justify-end"
            onPress={() => {
              Keyboard.dismiss();
              setIsAddMemberVisible(false);
            }}
          >
            <Pressable
              className="bg-white rounded-t-3xl p-5 border-t border-slate-200"
              onPress={(e) => e.stopPropagation()}
            >
              <View className="w-12 h-1.5 rounded-full bg-slate-300 self-center mb-3" />
              <View className="flex-row items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <Text className="text-base font-bold text-zinc-900">Thêm Thành Viên Gia Đình</Text>
                <Pressable
                  onPress={() => setIsAddMemberVisible(false)}
                  className="size-7 items-center justify-center rounded-full bg-slate-100"
                >
                  <X size={15} color="#64748B" />
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 16 }}
              >
                <View className="gap-3.5 mb-5">
                  <Input
                    label="Họ và tên *"
                    placeholder="VD: Bố, Mẹ, Con trai..."
                    value={newMemberName}
                    onChangeText={setNewMemberName}
                  />
                  <Input
                    label="Quan hệ / Tuổi"
                    placeholder="VD: Bố - 65 tuổi, Con - 8 tuổi..."
                    value={newMemberRelation}
                    onChangeText={setNewMemberRelation}
                  />
                  <Input
                    label="Kỵ thuốc / Dị ứng thuốc (Tự điền nếu cần)"
                    placeholder="VD: Dị ứng Penicillin, Aspirin, Sulfamide..."
                    value={newMemberAllergies}
                    onChangeText={setNewMemberAllergies}
                  />

                  {/* Giờ uống thuốc cụ thể từng cữ */}
                  <View className="gap-1.5 mt-1">
                    <Text className="text-xs font-bold uppercase tracking-wider text-zinc-600 px-1">
                      Giờ uống thuốc cụ thể từng cữ:
                    </Text>
                    <View className="flex-row gap-2">
                      <View className="flex-1">
                        <Input
                          label="Cữ Sáng"
                          placeholder="07:30"
                          value={newMemberMorningTime}
                          onChangeText={setNewMemberMorningTime}
                        />
                      </View>
                      <View className="flex-1">
                        <Input
                          label="Cữ Trưa"
                          placeholder="12:30"
                          value={newMemberNoonTime}
                          onChangeText={setNewMemberNoonTime}
                        />
                      </View>
                      <View className="flex-1">
                        <Input
                          label="Cữ Tối"
                          placeholder="20:00"
                          value={newMemberEveningTime}
                          onChangeText={setNewMemberEveningTime}
                        />
                      </View>
                    </View>
                  </View>
                </View>

                <Button
                  title="Lưu Thành Viên"
                  variant="primary"
                  onPress={handleSaveMember}
                  icon={<CheckCircle2 size={18} color="#FFFFFF" />}
                />
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Chỉnh Giờ Bữa Ăn (iOS Native Timer Wheel Picker) */}
      <Modal
        visible={isMealModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsMealModalVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/40 justify-end"
          onPress={() => setIsMealModalVisible(false)}
        >
          <Pressable
            className="bg-white rounded-t-3xl border-t border-slate-200 overflow-hidden"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Grab handle */}
            <View className="w-10 h-1 rounded-full bg-slate-300 self-center mt-3 mb-1" />

            {/* Apple Modal Header */}
            <View className="flex-row items-center justify-between px-5 py-3 border-b border-slate-100">
              <Pressable
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                  setIsMealModalVisible(false);
                }}
                className="py-1 px-2 -ml-2"
              >
                <Text className="text-base font-normal text-slate-500">Hủy</Text>
              </Pressable>

              <View className="items-center">
                <Text className="text-base font-bold text-zinc-900">
                  {editingMealKey === 'breakfast'
                    ? 'Giờ Bữa Sáng'
                    : editingMealKey === 'lunch'
                    ? 'Giờ Bữa Trưa'
                    : 'Giờ Bữa Tối'}
                </Text>
                <Text className="text-3xs text-zinc-400">
                  Đồng bộ cữ {editingMealKey === 'breakfast' ? 'Sáng' : editingMealKey === 'lunch' ? 'Trưa' : 'Tối'}
                </Text>
              </View>

              <Pressable
                onPress={() => handleSaveMealTime()}
                className="py-1 px-2 -mr-2 active:opacity-60"
              >
                <Text className="text-base font-bold text-blue-600">Xong</Text>
              </Pressable>
            </View>

            {/* iOS Drum Wheel Container (220px total height, 44px item height) */}
            <View className="relative h-[220px] bg-slate-50/70 overflow-hidden">
              {/* Center Selection Lens */}
              <View
                pointerEvents="none"
                className="absolute left-6 right-6 top-[88px] h-[44px] rounded-2xl bg-slate-200/60 border-y border-slate-300/60 flex-row items-center justify-around px-8 z-0"
              >
                <View className="flex-row items-center gap-1 w-24 justify-end pr-2">
                  <Text className="text-xs font-bold text-zinc-500">giờ</Text>
                </View>
                <View className="flex-row items-center gap-1 w-24 justify-end pr-2">
                  <Text className="text-xs font-bold text-zinc-500">phút</Text>
                </View>
              </View>

              {/* Two Wheel Columns */}
              <View className="flex-row h-full px-6 z-10">
                {/* Column 1: Giờ (Hours 00 - 23) */}
                <View className="flex-1 items-center">
                  <ScrollView
                    ref={hourScrollRef}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={ITEM_HEIGHT}
                    snapToAlignment="center"
                    decelerationRate="fast"
                    scrollEventThrottle={16}
                    contentContainerStyle={{ paddingVertical: 88 }}
                    onScroll={(e) => {
                      const y = e.nativeEvent.contentOffset.y;
                      const idx = Math.max(0, Math.min(23, Math.round(y / ITEM_HEIGHT)));
                      if (idx !== currentHourRef.current) {
                        currentHourRef.current = idx;
                        setSelectedHour(idx);
                        try {
                          Haptics.selectionAsync();
                        } catch {}
                      }
                    }}
                    onMomentumScrollEnd={(e) => {
                      const y = e.nativeEvent.contentOffset.y;
                      const idx = Math.max(0, Math.min(23, Math.round(y / ITEM_HEIGHT)));
                      setSelectedHour(idx);
                    }}
                  >
                    {HOURS_LIST.map((h, index) => {
                      const diff = Math.abs(index - selectedHour);
                      const isSelected = diff === 0;
                      return (
                        <Pressable
                          key={h}
                          onPress={() => {
                            setSelectedHour(index);
                            currentHourRef.current = index;
                            hourScrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
                            try {
                              Haptics.selectionAsync();
                            } catch {}
                          }}
                          className="h-[44px] justify-center items-center w-28"
                        >
                          <Text
                            className={`tracking-tight ${
                              isSelected
                                ? 'text-2xl font-bold text-zinc-900 scale-105'
                                : diff === 1
                                ? 'text-xl font-semibold text-zinc-400'
                                : 'text-base font-normal text-zinc-300'
                            }`}
                          >
                            {h}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Column Separator Colon */}
                <View className="justify-center items-center h-full px-1">
                  <Text className="text-2xl font-bold text-zinc-400 pb-1">:</Text>
                </View>

                {/* Column 2: Phút (Minutes 00 - 59) */}
                <View className="flex-1 items-center">
                  <ScrollView
                    ref={minuteScrollRef}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={ITEM_HEIGHT}
                    snapToAlignment="center"
                    decelerationRate="fast"
                    scrollEventThrottle={16}
                    contentContainerStyle={{ paddingVertical: 88 }}
                    onScroll={(e) => {
                      const y = e.nativeEvent.contentOffset.y;
                      const idx = Math.max(0, Math.min(59, Math.round(y / ITEM_HEIGHT)));
                      if (idx !== currentMinuteRef.current) {
                        currentMinuteRef.current = idx;
                        setSelectedMinute(idx);
                        try {
                          Haptics.selectionAsync();
                        } catch {}
                      }
                    }}
                    onMomentumScrollEnd={(e) => {
                      const y = e.nativeEvent.contentOffset.y;
                      const idx = Math.max(0, Math.min(59, Math.round(y / ITEM_HEIGHT)));
                      setSelectedMinute(idx);
                    }}
                  >
                    {MINUTES_LIST.map((m, index) => {
                      const diff = Math.abs(index - selectedMinute);
                      const isSelected = diff === 0;
                      return (
                        <Pressable
                          key={m}
                          onPress={() => {
                            setSelectedMinute(index);
                            currentMinuteRef.current = index;
                            minuteScrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
                            try {
                              Haptics.selectionAsync();
                            } catch {}
                          }}
                          className="h-[44px] justify-center items-center w-28"
                        >
                          <Text
                            className={`tracking-tight ${
                              isSelected
                                ? 'text-2xl font-bold text-zinc-900 scale-105'
                                : diff === 1
                                ? 'text-xl font-semibold text-zinc-400'
                                : 'text-base font-normal text-zinc-300'
                            }`}
                          >
                            {m}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>

              {/* Top & Bottom Cylinder Gradient Masks */}
              <View
                pointerEvents="none"
                className="absolute top-0 left-0 right-0 h-16 bg-white/70 z-20"
              />
              <View
                pointerEvents="none"
                className="absolute bottom-0 left-0 right-0 h-16 bg-white/70 z-20"
              />
            </View>

            {/* Bottom Section: Quick Presets & Primary CTA Button */}
            <View className="p-5 pt-3 bg-white">
              <Text className="text-3xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Gợi ý nhanh
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {(editingMealKey === 'breakfast'
                  ? ['06:30', '07:00', '07:30', '08:00']
                  : editingMealKey === 'lunch'
                  ? ['11:30', '12:00', '12:30', '13:00']
                  : ['18:30', '19:00', '19:30', '20:00']
                ).map((t) => {
                  const currentStr = `${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
                  const isSelected = currentStr === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => {
                        const parts = t.split(':');
                        const h = parseInt(parts[0], 10);
                        const m = parseInt(parts[1], 10);
                        setSelectedHour(h);
                        setSelectedMinute(m);
                        currentHourRef.current = h;
                        currentMinuteRef.current = m;
                        hourScrollRef.current?.scrollTo({ y: h * ITEM_HEIGHT, animated: true });
                        minuteScrollRef.current?.scrollTo({ y: m * ITEM_HEIGHT, animated: true });
                        try {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } catch {}
                      }}
                      className={`px-3.5 py-2 rounded-2xl border active:scale-95 ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          isSelected ? 'text-white' : 'text-zinc-800'
                        }`}
                      >
                        {t}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Button
                title={`Lưu Giờ Ăn (${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')})`}
                variant="primary"
                onPress={() => handleSaveMealTime()}
                icon={<CheckCircle2 size={18} color="#FFFFFF" />}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

