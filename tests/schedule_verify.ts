/**
 * MedLens AI Milestone 3 — Schedule, Adherence & Medicine Modal Verification Suite
 * Standalone executable via node --experimental-strip-types --loader ./tests/loader.mjs
 */

function assert(condition: any, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

assert.equal = function (actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${expected}, got ${actual}`);
  }
};

assert.ok = function (value: any, message?: string) {
  if (!value) {
    throw new Error(message || 'Assertion failed');
  }
};

assert.includes = function (haystack: string, needle: string, message?: string) {
  if (!haystack || !haystack.includes(needle)) {
    throw new Error(`${message || 'Assertion failed'}: expected "${haystack}" to include "${needle}"`);
  }
};

// Headless polyfills for Node.js environment
const inMemoryStorage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => inMemoryStorage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    inMemoryStorage.set(key, String(value));
  },
  removeItem: (key: string) => {
    inMemoryStorage.delete(key);
  },
  clear: () => {
    inMemoryStorage.clear();
  },
  key: (index: number) => Array.from(inMemoryStorage.keys())[index] ?? null,
  get length() {
    return inMemoryStorage.size;
  },
};

(globalThis as any).window = {
  localStorage: mockLocalStorage,
};
(globalThis as any).localStorage = mockLocalStorage;

declare const require: any;
const fs = require('fs');
const path = require('path');

// Pure Adherence calculation domain model matching Tab 1 specs
function calculateAdherence(schedule: Array<{ isTaken: boolean }>) {
  const total = schedule.length;
  const completed = schedule.filter((s) => s.isTaken).length;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  const badgeLabel = percentage === 100 ? 'Tuyệt vời' : 'Cần uống thêm';
  const badgeVariant = percentage === 100 ? 'success' : 'primary';
  const label = `Đã uống ${completed}/${total} cữ thuốc hôm nay`;

  return { total, completed, percentage, badgeLabel, badgeVariant, label };
}

async function runScheduleVerification() {
  console.log('======================================================================');
  console.log('🧪 MEDLENS AI — SCHEDULE, ADHERENCE & MODAL VERIFICATION SUITE');
  console.log('======================================================================\n');

  // Dynamic imports after localStorage polyfill
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  const { useMedStore } = await import('@/store/useMedStore');
  const {
    MED_AMLODIPINE,
    MED_ATORVASTATIN,
    MED_METFORMIN,
    MED_OMEPRAZOLE,
    MOCK_SCHEDULE,
  } = await import('@/mocks/mockData');

  await AsyncStorage.clear();
  useMedStore.getState().resetToDemo();

  // -------------------------------------------------------------------------
  // SUITE 1: Adherence Calculations & Progress Invariants
  // -------------------------------------------------------------------------
  console.log('👉 [SUITE 1] Verifying Adherence Progress Calculation Logic...');

  // 1.1 Initial adherence (0/3 taken)
  const initialAdh = calculateAdherence(useMedStore.getState().schedule);
  assert.equal(initialAdh.total, 3, 'Initial total must be 3 slots');
  assert.equal(initialAdh.completed, 0, 'Initial completed must be 0');
  assert.equal(initialAdh.percentage, 0, 'Initial percentage must be 0%');
  assert.equal(initialAdh.badgeLabel, 'Cần uống thêm');
  assert.equal(initialAdh.badgeVariant, 'primary');
  assert.equal(initialAdh.label, 'Đã uống 0/3 cữ thuốc hôm nay');

  // 1.2 1 dose taken (1/3 -> 33%)
  useMedStore.getState().toggleDoseSlot('morning');
  const adh1 = calculateAdherence(useMedStore.getState().schedule);
  assert.equal(adh1.completed, 1);
  assert.equal(adh1.percentage, 33);
  assert.equal(adh1.badgeLabel, 'Cần uống thêm');
  assert.equal(adh1.label, 'Đã uống 1/3 cữ thuốc hôm nay');

  // 1.3 2 doses taken (2/3 -> 67%)
  useMedStore.getState().toggleDoseSlot('noon');
  const adh2 = calculateAdherence(useMedStore.getState().schedule);
  assert.equal(adh2.completed, 2);
  assert.equal(adh2.percentage, 67);
  assert.equal(adh2.badgeLabel, 'Cần uống thêm');
  assert.equal(adh2.label, 'Đã uống 2/3 cữ thuốc hôm nay');

  // 1.4 3 doses taken (3/3 -> 100% -> 'Tuyệt vời')
  useMedStore.getState().toggleDoseSlot('evening');
  const adh3 = calculateAdherence(useMedStore.getState().schedule);
  assert.equal(adh3.completed, 3);
  assert.equal(adh3.percentage, 100);
  assert.equal(adh3.badgeLabel, 'Tuyệt vời');
  assert.equal(adh3.badgeVariant, 'success');
  assert.equal(adh3.label, 'Đã uống 3/3 cữ thuốc hôm nay');

  // 1.5 Untick rollback (3/3 -> 2/3 -> badge restored to 'Cần uống thêm')
  useMedStore.getState().toggleDoseSlot('evening');
  const adhRollback = calculateAdherence(useMedStore.getState().schedule);
  assert.equal(adhRollback.completed, 2);
  assert.equal(adhRollback.percentage, 67);
  assert.equal(adhRollback.badgeLabel, 'Cần uống thêm');
  assert.equal(adhRollback.badgeVariant, 'primary');

  // 1.6 Boundary: Empty schedule handling (zero divide check)
  const emptyAdh = calculateAdherence([]);
  assert.equal(emptyAdh.percentage, 0);
  assert.equal(isNaN(emptyAdh.percentage), false);
  console.log('   ✅ Adherence calculations verified across all percentage states.\n');

  // -------------------------------------------------------------------------
  // SUITE 2: Dose Slots Structure & 1-Touch Toggle State
  // -------------------------------------------------------------------------
  console.log('👉 [SUITE 2] Verifying Dose Slots & 1-Touch Toggle Invariants...');
  useMedStore.getState().resetToDemo();

  const schedule = useMedStore.getState().schedule;
  assert.equal(schedule.length, 3);
  assert.equal(schedule[0].slot, 'morning');
  assert.equal(schedule[0].timeLabel, '08:00');
  assert.equal(schedule[1].slot, 'noon');
  assert.equal(schedule[1].timeLabel, '12:30');
  assert.equal(schedule[2].slot, 'evening');
  assert.equal(schedule[2].timeLabel, '20:00');

  // Toggle on
  useMedStore.getState().toggleDoseSlot('morning');
  const morningTaken = useMedStore.getState().schedule.find((s) => s.slot === 'morning')!;
  assert.equal(morningTaken.isTaken, true);
  assert.ok(morningTaken.takenAt);
  assert.ok(!isNaN(Date.parse(morningTaken.takenAt!)));

  // Independence: Noon and evening must remain untaken
  const noonUntaken = useMedStore.getState().schedule.find((s) => s.slot === 'noon')!;
  const eveningUntaken = useMedStore.getState().schedule.find((s) => s.slot === 'evening')!;
  assert.equal(noonUntaken.isTaken, false);
  assert.equal(eveningUntaken.isTaken, false);

  // Toggle off
  useMedStore.getState().toggleDoseSlot('morning');
  const morningUntaken = useMedStore.getState().schedule.find((s) => s.slot === 'morning')!;
  assert.equal(morningUntaken.isTaken, false);
  assert.equal(morningUntaken.takenAt, undefined);
  console.log('   ✅ Dose slots chronological order and 1-touch toggling verified.\n');

  // -------------------------------------------------------------------------
  // SUITE 3: Medicine Detail Modal State & Medical Metadata
  // -------------------------------------------------------------------------
  console.log('👉 [SUITE 3] Verifying Medicine Detail Modal State Transitions...');

  // 3.1 Initial modal state is null
  assert.equal(useMedStore.getState().selectedMedicine, null);

  // 3.2 Select Amlodipine and inspect all medical fields
  useMedStore.getState().setSelectedMedicine(MED_AMLODIPINE);
  const selectedAmlodipine = useMedStore.getState().selectedMedicine;
  assert.ok(selectedAmlodipine);
  assert.equal(selectedAmlodipine?.id, 'med-amlodipine-5');
  assert.equal(selectedAmlodipine?.name, 'Amlodipine 5mg');
  assert.equal(selectedAmlodipine?.activeIngredient, 'Amlodipine besylate');
  assert.equal(selectedAmlodipine?.dosage, '1 viên');
  assert.equal(selectedAmlodipine?.mealTiming, 'after_meal');
  assert.equal(selectedAmlodipine?.purpose, 'Hạ huyết áp và kiểm soát đau thắt ngực');
  assert.equal(selectedAmlodipine?.category, 'Blood Pressure');
  assert.includes(selectedAmlodipine?.instructions || '', 'sáng');

  // 3.3 Switch to Atorvastatin & inspect safety precautions
  useMedStore.getState().setSelectedMedicine(MED_ATORVASTATIN);
  const selectedAtorvastatin = useMedStore.getState().selectedMedicine;
  assert.ok(selectedAtorvastatin);
  assert.includes(selectedAtorvastatin?.instructions || '', 'bưởi chùm');

  // 3.4 Switch to Omeprazole & verify before_meal
  useMedStore.getState().setSelectedMedicine(MED_OMEPRAZOLE);
  const selectedOmeprazole = useMedStore.getState().selectedMedicine;
  assert.equal(selectedOmeprazole?.mealTiming, 'before_meal');

  // 3.5 Switch to Metformin & verify with_meal
  useMedStore.getState().setSelectedMedicine(MED_METFORMIN);
  const selectedMetformin = useMedStore.getState().selectedMedicine;
  assert.equal(selectedMetformin?.mealTiming, 'with_meal');

  // 3.6 Dismiss modal smoothly
  useMedStore.getState().setSelectedMedicine(null);
  assert.equal(useMedStore.getState().selectedMedicine, null);
  console.log('   ✅ Medicine modal opening, field extraction, and dismissal verified.\n');

  // -------------------------------------------------------------------------
  // SUITE 4: UI HIG & AST Zero Forbidden Tags Compliance
  // -------------------------------------------------------------------------
  console.log('👉 [SUITE 4] Verifying Zero Raw HTML Tags and HIG Compliance...');
  const filesToCheck = [
    'components/features/MedicineDetailModal.tsx',
    'app/(tabs)/index.tsx',
    'app/(tabs)/scan.tsx',
    'app/(tabs)/cabinet.tsx',
    'app/(tabs)/_layout.tsx',
  ];

  const forbiddenTags = [
    '<div',
    '<span',
    '<p',
    '<button',
    '<img',
    '<a',
    '<h1',
    '<h2',
    '<table',
    '<ul',
    '<li',
    '<input',
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.resolve(process.cwd(), relPath);
    assert.ok(fs.existsSync(fullPath), `Target file must exist: ${relPath}`);
    const content = fs.readFileSync(fullPath, 'utf8');

    for (const tag of forbiddenTags) {
      assert.equal(
        content.includes(tag),
        false,
        `${relPath} must NOT contain raw HTML tag: ${tag}`
      );
    }
  }
  console.log('   ✅ All Milestone 3 UI components verified: 0 raw HTML tags.\n');

  console.log('======================================================================');
  console.log('🎉 ALL SCHEDULE, ADHERENCE & MODAL VERIFICATION TESTS PASSED!');
  console.log('======================================================================');
  process.exit(0);
}

runScheduleVerification().catch((err) => {
  console.error('\n❌ Schedule verification failed:', err);
  process.exit(1);
});
