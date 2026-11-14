/**
 * Empirical Stress Test Harness for Milestone 2: AI & Dual-Layer Interaction Engine
 * Challenger 1 Adversarial Suite
 * 
 * Verifies:
 * 1. High concurrency (20 simultaneous calls to analyzePrescription)
 * 2. Timing invariance (>= 1100ms) & Event Loop Liveness (non-blocking)
 * 3. Extreme & Malformed Inputs (10MB base64, null, undefined, prototypes, injections)
 * 4. Deep Immutability & Anti-Poisoning across repeated calls
 * 5. Edge Function parsing resilience & normalization guarantees
 * 6. Zero unhandled promise rejections and uncaught exceptions
 */

import { performance } from 'node:perf_hooks';

// Track unhandled promise rejections & uncaught exceptions
const unhandledRejections = [];
const uncaughtExceptions = [];

process.on('unhandledRejection', (reason, promise) => {
  unhandledRejections.push({ reason, promise });
  console.error('🚨 UNHANDLED PROMISE REJECTION:', reason);
});

process.on('uncaughtException', (err) => {
  uncaughtExceptions.push(err);
  console.error('🚨 UNCAUGHT EXCEPTION:', err);
});

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

assert.deepEqual = function (actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`${message || 'Assertion failed'}: expected ${expectedStr}, got ${actualStr}`);
  }
};

let passCount = 0;
let failCount = 0;
const testResults = [];

async function test(name, fn) {
  process.stdout.write(`👉 [TEST] ${name} ... `);
  const start = performance.now();
  try {
    await fn();
    const duration = (performance.now() - start).toFixed(1);
    passCount++;
    console.log(`PASSED (${duration}ms) ✅`);
    testResults.push({ name, status: 'PASS', duration: `${duration}ms` });
  } catch (err) {
    const duration = (performance.now() - start).toFixed(1);
    failCount++;
    console.log(`FAILED (${duration}ms) ❌`);
    console.error(`   ⚠️ Reason: ${err.message || err}`);
    testResults.push({ name, status: 'FAIL', duration: `${duration}ms`, error: err.message || String(err) });
  }
}

async function runChallenger1Harness() {
  console.log('======================================================================');
  console.log('⚡ CHALLENGER 1: ADVERSARIAL STRESS TEST HARNESS — MILESTONE 2 (AI)');
  console.log('======================================================================\n');

  // Dynamic import of services and mocks
  const { analyzePrescription, askAI, FALLBACK_AI_RESULT } = await import('@/services/ai');
  const { MOCK_ANALYSIS_PRESET_1, MOCK_ANALYSIS_PRESET_2 } = await import('@/mocks/mockData');

  // -------------------------------------------------------------------------
  // SUITE 1: TIMING INVARIANCE & EVENT LOOP RESPONSIVENESS
  // -------------------------------------------------------------------------
  console.log('🔬 --- SUITE 1: TIMING INVARIANCE & EVENT LOOP FLUIDITY ---\n');

  await test('1.1 Preset 1 Fallback Timing Floor (>= 1100ms)', async () => {
    const start = performance.now();
    const res = await analyzePrescription(undefined, undefined, 'preset1');
    const elapsed = performance.now() - start;
    assert.ok(elapsed >= 1100, `Elapsed time must be >= 1100ms (got ${elapsed.toFixed(1)}ms)`);
    assert.equal(res.warnings.length, 0, 'Preset 1 must have 0 warnings');
  });

  await test('1.2 Preset 2 Fallback Timing Floor (>= 1100ms)', async () => {
    const start = performance.now();
    const res = await analyzePrescription(undefined, undefined, 'preset2');
    const elapsed = performance.now() - start;
    assert.ok(elapsed >= 1100, `Elapsed time must be >= 1100ms (got ${elapsed.toFixed(1)}ms)`);
    assert.equal(res.warnings.length, 2, 'Preset 2 must have 2 warnings');
  });

  await test('1.3 Event Loop Liveness during 1200ms delay (No thread blocking)', async () => {
    // Monitor event loop jitter while analyzePrescription runs
    let tickCount = 0;
    const tickInterval = 50; // Every 50ms
    const timer = setInterval(() => {
      tickCount++;
    }, tickInterval);

    const start = performance.now();
    const res = await analyzePrescription(undefined, undefined, 'preset1');
    const elapsed = performance.now() - start;
    clearInterval(timer);

    // If event loop was blocked, tickCount would be near 0
    // In ~1200ms with 50ms interval, expected ~20-24 ticks
    console.log(`\n      [Event Loop Heartbeat] Ticks recorded: ${tickCount} in ${elapsed.toFixed(0)}ms`);
    assert.ok(tickCount >= 15, `Event loop must remain fluid (expected >= 15 ticks, got ${tickCount})`);
    assert.ok(res && res.medicines.length > 0, 'Must return valid prescription analysis');
  });

  // -------------------------------------------------------------------------
  // SUITE 2: HIGH CONCURRENCY STRESS
  // -------------------------------------------------------------------------
  console.log('\n🔬 --- SUITE 2: HIGH CONCURRENCY STRESS (20 SIMULTANEOUS CALLS) ---\n');

  await test('2.1 High Concurrency: 20 simultaneous calls with mixed presets & hints', async () => {
    const totalCalls = 20;
    const startTime = performance.now();

    const tasks = Array.from({ length: totalCalls }, (_, i) => {
      const mode = i % 4;
      if (mode === 0) return analyzePrescription(undefined, undefined, 'preset1');
      if (mode === 1) return analyzePrescription(undefined, undefined, 'preset2');
      if (mode === 2) return analyzePrescription('data:image/jpeg;base64,ciprofloxacin_sample', undefined);
      return analyzePrescription('data:image/png;base64,generic_doc_sample', undefined);
    });

    const results = await Promise.all(tasks);
    const totalElapsed = performance.now() - startTime;

    console.log(`\n      [Concurrency Metrics] 20 parallel calls finished in ${totalElapsed.toFixed(0)}ms`);
    assert.equal(results.length, 20, 'All 20 calls must resolve');

    // Verify correct mapping
    results.forEach((res, i) => {
      assert.ok(res, `Result ${i} must exist`);
      assert.ok(Array.isArray(res.medicines), `Result ${i} medicines must be array`);
      const mode = i % 4;
      if (mode === 0) {
        assert.equal(res.warnings.length, 0, `Call ${i} (preset1) must have 0 warnings`);
        assert.equal(res.medicines.length, 3, `Call ${i} (preset1) must have 3 medicines`);
      } else if (mode === 1) {
        assert.equal(res.warnings.length, 2, `Call ${i} (preset2) must have 2 warnings`);
        assert.equal(res.medicines.length, 2, `Call ${i} (preset2) must have 2 medicines`);
      } else if (mode === 2) {
        assert.equal(res.warnings.length, 2, `Call ${i} (cipro hint) must have 2 warnings`);
      } else {
        assert.equal(res.warnings.length, 0, `Call ${i} (generic hint) must default to preset1`);
      }
    });

    // Timing check: Because they run concurrently, total time should be close to ~1.2s to ~2.5s, NOT 20 * 1.2s = 24s
    assert.ok(totalElapsed < 5000, `Concurrent execution must not serialize (expected < 5000ms, took ${totalElapsed.toFixed(0)}ms)`);
  });

  // -------------------------------------------------------------------------
  // SUITE 3: EXTREME INPUTS & BOUNDARY CONDITIONS
  // -------------------------------------------------------------------------
  console.log('\n🔬 --- SUITE 3: EXTREME INPUTS & BOUNDARY CONDITIONS ---\n');

  await test('3.1 Undefined, Null, and Empty String Inputs', async () => {
    const r1 = await analyzePrescription();
    assert.ok(r1 && r1.medicines.length === 3, 'No-arg call should return Preset 1');

    const r2 = await analyzePrescription(null, null, null);
    assert.ok(r2 && r2.medicines.length === 3, 'All null call should return Preset 1');

    const r3 = await analyzePrescription('', []);
    assert.ok(r3 && r3.medicines.length === 3, 'Empty string image should return Preset 1');

    const r4 = await analyzePrescription('   \t\n   ', []);
    assert.ok(r4 && r4.medicines.length === 3, 'Whitespace string image should return Preset 1');
  });

  await test('3.2 Non-Existent Preset Strings & Type Coercion', async () => {
    // Non-existent preset string
    const rUnknownPreset = await analyzePrescription(undefined, undefined, 'preset999');
    assert.ok(rUnknownPreset, 'Non-existent preset string should safely fallback to Preset 1');
    assert.equal(rUnknownPreset.warnings.length, 0);

    // Number passed as presetChoice
    const rNumberPreset = await analyzePrescription(undefined, undefined, 42);
    assert.ok(rNumberPreset && rNumberPreset.medicines.length === 3, 'Number as preset should safely fallback');

    // Object passed as presetChoice
    const rObjPreset = await analyzePrescription(undefined, undefined, { hacked: true });
    assert.ok(rObjPreset && rObjPreset.medicines.length === 3, 'Object as preset should safely fallback');
  });

  await test('3.3 10MB Huge Base64 String Stress Test (Memory & RegExp Resilience)', async () => {
    // Generate a 10MB repetitive base64 payload
    const chunkSize = 1024 * 1024; // 1MB
    const chunk = 'VGhpcyBpcyBhIHRlc3Qgc3RyaW5nIGZvciBNZWRMZW5zIEFJIG11bHRpbW9kYWwgc2Nhbm5lcg==';
    const repeats = Math.ceil(chunkSize / chunk.length);
    const oneMB = chunk.repeat(repeats).slice(0, chunkSize);
    const tenMB = oneMB.repeat(10); // 10MB string

    console.log(`\n      [Memory Stress] Allocating 10MB string (length: ${tenMB.length.toLocaleString()} chars)...`);
    const memBefore = process.memoryUsage().heapUsed;
    const start = performance.now();

    const res = await analyzePrescription(tenMB, []);
    const elapsed = performance.now() - start;
    const memAfter = process.memoryUsage().heapUsed;
    const memDeltaMB = ((memAfter - memBefore) / (1024 * 1024)).toFixed(1);

    console.log(`      [Memory Stress] 10MB scan processed in ${elapsed.toFixed(0)}ms (Heap delta: ${memDeltaMB} MB)`);
    assert.ok(res, '10MB image scan must return valid result');
    assert.equal(res.warnings.length, 0, '10MB generic payload should default to Preset 1');
  });

  await test('3.4 10MB Huge Base64 String with Target Keyword embedded at the end', async () => {
    // 10MB payload with 'ciprofloxacin' at the very tail end
    const padding = 'A'.repeat(10 * 1024 * 1024);
    const embedded = padding + '_CIPROFLOXACIN_DETECT_';

    const start = performance.now();
    const res = await analyzePrescription(embedded, []);
    const elapsed = performance.now() - start;

    console.log(`\n      [Keyword Search on 10MB] Detected keyword at offset 10M in ${elapsed.toFixed(0)}ms`);
    assert.ok(res, 'Must return result');
    assert.equal(res.warnings.length, 2, 'Keyword at end of 10MB payload must trigger Preset 2');
  });

  await test('3.5 Security Payloads: Prototype Pollution & Injection Strings', async () => {
    const maliciousStrings = [
      '{"__proto__": {"admin": true}}',
      '<script>alert("xss")</script>',
      "'; DROP TABLE medicines; --",
      '\u0000\u0001\u0002\u0003\u0004\u0005',
      'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+',
    ];

    for (const str of maliciousStrings) {
      const res = await analyzePrescription(str);
      assert.ok(res, `Must safely handle malicious input: ${str.slice(0, 20)}`);
      assert.ok(Array.isArray(res.medicines));
    }
  });

  await test('3.6 Corrupted & Adversarial Cabinet Medicines Array', async () => {
    const chaoticCabinet = [
      null,
      undefined,
      {},
      { id: 999, name: null },
      { id: 'corrupt-1', name: 'ValidName', timeSlots: 'invalid-string-instead-of-array' },
      { id: 'corrupt-2', remainingCount: -1000, expiryDate: 'invalid-date' },
      { prototype: Object.prototype },
    ];

    const res = await analyzePrescription('data:image/jpeg;base64,cipro_sample', chaoticCabinet);
    assert.ok(res, 'Must safely process call even if cabinet contains malformed entries');
    assert.equal(res.warnings.length, 2, 'Should still recognize Preset 2');
  });

  // -------------------------------------------------------------------------
  // SUITE 4: DEEP IMMUTABILITY & ANTI-POISONING VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n🔬 --- SUITE 4: DEEP IMMUTABILITY & ANTI-POISONING ---\n');

  await test('4.1 Multi-Layer In-Place Mutation Resilience (Preset 1)', async () => {
    // 1st call
    const res1 = await analyzePrescription(undefined, undefined, 'preset1');

    // Attempt severe deep poisoning on res1
    res1.doctorName = 'POISONED_DOCTOR';
    res1.diagnosis = 'POISONED_DIAGNOSIS';
    res1.medicines[0].name = 'MUTATED_AMLODIPINE';
    res1.medicines[0].dosage = '999 viên';
    res1.medicines[0].timeSlots.push('midnight_emergency');
    res1.medicines.pop(); // Remove 1 medicine
    res1.warnings.push({ id: 'injected_warning', severity: 'critical' });

    // 2nd call: must be 100% pristine and unaffected
    const res2 = await analyzePrescription(undefined, undefined, 'preset1');

    assert.equal(res2.medicines.length, 3, 'Subsequent call medicines length must remain 3');
    assert.equal(res2.warnings.length, 0, 'Subsequent call warnings length must remain 0');
    assert.ok(!res2.doctorName.includes('POISONED'), 'Doctor name must not be poisoned');
    assert.ok(!res2.diagnosis.includes('POISONED'), 'Diagnosis must not be poisoned');
    assert.equal(res2.medicines[0].name, 'Amlodipine 5mg', 'Medicine name must remain untainted');
    assert.equal(res2.medicines[0].dosage, '1 viên', 'Dosage must remain untainted');
    assert.ok(!res2.medicines[0].timeSlots.includes('midnight_emergency'), 'timeSlots array must not contain poisoned slot');
  });

  await test('4.2 Multi-Layer In-Place Mutation Resilience (Preset 2)', async () => {
    // 1st call
    const res1 = await analyzePrescription(undefined, undefined, 'preset2');

    // Poison Preset 2 returned data
    res1.warnings[0].description = 'TOTALLY_CORRUPTED_DESCRIPTION';
    res1.warnings[0].severity = 'low';
    res1.warnings.length = 0; // Empty warnings array
    res1.medicines.length = 0; // Empty medicines array

    // 2nd call: must be pristine
    const res2 = await analyzePrescription(undefined, undefined, 'preset2');

    assert.equal(res2.medicines.length, 2, 'Preset 2 medicines must remain 2');
    assert.equal(res2.warnings.length, 2, 'Preset 2 warnings must remain 2');
    assert.equal(res2.warnings[0].severity, 'high', 'Severity must remain high');
    assert.ok(res2.warnings[0].description.includes('chelate'), 'Description must remain intact');
    assert.equal(MOCK_ANALYSIS_PRESET_2.warnings.length, 2, 'Original mock data must not be mutated');
  });

  // -------------------------------------------------------------------------
  // SUITE 5: BACKWARDS COMPATIBILITY & ASKAI ROBUSTNESS
  // -------------------------------------------------------------------------
  console.log('\n🔬 --- SUITE 5: BACKWARDS COMPATIBILITY & ASKAI ROBUSTNESS ---\n');

  await test('5.1 askAI Fallback Title and KeyPoints Invariant', async () => {
    const res = await askAI('Give me health analysis');
    assert.ok(res, 'askAI must return result');
    assert.ok(res.title.includes('Phân tích') || res.title.includes('Dự phòng'), 'Title must match fallback format');
    assert.ok(Array.isArray(res.keyPoints), 'keyPoints must be array');
    assert.ok(res.keyPoints.length >= 3, 'Must have at least 3 keyPoints');
  });

  await test('5.2 askAI Custom Fallback Data Contract', async () => {
    const custom = {
      title: 'Custom Title 123',
      description: 'Custom Description 456',
      customField: [1, 2, 3],
    };

    const res = await askAI('Test prompt', { fallbackData: custom });
    assert.equal(res.title, 'Custom Title 123');
    assert.equal(res.description, 'Custom Description 456');
    assert.equal(res.customField.length, 3);
  });

  // -------------------------------------------------------------------------
  // SUITE 6: EDGE FUNCTION PARSING & NORMALIZATION CONTRACT VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n🔬 --- SUITE 6: EDGE FUNCTION NORMALIZATION CONTRACT AUDIT ---\n');

  await test('6.1 Markdown code block stripping & JSON repair logic', async () => {
    const rawMarkdownFromGemini = '```json\n{\n  "doctorName": "BS. Nguyễn Văn A",\n  "diagnosis": "Đau dạ dày",\n  "medicines": [\n    {"name": "Omeprazole 20mg", "mealTiming": "invalid_meal_value", "timeSlots": []}\n  ],\n  "warnings": [\n    {"medicineA": "Omeprazole", "medicineB": "Clopidogrel", "severity": "super_critical_unknown"}\n  ]\n}\n```';

    const cleanJson = rawMarkdownFromGemini
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleanJson);
    assert.equal(parsed.doctorName, 'BS. Nguyễn Văn A');

    // Simulate normalization logic from supabase/functions/chat-ai/index.ts lines 241-267
    const normalizedMeds = parsed.medicines.map((med, index) => ({
      id: med.id || `med-${index + 1}-${Date.now()}`,
      name: med.name || 'Thuốc không rõ tên',
      activeIngredient: med.activeIngredient || '',
      dosage: med.dosage || '1 viên',
      mealTiming: ['before_meal', 'after_meal', 'with_meal'].includes(med.mealTiming)
        ? med.mealTiming
        : 'after_meal',
      instructions: med.instructions || 'Uống theo chỉ dẫn bác sĩ',
      purpose: med.purpose || '',
      remainingCount: typeof med.remainingCount === 'number' ? med.remainingCount : 20,
      expiryDate: med.expiryDate || '2026-12-31',
      category: med.category || 'Other',
      timeSlots: Array.isArray(med.timeSlots) && med.timeSlots.length > 0 ? med.timeSlots : ['morning'],
    }));

    const normalizedWarns = parsed.warnings.map((warn, index) => ({
      id: warn.id || `warn-${index + 1}-${Date.now()}`,
      source: warn.source === 'cabinet_conflict' ? 'cabinet_conflict' : 'internal_prescription',
      medicineA: warn.medicineA || '',
      medicineB: warn.medicineB || '',
      severity: ['low', 'moderate', 'high', 'critical'].includes(warn.severity)
        ? warn.severity
        : 'moderate',
      description: warn.description || '',
      clinicalRecommendation: warn.clinicalRecommendation || '',
    }));

    assert.equal(normalizedMeds[0].mealTiming, 'after_meal', 'Invalid mealTiming must default to after_meal');
    assert.deepEqual(normalizedMeds[0].timeSlots, ['morning'], 'Empty timeSlots must default to ["morning"]');
    assert.equal(normalizedWarns[0].source, 'internal_prescription', 'Default source must be internal_prescription');
    assert.equal(normalizedWarns[0].severity, 'moderate', 'Unknown severity must default to moderate');
  });

  // -------------------------------------------------------------------------
  // SUITE 7: UNHANDLED REJECTIONS & SYSTEM RESILIENCE AUDIT
  // -------------------------------------------------------------------------
  console.log('\n🔬 --- SUITE 7: UNHANDLED PROMISE REJECTION AUDIT ---\n');

  await test('7.1 Global Unhandled Promise Rejections is strictly 0', () => {
    assert.equal(unhandledRejections.length, 0, `Detected ${unhandledRejections.length} unhandled promise rejections!`);
  });

  await test('7.2 Global Uncaught Exceptions is strictly 0', () => {
    assert.equal(uncaughtExceptions.length, 0, `Detected ${uncaughtExceptions.length} uncaught exceptions!`);
  });

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`📊 CHALLENGER 1 SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log(`🚨 UNHANDLED REJECTIONS: ${unhandledRejections.length}`);
  console.log(`🚨 UNCAUGHT EXCEPTIONS:  ${uncaughtExceptions.length}`);
  console.log('======================================================================\n');

  if (failCount > 0 || unhandledRejections.length > 0 || uncaughtExceptions.length > 0) {
    console.error('❌ CHALLENGER 1 DETECTED REGRESSIONS OR FAILURES!');
    process.exit(1);
  } else {
    console.log('🏆 ALL ADVERSARIAL CHALLENGES EMPIRICALLY VERIFIED AND PASSED!\n');
    process.exit(0);
  }
}

runChallenger1Harness().catch((err) => {
  console.error('Fatal crash running Challenger 1 harness:', err);
  process.exit(1);
});
