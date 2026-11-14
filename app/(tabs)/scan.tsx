import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Animated,
  Image,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import {
  Camera as CameraIcon,
  ImageIcon,
  Sparkles,
  CheckCircle2,
  CalendarPlus,
  RotateCcw,
  Pill,
  Globe,
  Clock,
  Plus,
  X,
  AlertCircle,
  FileText,
  Package,
  Users,
  User,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Edit3,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ScreenHeader, Card, Badge, Button, Input } from '@/components/ui';
import { useMedStore } from '@/store/useMedStore';
import {
  PrescriptionAnalysisResult,
  Medicine,
  TimeSlot,
  MealTiming,
  SingleMedicineDetail,
  ScanFlowType,
  FamilyMember,
} from '@/types/medlens';
import {
  sanitizePrescriptionMetadata,
  checkPrescriptionDiscrepancy,
} from '@/services/clinical';
import { analyzePrescription } from '@/services/ai';
import { MedicineDetailModal } from '@/components/features/MedicineDetailModal';

type ScanStage = 'capture' | 'scanning' | 'result';

const MANUAL_CATEGORIES = [
  'Huyết áp',
  'Dạ dày',
  'Tiểu đường',
  'Kháng sinh',
  'Giảm đau',
  'Tim mạch',
  'Khác',
];

// Collapsible Drug Interaction Warning with big, clear text
function DrugInteractionWarningSection({
  warnings,
}: {
  warnings: any[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // If no warnings, automatically hidden
  if (!warnings || warnings.length === 0) {
    return null;
  }

  return (
    <Card className="p-4 bg-amber-50/90 border border-amber-300 shadow-sm rounded-3xl overflow-hidden mb-3">
      {/* Header bar with Arrow button: initially collapsed */}
      <Pressable
        onPress={() => {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch {}
          setIsExpanded(!isExpanded);
        }}
        className="flex-row items-center justify-between active:opacity-75"
      >
        <View className="flex-row items-center gap-2.5 flex-1 pr-2">
          <View className="size-9 rounded-2xl bg-amber-200/80 items-center justify-center">
            <AlertTriangle size={20} color="#B45309" strokeWidth={2.4} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold text-amber-950">
              Cảnh báo thuốc kỵ nhau ({warnings.length})
            </Text>
            <Text className="text-xs font-semibold text-amber-800">
              {isExpanded ? 'Chạm để thu gọn cảnh báo' : 'Chạm mũi tên để xem chi tiết dược lý'}
            </Text>
          </View>
        </View>

        <View className="size-9 rounded-full bg-white/90 border border-amber-200 items-center justify-center">
          {isExpanded ? (
            <ChevronUp size={20} color="#B45309" strokeWidth={2.5} />
          ) : (
            <ChevronDown size={20} color="#B45309" strokeWidth={2.5} />
          )}
        </View>
      </Pressable>

      {/* Expanded Content with BIG, READABLE text */}
      {isExpanded && (
        <View className="mt-3.5 pt-3 border-t border-amber-200/80 gap-3">
          {warnings.map((warn, wIdx) => (
            <View
              key={warn.id || wIdx}
              className="p-4 bg-white rounded-2xl border border-amber-200 shadow-2xs"
            >
              <View className="flex-row items-center justify-between mb-2 flex-wrap gap-1">
                <Text className="text-base sm:text-lg font-extrabold text-amber-950 flex-1 pr-2">
                  {warn.medicineA} ⚡ {warn.medicineB}
                </Text>
                <Badge
                  label={
                    warn.severity === 'critical'
                      ? 'Rất nguy hiểm'
                      : warn.severity === 'high'
                      ? 'Nghiêm trọng'
                      : 'Cần lưu ý'
                  }
                  variant={
                    warn.severity === 'critical' || warn.severity === 'high'
                      ? 'danger'
                      : 'warning'
                  }
                />
              </View>

              {/* Big readable typography */}
              <Text className="text-sm sm:text-base font-medium text-zinc-800 leading-relaxed mb-2.5">
                {warn.description}
              </Text>

              {warn.clinicalRecommendation ? (
                <View className="p-3 rounded-xl bg-amber-50 border border-amber-200/80">
                  <Text className="text-xs sm:text-sm font-bold text-amber-900 leading-relaxed">
                    💡 Khuyến nghị bác sĩ: {warn.clinicalRecommendation}
                  </Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

export default function PrescriptionScanScreen() {
  const router = useRouter();
  const cabinet = useMedStore((state) => state.cabinet);
  const importPrescription = useMedStore((state) => state.importPrescription);
  const addSingleMedicine = useMedStore((state) => state.addSingleMedicine);
  const addMedicines = useMedStore((state) => state.addMedicines);
  const setSelectedMedicine = useMedStore((state) => state.setSelectedMedicine);
  const familyMembers = useMedStore((state) => state.familyMembers) || [];
  const activeMemberId = useMedStore((state) => state.activeMemberId) || 'tam';

  const [stage, setStage] = useState<ScanStage>('capture');
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<PrescriptionAnalysisResult | null>(null);

  // Flow 2: Selected medicines to add
  const [selectedMedIds, setSelectedMedIds] = useState<string[]>([]);

  // Member selection sheet for "Add Lịch"
  const [isMemberSheetVisible, setIsMemberSheetVisible] = useState(false);
  const [targetMemberId, setTargetMemberId] = useState<string>(activeMemberId);

  const targetMember = useMemo(() => {
    return familyMembers.find((m) => m.id === targetMemberId) || familyMembers[0];
  }, [familyMembers, targetMemberId]);

  const discrepancy = useMemo(() => {
    return checkPrescriptionDiscrepancy(analysisResult, targetMember);
  }, [analysisResult, targetMember]);

  // Manual entry modal
  const [isManualModalVisible, setIsManualModalVisible] = useState(false);
  const [showExtraInfo, setShowExtraInfo] = useState(false);
  const [manualForm, setManualForm] = useState<{
    name: string;
    activeIngredient: string;
    dosage: string;
    instructions: string;
    purpose: string;
    remainingCount: string;
    expiryDate: string;
    category: string;
    mealTiming: MealTiming;
    timeSlots: TimeSlot[];
    treatmentCourse: string;
  }>({
    name: '',
    activeIngredient: '',
    dosage: '1 viên',
    instructions: 'Uống sau ăn no',
    purpose: 'Hỗ trợ điều trị',
    remainingCount: '20',
    expiryDate: '2027-12-31',
    category: 'Khác',
    mealTiming: 'after_meal',
    timeSlots: ['morning'],
    treatmentCourse: '',
  });

  // Cabinet selection sheet state when saving to cabinet
  const [isCabinetSelectModalVisible, setIsCabinetSelectModalVisible] = useState(false);
  const [selectedCabinetTarget, setSelectedCabinetTarget] = useState<string>('shared');
  const [sharedExpiryInput, setSharedExpiryInput] = useState<string>('2027-12-31');

  // Laser scanning animation controller
  const laserAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (stage === 'scanning') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      laserAnim.setValue(0);
    }
  }, [stage]);


  // -------------------------------------------------------------
  // Image Compression & Processing
  // -------------------------------------------------------------
  const compressAndResizeImage = async (uri?: string): Promise<string | undefined> => {
    if (!uri) return undefined;
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      return manipulated.base64;
    } catch (err) {
      console.warn('Lỗi ImageManipulator, dùng fallback:', err);
      return undefined;
    }
  };

  const handleCameraCapture = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') return;
      const mediaType = ImagePicker.MediaTypeOptions?.Images;
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: mediaType,
        allowsEditing: false, // Full Camera, không bị khung vuông!
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setCapturedImageUri(uri);
        const compressedBase64 = await compressAndResizeImage(uri);
        await executeAnalysis(compressedBase64 || (result.assets[0].base64 ?? undefined));
      }
    } catch (err) {
      console.warn('Camera capture error:', err);
    }
  };

  const handleLibraryPicker = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') return;
      const mediaType = ImagePicker.MediaTypeOptions?.Images;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaType,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setCapturedImageUri(uri);
        const compressedBase64 = await compressAndResizeImage(uri);
        await executeAnalysis(compressedBase64 || (result.assets[0].base64 ?? undefined));
      }
    } catch (err) {
      console.warn('Library picker error:', err);
    }
  };

  // Preset trigger (preserved for tests and programmatic demo)
  const handleSelectPreset = async (
    preset: 'preset1' | 'preset2' | 'single_medicine' | 'unrecognized'
  ) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setCapturedImageUri('file:///mock/prescription_demo.jpg');
    await executeAnalysis(undefined, preset);
  };

  const executeAnalysis = async (
    imageBase64?: string,
    presetChoice?: 'preset1' | 'preset2' | 'single_medicine' | 'unrecognized'
  ) => {
    setStage('scanning');
    try {
      const rawResult = await analyzePrescription(imageBase64, cabinet, presetChoice, 'auto');

      let flowType: ScanFlowType = rawResult.scanType || 'prescription';
      if (rawResult.isValidPrescription === false || (rawResult.medicines.length === 0 && !rawResult.singleMedicine)) {
        flowType = 'unrecognized';
      }
      if (presetChoice === 'single_medicine' || rawResult.scanType === 'single_medicine') {
        flowType = 'single_medicine';
      }
      if (presetChoice === 'unrecognized') flowType = 'unrecognized';

      // Tự động phân loại: nếu AI nhận diện là lọ thuốc hoặc chỉ có 1 loại thuốc mà không có bác sĩ y tế cụ thể
      if (
        flowType !== 'unrecognized' &&
        (rawResult.singleMedicine ||
          rawResult.scanType === 'single_medicine' ||
          (rawResult.medicines?.length === 1 &&
            (!rawResult.doctorName ||
              rawResult.doctorName.toLowerCase().includes('phụ trách') ||
              rawResult.doctorName.toLowerCase().includes('điều trị'))))
      ) {
        flowType = 'single_medicine';
      }

      const sanitized = sanitizePrescriptionMetadata(rawResult);

      let singleMed = rawResult.singleMedicine;
      if (flowType === 'single_medicine' && !singleMed && sanitized.medicines.length > 0) {
        const first = sanitized.medicines[0];
        singleMed = {
          id: first.id,
          name: first.name,
          activeIngredient: first.activeIngredient,
          dosage: first.dosage,
          mealTiming: first.mealTiming,
          instructions: first.instructions,
          purpose: first.purpose,
          remainingCount: first.remainingCount,
          expiryDate: first.expiryDate,
          category: first.category,
          origin: 'Nhà sản xuất chính hãng',
          recommendedDosage: first.dosage,
          indications: first.purpose,
          timeSlots: first.timeSlots || ['morning', 'noon'],
        };
      }

      const finalResult: PrescriptionAnalysisResult = {
        ...sanitized,
        scanType: flowType,
        singleMedicine: singleMed,
        doctorName: flowType === 'single_medicine' ? undefined : sanitized.doctorName,
        diagnosis: flowType === 'single_medicine' ? undefined : sanitized.diagnosis,
        errorMessage: rawResult.errorMessage,
        warnings: sanitized.warnings || [],
      };

      setAnalysisResult(finalResult);

      if (flowType === 'prescription') {
        setSelectedMedIds(sanitized.medicines.map((m) => m.id));
      }

      try {
        if (flowType === 'unrecognized') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch {}

      // Smooth delay so the laser scanning effect is visually appreciated
      setTimeout(() => {
        setStage('result');
      }, 1200);
    } catch (err) {
      console.warn('Analysis execution error:', err);
      setStage('capture');
    }
  };

  const handleResetScan = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setAnalysisResult(null);
    setCapturedImageUri(null);
    setStage('capture');
  };

  // -------------------------------------------------------------
  // Flow 2: Toggle Selection of Medicine
  // -------------------------------------------------------------
  const toggleMedicineSelection = (id: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedMedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // -------------------------------------------------------------
  // Save Handlers (Add Lịch / Add Tủ)
  // -------------------------------------------------------------
  const handleOpenMemberSelection = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setTargetMemberId(activeMemberId);
    setIsMemberSheetVisible(true);
  };

  const executeSaveSchedule = () => {
    if (!analysisResult) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    if (analysisResult.scanType === 'prescription') {
      const medsToAdd = analysisResult.medicines.filter((m) => selectedMedIds.includes(m.id));
      addMedicines(medsToAdd, false, true, targetMemberId);
    } else if (analysisResult.scanType === 'single_medicine' && analysisResult.singleMedicine) {
      const med = analysisResult.singleMedicine;
      addSingleMedicine(med, med.timeSlots || ['morning'], false, true, targetMemberId);
    }

    setIsMemberSheetVisible(false);
    router.replace('/(tabs)');
  };

  const handleConfirmAddSchedule = () => {
    if (!analysisResult) return;

    if (discrepancy.hasDiscrepancy) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {}

      const memberDisplay = targetMember?.name || 'thành viên này';
      Alert.alert(
        '⚠️ Cảnh Báo An Toàn Đơn Thuốc',
        `${discrepancy.warnings.join('\n\n')}\n\nBạn là Trụ Cột Gia Đình đang quản lý thuốc. Bạn có chắc chắn muốn áp dụng đơn thuốc này vào lịch uống của "${memberDisplay}"?`,
        [
          { text: 'Kiểm tra lại', style: 'cancel' },
          {
            text: `Vẫn lưu cho ${memberDisplay}`,
            style: 'destructive',
            onPress: () => {
              executeSaveSchedule();
            },
          },
        ]
      );
    } else {
      executeSaveSchedule();
    }
  };

  const handleAddToCabinet = () => {
    if (!analysisResult) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    // Set default expiry if missing
    let defaultExpiry = '2027-12-31';
    if (analysisResult.scanType === 'single_medicine' && analysisResult.singleMedicine?.expiryDate) {
      defaultExpiry = analysisResult.singleMedicine.expiryDate;
    } else if (analysisResult.scanType === 'prescription') {
      const firstValid = analysisResult.medicines.find((m) => m.expiryDate)?.expiryDate;
      if (firstValid) defaultExpiry = firstValid;
    }
    setSharedExpiryInput(defaultExpiry);
    setIsCabinetSelectModalVisible(true);
  };

  const handleConfirmAddToCabinet = () => {
    if (!analysisResult) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    const targetOwner = selectedCabinetTarget;
    const targetExpiry = targetOwner === 'shared' ? sharedExpiryInput.trim() || '2027-12-31' : undefined;

    if (analysisResult.scanType === 'prescription') {
      const medsToAdd = analysisResult.medicines
        .filter((m) => selectedMedIds.includes(m.id))
        .map((m) => ({
          ...m,
          ownerId: targetOwner,
          expiryDate: targetExpiry || m.expiryDate || '2027-12-31',
        }));
      addMedicines(medsToAdd, true, false, targetOwner === 'shared' ? undefined : targetOwner);
    } else if (analysisResult.scanType === 'single_medicine' && analysisResult.singleMedicine) {
      const med: Medicine = {
        ...analysisResult.singleMedicine,
        ownerId: targetOwner,
        expiryDate: targetExpiry || analysisResult.singleMedicine.expiryDate || '2027-12-31',
      };
      addSingleMedicine(med, undefined, true, false, targetOwner === 'shared' ? undefined : targetOwner);
    }

    setIsCabinetSelectModalVisible(false);
    router.replace('/(tabs)/cabinet');
  };

  // Smart merge handler (kept for test suite backward compatibility)
  const handleSmartMerge = async () => {
    if (!analysisResult) return;
    importPrescription(analysisResult);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    router.replace('/(tabs)');
  };

  // -------------------------------------------------------------
  // Manual Entry Save Handler
  // -------------------------------------------------------------
  const handleSaveManual = () => {
    if (!manualForm.name.trim()) {
      Alert.alert('Chưa có tên thuốc', 'Vui lòng nhập tên thuốc để lưu.');
      return;
    }
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    const newMed: Medicine = {
      id: `manual-med-${Date.now()}`,
      name: manualForm.name.trim(),
      activeIngredient: manualForm.activeIngredient.trim() || manualForm.name.trim(),
      dosage: manualForm.dosage.trim() || '1 viên',
      instructions: manualForm.instructions.trim() || 'Uống sau ăn',
      purpose: manualForm.purpose.trim() || 'Hỗ trợ điều trị',
      remainingCount: parseInt(manualForm.remainingCount, 10) || 20,
      expiryDate: manualForm.expiryDate.trim() || '2027-12-31',
      category: manualForm.category.trim() || 'Khác',
      mealTiming: manualForm.mealTiming,
      treatmentCourse: manualForm.treatmentCourse.trim() || undefined,
      ownerId: activeMemberId,
    };

    addSingleMedicine(newMed, manualForm.timeSlots, true, true, activeMemberId);
    setIsManualModalVisible(false);
    router.replace('/(tabs)');
  };

  const laserTranslateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 240],
  });

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#F2F2F7]">
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      >
        <ScreenHeader
          title="Quét đơn thuốc và tra cứu thuốc"
          subtitle="Chụp ảnh đơn thuốc bệnh viện hoặc vỏ hộp thuốc"
          showAvatar={false}
        />

        {/* ========================================================= */}
        {/* MÀN 2A: CAMERA CHỤP TRỰC TIẾP (VIEWFINDER & SCANNER HUB)  */}
        {/* ========================================================= */}
        {stage === 'capture' && (
          <View className="mt-2 items-center gap-4">
            {/* Viewfinder Frame with 4 Bracket Corners */}
            <View className="w-full aspect-[4/5] max-h-[350px] rounded-3xl bg-slate-900 overflow-hidden relative items-center justify-center shadow-lg border border-slate-800">
              {/* 4 Bracket Corners */}
              <View className="absolute top-4 left-4 size-8 border-t-4 border-l-4 border-blue-500 rounded-tl-xl" />
              <View className="absolute top-4 right-4 size-8 border-t-4 border-r-4 border-blue-500 rounded-tr-xl" />
              <View className="absolute bottom-4 left-4 size-8 border-b-4 border-l-4 border-blue-500 rounded-bl-xl" />
              <View className="absolute bottom-4 right-4 size-8 border-b-4 border-r-4 border-blue-500 rounded-br-xl" />

              {/* Center Camera Watermark */}
              <View className="items-center justify-center p-6 bg-slate-800/50 rounded-3xl border border-white/10">
                <CameraIcon size={40} color="#60A5FA" strokeWidth={1.5} />
                <Text className="text-white text-sm font-bold text-center mt-3">
                  Quét Đơn Thuốc & Bao Bì AI
                </Text>
                <Text className="text-slate-300 text-xs text-center mt-1 px-4 font-medium leading-relaxed">
                  Căn chỉnh đơn thuốc bệnh viện hoặc vỏ hộp thuốc vào giữa khung hình
                </Text>
              </View>
            </View>

            {/* CONTROL DECK KHÔI PHỤC THEO ẢNH 2: Nút xanh to trên cùng, 2 nút xám dưới */}
            <View className="w-full gap-2.5 mt-2">
              {/* Nút lớn trên cùng: Mở Camera Chụp Ảnh */}
              <Pressable
                onPress={handleCameraCapture}
                accessibilityLabel="Mở Camera Chụp Ảnh"
                className="w-full bg-blue-600 active:bg-blue-700 py-4 px-4 rounded-2xl flex-row items-center justify-center gap-2.5 shadow-md shadow-blue-500/20 active:scale-[0.98]"
              >
                <CameraIcon size={22} color="#FFFFFF" strokeWidth={2.2} />
                <Text className="text-white text-base font-bold">Mở Camera Chụp Ảnh</Text>
              </Pressable>

              {/* Hàng 2 nút cạnh nhau: Chọn Từ Thư Viện & Tự Nhập Tay */}
              <View className="flex-row gap-2.5 w-full">
                <Pressable
                  onPress={handleLibraryPicker}
                  accessibilityLabel="Chọn Từ Thư Viện"
                  className="flex-1 bg-slate-200/90 active:bg-slate-300 py-3.5 px-3 rounded-2xl flex-row items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <ImageIcon size={19} color="#0F172A" strokeWidth={2.2} />
                  <Text className="text-zinc-900 text-sm font-bold">Chọn Từ Thư Viện</Text>
                </Pressable>

                <Pressable
                  onPress={() => setIsManualModalVisible(true)}
                  accessibilityLabel="Tự Nhập Tay"
                  className="flex-1 bg-slate-200/90 active:bg-slate-300 py-3.5 px-3 rounded-2xl flex-row items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Plus size={19} color="#0F172A" strokeWidth={2.4} />
                  <Text className="text-zinc-900 text-sm font-bold">Tự Nhập Tay</Text>
                </Pressable>
              </View>

              {/* Dòng chữ hướng dẫn chuẩn Ảnh 2 */}
              <Text className="text-xs text-zinc-400 font-medium text-center px-4 leading-relaxed mt-1">
                Chụp ảnh rõ nét đơn thuốc hoặc bao bì để AI tự động nhận diện và cảnh báo tương tác thuốc.
              </Text>
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* MÀN 2B: HIỆU ỨNG QUÉT LASER (ĐANG QUÉT VÀ KẾT QUẢ...)    */}
        {/* ========================================================= */}
        {stage === 'scanning' && (
          <View className="mt-2 items-center gap-4">
            <View className="w-full aspect-[4/5] max-h-[380px] rounded-3xl bg-slate-900 overflow-hidden relative items-center justify-center shadow-xl border border-slate-800">
              {capturedImageUri ? (
                <Image
                  source={{ uri: capturedImageUri }}
                  className="w-full h-full opacity-70"
                  resizeMode="cover"
                />
              ) : (
                <View className="size-20 rounded-3xl bg-blue-500/10 items-center justify-center">
                  <Sparkles size={36} color="#60A5FA" />
                </View>
              )}

              {/* 4 Bracket Corners */}
              <View className="absolute top-4 left-4 size-8 border-t-4 border-l-4 border-blue-400 rounded-tl-xl" />
              <View className="absolute top-4 right-4 size-8 border-t-4 border-r-4 border-blue-400 rounded-tr-xl" />
              <View className="absolute bottom-4 left-4 size-8 border-b-4 border-l-4 border-blue-400 rounded-bl-xl" />
              <View className="absolute bottom-4 right-4 size-8 border-b-4 border-r-4 border-blue-400 rounded-br-xl" />

              {/* Animated Laser Scanning Line */}
              <Animated.View
                style={{
                  transform: [{ translateY: laserTranslateY }],
                }}
                className="absolute top-10 left-0 right-0 h-1 bg-blue-400 shadow-lg shadow-blue-400"
              />

              <View className="absolute bottom-4 px-4 py-2 rounded-full bg-black/60 border border-white/20">
                <Text className="text-white text-xs font-semibold">Đang nhận diện quang học...</Text>
              </View>
            </View>

            <Card className="w-full p-4 bg-white items-center">
              <Text className="text-base font-bold text-zinc-900">
                Đang quét và kết quả...
              </Text>
              <Text className="text-xs text-zinc-500 text-center mt-1">
                AI Vision đang đọc chữ viết tay, phân loại đơn thuốc và đối soát thành phần dược lý.
              </Text>
            </Card>
          </View>
        )}

        {/* ========================================================= */}
        {/* MÀN 2C / 2D / 2E: 3 NHÁNH KẾT QUẢ QUÉT                    */}
        {/* ========================================================= */}
        {stage === 'result' && analysisResult && (
          <View className="gap-4 mt-2">
            {/* ------------------------------------------------------- */}
            {/* NHÁNH 1 (MÀN 2C): QUÉT THẤT BẠI                        */}
            {/* ------------------------------------------------------- */}
            {analysisResult.scanType === 'unrecognized' && (
              <View className="gap-4">
                <Card className="p-6 bg-white border border-slate-200/80 items-center">
                  <View className="size-14 rounded-2xl bg-amber-50 items-center justify-center mb-3">
                    <AlertCircle size={28} color="#D97706" />
                  </View>
                  <Text className="text-lg font-bold text-zinc-900 text-center mb-1">
                    Không phát hiện đơn thuốc hoặc bao bì thuốc
                  </Text>
                  <Text className="text-xs text-zinc-500 text-center mb-5 leading-relaxed px-4">
                    {analysisResult.errorMessage ||
                      'Hình ảnh cung cấp không phải là đơn thuốc hoặc bao bì thuốc hợp lệ. Bạn có thể chụp lại góc khác hoặc tự nhập thông tin thuốc.'}
                  </Text>

                  {/* 2 Buttons: [Chụp lại] & [Tự nhập] */}
                  <View className="flex-row gap-3 w-full">
                    <View className="flex-1">
                      <Button
                        title="Chụp lại"
                        variant="secondary"
                        onPress={handleResetScan}
                        icon={<RotateCcw size={16} color="#18181B" />}
                      />
                    </View>
                    <View className="flex-1">
                      <Button
                        title="Tự nhập thuốc"
                        variant="primary"
                        onPress={() => setIsManualModalVisible(true)}
                        icon={<Plus size={16} color="#FFFFFF" />}
                      />
                    </View>
                  </View>
                </Card>
              </View>
            )}

            {/* ------------------------------------------------------- */}
            {/* NHÁNH 2 (MÀN 2D): QUÉT ĐƠN THUỐC THÀNH CÔNG             */}
            {/* ------------------------------------------------------- */}
            {analysisResult.scanType === 'prescription' && (
              <View className="gap-4">
                {/* Cảnh báo vàng nếu đơn thuốc viết tay nguệch ngoạc khó đọc */}
                {(analysisResult.isHandwritten || analysisResult.handwritingWarning) && (
                  <View className="p-4 rounded-3xl bg-amber-50 border border-amber-300 shadow-sm flex-row items-start gap-3">
                    <View className="size-8 rounded-xl bg-amber-200/80 items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle size={18} color="#D97706" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-amber-950">
                        Cảnh Báo Đơn Thuốc Viết Tay
                      </Text>
                      <Text className="text-xs text-amber-800 leading-relaxed mt-1 font-medium">
                        {analysisResult.handwritingWarning ||
                          'Đơn thuốc viết bằng tay chữ có thể nguệch ngoạc khó đọc, tên thuốc hoặc liều lượng có thể sai lệch và không thể quét chính xác 100%. Vui lòng kiểm tra kỹ hoặc bấm "Chi tiết / Sửa" để chủ động sửa lại tên thuốc.'}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Header card with Doctor & Diagnosis info */}
                <Card className="p-4 bg-white">
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-2">
                      <CheckCircle2 size={18} color="#059669" />
                      <Text className="text-base font-bold text-zinc-900">Đơn thuốc đã nhận diện</Text>
                    </View>
                    {analysisResult.isHandwritten && (
                      <Badge label="Đơn viết tay" variant="warning" />
                    )}
                  </View>

                  <View className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <Text className="text-sm font-bold text-zinc-900">
                      Bác sĩ: {
                        analysisResult.doctorName &&
                        analysisResult.doctorName.trim() !== '' &&
                        analysisResult.doctorName !== 'Không có' &&
                        !analysisResult.doctorName.toLowerCase().includes('bác sĩ khám bệnh') &&
                        !analysisResult.doctorName.toLowerCase().includes('bác sĩ phụ trách') &&
                        !analysisResult.doctorName.toLowerCase().includes('không rõ')
                          ? (analysisResult.doctorName.startsWith('BS') || analysisResult.doctorName.startsWith('Bác sĩ')
                              ? analysisResult.doctorName.replace(/^(Bác sĩ:?\s*)/i, '')
                              : analysisResult.doctorName)
                          : 'Không có'
                      }
                    </Text>
                    <Text className="text-xs text-slate-500 mt-0.5">
                      Chẩn đoán: {analysisResult.diagnosis || 'Theo dõi điều trị y khoa'}
                    </Text>

                    {(analysisResult.patientName || analysisResult.prescriptionDate) && (
                      <View className="mt-2 pt-2 border-t border-slate-200/60 flex-row flex-wrap items-center gap-2">
                        {analysisResult.patientName ? (
                          <View className="flex-row items-center gap-1">
                            <Text className="text-2xs text-slate-500">Bệnh nhân trên đơn:</Text>
                            <Text className="text-2xs font-bold text-zinc-800">
                              {analysisResult.patientName}{' '}
                              {analysisResult.patientAge ? `(${analysisResult.patientAge} tuổi)` : ''}
                            </Text>
                          </View>
                        ) : null}
                        {analysisResult.prescriptionDate ? (
                          <View className="flex-row items-center gap-1">
                            <Text className="text-2xs text-slate-500">• Ngày kê:</Text>
                            <Text className="text-2xs font-semibold text-zinc-700">
                              {analysisResult.prescriptionDate}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    )}
                  </View>
                </Card>

                {/* Drug Interaction Warning Box (Collapsible, Big Typography, Auto-hide when safe) */}
                <DrugInteractionWarningSection warnings={analysisResult.warnings} />

                {/* Prescription Medicines List with iOS Circle Checkmarks */}
                <Card className="p-4 bg-white">
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Danh sách thuốc ({selectedMedIds.length}/{analysisResult.medicines.length})
                    </Text>
                    <Text className="text-xs font-medium text-slate-500">Chạm để chọn</Text>
                  </View>

                  <View className="gap-2.5">
                    {analysisResult.medicines.map((med, index) => {
                      const isChecked = selectedMedIds.includes(med.id);
                      return (
                        <Pressable
                          key={med.id || index}
                          onPress={() => toggleMedicineSelection(med.id)}
                          className={`flex-row items-center justify-between p-3.5 rounded-2xl border active:scale-[0.99] transition-all ${
                            isChecked
                              ? 'bg-blue-50/40 border-blue-200'
                              : 'bg-slate-50/70 border-slate-200/60'
                          }`}
                        >
                          <View className="flex-1 pr-3">
                            <View className="flex-row items-center gap-2">
                              <Text className="text-sm font-bold text-zinc-900">
                                {med.name}
                              </Text>
                              <Pressable
                                hitSlop={8}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  setSelectedMedicine(med);
                                }}
                                className="px-2 py-0.5 rounded-md bg-blue-100 active:bg-blue-200"
                              >
                                <Text className="text-3xs font-semibold text-blue-700">Chi tiết / Sửa</Text>
                              </Pressable>
                            </View>
                            <Text className="text-xs text-slate-500 mt-0.5">
                              Liều: {med.dosage} • {med.instructions}
                            </Text>
                            <Text className="text-3xs text-slate-400 mt-0.5">
                              {med.expiryDate ? `HSD: ${med.expiryDate}` : 'HSD: Chưa rõ hạn dùng'}
                            </Text>
                          </View>

                          {/* iOS Circle Checkmark */}
                          <View
                            className={`size-6 rounded-full border-2 items-center justify-center transition-all ${
                              isChecked
                                ? 'bg-blue-600 border-blue-600'
                                : 'bg-white border-slate-300'
                            }`}
                          >
                            {isChecked && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </Card>

                {/* Bottom Action Buttons: [Thêm vào Lịch] & [Lưu vào Tủ] */}
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Button
                      title="Thêm vào Lịch"
                      variant="primary"
                      onPress={handleOpenMemberSelection}
                      icon={<CalendarPlus size={18} color="#FFFFFF" />}
                    />
                  </View>
                  <View className="flex-1">
                    <Button
                      title="Lưu vào Tủ"
                      variant="secondary"
                      onPress={handleAddToCabinet}
                      icon={<Pill size={18} color="#18181B" />}
                    />
                  </View>
                </View>

                {/* Nút Hoàn thành lần quét ngang ở dưới cùng */}
                <View className="pt-1">
                  <Button
                    title="Hoàn thành lần quét"
                    variant="secondary"
                    onPress={handleResetScan}
                    icon={<CheckCircle2 size={18} color="#2563EB" />}
                  />
                </View>
              </View>
            )}

            {/* ------------------------------------------------------- */}
            {/* NHÁNH 3 (MÀN 2E): QUÉT 1 LOẠI THUỐC THÀNH CÔNG          */}
            {/* ------------------------------------------------------- */}
            {analysisResult.scanType === 'single_medicine' && analysisResult.singleMedicine && (
              <View className="gap-4">
                <Card className="p-5 bg-white border border-slate-200/80">
                  <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center gap-2">
                      <CheckCircle2 size={18} color="#059669" />
                      <Text className="text-base font-bold text-zinc-900">Thông tin thuốc đã bóc tách</Text>
                    </View>
                  </View>

                  {/* Product Hero Header */}
                  <View className="p-4 rounded-2xl bg-slate-50 border border-slate-100 mb-4">
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-lg font-bold text-zinc-900 flex-1 pr-2">
                        {analysisResult.singleMedicine.name}
                      </Text>
                      <Badge label={analysisResult.singleMedicine.category || 'Thuốc'} variant="primary" />
                    </View>
                    <Text className="text-xs font-medium text-slate-500">
                      {analysisResult.singleMedicine.origin || 'Nhà sản xuất chính hãng'}
                    </Text>
                  </View>

                  {/* Clean Inset Specs (No hyphens, high contrast) */}
                  <View className="rounded-2xl border border-slate-100 overflow-hidden">
                    <View className="p-3.5 bg-white flex-row justify-between items-center border-b border-slate-100">
                      <Text className="text-xs font-medium text-slate-400">Hoạt chất chính</Text>
                      <Text className="text-xs font-semibold text-zinc-800 text-right flex-1 pl-4">
                        {analysisResult.singleMedicine.activeIngredient}
                      </Text>
                    </View>
                    <View className="p-3.5 bg-white flex-row justify-between items-center border-b border-slate-100">
                      <Text className="text-xs font-medium text-slate-400">Liều dùng</Text>
                      <Text className="text-xs font-semibold text-zinc-800 text-right flex-1 pl-4">
                        {analysisResult.singleMedicine.recommendedDosage ||
                          analysisResult.singleMedicine.dosage}
                      </Text>
                    </View>
                    <View className="p-3.5 bg-white flex-row justify-between items-center">
                      <Text className="text-xs font-medium text-slate-400">Hạn sử dụng</Text>
                      <Text className="text-xs font-semibold text-zinc-800 text-right flex-1 pl-4">
                        {analysisResult.singleMedicine.expiryDate || 'Chưa rõ (sẽ cập nhật sau)'}
                      </Text>
                    </View>
                  </View>
                </Card>

                {/* Drug Interaction Warning Box (Collapsible, Big Typography, Auto-hide when safe) */}
                <DrugInteractionWarningSection warnings={analysisResult.warnings} />

                {/* Bottom Action Buttons: [Thêm vào Lịch] & [Lưu vào Tủ] */}
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Button
                      title="Thêm vào Lịch"
                      variant="primary"
                      onPress={handleOpenMemberSelection}
                      icon={<CalendarPlus size={18} color="#FFFFFF" />}
                    />
                  </View>
                  <View className="flex-1">
                    <Button
                      title="Lưu vào Tủ"
                      variant="secondary"
                      onPress={handleAddToCabinet}
                      icon={<Pill size={18} color="#18181B" />}
                    />
                  </View>
                </View>

                {/* Nút Hoàn thành lần quét ngang ở dưới cùng */}
                <View className="pt-1">
                  <Button
                    title="Hoàn thành lần quét"
                    variant="secondary"
                    onPress={handleResetScan}
                    icon={<CheckCircle2 size={18} color="#2563EB" />}
                  />
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ========================================================= */}
      {/* MODAL: CHỌN THÀNH VIÊN GIA ĐÌNH KHI BẤM [ADD LỊCH]       */}
      {/* ========================================================= */}
      <Modal
        visible={isMemberSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsMemberSheetVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/40 justify-end"
          onPress={() => setIsMemberSheetVisible(false)}
        >
          <Pressable
            className="bg-white rounded-t-3xl p-5 border-t border-slate-200"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="w-12 h-1.5 rounded-full bg-slate-300 self-center mb-3" />
            <Text className="text-base font-bold text-zinc-900 mb-1">
              Thêm Lịch Uống Cho Thành Viên
            </Text>
            <Text className="text-xs text-zinc-500 mb-3">
              Trụ cột gia đình chọn người sẽ uống đơn thuốc này:
            </Text>

            {/* Patient Header from Scanned Prescription */}
            {analysisResult?.patientName && (
              <View className="mb-3 p-3 rounded-2xl bg-blue-50/70 border border-blue-100 flex-row items-center justify-between">
                <View className="flex-row items-center gap-2 flex-1 pr-2">
                  <View className="size-8 rounded-xl bg-blue-100 items-center justify-center">
                    <User size={15} color="#2563EB" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-3xs font-semibold uppercase tracking-wider text-blue-700">
                      Bệnh nhân ghi trên đơn
                    </Text>
                    <Text className="text-xs font-bold text-zinc-900" numberOfLines={1}>
                      {analysisResult.patientName}{' '}
                      {analysisResult.patientAge ? `(${analysisResult.patientAge} tuổi)` : ''}
                    </Text>
                  </View>
                </View>
                {analysisResult.prescriptionDate && (
                  <View className="items-end">
                    <Text className="text-3xs text-slate-400">Ngày kê đơn</Text>
                    <Text className="text-2xs font-semibold text-zinc-700">
                      {analysisResult.prescriptionDate}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View className="gap-2 mb-3">
              {familyMembers.map((member) => {
                const isSelected = member.id === targetMemberId;
                return (
                  <Pressable
                    key={member.id}
                    onPress={() => {
                      try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      } catch {}
                      setTargetMemberId(member.id);
                    }}
                    className={`flex-row items-center justify-between p-3.5 rounded-2xl border ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-500'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <View className="flex-row items-center gap-3">
                      <View
                        className="size-9 rounded-xl items-center justify-center"
                        style={{ backgroundColor: member.avatarColor || '#2563EB' }}
                      >
                        <Text className="text-xs font-bold text-white">
                          {member.name.charAt(0)}
                        </Text>
                      </View>
                      <View>
                        <Text className="text-sm font-bold text-zinc-900">{member.name}</Text>
                        <Text className="text-2xs text-zinc-500">{member.relation}</Text>
                      </View>
                    </View>
                    {isSelected && <Check size={18} color="#2563EB" strokeWidth={3} />}
                  </Pressable>
                );
              })}
            </View>

            {/* Discrepancy Warning Banner if name/age/date mismatch */}
            {discrepancy.hasDiscrepancy && (
              <View className="mb-3.5 p-3 rounded-2xl bg-amber-50 border border-amber-200">
                <View className="flex-row items-center gap-1.5 mb-1">
                  <AlertTriangle size={15} color="#D97706" />
                  <Text className="text-xs font-bold text-amber-900">
                    Lưu Ý An Toàn Cho Trụ Cột Gia Đình
                  </Text>
                </View>
                {discrepancy.warnings.map((warn, wIdx) => (
                  <Text key={wIdx} className="text-xs text-amber-800 leading-relaxed mb-0.5">
                    • {warn}
                  </Text>
                ))}
              </View>
            )}

            <Button
              title={
                discrepancy.hasDiscrepancy
                  ? `Vẫn Lưu Cho ${targetMember?.name || 'Thành Viên'}`
                  : `Lưu Vào Lịch Của ${targetMember?.name || 'Thành Viên'}`
              }
              variant="primary"
              onPress={handleConfirmAddSchedule}
              icon={<CheckCircle2 size={18} color="#FFFFFF" />}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL: TỰ NHẬP THUỐC BẰNG TAY (KHI QUÉT THẤT BẠI)        */}
      {/* ========================================================= */}
      <Modal
        visible={isManualModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsManualModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <Pressable
            className="flex-1 bg-black/40 justify-end"
            onPress={() => {
              Keyboard.dismiss();
              setIsManualModalVisible(false);
            }}
          >
            <Pressable
              className="bg-white rounded-t-3xl p-5 border-t border-slate-200 max-h-[85%]"
              onPress={(e) => e.stopPropagation()}
            >
              <View className="w-12 h-1.5 rounded-full bg-slate-300 self-center mb-3" />
              <View className="flex-row items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <Text className="text-base font-bold text-zinc-900">Tự Nhập Thuốc Bằng Tay</Text>
                <Pressable
                  onPress={() => setIsManualModalVisible(false)}
                  className="size-7 items-center justify-center rounded-full bg-slate-100"
                >
                  <X size={15} color="#64748B" />
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 32, paddingTop: 6 }}
                className="gap-4.5"
              >
                <Input
                  label="Tên biệt dược *"
                  placeholder="VD: Panadol Extra, Amlodipine 5mg..."
                  value={manualForm.name}
                  onChangeText={(val) => setManualForm((prev) => ({ ...prev, name: val }))}
                />
                <Input
                  label="Hoạt chất y tế"
                  placeholder="VD: Paracetamol 500mg..."
                  value={manualForm.activeIngredient}
                  onChangeText={(val) => setManualForm((prev) => ({ ...prev, activeIngredient: val }))}
                />
                <Input
                  label="Liều dùng mỗi lần"
                  placeholder="VD: 1 viên"
                  value={manualForm.dosage}
                  onChangeText={(val) => setManualForm((prev) => ({ ...prev, dosage: val }))}
                />

                {/* Nhóm phân loại thuốc nhập tay (Không dùng AI) */}
                <View className="gap-2 mt-2 mb-1">
                  <Text className="text-xs font-bold uppercase tracking-wider text-zinc-600 px-1">
                    Phân loại nhóm thuốc (Người dùng tự chọn):
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="flex-row gap-2 py-1"
                  >
                    {MANUAL_CATEGORIES.map((cat) => {
                      const isSel = manualForm.category === cat;
                      return (
                        <Pressable
                          key={cat}
                          onPress={() => {
                            try {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            } catch {}
                            setManualForm((p) => ({ ...p, category: cat }));
                          }}
                          className={`px-4 py-2 rounded-full border transition-all ${
                            isSel
                              ? 'bg-zinc-900 border-zinc-900 shadow-2xs'
                              : 'bg-slate-100 border-slate-200'
                          }`}
                        >
                          <Text
                            className={`text-xs ${
                              isSel ? 'text-white font-bold' : 'text-zinc-700 font-medium'
                            }`}
                          >
                            {cat}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Nút bấm Thêm thông tin */}
                <Pressable
                  onPress={() => {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch {}
                    setShowExtraInfo(!showExtraInfo);
                  }}
                  className="flex-row items-center justify-between p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 active:bg-blue-100 my-1"
                >
                  <View className="flex-row items-center gap-2">
                    <Plus size={16} color="#2563EB" />
                    <Text className="text-xs font-bold text-blue-700">
                      {showExtraInfo
                        ? 'Thu gọn thông tin bổ sung'
                        : 'Thêm lựa chọn thông tin (Tác dụng, HSD, Số viên...)'}
                    </Text>
                  </View>
                  <ChevronDown
                    size={16}
                    color="#2563EB"
                    style={{ transform: [{ rotate: showExtraInfo ? '180deg' : '0deg' }] }}
                  />
                </Pressable>

                {/* Khối Thông tin bổ sung */}
                {showExtraInfo && (
                  <View className="gap-3.5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 mt-1">
                    <Input
                      label="Tác dụng của thuốc (Ngắn gọn)"
                      placeholder="VD: Giảm đau, hạ sốt nhanh, giảm sưng..."
                      value={manualForm.purpose}
                      onChangeText={(val) => setManualForm((prev) => ({ ...prev, purpose: val }))}
                    />

                    <Input
                      label="Đợt thuốc / Liệu trình uống (Theo dõi định kỳ)"
                      placeholder="VD: Đợt 7 ngày, Liệu trình 1 tháng, Tái khám 15/12..."
                      value={manualForm.treatmentCourse}
                      onChangeText={(val) => setManualForm((prev) => ({ ...prev, treatmentCourse: val }))}
                    />

                    <View className="flex-row gap-2.5">
                      <View className="flex-1">
                        <Input
                          label="Số viên thuốc"
                          placeholder="VD: 20"
                          keyboardType="numeric"
                          value={manualForm.remainingCount}
                          onChangeText={(val) => setManualForm((prev) => ({ ...prev, remainingCount: val }))}
                        />
                      </View>
                      <View className="flex-1">
                        <Input
                          label="Hạn sử dụng"
                          placeholder="VD: 2027-12-31"
                          value={manualForm.expiryDate}
                          onChangeText={(val) => setManualForm((prev) => ({ ...prev, expiryDate: val }))}
                        />
                      </View>
                    </View>

                    <Input
                      label="Hướng dẫn sử dụng thêm"
                      placeholder="VD: Uống sau ăn no với nhiều nước..."
                      value={manualForm.instructions}
                      onChangeText={(val) => setManualForm((prev) => ({ ...prev, instructions: val }))}
                    />

                    {/* Chỉ dẫn bữa ăn */}
                    <View className="gap-1.5">
                      <Text className="text-xs font-semibold text-zinc-700">Chỉ dẫn dùng theo bữa ăn:</Text>
                      <View className="flex-row gap-2">
                        {[
                          { key: 'before_meal', label: 'Trước ăn' },
                          { key: 'after_meal', label: 'Sau ăn no' },
                          { key: 'with_meal', label: 'Trong ăn' },
                        ].map((m) => {
                          const isSel = manualForm.mealTiming === m.key;
                          return (
                            <Pressable
                              key={m.key}
                              onPress={() => setManualForm((p) => ({ ...p, mealTiming: m.key as MealTiming }))}
                              className={`flex-1 py-2 items-center rounded-xl border ${
                                isSel ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'
                              }`}
                            >
                              <Text className={`text-xs ${isSel ? 'text-white font-bold' : 'text-zinc-700 font-medium'}`}>
                                {m.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>

                    {/* Cữ uống trong ngày */}
                    <View className="gap-1.5">
                      <Text className="text-xs font-semibold text-zinc-700">Cữ uống trong ngày:</Text>
                      <View className="flex-row gap-2">
                        {[
                          { key: 'morning', label: 'Sáng' },
                          { key: 'noon', label: 'Trưa' },
                          { key: 'evening', label: 'Tối' },
                        ].map((slot) => {
                          const isSel = manualForm.timeSlots.includes(slot.key as TimeSlot);
                          return (
                            <Pressable
                              key={slot.key}
                              onPress={() => {
                                setManualForm((p) => {
                                  const exists = p.timeSlots.includes(slot.key as TimeSlot);
                                  const updated = exists
                                    ? p.timeSlots.filter((s) => s !== slot.key)
                                    : [...p.timeSlots, slot.key as TimeSlot];
                                  return { ...p, timeSlots: updated.length ? updated : ['morning'] };
                                });
                              }}
                              className={`flex-1 py-2 items-center rounded-xl border ${
                                isSel ? 'bg-zinc-900 border-zinc-900' : 'bg-white border-slate-200'
                              }`}
                            >
                              <Text className={`text-xs ${isSel ? 'text-white font-bold' : 'text-zinc-700 font-medium'}`}>
                                {slot.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                )}

                <View className="pt-2">
                  <Button title="Lưu Vào Tủ & Lịch" variant="primary" onPress={handleSaveManual} />
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL: CHỌN TỦ ĐỂ LƯU THUỐC                              */}
      {/* ========================================================= */}
      <Modal
        visible={isCabinetSelectModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCabinetSelectModalVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/40 justify-end"
          onPress={() => setIsCabinetSelectModalVisible(false)}
        >
          <Pressable
            className="bg-white rounded-t-3xl p-5 border-t border-slate-200"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="w-12 h-1.5 rounded-full bg-slate-300 self-center mb-3" />
            <Text className="text-base font-bold text-zinc-900 mb-1">
              Chọn Tủ Để Lưu Thuốc
            </Text>
            <Text className="text-xs text-zinc-500 mb-3">
              Lựa chọn lưu vào Tủ dự phòng chung hoặc tủ riêng của thành viên:
            </Text>

            <View className="gap-2 mb-3">
              {/* Option 1: Tủ dự phòng chung */}
              <Pressable
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                  setSelectedCabinetTarget('shared');
                }}
                className={`flex-row items-center justify-between p-3.5 rounded-2xl border ${
                  selectedCabinetTarget === 'shared'
                    ? 'bg-blue-50/70 border-blue-500'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <View className="size-9 rounded-xl bg-blue-100 items-center justify-center">
                    <Package size={18} color="#2563EB" />
                  </View>
                  <View>
                    <Text className="text-sm font-bold text-zinc-900">Tủ dự phòng chung</Text>
                    <Text className="text-2xs text-zinc-500">Dùng chung cho cả gia đình</Text>
                  </View>
                </View>
                {selectedCabinetTarget === 'shared' && <Check size={18} color="#2563EB" strokeWidth={3} />}
              </Pressable>

              {/* Individual family member cabinets */}
              {familyMembers.map((member) => {
                const isSelected = selectedCabinetTarget === member.id;
                return (
                  <Pressable
                    key={member.id}
                    onPress={() => {
                      try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      } catch {}
                      setSelectedCabinetTarget(member.id);
                    }}
                    className={`flex-row items-center justify-between p-3.5 rounded-2xl border ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-500'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <View className="flex-row items-center gap-3">
                      <View
                        className="size-9 rounded-xl items-center justify-center"
                        style={{ backgroundColor: member.avatarColor || '#2563EB' }}
                      >
                        <Text className="text-xs font-bold text-white">
                          {member.name.charAt(0)}
                        </Text>
                      </View>
                      <View>
                        <Text className="text-sm font-bold text-zinc-900">Tủ của {member.name}</Text>
                        <Text className="text-2xs text-zinc-500">{member.relation}</Text>
                      </View>
                    </View>
                    {isSelected && <Check size={18} color="#2563EB" strokeWidth={3} />}
                  </Pressable>
                );
              })}
            </View>

            {/* Cảnh báo & Tự nhập HSD nếu chọn Tủ chung */}
            {selectedCabinetTarget === 'shared' && (
              <View className="mb-3.5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
                <View className="flex-row items-center gap-1.5 mb-1.5">
                  <AlertTriangle size={15} color="#D97706" />
                  <Text className="text-xs font-bold text-amber-900">
                    Cảnh Báo Hạn Dùng Tủ Chung
                  </Text>
                </View>
                <Text className="text-xs text-amber-800 leading-relaxed mb-2">
                  Thuốc lưu trữ trong Tủ dự phòng chung bắt buộc phải rõ hạn sử dụng để tránh nguy cơ uống nhầm thuốc quá hạn. Vui lòng xác nhận hoặc tự nhập HSD:
                </Text>
                <Input
                  label="Hạn sử dụng cho thuốc trong tủ chung"
                  placeholder="YYYY-MM-DD (VD: 2027-12-31)"
                  value={sharedExpiryInput}
                  onChangeText={setSharedExpiryInput}
                />
              </View>
            )}

            <Button
              title={`Lưu Vào ${
                selectedCabinetTarget === 'shared'
                  ? 'Tủ Dự Phòng Chung'
                  : `Tủ Của ${familyMembers.find((m) => m.id === selectedCabinetTarget)?.name || 'Thành Viên'}`
              }`}
              variant="primary"
              onPress={handleConfirmAddToCabinet}
              icon={<CheckCircle2 size={18} color="#FFFFFF" />}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Medicine Detail Modal bottom sheet */}
      <MedicineDetailModal
        onUpdate={(updatedMed) => {
          if (analysisResult) {
            setAnalysisResult({
              ...analysisResult,
              medicines: analysisResult.medicines.map((m) =>
                m.id === updatedMed.id ? { ...m, ...updatedMed } : m
              ),
              singleMedicine:
                analysisResult.singleMedicine && analysisResult.singleMedicine.id === updatedMed.id
                  ? { ...analysisResult.singleMedicine, ...updatedMed }
                  : analysisResult.singleMedicine,
            });
          }
        }}
      />
    </SafeAreaView>
  );
}
