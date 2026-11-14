#!/usr/bin/env node

/**
 * MedLensAI Milestone 4 Adversarial Stress Test Suite
 * Author: Empirical Challenger
 * Verifies edge cases, stress conditions, and crash resilience.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Initialize bootstrap (Module hooks, @/* resolution, AsyncStorage & Haptics shims)
require('./harness/bootstrap.cjs');

const { StoreTestHarness } = require('./harness/storeTestHarness.ts');
const { MockAsyncStorage } = require('./harness/mockAsyncStorage.ts');
const { useMedStore } = require('../../store/useMedStore.ts');
const {
  evaluatePrescriptionConflicts,
  categorizeWarnings,
  filterCabinet,
  filterCabinetByCategory,
  checkExpiryStatus,
  getStockStatus,
  sanitizePrescriptionMetadata,
  CABINET_CATEGORIES,
} = require('@/services/clinical.ts');
const {
  MOCK_SCHEDULE,
  MOCK_CABINET,
  MOCK_ANALYSIS_PRESET_1,
  MOCK_ANALYSIS_PRESET_2,
} = require('@/mocks/mockData.ts');
const { scanAllProjectUIFiles } = require('./harness/uiValidator.ts');
const fs = require('fs');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureDetails = [];

function runAssert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`   ✅ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`   ❌ [FAIL] ${name}`);
    console.error(`      Error: ${err.message}`);
    failureDetails.push({ name, error: err.message, stack: err.stack });
  }
}

console.log('\n======================================================================');
console.log('🔥 MEDLENS AI — EMPIRICAL ADVERSARIAL STRESS SUITE');
console.log('======================================================================\n');

async function runSuite() {
  // -------------------------------------------------------------------------
  // SECTION 1: PRESET 1 & PRESET 2 EXECUTION & WARNING ENGINE STRESS
  // -------------------------------------------------------------------------
  console.log('📌 1. PRESET 1 & 2 EXECUTION AND WARNING MATRIX');

  await test('Preset 1 metadata completeness & zero conflict guarantee', async () => {
    const p1 = MOCK_ANALYSIS_PRESET_1;
    runAssert(p1.doctorName && p1.doctorName.includes('Trần Văn Minh'), 'Doctor name must match');
    runAssert(p1.diagnosis && p1.diagnosis.includes('Tăng huyết áp'), 'Diagnosis must match');
    runAssert(Array.isArray(p1.medicines) && p1.medicines.length === 3, 'Must have 3 medicines');
    runAssert(Array.isArray(p1.warnings) && p1.warnings.length === 0, 'Must have 0 warnings');

    const summary = categorizeWarnings(p1.warnings);
    runAssert(summary.hasWarnings === false, 'hasWarnings must be false');
    runAssert(summary.internal.length === 0, 'Internal warnings must be empty');
    runAssert(summary.cabinet.length === 0, 'Cabinet warnings must be empty');
  });

  await test('Preset 2 dual-layer conflict detection (Layer 1 internal + Layer 2 cabinet)', async () => {
    const p2 = MOCK_ANALYSIS_PRESET_2;
    runAssert(p2.doctorName && p2.doctorName.includes('Lê Thị Mai'), 'Doctor name must match');
    runAssert(Array.isArray(p2.medicines) && p2.medicines.length === 2, 'Must have 2 medicines');
    runAssert(Array.isArray(p2.warnings) && p2.warnings.length === 2, 'Must have 2 warnings');

    const summary = categorizeWarnings(p2.warnings);
    runAssert(summary.hasWarnings === true, 'hasWarnings must be true');
    runAssert(summary.internal.length === 1, 'Must have 1 internal warning');
    runAssert(summary.cabinet.length === 1, 'Must have 1 cabinet warning');

    // Layer 1 validation
    const l1 = summary.internal[0];
    runAssert(l1.source === 'internal_prescription', 'L1 source must be internal_prescription');
    runAssert(l1.severity === 'high', 'L1 severity must be high');
    runAssert(l1.medicineA.includes('Ciprofloxacin') && l1.medicineB.includes('Gaviscon'), 'L1 meds mismatch');
    runAssert(l1.clinicalRecommendation && l1.clinicalRecommendation.length > 5, 'L1 must have recommendation');

    // Layer 2 validation
    const l2 = summary.cabinet[0];
    runAssert(l2.source === 'cabinet_conflict', 'L2 source must be cabinet_conflict');
    runAssert(l2.severity === 'moderate', 'L2 severity must be moderate');
    runAssert(l2.medicineA.includes('Gaviscon') && l2.medicineB.includes('Aspirin'), 'L2 meds mismatch');
    runAssert(l2.clinicalRecommendation && l2.clinicalRecommendation.length > 5, 'L2 must have recommendation');
  });

  await test('Sanitize prescription metadata handles malformed/empty OCR results gracefully', async () => {
    const malformed = {
      doctorName: '',
      medicines: [
        {
          id: 'partial-med',
          name: 'Paracetamol',
          dosage: '500mg',
          activeIngredient: '',
          mealTiming: undefined,
          purpose: '',
          timeSlots: [],
          instructions: 'Uống khi sốt',
          remainingCount: 10,
          category: 'Pain Relief',
          expiryDate: '2027-01-01',
        },
      ],
      warnings: undefined,
    };

    const sanitized = sanitizePrescriptionMetadata(malformed);
    runAssert(sanitized.doctorName === 'Bác sĩ phụ trách (Theo đơn)', 'Default doctor assigned');
    runAssert(sanitized.diagnosis === 'Chẩn đoán lâm sàng chung', 'Default diagnosis assigned');
    runAssert(sanitized.warnings && sanitized.warnings.length === 0, 'Default warnings empty array');
    runAssert(sanitized.medicines[0].mealTiming === 'after_meal', 'Default mealTiming after_meal');
    runAssert(sanitized.medicines[0].activeIngredient === 'Đang cập nhật', 'Default activeIngredient assigned');
    runAssert(
      sanitized.medicines[0].timeSlots && sanitized.medicines[0].timeSlots.includes('morning'),
      'Default timeSlot morning assigned'
    );
  });

  // -------------------------------------------------------------------------
  // SECTION 2: DUAL-LAYER CONFLICT ENGINE UNDER EXTREME BOUNDARY CONDITIONS
  // -------------------------------------------------------------------------
  console.log('\n📌 2. DUAL-LAYER CONFLICT ENGINE BOUNDARY & EDGE CASES');

  await test('Conflict engine under EMPTY cabinet: Layer 1 fires, Layer 2 suppressed', async () => {
    const emptyCabinet = [];
    const warnings = evaluatePrescriptionConflicts(MOCK_ANALYSIS_PRESET_2.medicines, emptyCabinet);

    const summary = categorizeWarnings(warnings);
    runAssert(summary.hasWarnings === true, 'Internal warning still detected');
    runAssert(summary.internal.length === 1, 'Layer 1 internal conflict must fire');
    runAssert(summary.cabinet.length === 0, 'Layer 2 cabinet conflict must NOT fire with empty cabinet');
    runAssert(summary.internal[0].medicineA.includes('Ciprofloxacin'), 'Layer 1 medicine check');
  });

  await test('Conflict engine under SINGLE MEDICATION prescriptions', async () => {
    // Subcase 1: Only Ciprofloxacin in prescription
    const onlyCipro = [
      {
        id: 'cipro-only',
        name: 'Ciprofloxacin 500mg',
        dosage: '1 viên',
        activeIngredient: 'Ciprofloxacin',
        mealTiming: 'after_meal',
        purpose: 'Kháng sinh',
        timeSlots: ['morning'],
        instructions: 'Uống sau ăn',
        remainingCount: 10,
        category: 'Antibiotics',
        expiryDate: '2027-01-01',
      },
    ];

    // With Aspirin in cabinet: 0 warnings
    const warningsCiproAspirin = evaluatePrescriptionConflicts(onlyCipro, MOCK_CABINET);
    runAssert(warningsCiproAspirin.length === 0, 'Cipro alone with Aspirin cabinet produces 0 warnings');

    // Subcase 2: Only Gaviscon in prescription with Aspirin in cabinet
    const onlyGaviscon = [
      {
        id: 'gaviscon-only',
        name: 'Gaviscon Dual Action 10ml',
        dosage: '1 gói',
        activeIngredient: 'Natri alginate, Canxi cacbonat',
        mealTiming: 'after_meal',
        purpose: 'Dạ dày',
        timeSlots: ['morning'],
        instructions: 'Uống sau ăn',
        remainingCount: 20,
        category: 'Stomach',
        expiryDate: '2027-01-01',
      },
    ];

    const warningsGavisconAspirin = evaluatePrescriptionConflicts(onlyGaviscon, MOCK_CABINET);
    runAssert(warningsGavisconAspirin.length === 1, 'Gaviscon alone with Aspirin cabinet produces 1 warning');
    runAssert(warningsGavisconAspirin[0].source === 'cabinet_conflict', 'Must be cabinet conflict');
    runAssert(warningsGavisconAspirin[0].severity === 'moderate', 'Must be moderate severity');

    // Subcase 3: Only Gaviscon in prescription with NO Aspirin in cabinet
    const cabinetNoAspirin = MOCK_CABINET.filter((m) => !m.name.toLowerCase().includes('aspirin'));
    const warningsGavisconNoAspirin = evaluatePrescriptionConflicts(onlyGaviscon, cabinetNoAspirin);
    runAssert(warningsGavisconNoAspirin.length === 0, 'Gaviscon without Aspirin in cabinet produces 0 warnings');
  });

  await test('Conflict engine under DUPLICATE and CASE-INSENSITIVE prescriptions', async () => {
    // Prescription with uppercase and duplicates
    const duplicateUppercasePrescription = [
      {
        id: 'dup-1',
        name: '  CIPROFLOXACIN 500MG  ',
        dosage: '1 viên',
        activeIngredient: 'Ciprofloxacin',
        mealTiming: 'after_meal',
        purpose: 'Kháng sinh',
        timeSlots: ['morning'],
        instructions: 'Test',
        remainingCount: 10,
        category: 'Antibiotics',
        expiryDate: '2027-01-01',
      },
      {
        id: 'dup-2',
        name: 'Ciprofloxacin 500mg',
        dosage: '1 viên',
        activeIngredient: 'Ciprofloxacin',
        mealTiming: 'after_meal',
        purpose: 'Kháng sinh',
        timeSlots: ['evening'],
        instructions: 'Test',
        remainingCount: 10,
        category: 'Antibiotics',
        expiryDate: '2027-01-01',
      },
      {
        id: 'dup-3',
        name: 'GAVISCON Dual Action',
        dosage: '1 gói',
        activeIngredient: 'Alginate',
        mealTiming: 'after_meal',
        purpose: 'Dạ dày',
        timeSlots: ['morning'],
        instructions: 'Test',
        remainingCount: 10,
        category: 'Stomach',
        expiryDate: '2027-01-01',
      },
    ];

    const warnings = evaluatePrescriptionConflicts(duplicateUppercasePrescription, MOCK_CABINET);
    runAssert(warnings.length === 2, 'Must yield exactly 2 warnings (1 internal, 1 cabinet) without duplicates');

    const internal = warnings.filter((w) => w.source === 'internal_prescription');
    const cabinet = warnings.filter((w) => w.source === 'cabinet_conflict');
    runAssert(internal.length === 1, 'Only 1 internal warning despite duplicate Ciprofloxacin lines');
    runAssert(cabinet.length === 1, 'Only 1 cabinet warning');
  });

  // -------------------------------------------------------------------------
  // SECTION 3: 100% KILL-APP RESILIENCE & MULTI-MUTATION PERSISTENCE
  // -------------------------------------------------------------------------
  console.log('\n📌 3. KILL-APP RESILIENCE & COLD-BOOT REHYDRATION');

  await test('Process death simulation with partial doses and mutated inventory', async () => {
    await StoreTestHarness.resetAll();
    const store = useMedStore;

    // Mutate doses: take morning (08:00) and evening (20:00), leave noon untaken
    store.getState().toggleDoseSlot('morning');
    store.getState().toggleDoseSlot('evening');

    // Mutate inventory: update Amlodipine count to 14, and Metformin to 0
    const amloId = store.getState().cabinet.find((m) => m.name.includes('Amlodipine'))?.id;
    const metId = store.getState().cabinet.find((m) => m.name.includes('Metformin'))?.id;
    runAssert(amloId && metId, 'Found medicine IDs');

    store.getState().updateMedicineCount(amloId, 14);
    store.getState().updateMedicineCount(metId, 0);

    // Smart Merge Preset 2 into schedule & cabinet
    store.getState().importPrescription(MOCK_ANALYSIS_PRESET_2);

    // Verify pre-crash state
    const preCrashState = store.getState();
    const preMorning = preCrashState.schedule.find((s) => s.slot === 'morning');
    const preNoon = preCrashState.schedule.find((s) => s.slot === 'noon');
    const preEvening = preCrashState.schedule.find((s) => s.slot === 'evening');
    runAssert(preMorning?.isTaken === true, 'Morning taken before crash');
    runAssert(preNoon?.isTaken === false, 'Noon untaken before crash');
    runAssert(preEvening?.isTaken === true, 'Evening taken before crash');
    runAssert(preCrashState.cabinet.length === 9, 'Cabinet has 9 meds before crash (7 initial + 2 new)');

    // 💥 SIMULATE 100% PROCESS TERMINATION (KILL APP)
    const freshStore = await StoreTestHarness.killAndRestartApp();
    const postCrashState = freshStore.getState();

    // Verify post-crash schedule doses preserved
    const postMorning = postCrashState.schedule.find((s) => s.slot === 'morning');
    const postNoon = postCrashState.schedule.find((s) => s.slot === 'noon');
    const postEvening = postCrashState.schedule.find((s) => s.slot === 'evening');

    runAssert(postMorning?.isTaken === true, 'Morning dose preserved across process death');
    runAssert(typeof postMorning?.takenAt === 'string', 'Morning takenAt preserved');
    runAssert(postNoon?.isTaken === false, 'Noon dose remained false across process death');
    runAssert(postEvening?.isTaken === true, 'Evening dose preserved across process death');
    runAssert(typeof postEvening?.takenAt === 'string', 'Evening takenAt preserved');

    // Verify post-crash inventory preserved
    const postAmlo = postCrashState.cabinet.find((m) => m.id === amloId);
    const postMet = postCrashState.cabinet.find((m) => m.id === metId);
    runAssert(postAmlo?.remainingCount === 14, 'Amlodipine count preserved at 14');
    runAssert(postMet?.remainingCount === 0, 'Metformin count preserved at 0');

    // Verify post-crash newly merged medicines exist
    const hasCipro = postCrashState.cabinet.some((m) => m.name.includes('Ciprofloxacin'));
    const hasGaviscon = postCrashState.cabinet.some((m) => m.name.includes('Gaviscon'));
    runAssert(hasCipro && hasGaviscon, 'Preset 2 medicines preserved in cabinet across process death');
  });

  await test('Sequential multi-kill resilience: untoggle dose, kill again, verify second recovery', async () => {
    const currentStore = useMedStore;

    // Untoggle morning dose back to false
    currentStore.getState().toggleDoseSlot('morning');
    runAssert(currentStore.getState().schedule.find((s) => s.slot === 'morning')?.isTaken === false, 'Morning untoggled');

    // Second kill-app
    const freshStore2 = await StoreTestHarness.killAndRestartApp();
    const state2 = freshStore2.getState();

    const morning2 = state2.schedule.find((s) => s.slot === 'morning');
    const evening2 = state2.schedule.find((s) => s.slot === 'evening');

    runAssert(morning2?.isTaken === false, 'Morning dose untoggle preserved after second kill');
    runAssert(morning2?.takenAt === undefined, 'Morning takenAt cleared after untoggle and kill');
    runAssert(evening2?.isTaken === true, 'Evening dose still taken after second kill');
  });

  await test('Reset to demo restores initial baseline cleanly and persists across kill-app', async () => {
    const store = useMedStore;

    // Execute resetToDemo
    store.getState().resetToDemo();

    // Verify memory state
    runAssert(store.getState().cabinet.length === 7, 'Cabinet restored to 7 items');
    runAssert(store.getState().schedule.every((s) => !s.isTaken), 'All slots reset to untaken');

    // Kill app again to ensure demo reset persists in storage
    const freshStore3 = await StoreTestHarness.killAndRestartApp();
    const state3 = freshStore3.getState();

    runAssert(state3.cabinet.length === 7, 'Persisted cabinet is 7 items');
    runAssert(state3.schedule.every((s) => !s.isTaken), 'Persisted schedule is untaken');
  });

  // -------------------------------------------------------------------------
  // SECTION 4: CABINET FILTERS & MODAL STATE INDEPENDENCE
  // -------------------------------------------------------------------------
  console.log('\n📌 4. FILTER TRANSITIONS & MODAL STATE INDEPENDENCE');

  await test('Cabinet category filtering matches clinical classifications accurately', async () => {
    const cabinet = MOCK_CABINET;

    // All 6 categories
    runAssert(CABINET_CATEGORIES.length === 6, 'Must define 6 categories');

    const all = filterCabinetByCategory(cabinet, 'Tất cả');
    runAssert(all.length === 7, 'Tất cả returns all 7 medicines');

    const bp = filterCabinetByCategory(cabinet, 'Huyết áp');
    runAssert(bp.length === 3, 'Huyết áp returns 3 medicines (Aspirin, Amlodipine, Atorvastatin)');

    const diab = filterCabinetByCategory(cabinet, 'Tiểu đường');
    runAssert(diab.length === 1 && diab[0].name.includes('Metformin'), 'Tiểu đường returns Metformin');

    const pain = filterCabinetByCategory(cabinet, 'Giảm đau');
    runAssert(pain.length === 1 && pain[0].name.includes('Paracetamol'), 'Giảm đau returns Paracetamol');

    const stomach = filterCabinetByCategory(cabinet, 'Dạ dày');
    runAssert(stomach.length === 1 && stomach[0].name.includes('Omeprazole'), 'Dạ dày returns Omeprazole');

    const anti = filterCabinetByCategory(cabinet, 'Kháng sinh');
    runAssert(anti.length === 1 && anti[0].name.includes('Augmentin'), 'Kháng sinh returns Augmentin');
  });

  await test('Filter transitions and MedicineDetailModal state independence', async () => {
    await StoreTestHarness.resetAll();
    const store = useMedStore;

    // 1. Select Amlodipine to open modal
    const amlo = store.getState().cabinet.find((m) => m.name.includes('Amlodipine'));
    runAssert(amlo, 'Amlodipine exists');
    store.getState().setSelectedMedicine(amlo);

    // 2. Verify selectedMedicine in store
    runAssert(store.getState().selectedMedicine?.id === amlo.id, 'Selected medicine is Amlodipine');

    // 3. Simulate changing category filter in UI (e.g. user taps "Tiểu đường")
    const filteredMeds = filterCabinetByCategory(store.getState().cabinet, 'Tiểu đường');
    runAssert(filteredMeds.length === 1 && filteredMeds[0].name.includes('Metformin'), 'Filtered is Metformin');

    // 4. Modal state independence check: selectedMedicine must NOT be altered by filter transition
    runAssert(
      store.getState().selectedMedicine?.id === amlo.id,
      'selectedMedicine remained Amlodipine regardless of active filter'
    );

    // 5. Close modal: selectedMedicine becomes null
    store.getState().setSelectedMedicine(null);
    runAssert(store.getState().selectedMedicine === null, 'Modal closed and selectedMedicine is null');

    // 6. Cabinet must remain completely intact
    runAssert(store.getState().cabinet.length === 7, 'Cabinet untouched');
  });

  await test('Stock status and pill decrement safety boundaries', async () => {
    // 0 pills
    const outStock = getStockStatus(0);
    runAssert(outStock.isOut === true, '0 pills isOut true');
    runAssert(outStock.variant === 'destructive', '0 pills variant destructive');
    runAssert(outStock.label.includes('Hết thuốc'), '0 pills label Hết thuốc');

    // Low stock <= 10
    const lowStock = getStockStatus(5);
    runAssert(lowStock.isOut === false, '5 pills isOut false');
    runAssert(lowStock.variant === 'warning', '5 pills variant warning');
    runAssert(lowStock.label.includes('Sắp hết (còn 5 viên)'), '5 pills label format');

    // Normal stock
    const normalStock = getStockStatus(28);
    runAssert(normalStock.isOut === false, '28 pills isOut false');
    runAssert(normalStock.variant === 'default', '28 pills variant default');
    runAssert(normalStock.label === 'Còn 28 viên', '28 pills label format');
  });

  await test('Expiry date parsing edge cases (DD/MM/YYYY, MM/YYYY, ISO, relative reference)', async () => {
    const refDate = new Date('2026-11-11');

    // Expired in past
    const exp1 = checkExpiryStatus('2026-10-01', refDate);
    runAssert(exp1.isExpired === true, '2026-10-01 is expired');
    runAssert(exp1.badgeVariant === 'destructive', 'Expired badge destructive');

    // Expiring soon (< 30 days)
    const exp2 = checkExpiryStatus('2026-11-25', refDate);
    runAssert(exp2.isExpiringSoon === true, '2026-11-25 is expiring soon');
    runAssert(exp2.badgeVariant === 'warning', 'Expiring soon badge warning');

    // Valid long term (> 30 days)
    const exp3 = checkExpiryStatus('2027-12-31', refDate);
    runAssert(exp3.isExpired === false && exp3.isExpiringSoon === false, '2027-12-31 is valid');
    runAssert(exp3.badgeVariant === 'default', 'Valid badge default');

    // Vietnamese slash format DD/MM/YYYY
    const exp4 = checkExpiryStatus('01/10/2026', refDate);
    runAssert(exp4.isExpired === true, '01/10/2026 slash format parsed as expired');
  });

  // -------------------------------------------------------------------------
  // SECTION 5: STATIC AST COMPLIANCE & STARTER FILES VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n📌 5. STATIC AST UI & ARTIFACT COMPLIANCE');

  await test('AST check: Zero forbidden HTML tags across app/ and components/', async () => {
    const results = scanAllProjectUIFiles();
    runAssert(results.length > 0, 'Must have scanned UI files');
    const violations = results.filter((r) => r.forbiddenHtmlTags.length > 0);
    if (violations.length > 0) {
      console.error('Violations detected:', violations);
    }
    runAssert(violations.length === 0, `No forbidden HTML tags allowed, found in ${violations.length} files`);
  });

  await test('Verification: Starter files deleted and index.tsx redirects cleanly', async () => {
    const homeExists = fs.existsSync('app/(tabs)/home.tsx');
    const exploreExists = fs.existsSync('app/(tabs)/explore.tsx');
    runAssert(!homeExists, 'app/(tabs)/home.tsx must NOT exist');
    runAssert(!exploreExists, 'app/(tabs)/explore.tsx must NOT exist');

    const indexContent = fs.readFileSync('app/index.tsx', 'utf8');
    runAssert(indexContent.includes('Redirect'), 'app/index.tsx must contain Redirect');
    runAssert(indexContent.includes('/(tabs)'), 'app/index.tsx must redirect to /(tabs)');
  });

  console.log('\n======================================================================');
  console.log(`📊 ADVERSARIAL STRESS SUITE RESULTS:`);
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Passed:      ${passedTests}`);
  console.log(`   Failed:      ${failedTests}`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Stress suite crashed:', err);
  process.exit(1);
});
