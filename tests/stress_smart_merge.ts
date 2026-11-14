// Adversarial Stress Test Suite for Smart Merge & Store Invariants
// Tests MedLens AI store under boundary, edge, and stress conditions.

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

assert.notEqual = function (actual: any, expected: any, message?: string) {
  if (actual === expected) {
    throw new Error(`${message || 'Assertion failed'}: expected value NOT to equal ${actual}`);
  }
};

assert.ok = function (value: any, message?: string) {
  if (!value) {
    throw new Error(message || 'Assertion failed');
  }
};

// In-memory AsyncStorage polyfill for Node.js CLI runtime
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

async function runAdversarialStressTests() {
  console.log('======================================================================');
  console.log('🔥 MedLens AI Adversarial Stress Test Suite (Smart Merge & Store)');
  console.log('======================================================================\n');

  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  const { useMedStore } = await import('@/store/useMedStore');
  const {
    MOCK_CABINET,
    MOCK_SCHEDULE,
    MOCK_ANALYSIS_PRESET_1,
    MOCK_ANALYSIS_PRESET_2,
  } = await import('@/mocks/mockData');
  type PrescriptionAnalysisResult = import('@/types/medlens').PrescriptionAnalysisResult;
  type Medicine = import('@/types/medlens').Medicine;

  let passedCount = 0;
  let failedCount = 0;
  const observations: string[] = [];

  async function test(name: string, fn: () => void | Promise<void>) {
    process.stdout.write(`⚡ [STRESS TEST] ${name}... `);
    try {
      await fn();
      passedCount++;
      console.log('PASSED ✅');
    } catch (err: any) {
      failedCount++;
      console.log('FAILED ❌');
      console.error(`   Error: ${err.message}`);
    }
  }

  // Clear storage and reset store
  await AsyncStorage.clear();
  useMedStore.getState().resetToDemo();

  // Test 1: Preservation of isTaken: true & exact takenAt timestamp across multiple sequential imports
  await test('1. Preserves isTaken: true and exact ISO timestamp across 5 sequential imports', async () => {
    useMedStore.getState().resetToDemo();
    useMedStore.getState().toggleDoseSlot('morning');

    const morningSlotBefore = useMedStore.getState().schedule.find((s) => s.slot === 'morning')!;
    assert.equal(morningSlotBefore.isTaken, true, 'Morning should be taken');
    const originalTakenAt = morningSlotBefore.takenAt;
    assert.ok(originalTakenAt, 'Morning takenAt must be present');

    // Sequential Import 1: Preset 1
    useMedStore.getState().importPrescription(MOCK_ANALYSIS_PRESET_1);
    let morning = useMedStore.getState().schedule.find((s) => s.slot === 'morning')!;
    assert.equal(morning.isTaken, true, 'Import 1: isTaken must remain true');
    assert.equal(morning.takenAt, originalTakenAt, 'Import 1: takenAt must match original timestamp string');

    // Sequential Import 2: Preset 2
    useMedStore.getState().importPrescription(MOCK_ANALYSIS_PRESET_2);
    morning = useMedStore.getState().schedule.find((s) => s.slot === 'morning')!;
    assert.equal(morning.isTaken, true, 'Import 2: isTaken must remain true');
    assert.equal(morning.takenAt, originalTakenAt, 'Import 2: takenAt must match original timestamp string');

    // Sequential Import 3: Synthetic prescription targeting morning
    const customPrescription1: PrescriptionAnalysisResult = {
      doctorName: 'Dr. Strange',
      diagnosis: 'Acute Fatigue',
      medicines: [
        {
          id: 'med_synth_1',
          name: 'Vitamin B-Complex 100mg',
          activeIngredient: 'Thiamine, Riboflavin',
          dosage: '1 tablet',
          mealTiming: 'after_meal',
          instructions: 'Take 1 tablet in the morning',
          purpose: 'Energy',
          remainingCount: 30,
          expiryDate: '2027-01-01',
          category: 'Supplements',
          timeSlots: ['morning'],
        },
      ],
      warnings: [],
    };
    useMedStore.getState().importPrescription(customPrescription1);
    morning = useMedStore.getState().schedule.find((s) => s.slot === 'morning')!;
    assert.equal(morning.isTaken, true, 'Import 3: isTaken must remain true');
    assert.equal(morning.takenAt, originalTakenAt, 'Import 3: takenAt must match original timestamp string');

    // Sequential Import 4: Synthetic prescription targeting evening (not morning)
    const customPrescription2: PrescriptionAnalysisResult = {
      medicines: [
        {
          id: 'med_synth_2',
          name: 'Melatonin 3mg',
          activeIngredient: 'Melatonin',
          dosage: '1 capsule',
          mealTiming: 'before_meal',
          instructions: 'Take 30m before sleep',
          purpose: 'Sleep Support',
          remainingCount: 60,
          expiryDate: '2027-06-30',
          category: 'Supplements',
          timeSlots: ['evening'],
        },
      ],
      warnings: [],
    };
    useMedStore.getState().importPrescription(customPrescription2);
    morning = useMedStore.getState().schedule.find((s) => s.slot === 'morning')!;
    assert.equal(morning.isTaken, true, 'Import 4: isTaken must remain true');
    assert.equal(morning.takenAt, originalTakenAt, 'Import 4: takenAt must match original timestamp string');

    // Sequential Import 5: Re-import Preset 1
    useMedStore.getState().importPrescription(MOCK_ANALYSIS_PRESET_1);
    morning = useMedStore.getState().schedule.find((s) => s.slot === 'morning')!;
    assert.equal(morning.isTaken, true, 'Import 5: isTaken must remain true');
    assert.equal(morning.takenAt, originalTakenAt, 'Import 5: takenAt must match original timestamp string');
  });

  // Test 2: Preserving isTaken: false and undefined takenAt on untouched slots
  await test('2. Preserves isTaken: false and undefined takenAt on untouched slots during imports', async () => {
    useMedStore.getState().resetToDemo();
    // Untouched noon and evening
    const noonBefore = useMedStore.getState().schedule.find((s) => s.slot === 'noon')!;
    const eveningBefore = useMedStore.getState().schedule.find((s) => s.slot === 'evening')!;
    assert.equal(noonBefore.isTaken, false);
    assert.equal(noonBefore.takenAt, undefined);
    assert.equal(eveningBefore.isTaken, false);
    assert.equal(eveningBefore.takenAt, undefined);

    // Import prescription targeting noon and evening
    const testRx: PrescriptionAnalysisResult = {
      medicines: [
        {
          id: 'med_noon_ev_1',
          name: 'Probiotic Multi-Strain',
          activeIngredient: 'Lactobacillus acidophilus',
          dosage: '1 capsule',
          mealTiming: 'with_meal',
          instructions: 'Take with food',
          purpose: 'Gut health',
          remainingCount: 20,
          expiryDate: '2026-12-01',
          category: 'Stomach',
          timeSlots: ['noon', 'evening'],
        },
      ],
      warnings: [],
    };
    useMedStore.getState().importPrescription(testRx);

    const noonAfter = useMedStore.getState().schedule.find((s) => s.slot === 'noon')!;
    const eveningAfter = useMedStore.getState().schedule.find((s) => s.slot === 'evening')!;

    assert.equal(noonAfter.isTaken, false, 'Noon slot must remain untaken');
    assert.equal(noonAfter.takenAt, undefined, 'Noon takenAt must remain undefined');
    assert.equal(eveningAfter.isTaken, false, 'Evening slot must remain untaken');
    assert.equal(eveningAfter.takenAt, undefined, 'Evening takenAt must remain undefined');

    // Verify medicine was actually added
    assert.ok(
      noonAfter.medicines.some((m) => m.name === 'Probiotic Multi-Strain'),
      'Noon slot received new medicine'
    );
    assert.ok(
      eveningAfter.medicines.some((m) => m.name === 'Probiotic Multi-Strain'),
      'Evening slot received new medicine'
    );
  });

  // Test 3: Multi-slot medicine assignment (e.g. morning + evening)
  await test('3. Handles medicine assigned to multiple slots and strips timeSlots property', async () => {
    useMedStore.getState().resetToDemo();
    const multiSlotMed: PrescriptionAnalysisResult = {
      medicines: [
        {
          id: 'med_multi_1',
          name: 'Augmentin 625mg',
          activeIngredient: 'Amoxicillin + Clavulanate',
          dosage: '1 tablet twice daily',
          mealTiming: 'after_meal',
          instructions: 'Every 12 hours after meals',
          purpose: 'Bacterial Infection',
          remainingCount: 14,
          expiryDate: '2026-11-30',
          category: 'Antibiotics',
          timeSlots: ['morning', 'evening'],
        },
      ],
      warnings: [],
    };

    useMedStore.getState().importPrescription(multiSlotMed);

    const schedule = useMedStore.getState().schedule;
    const morning = schedule.find((s) => s.slot === 'morning')!;
    const noon = schedule.find((s) => s.slot === 'noon')!;
    const evening = schedule.find((s) => s.slot === 'evening')!;

    const morningAug = morning.medicines.find((m) => m.id === 'med_multi_1');
    const noonAug = noon.medicines.find((m) => m.id === 'med_multi_1');
    const eveningAug = evening.medicines.find((m) => m.id === 'med_multi_1');

    assert.ok(morningAug, 'Morning must include Augmentin');
    assert.equal(noonAug, undefined, 'Noon must NOT include Augmentin');
    assert.ok(eveningAug, 'Evening must include Augmentin');

    // Invariant: timeSlots property must be stripped from clean Medicine
    assert.equal((morningAug as any).timeSlots, undefined, 'timeSlots must be stripped in schedule');
    assert.equal((eveningAug as any).timeSlots, undefined, 'timeSlots must be stripped in schedule');

    // Invariant: Cabinet must have Augmentin exactly once without timeSlots
    const cabinetAug = useMedStore.getState().cabinet.filter((m) => m.name === 'Augmentin 625mg');
    assert.equal(cabinetAug.length, 1, 'Cabinet must contain Augmentin exactly once');
    assert.equal((cabinetAug[0] as any).timeSlots, undefined, 'timeSlots must be stripped in cabinet');
  });

  // Test 4: Deduplication of medicines already in cabinet (case-insensitive & trimmed)
  await test('4. Cabinet deduplication ignores case and surrounding whitespace', async () => {
    useMedStore.getState().resetToDemo();
    const initialCabinetLen = useMedStore.getState().cabinet.length;

    // Cabinet already contains "Aspirin 81mg" (id: med_aspirin_81)
    const duplicateCabinetRx: PrescriptionAnalysisResult = {
      medicines: [
        {
          id: 'diff_id_aspirin',
          name: '   aSpIrIn 81mg   ', // case and whitespace variation
          activeIngredient: 'Aspirin',
          dosage: '81mg',
          mealTiming: 'after_meal',
          instructions: 'Take after meal',
          purpose: 'Cardiovascular',
          remainingCount: 100,
          expiryDate: '2028-01-01',
          category: 'Blood Pressure',
          timeSlots: ['morning'],
        },
      ],
      warnings: [],
    };

    useMedStore.getState().importPrescription(duplicateCabinetRx);

    const cabinetAfter = useMedStore.getState().cabinet;
    assert.equal(
      cabinetAfter.length,
      initialCabinetLen,
      'Cabinet length must NOT increase when importing existing medicine with different case/spaces'
    );
  });

  // Test 5: Empty prescription import does not corrupt or mutate state
  await test('5. Empty prescription import ({ medicines: [] }) causes zero state mutation', async () => {
    useMedStore.getState().resetToDemo();
    const stateBefore = useMedStore.getState();
    const scheduleCount = stateBefore.schedule.map((s) => ({
      slot: s.slot,
      medCount: s.medicines.length,
      isTaken: s.isTaken,
      takenAt: s.takenAt,
    }));
    const cabinetLength = stateBefore.cabinet.length;

    const emptyRx: PrescriptionAnalysisResult = {
      doctorName: 'Dr. Empty',
      diagnosis: 'None',
      medicines: [],
      warnings: [],
    };

    useMedStore.getState().importPrescription(emptyRx);

    const stateAfter = useMedStore.getState();
    assert.equal(stateAfter.cabinet.length, cabinetLength, 'Cabinet length must remain unchanged');
    assert.equal(stateAfter.schedule.length, 3, 'Schedule must remain 3 slots');

    stateAfter.schedule.forEach((slot, idx) => {
      assert.equal(slot.slot, scheduleCount[idx].slot);
      assert.equal(slot.medicines.length, scheduleCount[idx].medCount);
      assert.equal(slot.isTaken, scheduleCount[idx].isTaken);
      assert.equal(slot.takenAt, scheduleCount[idx].takenAt);
    });
  });

  // Test 6: Rapid sequential dose toggles (100 toggles stress harness)
  await test('6. Rapid sequential dose toggles (100 toggles) correctly flip takenAt and isTaken', async () => {
    useMedStore.getState().resetToDemo();

    for (let i = 1; i <= 100; i++) {
      useMedStore.getState().toggleDoseSlot('evening');
      const evening = useMedStore.getState().schedule.find((s) => s.slot === 'evening')!;

      if (i % 2 === 1) {
        // Odd iteration: must be taken
        assert.equal(evening.isTaken, true, `Toggle #${i} should set isTaken: true`);
        assert.ok(evening.takenAt, `Toggle #${i} should set takenAt timestamp`);
        assert.ok(!isNaN(Date.parse(evening.takenAt!)), `Toggle #${i} takenAt must be valid ISO string`);
      } else {
        // Even iteration: must be untaken
        assert.equal(evening.isTaken, false, `Toggle #${i} should set isTaken: false`);
        assert.equal(evening.takenAt, undefined, `Toggle #${i} should clear takenAt to undefined`);
      }
    }

    // Final state after 100 toggles should be untaken
    const finalEvening = useMedStore.getState().schedule.find((s) => s.slot === 'evening')!;
    assert.equal(finalEvening.isTaken, false);
    assert.equal(finalEvening.takenAt, undefined);

    // 101st toggle sets it taken again with a fresh timestamp
    useMedStore.getState().toggleDoseSlot('evening');
    const toggledAgain = useMedStore.getState().schedule.find((s) => s.slot === 'evening')!;
    assert.equal(toggledAgain.isTaken, true);
    assert.ok(toggledAgain.takenAt);
  });

  // Test 7: Idempotency of repeated identical imports (10 iterations)
  await test('7. Idempotency of repeated identical imports (10x)', async () => {
    useMedStore.getState().resetToDemo();

    // First import
    useMedStore.getState().importPrescription(MOCK_ANALYSIS_PRESET_2);
    const stateAfter1 = useMedStore.getState();
    const morningCount = stateAfter1.schedule.find((s) => s.slot === 'morning')!.medicines.length;
    const noonCount = stateAfter1.schedule.find((s) => s.slot === 'noon')!.medicines.length;
    const eveningCount = stateAfter1.schedule.find((s) => s.slot === 'evening')!.medicines.length;
    const cabinetCount = stateAfter1.cabinet.length;

    // Repeat 9 more times
    for (let i = 2; i <= 10; i++) {
      useMedStore.getState().importPrescription(MOCK_ANALYSIS_PRESET_2);
      const state = useMedStore.getState();
      assert.equal(
        state.schedule.find((s) => s.slot === 'morning')!.medicines.length,
        morningCount,
        `Iteration ${i}: Morning medicine count must remain constant`
      );
      assert.equal(
        state.schedule.find((s) => s.slot === 'noon')!.medicines.length,
        noonCount,
        `Iteration ${i}: Noon medicine count must remain constant`
      );
      assert.equal(
        state.schedule.find((s) => s.slot === 'evening')!.medicines.length,
        eveningCount,
        `Iteration ${i}: Evening medicine count must remain constant`
      );
      assert.equal(
        state.cabinet.length,
        cabinetCount,
        `Iteration ${i}: Cabinet length must remain constant`
      );
    }
  });

  // Test 8: Cross-slot independence during toggles
  await test('8. Toggling morning slot does not mutate noon or evening slot objects or states', async () => {
    useMedStore.getState().resetToDemo();
    const stateBefore = useMedStore.getState();
    const noonSlotBefore = stateBefore.schedule.find((s) => s.slot === 'noon')!;
    const eveningSlotBefore = stateBefore.schedule.find((s) => s.slot === 'evening')!;

    useMedStore.getState().toggleDoseSlot('morning');

    const stateAfter = useMedStore.getState();
    const noonSlotAfter = stateAfter.schedule.find((s) => s.slot === 'noon')!;
    const eveningSlotAfter = stateAfter.schedule.find((s) => s.slot === 'evening')!;

    // Non-targeted slots should remain reference-identical or value-identical
    assert.equal(noonSlotAfter.isTaken, noonSlotBefore.isTaken);
    assert.equal(noonSlotAfter.takenAt, noonSlotBefore.takenAt);
    assert.equal(noonSlotAfter.medicines.length, noonSlotBefore.medicines.length);

    assert.equal(eveningSlotAfter.isTaken, eveningSlotBefore.isTaken);
    assert.equal(eveningSlotAfter.takenAt, eveningSlotBefore.takenAt);
    assert.equal(eveningSlotAfter.medicines.length, eveningSlotBefore.medicines.length);
  });

  // Test 9: Input prescription object mutation independence (immutability check)
  await test('9. Modifying external prescription object post-import does not corrupt store medicines', async () => {
    useMedStore.getState().resetToDemo();

    const mutableRx: PrescriptionAnalysisResult = {
      medicines: [
        {
          id: 'med_mutable_1',
          name: 'Ibuprofen 400mg',
          activeIngredient: 'Ibuprofen',
          dosage: '400mg',
          mealTiming: 'after_meal',
          instructions: 'Take with full glass of water',
          purpose: 'Pain Relief',
          remainingCount: 20,
          expiryDate: '2026-10-10',
          category: 'Pain Relief',
          timeSlots: ['morning'],
        },
      ],
      warnings: [],
    };

    useMedStore.getState().importPrescription(mutableRx);

    // Now corrupt the external object
    mutableRx.medicines[0].dosage = 'HACKED_DOSAGE_9999MG';
    (mutableRx.medicines[0] as any).timeSlots = ['noon', 'evening'];

    const storedMorning = useMedStore.getState().schedule.find((s) => s.slot === 'morning')!;
    const storedMed = storedMorning.medicines.find((m) => m.id === 'med_mutable_1')!;

    // Because cleanMedicine was destructured ({ timeSlots: _, ...cleanMedicine }), timeSlots is removed
    assert.equal((storedMed as any).timeSlots, undefined, 'Stored medicine must not have timeSlots');
  });

  // Test 10: Adversarial Challenge: Intra-prescription duplicate items in same prescription
  await test('10. [Adversarial Challenge] Intra-prescription duplicates within single prescription', async () => {
    useMedStore.getState().resetToDemo();

    // What if OCR/AI outputs duplicate entries for the same medicine in the same slot?
    const intraDuplicateRx: PrescriptionAnalysisResult = {
      medicines: [
        {
          id: 'amox_dup_1',
          name: 'Amoxicillin 500mg',
          activeIngredient: 'Amoxicillin',
          dosage: '500mg',
          mealTiming: 'after_meal',
          instructions: 'Take 1 capsule',
          purpose: 'Infection',
          remainingCount: 21,
          expiryDate: '2027-01-01',
          category: 'Antibiotics',
          timeSlots: ['morning'],
        },
        {
          id: 'amox_dup_2', // same name, different id
          name: 'Amoxicillin 500mg',
          activeIngredient: 'Amoxicillin',
          dosage: '500mg',
          mealTiming: 'after_meal',
          instructions: 'Take 1 capsule',
          purpose: 'Infection',
          remainingCount: 21,
          expiryDate: '2027-01-01',
          category: 'Antibiotics',
          timeSlots: ['morning'],
        },
      ],
      warnings: [],
    };

    useMedStore.getState().importPrescription(intraDuplicateRx);

    const morning = useMedStore.getState().schedule.find((s) => s.slot === 'morning')!;
    const amoxInMorning = morning.medicines.filter((m) => m.name.toLowerCase().includes('amoxicillin'));

    // Check cabinet: Deduplicated properly
    const amoxInCabinet = useMedStore.getState().cabinet.filter((m) => m.name.toLowerCase().includes('amoxicillin'));
    assert.equal(amoxInCabinet.length, 1, 'Cabinet must deduplicate intra-prescription duplicates');

    // Schedule slot deduplication
    assert.equal(amoxInMorning.length, 1, 'Schedule slot must deduplicate intra-prescription duplicates');
  });

  // Test 11: Medicine with empty or missing timeSlots
  await test('11. Medicine with empty timeSlots array syncs to cabinet but is not added to schedule', async () => {
    useMedStore.getState().resetToDemo();
    const initialCabinetLen = useMedStore.getState().cabinet.length;
    const initialScheduleMeds = useMedStore.getState().schedule.map((s) => s.medicines.length);

    const unscheduledRx: PrescriptionAnalysisResult = {
      medicines: [
        {
          id: 'med_prn_1',
          name: 'Paracetamol 500mg PRN',
          activeIngredient: 'Paracetamol',
          dosage: '500mg as needed',
          mealTiming: 'after_meal',
          instructions: 'Take as needed for headache',
          purpose: 'Analgesic',
          remainingCount: 10,
          expiryDate: '2027-12-31',
          category: 'Pain Relief',
          timeSlots: [], // No schedule slots assigned (PRN / As needed)
        },
      ],
      warnings: [],
    };

    useMedStore.getState().importPrescription(unscheduledRx);

    const state = useMedStore.getState();
    assert.equal(state.cabinet.length, initialCabinetLen + 1, 'Cabinet must receive PRN medicine');
    state.schedule.forEach((slot, idx) => {
      assert.equal(
        slot.medicines.length,
        initialScheduleMeds[idx],
        `Slot ${slot.slot} medicine count must not change`
      );
    });
  });

  // Test 12: Deep restoration verification on resetToDemo()
  await test('12. resetToDemo() completely restores clean baseline and breaks reference mutations', async () => {
    useMedStore.getState().resetToDemo();

    // Perform heavy mutations: toggle all slots, import prescriptions, select medicine
    useMedStore.getState().toggleDoseSlot('morning');
    useMedStore.getState().toggleDoseSlot('noon');
    useMedStore.getState().toggleDoseSlot('evening');
    useMedStore.getState().importPrescription(MOCK_ANALYSIS_PRESET_1);
    useMedStore.getState().importPrescription(MOCK_ANALYSIS_PRESET_2);
    useMedStore.getState().setSelectedMedicine(useMedStore.getState().cabinet[0]);

    // Now Reset
    useMedStore.getState().resetToDemo();

    const state = useMedStore.getState();
    assert.equal(state.selectedMedicine, null);
    assert.equal(state.schedule.length, 3);
    for (const slot of state.schedule) {
      assert.equal(slot.isTaken, false, `Slot ${slot.slot} must be reset to isTaken: false`);
      assert.equal(slot.takenAt, undefined, `Slot ${slot.slot} takenAt must be undefined`);
    }
    assert.equal(state.cabinet.length, MOCK_CABINET.length);

    // Verify deep copy of medicines in slots (mutating returned slot shouldn't alter mock)
    state.schedule[0].medicines[0].name = 'MUTATED_NAME';
    assert.notEqual(MOCK_SCHEDULE[0].medicines[0].name, 'MUTATED_NAME', 'Mock data must not be mutated');
  });

  // Test 13: Call toggleDoseSlot on non-existent / invalid slot name
  await test('13. toggleDoseSlot with invalid slot gracefully no-ops without error', async () => {
    useMedStore.getState().resetToDemo();
    const scheduleBefore = useMedStore.getState().schedule;

    // Call with invalid slot
    useMedStore.getState().toggleDoseSlot('midnight' as any);

    const scheduleAfter = useMedStore.getState().schedule;
    assert.equal(scheduleAfter.length, 3);
    scheduleAfter.forEach((slot, idx) => {
      assert.equal(slot.slot, scheduleBefore[idx].slot);
      assert.equal(slot.isTaken, scheduleBefore[idx].isTaken);
      assert.equal(slot.takenAt, scheduleBefore[idx].takenAt);
    });
  });

  // Test 14: All 3 slots taken -> Adherence calculation check
  await test('14. Complete schedule adherence tracking invariant (3/3 completed slots)', async () => {
    useMedStore.getState().resetToDemo();

    useMedStore.getState().toggleDoseSlot('morning');
    useMedStore.getState().toggleDoseSlot('noon');
    useMedStore.getState().toggleDoseSlot('evening');

    const schedule = useMedStore.getState().schedule;
    const completedCount = schedule.filter((s) => s.isTaken).length;
    const adherencePercent = Math.round((completedCount / schedule.length) * 100);

    assert.equal(completedCount, 3, 'All 3 slots must be completed');
    assert.equal(adherencePercent, 100, 'Adherence percentage must be 100%');

    // Untoggle noon
    useMedStore.getState().toggleDoseSlot('noon');
    const schedule2 = useMedStore.getState().schedule;
    const completed2 = schedule2.filter((s) => s.isTaken).length;
    const adherence2 = Math.round((completed2 / schedule2.length) * 100);

    assert.equal(completed2, 2, '2 slots must be completed');
    assert.equal(adherence2, 67, 'Adherence percentage must be 67%');
  });

  console.log('\n======================================================================');
  console.log(`📊 ADVERSARIAL STRESS TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('======================================================================\n');

  if (observations.length > 0) {
    console.log('📌 EMPIRICAL OBSERVATIONS & DIAGNOSTICS:');
    observations.forEach((obs, idx) => {
      console.log(`   [${idx + 1}] ${obs}`);
    });
    console.log('');
  }

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAdversarialStressTests().catch((err) => {
  console.error('Fatal stress test runner failure:', err);
  process.exit(1);
});
