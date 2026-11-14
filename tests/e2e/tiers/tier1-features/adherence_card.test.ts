import { defineTest, assert } from '../../harness/testContext';
import { StoreTestHarness } from '../../harness/storeTestHarness';
import { calculateAdherence, type AdherenceResult } from '@/services/clinical';

export { calculateAdherence, type AdherenceResult };

// T1-ADH-01: Calculate initial adherence progress (0/3 loại thuốc đang hiển thị)
defineTest(
  'T1-ADH-01',
  1,
  'Adherence Card',
  'Tính toán tiến độ khởi tạo theo số loại thuốc hiển thị (0/3 loại thuốc) với nhãn Cần uống thêm',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    const adherence = calculateAdherence(state.schedule);

    assert.equal(state.schedule.length, 3, 'Must have 3 dose slots');
    assert.equal(adherence.total, 3, 'Must have 3 active medicines displayed (Atorvastatin expired excluded)');
    assert.equal(adherence.completed, 0, 'Completed count must be 0');
    assert.equal(adherence.percentage, 0, 'Adherence percentage must be 0%');
    assert.equal(adherence.badgeLabel, 'Cần uống thêm');
    assert.equal(adherence.badgeVariant, 'primary');
    assert.equal(adherence.label, 'Đã uống 0/3 loại thuốc hôm nay');
  }
);

// T1-ADH-02: Update on morning slot taken (2/3 loại thuốc, 67%)
defineTest(
  'T1-ADH-02',
  1,
  'Adherence Card',
  'Cập nhật khi uống cữ sáng (2/3 loại thuốc, 67%)',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    state.toggleDoseSlot('morning');

    const updatedState = await StoreTestHarness.getState();
    const adherence = calculateAdherence(updatedState.schedule);

    assert.equal(adherence.completed, 2, 'Completed count must be 2 medicines');
    assert.equal(adherence.total, 3, 'Total must be 3 medicines displayed');
    assert.equal(adherence.percentage, 67, 'Adherence percentage must be 67%');
    assert.equal(adherence.badgeLabel, 'Cần uống thêm');
    assert.equal(adherence.label, 'Đã uống 2/3 loại thuốc hôm nay');
  }
);

// T1-ADH-03: Update on 2 doses taken (3/3 loại thuốc, 100%)
defineTest(
  'T1-ADH-03',
  1,
  'Adherence Card',
  'Cập nhật khi uống cữ sáng và trưa (3/3 loại thuốc, 100% đạt Tuyệt vời khi buổi tối không có thuốc)',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    state.toggleDoseSlot('morning');
    state.toggleDoseSlot('noon');

    const updatedState = await StoreTestHarness.getState();
    const adherence = calculateAdherence(updatedState.schedule);

    assert.equal(adherence.completed, 3, 'Completed count must be 3 medicines');
    assert.equal(adherence.total, 3, 'Total must be 3 medicines');
    assert.equal(adherence.percentage, 100, 'Adherence percentage must reach 100%');
    assert.equal(adherence.badgeLabel, 'Tuyệt vời');
    assert.equal(adherence.badgeVariant, 'success');
    assert.equal(adherence.label, 'Đã uống 3/3 loại thuốc hôm nay');
  }
);

// T1-ADH-04: Update on 100% completed (3/3 loại thuốc, 100%)
defineTest(
  'T1-ADH-04',
  1,
  'Adherence Card',
  'Cập nhật khi hoàn thành 100% (3/3 loại thuốc) giữ vững badge Tuyệt vời',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    state.toggleDoseSlot('morning');
    state.toggleDoseSlot('noon');
    state.toggleDoseSlot('evening');

    const updatedState = await StoreTestHarness.getState();
    const adherence = calculateAdherence(updatedState.schedule);

    assert.equal(adherence.completed, 3, 'Completed count must be 3 medicines');
    assert.equal(adherence.total, 3, 'Total must be 3 medicines');
    assert.equal(adherence.percentage, 100, 'Adherence percentage must be 100%');
    assert.equal(adherence.badgeLabel, 'Tuyệt vời');
    assert.equal(adherence.badgeVariant, 'success');
    assert.equal(adherence.label, 'Đã uống 3/3 loại thuốc hôm nay');
  }
);

// T1-ADH-05: Decrease progress on untick (3/3 -> 2/3)
defineTest(
  'T1-ADH-05',
  1,
  'Adherence Card',
  'Giảm tiến độ khi hủy tick (3/3 -> 2/3 loại thuốc) và hoàn nguyên badge',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    // Complete all active
    state.toggleDoseSlot('morning');
    state.toggleDoseSlot('noon');

    // Untick noon
    state.toggleDoseSlot('noon');

    const updatedState = await StoreTestHarness.getState();
    const adherence = calculateAdherence(updatedState.schedule);

    assert.equal(adherence.completed, 2, 'Completed count must drop back to 2');
    assert.equal(adherence.total, 3, 'Total must be 3 medicines');
    assert.equal(adherence.percentage, 67, 'Adherence percentage must drop back to 67%');
    assert.equal(adherence.badgeLabel, 'Cần uống thêm');
    assert.equal(adherence.badgeVariant, 'primary');
    assert.equal(adherence.label, 'Đã uống 2/3 loại thuốc hôm nay');
  }
);
