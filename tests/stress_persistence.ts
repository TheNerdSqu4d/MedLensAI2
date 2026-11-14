/**
 * MedLens AI - Milestone 1 Stress & Adversarial Persistence Test Harness
 * 
 * Challenger 2: Empirical stress testing for:
 * 1. 100% Kill App hydration fidelity across process/module lifecycle
 * 2. Large payload persistence (>2KB SecureStore ceiling)
 * 3. Malformed/corrupted AsyncStorage recovery & resetToDemo() resilience
 * 4. Smart Merge deduplication, whitespace/casing normalization & slot isolation
 * 5. Concurrent mutation consistency under rapid succession
 */

// Standalone type-safe assertion library (zero @types/node dependency)
function assert(condition: any, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

assert.equal = function (actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};

assert.notEqual = function (actual: any, expected: any, message?: string) {
  if (actual === expected) {
    throw new Error(`${message || 'Assertion failed'}: expected value NOT to equal ${JSON.stringify(expected)}`);
  }
};

assert.ok = function (value: any, message?: string) {
  if (!value) {
    throw new Error(message || 'Assertion failed');
  }
};

assert.deepEqual = function (actual: any, expected: any, message?: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`${message || 'Deep equality failed'}:\nActual:   ${actualStr}\nExpected: ${expectedStr}`);
  }
};

// Polyfill window.localStorage for Node environment before loading AsyncStorage
const inMemoryDisk = new Map<string, string>();

const mockLocalStorage = {
  getItem: (key: string): string | null => inMemoryDisk.get(key) ?? null,
  setItem: (key: string, value: string): void => {
    inMemoryDisk.set(key, String(value));
  },
  removeItem: (key: string): void => {
    inMemoryDisk.delete(key);
  },
  clear: (): void => {
    inMemoryDisk.clear();
  },
  key: (index: number): string | null => Array.from(inMemoryDisk.keys())[index] ?? null,
  get length(): number {
    return inMemoryDisk.size;
  },
};

(globalThis as any).window = {
  localStorage: mockLocalStorage,
};
(globalThis as any).localStorage = mockLocalStorage;

const STORAGE_KEY = 'medlens-storage-v1';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runAdversarialStressTests() {
  console.log('======================================================================');
  console.log('💥 MEDLENS AI - EMPIRICAL ADVERSARIAL STRESS & PERSISTENCE TEST HARNESS');
  console.log('   Challenger 2 (Milestone 1: Environment & State Foundation)');
  console.log('======================================================================\n');

  // Dynamic import after polyfill setup
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  const { useMedStore } = await import('@/store/useMedStore');
  const {
    MOCK_SCHEDULE,
    MOCK_CABINET,
    MOCK_ANALYSIS_PRESET_1,
    MOCK_ANALYSIS_PRESET_2,
    MED_AMLODIPINE,
  } = await import('@/mocks/mockData');
  const { create } = await import('zustand');
  const { persist, createJSONStorage } = await import('zustand/middleware');
  type MedState = import('@/types/medlens').MedState;
  type Medicine = import('@/types/medlens').Medicine;
  type TimeSlot = import('@/types/medlens').TimeSlot;
  type PrescriptionAnalysisResult = import('@/types/medlens').PrescriptionAnalysisResult;

  let totalTests = 0;
  let passedTests = 0;

  function recordPass(testName: string) {
    totalTests++;
    passedTests++;
    console.log(`   ✅ PASS: ${testName}`);
  }

  function recordFail(testName: string, error: any) {
    totalTests++;
    console.error(`   ❌ FAIL: ${testName}`);
    console.error(`      Reason: ${error?.message || error}`);
    throw error;
  }

  // -------------------------------------------------------------------------
  // SUITE 1: Kill App Simulation & Hydration Fidelity
  // -------------------------------------------------------------------------
  console.log('👉 [SUITE 1] Kill App Simulation & 100% Hydration Fidelity');
  try {
    // 1.1 Clear storage and reset
    await AsyncStorage.clear();
    useMedStore.getState().resetToDemo();

    // 1.2 Mutate store state across multiple slots and actions
    const store = useMedStore.getState();
    store.toggleDoseSlot('morning');
    const morningTakenAt = useMedStore.getState().schedule.find((s) => s.slot === 'morning')?.takenAt;
    assert.ok(morningTakenAt, 'Morning takenAt must be recorded');

    store.toggleDoseSlot('evening');
    const eveningTakenAt = useMedStore.getState().schedule.find((s) => s.slot === 'evening')?.takenAt;
    assert.ok(eveningTakenAt, 'Evening takenAt must be recorded');

    // Slot 'noon' intentionally remains un-taken
    assert.equal(
      useMedStore.getState().schedule.find((s) => s.slot === 'noon')?.isTaken,
      false,
      'Noon slot must be untaken'
    );

    // 1.3 Import Preset 2 (adds Ciprofloxacin and Gaviscon)
    store.importPrescription(MOCK_ANALYSIS_PRESET_2);

    // 1.4 Select a medicine
    store.setSelectedMedicine(MED_AMLODIPINE);

    // Snapshot pre-kill state
    const preKillSchedule = JSON.parse(JSON.stringify(useMedStore.getState().schedule));
    const preKillCabinet = JSON.parse(JSON.stringify(useMedStore.getState().cabinet));
    const preKillSelected = JSON.parse(JSON.stringify(useMedStore.getState().selectedMedicine));

    // Wait for AsyncStorage persistence write
    await sleep(150);

    // Verify raw data was written to AsyncStorage under STORAGE_KEY
    const rawPersisted = await AsyncStorage.getItem(STORAGE_KEY);
    assert.ok(rawPersisted, `AsyncStorage must contain key "${STORAGE_KEY}"`);
    const parsedRaw = JSON.parse(rawPersisted!);
    assert.ok(parsedRaw.state, 'Persisted payload must contain "state" property');

    // 1.5 SIMULATE COMPLETE APP TERMINATION ("Kill App")
    // In a new process / fresh store initialization, a fresh Zustand store instance
    // is created with the exact same persist name and storage.
    // It must hydrate entirely from AsyncStorage without touching existing store memory.
    const freshRehydratedStore = create<MedState>()(
      persist(
        (set, get) => ({
          ...useMedStore.getState(),
          schedule: MOCK_SCHEDULE,
          cabinet: MOCK_CABINET,
          selectedMedicine: null,
          toggleDoseSlot: useMedStore.getState().toggleDoseSlot,
          importPrescription: useMedStore.getState().importPrescription,
          resetToDemo: useMedStore.getState().resetToDemo,
          setSelectedMedicine: useMedStore.getState().setSelectedMedicine,
        }),
        {
          name: STORAGE_KEY,
          storage: createJSONStorage(() => AsyncStorage),
        }
      )
    );

    // Await hydration completion on the fresh store
    await freshRehydratedStore.persist.rehydrate();
    await sleep(100);

    const postKillState = freshRehydratedStore.getState();

    // Verify 100% fidelity on Schedule
    assert.equal(postKillState.schedule.length, 3, 'Post-kill schedule must contain exactly 3 slots');
    
    // Morning slot verification
    const rehydratedMorning = postKillState.schedule.find((s) => s.slot === 'morning');
    assert.ok(rehydratedMorning, 'Rehydrated morning slot exists');
    assert.equal(rehydratedMorning?.isTaken, true, 'Morning slot must remain isTaken: true');
    assert.equal(rehydratedMorning?.takenAt, morningTakenAt, 'Morning slot takenAt timestamp must match exactly');
    assert.ok(
      rehydratedMorning?.medicines.some((m) => m.name.includes('Ciprofloxacin')),
      'Morning slot must retain imported Ciprofloxacin'
    );
    assert.ok(
      rehydratedMorning?.medicines.some((m) => m.name.includes('Gaviscon')),
      'Morning slot must retain imported Gaviscon'
    );

    // Noon slot verification
    const rehydratedNoon = postKillState.schedule.find((s) => s.slot === 'noon');
    assert.ok(rehydratedNoon, 'Rehydrated noon slot exists');
    assert.equal(rehydratedNoon?.isTaken, false, 'Noon slot must remain isTaken: false');
    assert.equal(rehydratedNoon?.takenAt, undefined, 'Noon slot takenAt must remain undefined');

    // Evening slot verification
    const rehydratedEvening = postKillState.schedule.find((s) => s.slot === 'evening');
    assert.ok(rehydratedEvening, 'Rehydrated evening slot exists');
    assert.equal(rehydratedEvening?.isTaken, true, 'Evening slot must remain isTaken: true');
    assert.equal(rehydratedEvening?.takenAt, eveningTakenAt, 'Evening slot takenAt timestamp must match exactly');
    assert.ok(
      rehydratedEvening?.medicines.some((m) => m.name.includes('Ciprofloxacin')),
      'Evening slot must retain imported Ciprofloxacin'
    );

    // Cabinet verification
    assert.equal(postKillState.cabinet.length, preKillCabinet.length, 'Cabinet length must match pre-kill snapshot');
    assert.ok(
      postKillState.cabinet.some((m) => m.name.includes('Ciprofloxacin')),
      'Cabinet must retain imported Ciprofloxacin'
    );
    assert.ok(
      postKillState.cabinet.some((m) => m.name.includes('Gaviscon')),
      'Cabinet must retain imported Gaviscon'
    );
    assert.ok(
      postKillState.cabinet.some((m) => m.name.includes('Aspirin 81mg')),
      'Cabinet must retain baseline Aspirin 81mg'
    );

    // Deep equality comparison of whole schedule
    assert.deepEqual(postKillState.schedule, preKillSchedule, 'Complete schedule survived kill app with 100% fidelity');

    recordPass('Kill App complete termination & 100% hydration fidelity');
  } catch (err) {
    recordFail('Kill App hydration fidelity failed', err);
  }

  // -------------------------------------------------------------------------
  // SUITE 2: Large Payload Persistence (>2KB SecureStore Ceiling)
  // -------------------------------------------------------------------------
  console.log('\n👉 [SUITE 2] Large Payload Persistence (>2KB SecureStore Ceiling)');
  try {
    // Generate 60 realistic clinical medications across diverse categories
    const categories = ['Cardiology', 'Endocrinology', 'Gastroenterology', 'Antibiotics', 'Pain Management', 'Psychiatry'];
    const timeSlotChoices: TimeSlot[][] = [
      ['morning'],
      ['noon'],
      ['evening'],
      ['morning', 'evening'],
      ['morning', 'noon', 'evening'],
    ];

    const largeMedsList: (Medicine & { timeSlots: TimeSlot[] })[] = [];
    for (let i = 1; i <= 60; i++) {
      const cat = categories[i % categories.length];
      const slotChoice = timeSlotChoices[i % timeSlotChoices.length];
      largeMedsList.push({
        id: `stress-med-${i.toString().padStart(3, '0')}`,
        name: `Clinical Formulation Alpha-${i} XR ${i * 10}mg`,
        activeIngredient: `ActivePharmaCompound-${i}-trihydrate`,
        dosage: `${i * 10}mg`,
        mealTiming: i % 2 === 0 ? 'after_meal' : 'with_meal',
        instructions: `Take exactly 1 tablet with 250ml water. Do not crush or chew. Monitor blood pressure and renal biomarkers weekly. Ref: Protocol #${1000 + i}.`,
        purpose: `Therapeutic maintenance for long-term chronic clinical condition ${cat} Grade ${1 + (i % 3)}.`,
        remainingCount: 30 + (i % 60),
        expiryDate: `2027-${((i % 12) + 1).toString().padStart(2, '0')}-28`,
        category: cat,
        timeSlots: slotChoice,
      });
    }

    const largeAnalysis: PrescriptionAnalysisResult = {
      doctorName: 'Prof. Alexander Fleming, MD, PhD, FACP',
      diagnosis: 'Comprehensive Multi-Morbidity Chronic Poly-Therapy Management Plan',
      medicines: largeMedsList,
      warnings: [],
    };

    // Reset store before large payload
    useMedStore.getState().resetToDemo();
    await sleep(50);

    // Import large prescription
    const t0 = Date.now();
    useMedStore.getState().importPrescription(largeAnalysis);
    const durationImport = Date.now() - t0;
    console.log(`   ⏱️  Imported 60 medications into store in ${durationImport}ms`);

    // Await persistence flush
    await sleep(200);

    // Measure raw AsyncStorage size in bytes using standard TextEncoder (no node Buffer dependency)
    const rawStored = await AsyncStorage.getItem(STORAGE_KEY);
    assert.ok(rawStored, 'Storage must contain persisted state');
    const byteLength = new TextEncoder().encode(rawStored!).length;
    const kbSize = (byteLength / 1024).toFixed(2);
    console.log(`   📊 Persisted JSON Payload Size: ${byteLength} bytes (~${kbSize} KB)`);

    // Must dramatically exceed SecureStore 2KB limit (at least 15KB)
    assert.ok(
      byteLength > 15000,
      `Payload size (${byteLength} bytes) must exceed 15,000 bytes (overcoming 2KB SecureStore ceiling by 7x+)`
    );

    // Verify all 60 medicines exist in cabinet
    const cabinetAfterLarge = useMedStore.getState().cabinet;
    for (let i = 1; i <= 60; i++) {
      const expectedId = `stress-med-${i.toString().padStart(3, '0')}`;
      assert.ok(
        cabinetAfterLarge.some((m) => m.id === expectedId),
        `Cabinet must contain large payload medicine ${expectedId}`
      );
    }

    // Now test rehydration with this >25KB payload
    const freshLargeStore = create<MedState>()(
      persist(
        (set, get) => ({
          ...useMedStore.getState(),
          schedule: MOCK_SCHEDULE,
          cabinet: MOCK_CABINET,
          selectedMedicine: null,
          toggleDoseSlot: useMedStore.getState().toggleDoseSlot,
          importPrescription: useMedStore.getState().importPrescription,
          resetToDemo: useMedStore.getState().resetToDemo,
          setSelectedMedicine: useMedStore.getState().setSelectedMedicine,
        }),
        {
          name: STORAGE_KEY,
          storage: createJSONStorage(() => AsyncStorage),
        }
      )
    );

    await freshLargeStore.persist.rehydrate();
    await sleep(100);

    const rehydratedCabinet = freshLargeStore.getState().cabinet;
    assert.equal(
      rehydratedCabinet.length,
      cabinetAfterLarge.length,
      'Rehydrated store must contain full 60+ medicine cabinet without any truncation'
    );

    recordPass(`Large payload (>2KB ceiling, actual ~${kbSize} KB) persisted and rehydrated with 0 data loss`);
  } catch (err) {
    recordFail('Large payload stress test failed', err);
  }

  // -------------------------------------------------------------------------
  // SUITE 3: Malformed & Corrupted Data Recovery
  // -------------------------------------------------------------------------
  console.log('\n👉 [SUITE 3] Malformed & Corrupted AsyncStorage Recovery');
  try {
    // 3.1 Non-JSON raw corruption
    console.log('   🔸 3.1: Testing recovery from raw non-JSON syntax corruption...');
    const corruptedRawString = 'CORRUPTED_RAW_BLOB_{{unbalanced[syntax!@#$%^&*()';
    await AsyncStorage.setItem(STORAGE_KEY, corruptedRawString);

    // Attempting to read via createJSONStorage
    const jsonStorage = createJSONStorage(() => AsyncStorage);
    let parseErrorCaught = false;
    try {
      await jsonStorage?.getItem(STORAGE_KEY);
    } catch (err) {
      parseErrorCaught = true;
      assert.ok(err instanceof SyntaxError, 'Must throw SyntaxError when JSON is corrupted');
    }
    assert.ok(parseErrorCaught, 'createJSONStorage must reject on malformed raw JSON');

    // Verify resetToDemo() recovers store to clean demo state and overwrites corrupted storage
    useMedStore.getState().resetToDemo();
    await sleep(150);

    const recoveredRaw = await AsyncStorage.getItem(STORAGE_KEY);
    assert.ok(recoveredRaw, 'Storage must be overwritten with clean data');
    const parsedRecovered = JSON.parse(recoveredRaw!);
    assert.ok(parsedRecovered.state.schedule, 'Recovered storage must have valid schedule');
    assert.equal(parsedRecovered.state.schedule.length, 3, 'Recovered schedule must have 3 slots');
    recordPass('Recovered from non-JSON raw syntax corruption via resetToDemo()');

    // 3.2 Valid JSON with corrupted schema: state is null
    console.log('   🔸 3.2: Testing recovery from { state: null } payload...');
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ state: null, version: 0 }));

    // Rehydrate store from null state
    await useMedStore.persist.rehydrate();
    await sleep(50);

    // Verify resetToDemo() still works seamlessly
    useMedStore.getState().resetToDemo();
    await sleep(100);

    const stateAfterNullRecovery = useMedStore.getState();
    assert.equal(stateAfterNullRecovery.schedule.length, 3, 'Schedule must be restored to 3 slots');
    assert.equal(stateAfterNullRecovery.cabinet.length, MOCK_CABINET.length, 'Cabinet restored');
    recordPass('Recovered from { state: null } corruption via resetToDemo()');

    // 3.3 Valid JSON with corrupted schema: schedule is non-array and cabinet is missing
    console.log('   🔸 3.3: Testing recovery from { state: { schedule: "invalid" } }...');
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { schedule: 'invalid-string-instead-of-array', cabinet: null },
        version: 0,
      })
    );

    // Rehydrate
    await useMedStore.persist.rehydrate();
    await sleep(50);

    // Calling resetToDemo() must fix the broken schedule and cabinet
    useMedStore.getState().resetToDemo();
    await sleep(100);

    const stateAfterSchemaFix = useMedStore.getState();
    assert.ok(Array.isArray(stateAfterSchemaFix.schedule), 'Schedule must be restored as an Array');
    assert.equal(stateAfterSchemaFix.schedule.length, 3, 'Schedule restored to 3 slots');
    assert.ok(Array.isArray(stateAfterSchemaFix.cabinet), 'Cabinet must be restored as an Array');
    assert.equal(stateAfterSchemaFix.cabinet.length, MOCK_CABINET.length, 'Cabinet restored to baseline');
    recordPass('Recovered from invalid schema types (schedule: string, cabinet: null) via resetToDemo()');
  } catch (err) {
    recordFail('Corrupted data recovery failed', err);
  }

  // -------------------------------------------------------------------------
  // SUITE 4: Smart Merge Isolation & Normalization Edge Cases
  // -------------------------------------------------------------------------
  console.log('\n👉 [SUITE 4] Smart Merge Isolation & Normalization Edge Cases');
  try {
    useMedStore.getState().resetToDemo();
    await sleep(50);

    // 4.1 Normalization of whitespace and casing
    console.log('   🔸 4.1: Deduplication across whitespace and letter casing...');
    const duplicateMedicinePrescription: PrescriptionAnalysisResult = {
      medicines: [
        {
          id: 'diff-id-but-same-name',
          name: '  amlodipine 5mg  ', // Lowercase and whitespace
          activeIngredient: 'Amlodipine besylate',
          dosage: '5mg',
          mealTiming: 'after_meal',
          instructions: 'Take 1 tablet daily',
          purpose: 'Hypertension',
          remainingCount: 30,
          expiryDate: '2026-12-31',
          category: 'Blood Pressure',
          timeSlots: ['morning'],
        },
      ],
      warnings: [],
    };

    const initialMorningCount = useMedStore.getState().schedule[0].medicines.length;
    useMedStore.getState().importPrescription(duplicateMedicinePrescription);
    const morningCountAfter = useMedStore.getState().schedule[0].medicines.length;

    assert.equal(
      morningCountAfter,
      initialMorningCount,
      'Smart Merge must deduplicate medicine despite different casing and extra whitespace'
    );
    recordPass('Deduplication correctly handles whitespace trimming and case insensitivity');

    // 4.2 As-needed (PRN) medicine with empty timeSlots: []
    console.log('   🔸 4.2: Prescription with empty timeSlots: [] (as-needed / PRN med)...');
    const prnMedicinePrescription: PrescriptionAnalysisResult = {
      medicines: [
        {
          id: 'med-prn-nitroglycerin',
          name: 'Nitroglycerin 0.4mg SL',
          activeIngredient: 'Nitroglycerin',
          dosage: '0.4mg',
          mealTiming: 'with_meal',
          instructions: 'Dissolve 1 tablet sublingually as needed for acute chest pain',
          purpose: 'Angina pectoris PRN',
          remainingCount: 25,
          expiryDate: '2027-01-15',
          category: 'Cardiology',
          timeSlots: [], // No schedule slots
        },
      ],
      warnings: [],
    };

    const scheduleBeforePrn = JSON.stringify(useMedStore.getState().schedule);
    const cabinetCountBeforePrn = useMedStore.getState().cabinet.length;

    useMedStore.getState().importPrescription(prnMedicinePrescription);

    const scheduleAfterPrn = JSON.stringify(useMedStore.getState().schedule);
    const cabinetAfterPrn = useMedStore.getState().cabinet;

    // Schedule should remain completely unchanged
    assert.equal(scheduleAfterPrn, scheduleBeforePrn, 'Empty timeSlots medicine must not affect schedule slots');

    // Cabinet should have received the new PRN medicine
    assert.equal(
      cabinetAfterPrn.length,
      cabinetCountBeforePrn + 1,
      'Empty timeSlots medicine must still be synchronized to cabinet inventory'
    );
    assert.ok(
      cabinetAfterPrn.some((m) => m.id === 'med-prn-nitroglycerin'),
      'Cabinet must contain PRN Nitroglycerin'
    );
    recordPass('As-needed PRN medicine with empty timeSlots safely added to cabinet without affecting schedule');

    // 4.3 Preserving takenAt timestamp across multiple distinct imports
    console.log('   🔸 4.3: Preserving custom takenAt across successive imports...');
    useMedStore.getState().toggleDoseSlot('noon');
    const noonTakenAt = useMedStore.getState().schedule.find((s) => s.slot === 'noon')?.takenAt;
    assert.ok(noonTakenAt, 'Noon takenAt must be set');

    // Import preset 1
    useMedStore.getState().importPrescription(MOCK_ANALYSIS_PRESET_1);
    assert.equal(
      useMedStore.getState().schedule.find((s) => s.slot === 'noon')?.takenAt,
      noonTakenAt,
      'takenAt preserved after first import'
    );

    // Import preset 2
    useMedStore.getState().importPrescription(MOCK_ANALYSIS_PRESET_2);
    assert.equal(
      useMedStore.getState().schedule.find((s) => s.slot === 'noon')?.takenAt,
      noonTakenAt,
      'takenAt preserved after second import'
    );
    assert.equal(
      useMedStore.getState().schedule.find((s) => s.slot === 'noon')?.isTaken,
      true,
      'isTaken preserved as true'
    );
    recordPass('takenAt timestamp and isTaken invariant strictly maintained across multiple imports');
  } catch (err) {
    recordFail('Smart Merge isolation & normalization tests failed', err);
  }

  // -------------------------------------------------------------------------
  // SUITE 5: Rapid Concurrent State Mutations
  // -------------------------------------------------------------------------
  console.log('\n👉 [SUITE 5] Rapid Concurrent State Mutations');
  try {
    useMedStore.getState().resetToDemo();

    // Fire 20 rapid synchronous toggles and imports
    for (let i = 0; i < 10; i++) {
      useMedStore.getState().toggleDoseSlot('morning');
      useMedStore.getState().toggleDoseSlot('noon');
      useMedStore.getState().toggleDoseSlot('evening');
    }

    // 10 toggles on each means:
    // even number of toggles -> isTaken should be back to false
    const currentSchedule = useMedStore.getState().schedule;
    for (const slot of currentSchedule) {
      assert.equal(slot.isTaken, false, `Slot ${slot.slot} after 10 toggles must return to isTaken: false`);
      assert.equal(slot.takenAt, undefined, `Slot ${slot.slot} takenAt must be undefined`);
    }

    // Now toggle morning once (odd number -> true)
    useMedStore.getState().toggleDoseSlot('morning');
    assert.equal(useMedStore.getState().schedule[0].isTaken, true);
    assert.ok(useMedStore.getState().schedule[0].takenAt);

    // Await storage flush
    await sleep(200);

    const persistedRaw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(persistedRaw!);
    assert.equal(parsed.state.schedule[0].isTaken, true, 'Persisted morning slot matches in-memory store');
    assert.equal(parsed.state.schedule[1].isTaken, false, 'Persisted noon slot matches in-memory store');
    assert.equal(parsed.state.schedule[2].isTaken, false, 'Persisted evening slot matches in-memory store');

    recordPass('Rapid consecutive mutations converge accurately in memory and persistent storage');
  } catch (err) {
    recordFail('Rapid concurrent state mutation test failed', err);
  }

  // -------------------------------------------------------------------------
  // FINAL VERDICT & SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`🏆 ALL ${passedTests}/${totalTests} ADVERSARIAL STRESS TEST SUITES PASSED!`);
  console.log('   - 100% Kill App Hydration Fidelity: VERIFIED');
  console.log('   - Large Payload (>2KB ceiling) Persistence: VERIFIED');
  console.log('   - Malformed/Corrupted Storage Recovery: VERIFIED');
  console.log('   - Smart Merge Normalization & Isolation: VERIFIED');
  console.log('   - Rapid Concurrent Mutation Consistency: VERIFIED');
  console.log('======================================================================\n');
}

runAdversarialStressTests().catch((err) => {
  console.error('\n💥 ADVERSARIAL STRESS TEST HARNESS CRASHED WITH ERROR:\n', err);
  process.exit(1);
});
