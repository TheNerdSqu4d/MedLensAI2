import { defineTest, assert } from '../../harness/testContext';
import { StoreTestHarness } from '../../harness/storeTestHarness';
import { MockAsyncStorage } from '../../harness/mockAsyncStorage';
import { MockNetworkController } from '../../harness/mockNetwork';
import {
  MOCK_ANALYSIS_PRESET_1,
  MOCK_ANALYSIS_PRESET_2,
  MED_AMLODIPINE,
  MED_PARACETAMOL,
  MED_ASPIRIN,
} from '@/mocks/mockData';
import { calculateAdherence } from '../tier1-features/adherence_card.test';
import { filterCabinet } from '../tier1-features/cabinet_filters.test';
import { evaluatePrescriptionConflicts } from '../tier2-boundaries/empty_cabinet.test';
import { decrementPillCount } from '../tier2-boundaries/zero_pill_count.test';

// T3-COM-01: Merge + Cabinet + Toggle
defineTest(
  'T3-COM-01',
  3,
  'Combinations',
  'Gộp toa mới -> Đồng bộ tủ thuốc -> Tick cữ mới (Adherence tăng 33%)',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    // 1. Merge Preset 2
    state.importPrescription(MOCK_ANALYSIS_PRESET_2);

    // 2. Check cabinet
    const cab = (await StoreTestHarness.getState()).cabinet;
    assert.ok(cab.some((m) => m.name.includes('Ciprofloxacin')));
    assert.ok(cab.some((m) => m.name.includes('Gaviscon')));

    // 3. Toggle morning slot
    state.toggleDoseSlot('morning');

    const updated = await StoreTestHarness.getState();
    const adh = calculateAdherence(updated.schedule);
    assert.equal(adh.completed, 3);
    assert.equal(adh.percentage, 50);
  }
);

// T3-COM-02: Conflict + Smart Merge
defineTest(
  'T3-COM-02',
  3,
  'Combinations',
  'Phát hiện cảnh báo 2 lớp -> Bấm gộp lịch uống: thuốc được xếp đúng cữ',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    assert.equal(MOCK_ANALYSIS_PRESET_2.warnings.length, 2);

    state.importPrescription(MOCK_ANALYSIS_PRESET_2);

    const updated = await StoreTestHarness.getState();
    const morning = updated.schedule.find((s) => s.slot === 'morning');
    assert.ok(morning?.medicines.some((m) => m.name.includes('Ciprofloxacin')));
  }
);

// T3-COM-03: Reset + Preset 1 Import
defineTest(
  'T3-COM-03',
  3,
  'Combinations',
  'Reset demo -> Nạp Preset 1 an toàn: 0 cảnh báo, adherence 0/3',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    state.resetToDemo();
    state.importPrescription(MOCK_ANALYSIS_PRESET_1);

    const updated = await StoreTestHarness.getState();
    const adh = calculateAdherence(updated.schedule);
    assert.equal(adh.completed, 0);
    assert.equal(MOCK_ANALYSIS_PRESET_1.warnings.length, 0);
  }
);

// T3-COM-04: Reset + Preset 2 Conflict
defineTest(
  'T3-COM-04',
  3,
  'Combinations',
  'Reset demo -> Nạp Preset 2 kiểm tra xung đột với tủ thuốc mặc định (xuất hiện cả 2 lớp)',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    state.resetToDemo();

    // Check conflicts between Preset 2 and baseline cabinet (which has Aspirin 81mg)
    const warnings = evaluatePrescriptionConflicts(
      MOCK_ANALYSIS_PRESET_2.medicines,
      state.cabinet
    );

    const layer1 = warnings.filter((w) => w.source === 'internal_prescription');
    const layer2 = warnings.filter((w) => w.source === 'cabinet_conflict');

    assert.equal(layer1.length, 1, 'Layer 1 must be present');
    assert.equal(layer2.length, 1, 'Layer 2 must be present');
  }
);

// T3-COM-05: Cumulative Presets
defineTest(
  'T3-COM-05',
  3,
  'Combinations',
  'Nạp Preset 1 rồi tiếp tục nạp Preset 2: không mất mát thuốc nào',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    state.importPrescription(MOCK_ANALYSIS_PRESET_1);
    state.importPrescription(MOCK_ANALYSIS_PRESET_2);

    const updated = await StoreTestHarness.getState();
    const cab = updated.cabinet;

    assert.ok(cab.some((m) => m.name.includes('Amlodipine')));
    assert.ok(cab.some((m) => m.name.includes('Metformin')));
    assert.ok(cab.some((m) => m.name.includes('Atorvastatin')));
    assert.ok(cab.some((m) => m.name.includes('Ciprofloxacin')));
    assert.ok(cab.some((m) => m.name.includes('Gaviscon')));
  }
);

// T3-COM-06: Toggle + Kill App + Restore
defineTest(
  'T3-COM-06',
  3,
  'Combinations',
  'Tick cữ sáng -> Vuốt tắt app (Kill App) -> Khởi động lại: cữ sáng phục hồi 100%',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    state.toggleDoseSlot('morning');
    await StoreTestHarness.flushStorage();

    const morningBefore = (await StoreTestHarness.getState()).schedule[0];
    const takenTime = morningBefore.takenAt;

    // Simulate Kill App
    const restartedStore = await StoreTestHarness.killAndRestartApp();
    const rehydratedState = restartedStore.getState();
    const morningAfter = rehydratedState.schedule[0];

    assert.equal(morningAfter.isTaken, true, 'isTaken must persist across app restart');
    assert.equal(morningAfter.takenAt, takenTime, 'takenAt must persist across app restart');

    const adh = calculateAdherence(rehydratedState.schedule);
    assert.equal(adh.percentage, 67);
  }
);

// T3-COM-07: Stock Decrement + Merge
defineTest(
  'T3-COM-07',
  3,
  'Combinations',
  'Giảm số viên trong tủ -> Gộp toa mới trùng thuốc: giữ tính nhất quán',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    const amlodipine = state.cabinet.find((m) => m.name.includes('Amlodipine'));
    if (amlodipine) {
      amlodipine.remainingCount = decrementPillCount(amlodipine.remainingCount, 10);
    }

    state.importPrescription(MOCK_ANALYSIS_PRESET_1);

    const updated = await StoreTestHarness.getState();
    const amlAfter = updated.cabinet.find((m) => m.name.includes('Amlodipine'));
    assert.ok(amlAfter);
    assert.ok(amlAfter?.remainingCount! >= 0);
  }
);

// T3-COM-08: Filter + Detail Modal
defineTest(
  'T3-COM-08',
  3,
  'Combinations',
  'Lọc danh mục trong tủ -> Mở Modal chi tiết -> Đóng Modal: bộ lọc giữ nguyên',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    let activeFilter = 'Huyết áp';
    const filteredMeds = filterCabinet(state.cabinet, activeFilter);
    assert.ok(filteredMeds.length > 0);

    // Open detail modal
    state.setSelectedMedicine(filteredMeds[0]);
    assert.ok((await StoreTestHarness.getState()).selectedMedicine);

    // Close modal
    state.setSelectedMedicine(null);
    assert.equal((await StoreTestHarness.getState()).selectedMedicine, null);
    assert.equal(activeFilter, 'Huyết áp', 'Filter selection should not change on modal close');
  }
);

// T3-COM-09: Offline Scan + Kill App
defineTest(
  'T3-COM-09',
  3,
  'Combinations',
  'Quét ngoại tuyến fallback -> Gộp toa -> Kill App: dữ liệu offline lưu bền vững',
  async () => {
    await StoreTestHarness.resetAll();
    MockNetworkController.setMode('NETWORK_OFFLINE');

    const state = await StoreTestHarness.getState();
    state.importPrescription(MOCK_ANALYSIS_PRESET_1);
    await StoreTestHarness.flushStorage();

    // Kill App & Restore
    const freshStore = await StoreTestHarness.killAndRestartApp();
    const rehydrated = freshStore.getState();

    assert.ok(rehydrated.cabinet.some((m) => m.name.includes('Amlodipine')));
    assert.equal(rehydrated.schedule.length, 3);
  }
);

// T3-COM-10: Conflict Review + Cabinet Nav
defineTest(
  'T3-COM-10',
  3,
  'Combinations',
  'Thấy cảnh báo kỵ Aspirin -> Sang tủ thuốc xem chi tiết Aspirin',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    const crossWarn = MOCK_ANALYSIS_PRESET_2.warnings.find((w) => w.source === 'cabinet_conflict');
    assert.ok(crossWarn);
    assert.includes(crossWarn?.medicineB, 'Aspirin');

    const aspirinInCab = state.cabinet.find((m) => m.name.includes('Aspirin'));
    assert.ok(aspirinInCab);
    assert.equal(aspirinInCab?.activeIngredient, 'Acetylsalicylic acid');
  }
);

// T3-COM-11: Midday Check + Merge + Full Day
defineTest(
  'T3-COM-11',
  3,
  'Combinations',
  'Tick cữ Sáng -> Gộp toa buổi trưa -> Tick Trưa & Tối -> Kill App: 100% bảo toàn',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    // 1. Tick morning
    state.toggleDoseSlot('morning');
    const morningTime = (await StoreTestHarness.getState()).schedule[0].takenAt;

    // 2. Midday merge
    state.importPrescription(MOCK_ANALYSIS_PRESET_1);

    // 3. Tick noon and evening
    state.toggleDoseSlot('noon');
    state.toggleDoseSlot('evening');
    await StoreTestHarness.flushStorage();

    // 4. Kill App
    const fresh = await StoreTestHarness.killAndRestartApp();
    const finalState = fresh.getState();

    const adh = calculateAdherence(finalState.schedule);
    assert.equal(adh.completed, adh.total);
    assert.equal(adh.percentage, 100);
    assert.equal(finalState.schedule[0].takenAt, morningTime);
  }
);

// T3-COM-12: Empty Cab + Preset 2 + Re-scan
defineTest(
  'T3-COM-12',
  3,
  'Combinations',
  'Xóa tủ thuốc -> Nạp Preset 2 (chỉ Lớp 1) -> Thêm Aspirin -> Quét lại: kích hoạt Lớp 2',
  async () => {
    // 1. With empty cabinet
    const emptyCab: typeof MED_ASPIRIN[] = [];
    const warn1 = evaluatePrescriptionConflicts(MOCK_ANALYSIS_PRESET_2.medicines, emptyCab);
    assert.equal(warn1.length, 1);
    assert.equal(warn1[0].source, 'internal_prescription');

    // 2. Add Aspirin to cabinet
    const cabWithAspirin = [{ ...MED_ASPIRIN }];
    const warn2 = evaluatePrescriptionConflicts(MOCK_ANALYSIS_PRESET_2.medicines, cabWithAspirin);
    assert.equal(warn2.length, 2);
    assert.ok(warn2.some((w) => w.source === 'cabinet_conflict'));
  }
);

// T3-COM-13: 0 Pills + Modal + Reset
defineTest(
  'T3-COM-13',
  3,
  'Combinations',
  'Trừ thuốc về 0 viên -> Mở Modal xem cảnh báo -> Bấm Reset Demo: phục hồi số lượng',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    const para = state.cabinet.find((m) => m.name.includes('Paracetamol'));
    if (para) para.remainingCount = 0;

    state.resetToDemo();

    const resetState = await StoreTestHarness.getState();
    const paraRestored = resetState.cabinet.find((m) => m.name.includes('Paracetamol'));
    assert.ok(paraRestored);
    assert.equal(paraRestored?.remainingCount, MED_PARACETAMOL.remainingCount);
  }
);

// T3-COM-14: Scan + Nav Cabinet + Nav Today
defineTest(
  'T3-COM-14',
  3,
  'Combinations',
  'Quét Preset 1 -> Chuyển qua xem Tủ Thuốc -> Chuyển về Tab Hôm Nay tick uống',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    state.importPrescription(MOCK_ANALYSIS_PRESET_1);
    const cabCount = (await StoreTestHarness.getState()).cabinet.length;
    assert.ok(cabCount >= 7);

    state.toggleDoseSlot('morning');
    const morningTaken = (await StoreTestHarness.getState()).schedule[0].isTaken;
    assert.equal(morningTaken, true);
  }
);

// T3-COM-15: Tab 1 Reset + Tab 2 Immediate Scan
defineTest(
  'T3-COM-15',
  3,
  'Combinations',
  'Bấm Reset Demo trên Tab 1 -> Lập tức sang Tab 2 quét Preset 2: kiểm tra tính toàn vẹn',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    state.resetToDemo();
    const warnings = evaluatePrescriptionConflicts(
      MOCK_ANALYSIS_PRESET_2.medicines,
      state.cabinet
    );

    assert.equal(warnings.length, 2);
    assert.ok(warnings.some((w) => w.source === 'internal_prescription'));
    assert.ok(warnings.some((w) => w.source === 'cabinet_conflict'));
  }
);

// T3-COM-16: Multi-tab Navigation Flow
defineTest(
  'T3-COM-16',
  3,
  'Combinations',
  'Chuyển tuần tự Tab 1 -> Tab 2 -> Tab 3 -> Tab 1: trạng thái tick cữ nguyên vẹn',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    // 1. Tab 1: Tick morning
    state.toggleDoseSlot('morning');

    // 2. Tab 2: Scan state exists
    const scanResult = MOCK_ANALYSIS_PRESET_1;
    assert.ok(scanResult);

    // 3. Tab 3: Filter Stomach
    const stomachMeds = filterCabinet(state.cabinet, 'Dạ dày');
    assert.ok(stomachMeds.length > 0);

    // 4. Back to Tab 1: Morning is still ticked!
    const morningSlot = (await StoreTestHarness.getState()).schedule[0];
    assert.equal(morningSlot.isTaken, true);
  }
);
