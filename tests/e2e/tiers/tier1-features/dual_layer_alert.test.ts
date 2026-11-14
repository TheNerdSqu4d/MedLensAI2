import { defineTest, assert } from '../../harness/testContext';
import { MOCK_ANALYSIS_PRESET_1, MOCK_ANALYSIS_PRESET_2 } from '@/mocks/mockData';
import type { InteractionWarning } from '@/types/medlens';
import { categorizeWarnings } from '@/services/clinical';

export { categorizeWarnings };

// T1-ALRT-01: Hide alerts when prescription is safe
defineTest(
  'T1-ALRT-01',
  1,
  'Dual-Layer Alert Card',
  'Ẩn cảnh báo khi đơn thuốc an toàn (Preset 1 zero warnings)',
  async () => {
    const summary = categorizeWarnings(MOCK_ANALYSIS_PRESET_1.warnings);
    assert.equal(summary.hasWarnings, false);
    assert.equal(summary.internal.length, 0);
    assert.equal(summary.cabinet.length, 0);
  }
);

// T1-ALRT-02: Render Red Card for Layer 1
defineTest(
  'T1-ALRT-02',
  1,
  'Dual-Layer Alert Card',
  'Render Thẻ đỏ cảnh báo Lớp 1 (Nội bộ toa: Ciprofloxacin + Gaviscon)',
  async () => {
    const summary = categorizeWarnings(MOCK_ANALYSIS_PRESET_2.warnings);
    assert.equal(summary.hasWarnings, true);
    assert.equal(summary.internal.length, 1);
    assert.equal(summary.internalColor, 'red');
    assert.equal(summary.internal[0].severity, 'high');
  }
);

// T1-ALRT-03: Render Amber Card for Layer 2
defineTest(
  'T1-ALRT-03',
  1,
  'Dual-Layer Alert Card',
  'Render Thẻ vàng cảnh báo Lớp 2 (Chéo Tủ Thuốc: Gaviscon + Aspirin 81mg)',
  async () => {
    const summary = categorizeWarnings(MOCK_ANALYSIS_PRESET_2.warnings);
    assert.equal(summary.cabinet.length, 1);
    assert.equal(summary.cabinetColor, 'amber');
    assert.equal(summary.cabinet[0].severity, 'moderate');
    assert.includes(summary.cabinet[0].medicineB, 'Aspirin 81mg');
  }
);

// T1-ALRT-04: Display both layers simultaneously
defineTest(
  'T1-ALRT-04',
  1,
  'Dual-Layer Alert Card',
  'Hiển thị đồng thời cả 2 tầng cảnh báo phân cấp theo mức độ nguy hiểm',
  async () => {
    const summary = categorizeWarnings(MOCK_ANALYSIS_PRESET_2.warnings);
    assert.equal(summary.internal.length, 1);
    assert.equal(summary.cabinet.length, 1);
    assert.equal(summary.internal[0].severity, 'high');
    assert.equal(summary.cabinet[0].severity, 'moderate');
  }
);

// T1-ALRT-05: Highlight colliding drug names
defineTest(
  'T1-ALRT-05',
  1,
  'Dual-Layer Alert Card',
  'Tên 2 thuốc kỵ nhau được định danh rõ ràng trong cảnh báo',
  async () => {
    const warn = MOCK_ANALYSIS_PRESET_2.warnings[0];
    assert.ok(warn.medicineA.length > 0);
    assert.ok(warn.medicineB.length > 0);
    assert.includes(warn.description, warn.medicineA.split(' ')[0]);
    assert.includes(warn.description, warn.medicineB.split(' ')[0]);
  }
);
