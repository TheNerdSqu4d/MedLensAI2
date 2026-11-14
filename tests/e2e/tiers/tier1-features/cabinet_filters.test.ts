import { defineTest, assert } from '../../harness/testContext';
import { StoreTestHarness } from '../../harness/storeTestHarness';
import type { Medicine } from '@/types/medlens';
import { CABINET_CATEGORIES, filterCabinet } from '@/services/clinical';

export { CABINET_CATEGORIES, filterCabinet };

// T1-CAB-01: 6 category chips available
defineTest(
  'T1-CAB-01',
  1,
  'Medicine Cabinet',
  'Hiển thị đủ 6 chip lọc danh mục nhóm bệnh',
  async () => {
    assert.equal(CABINET_CATEGORIES.length, 6);
    assert.includes(CABINET_CATEGORIES, 'Tất cả');
    assert.includes(CABINET_CATEGORIES, 'Huyết áp');
    assert.includes(CABINET_CATEGORIES, 'Dạ dày');
    assert.includes(CABINET_CATEGORIES, 'Tiểu đường');
    assert.includes(CABINET_CATEGORIES, 'Giảm đau');
    assert.includes(CABINET_CATEGORIES, 'Kháng sinh');
  }
);

// T1-CAB-02: Default chip "Tất cả"
defineTest(
  'T1-CAB-02',
  1,
  'Medicine Cabinet',
  'Mặc định chọn chip Tất cả hiển thị toàn bộ thuốc trong tủ',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    const filtered = filterCabinet(state.cabinet, 'Tất cả');

    assert.equal(filtered.length, state.cabinet.length);
    assert.ok(filtered.length >= 7);
  }
);

// T1-CAB-03: Filter by "Huyết áp" (Blood Pressure)
defineTest(
  'T1-CAB-03',
  1,
  'Medicine Cabinet',
  'Lọc theo nhóm Huyết áp (Amlodipine, Losartan, Enalapril)',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    const filtered = filterCabinet(state.cabinet, 'Huyết áp');

    assert.ok(filtered.length >= 3);
    assert.ok(filtered.every((m) => m.category === 'Blood Pressure' || m.category === 'Huyết áp'));
    assert.ok(filtered.some((m) => m.name.includes('Amlodipine')));
    assert.ok(filtered.some((m) => m.name.includes('Losartan')));
    assert.ok(filtered.some((m) => m.name.includes('Enalapril')));
  }
);

// T1-CAB-04: Filter by "Dạ dày" (Stomach)
defineTest(
  'T1-CAB-04',
  1,
  'Medicine Cabinet',
  'Lọc theo nhóm Dạ dày (Omeprazole)',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    const filtered = filterCabinet(state.cabinet, 'Dạ dày');

    assert.ok(filtered.length >= 1);
    assert.ok(filtered.every((m) => m.category === 'Stomach'));
    assert.ok(filtered.some((m) => m.name.includes('Omeprazole')));
  }
);

// T1-CAB-05: Pill count and expiry display
defineTest(
  'T1-CAB-05',
  1,
  'Medicine Cabinet',
  'Hiển thị số viên còn lại và hạn dùng trên thẻ thuốc',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    const med = state.cabinet[0];

    assert.ok(med.remainingCount >= 0);
    assert.ok(med.expiryDate && med.expiryDate.length > 0);
    const countLabel = `Còn ${med.remainingCount} viên`;
    const expiryLabel = `HSD: ${med.expiryDate}`;
    assert.includes(countLabel, 'viên');
    assert.includes(expiryLabel, 'HSD');
  }
);
