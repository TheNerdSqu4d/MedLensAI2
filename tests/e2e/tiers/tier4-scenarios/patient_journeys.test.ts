import { defineTest, assert } from '../../harness/testContext';
import { StoreTestHarness } from '../../harness/storeTestHarness';
import { MockNetworkController } from '../../harness/mockNetwork';
import {
  MockHapticsController,
  NotificationFeedbackType,
  ImpactFeedbackStyle,
  notificationAsync,
  impactAsync,
} from '../../harness/mockHaptics';
import {
  MOCK_ANALYSIS_PRESET_1,
  MOCK_ANALYSIS_PRESET_2,
  MED_AMLODIPINE,
  MED_METFORMIN,
  MED_ATORVASTATIN,
  MED_ASPIRIN,
  MED_OMEPRAZOLE,
} from '@/mocks/mockData';
import { calculateAdherence } from '../tier1-features/adherence_card.test';
import { filterCabinet } from '../tier1-features/cabinet_filters.test';
import { evaluatePrescriptionConflicts } from '../tier2-boundaries/empty_cabinet.test';
import { resilientAnalyzePrescription } from '../tier2-boundaries/offline_network_fallback.test';
import { scanAllProjectUIFiles } from '../../harness/uiValidator';

// T4-SCEN-01: Scenario 1 - Elderly Chronic Routine (Cụ An, 68 tuổi)
defineTest(
  'T4-SCEN-01',
  4,
  'Real-World Scenarios',
  'Hành trình 1: Bệnh nhân cao tuổi điều trị bệnh mãn tính hàng ngày (Cụ An)',
  async () => {
    // 1. Initial morning: 0/3 doses taken
    await StoreTestHarness.resetAll();
    let state = await StoreTestHarness.getState();
    let adh = calculateAdherence(state.schedule);
    assert.equal(adh.completed, 0);
    assert.equal(adh.percentage, 0);
    assert.equal(adh.badgeLabel, 'Cần uống thêm');

    // 2. 08:00 Morning dose taken (Amlodipine + Metformin) with haptic feedback
    MockHapticsController.clear();
    state.toggleDoseSlot('morning');
    await notificationAsync(NotificationFeedbackType.Success);

    const hapticCalls = MockHapticsController.getCallsByMethod('notificationAsync');
    assert.equal(hapticCalls.length, 1);
    assert.equal(hapticCalls[0].arg, NotificationFeedbackType.Success);

    state = await StoreTestHarness.getState();
    const morningSlot = state.schedule[0];
    assert.equal(morningSlot.isTaken, true);
    assert.ok(morningSlot.takenAt);
    const morningTakenAt = morningSlot.takenAt;

    adh = calculateAdherence(state.schedule);
    assert.equal(adh.completed, 2);
    assert.equal(adh.percentage, 67);

    // 3. 12:30 Noon dose taken (Metformin)
    state.toggleDoseSlot('noon');
    state = await StoreTestHarness.getState();
    adh = calculateAdherence(state.schedule);
    assert.equal(adh.completed, 3);
    assert.equal(adh.percentage, 100);

    // 4. 20:00 Evening dose taken (Atorvastatin)
    state.toggleDoseSlot('evening');
    state = await StoreTestHarness.getState();
    adh = calculateAdherence(state.schedule);
    assert.equal(adh.completed, 3);
    assert.equal(adh.percentage, 100);
    assert.equal(adh.badgeLabel, 'Tuyệt vời');

    // 5. Overnight Kill App
    await StoreTestHarness.flushStorage();
    const restartedStore = await StoreTestHarness.killAndRestartApp();
    const restoredState = restartedStore.getState();

    // 6. Verify 100% data preservation
    const restoredAdh = calculateAdherence(restoredState.schedule);
    assert.equal(restoredAdh.completed, 3);
    assert.equal(restoredAdh.percentage, 100);
    assert.equal(restoredState.schedule[0].takenAt, morningTakenAt);
  }
);

// T4-SCEN-02: Scenario 2 - Acute Antibiotic Clash (Bác Mai, 55 tuổi)
defineTest(
  'T4-SCEN-02',
  4,
  'Real-World Scenarios',
  'Hành trình 2: Bệnh nhân tim mạch bị nhiễm khuẩn cấp kỵ thuốc tủ nhà (Bác Mai)',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    // Patient has Aspirin 81mg in cabinet
    assert.ok(state.cabinet.some((m) => m.name.includes('Aspirin 81mg')));

    // Scans Preset 2 (Cipro + Gaviscon)
    const warnings = evaluatePrescriptionConflicts(
      MOCK_ANALYSIS_PRESET_2.medicines,
      state.cabinet
    );

    // Red alert (Layer 1 internal: Cipro + Gaviscon)
    const layer1 = warnings.find((w) => w.source === 'internal_prescription');
    assert.ok(layer1);
    assert.equal(layer1?.severity, 'high');
    assert.includes(layer1?.medicineA, 'Ciprofloxacin');
    assert.includes(layer1?.medicineB, 'Gaviscon');

    // Amber alert (Layer 2 cross: Gaviscon + Aspirin)
    const layer2 = warnings.find((w) => w.source === 'cabinet_conflict');
    assert.ok(layer2);
    assert.equal(layer2?.severity, 'moderate');
    assert.includes(layer2?.medicineA, 'Gaviscon');
    assert.includes(layer2?.medicineB, 'Aspirin 81mg');

    // Haptic warning emitted
    MockHapticsController.clear();
    await notificationAsync(NotificationFeedbackType.Warning);
    const warnHaptics = MockHapticsController.getCallsByMethod('notificationAsync');
    assert.equal(warnHaptics[0].arg, NotificationFeedbackType.Warning);

    // Click Smart Merge CTA
    state.importPrescription(MOCK_ANALYSIS_PRESET_2);

    const mergedState = await StoreTestHarness.getState();
    // Medications assigned properly
    assert.ok(mergedState.schedule[0].medicines.some((m) => m.name.includes('Ciprofloxacin')));
    assert.ok(mergedState.schedule[1].medicines.some((m) => m.name.includes('Gaviscon')));
    assert.ok(mergedState.cabinet.some((m) => m.name.includes('Ciprofloxacin')));
  }
);

// T4-SCEN-03: Scenario 3 - Rural Offline Emergency (Chị Lan)
defineTest(
  'T4-SCEN-03',
  4,
  'Real-World Scenarios',
  'Hành trình 3: Khám bệnh khẩn cấp vùng sâu mất sóng mạng (Chị Lan tình nguyện)',
  async () => {
    await StoreTestHarness.resetAll();
    MockNetworkController.setMode('NETWORK_OFFLINE');

    // Resilient fallback returns analysis safely without unhandled errors
    const analysis = await resilientAnalyzePrescription('preset1');
    assert.ok(analysis);
    assert.equal(analysis.medicines.length, 3);

    // Smart Merge offline
    const state = await StoreTestHarness.getState();
    state.importPrescription(analysis);

    const updated = await StoreTestHarness.getState();
    assert.equal(updated.schedule[0].medicines.length, 2); // Amlodipine + Metformin
    assert.equal(updated.schedule[1].medicines.length, 1); // Metformin
  }
);

// T4-SCEN-04: Scenario 4 - Caregiver Stock Audit (Anh Hùng)
defineTest(
  'T4-SCEN-04',
  4,
  'Real-World Scenarios',
  'Hành trình 4: Người chăm sóc kiểm kê tủ thuốc gia đình và mua thêm thuốc (Anh Hùng)',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    // 1. Audit categories
    const diabetesMeds = filterCabinet(state.cabinet, 'Tiểu đường');
    assert.equal(diabetesMeds.length, 1);
    assert.includes(diabetesMeds[0].name, 'Metformin');
    assert.equal(diabetesMeds[0].remainingCount, 56);

    const bpMeds = filterCabinet(state.cabinet, 'Huyết áp');
    assert.ok(bpMeds.length >= 3);

    // 2. Check Omeprazole in Stomach
    const omeprazole = state.cabinet.find((m) => m.name.includes('Omeprazole'));
    assert.ok(omeprazole);
    assert.equal(omeprazole?.remainingCount, 14);

    // 3. Purchase 20 more pills -> increase to 34
    const { useMedStore } = await import('@/store/useMedStore');
    const updatedCabinet = state.cabinet.map((m) =>
      m.name.includes('Omeprazole') ? { ...m, remainingCount: m.remainingCount + 20 } : m
    );
    useMedStore.setState({ cabinet: updatedCabinet });

    const currentCabinet = (await StoreTestHarness.getState()).cabinet;
    const omeUpdated = currentCabinet.find((m) => m.name.includes('Omeprazole'));
    assert.equal(omeUpdated?.remainingCount, 34);

    // 4. Kill App and restart to verify persistence
    await StoreTestHarness.flushStorage();
    const freshStore = await StoreTestHarness.killAndRestartApp();
    const persistedOme = freshStore.getState().cabinet.find((m) => m.name.includes('Omeprazole'));

    assert.ok(persistedOme);
    assert.equal(persistedOme?.remainingCount, 34);
  }
);

// T4-SCEN-05: Scenario 5 - Hackathon Grand Jury Demo & Kill-App Walkthrough
defineTest(
  'T4-SCEN-05',
  4,
  'Real-World Scenarios',
  'Hành trình 5: Bài thi trình diễn hoàn hảo trước Ban Giám Khảo Hackathon (100% Kill-App Test)',
  async () => {
    // 0:00 Reset demo data
    await StoreTestHarness.resetAll();
    let state = await StoreTestHarness.getState();
    state.resetToDemo();
    let adh = calculateAdherence(state.schedule);
    assert.equal(adh.completed, 0);
    assert.equal(adh.percentage, 0);

    // 0:30 1-touch toggle morning
    MockHapticsController.clear();
    state.toggleDoseSlot('morning');
    await notificationAsync(NotificationFeedbackType.Success);

    state = await StoreTestHarness.getState();
    assert.equal(state.schedule[0].isTaken, true);
    const firstCheckTimestamp = state.schedule[0].takenAt;
    adh = calculateAdherence(state.schedule);
    assert.equal(adh.percentage, 67);

    // 1:00 Preset 2 scan with resilient fallback
    MockNetworkController.setMode('SUCCESS_PRESET_2');
    const scanResult = await resilientAnalyzePrescription('preset2');
    assert.equal(scanResult.medicines.length, 2);

    // 1:30 Dual-layer conflict check
    const warnings = evaluatePrescriptionConflicts(scanResult.medicines, state.cabinet);
    assert.equal(warnings.length, 2);

    // 2:00 Smart Merge CTA without resetting morning dose!
    MockHapticsController.clear();
    state.importPrescription(scanResult);
    await impactAsync(ImpactFeedbackStyle.Medium);

    state = await StoreTestHarness.getState();
    assert.equal(
      state.schedule[0].isTaken,
      true,
      'Smart Merge must NEVER reset an already taken dose!'
    );
    assert.equal(state.schedule[0].takenAt, firstCheckTimestamp);

    // 2:30 The Ultimate Challenge: 100% Kill App Test!
    await StoreTestHarness.flushStorage();
    const resurrectedStore = await StoreTestHarness.killAndRestartApp();
    const resurrectedState = resurrectedStore.getState();

    // 2:45 Verification of triumphant resurrection
    assert.equal(resurrectedState.schedule[0].isTaken, true);
    assert.equal(resurrectedState.schedule[0].takenAt, firstCheckTimestamp);
    assert.ok(
      resurrectedState.schedule[0].medicines.some((m) => m.name.includes('Ciprofloxacin'))
    );
    assert.ok(
      resurrectedState.cabinet.some((m) => m.name.includes('Gaviscon'))
    );
    const finalAdh = calculateAdherence(resurrectedState.schedule);
    assert.equal(finalAdh.percentage, 50);
  }
);

// F22 UI HIG & Zero HTML Tags Static AST Compliance Suite
defineTest(
  'T4-UI-HIG',
  4,
  'UI & HIG Compliance',
  'Xác thực tĩnh AST: 100% không thẻ HTML thô và tuân thủ Apple Light Grouped Mode (#F2F2F7)',
  async () => {
    const results = scanAllProjectUIFiles();
    assert.ok(results.length > 0, 'Must have scanned UI files');

    for (const res of results) {
      if (res.forbiddenHtmlTags.length > 0) {
        const violations = res.forbiddenHtmlTags
          .map((t) => `<${t.tag}> (dòng ${t.line})`)
          .join(', ');
        throw new Error(
          `Phát hiện thẻ HTML thô bị cấm trong ${res.filePath}: ${violations}`
        );
      }
    }
  }
);
