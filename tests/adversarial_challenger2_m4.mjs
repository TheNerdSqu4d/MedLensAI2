#!/usr/bin/env node

/**
 * MedLens AI - Milestone 4 Independent Empirical Adversarial Challenger Test Suite
 * Author: Challenger 2 (Empirical Critic & Specialist)
 *
 * Verifies:
 * 1. AST constraints across app/ and components/: 0 raw HTML tags & #F2F2F7 background token.
 * 2. Smart Merge CTA: doses already taken are NEVER reset or cleared when new prescriptions are merged under adversarial conditions.
 * 3. Zero-pill count and expired medicine status handling in Tab 3 (boundaries, clamping, date parsing, empty states).
 * 4. Direct redirect in app/index.tsx to /(tabs).
 * 5. Complete removal of app/(tabs)/home.tsx and app/(tabs)/explore.tsx.
 * 6. Dual-layer alert engine separation.
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Initialize bootstrap
require('./e2e/harness/bootstrap.cjs');

// Extend Module resolution for UI component imports in node
const Module = require('module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'react-native') {
    return path.join(__dirname, 'mockReactNative.cjs');
  }
  if (request === 'expo-router') {
    return path.join(__dirname, 'mockExpoRouter.cjs');
  }
  if (request === 'lucide-react-native') {
    return path.join(__dirname, 'mockLucide.cjs');
  }
  if (request === 'react-native-safe-area-context') {
    return path.join(__dirname, 'mockSafeArea.cjs');
  }
  if (request === 'expo-status-bar') {
    return path.join(__dirname, 'mockReactNative.cjs');
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

const { scanAllProjectUIFiles, scanFileUIConstraints } = require('./e2e/harness/uiValidator.ts');
const { StoreTestHarness } = require('./e2e/harness/storeTestHarness.ts');
const { useMedStore } = require('@/store/useMedStore.ts');
const {
  filterCabinetByCategory,
  filterCabinet,
  CABINET_CATEGORIES,
  checkExpiryStatus,
  decrementPillCount,
  getStockStatus,
  getExpiryCardStyle,
  getExpiryModalWarning,
  calculateAdherence,
  evaluatePrescriptionConflicts,
  categorizeWarnings,
} = require('@/services/clinical.ts');
const { formatCabinetBadgeText } = require('@/app/(tabs)/cabinet.tsx');
const {
  MOCK_SCHEDULE,
  MOCK_CABINET,
  MOCK_ANALYSIS_PRESET_1,
  MOCK_ANALYSIS_PRESET_2,
  MED_AMLODIPINE,
  MED_METFORMIN,
  MED_ATORVASTATIN,
  MED_ASPIRIN,
  MED_GAVISCON,
} = require('@/mocks/mockData.ts');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

assert.equal = function (actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
};

assert.deepEqual = function (actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(
      `${message || 'Assertion failed'}: expected ${expectedStr}, got ${actualStr}`
    );
  }
};

assert.ok = function (value, message) {
  if (!value) {
    throw new Error(message || 'Assertion failed: value is not truthy');
  }
};

async function test(name, fn) {
  totalTests++;
  process.stdout.write(`   🧪 [TEST ${totalTests}] ${name}... `);
  try {
    await fn();
    passedTests++;
    console.log(`✅ PASS`);
  } catch (err) {
    failedTests++;
    console.log(`❌ FAIL`);
    console.error(`      💥 ${err.stack || err.message}`);
  }
}

async function run() {
  console.log('======================================================================');
  console.log('⚔️  MEDLENS AI — ADVERSARIAL CHALLENGER 2 EMPIRICAL TEST SUITE (M4)');
  console.log('======================================================================\n');

  // =========================================================================
  // SUITE 1: AST CONSTRAINTS & PROJECT HYGIENE
  // =========================================================================
  console.log('📌 SUITE 1: AST CONSTRAINTS & PROJECT HYGIENE');

  await test('1.1 Zero raw HTML tags across ALL UI files in app/ and components/', async () => {
    const results = scanAllProjectUIFiles();
    assert.ok(results.length >= 10, `Expected at least 10 UI files, got ${results.length}`);
    const filesWithForbiddenTags = results.filter((r) => r.forbiddenHtmlTags.length > 0);
    if (filesWithForbiddenTags.length > 0) {
      const details = filesWithForbiddenTags
        .map((f) => `${f.filePath}: ${f.forbiddenHtmlTags.map((t) => `<${t.tag}>:L${t.line}`).join(', ')}`)
        .join('\n');
      throw new Error(`Forbidden raw HTML tags detected in ${filesWithForbiddenTags.length} files:\n${details}`);
    }
  });

  await test('1.2 Apple Light Grouped Mode (#F2F2F7) background token presence', async () => {
    const rootDir = path.resolve(__dirname, '..');
    const keyScreens = [
      path.join(rootDir, 'app/(tabs)/index.tsx'),
      path.join(rootDir, 'app/(tabs)/scan.tsx'),
      path.join(rootDir, 'app/(tabs)/cabinet.tsx'),
      path.join(rootDir, 'app/index.tsx'),
    ];

    for (const filePath of keyScreens) {
      assert.ok(fs.existsSync(filePath), `Screen must exist: ${filePath}`);
      const fileRes = scanFileUIConstraints(filePath);
      assert.ok(
        fileRes.hasLightGroupedBackground,
        `Screen ${path.basename(filePath)} must contain Apple Light Grouped Mode background token (#F2F2F7)`
      );
    }
  });

  await test('1.3 app/index.tsx is a direct headless redirect to /(tabs)', async () => {
    const rootDir = path.resolve(__dirname, '..');
    const indexFile = path.join(rootDir, 'app/index.tsx');
    assert.ok(fs.existsSync(indexFile), 'app/index.tsx must exist');
    const content = fs.readFileSync(indexFile, 'utf8');
    assert.ok(content.includes('<Redirect href="/(tabs)" />'), 'Must contain <Redirect href="/(tabs)" />');
    assert.ok(content.includes('expo-router'), 'Must import from expo-router');
    const fileRes = scanFileUIConstraints(indexFile);
    assert.equal(fileRes.forbiddenHtmlTags.length, 0, 'No raw HTML tags in app/index.tsx');
  });

  await test('1.4 app/(tabs)/home.tsx and app/(tabs)/explore.tsx are completely removed', async () => {
    const rootDir = path.resolve(__dirname, '..');
    const homePath = path.join(rootDir, 'app/(tabs)/home.tsx');
    const explorePath = path.join(rootDir, 'app/(tabs)/explore.tsx');
    assert.ok(!fs.existsSync(homePath), 'app/(tabs)/home.tsx must be DELETED from disk');
    assert.ok(!fs.existsSync(explorePath), 'app/(tabs)/explore.tsx must be DELETED from disk');

    const layoutPath = path.join(rootDir, 'app/(tabs)/_layout.tsx');
    const layoutContent = fs.readFileSync(layoutPath, 'utf8');
    assert.ok(!layoutContent.includes('name="home"'), '_layout.tsx must not declare home tab');
    assert.ok(!layoutContent.includes('name="explore"'), '_layout.tsx must not declare explore tab');
  });

  // =========================================================================
  // SUITE 2: SMART MERGE CTA — DOSE PRESERVATION ADVERSARIAL STRESS TEST
  // =========================================================================
  console.log('\n📌 SUITE 2: SMART MERGE CTA — DOSE PRESERVATION ADVERSARIAL STRESS TEST');

  await test('2.1 Morning dose taken (08:15Z) preserved through Smart Merge', async () => {
    await StoreTestHarness.resetAll();

    // Toggle morning dose
    useMedStore.getState().toggleDoseSlot('morning');
    const stateAfterToggle = useMedStore.getState();
    const morningSlot = stateAfterToggle.schedule.find((s) => s.slot === 'morning');
    assert.ok(morningSlot.isTaken, 'Morning slot must be taken');
    const takenTime = morningSlot.takenAt;
    assert.ok(takenTime, 'takenAt timestamp must be recorded');

    // Execute Smart Merge with Preset 1
    useMedStore.getState().importPrescription(MOCK_ANALYSIS_PRESET_1);

    const stateAfterMerge = useMedStore.getState();
    const morningSlotAfterMerge = stateAfterMerge.schedule.find((s) => s.slot === 'morning');
    assert.equal(morningSlotAfterMerge.isTaken, true, 'isTaken must STAY true after merge');
    assert.equal(morningSlotAfterMerge.takenAt, takenTime, 'takenAt timestamp must NOT be modified');
  });

  await test('2.2 Morning & Noon doses taken, Evening untoggled: Smart Merge preserves all states', async () => {
    await StoreTestHarness.resetAll();

    useMedStore.getState().toggleDoseSlot('morning');
    useMedStore.getState().toggleDoseSlot('noon');

    const morningTime = useMedStore.getState().schedule.find((s) => s.slot === 'morning').takenAt;
    const noonTime = useMedStore.getState().schedule.find((s) => s.slot === 'noon').takenAt;

    // Merge Preset 2 (Ciprofloxacin + Gaviscon)
    useMedStore.getState().importPrescription(MOCK_ANALYSIS_PRESET_2);

    const s = useMedStore.getState();
    const morningSlot = s.schedule.find((x) => x.slot === 'morning');
    const noonSlot = s.schedule.find((x) => x.slot === 'noon');
    const eveningSlot = s.schedule.find((x) => x.slot === 'evening');

    assert.equal(morningSlot.isTaken, true, 'Morning must remain taken');
    assert.equal(morningSlot.takenAt, morningTime, 'Morning timestamp preserved');
    assert.equal(noonSlot.isTaken, true, 'Noon must remain taken');
    assert.equal(noonSlot.takenAt, noonTime, 'Noon timestamp preserved');
    assert.equal(eveningSlot.isTaken, false, 'Evening must remain NOT taken');
    assert.equal(eveningSlot.takenAt, undefined, 'Evening timestamp remains undefined');

    // Adherence must reflect 2/3 (67%)
    const adherence = calculateAdherence(s.schedule);
    assert.equal(adherence.completed, 2);
    assert.equal(adherence.total, 3);
    assert.equal(adherence.percentage, 67);
  });

  await test('2.3 100% adherence (all 3 doses taken) before merge remains 100% Tuyệt vời after merge', async () => {
    await StoreTestHarness.resetAll();

    useMedStore.getState().toggleDoseSlot('morning');
    useMedStore.getState().toggleDoseSlot('noon');
    useMedStore.getState().toggleDoseSlot('evening');

    const adherenceBefore = calculateAdherence(useMedStore.getState().schedule);
    assert.equal(adherenceBefore.percentage, 100);
    assert.equal(adherenceBefore.badgeLabel, 'Tuyệt vời');

    // Merge multiple prescriptions
    useMedStore.getState().importPrescription(MOCK_ANALYSIS_PRESET_1);
    useMedStore.getState().importPrescription(MOCK_ANALYSIS_PRESET_2);

    const adherenceAfter = calculateAdherence(useMedStore.getState().schedule);
    assert.equal(adherenceAfter.completed, 3);
    assert.equal(adherenceAfter.total, 3);
    assert.equal(adherenceAfter.percentage, 100);
    assert.equal(adherenceAfter.badgeLabel, 'Tuyệt vời');
    assert.equal(adherenceAfter.badgeVariant, 'success');
  });

  await test('2.4 Rapid successive merges (10 sequential merges) preserve dose states and prevent duplicates', async () => {
    await StoreTestHarness.resetAll();

    // Mark morning taken
    useMedStore.getState().toggleDoseSlot('morning');
    const initialTakenAt = useMedStore.getState().schedule.find((s) => s.slot === 'morning').takenAt;

    for (let i = 0; i < 10; i++) {
      const preset = i % 2 === 0 ? MOCK_ANALYSIS_PRESET_1 : MOCK_ANALYSIS_PRESET_2;
      useMedStore.getState().importPrescription(preset);
      const curSlot = useMedStore.getState().schedule.find((s) => s.slot === 'morning');
      assert.equal(curSlot.isTaken, true, `Loop ${i}: morning dose must remain taken`);
      assert.equal(curSlot.takenAt, initialTakenAt, `Loop ${i}: timestamp unchanged`);
    }

    // Verify cabinet deduplication
    const cabinet = useMedStore.getState().cabinet;
    const names = cabinet.map((m) => m.name.toLowerCase().trim());
    const uniqueNames = new Set(names);
    assert.equal(names.length, uniqueNames.size, 'Cabinet must not contain duplicate medicine names');
  });

  await test('2.5 Untoggled dose slot never accidentally marked taken by merge', async () => {
    await StoreTestHarness.resetAll();

    // All slots initially untoggled
    assert.ok(useMedStore.getState().schedule.every((s) => !s.isTaken));

    useMedStore.getState().importPrescription(MOCK_ANALYSIS_PRESET_1);
    useMedStore.getState().importPrescription(MOCK_ANALYSIS_PRESET_2);

    assert.ok(
      useMedStore.getState().schedule.every((s) => !s.isTaken),
      'No slot should become isTaken=true from merging alone'
    );
  });

  await test('2.6 Kill App / Process Crash simulation preserves Smart Merged schedule and taken doses', async () => {
    await StoreTestHarness.resetAll();

    useMedStore.getState().toggleDoseSlot('morning');
    useMedStore.getState().toggleDoseSlot('evening');
    useMedStore.getState().importPrescription(MOCK_ANALYSIS_PRESET_2);

    const mTime = useMedStore.getState().schedule.find((s) => s.slot === 'morning').takenAt;
    const eTime = useMedStore.getState().schedule.find((s) => s.slot === 'evening').takenAt;

    // Simulate Kill App
    const freshStore = await StoreTestHarness.killAndRestartApp();

    const restoredSchedule = freshStore.getState().schedule;
    const rMorning = restoredSchedule.find((s) => s.slot === 'morning');
    const rNoon = restoredSchedule.find((s) => s.slot === 'noon');
    const rEvening = restoredSchedule.find((s) => s.slot === 'evening');

    assert.equal(rMorning.isTaken, true, 'Restored morning must be taken');
    assert.equal(rMorning.takenAt, mTime, 'Restored morning timestamp preserved');
    assert.equal(rNoon.isTaken, false, 'Restored noon must be false');
    assert.equal(rEvening.isTaken, true, 'Restored evening must be taken');
    assert.equal(rEvening.takenAt, eTime, 'Restored evening timestamp preserved');

    // Check that Ciprofloxacin is present in morning slot
    const hasCiproMorning = rMorning.medicines.some((m) => m.name.toLowerCase().includes('ciprofloxacin'));
    assert.ok(hasCiproMorning, 'Ciprofloxacin must be restored in morning slot');
  });

  // =========================================================================
  // SUITE 3: ZERO-PILL COUNT & EXPIRED MEDICINES HANDLING IN TAB 3
  // =========================================================================
  console.log('\n📌 SUITE 3: ZERO-PILL COUNT & EXPIRED MEDICINE HANDLING IN TAB 3');

  await test('3.1 decrementPillCount clamps strictly at 0 (no negative pill counts)', async () => {
    assert.equal(decrementPillCount(10, 1), 9);
    assert.equal(decrementPillCount(1, 1), 0);
    assert.equal(decrementPillCount(0, 1), 0);
    assert.equal(decrementPillCount(0, 50), 0);
    assert.equal(decrementPillCount(2, 5), 0);
  });

  await test('3.2 updateMedicineCount store action clamps negative counts to 0', async () => {
    await StoreTestHarness.resetAll();
    const firstMed = useMedStore.getState().cabinet[0];
    assert.ok(firstMed, 'Cabinet must have at least one medicine');

    // Update with negative count
    useMedStore.getState().updateMedicineCount(firstMed.id, -25);
    const updatedMed = useMedStore.getState().cabinet.find((m) => m.id === firstMed.id);
    assert.equal(updatedMed.remainingCount, 0, 'Negative count must be clamped to 0');

    // Update with valid count
    useMedStore.getState().updateMedicineCount(firstMed.id, 45);
    const updatedMed2 = useMedStore.getState().cabinet.find((m) => m.id === firstMed.id);
    assert.equal(updatedMed2.remainingCount, 45, 'Positive count updated accurately');
  });

  await test('3.3 getStockStatus correctly categorizes 0, low (<=10), and normal counts', async () => {
    const zeroStock = getStockStatus(0);
    assert.equal(zeroStock.isOut, true);
    assert.equal(zeroStock.label, 'Hết thuốc - Cần mua thêm');
    assert.equal(zeroStock.variant, 'destructive');

    const lowStock1 = getStockStatus(1);
    assert.equal(lowStock1.isOut, false);
    assert.equal(lowStock1.label, 'Sắp hết (còn 1 viên)');
    assert.equal(lowStock1.variant, 'warning');

    const lowStock10 = getStockStatus(10);
    assert.equal(lowStock10.isOut, false);
    assert.equal(lowStock10.label, 'Sắp hết (còn 10 viên)');
    assert.equal(lowStock10.variant, 'warning');

    const normalStock11 = getStockStatus(11);
    assert.equal(normalStock11.isOut, false);
    assert.equal(normalStock11.label, 'Còn 11 viên');
    assert.equal(normalStock11.variant, 'default');
  });

  await test('3.4 checkExpiryStatus handles past, near-term, future, and slash date formats', async () => {
    const refDate = new Date('2026-11-11T00:00:00Z');

    // 1. Expired (past)
    const expiredISO = checkExpiryStatus('2026-11-01', refDate);
    assert.equal(expiredISO.isExpired, true);
    assert.equal(expiredISO.isExpiringSoon, false);
    assert.equal(expiredISO.badgeLabel, 'Đã hết hạn');
    assert.equal(expiredISO.badgeVariant, 'destructive');

    // 2. Expiring soon (within 30 days)
    const expiringSoonISO = checkExpiryStatus('2026-11-25', refDate);
    assert.equal(expiringSoonISO.isExpired, false);
    assert.equal(expiringSoonISO.isExpiringSoon, true);
    assert.equal(expiringSoonISO.badgeLabel, 'Sắp hết hạn');
    assert.equal(expiringSoonISO.badgeVariant, 'warning');

    // 3. Normal future (> 30 days)
    const normalFuture = checkExpiryStatus('2027-06-30', refDate);
    assert.equal(normalFuture.isExpired, false);
    assert.equal(normalFuture.isExpiringSoon, false);
    assert.equal(normalFuture.badgeLabel, 'HSD: 2027-06-30');
    assert.equal(normalFuture.badgeVariant, 'default');

    // 4. Vietnamese slash format DD/MM/YYYY
    const slashExpired = checkExpiryStatus('01/10/2026', refDate);
    assert.equal(slashExpired.isExpired, true, '01/10/2026 must be parsed as expired');

    // 5. Slash format MM/YYYY
    const slashMMYYYY = checkExpiryStatus('12/2026', refDate);
    assert.equal(slashMMYYYY.isExpired, false, '12/2026 is future');

    // 6. Invalid / gibberish date does not throw
    const invalidDate = checkExpiryStatus('NOT_A_DATE', refDate);
    assert.equal(invalidDate.isExpired, false);
    assert.equal(invalidDate.badgeLabel, 'NOT_A_DATE');
  });

  await test('3.5 Container styling and modal advisories for expired and expiring medicines', async () => {
    const expiredStatus = { isExpired: true, isExpiringSoon: false, daysRemaining: -5, badgeLabel: 'Đã hết hạn', badgeVariant: 'destructive' };
    const expiringStatus = { isExpired: false, isExpiringSoon: true, daysRemaining: 15, badgeLabel: 'Sắp hết hạn', badgeVariant: 'warning' };
    const normalStatus = { isExpired: false, isExpiringSoon: false, daysRemaining: 180, badgeLabel: 'HSD: 2027-05-01', badgeVariant: 'default' };

    assert.ok(getExpiryCardStyle(expiredStatus).includes('border-red-300'));
    assert.ok(getExpiryCardStyle(expiringStatus).includes('border-amber-300'));
    assert.ok(getExpiryCardStyle(normalStatus).includes('border-slate-200/60'));

    const expiredAdv = getExpiryModalWarning(expiredStatus);
    assert.ok(expiredAdv && expiredAdv.includes('quá hạn sử dụng'), 'Expired warning must be clinical advisory');

    const normalAdv = getExpiryModalWarning(normalStatus);
    assert.equal(normalAdv, null, 'Normal status must produce null advisory');
  });

  await test('3.6 formatCabinetBadgeText handles empty and populated cabinet lists gracefully', async () => {
    assert.equal(formatCabinetBadgeText([]), '0 loại thuốc');
    assert.equal(formatCabinetBadgeText(null), '0 loại thuốc');
    assert.equal(formatCabinetBadgeText(undefined), '0 loại thuốc');
    assert.equal(formatCabinetBadgeText(MOCK_CABINET), `${MOCK_CABINET.length} loại thuốc`);
  });

  await test('3.7 filterCabinetByCategory filters across all 6 categories accurately', async () => {
    // All
    const all = filterCabinetByCategory(MOCK_CABINET, 'Tất cả');
    assert.equal(all.length, MOCK_CABINET.length);

    // Categories
    const bp = filterCabinetByCategory(MOCK_CABINET, 'Huyết áp');
    assert.ok(bp.every((m) => m.category === 'Blood Pressure'));

    const stomach = filterCabinetByCategory(MOCK_CABINET, 'Dạ dày');
    assert.ok(stomach.every((m) => m.category === 'Stomach'));

    const diabetes = filterCabinetByCategory(MOCK_CABINET, 'Tiểu đường');
    assert.ok(diabetes.every((m) => m.category === 'Diabetes'));

    const pain = filterCabinetByCategory(MOCK_CABINET, 'Giảm đau');
    assert.ok(pain.every((m) => m.category === 'Pain Relief'));

    const abx = filterCabinetByCategory(MOCK_CABINET, 'Kháng sinh');
    assert.ok(abx.every((m) => m.category === 'Antibiotics'));

    // Unknown category returns empty array
    const unknown = filterCabinetByCategory(MOCK_CABINET, 'Ung thư');
    assert.equal(unknown.length, 0);
  });

  // =========================================================================
  // SUITE 4: DUAL-LAYER SAFETY ALERT ENGINE
  // =========================================================================
  console.log('\n📌 SUITE 4: DUAL-LAYER SAFETY ALERT ENGINE');

  await test('4.1 Preset 1 contains zero conflict warnings', async () => {
    const warnings = evaluatePrescriptionConflicts(MOCK_ANALYSIS_PRESET_1.medicines, MOCK_CABINET);
    assert.equal(warnings.length, 0, 'Preset 1 must have 0 warnings');
    const summary = categorizeWarnings(warnings);
    assert.equal(summary.hasWarnings, false);
    assert.equal(summary.internal.length, 0);
    assert.equal(summary.cabinet.length, 0);
  });

  await test('4.2 Preset 2 generates both Layer 1 and Layer 2 warnings', async () => {
    const warnings = evaluatePrescriptionConflicts(MOCK_ANALYSIS_PRESET_2.medicines, MOCK_CABINET);
    assert.ok(warnings.length >= 2, 'Preset 2 must have at least 2 warnings');

    const summary = categorizeWarnings(warnings);
    assert.equal(summary.hasWarnings, true);
    assert.ok(summary.internal.length >= 1, 'Must have Layer 1 internal warning');
    assert.ok(summary.cabinet.length >= 1, 'Must have Layer 2 cabinet warning');

    // Verify Layer 1 is Cipro + Gaviscon
    const layer1 = summary.internal[0];
    assert.equal(layer1.source, 'internal_prescription');
    assert.ok(layer1.medicineA.includes('Ciprofloxacin'));
    assert.ok(layer1.medicineB.includes('Gaviscon'));
    assert.equal(layer1.severity, 'high');

    // Verify Layer 2 is Gaviscon + Aspirin
    const layer2 = summary.cabinet[0];
    assert.equal(layer2.source, 'cabinet_conflict');
    assert.ok(layer2.medicineA.includes('Gaviscon'));
    assert.ok(layer2.medicineB.includes('Aspirin'));
    assert.equal(layer2.severity, 'moderate');
  });

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n======================================================================');
  console.log('📊 CHALLENGER 2 EMPIRICAL TEST RESULTS');
  console.log('======================================================================');
  console.log(`📋 Total Tests Executed: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);

  if (failedTests > 0) {
    console.log('\n🚨 EMPIRICAL CHALLENGE FAILED!');
    process.exit(1);
  } else {
    console.log('\n🏆 ALL ADVERSARIAL STRESS TESTS CONFIRMED CORRECT!');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal crash in challenger test suite:', err);
  process.exit(1);
});
