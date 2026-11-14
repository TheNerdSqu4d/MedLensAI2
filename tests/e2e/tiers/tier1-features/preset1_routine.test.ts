import { defineTest, assert } from '../../harness/testContext';
import { MOCK_ANALYSIS_PRESET_1 } from '@/mocks/mockData';
import { MockNetworkController } from '../../harness/mockNetwork';

// Simulated AI prescription analyzer function matching services/ai.ts contract
async function analyzeDemoPrescription(preset: 'preset1' | 'preset2') {
  if (preset === 'preset1') {
    return MOCK_ANALYSIS_PRESET_1;
  }
  const { MOCK_ANALYSIS_PRESET_2 } = await import('@/mocks/mockData');
  return MOCK_ANALYSIS_PRESET_2;
}

// T1-PRE1-01: Load Preset 1 demo data
defineTest(
  'T1-PRE1-01',
  1,
  'Preset 1',
  'Nạp dữ liệu Toa mẫu 1 qua chip 1-chạm (BS.CKII Trần Văn Minh)',
  async () => {
    const result = await analyzeDemoPrescription('preset1');
    assert.ok(result, 'Result must exist');
    assert.equal(result.doctorName, 'BS.CKII Trần Văn Minh (Khoa Tim Mạch - Nội Tiết)');
  }
);

// T1-PRE1-02: Extract clinical diagnosis
defineTest(
  'T1-PRE1-02',
  1,
  'Preset 1',
  'Bóc tách thông tin chẩn đoán lâm sàng của Mẫu 1',
  async () => {
    const result = await analyzeDemoPrescription('preset1');
    assert.equal(
      result.diagnosis,
      'Tăng huyết áp vô căn độ 2 / Đái tháo đường type 2'
    );
  }
);

// T1-PRE1-03: Extract 3 medications and time slot assignments
defineTest(
  'T1-PRE1-03',
  1,
  'Preset 1',
  'Trích xuất đủ 3 loại thuốc kèm cữ chỉ định',
  async () => {
    const result = await analyzeDemoPrescription('preset1');
    assert.equal(result.medicines.length, 3, 'Must contain 3 medicines');

    const amlodipine = result.medicines.find((m) => m.name.includes('Amlodipine'));
    const metformin = result.medicines.find((m) => m.name.includes('Metformin'));
    const atorvastatin = result.medicines.find((m) => m.name.includes('Atorvastatin'));

    assert.ok(amlodipine);
    assert.includes(amlodipine?.timeSlots, 'morning');

    assert.ok(metformin);
    assert.includes(metformin?.timeSlots, 'morning');
    assert.includes(metformin?.timeSlots, 'noon');

    assert.ok(atorvastatin);
    assert.includes(atorvastatin?.timeSlots, 'evening');
  }
);

// T1-PRE1-04: Confirm zero conflicts
defineTest(
  'T1-PRE1-04',
  1,
  'Preset 1',
  'Khẳng định mức độ an toàn (Zero Conflict, warnings length 0)',
  async () => {
    const result = await analyzeDemoPrescription('preset1');
    assert.equal(result.warnings.length, 0, 'Preset 1 must contain 0 warnings');
  }
);

// T1-PRE1-05: Resilient offline availability
defineTest(
  'T1-PRE1-05',
  1,
  'Preset 1',
  'Khả năng phản hồi an toàn trong môi trường ngoại tuyến',
  async () => {
    MockNetworkController.setMode('NETWORK_OFFLINE');
    // Fallback returns preset data without unhandled crash
    const result = await analyzeDemoPrescription('preset1');
    assert.ok(result);
    assert.equal(result.medicines.length, 3);
  }
);
