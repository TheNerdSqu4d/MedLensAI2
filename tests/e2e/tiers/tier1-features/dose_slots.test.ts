import { defineTest, assert } from '../../harness/testContext';
import { StoreTestHarness } from '../../harness/storeTestHarness';

// T1-SLOT-01: Morning slot rendering
defineTest(
  'T1-SLOT-01',
  1,
  'Dose Slots',
  'Render Cữ Sáng chuẩn y khoa (08:00, Amlodipine + Metformin)',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    const morning = state.schedule.find((s) => s.slot === 'morning');

    assert.ok(morning, 'Morning slot must exist');
    assert.equal(morning?.timeLabel, '08:00');
    assert.equal(morning?.medicines.length, 2, 'Morning slot must contain 2 medications');
    assert.ok(
      morning?.medicines.some((m) => m.name.includes('Amlodipine')),
      'Morning slot must include Amlodipine'
    );
    assert.ok(
      morning?.medicines.some((m) => m.name.includes('Metformin')),
      'Morning slot must include Metformin'
    );
  }
);

// T1-SLOT-02: Noon slot rendering
defineTest(
  'T1-SLOT-02',
  1,
  'Dose Slots',
  'Render Cữ Trưa chuẩn y khoa (12:30, Metformin)',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    const noon = state.schedule.find((s) => s.slot === 'noon');

    assert.ok(noon, 'Noon slot must exist');
    assert.equal(noon?.timeLabel, '12:30');
    assert.equal(noon?.medicines.length, 1, 'Noon slot must contain 1 medication');
    assert.ok(
      noon?.medicines.some((m) => m.name.includes('Metformin')),
      'Noon slot must include Metformin'
    );
  }
);

// T1-SLOT-03: Evening slot rendering
defineTest(
  'T1-SLOT-03',
  1,
  'Dose Slots',
  'Render Cữ Tối chuẩn y khoa (20:00, Atorvastatin)',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    const evening = state.schedule.find((s) => s.slot === 'evening');

    assert.ok(evening, 'Evening slot must exist');
    assert.equal(evening?.timeLabel, '20:00');
    assert.equal(evening?.medicines.length, 1, 'Evening slot must contain 1 medication');
    assert.ok(
      evening?.medicines.some((m) => m.name.includes('Atorvastatin')),
      'Evening slot must include Atorvastatin'
    );
  }
);

// T1-SLOT-04: Chronological order
defineTest(
  'T1-SLOT-04',
  1,
  'Dose Slots',
  'Trật tự thời gian và cấu trúc Inset Grouped (08:00 -> 12:30 -> 20:00)',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    assert.equal(state.schedule.length, 3, 'Must have exactly 3 slots');
    assert.equal(state.schedule[0].slot, 'morning');
    assert.equal(state.schedule[0].timeLabel, '08:00');
    assert.equal(state.schedule[1].slot, 'noon');
    assert.equal(state.schedule[1].timeLabel, '12:30');
    assert.equal(state.schedule[2].slot, 'evening');
    assert.equal(state.schedule[2].timeLabel, '20:00');
  }
);

// T1-SLOT-05: Medicine line details
defineTest(
  'T1-SLOT-05',
  1,
  'Dose Slots',
  'Thông tin thuốc hiển thị trên từng hàng (Tên, Liều dùng, Hướng dẫn bữa ăn)',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    const morning = state.schedule.find((s) => s.slot === 'morning');
    const amlodipine = morning?.medicines.find((m) => m.name.includes('Amlodipine'));

    assert.ok(amlodipine, 'Amlodipine must be present');
    assert.equal(amlodipine?.dosage, '1 viên');
    assert.equal(amlodipine?.mealTiming, 'after_meal');
    assert.ok(amlodipine?.instructions.length! > 0, 'Instructions must be non-empty');
    assert.ok(amlodipine?.purpose.length! > 0, 'Purpose must be non-empty');
  }
);
