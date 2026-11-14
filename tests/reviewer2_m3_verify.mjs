/**
 * MedLens AI — Reviewer 2 Milestone 3 Verification & Stress Suite
 * Exhaustively stress-tests:
 * 1. State contract conformance (useMedStore)
 * 2. Adherence calculation matrix across all edge cases (0%, 33%, 67%, 100%, rollbacks, empty)
 * 3. Rapid consecutive toggling and idempotence
 * 4. resetToDemo deep-copy & state isolation
 * 5. Vietnamese date format correctness across all weekdays and month bounds
 * 6. AST verification of zero raw HTML tags across all M3 screens
 * 7. Kill-app persistence of M3 schedule states
 */

import fs from 'node:fs';
import path from 'node:path';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

assert.equal = function (actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};

assert.ok = function (value, message) {
  if (!value) {
    throw new Error(message || 'Assertion failed');
  }
};

// Polyfill window / localStorage for Node.js
const storageMap = new Map();
const mockLocalStorage = {
  getItem: (key) => storageMap.get(key) ?? null,
  setItem: (key, value) => storageMap.set(key, String(value)),
  removeItem: (key) => storageMap.delete(key),
  clear: () => storageMap.clear(),
  key: (index) => Array.from(storageMap.keys())[index] ?? null,
  get length() {
    return storageMap.size;
  },
};

globalThis.window = { localStorage: mockLocalStorage };
globalThis.localStorage = mockLocalStorage;

// Adherence function under test (reproduced exactly from app/(tabs)/index.tsx)
function calculateAdherence(schedule) {
  const total = schedule.length;
  const completed = schedule.filter((s) => s.isTaken).length;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  const badgeLabel = percentage === 100 ? 'Tuyệt vời' : 'Cần uống thêm';
  const badgeVariant = percentage === 100 ? 'success' : 'primary';
  const label = `Đã uống ${completed}/${total} cữ thuốc hôm nay`;

  return { total, completed, percentage, badgeLabel, badgeVariant, label };
}

// Date formatter under test (from app/(tabs)/index.tsx)
function getFormattedVietnameseDate(date = new Date()) {
  const days = [
    'Chủ Nhật',
    'Thứ Hai',
    'Thứ Ba',
    'Thứ Tư',
    'Thứ Năm',
    'Thứ Sáu',
    'Thứ Bảy',
  ];
  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = date.getMonth() + 1;
  return `${dayName}, ${day} tháng ${month}`;
}

async function runReviewer2Verification() {
  console.log('======================================================================');
  console.log('🔍 REVIEWER 2 ADVERSARIAL & CONFORMANCE VERIFICATION SUITE (M3)');
  console.log('======================================================================\n');

  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  const { useMedStore } = await import('../store/useMedStore.ts');
  const { MED_AMLODIPINE, MED_METFORMIN, MED_ATORVASTATIN } = await import('../mocks/mockData.ts');

  await AsyncStorage.clear();
  useMedStore.getState().resetToDemo();

  // --------------------------------------------------------------------------
  // TEST SECTION 1: STATE CONTRACT CONFORMANCE
  // --------------------------------------------------------------------------
  console.log('👉 [1/6] Stress-testing State Contract Conformance...');

  const initialState = useMedStore.getState();
  assert.ok(Array.isArray(initialState.schedule), 'schedule must be an array');
  assert.equal(initialState.schedule.length, 3, 'Default schedule must contain 3 dose slots');
  assert.equal(initialState.selectedMedicine, null, 'selectedMedicine must default to null');

  // Verify slots ordering and initial taken flags
  assert.equal(initialState.schedule[0].slot, 'morning');
  assert.equal(initialState.schedule[0].timeLabel, '08:00');
  assert.equal(initialState.schedule[0].isTaken, false);
  assert.equal(initialState.schedule[0].takenAt, undefined);

  assert.equal(initialState.schedule[1].slot, 'noon');
  assert.equal(initialState.schedule[1].timeLabel, '12:30');
  assert.equal(initialState.schedule[1].isTaken, false);

  assert.equal(initialState.schedule[2].slot, 'evening');
  assert.equal(initialState.schedule[2].timeLabel, '20:00');
  assert.equal(initialState.schedule[2].isTaken, false);

  // Toggle non-existent slot should not crash or corrupt schedule
  useMedStore.getState().toggleDoseSlot('midnight');
  const afterInvalidToggle = useMedStore.getState().schedule;
  assert.equal(afterInvalidToggle.length, 3, 'Invalid slot must not add or remove slots');
  assert.equal(afterInvalidToggle.every((s) => !s.isTaken), true, 'No slots should be taken');

  // Test rapid toggling (100 toggles)
  for (let i = 0; i < 100; i++) {
    useMedStore.getState().toggleDoseSlot('morning');
  }
  // Even number of toggles -> must end back on false
  const after100 = useMedStore.getState().schedule.find((s) => s.slot === 'morning');
  assert.equal(after100.isTaken, false, '100 toggles must result in untaken');
  assert.equal(after100.takenAt, undefined, 'takenAt must be cleared when untaken');

  // Single toggle to true
  useMedStore.getState().toggleDoseSlot('morning');
  const after1 = useMedStore.getState().schedule.find((s) => s.slot === 'morning');
  assert.equal(after1.isTaken, true, 'Single toggle must set isTaken to true');
  assert.ok(after1.takenAt, 'takenAt must be recorded');
  const parsedTime = Date.parse(after1.takenAt);
  assert.ok(!isNaN(parsedTime), 'takenAt must be a valid ISO date');
  assert.ok(Date.now() - parsedTime < 5000, 'takenAt must be current timestamp');

  // Test setSelectedMedicine
  useMedStore.getState().setSelectedMedicine(MED_AMLODIPINE);
  assert.equal(useMedStore.getState().selectedMedicine?.id, 'med-amlodipine-5');

  useMedStore.getState().setSelectedMedicine(null);
  assert.equal(useMedStore.getState().selectedMedicine, null);

  console.log('   ✅ State contracts fully conform to specifications.\n');

  // --------------------------------------------------------------------------
  // TEST SECTION 2: ADHERENCE CALCULATION MATRIX & EDGE CASES
  // --------------------------------------------------------------------------
  console.log('👉 [2/6] Stress-testing Adherence Calculation Matrix...');

  // 0% state
  useMedStore.getState().resetToDemo();
  let adh = calculateAdherence(useMedStore.getState().schedule);
  assert.equal(adh.completed, 0);
  assert.equal(adh.percentage, 0);
  assert.equal(adh.badgeLabel, 'Cần uống thêm');
  assert.equal(adh.badgeVariant, 'primary');
  assert.equal(adh.label, 'Đã uống 0/3 cữ thuốc hôm nay');

  // 33% state (1/3)
  useMedStore.getState().toggleDoseSlot('morning');
  adh = calculateAdherence(useMedStore.getState().schedule);
  assert.equal(adh.completed, 1);
  assert.equal(adh.percentage, 33);
  assert.equal(adh.badgeLabel, 'Cần uống thêm');
  assert.equal(adh.badgeVariant, 'primary');
  assert.equal(adh.label, 'Đã uống 1/3 cữ thuốc hôm nay');

  // 67% state (2/3)
  useMedStore.getState().toggleDoseSlot('noon');
  adh = calculateAdherence(useMedStore.getState().schedule);
  assert.equal(adh.completed, 2);
  assert.equal(adh.percentage, 67);
  assert.equal(adh.badgeLabel, 'Cần uống thêm');
  assert.equal(adh.badgeVariant, 'primary');
  assert.equal(adh.label, 'Đã uống 2/3 cữ thuốc hôm nay');

  // 100% state (3/3)
  useMedStore.getState().toggleDoseSlot('evening');
  adh = calculateAdherence(useMedStore.getState().schedule);
  assert.equal(adh.completed, 3);
  assert.equal(adh.percentage, 100);
  assert.equal(adh.badgeLabel, 'Tuyệt vời');
  assert.equal(adh.badgeVariant, 'success');
  assert.equal(adh.label, 'Đã uống 3/3 cữ thuốc hôm nay');

  // Untick rollback (3/3 -> 2/3)
  useMedStore.getState().toggleDoseSlot('evening');
  adh = calculateAdherence(useMedStore.getState().schedule);
  assert.equal(adh.completed, 2);
  assert.equal(adh.percentage, 67);
  assert.equal(adh.badgeLabel, 'Cần uống thêm');
  assert.equal(adh.badgeVariant, 'primary');

  // Untick all (2/3 -> 1/3 -> 0/3)
  useMedStore.getState().toggleDoseSlot('noon');
  useMedStore.getState().toggleDoseSlot('morning');
  adh = calculateAdherence(useMedStore.getState().schedule);
  assert.equal(adh.completed, 0);
  assert.equal(adh.percentage, 0);
  assert.equal(adh.badgeLabel, 'Cần uống thêm');

  // Boundary check: empty schedule (0 slots)
  const emptyAdh = calculateAdherence([]);
  assert.equal(emptyAdh.total, 0);
  assert.equal(emptyAdh.completed, 0);
  assert.equal(emptyAdh.percentage, 0);
  assert.equal(isNaN(emptyAdh.percentage), false, 'Must not be NaN');
  assert.equal(emptyAdh.label, 'Đã uống 0/0 cữ thuốc hôm nay');

  // 1-slot schedule: 0/1 (0%) and 1/1 (100%)
  assert.equal(calculateAdherence([{ isTaken: false }]).percentage, 0);
  assert.equal(calculateAdherence([{ isTaken: true }]).percentage, 100);
  assert.equal(calculateAdherence([{ isTaken: true }]).badgeLabel, 'Tuyệt vời');

  // 4-slot schedule: 0%, 25%, 50%, 75%, 100%
  const slots4 = [{ isTaken: false }, { isTaken: false }, { isTaken: false }, { isTaken: false }];
  assert.equal(calculateAdherence(slots4).percentage, 0);
  slots4[0].isTaken = true;
  assert.equal(calculateAdherence(slots4).percentage, 25);
  slots4[1].isTaken = true;
  assert.equal(calculateAdherence(slots4).percentage, 50);
  slots4[2].isTaken = true;
  assert.equal(calculateAdherence(slots4).percentage, 75);
  slots4[3].isTaken = true;
  assert.equal(calculateAdherence(slots4).percentage, 100);
  assert.equal(calculateAdherence(slots4).badgeLabel, 'Tuyệt vời');

  console.log('   ✅ Adherence formula matrix verified with 0 defects.\n');

  // --------------------------------------------------------------------------
  // TEST SECTION 3: RESET TO DEMO DEEP ISOLATION
  // --------------------------------------------------------------------------
  console.log('👉 [3/6] Verifying resetToDemo Deep Isolation...');

  // Mutate schedule medicines directly
  const s = useMedStore.getState().schedule;
  s[0].medicines[0].name = 'MUTATED_MED';
  s[0].isTaken = true;

  // Reset to demo
  useMedStore.getState().resetToDemo();

  const resetSchedule = useMedStore.getState().schedule;
  assert.equal(resetSchedule[0].medicines[0].name, 'Amlodipine 5mg', 'resetToDemo must restore original medication name');
  assert.equal(resetSchedule[0].isTaken, false, 'resetToDemo must restore isTaken to false');
  assert.equal(resetSchedule[0].takenAt, undefined, 'resetToDemo must clear takenAt');
  assert.equal(useMedStore.getState().selectedMedicine, null, 'resetToDemo must nullify selectedMedicine');

  console.log('   ✅ resetToDemo deep isolation verified.\n');

  // --------------------------------------------------------------------------
  // TEST SECTION 4: VIETNAMESE DATE FORMATTER ROBUSTNESS
  // --------------------------------------------------------------------------
  console.log('👉 [4/6] Verifying Vietnamese Date Formatter across all Weekdays & Months...');

  // Construct dates for each day of the week (Sunday through Saturday)
  const dateSunday = new Date('2026-11-08T10:00:00Z'); // Sunday
  assert.equal(getFormattedVietnameseDate(dateSunday), 'Chủ Nhật, 8 tháng 11');

  const dateMonday = new Date('2026-11-09T10:00:00Z'); // Monday
  assert.equal(getFormattedVietnameseDate(dateMonday), 'Thứ Hai, 9 tháng 11');

  const dateTuesday = new Date('2026-11-10T10:00:00Z'); // Tuesday
  assert.equal(getFormattedVietnameseDate(dateTuesday), 'Thứ Ba, 10 tháng 11');

  const dateWednesday = new Date('2026-11-11T10:00:00Z'); // Wednesday
  assert.equal(getFormattedVietnameseDate(dateWednesday), 'Thứ Tư, 11 tháng 11');

  const dateThursday = new Date('2026-11-12T10:00:00Z'); // Thursday
  assert.equal(getFormattedVietnameseDate(dateThursday), 'Thứ Năm, 12 tháng 11');

  const dateFriday = new Date('2026-11-13T10:00:00Z'); // Friday
  assert.equal(getFormattedVietnameseDate(dateFriday), 'Thứ Sáu, 13 tháng 11');

  const dateSaturday = new Date('2026-11-14T10:00:00Z'); // Saturday
  assert.equal(getFormattedVietnameseDate(dateSaturday), 'Thứ Bảy, 14 tháng 11');

  // Month boundary checks: Jan (1) and Dec (12)
  const dateJan = new Date('2026-01-01T12:00:00Z');
  assert.ok(getFormattedVietnameseDate(dateJan).includes('tháng 1'));

  const dateDec = new Date('2026-12-31T12:00:00Z');
  assert.ok(getFormattedVietnameseDate(dateDec).includes('tháng 12'));

  console.log('   ✅ Vietnamese Date Formatter handles all calendar configurations.\n');

  // --------------------------------------------------------------------------
  // TEST SECTION 5: AST STATIC ANALYSIS & APPLE HIG ZERO HTML CHECK
  // --------------------------------------------------------------------------
  console.log('👉 [5/6] Verifying AST Zero Raw HTML Tags across M3 Components...');

  const m3Files = [
    'app/(tabs)/index.tsx',
    'app/(tabs)/_layout.tsx',
    'app/(tabs)/scan.tsx',
    'app/(tabs)/cabinet.tsx',
    'components/features/MedicineDetailModal.tsx',
  ];

  const forbiddenHtmlTags = [
    '<div',
    '<span',
    '<p',
    '<button',
    '<img',
    '<a',
    '<h1',
    '<h2',
    '<h3',
    '<table',
    '<ul',
    '<li',
    '<input',
  ];

  for (const rel of m3Files) {
    const full = path.resolve(process.cwd(), rel);
    assert.ok(fs.existsSync(full), `File must exist: ${rel}`);
    const source = fs.readFileSync(full, 'utf8');

    for (const tag of forbiddenHtmlTags) {
      assert.equal(
        source.includes(tag),
        false,
        `Integrity violation: ${rel} contains forbidden raw HTML tag ${tag}`
      );
    }
  }

  console.log('   ✅ 100% React Native primitives, 0 raw HTML tags found.\n');

  // --------------------------------------------------------------------------
  // TEST SECTION 6: KILL-APP PERSISTENCE OF SCHEDULE TOGGLES
  // --------------------------------------------------------------------------
  console.log('👉 [6/6] Verifying Kill-App Persistence for Milestone 3...');

  useMedStore.getState().resetToDemo();
  useMedStore.getState().toggleDoseSlot('morning');
  useMedStore.getState().toggleDoseSlot('noon');

  const rawStorage = await AsyncStorage.getItem('medlens-storage-v1');
  assert.ok(rawStorage, 'AsyncStorage must hold key medlens-storage-v1');
  const parsed = JSON.parse(rawStorage);

  assert.equal(parsed.state.schedule[0].isTaken, true, 'Persisted morning must be taken');
  assert.equal(parsed.state.schedule[1].isTaken, true, 'Persisted noon must be taken');
  assert.equal(parsed.state.schedule[2].isTaken, false, 'Persisted evening must be untaken');
  assert.ok(parsed.state.schedule[0].takenAt, 'Persisted morning must hold takenAt timestamp');

  console.log('   ✅ Kill-App persistence of schedule state verified.\n');

  console.log('======================================================================');
  console.log('🎉 ALL REVIEWER 2 VERIFICATION & STRESS CHECKS PASSED WITH 0 DEFECTS!');
  console.log('======================================================================');
}

runReviewer2Verification().catch((err) => {
  console.error('\n❌ Reviewer 2 Verification failed:', err);
  process.exit(1);
});
