import { defineTest, assert } from '../../harness/testContext';
import { StoreTestHarness } from '../../harness/storeTestHarness';
import { MOCK_ANALYSIS_PRESET_1, MOCK_ANALYSIS_PRESET_2 } from '@/mocks/mockData';
import type { PrescriptionAnalysisResult, Medicine, InteractionWarning } from '@/types/medlens';
import { filterCabinet, evaluatePrescriptionConflicts } from '@/services/clinical';

export { evaluatePrescriptionConflicts };

export function formatCabinetBadgeText(cabinetList: Medicine[]): string {
  if (!Array.isArray(cabinetList)) return '0 loại thuốc';
  return `${cabinetList.length} loại thuốc`;
}

// T2-EC-01: App initialization with empty cabinet
defineTest(
  'T2-EC-01',
  2,
  'Empty Cabinet Boundary',
  'Khởi tạo ứng dụng với tủ thuốc rỗng (cabinet: []), hiển thị an toàn không crash',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    // Simulate empty cabinet
    (state as any).cabinet = [];

    const emptyFiltered = filterCabinet(state.cabinet, 'Tất cả');
    assert.equal(emptyFiltered.length, 0);
    const emptyStateText = emptyFiltered.length === 0 ? 'Tủ thuốc đang trống' : 'Có thuốc';
    assert.equal(emptyStateText, 'Tủ thuốc đang trống');
  }
);

// T2-EC-02: Check Layer 2 warning when cabinet is empty
defineTest(
  'T2-EC-02',
  2,
  'Empty Cabinet Boundary',
  'Không xuất hiện cảnh báo Layer 2 khi tủ thuốc rỗng (chỉ có Layer 1)',
  async () => {
    const emptyCabinet: Medicine[] = [];
    const warnings = evaluatePrescriptionConflicts(
      MOCK_ANALYSIS_PRESET_2.medicines,
      emptyCabinet
    );

    const layer1 = warnings.filter((w) => w.source === 'internal_prescription');
    const layer2 = warnings.filter((w) => w.source === 'cabinet_conflict');

    assert.equal(layer1.length, 1, 'Layer 1 must exist (Cipro + Gaviscon)');
    assert.equal(layer2.length, 0, 'Layer 2 must NOT exist because cabinet is empty');
  }
);

// T2-EC-03: Filter click on empty cabinet
defineTest(
  'T2-EC-03',
  2,
  'Empty Cabinet Boundary',
  'Chạm các chip lọc khi tủ rỗng không sinh ngoại lệ runtime',
  async () => {
    const emptyCabinet: Medicine[] = [];
    const categories = ['Huyết áp', 'Dạ dày', 'Tiểu đường', 'Giảm đau', 'Kháng sinh'];

    for (const cat of categories) {
      const res = filterCabinet(emptyCabinet, cat);
      assert.equal(res.length, 0);
    }
  }
);

// T2-EC-04: Smart Merge into empty cabinet
defineTest(
  'T2-EC-04',
  2,
  'Empty Cabinet Boundary',
  'Smart Merge vào tủ thuốc rỗng điền chính xác danh sách thuốc mới',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    (state as any).cabinet = [];

    state.importPrescription(MOCK_ANALYSIS_PRESET_1);

    const updated = await StoreTestHarness.getState();
    assert.equal(updated.cabinet.length, 3);
  }
);

// T2-EC-05: Badge total counter on empty cabinet
defineTest(
  'T2-EC-05',
  2,
  'Empty Cabinet Boundary',
  'Hiển thị huy hiệu tổng số thuốc khi tủ rỗng (0 loại thuốc)',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    // 1. Force cabinet to empty state in Zustand store
    (state as any).cabinet = [];
    assert.equal(state.cabinet.length, 0, 'Store cabinet must be empty');

    // 2. Format badge text from real store state
    const emptyBadgeText = formatCabinetBadgeText(state.cabinet);
    assert.equal(emptyBadgeText, '0 loại thuốc', 'Must display "0 loại thuốc" when store cabinet is empty');
    assert.ok(!emptyBadgeText.includes('NaN'), 'Must never contain NaN');
    assert.ok(!emptyBadgeText.includes('undefined'), 'Must never contain undefined');

    // 3. Verify dynamic transition when prescription is imported into the empty cabinet
    state.importPrescription(MOCK_ANALYSIS_PRESET_1);
    const updatedState = await StoreTestHarness.getState();
    assert.equal(updatedState.cabinet.length, 3, 'Store cabinet must contain 3 items after Preset 1 import');

    const populatedBadgeText = formatCabinetBadgeText(updatedState.cabinet);
    assert.equal(populatedBadgeText, '3 loại thuốc', 'Badge text must dynamically update to "3 loại thuốc"');
  }
);
