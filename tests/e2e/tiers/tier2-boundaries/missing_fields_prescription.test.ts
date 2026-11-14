import { defineTest, assert } from '../../harness/testContext';
import { StoreTestHarness } from '../../harness/storeTestHarness';
import type { PrescriptionAnalysisResult, Medicine, TimeSlot } from '@/types/medlens';

export function sanitizePrescriptionMetadata(result: Partial<PrescriptionAnalysisResult>) {
  return {
    doctorName: result.doctorName || 'Bác sĩ phụ trách (Theo đơn)',
    diagnosis: result.diagnosis || 'Chẩn đoán lâm sàng chung',
    medicines: (result.medicines || []).map((med) => ({
      ...med,
      activeIngredient: med.activeIngredient || 'Đang cập nhật',
      mealTiming: med.mealTiming || 'after_meal',
      purpose: med.purpose || 'Theo chỉ định điều trị',
      timeSlots: med.timeSlots && med.timeSlots.length > 0 ? med.timeSlots : (['morning'] as TimeSlot[]),
    })),
    warnings: result.warnings || [],
  };
}

// T2-MSF-01: Missing patient name and diagnosis
defineTest(
  'T2-MSF-01',
  2,
  'Missing Fields in Prescription',
  'Thiếu tên bác sĩ / chẩn đoán được tự động thế bằng nhãn mặc định an toàn',
  async () => {
    const raw: Partial<PrescriptionAnalysisResult> = {
      medicines: [],
      warnings: [],
    };

    const sanitized = sanitizePrescriptionMetadata(raw);
    assert.equal(sanitized.doctorName, 'Bác sĩ phụ trách (Theo đơn)');
    assert.equal(sanitized.diagnosis, 'Chẩn đoán lâm sàng chung');
  }
);

// T2-MSF-02: Missing active ingredient
defineTest(
  'T2-MSF-02',
  2,
  'Missing Fields in Prescription',
  'Thuốc bị thiếu trường hoạt chất hiển thị Đang cập nhật không bị crash',
  async () => {
    const raw: Partial<PrescriptionAnalysisResult> = {
      medicines: [
        {
          id: 'partial-med-1',
          name: 'Thuốc Chưa Rõ Hoạt Chất',
          activeIngredient: '',
          dosage: '1 viên',
          mealTiming: 'after_meal',
          instructions: 'Uống sau ăn',
          purpose: 'Điều trị',
          remainingCount: 10,
          expiryDate: '2027-01-01',
          category: 'General',
          timeSlots: ['morning'],
        },
      ],
    };

    const sanitized = sanitizePrescriptionMetadata(raw);
    assert.equal(sanitized.medicines[0].activeIngredient, 'Đang cập nhật');
  }
);

// T2-MSF-03: Missing meal timing instructions
defineTest(
  'T2-MSF-03',
  2,
  'Missing Fields in Prescription',
  'Thiếu chỉ dẫn bữa ăn (mealTiming) được gán giá trị mặc định hợp lệ',
  async () => {
    const raw: any = {
      medicines: [
        {
          id: 'partial-med-2',
          name: 'Thuốc Không Rõ Bữa Ăn',
          dosage: '1 viên',
        },
      ],
    };

    const sanitized = sanitizePrescriptionMetadata(raw);
    assert.equal(sanitized.medicines[0].mealTiming, 'after_meal');
  }
);

// T2-MSF-04: Missing warnings array
defineTest(
  'T2-MSF-04',
  2,
  'Missing Fields in Prescription',
  'Toa JSON không có mảng warnings (undefined) được xử lý an toàn mảng rỗng []',
  async () => {
    const raw: any = {
      doctorName: 'BS Test',
      medicines: [],
      warnings: undefined,
    };

    const sanitized = sanitizePrescriptionMetadata(raw);
    assert.ok(Array.isArray(sanitized.warnings));
    assert.equal(sanitized.warnings.length, 0);
  }
);

// T2-MSF-05: Medicine with empty timeSlots
defineTest(
  'T2-MSF-05',
  2,
  'Missing Fields in Prescription',
  'Thuốc mới có timeSlots rỗng được xếp mặc định vào Cữ Sáng an toàn',
  async () => {
    const raw: any = {
      medicines: [
        {
          id: 'no-slot-med',
          name: 'Thuốc Chưa Gán Giờ',
          dosage: '1 viên',
          timeSlots: [],
        },
      ],
    };

    const sanitized = sanitizePrescriptionMetadata(raw);
    assert.includes(sanitized.medicines[0].timeSlots, 'morning');
  }
);
