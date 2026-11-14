// Standalone assertion helper compatible with Expo TypeScript configuration without @types/node
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

// Polyfill window.localStorage for Node environment before loading AsyncStorage
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

async function runStoreVerification() {
  console.log('=====================================================');
  console.log('🧪 Starting MedLens AI Store & Persistence Verification');
  console.log('=====================================================\n');

  // Dynamic import after polyfill
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  const { useMedStore } = await import('@/store/useMedStore');
  const {
    MOCK_CABINET,
    MOCK_ANALYSIS_PRESET_2,
    MED_AMLODIPINE,
  } = await import('@/mocks/mockData');

  // Clear storage and reset store
  await AsyncStorage.clear();
  useMedStore.getState().resetToDemo();

  // Test 1: Initial State Invariant
  console.log('👉 [Test 1] Verifying initial store state against mock datasets...');
  const initialState = useMedStore.getState();
  assert.equal(initialState.schedule.length, 3, 'Initial schedule must contain 3 dose slots');
  assert.equal(initialState.schedule[0].slot, 'morning');
  assert.equal(initialState.schedule[0].timeLabel, '08:00');
  assert.equal(initialState.schedule[0].isTaken, false, 'Morning dose must initially be un-taken');
  assert.equal(initialState.schedule[0].takenAt, undefined, 'Morning dose takenAt must initially be undefined');
  assert.equal(initialState.schedule[1].slot, 'noon');
  assert.equal(initialState.schedule[2].slot, 'evening');
  assert.ok(initialState.cabinet.length >= 7, 'Cabinet must contain diverse medications');
  assert.ok(
    initialState.cabinet.some((m) => m.name.includes('Aspirin 81mg')),
    'Cabinet must include Aspirin 81mg'
  );
  assert.equal(initialState.selectedMedicine, null, 'selectedMedicine must initially be null');
  console.log('   ✅ Initial state matches clinical specifications.\n');

  // Test 2: Toggle Dose Slot (1-Touch Checkmark)
  console.log('👉 [Test 2] Verifying toggleDoseSlot functionality...');
  initialState.toggleDoseSlot('morning');
  let stateAfterToggle = useMedStore.getState();
  const morningSlot = stateAfterToggle.schedule.find((s) => s.slot === 'morning');
  assert.ok(morningSlot, 'Morning slot must exist');
  assert(morningSlot);
  assert.equal(morningSlot.isTaken, true, 'Morning slot must now be marked taken');
  assert.ok(morningSlot.takenAt, 'Morning slot takenAt must be set to an ISO string');
  const firstTakenAt = morningSlot.takenAt;

  // Toggle off again
  initialState.toggleDoseSlot('morning');
  stateAfterToggle = useMedStore.getState();
  const morningSlotUntaken = stateAfterToggle.schedule.find((s) => s.slot === 'morning');
  assert.ok(morningSlotUntaken, 'Morning slot must exist');
  assert(morningSlotUntaken);
  assert.equal(morningSlotUntaken.isTaken, false, 'Morning slot must now be untaken');
  assert.equal(morningSlotUntaken.takenAt, undefined, 'takenAt must be cleared when untaken');

  // Toggle back to taken for Smart Merge test
  initialState.toggleDoseSlot('morning');
  const morningSlotTakenAgain = useMedStore.getState().schedule.find((s) => s.slot === 'morning');
  assert.ok(morningSlotTakenAgain);
  assert(morningSlotTakenAgain);
  assert.equal(morningSlotTakenAgain.isTaken, true);
  console.log('   ✅ toggleDoseSlot correctly updates isTaken and takenAt.\n');

  // Test 3: Smart Merge Invariant (DO NOT RESET TAKEN DOSES)
  console.log('👉 [Test 3] Verifying Smart Merge preserving taken status...');
  const recordedTakenAt = morningSlotTakenAgain.takenAt;

  // Import Preset 2 (Antibiotics + Gastric conflict)
  useMedStore.getState().importPrescription(MOCK_ANALYSIS_PRESET_2);

  const stateAfterMerge = useMedStore.getState();
  const morningAfterMerge = stateAfterMerge.schedule.find((s) => s.slot === 'morning');
  assert.ok(morningAfterMerge);
  assert(morningAfterMerge);

  // Check critical invariant: isTaken and takenAt MUST be preserved!
  assert.equal(
    morningAfterMerge.isTaken,
    true,
    'CRITICAL INVARIANT FAILED: Smart Merge must NOT reset isTaken on already completed doses!'
  );
  assert.equal(
    morningAfterMerge.takenAt,
    recordedTakenAt,
    'CRITICAL INVARIANT FAILED: Smart Merge must preserve original takenAt timestamp!'
  );

  // Check new medicines are present in morning slot
  const hasCiproMorning = morningAfterMerge.medicines.some((m) => m.name.includes('Ciprofloxacin'));
  const hasGavisconMorning = morningAfterMerge.medicines.some((m) => m.name.includes('Gaviscon'));
  assert.ok(hasCiproMorning, 'Morning slot must now contain Ciprofloxacin');
  assert.ok(hasGavisconMorning, 'Morning slot must now contain Gaviscon');

  // Check evening slot has Ciprofloxacin
  const eveningAfterMerge = stateAfterMerge.schedule.find((s) => s.slot === 'evening');
  assert.ok(eveningAfterMerge);
  assert(eveningAfterMerge);
  assert.ok(
    eveningAfterMerge.medicines.some((m) => m.name.includes('Ciprofloxacin')),
    'Evening slot must contain Ciprofloxacin'
  );

  // Check cabinet is synchronized with new medicines
  const hasCiproCabinet = stateAfterMerge.cabinet.some((m) => m.name.includes('Ciprofloxacin'));
  const hasGavisconCabinet = stateAfterMerge.cabinet.some((m) => m.name.includes('Gaviscon'));
  assert.ok(hasCiproCabinet, 'Cabinet must now include Ciprofloxacin');
  assert.ok(hasGavisconCabinet, 'Cabinet must now include Gaviscon');
  console.log('   ✅ Smart Merge strictly preserves dose status and synchronizes cabinet.\n');

  // Test 4: Deduplication on Repeated Import
  console.log('👉 [Test 4] Verifying deduplication when re-importing same prescription...');
  const morningMedCountBefore = morningAfterMerge.medicines.length;
  const cabinetCountBefore = stateAfterMerge.cabinet.length;

  useMedStore.getState().importPrescription(MOCK_ANALYSIS_PRESET_2);

  const stateAfterSecondMerge = useMedStore.getState();
  const morningAfterSecondMerge = stateAfterSecondMerge.schedule.find((s) => s.slot === 'morning');
  assert.ok(morningAfterSecondMerge);
  assert(morningAfterSecondMerge);
  assert.equal(
    morningAfterSecondMerge.medicines.length,
    morningMedCountBefore,
    'Smart Merge must avoid duplicate medicines in dose slot'
  );
  assert.equal(
    stateAfterSecondMerge.cabinet.length,
    cabinetCountBefore,
    'Smart Merge must avoid duplicate medicines in cabinet'
  );
  console.log('   ✅ Deduplication logic works properly.\n');

  // Test 5: Selected Medicine modal state
  console.log('👉 [Test 5] Verifying setSelectedMedicine...');
  useMedStore.getState().setSelectedMedicine(MED_AMLODIPINE);
  assert.equal(
    useMedStore.getState().selectedMedicine?.id,
    MED_AMLODIPINE.id,
    'Selected medicine must be updated'
  );
  useMedStore.getState().setSelectedMedicine(null);
  assert.equal(useMedStore.getState().selectedMedicine, null, 'Selected medicine must be cleared to null');
  console.log('   ✅ setSelectedMedicine works properly.\n');

  // Test 6: Reset to Demo
  console.log('👉 [Test 6] Verifying resetToDemo...');
  useMedStore.getState().resetToDemo();
  const resetState = useMedStore.getState();
  assert.equal(resetState.schedule.length, 3);
  assert.equal(resetState.schedule[0].isTaken, false, 'Morning dose must be reset to un-taken');
  assert.equal(resetState.schedule[0].takenAt, undefined, 'Morning dose takenAt must be undefined');
  assert.equal(resetState.schedule[0].medicines.length, 2, 'Morning medicines count restored to default');
  assert.equal(resetState.cabinet.length, MOCK_CABINET.length, 'Cabinet length restored to default');
  assert.equal(resetState.selectedMedicine, null);
  console.log('   ✅ resetToDemo successfully restored demo baseline state.\n');

  // Test 7: Offline Persistence Verification (AsyncStorage 'medlens-storage-v1')
  console.log('👉 [Test 7] Verifying Zustand AsyncStorage persistence (Kill App Resilience)...');
  // Mutate state: toggle noon slot
  useMedStore.getState().toggleDoseSlot('noon');

  // Wait for zustand persist to flush to AsyncStorage
  await new Promise((r) => setTimeout(r, 100));

  const storedRaw = await AsyncStorage.getItem('medlens-storage-v1');
  assert.ok(storedRaw, "AsyncStorage must contain item with key 'medlens-storage-v1'");
  assert(storedRaw);
  const parsedStorage = JSON.parse(storedRaw);
  assert.ok(parsedStorage.state, 'Persisted payload must contain state object');
  assert.ok(parsedStorage.state.schedule, 'Persisted state must contain schedule');
  const persistedNoon = parsedStorage.state.schedule.find((s: any) => s.slot === 'noon');
  assert.ok(persistedNoon, 'Persisted schedule must contain noon slot');
  assert.equal(persistedNoon.isTaken, true, 'Persisted noon slot must be isTaken: true');
  assert.ok(persistedNoon.takenAt, 'Persisted noon slot must have takenAt timestamp');
  console.log('   ✅ 100% Kill App Persistence verified with key "medlens-storage-v1".\n');

  console.log('=====================================================');
  console.log('🎉 ALL 7 VERIFICATION TESTS PASSED SUCCESSFULLY!');
  console.log('=====================================================');
}

runStoreVerification().catch((err) => {
  console.error('❌ Verification failed with error:', err);
  process.exit(1);
});
