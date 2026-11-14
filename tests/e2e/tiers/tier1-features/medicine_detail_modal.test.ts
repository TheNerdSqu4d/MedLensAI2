import { defineTest, assert } from '../../harness/testContext';
import { StoreTestHarness } from '../../harness/storeTestHarness';
import { MED_AMLODIPINE, MED_ATORVASTATIN } from '@/mocks/mockData';

// T1-MOD-01: Activate bottom sheet when tapping a medicine
defineTest(
  'T1-MOD-01',
  1,
  'Medicine Detail Modal',
  'Kích hoạt Bottom Sheet khi chọn thuốc (selectedMedicine)',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    assert.equal(state.selectedMedicine, null);

    state.setSelectedMedicine(MED_AMLODIPINE);

    const updated = await StoreTestHarness.getState();
    assert.ok(updated.selectedMedicine, 'selectedMedicine must not be null');
    assert.equal(updated.selectedMedicine?.id, MED_AMLODIPINE.id);
    assert.equal(updated.selectedMedicine?.name, 'Amlodipine 5mg');
  }
);

// T1-MOD-02: Display active ingredients and clinical mechanism
defineTest(
  'T1-MOD-02',
  1,
  'Medicine Detail Modal',
  'Hiển thị hoạt chất và cơ chế tác dụng y khoa của Amlodipine',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    state.setSelectedMedicine(MED_AMLODIPINE);

    const med = (await StoreTestHarness.getState()).selectedMedicine;
    assert.equal(med?.activeIngredient, 'Amlodipine besylate');
    assert.equal(med?.purpose, 'Hạ huyết áp và kiểm soát đau thắt ngực');
    assert.equal(med?.category, 'Blood Pressure');
  }
);

// T1-MOD-03: Display meal timing instructions
defineTest(
  'T1-MOD-03',
  1,
  'Medicine Detail Modal',
  'Hiển thị chỉ dẫn bữa ăn và hướng dẫn uống thuốc',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    state.setSelectedMedicine(MED_AMLODIPINE);

    const med = (await StoreTestHarness.getState()).selectedMedicine;
    assert.equal(med?.mealTiming, 'after_meal');
    assert.ok(med?.instructions.includes('sáng'));
  }
);

// T1-MOD-04: Display precautions and warnings
defineTest(
  'T1-MOD-04',
  1,
  'Medicine Detail Modal',
  'Hiển thị lưu ý an toàn và chống chỉ định của Atorvastatin',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    state.setSelectedMedicine(MED_ATORVASTATIN);

    const med = (await StoreTestHarness.getState()).selectedMedicine;
    assert.ok(med?.instructions.includes('bưởi chùm'));
    assert.equal(med?.category, 'Tim mạch & Mỡ máu');
  }
);

// T1-MOD-05: Close modal smoothly
defineTest(
  'T1-MOD-05',
  1,
  'Medicine Detail Modal',
  'Đóng Modal mượt mà và xóa selectedMedicine về null',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    state.setSelectedMedicine(MED_AMLODIPINE);
    assert.ok((await StoreTestHarness.getState()).selectedMedicine);

    // Close
    state.setSelectedMedicine(null);

    const updated = await StoreTestHarness.getState();
    assert.equal(updated.selectedMedicine, null);
  }
);
