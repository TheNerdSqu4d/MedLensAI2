import { defineTest, assert } from '../../harness/testContext';
import { StoreTestHarness } from '../../harness/storeTestHarness';
import { MOCK_ANALYSIS_PRESET_1, MOCK_ANALYSIS_PRESET_2 } from '@/mocks/mockData';
import { calculateAdherence } from '../tier1-features/adherence_card.test';

// T2-PRT-01: Morning dose taken at 08:15 preserved after merge
defineTest(
  'T2-PRT-01',
  2,
  'Midday Smart Merge',
  'Cữ Sáng đã uống lúc 08:15, trưa gộp thêm thuốc: giữ nguyên isTaken và takenAt',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    // Take morning dose
    state.toggleDoseSlot('morning');
    const takenTime = (await StoreTestHarness.getState()).schedule[0].takenAt;
    assert.ok(takenTime);

    // Merge Preset 2 midday
    state.importPrescription(MOCK_ANALYSIS_PRESET_2);

    const updated = await StoreTestHarness.getState();
    const morning = updated.schedule.find((s) => s.slot === 'morning');

    assert.equal(morning?.isTaken, true, 'isTaken must remain true!');
    assert.equal(morning?.takenAt, takenTime, 'takenAt timestamp must be preserved!');
    assert.ok(morning?.medicines.some((m) => m.name.includes('Ciprofloxacin')));
  }
);

// T2-PRT-02: Morning & Noon taken, evening merge
defineTest(
  'T2-PRT-02',
  2,
  'Midday Smart Merge',
  'Cữ Sáng & Trưa đã uống, tối gộp thêm thuốc: cả 2 cữ giữ nguyên dấu tick',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    state.toggleDoseSlot('morning');
    state.toggleDoseSlot('noon');

    state.importPrescription(MOCK_ANALYSIS_PRESET_2);

    const updated = await StoreTestHarness.getState();
    const morning = updated.schedule.find((s) => s.slot === 'morning');
    const noon = updated.schedule.find((s) => s.slot === 'noon');
    const evening = updated.schedule.find((s) => s.slot === 'evening');

    assert.equal(morning?.isTaken, true);
    assert.equal(noon?.isTaken, true);
    assert.equal(evening?.isTaken, false);
  }
);

// T2-PRT-03: Adherence percentage does not reset to 0% after merge
defineTest(
  'T2-PRT-03',
  2,
  'Midday Smart Merge',
  'Tỷ lệ tuân thủ duy trì dựa trên cữ đã uống, không bị reset về 0% sau khi gộp toa',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    state.toggleDoseSlot('morning');

    const adhBefore = calculateAdherence((await StoreTestHarness.getState()).schedule);
    assert.equal(adhBefore.percentage, 67);

    state.importPrescription(MOCK_ANALYSIS_PRESET_1);

    const adhAfter = calculateAdherence((await StoreTestHarness.getState()).schedule);
    assert.equal(adhAfter.percentage, 67, 'Adherence must remain 67% after merge!');
    assert.equal(adhAfter.completed, 2);
  }
);

// T2-PRT-04: 100% completed day preserves 100% after merge
defineTest(
  'T2-PRT-04',
  2,
  'Midday Smart Merge',
  'Đã hoàn thành 100% cả ngày trước khi gộp toa vẫn giữ nguyên 100% Tuyệt vời',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    state.toggleDoseSlot('morning');
    state.toggleDoseSlot('noon');
    state.toggleDoseSlot('evening');

    state.importPrescription(MOCK_ANALYSIS_PRESET_2);

    const adh = calculateAdherence((await StoreTestHarness.getState()).schedule);
    assert.equal(adh.completed, adh.total);
    assert.equal(adh.percentage, 100);
    assert.equal(adh.badgeLabel, 'Tuyệt vời');
  }
);

// T2-PRT-05: Untick after midday merge
defineTest(
  'T2-PRT-05',
  2,
  'Midday Smart Merge',
  'Hủy tick cữ sau khi đã gộp giữa ngày: đảo isTaken=false nhưng giữ nguyên danh sách thuốc mới',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    state.toggleDoseSlot('morning');
    state.importPrescription(MOCK_ANALYSIS_PRESET_2);

    // Untick morning
    state.toggleDoseSlot('morning');

    const updated = await StoreTestHarness.getState();
    const morning = updated.schedule.find((s) => s.slot === 'morning');

    assert.equal(morning?.isTaken, false);
    assert.equal(morning?.takenAt, undefined);
    assert.ok(morning?.medicines.some((m) => m.name.includes('Ciprofloxacin')));
  }
);
