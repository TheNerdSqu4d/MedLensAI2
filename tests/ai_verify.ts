/**
 * Standalone Verification Test Suite for MedLens AI Milestone 2:
 * AI & Dual-Layer Interaction Engine (services/ai.ts)
 */

declare const process: any;

// Standalone assertion helper compatible with Expo TypeScript configuration without @types/node
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

assert.ok = function (value: any, message?: string) {
  if (!value) {
    throw new Error(message || 'Assertion failed');
  }
};

// Track any unhandled rejections or uncaught exceptions
const unhandledRejections: any[] = [];
const uncaughtExceptions: any[] = [];

process.on('unhandledRejection', (reason: any, promise: any) => {
  unhandledRejections.push({ reason, promise });
  console.error('🚨 UNHANDLED PROMISE REJECTION DETECTED:', reason);
});

process.on('uncaughtException', (err: any) => {
  uncaughtExceptions.push(err);
  console.error('🚨 UNCAUGHT EXCEPTION DETECTED:', err);
});

async function runAIVerification() {
  console.log('=====================================================');
  console.log('🧪 Starting MedLens AI AI & Dual-Layer Verification');
  console.log('=====================================================\n');

  const { analyzePrescription, askAI, FALLBACK_AI_RESULT } = await import('@/services/ai');
  const { MOCK_ANALYSIS_PRESET_1, MOCK_ANALYSIS_PRESET_2 } = await import('@/mocks/mockData');

  // Test 1: Fallback Delay Timing Invariant (>= 1100ms)
  console.log('👉 [Test 1] Verifying fallback delay timing (>= 1100ms)...');
  const startTimer = Date.now();
  const res1 = await analyzePrescription(undefined, undefined, 'preset1');
  const elapsedMs = Date.now() - startTimer;
  console.log(`   ⏱️ Elapsed time: ${elapsedMs}ms`);
  assert(elapsedMs >= 1100, `Fallback delay must be >= 1100ms for realistic demo pacing (got ${elapsedMs}ms)`);
  assert.ok(res1, 'Result must be returned');
  assert.ok(Array.isArray(res1.medicines), 'Result must contain medicines array');
  console.log('   ✅ Fallback delay satisfies timing invariant.\n');

  // Test 2: Preset 1 Content & Zero Warnings Verification
  console.log('👉 [Test 2] Verifying Preset 1 (Hypertension + Diabetes) zero conflicts...');
  assert.equal(res1.warnings.length, 0, 'Preset 1 must contain exactly 0 warnings');
  assert.equal(res1.medicines.length, 3, 'Preset 1 must contain 3 medicines');
  assert.ok(res1.doctorName?.includes('Trần Văn Minh'), 'Doctor name must match Preset 1');
  assert.ok(res1.diagnosis?.includes('Tăng huyết áp'), 'Diagnosis must match Preset 1');

  // Check medicine timeSlots
  const amlodipine = res1.medicines.find((m) => m.name.includes('Amlodipine'));
  assert.ok(amlodipine, 'Preset 1 must include Amlodipine');
  assert(amlodipine);
  assert.ok(amlodipine.timeSlots.includes('morning'), 'Amlodipine must be assigned to morning');

  const metformin = res1.medicines.find((m) => m.name.includes('Metformin'));
  assert.ok(metformin, 'Preset 1 must include Metformin');
  assert(metformin);
  assert.ok(metformin.timeSlots.includes('morning') && metformin.timeSlots.includes('noon'), 'Metformin must be in morning and noon');

  const atorvastatin = res1.medicines.find((m) => m.name.includes('Atorvastatin'));
  assert.ok(atorvastatin, 'Preset 1 must include Atorvastatin');
  assert(atorvastatin);
  assert.ok(atorvastatin.timeSlots.includes('evening'), 'Atorvastatin must be in evening');
  console.log('   ✅ Preset 1 data and zero warnings verified.\n');

  // Test 3: Preset 2 Dual-Layer Conflict Warnings Verification
  console.log('👉 [Test 3] Verifying Preset 2 Dual-Layer Interaction Warnings...');
  const startTimer2 = Date.now();
  const res2 = await analyzePrescription(undefined, undefined, 'preset2');
  const elapsedMs2 = Date.now() - startTimer2;
  console.log(`   ⏱️ Preset 2 elapsed time: ${elapsedMs2}ms`);
  assert(elapsedMs2 >= 1100, `Preset 2 fallback delay must also be >= 1100ms (got ${elapsedMs2}ms)`);
  assert.equal(res2.medicines.length, 2, 'Preset 2 must contain 2 medicines');
  assert.equal(res2.warnings.length, 2, 'Preset 2 must contain exactly 2 warnings (Dual-Layer)');

  // Layer 1: Intra-prescription conflict (Ciprofloxacin + Gaviscon)
  const layer1 = res2.warnings.find((w) => w.source === 'internal_prescription');
  assert.ok(layer1, 'Layer 1 internal_prescription warning must be present');
  assert(layer1);
  assert.equal(layer1.severity, 'high', 'Layer 1 chelation conflict must have high severity');
  assert.ok(layer1.medicineA.includes('Ciprofloxacin') && layer1.medicineB.includes('Gaviscon'), 'Layer 1 must identify Ciprofloxacin and Gaviscon');
  assert.ok(layer1.description.toLowerCase().includes('chelate'), 'Layer 1 must describe chelate binding interaction');
  assert.ok(layer1.clinicalRecommendation.length > 0, 'Layer 1 must include clinical recommendation');

  // Layer 2: Cross-cabinet conflict (Gaviscon + Cabinet Aspirin)
  const layer2 = res2.warnings.find((w) => w.source === 'cabinet_conflict');
  assert.ok(layer2, 'Layer 2 cabinet_conflict warning must be present');
  assert(layer2);
  assert.equal(layer2.severity, 'moderate', 'Layer 2 enteric dissolution conflict must have moderate severity');
  assert.ok(layer2.medicineA.includes('Gaviscon') && layer2.medicineB.includes('Aspirin'), 'Layer 2 must identify Gaviscon and Aspirin');
  assert.ok(
    layer2.description.toLowerCase().includes('aspirin') || layer2.description.toLowerCase().includes('ruột'),
    'Layer 2 must explain enteric coat dissolution mechanism'
  );
  assert.ok(layer2.clinicalRecommendation.length > 0, 'Layer 2 must include clinical recommendation');
  console.log('   ✅ Preset 2 dual-layer warnings (internal + cabinet) verified.\n');

  // Test 4: Image Hint Fallback Detection
  console.log('👉 [Test 4] Verifying image hint fallback detection...');
  const resHintCipro = await analyzePrescription('data:image/jpeg;base64,sample_ciprofloxacin_and_gaviscon_photo');
  assert.equal(resHintCipro.warnings.length, 2, 'Image containing ciprofloxacin/gaviscon keywords must return Preset 2');

  const resGeneric = await analyzePrescription('data:image/jpeg;base64,normal_blood_pressure_prescription');
  assert.equal(resGeneric.warnings.length, 0, 'Generic image must default to Preset 1 (0 warnings)');
  console.log('   ✅ Image hint automatic selection verified.\n');

  // Test 5: Resilience & Zero Unhandled Rejections Under Extreme Failures
  console.log('👉 [Test 5] Verifying resilience under failure modes & missing arguments...');
  // 5.1 Call with no arguments
  const resNoArgs = await analyzePrescription();
  assert.ok(resNoArgs, 'Must resolve cleanly with no arguments');
  assert.equal(resNoArgs.warnings.length, 0, 'Default must be Preset 1');

  // 5.2 Call with empty objects and empty strings
  const resEmpty = await analyzePrescription('', []);
  assert.ok(resEmpty, 'Must resolve cleanly with empty string image');

  // 5.3 Call with corrupted Base64 and cabinet
  const resCorrupted = await analyzePrescription('invalid_base64_!@#$%^&*()', [
    {
      id: 'dummy',
      name: 'Dummy Med',
      activeIngredient: 'None',
      dosage: '1',
      mealTiming: 'after_meal',
      instructions: '',
      purpose: '',
      remainingCount: 1,
      expiryDate: '2027-01-01',
      category: 'Other',
    },
  ]);
  assert.ok(resCorrupted, 'Must resolve cleanly with corrupted Base64');

  // Verify zero unhandled rejections
  assert.equal(unhandledRejections.length, 0, 'Must have 0 unhandled promise rejections');
  assert.equal(uncaughtExceptions.length, 0, 'Must have 0 uncaught exceptions');
  console.log('   ✅ 100% resilient zero-crash fallback verified under failure modes.\n');

  // Test 6: Deep Clone Immutability
  console.log('👉 [Test 6] Verifying deep clone immutability...');
  const resMutate = await analyzePrescription(undefined, undefined, 'preset2');
  // Mutate the returned object
  resMutate.warnings.length = 0;
  resMutate.medicines.length = 0;

  // Next call must still have intact data
  const resFresh = await analyzePrescription(undefined, undefined, 'preset2');
  assert.equal(resFresh.warnings.length, 2, 'Original preset2 warnings must remain intact');
  assert.equal(resFresh.medicines.length, 2, 'Original preset2 medicines must remain intact');
  assert.equal(MOCK_ANALYSIS_PRESET_2.warnings.length, 2, 'MOCK_ANALYSIS_PRESET_2 must not be mutated');
  console.log('   ✅ Deep clone immutability verified.\n');

  // Test 7: Backwards Compatibility with askAI and FALLBACK_AI_RESULT
  console.log('👉 [Test 7] Verifying backwards compatibility for askAI and FALLBACK_AI_RESULT...');
  assert.ok(FALLBACK_AI_RESULT, 'FALLBACK_AI_RESULT must be exported');
  assert.ok(FALLBACK_AI_RESULT.title, 'FALLBACK_AI_RESULT must have title');
  assert.ok(Array.isArray(FALLBACK_AI_RESULT.keyPoints), 'FALLBACK_AI_RESULT must have keyPoints');

  const askRes = await askAI('Test prompt for health query');
  assert.ok(askRes, 'askAI must return a result');
  assert.ok(askRes.title, 'askAI result must have title');
  console.log('   ✅ askAI and FALLBACK_AI_RESULT backwards compatibility verified.\n');

  console.log('=====================================================');
  console.log('🎉 ALL 7 AI & DUAL-LAYER TESTS PASSED SUCCESSFULLY!');
  console.log('=====================================================');
}

runAIVerification().catch((err) => {
  console.error('❌ Verification failed with error:', err);
  process.exit(1);
});
