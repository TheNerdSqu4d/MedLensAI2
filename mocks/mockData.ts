import type { MockItem } from '@/types';
import type {
  Medicine,
  DoseSlot,
  InteractionWarning,
  PrescriptionAnalysisResult,
  FamilyMember,
} from '@/types/medlens';


export const MOCK_ITEMS: MockItem[] = [
  {
    id: '1',
    title: 'Phân tích dữ liệu thông minh',
    description: 'Mô hình AI tự động phát hiện xu hướng và đề xuất giải pháp tối ưu theo thời gian thực.',
    createdAt: new Date().toISOString(),
    tag: 'AI Core',
  },
  {
    id: '2',
    title: 'Bảo mật chuẩn Serverless',
    description: 'Bảo vệ toàn bộ API Key trên Cloud Secrets, chống rò rỉ dữ liệu xuống client.',
    createdAt: new Date().toISOString(),
    tag: 'Security',
  },
  {
    id: '3',
    title: 'Trải nghiệm Apple Fluid Native',
    description: 'Thiết kế chuẩn HIG với độ nảy vật lý, phản hồi xúc giác Haptics và bo góc mượt mà.',
    createdAt: new Date().toISOString(),
    tag: 'Design',
  },
];

// Baseline Medications
export const MED_AMLODIPINE: Medicine = {
  id: 'med-amlodipine-5',
  name: 'Amlodipine 5mg',
  activeIngredient: 'Amlodipine besylate',
  dosage: '1 viên',
  mealTiming: 'after_meal',
  instructions: 'Uống sau bữa ăn sáng, duy trì huyết áp ổn định',
  purpose: 'Hạ huyết áp và kiểm soát đau thắt ngực',
  remainingCount: 28,
  expiryDate: '2026-12-31',
  category: 'Blood Pressure',
};

export const MED_METFORMIN: Medicine = {
  id: 'med-metformin-500',
  name: 'Metformin 500mg',
  activeIngredient: 'Metformin hydrochloride',
  dosage: '1 viên',
  mealTiming: 'with_meal',
  instructions: 'Uống ngay trong hoặc sau bữa ăn',
  purpose: 'Kiểm soát đường huyết cho bệnh đái tháo đường type 2',
  remainingCount: 56,
  expiryDate: '2027-06-30',
  category: 'Diabetes',
};

export const MED_ATORVASTATIN: Medicine = {
  id: 'med-atorvastatin-20',
  name: 'Atorvastatin 20mg',
  activeIngredient: 'Atorvastatin calcium',
  dosage: '1 viên',
  mealTiming: 'after_meal',
  instructions: 'Uống buổi tối sau ăn no, tránh dùng cùng bưởi chùm',
  purpose: 'Hạ mỡ máu, ổn định mảng xơ vữa động mạch',
  remainingCount: 30,
  expiryDate: '2026-10-15',
  category: 'Tim mạch & Mỡ máu',
};

export const MED_ASPIRIN: Medicine = {
  id: 'med-aspirin-81',
  name: 'Aspirin 81mg',
  activeIngredient: 'Acetylsalicylic acid',
  dosage: '1 viên',
  mealTiming: 'after_meal',
  instructions: 'Uống nguyên viên với nhiều nước sau ăn no',
  purpose: 'Chống kết tập tiểu cầu, phòng ngừa huyết khối tim mạch',
  remainingCount: 45,
  expiryDate: '2026-12-31',
  category: 'Tim mạch & Chống đông',
};

export const MED_LOSARTAN: Medicine = {
  id: 'med-losartan-50',
  name: 'Losartan 50mg',
  activeIngredient: 'Losartan potassium',
  dosage: '1 viên',
  mealTiming: 'after_meal',
  instructions: 'Uống vào buổi sáng, kiểm soát huyết áp ổn định',
  purpose: 'Điều trị tăng huyết áp vô căn, bảo vệ thận',
  remainingCount: 30,
  expiryDate: '2027-08-15',
  category: 'Blood Pressure',
};

export const MED_ENALAPRIL: Medicine = {
  id: 'med-enalapril-10',
  name: 'Enalapril 10mg',
  activeIngredient: 'Enalapril maleate',
  dosage: '1 viên',
  mealTiming: 'after_meal',
  instructions: 'Uống 1 lần/ngày theo chỉ định',
  purpose: 'Hạ huyết áp và điều trị suy tim',
  remainingCount: 20,
  expiryDate: '2027-10-20',
  category: 'Blood Pressure',
};

export const MED_OMEPRAZOLE: Medicine = {
  id: 'med-omeprazole-20',
  name: 'Omeprazole 20mg',
  activeIngredient: 'Omeprazole',
  dosage: '1 viên',
  mealTiming: 'before_meal',
  instructions: 'Uống nguyên viên trước bữa ăn sáng 30 phút',
  purpose: 'Ức chế bơm proton, giảm tiết acid dạ dày',
  remainingCount: 14,
  expiryDate: '2026-08-20',
  category: 'Stomach',
};

export const MED_PARACETAMOL: Medicine = {
  id: 'med-paracetamol-500',
  name: 'Paracetamol 500mg',
  activeIngredient: 'Paracetamol',
  dosage: '1-2 viên',
  mealTiming: 'after_meal',
  instructions: 'Uống khi sốt > 38.5°C hoặc đau nhức, cách nhau 4-6 giờ',
  purpose: 'Giảm đau nhẹ đến vừa, hạ sốt nhanh chóng',
  remainingCount: 20,
  expiryDate: '2027-12-31',
  category: 'Pain Relief',
};

export const MED_AUGMENTIN: Medicine = {
  id: 'med-augmentin-1g',
  name: 'Augmentin 1g',
  activeIngredient: 'Amoxicillin + Clavulanic acid',
  dosage: '1 viên',
  mealTiming: 'with_meal',
  instructions: 'Uống ngay đầu bữa ăn, dùng đủ liệu trình 7 ngày',
  purpose: 'Kháng sinh điều trị nhiễm khuẩn đường hô hấp',
  remainingCount: 14,
  expiryDate: '2026-05-15',
  category: 'Antibiotics',
};

// Initial Dose Slots (Today Schedule)
export const MOCK_SCHEDULE: DoseSlot[] = [
  {
    slot: 'morning',
    timeLabel: '08:00',
    medicines: [{ ...MED_AMLODIPINE }, { ...MED_METFORMIN }],
    isTaken: false,
    takenAt: undefined,
  },
  {
    slot: 'noon',
    timeLabel: '12:30',
    medicines: [{ ...MED_METFORMIN }],
    isTaken: false,
    takenAt: undefined,
  },
  {
    slot: 'evening',
    timeLabel: '20:00',
    medicines: [{ ...MED_ATORVASTATIN }],
    isTaken: false,
    takenAt: undefined,
  },
];

// Initial Family Medicine Cabinet
export const MOCK_CABINET: Medicine[] = [
  { ...MED_ASPIRIN },
  { ...MED_AMLODIPINE },
  { ...MED_LOSARTAN },
  { ...MED_ENALAPRIL },
  { ...MED_METFORMIN },
  { ...MED_ATORVASTATIN },
  { ...MED_OMEPRAZOLE },
  { ...MED_PARACETAMOL },
  { ...MED_AUGMENTIN },
];

// Preset 1: Routine Hypertension + Diabetes (Zero conflicts)
export const MOCK_ANALYSIS_PRESET_1: PrescriptionAnalysisResult = {
  scanType: 'prescription',
  isValidPrescription: true,
  patientName: 'Bố (Ông Hùng)',
  patientAge: 65,
  prescriptionDate: '2026-11-05',
  doctorName: 'BS.CKII Trần Văn Minh (Khoa Tim Mạch - Nội Tiết)',
  diagnosis: 'Tăng huyết áp vô căn độ 2 / Đái tháo đường type 2',
  medicines: [
    {
      ...MED_AMLODIPINE,
      timeSlots: ['morning'],
    },
    {
      ...MED_METFORMIN,
      timeSlots: ['morning', 'noon'],
    },
    {
      ...MED_ATORVASTATIN,
      timeSlots: ['evening'],
    },
  ],
  warnings: [],
};

// Preset 2: Antibiotics + Gastric with dual-layer interaction conflict
export const MOCK_ANALYSIS_PRESET_2: PrescriptionAnalysisResult = {
  scanType: 'prescription',
  isValidPrescription: true,
  patientName: 'Trần Trung',
  patientAge: 40,
  prescriptionDate: '2024-09-29',
  doctorName: 'BS. Lê Thị Mai (Khoa Tiêu Hóa - Nhiễm)',
  diagnosis: 'Viêm dạ dày cấp kèm nhiễm khuẩn tiêu hóa',
  medicines: [
    {
      id: 'med-ciprofloxacin-500',
      name: 'Ciprofloxacin 500mg',
      activeIngredient: 'Ciprofloxacin hydrochloride',
      dosage: '1 viên',
      mealTiming: 'before_meal',
      instructions: 'Uống trước ăn 1 giờ hoặc sau ăn 2 giờ, uống nhiều nước',
      purpose: 'Kháng sinh nhóm Fluoroquinolone diệt khuẩn đường ruột',
      remainingCount: 20,
      expiryDate: '2026-09-30',
      category: 'Antibiotics',
      timeSlots: ['morning', 'evening'],
    },
    {
      id: 'med-gaviscon-10',
      name: 'Gaviscon Dual Action 10ml',
      activeIngredient: 'Sodium alginate + Calcium carbonate',
      dosage: '1 gói (10ml)',
      mealTiming: 'after_meal',
      instructions: 'Uống sau bữa ăn và trước khi đi ngủ',
      purpose: 'Tạo màng gel ngăn trào ngược dạ dày thực quản, giảm ợ chua',
      remainingCount: 24,
      expiryDate: '2027-01-15',
      category: 'Stomach',
      timeSlots: ['morning', 'noon', 'evening'],
    },
  ],
  warnings: [
    {
      id: 'warn-cipro-gaviscon',
      source: 'internal_prescription',
      medicineA: 'Ciprofloxacin 500mg',
      medicineB: 'Gaviscon Dual Action 10ml',
      severity: 'high',
      description:
        'Tương tác ion kim loại chelate: Antacid trong Gaviscon (chứa Canxi carbonat) tạo phức chelate không tan với Ciprofloxacin, làm giảm tới 85% nồng độ kháng sinh hấp thu vào máu.',
      clinicalRecommendation:
        'Uống Ciprofloxacin tối thiểu 2 giờ trước hoặc 4 giờ sau khi dùng Gaviscon để đảm bảo hiệu lực diệt khuẩn tối đa.',
    },
    {
      id: 'warn-gaviscon-aspirin',
      source: 'cabinet_conflict',
      medicineA: 'Gaviscon Dual Action 10ml',
      medicineB: 'Aspirin 81mg',
      severity: 'moderate',
      description:
        'Xung đột Tủ Thuốc Gia Đình: Chất kháng acid trong Gaviscon làm kiềm hóa dịch dạ dày, khiến lớp màng bao tan trong ruột của Aspirin 81mg bị rã sớm ngay tại dạ dày, gây kích ứng niêm mạc và tăng nguy cơ xuất huyết.',
      clinicalRecommendation:
        'Uống cách nhau tối thiểu 2 giờ. Dùng Aspirin sau bữa ăn no và dùng Gaviscon khi xuất hiện triệu chứng trào ngược.',
    },
  ],
};

// Luồng 3: Quét 1 loại thuốc lẻ / vỉ / hộp thuốc
export const MOCK_ANALYSIS_SINGLE_MEDICINE: PrescriptionAnalysisResult = {
  scanType: 'single_medicine',
  isValidPrescription: true,
  medicines: [],
  warnings: [],
  singleMedicine: {
    id: 'med-panadol-extra-500',
    name: 'Panadol Extra Đỏ 500mg/65mg',
    activeIngredient: 'Paracetamol 500mg + Caffeine 65mg',
    dosage: '1 - 2 viên',
    mealTiming: 'after_meal',
    instructions: 'Uống sau bữa ăn với một ly nước đầy, cách nhau ít nhất 4 - 6 giờ',
    purpose: 'Hạ sốt nhanh, giảm đau đầu dữ dội, đau nửa đầu, đau cơ khớp',
    remainingCount: 16,
    expiryDate: '2027-05-31',
    category: 'Pain Relief',
    origin: 'GlaxoSmithKline (GSK) - Dung Hợp Anh Quốc',
    recommendedDosage: 'Người lớn: 1-2 viên/lần, tối đa 8 viên trong 24 giờ. Không dùng cùng lúc các thuốc chứa Paracetamol khác.',
    indications: 'Điều trị các cơn đau từ nhẹ đến vừa kèm sốt mệt mỏi.',
    timeSlots: ['morning', 'noon'],
  },
};

// Luồng 1: Quét thất bại (chữ xấu / mờ / không phải thuốc)
export const MOCK_ANALYSIS_UNRECOGNIZED: PrescriptionAnalysisResult = {
  scanType: 'unrecognized',
  isValidPrescription: false,
  medicines: [],
  warnings: [],
  errorMessage:
    'Hình ảnh quá mờ hoặc không phát hiện đơn thuốc/bao bì thuốc hợp lệ. Hãy chụp lại ảnh rõ nét hơn hoặc bấm Tự nhập thuốc bằng tay.',
};

// Family Members & Multi-Profile Support
export const MOCK_FAMILY_MEMBERS: FamilyMember[] = [
  {
    id: 'tam',
    name: 'Tâm',
    relation: 'Tôi',
    avatarColor: '#2563EB',
    role: 'caregiver',
    healthProfile: {
      bloodType: 'O+',
      dobYear: 1991,
      gender: 'Nam',
      chronicConditions: ['Dạ dày trào ngược (GERD)'],
      allergies: ['Không ghi nhận dị ứng thuốc'],
      metrics: {
        bloodPressure: '118/76 mmHg',
        bloodSugar: '5.2 mmol/L',
        heartRate: '72 bpm',
        weight: '68 kg',
        height: '172 cm',
      },
      doctorNotes: 'Sức khỏe tổng quát tốt. Cần duy trì ăn uống đúng giờ để giảm trào ngược dịch vị dạ dày.',
      emergencyContact: '0912 345 678',
    },
  },
  {
    id: 'bo',
    name: 'Bố (Ông Hùng)',
    relation: 'Bố - 65 tuổi',
    avatarColor: '#D97706',
    role: 'patient',
    healthProfile: {
      bloodType: 'A+',
      dobYear: 1961,
      gender: 'Nam',
      chronicConditions: ['Tăng huyết áp vô căn độ 2', 'Đái tháo đường type 2'],
      allergies: ['Dị ứng kháng sinh Penicillin', 'Kháng sinh nhóm Sulfonamide'],
      metrics: {
        bloodPressure: '135/85 mmHg',
        bloodSugar: '6.8 mmol/L',
        heartRate: '78 bpm',
        weight: '64 kg',
        height: '168 cm',
      },
      doctorNotes: 'Uống Amlodipine và Metformin đều đặn mỗi sáng. Hạn chế ăn mặn, tái khám tim mạch mỗi 3 tháng.',
      emergencyContact: '0903 112 233',
    },
  },
  {
    id: 'me',
    name: 'Mẹ (Bà Mai)',
    relation: 'Mẹ - 62 tuổi',
    avatarColor: '#7C3AED',
    role: 'patient',
    healthProfile: {
      bloodType: 'B+',
      dobYear: 1964,
      gender: 'Nữ',
      chronicConditions: ['Rối loạn lipid máu (Mỡ máu cao)', 'Thoái hóa khớp gối nhẹ'],
      allergies: ['Nhạy cảm Aspirin / NSAID (dễ viêm loét dạ dày)'],
      metrics: {
        bloodPressure: '125/82 mmHg',
        bloodSugar: '5.5 mmol/L',
        heartRate: '75 bpm',
        weight: '56 kg',
        height: '158 cm',
      },
      doctorNotes: 'Uống Atorvastatin sau bữa ăn tối. Tránh tự ý mua thuốc giảm đau chống viêm khớp NSAID.',
      emergencyContact: '0908 998 877',
    },
  },
];

// Sample 7-day Weekly Grid Matrix (Thứ 2 -> Chủ Nhật)
export const MOCK_WEEKLY_MATRIX = [
  { dayLabel: 'T2', dateLabel: '09', morning: true, noon: true, evening: true },
  { dayLabel: 'T3', dateLabel: '10', morning: true, noon: true, evening: true },
  { dayLabel: 'T4', dateLabel: '11', morning: true, noon: false, evening: true }, // Missed noon dose
  { dayLabel: 'T5', dateLabel: '12', morning: true, noon: true, evening: null, isToday: true }, // Today
  { dayLabel: 'T6', dateLabel: '13', morning: null, noon: null, evening: null },
  { dayLabel: 'T7', dateLabel: '14', morning: null, noon: null, evening: null },
  { dayLabel: 'CN', dateLabel: '15', morning: null, noon: null, evening: null },
];
