import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Alert,
} from 'react-native';
import {
  X,
  AlertTriangle,
  Activity,
  Pill,
  Calendar,
  Edit3,
  Trash2,
  Plus,
  Minus,
  Check,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useMedStore } from '@/store/useMedStore';
import { Medicine } from '@/types/medlens';
import { Card, Badge, Button, Input, BadgeVariant } from '@/components/ui';

interface MedicineDetailModalProps {
  medicine?: Medicine | null;
  visible?: boolean;
  onClose?: () => void;
  onUpdate?: (updated: Medicine) => void;
}

export function MedicineDetailModal({
  medicine: propMedicine,
  visible: propVisible,
  onClose,
  onUpdate,
}: MedicineDetailModalProps) {
  const storeMedicine = useMedStore((state) => state.selectedMedicine);
  const setSelectedMedicine = useMedStore((state) => state.setSelectedMedicine);
  const updateMedicine = useMedStore((state) => state.updateMedicine);
  const removeMedicineFromCabinet = useMedStore((state) => state.removeMedicineFromCabinet);

  const activeMedicine = propMedicine !== undefined ? propMedicine : storeMedicine;
  const isVisible = propVisible !== undefined ? propVisible : Boolean(activeMedicine);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [editRemainingCount, setEditRemainingCount] = useState('20');
  const [editPurpose, setEditPurpose] = useState('');
  const [editDosage, setEditDosage] = useState('');

  useEffect(() => {
    if (activeMedicine) {
      setEditName(activeMedicine.name || '');
      setEditExpiryDate(activeMedicine.expiryDate || '');
      setEditRemainingCount(String(activeMedicine.remainingCount ?? 20));
      setEditPurpose(activeMedicine.purpose || '');
      setEditDosage(activeMedicine.dosage || '1 viên');
      setIsEditing(false);
    }
  }, [
    activeMedicine?.id,
    activeMedicine?.name,
    activeMedicine?.expiryDate,
    activeMedicine?.remainingCount,
    activeMedicine?.purpose,
    activeMedicine?.dosage,
  ]);

  if (!activeMedicine) {
    return null;
  }

  const handleClose = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    if (onClose) {
      onClose();
    } else {
      setSelectedMedicine(null);
    }
  };

  const handleStepperChange = (delta: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const current = parseInt(editRemainingCount, 10) || 0;
    const nextVal = Math.max(0, current + delta);
    setEditRemainingCount(String(nextVal));

    // Update store immediately if not in edit mode
    if (!isEditing) {
      updateMedicine(activeMedicine.id, {
        remainingCount: nextVal,
      });
    }
  };

  const handleDeleteMedicine = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {}

    Alert.alert(
      'Xác Nhận Xóa Thuốc',
      `Bạn có chắc chắn muốn xóa thuốc "${activeMedicine.name}" khỏi Tủ Thuốc Gia Đình không?\n\nThao tác này không thể hoàn tác.`,
      [
        {
          text: 'Hủy',
          style: 'cancel',
        },
        {
          text: 'Xóa thuốc',
          style: 'destructive',
          onPress: () => {
            removeMedicineFromCabinet(activeMedicine.id);
            handleClose();
          },
        },
      ]
    );
  };

  const handleSaveUpdate = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    const cleanName = editName.trim() || activeMedicine.name;
    const cleanExpiry = editExpiryDate.trim() ? editExpiryDate.trim() : null;
    const cleanCount = parseInt(editRemainingCount, 10);
    const cleanPurpose = editPurpose.trim() || activeMedicine.purpose;
    const cleanDosage = editDosage.trim() || activeMedicine.dosage;

    const updatedData: Medicine = {
      ...activeMedicine,
      name: cleanName,
      expiryDate: cleanExpiry,
      remainingCount: isNaN(cleanCount) ? 20 : cleanCount,
      purpose: cleanPurpose,
      dosage: cleanDosage,
    };

    updateMedicine(activeMedicine.id, updatedData);

    if (onUpdate) {
      onUpdate(updatedData);
    }

    setIsEditing(false);
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

  const getCategoryVariant = (category: string): BadgeVariant => {
    const cat = category.toLowerCase();
    if (cat.includes('pressure') || cat.includes('huyết áp')) return 'primary';
    if (cat.includes('stomach') || cat.includes('dạ dày')) return 'warning';
    if (cat.includes('diabetes') || cat.includes('tiểu đường')) return 'purple';
    if (cat.includes('antibiotics') || cat.includes('kháng sinh')) return 'danger';
    if (cat.includes('pain') || cat.includes('giảm đau')) return 'success';
    return 'default';
  };

  return (
    <Modal
      visible={isVisible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Backdrop: Centered popup in the middle of the screen */}
        <Pressable
          className="flex-1 bg-black/50 justify-center items-center px-4"
          onPress={() => {
            Keyboard.dismiss();
            handleClose();
          }}
        >
          {/* Centered Popup Card */}
          <Pressable
            className="bg-white rounded-3xl w-full max-w-[420px] max-h-[85%] border border-slate-200/90 shadow-2xl p-5 overflow-hidden"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header: Title, Category & Close Button */}
            <View className="flex-row items-start justify-between pb-3 border-b border-slate-100 mb-3">
              <View className="flex-1 pr-2">
                <Text className="text-xl font-bold tracking-tight text-zinc-900" numberOfLines={2}>
                  {activeMedicine.name}
                </Text>
                <View className="flex-row items-center gap-2 mt-1.5">
                  <Badge
                    label={getCategoryLabel(activeMedicine.category)}
                    variant={getCategoryVariant(activeMedicine.category)}
                  />
                  <Text className="text-xs text-zinc-400 font-medium">
                    Hoạt chất: {activeMedicine.activeIngredient}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={handleClose}
                hitSlop={12}
                className="size-8 rounded-full bg-slate-100 items-center justify-center active:bg-slate-200"
              >
                <X size={16} color="#64748B" />
              </Pressable>
            </View>

            {/* Scrollable Body */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 16 }}
              className="gap-3"
            >
              {/* Tên thuốc & Liều dùng khi đang Chỉnh sửa */}
              {isEditing && (
                <View className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200">
                  <View className="flex-row items-center gap-1.5 mb-2">
                    <Edit3 size={15} color="#2563EB" />
                    <Text className="text-xs font-bold uppercase tracking-wider text-blue-700">
                      Sửa Tên Thuốc & Liều Dùng
                    </Text>
                  </View>
                  <View className="gap-2">
                    <View>
                      <Text className="text-2xs font-bold uppercase text-slate-500 mb-1">
                        Tên biệt dược / Tên thuốc *
                      </Text>
                      <Input
                        label=""
                        placeholder="VD: Amoxicillin 500mg, Panadol..."
                        value={editName}
                        onChangeText={setEditName}
                      />
                    </View>
                    <View>
                      <Text className="text-2xs font-bold uppercase text-slate-500 mb-1">
                        Liều dùng mỗi lần
                      </Text>
                      <Input
                        label=""
                        placeholder="VD: 1 viên, 2 viên..."
                        value={editDosage}
                        onChangeText={setEditDosage}
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* Tác dụng của thuốc (Cho phép xem & sửa) */}
              <View className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100">
                <View className="flex-row items-center justify-between mb-1">
                  <View className="flex-row items-center gap-1.5">
                    <Activity size={16} color="#2563EB" />
                    <Text className="text-xs font-bold uppercase tracking-wider text-blue-700">
                      Tác Dụng Điều Trị
                    </Text>
                  </View>
                  {!isEditing && (
                    <Pressable
                      onPress={() => setIsEditing(true)}
                      className="px-2 py-0.5 rounded-lg bg-blue-100 active:bg-blue-200"
                    >
                      <Text className="text-3xs font-semibold text-blue-700">Sửa tác dụng</Text>
                    </Pressable>
                  )}
                </View>

                {isEditing ? (
                  <Input
                    label=""
                    placeholder="Nhập tác dụng của thuốc..."
                    value={editPurpose}
                    onChangeText={setEditPurpose}
                  />
                ) : (
                  <Text className="text-sm font-medium leading-relaxed text-blue-950">
                    {activeMedicine.purpose || 'Hỗ trợ điều trị y khoa.'}
                  </Text>
                )}
              </View>

              {/* Điều chỉnh Số lượng viên & Hạn sử dụng */}
              <View className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                <View className="flex-row items-center justify-between mb-2.5">
                  <View className="flex-row items-center gap-1.5">
                    <Pill size={16} color="#475569" />
                    <Text className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Số Lượng & Hạn Dùng
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setIsEditing(!isEditing)}
                    className="flex-row items-center gap-1 px-2.5 py-1 rounded-xl bg-white border border-slate-200 active:bg-slate-100"
                  >
                    <Edit3 size={12} color="#2563EB" />
                    <Text className="text-xs font-semibold text-blue-600">
                      {isEditing ? 'Hủy sửa' : 'Chỉnh sửa'}
                    </Text>
                  </Pressable>
                </View>

                {/* Interactive Pill Stepper */}
                <View className="flex-row items-center justify-between bg-white p-3 rounded-2xl border border-slate-200/80 mb-2.5">
                  <View>
                    <Text className="text-xs font-medium text-slate-500">Số viên trong tủ</Text>
                    <Text className="text-lg font-bold text-zinc-900 mt-0.5">
                      {editRemainingCount} viên
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => handleStepperChange(-1)}
                      className="size-9 rounded-xl bg-slate-100 border border-slate-200 items-center justify-center active:bg-slate-200"
                    >
                      <Minus size={16} color="#18181B" strokeWidth={2.5} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleStepperChange(1)}
                      className="size-9 rounded-xl bg-blue-600 items-center justify-center shadow-xs active:bg-blue-700"
                    >
                      <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
                    </Pressable>
                  </View>
                </View>

                {/* Expiry Date Row */}
                <View className="bg-white p-3 rounded-2xl border border-slate-200/80">
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <Calendar size={14} color="#64748B" />
                    <Text className="text-xs font-medium text-slate-500">Hạn sử dụng (HSD)</Text>
                  </View>
                  {isEditing ? (
                    <Input
                      label=""
                      placeholder="YYYY-MM-DD (VD: 2027-12-31)"
                      value={editExpiryDate}
                      onChangeText={setEditExpiryDate}
                    />
                  ) : (
                    <Text className="text-sm font-bold text-zinc-900">
                      {activeMedicine.expiryDate || 'Chưa rõ hạn sử dụng'}
                    </Text>
                  )}
                </View>

                {/* Save button if editing */}
                {isEditing && (
                  <View className="mt-3">
                    <Button
                      title="Lưu Cập Nhật"
                      variant="primary"
                      onPress={handleSaveUpdate}
                      icon={<Check size={16} color="#FFFFFF" />}
                    />
                  </View>
                )}
              </View>

              {/* Center Actions: [ Đã hiểu ] ở giữa màn hình */}
              <View className="pt-2 gap-2">
                <Button
                  title="Đã hiểu"
                  variant="primary"
                  onPress={handleClose}
                />

                <Pressable
                  onPress={handleDeleteMedicine}
                  className="py-2.5 items-center justify-center rounded-2xl bg-red-50 border border-red-100 active:bg-red-100 flex-row gap-1.5"
                >
                  <Trash2 size={14} color="#DC2626" />
                  <Text className="text-xs font-bold text-red-600">
                    Xóa thuốc khỏi tủ
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
