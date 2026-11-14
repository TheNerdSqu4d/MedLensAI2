import { defineTest, assert } from '../../harness/testContext';
import { StoreTestHarness } from '../../harness/storeTestHarness';
import { MED_PARACETAMOL, MED_METFORMIN, MED_ASPIRIN } from '@/mocks/mockData';
import type { Medicine } from '@/types/medlens';
import {
  checkExpiryStatus,
  type ExpiryStatus,
  getExpiryModalWarning,
  getExpiryCardStyle,
} from '@/services/clinical';

export { checkExpiryStatus, type ExpiryStatus, getExpiryModalWarning, getExpiryCardStyle };

export interface MedicineModalPresentation {
  medicineId: string;
  name: string;
  expiryDate: string | null;
  isExpired: boolean;
  clinicalAdvisoryBanner: {
    title: string;
    description: string;
    severity: 'danger' | 'default';
  } | null;
}

export function formatMedicineModalAdvisory(
  medicine: Medicine,
  referenceDate: Date = new Date('2026-11-11')
): MedicineModalPresentation {
  const expiry = checkExpiryStatus(medicine.expiryDate, referenceDate);
  if (expiry.isExpired) {
    return {
      medicineId: medicine.id,
      name: medicine.name,
      expiryDate: medicine.expiryDate,
      isExpired: true,
      clinicalAdvisoryBanner: {
        title: 'CẢNH BÁO Y KHOA: THUỐC ĐÃ QUÁ HẠN',
        description: `Thuốc ${medicine.name} đã hết hạn vào ${medicine.expiryDate}. Hoạt chất có thể đã bị biến tính hoặc giảm hiệu lực sinh học. Khuyến cáo không tự ý sử dụng và tiêu hủy đúng quy định.`,
        severity: 'danger',
      },
    };
  }
  return {
    medicineId: medicine.id,
    name: medicine.name,
    expiryDate: medicine.expiryDate,
    isExpired: false,
    clinicalAdvisoryBanner: null,
  };
}

export interface CabinetCardVisualPresentation {
  medicineId: string;
  name: string;
  isExpired: boolean;
  containerClasses: string;
  badgeLabel: string;
  badgeVariant: 'danger' | 'warning' | 'default';
}

export function computeCabinetCardVisuals(
  medicine: Medicine,
  referenceDate: Date = new Date('2026-11-11')
): CabinetCardVisualPresentation {
  const status = checkExpiryStatus(medicine.expiryDate, referenceDate);
  const baseClasses =
    'flex-row items-center justify-between p-4 rounded-2xl bg-white shadow-sm border';

  let modifierClasses = 'border-slate-200/60 opacity-100';
  let badgeVariant: 'danger' | 'warning' | 'default' = 'default';

  if (status.isExpired) {
    modifierClasses = 'border-red-300 opacity-80 bg-red-50/20';
    badgeVariant = 'danger';
  } else if (status.isExpiringSoon) {
    modifierClasses = 'border-amber-300 opacity-100 bg-amber-50/10';
    badgeVariant = 'warning';
  }

  return {
    medicineId: medicine.id,
    name: medicine.name,
    isExpired: status.isExpired,
    containerClasses: `${baseClasses} ${modifierClasses}`,
    badgeLabel: status.badgeLabel,
    badgeVariant,
  };
}

// T2-EXP-01: Detect expired medicines (past date)
defineTest(
  'T2-EXP-01',
  2,
  'Expired Medicines Boundary',
  'Phát hiện thuốc quá hạn hiển thị nhãn Đã hết hạn với variant destructive',
  async () => {
    const status = checkExpiryStatus('2024-01-01', new Date('2026-11-11'));
    assert.equal(status.isExpired, true);
    assert.equal(status.badgeLabel, 'Đã hết hạn');
    assert.equal(status.badgeVariant, 'destructive');
  }
);

// T2-EXP-02: Detect expiring soon (< 30 days)
defineTest(
  'T2-EXP-02',
  2,
  'Expired Medicines Boundary',
  'Phát hiện thuốc sắp hết hạn (trong vòng 30 ngày) hiển thị Sắp hết hạn',
  async () => {
    const status = checkExpiryStatus('2026-11-25', new Date('2026-11-11')); // 14 days
    assert.equal(status.isExpired, false);
    assert.equal(status.isExpiringSoon, true);
    assert.equal(status.badgeLabel, 'Sắp hết hạn');
    assert.equal(status.badgeVariant, 'warning');
  }
);

// T2-EXP-03: Diverse date string formats
defineTest(
  'T2-EXP-03',
  2,
  'Expired Medicines Boundary',
  'Xử lý an toàn các định dạng chuỗi HSD khác nhau không văng lỗi Invalid Date',
  async () => {
    const ref = new Date('2026-11-11');
    const s1 = checkExpiryStatus('2026-12-31', ref);
    const s2 = checkExpiryStatus('25/11/2026', ref);
    const s3 = checkExpiryStatus('12/2026', ref);
    const s4 = checkExpiryStatus('Unknown Date String', ref);

    assert.equal(s1.isExpired, false);
    assert.equal(s2.isExpiringSoon, true);
    assert.ok(!isNaN(s3.daysRemaining));
    assert.equal(s4.badgeLabel, 'Unknown Date String');
  }
);

// T2-EXP-04: Expired medicine warning banner in modal
defineTest(
  'T2-EXP-04',
  2,
  'Expired Medicines Boundary',
  'Cảnh báo quá hạn trong Modal chi tiết khuyến cáo không tự ý sử dụng',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    // 1. Select an expired medicine in store
    const expiredMed: Medicine = {
      ...MED_PARACETAMOL,
      id: 'med-paracetamol-expired',
      name: 'Paracetamol 500mg (Hết Hạn)',
      expiryDate: '2024-05-01',
    };
    state.setSelectedMedicine(expiredMed);

    const selectedFromStore = (await StoreTestHarness.getState()).selectedMedicine!;
    assert.ok(selectedFromStore, 'Store selectedMedicine must be populated');

    // Generate modal presentation
    const expiredAdvisory = formatMedicineModalAdvisory(selectedFromStore);
    assert.equal(expiredAdvisory.isExpired, true, 'isExpired must be true');
    assert.ok(
      expiredAdvisory.clinicalAdvisoryBanner !== null,
      'Advisory banner must be present for expired medicine'
    );
    assert.equal(
      expiredAdvisory.clinicalAdvisoryBanner!.severity,
      'danger',
      'Advisory banner severity must be danger'
    );
    assert.includes(
      expiredAdvisory.clinicalAdvisoryBanner!.description,
      'Paracetamol 500mg (Hết Hạn)'
    );
    assert.includes(expiredAdvisory.clinicalAdvisoryBanner!.description, '2024-05-01');
    assert.includes(expiredAdvisory.clinicalAdvisoryBanner!.description, 'không tự ý sử dụng');

    // 2. Select a valid medicine and verify advisory banner is null
    state.setSelectedMedicine(MED_METFORMIN);
    const validFromStore = (await StoreTestHarness.getState()).selectedMedicine!;
    const validAdvisory = formatMedicineModalAdvisory(validFromStore);
    assert.equal(validAdvisory.isExpired, false, 'isExpired must be false for valid medicine');
    assert.equal(
      validAdvisory.clinicalAdvisoryBanner,
      null,
      'Advisory banner must be null for valid medicine'
    );
  }
);

// T2-EXP-05: Visual distinction in cabinet list
defineTest(
  'T2-EXP-05',
  2,
  'Expired Medicines Boundary',
  'Phân biệt thị giác thuốc hết hạn trong danh sách (opacity-80 hoặc border cảnh báo)',
  async () => {
    const expiredMed: Medicine = {
      ...MED_ASPIRIN,
      expiryDate: '2022-01-01',
    };
    const validMed: Medicine = {
      ...MED_ASPIRIN,
      expiryDate: '2027-12-31',
    };

    const expiredVisuals = computeCabinetCardVisuals(expiredMed);
    const validVisuals = computeCabinetCardVisuals(validMed);

    // 1. Assert expired card styling attributes
    assert.equal(expiredVisuals.isExpired, true, 'isExpired must be true');
    assert.includes(
      expiredVisuals.containerClasses,
      'opacity-80',
      'Expired medicine card must have opacity-80'
    );
    assert.includes(
      expiredVisuals.containerClasses,
      'border-red-300',
      'Expired medicine card must have border-red-300'
    );
    assert.equal(expiredVisuals.badgeVariant, 'danger', 'Expired medicine badge variant must be danger');
    assert.equal(expiredVisuals.badgeLabel, 'Đã hết hạn', 'Expired medicine badge label must be Đã hết hạn');

    // 2. Assert valid card styling contrast (negative assertions)
    assert.equal(validVisuals.isExpired, false, 'isExpired must be false for valid medicine');
    assert.ok(
      !validVisuals.containerClasses.includes('opacity-80'),
      'Valid medicine card must NOT have opacity-80'
    );
    assert.ok(
      !validVisuals.containerClasses.includes('border-red-300'),
      'Valid medicine card must NOT have red border'
    );
    assert.equal(validVisuals.badgeVariant, 'default', 'Valid medicine badge variant must be default');

    // 3. Differential visual verification
    assert.notEqual(
      expiredVisuals.containerClasses,
      validVisuals.containerClasses,
      'Expired and valid cards must have distinct styling'
    );
  }
);
