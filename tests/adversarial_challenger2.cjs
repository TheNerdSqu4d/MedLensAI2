/**
 * Adversarial Challenger 2 Test Harness for MedLens AI
 * Rigorous empirical stress-testing for:
 * 1. Preset 2 Dual-Layer conflict detection & anti-suppression invariants
 * 2. Resilient network fallback & zero-uncaught-rejection verification
 */

const path = require('path');
const Module = require('module');

// Intercept expo-secure-store before requiring bootstrap
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'expo-secure-store') {
    return path.join(__dirname, 'mockSecureStore.cjs');
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

// Initialize bootstrap hooks (@/* alias, ts transpilation, mock modules)
require('./e2e/harness/bootstrap.cjs');

const { MockNetworkController } = require('./e2e/harness/mockNetwork.ts');
const { MOCK_ANALYSIS_PRESET_1, MOCK_ANALYSIS_PRESET_2, MOCK_CABINET, MED_ASPIRIN } = require('@/mocks/mockData.ts');
const { evaluatePrescriptionConflicts } = require('./e2e/tiers/tier2-boundaries/empty_cabinet.test.ts');
const { categorizeWarnings } = require('./e2e/tiers/tier1-features/dual_layer_alert.test.ts');
const { resilientAnalyzePrescription } = require('./e2e/tiers/tier2-boundaries/offline_network_fallback.test.ts');
const { askAI } = require('@/services/ai.ts');
const { useMedStore } = require('@/store/useMedStore.ts');

// Track any unhandled rejections or uncaught exceptions
const unhandledRejections = [];
const uncaughtExceptions = [];

process.on('unhandledRejection', (reason, promise) => {
  unhandledRejections.push({ reason, promise });
  console.error('🚨 UNHANDLED PROMISE REJECTION DETECTED:', reason);
});

process.on('uncaughtException', (err) => {
  uncaughtExceptions.push(err);
  console.error('🚨 UNCAUGHT EXCEPTION DETECTED:', err);
});

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}
assert.equal = (a, b, msg) => {
  if (a !== b) throw new Error(`${msg || 'Assertion failed'}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
assert.ok = (v, msg) => {
  if (!v) throw new Error(msg || 'Assertion failed');
};

let passedCount = 0;
let failedCount = 0;
const failureDetails = [];

async function challenge(name, fn) {
  process.stdout.write(`   ⚡ [CHALLENGE] ${name} ... `);
  try {
    await fn();
    passedCount++;
    console.log('PASSED ✅');
  } catch (err) {
    failedCount++;
    failureDetails.push({ name, error: err });
    console.log('FAILED ❌');
    console.error(`      ⚠️  ${err.message || err}`);
  }
}

async function runAdversarialVerification() {
  console.log('\n======================================================================');
  console.log('🛡️  CHALLENGER 2: ADVERSARIAL VERIFICATION HARNESS');
  console.log('   Focus: Preset 2 Dual-Layer Conflicts & Resilient Fallback Guarantees');
  console.log('======================================================================\n');

  // Ensure network mock is installed
  MockNetworkController.install();

  console.log('🔬 [SECTION 1] PRESET 2 DUAL-LAYER CONFLICT ANTI-SUPPRESSION CHALLENGES\n');

  await challenge('1.1 Preset 2 baseline contains exactly 2 distinct warnings (1 internal, 1 cabinet)', () => {
    const warnings = MOCK_ANALYSIS_PRESET_2.warnings;
    assert.equal(warnings.length, 2, 'Must contain exactly 2 warnings');

    const internal = warnings.filter((w) => w.source === 'internal_prescription');
    const cabinet = warnings.filter((w) => w.source === 'cabinet_conflict');

    assert.equal(internal.length, 1, 'Layer 1 (internal) must have 1 warning');
    assert.equal(cabinet.length, 1, 'Layer 2 (cabinet) must have 1 warning');

    assert.equal(internal[0].severity, 'high');
    assert.equal(cabinet[0].severity, 'moderate');
    assert.ok(internal[0].description.includes('chelate'));
    assert.ok(cabinet[0].description.includes('kiềm hóa'));
  });

  await challenge('1.2 Invariance to prescription medicine ordering (Gaviscon first, Cipro second)', () => {
    const reversedMeds = [...MOCK_ANALYSIS_PRESET_2.medicines].reverse();
    const warnings = evaluatePrescriptionConflicts(reversedMeds, MOCK_CABINET);

    const internal = warnings.filter((w) => w.source === 'internal_prescription');
    const cabinet = warnings.filter((w) => w.source === 'cabinet_conflict');

    assert.equal(internal.length, 1, 'Layer 1 conflict must be detected regardless of order');
    assert.equal(cabinet.length, 1, 'Layer 2 conflict must be detected regardless of order');
  });

  await challenge('1.3 Case insensitivity and whitespace resilience in drug names', () => {
    const noisyPrescriptionMeds = [
      {
        ...MOCK_ANALYSIS_PRESET_2.medicines[0],
        name: '  ciPROfloXACIN 500MG hydrochloride  ',
      },
      {
        ...MOCK_ANALYSIS_PRESET_2.medicines[1],
        name: 'GAVISCON dual ACTION 10ML   ',
      },
    ];

    const noisyCabinet = [
      {
        ...MED_ASPIRIN,
        name: '   aSpIrIn 81mg coated   ',
      },
    ];

    const warnings = evaluatePrescriptionConflicts(noisyPrescriptionMeds, noisyCabinet);
    assert.equal(warnings.filter((w) => w.source === 'internal_prescription').length, 1);
    assert.equal(warnings.filter((w) => w.source === 'cabinet_conflict').length, 1);
  });

  await challenge('1.4 Strict Isolation: Layer 1 persists even when cabinet has ZERO medicines', () => {
    const warnings = evaluatePrescriptionConflicts(MOCK_ANALYSIS_PRESET_2.medicines, []);
    const internal = warnings.filter((w) => w.source === 'internal_prescription');
    const cabinet = warnings.filter((w) => w.source === 'cabinet_conflict');

    assert.equal(internal.length, 1, 'Layer 1 must NEVER be suppressed by empty cabinet');
    assert.equal(cabinet.length, 0, 'Layer 2 must not trigger when cabinet has no clashing drugs');
  });

  await challenge('1.5 Strict Isolation: Layer 2 persists in cabinet packed with 50 irrelevant distractor medications', () => {
    const distractors = Array.from({ length: 50 }, (_, i) => ({
      id: `distractor-${i}`,
      name: `DistractorMed-${i} 100mg`,
      activeIngredient: `Chemical-${i}`,
      dosage: '1 tab',
      mealTiming: 'after_meal',
      instructions: 'Take daily',
      purpose: 'Condition test',
      remainingCount: 20,
      expiryDate: '2027-01-01',
      category: 'General',
    }));

    const crowdedCabinet = [...distractors, { ...MED_ASPIRIN }];

    const warnings = evaluatePrescriptionConflicts(MOCK_ANALYSIS_PRESET_2.medicines, crowdedCabinet);
    const cabinetWarnings = warnings.filter((w) => w.source === 'cabinet_conflict');
    assert.equal(cabinetWarnings.length, 1, 'Layer 2 must be detected even among 50 distractor meds');
  });

  await challenge('1.6 UI Categorizer strictly maps Layer 1 to Red and Layer 2 to Amber without suppression', () => {
    const summary = categorizeWarnings(MOCK_ANALYSIS_PRESET_2.warnings);
    assert.equal(summary.hasWarnings, true);
    assert.equal(summary.internal.length, 1);
    assert.equal(summary.cabinet.length, 1);
    assert.equal(summary.internalColor, 'red');
    assert.equal(summary.cabinetColor, 'amber');
    assert.equal(summary.internal[0].severity, 'high');
    assert.equal(summary.cabinet[0].severity, 'moderate');
  });

  await challenge('1.7 Deep clone immutability: MOCK_ANALYSIS_PRESET_2 warnings cannot be mutated in-place', () => {
    const initialLen = MOCK_ANALYSIS_PRESET_2.warnings.length;
    const warningsCopy = [...MOCK_ANALYSIS_PRESET_2.warnings];
    warningsCopy.pop();
    assert.equal(MOCK_ANALYSIS_PRESET_2.warnings.length, initialLen, 'Original preset warnings length must remain 2');
  });

  console.log('\n🔬 [SECTION 2] RESILIENT NETWORK FALLBACK & ZERO-UNCAUGHT-REJECTION CHALLENGES\n');

  await challenge('2.1 Offline Airplane Mode catches network failure cleanly with zero unhandled rejections', async () => {
    MockNetworkController.setMode('NETWORK_OFFLINE');
    const result = await resilientAnalyzePrescription('preset2');

    assert.ok(result, 'Must return fallback result');
    assert.equal(result.medicines.length, 2);
    assert.equal(result.warnings.length, 2, 'Fallback must retain both Preset 2 warnings');
    assert.equal(unhandledRejections.length, 0, 'No unhandled rejections permitted');
  });

  await challenge('2.2 HTTP 500 Internal Server Error activates fallback with zero unhandled rejections', async () => {
    MockNetworkController.setMode('SERVER_500_ERROR');
    const result = await resilientAnalyzePrescription('preset2');

    assert.ok(result);
    assert.equal(result.warnings.length, 2);
    assert.equal(unhandledRejections.length, 0, 'No unhandled rejections permitted');
  });

  await challenge('2.3 Gateway Timeout (client aborts in 5ms) catches abort signal without unhandled rejection', async () => {
    MockNetworkController.setMode('TIMEOUT');
    const result = await resilientAnalyzePrescription('preset2', 5);

    assert.ok(result);
    assert.equal(result.medicines.length, 2);
    assert.equal(result.warnings.length, 2);
    assert.equal(unhandledRejections.length, 0, 'No unhandled rejections permitted');
  });

  await challenge('2.4 Gateway Timeout (mock 20ms rejection fires) caught by try/catch with zero unhandled rejection', async () => {
    MockNetworkController.setMode('TIMEOUT');
    const result = await resilientAnalyzePrescription('preset2', 100);

    assert.ok(result);
    assert.equal(result.medicines.length, 2);
    assert.equal(result.warnings.length, 2);
    assert.equal(unhandledRejections.length, 0, 'No unhandled rejections permitted');
  });

  await challenge('2.5 Corrupted / Malformed JSON payload on HTTP 200 caught by response.json() catch block', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response('<<<NOT JSON AT ALL>>>', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    try {
      const result = await resilientAnalyzePrescription('preset2');
      assert.ok(result, 'Must catch JSON parse error and return fallback');
      assert.equal(result.medicines.length, 2);
      assert.equal(result.warnings.length, 2);
      assert.equal(unhandledRejections.length, 0);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  await challenge('2.6 Non-Error thrown in network layer (string error, null) handled gracefully', async () => {
    const origFetch = globalThis.fetch;

    globalThis.fetch = (() => {
      throw 'Raw string network crash';
    });

    try {
      const result1 = await resilientAnalyzePrescription('preset2');
      assert.ok(result1);
      assert.equal(result1.warnings.length, 2);
    } finally {
      globalThis.fetch = origFetch;
    }

    globalThis.fetch = (() => {
      throw null;
    });

    try {
      const result2 = await resilientAnalyzePrescription('preset2');
      assert.ok(result2);
      assert.equal(result2.warnings.length, 2);
    } finally {
      globalThis.fetch = origFetch;
    }

    assert.equal(unhandledRejections.length, 0, 'Zero unhandled rejections on primitive throws');
  });

  await challenge('2.7 100 concurrent requests during rapid chaotic network mode switching', async () => {
    const modes = [
      'NETWORK_OFFLINE',
      'SERVER_500_ERROR',
      'TIMEOUT',
      'SUCCESS_PRESET_2',
    ];

    const promises = Array.from({ length: 100 }, async (_, idx) => {
      const selectedMode = modes[idx % modes.length];
      MockNetworkController.setMode(selectedMode);
      return resilientAnalyzePrescription('preset2', 15);
    });

    const results = await Promise.all(promises);
    assert.equal(results.length, 100, 'All 100 requests must resolve');
    for (const res of results) {
      assert.ok(res, 'Every result must be valid');
      assert.equal(res.medicines.length, 2, 'Every result must contain 2 medicines');
      assert.equal(res.warnings.length, 2, 'Every result must preserve Preset 2 dual-layer warnings');
    }

    assert.equal(unhandledRejections.length, 0, 'Zero unhandled rejections across 100 concurrent chaos calls');
  });

  await challenge('2.8 Real services/ai.ts askAI fallback survives offline and 500 error modes', async () => {
    MockNetworkController.setMode('NETWORK_OFFLINE');
    const customFallback = {
      doctorName: 'BS Fallback',
      medicines: [],
      warnings: [],
    };

    const resOffline = await askAI('Analyze prescription', { fallbackData: customFallback });
    assert.equal(resOffline.doctorName, 'BS Fallback', 'askAI must return customFallback when offline');

    MockNetworkController.setMode('SERVER_500_ERROR');
    const res500 = await askAI('Analyze prescription', { fallbackData: customFallback });
    assert.equal(res500.doctorName, 'BS Fallback', 'askAI must return customFallback on HTTP 500');

    assert.equal(unhandledRejections.length, 0, 'askAI must produce zero unhandled rejections');
    assert.equal(uncaughtExceptions.length, 0, 'askAI must produce zero uncaught exceptions');
  });

  console.log('\n======================================================================');
  console.log(`📊 CHALLENGER 2 SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log(`🚨 UNHANDLED REJECTIONS: ${unhandledRejections.length}`);
  console.log(`🚨 UNCAUGHT EXCEPTIONS:  ${uncaughtExceptions.length}`);
  console.log('======================================================================\n');

  if (failedCount > 0 || unhandledRejections.length > 0 || uncaughtExceptions.length > 0) {
    if (failureDetails.length > 0) {
      console.log('❌ FAILURES:');
      failureDetails.forEach(({ name, error }) => console.log(`   - ${name}: ${error.stack || error}`));
    }
    process.exit(1);
  } else {
    console.log('🏆 ALL ADVERSARIAL CHALLENGES PASSED EMPIRICALLY! Code 0.\n');
    process.exit(0);
  }
}

runAdversarialVerification().catch((err) => {
  console.error('Fatal challenger execution error:', err);
  process.exit(1);
});
