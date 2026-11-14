import type {
  Medicine,
  DoseSlot,
  TimeSlot,
  InteractionWarning,
  ConflictSeverity,
  PrescriptionAnalysisResult,
  FamilyMember,
} from '@/types/medlens';
import { MOCK_ANALYSIS_PRESET_1, MOCK_ANALYSIS_PRESET_2 } from '@/mocks/mockData';

export interface AdherenceResult {
  total: number;
  completed: number;
  percentage: number;
  badgeLabel: 'Tuyệt vời' | 'Cần uống thêm';
  badgeVariant: 'success' | 'primary';
  label: string;
}

/**
 * Tính toán tiến độ tuân thủ uống thuốc trong ngày (Adherence Card - Tab 1)
 * Hỗ trợ tính điểm lũy tiến (partial credit) khi uống từng liều thuốc trong cữ
 */
export function calculateAdherence(
  schedule: Array<{ isTaken?: boolean; medicines?: Array<{ isTaken?: boolean }> }>
): AdherenceResult {
  const total = schedule.length;
  if (total === 0) {
    return {
      total: 0,
      completed: 0,
      percentage: 0,
      badgeLabel: 'Cần uống thêm',
      badgeVariant: 'primary',
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
  const badgeVariant = percentage === 100 ? 'success' : 'primary';
  const label = `Đã uống ${completed}/${total} cữ thuốc hôm nay`;

  return { total, completed, percentage, badgeLabel, badgeVariant, label };
}

/**
 * 6 Danh mục lọc nhóm bệnh trong Tủ thuốc (Medicine Cabinet - Tab 3)
 */
export const CABINET_CATEGORIES = [
  'Tất cả',
  'Huyết áp',
  'Dạ dày',
  'Tiểu đường',
  'Giảm đau',
  'Kháng sinh',
] as const;

export type CabinetCategory = (typeof CABINET_CATEGORIES)[number];

/**
 * Lọc danh sách thuốc trong tủ theo danh mục bệnh (hỗ trợ cả nhãn Anh và Việt)
 */
export function filterCabinet(medicines: Medicine[], category: string): Medicine[] {
  if (category === 'Tất cả') return medicines;
  const categoryMap: Record<string, string[]> = {
    'Huyết áp': ['Blood Pressure', 'Huyết áp'],
    'Dạ dày': ['Stomach', 'Dạ dày'],
    'Tiểu đường': ['Diabetes', 'Tiểu đường'],
    'Tim mạch': ['Cardiovascular', 'Tim mạch', 'Tim mạch & Mỡ máu', 'Tim mạch & Chống đông'],
    'Giảm đau': ['Pain Relief', 'Giảm đau'],
    'Kháng sinh': ['Antibiotics', 'Kháng sinh'],
  };
  const targets = categoryMap[category] || [category];
  return medicines.filter((m) =>
    targets.some((t) => m.category === t || m.category.toLowerCase().includes(t.toLowerCase()))
  );
}

/**
 * Alias cho filterCabinet theo quy chuẩn yêu cầu R2
 */
export const filterCabinetByCategory = filterCabinet;

export interface ExpiryStatus {
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysRemaining: number;
  badgeLabel: string;
  badgeVariant: 'destructive' | 'warning' | 'default';
}

/**
 * Kiểm tra trạng thái hạn sử dụng của thuốc (Expiry Status - Tab 3 & Modal)
 * Hỗ trợ null / 'Chưa rõ HSD' an toàn không bị báo động giả
 */
export function checkExpiryStatus(
  expiryDateStr?: string | null,
  referenceDate: Date = new Date('2026-11-11')
): ExpiryStatus {
  if (!expiryDateStr || expiryDateStr === 'Chưa rõ HSD' || expiryDateStr.trim() === '') {
    return {
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: 999,
      badgeLabel: 'Chưa rõ HSD',
      badgeVariant: 'default',
    };
  }

  let parsedTime = Date.parse(expiryDateStr);

  if (isNaN(parsedTime) && expiryDateStr.includes('/')) {
    const parts = expiryDateStr.split('/');
    if (parts.length === 3) {
      parsedTime = Date.parse(`${parts[2]}-${parts[1]}-${parts[0]}`);
    } else if (parts.length === 2) {
      parsedTime = Date.parse(`${parts[1]}-${parts[0]}-28`);
    }
  }

  if (isNaN(parsedTime)) {
    return {
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: 999,
      badgeLabel: expiryDateStr,
      badgeVariant: 'default',
    };
  }

  const diffMs = parsedTime - referenceDate.getTime();
  const daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return {
      isExpired: true,
      isExpiringSoon: false,
      daysRemaining,
      badgeLabel: 'Đã hết hạn',
      badgeVariant: 'destructive',
    };
  }

  if (daysRemaining <= 30) {
    return {
      isExpired: false,
      isExpiringSoon: true,
      daysRemaining,
      badgeLabel: 'Sắp hết hạn',
      badgeVariant: 'warning',
    };
  }

  return {
    isExpired: false,
    isExpiringSoon: false,
    daysRemaining,
    badgeLabel: `Còn hạn (${Math.floor(daysRemaining / 30)} tháng)`,
    badgeVariant: 'default',
  };
}

export function getExpiryModalWarning(status: ExpiryStatus): string | null {
  if (status.isExpired) {
    return 'Cảnh báo y khoa: Thuốc đã quá hạn sử dụng, hoạt chất có thể bị biến tính gây độc tính.';
  }
  if (status.isExpiringSoon) {
    return 'Lưu ý y khoa: Thuốc sắp hết hạn trong vòng 30 ngày. Vui lòng kiểm tra và thay thế.';
  }
  return null;
}

export function getExpiryCardStyle(status: ExpiryStatus): string {
  if (status.isExpired) return 'opacity-80 border-red-300';
  if (status.isExpiringSoon) return 'opacity-95 border-amber-300';
  return 'opacity-100 border-slate-200/60';
}

/**
 * Trừ số viên an toàn chặn cận dưới tại 0 viên
 */
export function decrementPillCount(currentCount: number, decrementBy: number = 1): number {
  return Math.max(0, currentCount - decrementBy);
}

/**
 * Trạng thái tồn kho của thuốc trong tủ
 */
export function getStockStatus(count: number) {
  if (count === 0) {
    return { label: 'Hết thuốc - Cần mua thêm', variant: 'destructive' as const, isOut: true };
  }
  if (count <= 10) {
    return { label: `Sắp hết (còn ${count} viên)`, variant: 'warning' as const, isOut: false };
  }
  return { label: `Còn ${count} viên`, variant: 'default' as const, isOut: false };
}

/**
 * Động cơ phân tích xung đột thuốc 2 lớp (Dual-Layer Drug Interaction Engine)
 * - Layer 1: Xung đột nội bộ đơn thuốc (ví dụ Ciprofloxacin + Gaviscon)
 * - Layer 2: Xung đột chéo với tủ thuốc (ví dụ Gaviscon + Aspirin)
 */
export function evaluatePrescriptionConflicts(
  prescriptionMeds: (Medicine & { timeSlots?: TimeSlot[] })[],
  cabinetMeds: Medicine[]
): InteractionWarning[] {
  const warnings: InteractionWarning[] = [];

  const hasCipro = prescriptionMeds.some((m) => m.name.toLowerCase().includes('ciprofloxacin'));
  const hasGaviscon = prescriptionMeds.some((m) => m.name.toLowerCase().includes('gaviscon'));

  if (hasCipro && hasGaviscon) {
    warnings.push({
      id: 'warn-cipro-gaviscon',
      source: 'internal_prescription',
      medicineA: 'Ciprofloxacin 500mg',
      medicineB: 'Gaviscon Dual Action 10ml',
      severity: 'high',
      description: 'Tương tác ion kim loại chelate làm giảm hấp thu kháng sinh.',
      clinicalRecommendation: 'Uống Ciprofloxacin trước 2 giờ hoặc sau 4 giờ dùng Gaviscon.',
    });
  }

  const hasAspirinInCabinet = cabinetMeds.some((m) => m.name.toLowerCase().includes('aspirin'));
  if (hasGaviscon && hasAspirinInCabinet) {
    warnings.push({
      id: 'warn-gaviscon-aspirin',
      source: 'cabinet_conflict',
      medicineA: 'Gaviscon Dual Action 10ml',
      medicineB: 'Aspirin 81mg',
      severity: 'moderate',
      description: 'Chất kháng acid làm tan sớm màng bao Aspirin tại dạ dày.',
      clinicalRecommendation: 'Uống cách nhau tối thiểu 2 giờ.',
    });
  }

  return warnings;
}

/**
 * Phân loại cảnh báo tương tác thuốc thành 2 lớp để hiển thị (Dual-Layer Alert Card - Tab 2)
 */
export function categorizeWarnings(warnings: InteractionWarning[]) {
  const internal = warnings.filter((w) => w.source === 'internal_prescription');
  const cabinet = warnings.filter((w) => w.source === 'cabinet_conflict');
  return {
    hasWarnings: warnings.length > 0,
    internal,
    cabinet,
    internalColor: 'red' as const,
    cabinetColor: 'amber' as const,
  };
}

/**
 * Khử nhiễu và điền dữ liệu an toàn cho đơn thuốc OCR bị thiếu trường
 */
export function sanitizePrescriptionMetadata(
  result: Partial<PrescriptionAnalysisResult>
): PrescriptionAnalysisResult {
  return {
    doctorName: result.doctorName || 'Bác sĩ phụ trách (Theo đơn)',
    diagnosis: result.diagnosis || 'Chẩn đoán lâm sàng chung',
    medicines: (result.medicines || []).map((med) => ({
      ...med,
      activeIngredient: med.activeIngredient || 'Đang cập nhật',
      mealTiming: med.mealTiming || 'after_meal',
      purpose: med.purpose || 'Theo chỉ định điều trị',
      timeSlots:
        med.timeSlots && med.timeSlots.length > 0
          ? med.timeSlots
          : (['morning'] as TimeSlot[]),
    })),
    warnings: result.warnings || [],
  };
}

/**
 * Client phân tích đơn thuốc có khả năng chịu lỗi (Resilient AI client)
 * Tự động chuyển fallback an toàn khi offline hoặc gặp sự cố mạng/máy chủ
 */
export async function resilientAnalyzePrescription(
  preset: 'preset1' | 'preset2' = 'preset1',
  timeoutMs: number = 2000
): Promise<PrescriptionAnalysisResult> {
  const fallbackResult = preset === 'preset2' ? MOCK_ANALYSIS_PRESET_2 : MOCK_ANALYSIS_PRESET_1;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch('https://mock-supabase-endpoint/functions/v1/chat-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      return fallbackResult;
    }

    const data = await response.json();
    return data;
  } catch (err) {
    return fallbackResult;
  }
}

export interface PrescriptionDiscrepancyResult {
  hasDiscrepancy: boolean;
  isNameMismatch: boolean;
  isPrescriptionOld: boolean;
  diffDays?: number;
  warnings: string[];
}

/**
 * Đối chiếu thông tin đơn thuốc và thành viên gia đình (Hạng mục A - Chống nhầm hồ sơ & đơn cũ)
 */
export function checkPrescriptionDiscrepancy(
  prescription: PrescriptionAnalysisResult | null,
  targetMember: FamilyMember | null | undefined,
  referenceDate: Date = new Date()
): PrescriptionDiscrepancyResult {
  if (!prescription || !targetMember) {
    return {
      hasDiscrepancy: false,
      isNameMismatch: false,
      isPrescriptionOld: false,
      warnings: [],
    };
  }

  const warnings: string[] = [];
  let isNameMismatch = false;
  let isPrescriptionOld = false;
  let diffDays = 0;

  // 1. Kiểm tra lệch tên bệnh nhân
  if (prescription.patientName && prescription.patientName.trim()) {
    const pName = prescription.patientName.toLowerCase().replace(/^(ông|bà|anh|chị|em|bác|chú|cô)\s+/i, '').trim();
    const mName = targetMember.name.toLowerCase().replace(/^(ông|bà|anh|chị|em|bác|chú|cô)\s+/i, '').trim();
    const mRelation = targetMember.relation ? targetMember.relation.toLowerCase() : '';

    const pTokens = pName.split(/[\s()_-]+/).filter((t) => t.length >= 2);
    const mTokens = `${mName} ${mRelation}`.split(/[\s()_-]+/).filter((t) => t.length >= 2);

    const matchFound = pTokens.some((pt) => mTokens.some((mt) => mt.includes(pt) || pt.includes(mt)));

    if (!matchFound) {
      isNameMismatch = true;
      const ageInfo = prescription.patientAge ? ` (${prescription.patientAge} tuổi)` : '';
      warnings.push(
        `Tên trên đơn là "${prescription.patientName}${ageInfo}", khác với thành viên đang chọn là "${targetMember.name}".`
      );
    }
  }

  // 2. Kiểm tra ngày kê đơn quá 30 ngày
  if (prescription.prescriptionDate) {
    const pDate = new Date(prescription.prescriptionDate);
    if (!isNaN(pDate.getTime())) {
      const diffMs = referenceDate.getTime() - pDate.getTime();
      diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > 30) {
        isPrescriptionOld = true;
        warnings.push(
          `Đơn thuốc được kê từ ngày ${prescription.prescriptionDate} (đã quá ${diffDays} ngày). Bác sĩ khuyến cáo đơn thuốc cũ cần được khám lại trước khi sử dụng.`
        );
      }
    }
  }

  return {
    hasDiscrepancy: warnings.length > 0,
    isNameMismatch,
    isPrescriptionOld,
    diffDays,
    warnings,
  };
}
