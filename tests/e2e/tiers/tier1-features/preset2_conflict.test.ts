import { defineTest, assert } from '../../harness/testContext';
import { MOCK_ANALYSIS_PRESET_2 } from '@/mocks/mockData';
import {
  MockHapticsController,
  NotificationFeedbackType,
  notificationAsync,
} from '../../harness/mockHaptics';

// Simulated action handler when user scans or chooses Preset 2
async function handlePreset2Selection() {
  const result = MOCK_ANALYSIS_PRESET_2;
  if (result.warnings && result.warnings.length > 0) {
    await notificationAsync(NotificationFeedbackType.Warning);
  }
  return result;
}

// T1-PRE2-01: Load Preset 2 metadata
defineTest(
  'T1-PRE2-01',
  1,
  'Preset 2',
  'Nạp dữ liệu Toa mẫu 2 có cảnh báo (BS. Lê Thị Mai, Viêm dạ dày / Nhiễm khuẩn)',
  async () => {
    const result = MOCK_ANALYSIS_PRESET_2;
    assert.equal(result.doctorName, 'BS. Lê Thị Mai (Khoa Tiêu Hóa - Nhiễm)');
    assert.equal(result.diagnosis, 'Viêm dạ dày cấp kèm nhiễm khuẩn tiêu hóa');
  }
);

// T1-PRE2-02: Extract 2 medications
defineTest(
  'T1-PRE2-02',
  1,
  'Preset 2',
  'Bóc tách 2 loại thuốc lâm sàng (Ciprofloxacin & Gaviscon)',
  async () => {
    const result = MOCK_ANALYSIS_PRESET_2;
    assert.equal(result.medicines.length, 2);

    const cipro = result.medicines.find((m) => m.name.includes('Ciprofloxacin'));
    const gaviscon = result.medicines.find((m) => m.name.includes('Gaviscon'));

    assert.ok(cipro);
    assert.equal(cipro?.dosage, '1 viên');
    assert.includes(cipro?.timeSlots, 'morning');
    assert.includes(cipro?.timeSlots, 'evening');

    assert.ok(gaviscon);
    assert.equal(gaviscon?.dosage, '1 gói (10ml)');
    assert.includes(gaviscon?.timeSlots, 'morning');
    assert.includes(gaviscon?.timeSlots, 'noon');
    assert.includes(gaviscon?.timeSlots, 'evening');
  }
);

// T1-PRE2-03: Layer 1 internal conflict
defineTest(
  'T1-PRE2-03',
  1,
  'Preset 2',
  'Cảnh báo tương tác Lớp 1 (Nội bộ toa: Ciprofloxacin + Gaviscon chelate)',
  async () => {
    const result = MOCK_ANALYSIS_PRESET_2;
    const internal = result.warnings.find((w) => w.source === 'internal_prescription');

    assert.ok(internal, 'Internal warning must exist');
    assert.equal(internal?.severity, 'high');
    assert.includes(internal?.medicineA, 'Ciprofloxacin');
    assert.includes(internal?.medicineB, 'Gaviscon');
    assert.includes(internal?.description, 'chelate');
    assert.includes(internal?.clinicalRecommendation, '2 giờ');
  }
);

// T1-PRE2-04: Layer 2 cabinet cross-conflict
defineTest(
  'T1-PRE2-04',
  1,
  'Preset 2',
  'Cảnh báo tương tác Lớp 2 (Chéo Tủ Thuốc: Gaviscon + Aspirin 81mg)',
  async () => {
    const result = MOCK_ANALYSIS_PRESET_2;
    const cross = result.warnings.find((w) => w.source === 'cabinet_conflict');

    assert.ok(cross, 'Cabinet cross-warning must exist');
    assert.equal(cross?.severity, 'moderate');
    assert.includes(cross?.medicineA, 'Gaviscon');
    assert.includes(cross?.medicineB, 'Aspirin 81mg');
    assert.includes(cross?.description, 'kiềm hóa');
  }
);

// T1-PRE2-05: Trigger haptic warning
defineTest(
  'T1-PRE2-05',
  1,
  'Preset 2',
  'Kích hoạt phản hồi rung cảnh báo Warning khi phát hiện tương tác thuốc',
  async () => {
    MockHapticsController.clear();
    await handlePreset2Selection();

    const calls = MockHapticsController.getCallsByMethod('notificationAsync');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].arg, NotificationFeedbackType.Warning);
  }
);
