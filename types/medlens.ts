export type TimeSlot = 'morning' | 'noon' | 'evening';
export type MealTiming = 'before_meal' | 'after_meal' | 'with_meal';
export type ConflictSeverity = 'low' | 'moderate' | 'high' | 'critical';
export type ScanFlowType = 'prescription' | 'single_medicine' | 'unrecognized';

export interface Medicine {
  id: string;
  name: string;
  activeIngredient: string;
  dosage: string;
  mealTiming: MealTiming;
  instructions: string;
  purpose: string;
  remainingCount: number;
  expiryDate: string | null; // YYYY-MM-DD or null if unknown
  category: string; // Huyết áp, Dạ dày, Tiểu đường, Tim mạch & Mỡ máu, v.v.
  isTaken?: boolean; // Individual dose state
  isSkipped?: boolean; // Dose skipped by user
  snoozedUntil?: string; // Time snoozed until, e.g. "07:40"
  ownerId?: string; // 'tam' | 'bo' | 'me' | 'shared' (Tủ dự phòng chung)
  treatmentCourse?: string; // Đợt thuốc / Liệu trình theo dõi định kỳ
}

export interface SingleMedicineDetail extends Medicine {
  origin?: string; // Xuất xứ / Nhà sản xuất (VD: GlaxoSmithKline - Anh Quốc)
  recommendedDosage?: string; // Liều dùng khuyến cáo
  indications?: string; // Công dụng điều trị chính
  timeSlots?: TimeSlot[];
}

export interface DoseSlot {
  slot: TimeSlot;
  timeLabel: string; // "08:00", "12:30", "20:00"
  medicines: Medicine[];
  isTaken: boolean;
  takenAt?: string; // ISO string
}

export interface InteractionWarning {
  id: string;
  source: 'internal_prescription' | 'cabinet_conflict';
  medicineA: string;
  medicineB: string;
  severity: ConflictSeverity;
  description: string;
  clinicalRecommendation: string;
}

export interface PrescriptionAnalysisResult {
  scanType?: ScanFlowType;
  isValidPrescription?: boolean;
  isHandwritten?: boolean;
  handwritingWarning?: string;
  patientName?: string | null;
  patientAge?: number | null;
  prescriptionDate?: string | null;
  doctorName?: string | null;
  diagnosis?: string | null;
  medicines: (Medicine & { timeSlots: TimeSlot[] })[];
  warnings: InteractionWarning[];
  singleMedicine?: SingleMedicineDetail;
  errorMessage?: string;
}

export interface HealthMetrics {
  bloodPressure?: string; // e.g. "125/80 mmHg"
  bloodSugar?: string; // e.g. "5.8 mmol/L"
  heartRate?: string; // e.g. "72 bpm"
  weight?: string; // e.g. "68 kg"
  height?: string; // e.g. "170 cm"
}

export interface HealthProfile {
  bloodType?: string; // "O+", "A+", "B+", "AB+", "Chưa rõ"
  dobYear?: number; // e.g. 1961
  gender?: 'Nam' | 'Nữ' | 'Khác';
  chronicConditions: string[]; // Bệnh lý nền: ["Tăng huyết áp độ 2", "Đái tháo đường type 2"]
  allergies: string[]; // Dị ứng & Chống chỉ định: ["Dị ứng Penicillin", "Nhạy cảm NSAID"]
  metrics?: HealthMetrics;
  doctorNotes?: string;
  emergencyContact?: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  avatarColor?: string;
  role?: 'patient' | 'caregiver';
  healthProfile?: HealthProfile;
  mealTimes?: MealTimes;
}

export interface MealTimes {
  breakfast: string; // "07:00"
  lunch: string;     // "12:00"
  dinner: string;    // "19:00"
}

export interface DayScheduleCell {
  dayLabel: string; // T2, T3, T4, T5, T6, T7, CN
  dateLabel: string; // 10, 11, 12...
  isToday?: boolean;
  morning: boolean | null; // true: taken, false: missed/pending, null: no med
  noon: boolean | null;
  evening: boolean | null;
}

export interface MedState {
  schedule: DoseSlot[];
  cabinet: Medicine[];
  selectedMedicine: Medicine | null;
  familyMembers: FamilyMember[];
  activeMemberId: string;
  notificationScope: 'all' | 'me';
  memberSchedules?: Record<string, DoseSlot[]>;
  mealTimes: MealTimes;
  notificationsEnabled: boolean;
  morningReminderEnabled: boolean;
  setMealTimes: (times: Partial<MealTimes>) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setMorningReminderEnabled: (enabled: boolean) => void;
  toggleDoseSlot: (slot: TimeSlot) => void;
  toggleMedicineTaken: (slot: TimeSlot, medicineId: string) => void;
  snoozeMedicine: (slot: TimeSlot, medicineId: string, minutes?: number) => void;
  skipMedicine: (slot: TimeSlot, medicineId: string) => void;
  importPrescription: (analysis: PrescriptionAnalysisResult) => void;
  addSingleMedicine: (
    medicine: Medicine,
    timeSlots?: TimeSlot[],
    addToCabinet?: boolean,
    addToSchedule?: boolean,
    memberId?: string
  ) => void;
  addMedicines: (
    medicines: (Medicine & { timeSlots: TimeSlot[] })[],
    addToCabinet: boolean,
    addToSchedule: boolean,
    memberId?: string
  ) => void;
  updateMedicine: (medicineOrId: Medicine | string, updates?: Partial<Medicine>) => void;
  removeMedicineFromCabinet: (medicineId: string) => void;
  resetToDemo: () => void;
  setSelectedMedicine: (medicine: Medicine | null) => void;
  setActiveMember: (memberId: string) => void;
  addFamilyMember: (name: string, relation: string, healthProfile?: HealthProfile, mealTimes?: MealTimes) => void;
  updateHealthProfile: (memberId: string, profile: Partial<HealthProfile>) => void;
  setNotificationScope: (scope: 'all' | 'me') => void;
  updateMemberMealTimes?: (memberId: string, times: Partial<MealTimes>) => void;
  updateMedicineCount?: (medicineId: string, count: number) => void;
}
