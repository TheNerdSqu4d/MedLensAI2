import { defineTest, assert } from '../../harness/testContext';
import { StoreTestHarness } from '../../harness/storeTestHarness';
import { MockAsyncStorage } from '../../harness/mockAsyncStorage';
import { MOCK_SCHEDULE, MOCK_CABINET, MOCK_ANALYSIS_PRESET_2 } from '@/mocks/mockData';

// T1-RST-01: Header shortcut trigger
defineTest(
  'T1-RST-01',
  1,
  'Reset Demo Data',
  'Kích hoạt Reset từ shortcut Header Tab 1',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    state.toggleDoseSlot('morning');

    // Call reset
    state.resetToDemo();

    const reset = await StoreTestHarness.getState();
    assert.equal(reset.schedule[0].isTaken, false);
  }
);

// T1-RST-02: Settings screen action trigger
defineTest(
  'T1-RST-02',
  1,
  'Reset Demo Data',
  'Kích hoạt Reset từ màn hình Settings',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    state.importPrescription(MOCK_ANALYSIS_PRESET_2);

    state.resetToDemo();

    const reset = await StoreTestHarness.getState();
    assert.equal(reset.schedule.length, 3);
    assert.equal(reset.cabinet.length, MOCK_CABINET.length);
  }
);

// T1-RST-03: Restore default schedule slots
defineTest(
  'T1-RST-03',
  1,
  'Reset Demo Data',
  'Hoàn nguyên lịch trình về 3 cữ mặc định (tất cả isTaken=false, takenAt=undefined)',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    state.toggleDoseSlot('morning');
    state.toggleDoseSlot('noon');
    state.toggleDoseSlot('evening');
    state.importPrescription(MOCK_ANALYSIS_PRESET_2);

    state.resetToDemo();

    const reset = await StoreTestHarness.getState();
    assert.equal(reset.schedule.length, 3);
    for (const slot of reset.schedule) {
      assert.equal(slot.isTaken, false);
      assert.equal(slot.takenAt, undefined);
    }
    // Check baseline medicine counts
    assert.equal(reset.schedule[0].medicines.length, MOCK_SCHEDULE[0].medicines.length);
    assert.equal(reset.schedule[1].medicines.length, MOCK_SCHEDULE[1].medicines.length);
    assert.equal(reset.schedule[2].medicines.length, MOCK_SCHEDULE[2].medicines.length);
  }
);

// T1-RST-04: Restore default cabinet
defineTest(
  'T1-RST-04',
  1,
  'Reset Demo Data',
  'Hoàn nguyên tủ thuốc về chính xác 7 thuốc ban đầu',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    state.importPrescription(MOCK_ANALYSIS_PRESET_2);

    const merged = await StoreTestHarness.getState();
    assert.ok(merged.cabinet.length > MOCK_CABINET.length);

    state.resetToDemo();

    const reset = await StoreTestHarness.getState();
    assert.equal(reset.cabinet.length, MOCK_CABINET.length);
    assert.equal(reset.selectedMedicine, null);
  }
);

// T1-RST-05: Synchronize reset state to AsyncStorage
defineTest(
  'T1-RST-05',
  1,
  'Reset Demo Data',
  'Đồng bộ trạng thái Reset xuống AsyncStorage (medlens-storage-v1)',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    state.toggleDoseSlot('morning');
    await StoreTestHarness.flushStorage();

    state.resetToDemo();
    await StoreTestHarness.flushStorage();

    const stored = await MockAsyncStorage.getItem('medlens-storage-v1');
    assert.ok(stored, 'Stored data must exist');
    const parsed = JSON.parse(stored || '{}');
    assert.equal(parsed.state.schedule[0].isTaken, false);
    assert.equal(parsed.state.cabinet.length, MOCK_CABINET.length);
  }
);
