/**
 * MedLens AI - Milestone 2 Empirical Adversarial Challenger Test Harness
 * Author: Challenger 2 (Empirical Critic & Specialist)
 *
 * Verifies:
 * 1. Timeout resilience: simulated slow server responses (>8s timeout guard) and fallback trigger
 * 2. Dual-layer schema integrity: exact structure of InteractionWarning & PrescriptionAnalysisResult
 * 3. Intra-prescription chelation warning: source === 'internal_prescription' (Ciprofloxacin + Gaviscon)
 * 4. Cabinet cross-conflict warning: source === 'cabinet_conflict' (Gaviscon + Aspirin)
 * 5. Zero warnings for Preset 1 (Hypertension + Diabetes)
 * 6. Zero crashes under simulated abrupt socket hang-ups, DNS errors, EPIPE, HTTP 502/500
 * 7. Concurrency stress and deep immutability
 * 8. Edge Function prompt and schema normalization invariants
 */

import fs from 'node:fs';
import path from 'node:path';

// Track unhandled rejections and uncaught exceptions
const unhandledRejections = [];
const uncaughtExceptions = [];

process.on('unhandledRejection', (reason, promise) => {
  unhandledRejections.push({ reason, promise });
  console.error('🚨 UNHANDLED REJECTION DETECTED:', reason);
});

process.on('uncaughtException', (err) => {
  uncaughtExceptions.push(err);
  console.error('🚨 UNCAUGHT EXCEPTION DETECTED:', err);
});

// Assertion helpers
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

assert.ok = function (value, message) {
  if (!value) {
    throw new Error(message || 'Assertion failed: value is not truthy');
  }
};

let passedCount = 0;
let failedCount = 0;

async function runTest(testName, fn) {
  process.stdout.write(`👉 [RUNNING] ${testName}... `);
  try {
    await fn();
    console.log(`✅ PASSED`);
    passedCount++;
  } catch (err) {
    console.log(`❌ FAILED`);
    console.error(`   Error: ${err.message}`);
    failedCount++;
  }
}

async function main() {
  console.log('======================================================================');
  console.log('⚔️  MEDLENS AI — ADVERSARIAL CHALLENGER 2 TEST HARNESS (MILESTONE 2)');
  console.log('======================================================================\n');

  const { analyzePrescription, askAI, FALLBACK_AI_RESULT } = await import('@/services/ai');
  const { supabase } = await import('@/services/supabase');
  const {
    MOCK_ANALYSIS_PRESET_1,
    MOCK_ANALYSIS_PRESET_2,
    MOCK_CABINET,
    MED_ASPIRIN,
    MED_AMLODIPINE,
  } = await import('@/mocks/mockData');

  const functionsProto = Object.getPrototypeOf(supabase.functions);
  const originalInvoke = functionsProto.invoke;

  function mockInvoke(fn) {
    functionsProto.invoke = fn;
  }

  function restoreInvoke() {
    functionsProto.invoke = originalInvoke;
  }

  // -------------------------------------------------------------------------
  // SUITE 1: TIMEOUT RESILIENCE & 8-SECOND GUARD
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 1: TIMEOUT RESILIENCE & >8S TIMEOUT GUARD ---');

  await runTest('1.1 Simulated slow server (>8s) triggers 8s timeout guard and 1.2s fallback without hanging', async () => {
    // Monkey patch supabase.functions.invoke to hang for 8500ms
    mockInvoke(async () => {
      await new Promise((resolve) => setTimeout(resolve, 8500));
      return { data: { medicines: [], warnings: [] }, error: null };
    });

    const startTime = Date.now();
    const result = await analyzePrescription('data:image/jpeg;base64,slow_prescription_image');
    const elapsed = Date.now() - startTime;

    // Timeout guard is 8000ms + fallback delay is 1200ms = ~9200ms
    // Allow slight jitter: 9000ms <= elapsed <= 11000ms
    console.log(`(elapsed: ${elapsed}ms) `);
    assert(elapsed >= 9000, `Expected elapsed >= 9000ms for 8s guard + 1.2s delay, got ${elapsed}ms`);
    assert(elapsed <= 11000, `Expected elapsed <= 11000ms, got ${elapsed}ms`);
    assert.ok(result, 'Must return fallback result after timeout');
    assert.ok(Array.isArray(result.medicines), 'Fallback must contain medicines array');
    assert.equal(result.medicines.length, 3, 'Default fallback must be Preset 1 with 3 medicines');
    restoreInvoke();
  });

  await runTest('1.2 Fast server response (<500ms) bypasses fallback and returns immediately', async () => {
    // Fast mock response
    mockInvoke(async () => {
      return {
        data: {
          doctorName: 'BS. Test Fast',
          diagnosis: 'Test Fast Diagnosis',
          medicines: [
            {
              id: 'med-fast-1',
              name: 'Fast Med 10mg',
              activeIngredient: 'Fastium',
              dosage: '1 tab',
              mealTiming: 'after_meal',
              instructions: 'Take fast',
              purpose: 'Speed',
              remainingCount: 10,
              expiryDate: '2026-12-31',
              category: 'Other',
              timeSlots: ['morning'],
            },
          ],
          warnings: [],
        },
        error: null,
      };
    });

    const startTime = Date.now();
    const result = await analyzePrescription('data:image/jpeg;base64,valid_fast_call');
    const elapsed = Date.now() - startTime;
    console.log(`(elapsed: ${elapsed}ms) `);
    assert(elapsed < 1000, `Fast response must return < 1000ms without 1.2s delay (got ${elapsed}ms)`);
    assert.equal(result.doctorName, 'BS. Test Fast');
    assert.equal(result.medicines[0].name, 'Fast Med 10mg');
    restoreInvoke();
  });

  // Restore original invoke for subsequent tests
  restoreInvoke();

  // -------------------------------------------------------------------------
  // SUITE 2: DUAL-LAYER SCHEMA INTEGRITY
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 2: DUAL-LAYER SCHEMA INTEGRITY ---');

  await runTest('2.1 InteractionWarning schema completeness on Preset 2', async () => {
    const res = await analyzePrescription(undefined, undefined, 'preset2');
    assert.ok(Array.isArray(res.warnings), 'warnings must be an array');
    assert.equal(res.warnings.length, 2, 'Preset 2 must have exactly 2 warnings');

    const validSources = ['internal_prescription', 'cabinet_conflict'];
    const validSeverities = ['low', 'moderate', 'high', 'critical'];

    for (const w of res.warnings) {
      assert.ok(typeof w.id === 'string' && w.id.length > 0, `Warning id must be non-empty string, got ${w.id}`);
      assert.ok(validSources.includes(w.source), `Warning source must be in ${validSources}, got ${w.source}`);
      assert.ok(typeof w.medicineA === 'string' && w.medicineA.length > 0, 'medicineA must be non-empty string');
      assert.ok(typeof w.medicineB === 'string' && w.medicineB.length > 0, 'medicineB must be non-empty string');
      assert.ok(validSeverities.includes(w.severity), `Warning severity must be in ${validSeverities}, got ${w.severity}`);
      assert.ok(typeof w.description === 'string' && w.description.length > 10, 'description must be comprehensive');
      assert.ok(typeof w.clinicalRecommendation === 'string' && w.clinicalRecommendation.length > 10, 'clinicalRecommendation must be actionable');
    }
  });

  await runTest('2.2 PrescriptionAnalysisResult medicine schema completeness', async () => {
    const res = await analyzePrescription(undefined, undefined, 'preset2');
    const validMealTimings = ['before_meal', 'after_meal', 'with_meal'];
    const validSlots = ['morning', 'noon', 'evening'];

    for (const m of res.medicines) {
      assert.ok(typeof m.id === 'string' && m.id.length > 0, 'id must be non-empty');
      assert.ok(typeof m.name === 'string' && m.name.length > 0, 'name must be non-empty');
      assert.ok(typeof m.activeIngredient === 'string' && m.activeIngredient.length > 0, 'activeIngredient must be non-empty');
      assert.ok(typeof m.dosage === 'string' && m.dosage.length > 0, 'dosage must be non-empty');
      assert.ok(validMealTimings.includes(m.mealTiming), `mealTiming must be valid, got ${m.mealTiming}`);
      assert.ok(typeof m.instructions === 'string', 'instructions must be string');
      assert.ok(typeof m.purpose === 'string', 'purpose must be string');
      assert.ok(typeof m.remainingCount === 'number' && m.remainingCount >= 0, 'remainingCount must be non-negative number');
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(m.expiryDate), `expiryDate must be YYYY-MM-DD, got ${m.expiryDate}`);
      assert.ok(typeof m.category === 'string', 'category must be string');
      assert.ok(Array.isArray(m.timeSlots) && m.timeSlots.length > 0, 'timeSlots must be non-empty array');
      for (const slot of m.timeSlots) {
        assert.ok(validSlots.includes(slot), `slot must be in ${validSlots}, got ${slot}`);
      }
    }
  });

  // -------------------------------------------------------------------------
  // SUITE 3: INTRA-PRESCRIPTION CHELATION WARNING (LAYER 1)
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 3: INTRA-PRESCRIPTION CHELATION WARNING (LAYER 1) ---');

  await runTest('3.1 Ciprofloxacin + Gaviscon intra-prescription chelation detection', async () => {
    const res = await analyzePrescription(undefined, undefined, 'preset2');
    const internalWarnings = res.warnings.filter((w) => w.source === 'internal_prescription');
    assert.equal(internalWarnings.length, 1, 'Must have exactly 1 internal prescription warning');

    const warning = internalWarnings[0];
    assert.equal(warning.source, 'internal_prescription');
    const names = [warning.medicineA.toLowerCase(), warning.medicineB.toLowerCase()];
    assert.ok(names.some((n) => n.includes('ciprofloxacin')), 'Must mention Ciprofloxacin');
    assert.ok(names.some((n) => n.includes('gaviscon')), 'Must mention Gaviscon');
    assert.equal(warning.severity, 'high', 'Severity must be high for antibiotic chelation');
    assert.ok(warning.description.toLowerCase().includes('chelate'), 'Must explain chelate complexation mechanism');
    assert.ok(
      warning.clinicalRecommendation.includes('2') || warning.clinicalRecommendation.includes('4'),
      'Recommendation must specify hour spacing (2-4 hours)'
    );
  });

  // -------------------------------------------------------------------------
  // SUITE 4: CABINET CROSS-CONFLICT WARNING (LAYER 2)
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 4: CABINET CROSS-CONFLICT WARNING (LAYER 2) ---');

  await runTest('4.1 Gaviscon + Aspirin cabinet cross-conflict detection', async () => {
    const res = await analyzePrescription(undefined, undefined, 'preset2');
    const cabinetWarnings = res.warnings.filter((w) => w.source === 'cabinet_conflict');
    assert.equal(cabinetWarnings.length, 1, 'Must have exactly 1 cabinet conflict warning');

    const warning = cabinetWarnings[0];
    assert.equal(warning.source, 'cabinet_conflict');
    const names = [warning.medicineA.toLowerCase(), warning.medicineB.toLowerCase()];
    assert.ok(names.some((n) => n.includes('gaviscon')), 'Must mention Gaviscon');
    assert.ok(names.some((n) => n.includes('aspirin')), 'Must mention Aspirin');
    assert.equal(warning.severity, 'moderate', 'Severity must be moderate for enteric dissolution');
    assert.ok(
      warning.description.toLowerCase().includes('aspirin') ||
      warning.description.toLowerCase().includes('ruột') ||
      warning.description.toLowerCase().includes('dạ dày'),
      'Must explain enteric coat premature dissolution or stomach irritation'
    );
    assert.ok(warning.clinicalRecommendation.length > 10, 'Recommendation must be clear');
  });

  // -------------------------------------------------------------------------
  // SUITE 5: ZERO WARNINGS FOR PRESET 1 (HYPERTENSION + DIABETES)
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 5: ZERO WARNINGS FOR PRESET 1 ---');

  await runTest('5.1 Preset 1 routine prescription contains exactly zero warnings', async () => {
    const res = await analyzePrescription(undefined, undefined, 'preset1');
    assert.equal(res.warnings.length, 0, 'Preset 1 must contain 0 warnings');
    assert.equal(res.medicines.length, 3, 'Preset 1 must have 3 medicines');
    const medNames = res.medicines.map((m) => m.name);
    assert.ok(medNames.some((n) => n.includes('Amlodipine')), 'Contains Amlodipine');
    assert.ok(medNames.some((n) => n.includes('Metformin')), 'Contains Metformin');
    assert.ok(medNames.some((n) => n.includes('Atorvastatin')), 'Contains Atorvastatin');
  });

  // -------------------------------------------------------------------------
  // SUITE 6: SIMULATED SOCKET HANG-UPS, DNS ERRORS & ABRUPT NETWORK FAILURES
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 6: SIMULATED NETWORK FAILURES & ZERO CRASHES ---');

  await runTest('6.1 Abrupt socket hang-up (ECONNRESET) triggers fallback with zero crash', async () => {
    mockInvoke(async () => {
      throw new TypeError('fetch failed: socket hang up (ECONNRESET)');
    });
    const res = await analyzePrescription('data:image/jpeg;base64,test_socket_hangups');
    assert.ok(res, 'Must return fallback without throwing');
    assert.equal(res.medicines.length, 3);
    restoreInvoke();
  });

  await runTest('6.2 DNS failure (getaddrinfo ENOTFOUND) triggers fallback with zero crash', async () => {
    mockInvoke(async () => {
      const err = new Error('getaddrinfo ENOTFOUND xyz.supabase.co');
      err.code = 'ENOTFOUND';
      throw err;
    });
    const res = await analyzePrescription('data:image/jpeg;base64,test_dns_failure');
    assert.ok(res, 'Must return fallback without throwing');
    assert.equal(res.medicines.length, 3);
    restoreInvoke();
  });

  await runTest('6.3 Broken pipe (EPIPE) triggers fallback with zero crash', async () => {
    mockInvoke(async () => {
      const err = new Error('write EPIPE');
      err.code = 'EPIPE';
      throw err;
    });
    const res = await analyzePrescription('data:image/jpeg;base64,test_epipe');
    assert.ok(res, 'Must return fallback without throwing');
    restoreInvoke();
  });

  await runTest('6.4 HTTP 500 Internal Server Error response handled cleanly', async () => {
    mockInvoke(async () => {
      return {
        data: null,
        error: { message: 'Internal Server Error', status: 500 },
      };
    });
    const res = await analyzePrescription('data:image/jpeg;base64,test_500');
    assert.ok(res, 'Must return fallback on 500 error');
    assert.equal(res.medicines.length, 3);
    restoreInvoke();
  });

  await runTest('6.5 HTTP 502 Bad Gateway / Cloudflare error handled cleanly', async () => {
    mockInvoke(async () => {
      return {
        data: null,
        error: { message: '502 Bad Gateway: Edge Function Crash', status: 502 },
      };
    });
    const res = await analyzePrescription('data:image/jpeg;base64,test_502');
    assert.ok(res, 'Must return fallback on 502 error');
    restoreInvoke();
  });

  await runTest('6.6 Malformed AI response (data is string instead of object) handled cleanly', async () => {
    mockInvoke(async () => {
      return {
        data: "Just a string from LLM that forgot JSON",
        error: null,
      };
    });
    const res = await analyzePrescription('data:image/jpeg;base64,test_string_response');
    assert.ok(res, 'Must return fallback when data is string');
    assert.equal(res.medicines.length, 3);
    restoreInvoke();
  });

  await runTest('6.7 Malformed AI response (medicines is not an array) handled cleanly', async () => {
    mockInvoke(async () => {
      return {
        data: { medicines: "not-an-array", warnings: [] },
        error: null,
      };
    });
    const res = await analyzePrescription('data:image/jpeg;base64,test_corrupt_medicines');
    assert.ok(res, 'Must return fallback when medicines is not array');
    assert.equal(res.medicines.length, 3);
    restoreInvoke();
  });

  await runTest('6.8 askAI catches socket hang-up and returns offline fallback', async () => {
    mockInvoke(async () => {
      throw new Error('fetch failed: socket hang up');
    });
    const askRes = await askAI('Emergency medical prompt');
    assert.ok(askRes, 'askAI must return fallback');
    assert.ok(askRes.title.includes('Dự phòng'), 'Must designate fallback in title');
    restoreInvoke();
  });

  // Restore original invoke
  restoreInvoke();

  // -------------------------------------------------------------------------
  // SUITE 7: CONCURRENCY STRESS & IMMUTABILITY
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 7: CONCURRENCY STRESS & IMMUTABILITY ---');

  await runTest('7.1 Concurrency stress: 15 simultaneous requests resolve cleanly without cross-pollution', async () => {
    const promises = [];
    for (let i = 0; i < 15; i++) {
      const choice = i % 2 === 0 ? 'preset1' : 'preset2';
      promises.push(analyzePrescription(undefined, undefined, choice));
    }
    const results = await Promise.all(promises);
    assert.equal(results.length, 15, 'All 15 parallel requests must resolve');
    for (let i = 0; i < 15; i++) {
      const expectedWarnings = i % 2 === 0 ? 0 : 2;
      assert.equal(
        results[i].warnings.length,
        expectedWarnings,
        `Request ${i} expected ${expectedWarnings} warnings, got ${results[i].warnings.length}`
      );
    }
  });

  await runTest('7.2 In-memory mutation defense: modifying returned analysis results does not corrupt mock presets', async () => {
    const res = await analyzePrescription(undefined, undefined, 'preset2');
    // Nuke the result
    res.medicines.pop();
    res.warnings.pop();
    res.diagnosis = 'HACKED';

    const fresh = await analyzePrescription(undefined, undefined, 'preset2');
    assert.equal(fresh.medicines.length, 2, 'fresh medicines must remain 2');
    assert.equal(fresh.warnings.length, 2, 'fresh warnings must remain 2');
    assert.equal(fresh.diagnosis, 'Viêm dạ dày cấp kèm nhiễm khuẩn tiêu hóa', 'diagnosis must remain unpolluted');
  });

  await runTest('7.3 Keyword detection in base64 payload routes to Preset 2 properly', async () => {
    const testCases = [
      'data:image/jpeg;base64,contains_Ciprofloxacin_sample',
      'data:image/jpeg;base64,GAVISCON_label_detected',
      'data:image/jpeg;base64,scan_gastric_ulcer_treatment',
      'data:image/jpeg;base64,don_thuoc_khang-sinh_lieu_cao',
      'data:image/jpeg;base64,benh_an_viem-da-day',
    ];
    for (const img of testCases) {
      const res = await analyzePrescription(img);
      assert.equal(res.warnings.length, 2, `Expected Preset 2 for payload: ${img}`);
    }
  });

  // -------------------------------------------------------------------------
  // SUITE 8: EDGE FUNCTION STATIC CONTRACT INVARIANTS
  // -------------------------------------------------------------------------
  console.log('\n--- SUITE 8: EDGE FUNCTION CODE CONTRACT INVARIANTS ---');

  await runTest('8.1 supabase/functions/chat-ai/index.ts static contract check', async () => {
    const edgeFunctionPath = path.resolve(process.cwd(), 'supabase/functions/chat-ai/index.ts');
    assert.ok(fs.existsSync(edgeFunctionPath), 'Edge function file must exist');

    const content = fs.readFileSync(edgeFunctionPath, 'utf8');

    // Multimodal Vision support
    assert.ok(content.includes('imageBase64'), 'Must support imageBase64 parameter');
    assert.ok(content.includes('cabinetMedicines'), 'Must support cabinetMedicines context parameter');
    assert.ok(content.includes('inlineData'), 'Must support inlineData for multimodal Gemini vision');

    // Dual-Layer Safety Analysis requirements in prompt
    assert.ok(
      content.includes("source: 'internal_prescription'"),
      "Edge Function prompt must mandate source: 'internal_prescription' for Layer 1"
    );
    assert.ok(
      content.includes("source: 'cabinet_conflict'"),
      "Edge Function prompt must mandate source: 'cabinet_conflict' for Layer 2"
    );

    // Normalization & fallback checks
    assert.ok(content.includes('parsedData.medicines ='), 'Must sanitize/normalize parsed medicines');
    assert.ok(content.includes('parsedData.warnings ='), 'Must sanitize/normalize parsed warnings');
    assert.ok(content.includes("warn.source === 'cabinet_conflict'"), 'Must strictly enforce valid warning source');

    // Backwards compatibility
    assert.ok(content.includes('prompt'), 'Must support legacy prompt parameter');
    assert.ok(content.includes('systemPrompt'), 'Must support legacy systemPrompt parameter');
    assert.ok(content.includes('schemaPrompt'), 'Must support legacy schemaPrompt parameter');
  });

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log('📊 EMPIRICAL CHALLENGER 2 SUMMARY');
  console.log('======================================================================');
  console.log(`✅ PASSED: ${passedCount}`);
  console.log(`❌ FAILED: ${failedCount}`);
  console.log(`🚨 UNHANDLED REJECTIONS: ${unhandledRejections.length}`);
  console.log(`🚨 UNCAUGHT EXCEPTIONS:  ${uncaughtExceptions.length}`);

  if (unhandledRejections.length > 0) {
    console.error('Unhandled rejections:', unhandledRejections);
  }
  if (uncaughtExceptions.length > 0) {
    console.error('Uncaught exceptions:', uncaughtExceptions);
  }

  assert.equal(failedCount, 0, `There are ${failedCount} failing tests!`);
  assert.equal(unhandledRejections.length, 0, 'Unhandled promise rejections must be zero');
  assert.equal(uncaughtExceptions.length, 0, 'Uncaught exceptions must be zero');

  console.log('\n🏆 ALL CHALLENGER 2 ADVERSARIAL TESTS PASSED EMPIRICALLY!');
}

main().catch((err) => {
  console.error('\n💥 CHALLENGER 2 TEST HARNESS RUN FAILED:', err);
  process.exit(1);
});
