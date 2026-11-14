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
  Clock,
  Utensils,
  UtensilsCrossed,
  AlertTriangle,
  Activity,
  Pill,
  Calendar,
  Droplets,
  Edit3,
  Trash2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useMedStore } from '@/store/useMedStore';
import { Medicine, MealTiming } from '@/types/medlens';
import { Card, Badge, Button, Input, BadgeVariant } from '@/components/ui';

interface MedicineDetailModalProps {
  medicine?: Medicine | null;
  visible?: boolean;
  onClose?: () => void;
}

export function MedicineDetailModal({
  medicine: propMedicine,
  visible: propVisible,
  onClose,
}: MedicineDetailModalProps) {
  const storeMedicine = useMedStore((state) => state.selectedMedicine);
  const setSelectedMedicine = useMedStore((state) => state.setSelectedMedicine);
  const updateMedicine = useMedStore((state) => state.updateMedicine);
  const removeMedicineFromCabinet = useMedStore((state) => state.removeMedicineFromCabinet);

  const activeMedicine = propMedicine !== undefined ? propMedicine : storeMedicine;
  const isVisible = propVisible !== undefined ? propVisible : Boolean(activeMedicine);

  const [isEditing, setIsEditing] = useState(false);
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [editRemainingCount, setEditRemainingCount] = useState('');

  useEffect(() => {
    if (activeMedicine) {
      setEditExpiryDate(activeMedicine.expiryDate || '');
      setEditRemainingCount(String(activeMedicine.remainingCount ?? 20));
      setIsEditing(false);
    }
  }, [activeMedicine?.id, activeMedicine?.expiryDate, activeMedicine?.remainingCount]);

  if (!activeMedicine) {
    return null;
  }

  const handleClose = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Graceful fallback if haptics unavailable
    }

    if (onClose) {
      onClose();
    } else {
      setSelectedMedicine(null);
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

    const cleanExpiry = editExpiryDate.trim() ? editExpiryDate.trim() : null;
    const cleanCount = parseInt(editRemainingCount, 10);

    updateMedicine(activeMedicine.id, {
      expiryDate: cleanExpiry,
      remainingCount: isNaN(cleanCount) ? 20 : cleanCount,
    });

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

  const getMealTimingConfig = (timing: MealTiming): {
    label: string;
    description: string;
    variant: BadgeVariant;
    icon: React.ReactNode;
  } => {
    switch (timing) {
      case 'before_meal':
        return {
          label: 'Trước ăn 30 - 60 phút',
          description: 'Uống khi bụng rỗng (trước ăn 30 - 60 phút) để thuốc hấp thu tối đa vào máu.',
          variant: 'warning',
          icon: <Clock size={12} color="#B45309" />,
        };
      case 'after_meal':
        return {
          label: 'Sau khi ăn no',
          description: 'Uống sau bữa ăn 15 - 30 phút để bảo vệ niêm mạc dạ dày và tránh kích ứng tiêu hóa.',
          variant: 'primary',
          icon: <Utensils size={12} color="#2563EB" />,
        };
      case 'with_meal':
      default:
        return {
          label: 'Trong hoặc ngay sau ăn',
          description: 'Uống cùng bữa ăn hoặc ngay sau miếng ăn đầu tiên để giảm thiểu khó chịu đường ruột.',
          variant: 'purple',
          icon: <UtensilsCrossed size={12} color="#7E22CE" />,
        };
    }
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

  const getSpecificPrecaution = (med: Medicine): string => {
    const lowerInst = (med.instructions || '').toLowerCase();
    const lowerName = med.name.toLowerCase();

    if (lowerInst.includes('bưởi chùm') || lowerName.includes('atorvastatin')) {
      return 'Tránh dùng cùng bưởi chùm hoặc nước ép bưởi chùm vì có thể làm tăng nồng độ thuốc trong huyết tương, tăng nguy cơ tiêu cơ vân và tổn thương gan.';
    }
    if (lowerInst.includes('nhiều nước') || lowerName.includes('aspirin')) {
      return 'Uống nguyên viên với ít nhất 200ml nước lọc sau bữa ăn no. Không bẻ gãy hoặc nhai vỡ viên bao tan trong ruột để tránh gây loét dạ dày.';
    }
    if (med.category === 'Antibiotics' || lowerName.includes('ciprofloxacin')) {
      return 'Dùng đủ liệu trình chỉ định. Không uống cùng lúc với sữa chua, phô mai hoặc thuốc kháng acid chứa Canxi, Magie, Nhôm trong vòng 2 giờ.';
    }
    return 'Nếu quên một liều, hãy uống ngay khi nhớ ra trừ khi đã gần cữ tiếp theo. Tuyệt đối không tự ý uống gấp đôi liều để bù.';
  };

  const mealConfig = getMealTimingConfig(activeMedicine.mealTiming);
  const specificPrecaution = getSpecificPrecaution(activeMedicine);

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <Pressable
          className="flex-1 bg-black/40 justify-end"
          onPress={() => {
            Keyboard.dismiss();
            handleClose();
          }}
        >
          <Pressable
            className="bg-white rounded-t-3xl max-h-[88%] border-t border-slate-200/80 shadow-2xl pt-2 pb-8 px-5"
            onPress={(e) => e.stopPropagation()}
          >
            {/* iOS Sheet Grabber Pill */}
            <View className="w-12 h-1.5 rounded-full bg-slate-300 self-center mt-1 mb-4" />

            {/* Header Bar */}
            <View className="flex-row items-start justify-between mb-4">
              <View className="flex-1 pr-3">
                <Text className="text-2xl font-bold tracking-tight text-zinc-900">
                  {activeMedicine.name}
                </Text>
                <View className="flex-row flex-wrap items-center gap-2 mt-2">
                  <Badge
                    label={getCategoryLabel(activeMedicine.category)}
                    variant={getCategoryVariant(activeMedicine.category)}
                  />
                  <Badge
                    label={mealConfig.label}
                    variant={mealConfig.variant}
                    icon={mealConfig.icon}
                  />
                </View>
              </View>

              <Pressable
                onPress={handleClose}
                hitSlop={12}
                className="size-9 rounded-full bg-slate-100 items-center justify-center active:bg-slate-200"
              >
                <X size={18} color="#64748B" />
              </Pressable>
            </View>

            {/* Scrollable Clinical Body */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
            className="space-y-4"
          >
            {/* Section 1: Clinical Mechanism & Purpose */}
            <Card className="bg-blue-50/60 border border-blue-100/90 p-4 rounded-2xl mb-3">
              <View className="flex-row items-center gap-2 mb-1.5">
                <Activity size={18} color="#2563EB" />
                <Text className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                  Cơ Chế & Mục Đích Điều Trị
                </Text>
              </View>
              <Text className="text-sm font-medium leading-relaxed text-blue-950">
                {activeMedicine.purpose}
              </Text>
            </Card>

            {/* Section 2: Active Ingredients & Dosage */}
            <Card className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl mb-3">
              <View className="flex-row items-center gap-2 mb-2">
                <Pill size={18} color="#475569" />
                <Text className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Hoạt Chất & Liều Lượng
                </Text>
              </View>

              <View className="flex-row items-center justify-between border-b border-slate-200/60 pb-2 mb-2">
                <Text className="text-sm text-slate-500">Hoạt chất chính</Text>
                <Text className="text-sm font-semibold text-zinc-900">
                  {activeMedicine.activeIngredient}
                </Text>
              </View>

              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-slate-500">Liều dùng 1 cữ</Text>
                <Text className="text-sm font-semibold text-zinc-900">
                  {activeMedicine.dosage}
                </Text>
              </View>
            </Card>

            {/* Section 3: Meal Timing & Safe Administration */}
            <Card className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl mb-3">
              <View className="flex-row items-center gap-2 mb-2">
                <Clock size={18} color="#475569" />
                <Text className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Chỉ Dẫn Dùng Thuốc & Bữa Ăn
                </Text>
              </View>

              <Text className="text-sm font-semibold text-zinc-900 mb-1">
                {activeMedicine.instructions}
              </Text>

              <Text className="text-xs text-slate-500 leading-relaxed mb-3">
                {mealConfig.description}
              </Text>

              <View className="flex-row items-center gap-2 pt-2 border-t border-slate-200/60">
                <Droplets size={16} color="#0284C7" />
                <Text className="text-xs text-slate-600 flex-1">
                  Uống với một ly nước lọc đầy (200 - 250ml). Tuyệt đối không uống cùng rượu bia hay nước ngọt có ga.
                </Text>
              </View>
            </Card>

            {/* Section 4: Precautions & Warnings */}
            <Card className="bg-amber-50/70 border border-amber-200/80 p-4 rounded-2xl mb-3">
              <View className="flex-row items-center gap-2 mb-1.5">
                <AlertTriangle size={18} color="#D97706" />
                <Text className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                  Lưu Ý An Toàn & Chống Chỉ Định
                </Text>
              </View>
              <Text className="text-xs font-medium leading-relaxed text-amber-950">
                {specificPrecaution}
              </Text>
            </Card>

            {/* Section 5: Cabinet Inventory & Shelf Life */}
            {!isEditing ? (
              <Card className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl mb-4">
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center gap-2">
                    <Pill size={16} color="#64748B" />
                    <Text className="text-xs text-slate-600">
                      Trong tủ:{' '}
                      <Text className="font-semibold text-zinc-900">
                        {activeMedicine.remainingCount ?? 0} viên
                      </Text>
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-2">
                    <Calendar size={16} color="#64748B" />
                    <Text className="text-xs text-slate-600">
                      HSD:{' '}
                      <Text className="font-semibold text-zinc-900">
                        {activeMedicine.expiryDate || 'Chưa rõ HSD'}
                      </Text>
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch {}
                    setIsEditing(true);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-white border border-slate-200/80 items-center justify-center active:bg-slate-100 flex-row gap-1.5"
                >
                  <Edit3 size={14} color="#2563EB" />
                  <Text className="text-xs font-semibold text-blue-600">
                    Chỉnh sửa HSD & Số lượng viên
                  </Text>
                </Pressable>
              </Card>
            ) : (
              <Card className="bg-white border border-blue-200 p-4 rounded-2xl mb-4 gap-3 shadow-sm">
                <Text className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  Cập Nhật Thông Tin Thuốc
                </Text>
                <Input
                  label="Hạn sử dụng (YYYY-MM-DD hoặc để trống)"
                  placeholder="VD: 2027-12-31 hoặc để trống nếu chưa rõ"
                  value={editExpiryDate}
                  onChangeText={setEditExpiryDate}
                />
                <Input
                  label="Số lượng viên còn lại trong tủ"
                  placeholder="VD: 30"
                  keyboardType="numeric"
                  value={editRemainingCount}
                  onChangeText={setEditRemainingCount}
                />
                <View className="flex-row gap-2 pt-1">
                  <View className="flex-1">
                    <Button
                      title="Lưu Cập Nhật"
                      variant="primary"
                      onPress={handleSaveUpdate}
                    />
                  </View>
                  <View className="w-24">
                    <Button
                      title="Hủy"
                      variant="secondary"
                      onPress={() => setIsEditing(false)}
                    />
                  </View>
                </View>
              </Card>
            )}

            {/* Actions */}
            <View className="pt-2 pb-4 gap-2.5">
              <Button
                title="Đã hiểu & Đóng"
                variant="primary"
                onPress={handleClose}
              />

              <Pressable
                onPress={handleDeleteMedicine}
                className="py-3 px-4 rounded-2xl bg-red-50 border border-red-200/60 items-center justify-center active:bg-red-100 flex-row gap-2"
              >
                <Trash2 size={16} color="#DC2626" />
                <Text className="text-sm font-semibold text-red-600">
                  Xóa thuốc này khỏi tủ
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
