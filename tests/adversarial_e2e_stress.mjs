/**
 * Adversarial E2E & MockAsyncStorage Stress Verification Suite
 * Executed by Challenger 1 (EMPIRICAL CHALLENGER)
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

// Initialize test bootstrap
require('./e2e/harness/bootstrap.cjs');

const { MockAsyncStorage } = require('./e2e/harness/mockAsyncStorage.ts');
const { StoreTestHarness } = require('./e2e/harness/storeTestHarness.ts');

console.log('======================================================================');
console.log('⚔️  CHALLENGER 1: ADVERSARIAL STRESS TEST SUITE');
console.log('======================================================================');

const results = [];

function recordTest(name, passed, details = '') {
  results.push({ name, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] ${name}`);
  if (details) console.log(`       ℹ️  ${details}`);
}

async function runAdversarialSuite() {
  // =========================================================================
  // TEST GROUP 1: Runner Fail-Closed Verification
  // =========================================================================
  console.log('\n--- GROUP 1: RUNNER FAIL-CLOSED VERIFICATION ---');

  // Test 1.1: Verify baseline runner exits with 0 on untouched test suite
  {
    const res = spawnSync(process.execPath, ['tests/e2e/runner.mjs', '--tier=4'], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    const passed = res.status === 0;
    recordTest(
      'Runner Baseline Success Exit Code (Exit 0)',
      passed,
      `Exit Code: ${res.status}, Output duration line found: ${res.stdout.includes('ALL TESTS PASSED SUCCESSFULLY!')}`
    );
  }

  // Test 1.2: Verify runner genuinely exits with 1 when an assertion fails
  {
    // Create a temporary failing test file in tier1
    const failingTestPath = path.join(
      projectRoot,
      'tests/e2e/tiers/tier1-features/__temp_adversarial_failure.test.ts'
    );
    const runnerPath = path.join(projectRoot, 'tests/e2e/runner.mjs');
    const runnerContent = fs.readFileSync(runnerPath, 'utf8');

    try {
      // Write temporary failing test
      fs.writeFileSync(
        failingTestPath,
        `
        const { defineTest, assert } = require('../../harness/testContext.ts');
        defineTest('FAIL-ADVERSARIAL-01', 1, 'Adversarial Probe', 'Simulated intentional test assertion failure', () => {
          assert.equal(1 + 1, 3, 'Intentional Challenger Assertion Failure: 1+1 !== 3');
        });
        `
      );

      // Temporarily inject failing test into runner.mjs
      const modifiedRunner = runnerContent.replace(
        "'./tiers/tier1-features/adherence_card.test.ts',",
        "'./tiers/tier1-features/__temp_adversarial_failure.test.ts',\n  './tiers/tier1-features/adherence_card.test.ts',"
      );
      fs.writeFileSync(runnerPath, modifiedRunner);

      const res = spawnSync(process.execPath, ['tests/e2e/runner.mjs', '--filter=FAIL-ADVERSARIAL-01'], {
        cwd: projectRoot,
        encoding: 'utf8',
      });

      const exitCodeIsOne = res.status === 1;
      const detectedFailure = res.stdout.includes('Intentional Challenger Assertion Failure');
      const hasFailureList = res.stdout.includes('DETAILED FAILURE LIST');
      const hasExitMessage = res.stdout.includes('Test run FAILED. Exiting with code 1.');

      const passed = exitCodeIsOne && detectedFailure && hasFailureList && hasExitMessage;
      recordTest(
        'Runner Fail-Closed on Assertion Failure (Exit 1)',
        passed,
        `Exit Code: ${res.status} (expected 1), Detected Error: ${detectedFailure}, Has Fail Message: ${hasExitMessage}`
      );
    } finally {
      // Clean up temporary changes
      fs.writeFileSync(runnerPath, runnerContent);
      if (fs.existsSync(failingTestPath)) {
        fs.unlinkSync(failingTestPath);
      }
    }
  }

  // Test 1.3: Verify runner genuinely exits with 1 on unhandled async rejection inside a test
  {
    const failingTestPath = path.join(
      projectRoot,
      'tests/e2e/tiers/tier1-features/__temp_adversarial_async_failure.test.ts'
    );
    const runnerPath = path.join(projectRoot, 'tests/e2e/runner.mjs');
    const runnerContent = fs.readFileSync(runnerPath, 'utf8');

    try {
      fs.writeFileSync(
        failingTestPath,
        `
        const { defineTest } = require('../../harness/testContext.ts');
        defineTest('FAIL-ASYNC-01', 1, 'Adversarial Probe', 'Async promise rejection bomb', async () => {
          await new Promise((_, reject) => setTimeout(() => reject(new Error('Adversarial Async Bomb Explosive')), 10));
        });
        `
      );

      const modifiedRunner = runnerContent.replace(
        "'./tiers/tier1-features/adherence_card.test.ts',",
        "'./tiers/tier1-features/__temp_adversarial_async_failure.test.ts',\n  './tiers/tier1-features/adherence_card.test.ts',"
      );
      fs.writeFileSync(runnerPath, modifiedRunner);

      const res = spawnSync(process.execPath, ['tests/e2e/runner.mjs', '--filter=FAIL-ASYNC-01'], {
        cwd: projectRoot,
        encoding: 'utf8',
      });

      const exitCodeIsOne = res.status === 1;
      const detectedAsyncError = res.stdout.includes('Adversarial Async Bomb Explosive');
      const passed = exitCodeIsOne && detectedAsyncError;
      recordTest(
        'Runner Fail-Closed on Async Rejection (Exit 1)',
        passed,
        `Exit Code: ${res.status} (expected 1), Detected Async Rejection: ${detectedAsyncError}`
      );
    } finally {
      fs.writeFileSync(runnerPath, runnerContent);
      if (fs.existsSync(failingTestPath)) {
        fs.unlinkSync(failingTestPath);
      }
    }
  }

  // =========================================================================
  // TEST GROUP 2: Rapid State Toggles & Stress in MockAsyncStorage & Zustand
  // =========================================================================
  console.log('\n--- GROUP 2: RAPID STATE TOGGLES & CONCURRENCY STRESS ---');

  // Test 2.1: 120 rapid sequential toggles on dose slot
  {
    await StoreTestHarness.resetAll();
    let store = await StoreTestHarness.getState();

    // Initial state: morning isTaken is false
    const initialMorning = store.schedule.find((s) => s.slot === 'morning');
    const initiallyFalse = initialMorning?.isTaken === false;

    // Toggle 120 times (even count -> must end up false)
    for (let i = 0; i < 120; i++) {
      store.toggleDoseSlot('morning');
    }
    await StoreTestHarness.flushStorage();
    store = await StoreTestHarness.getState();
    const finalMorning = store.schedule.find((s) => s.slot === 'morning');
    const isFalseAfterEven = finalMorning?.isTaken === false;

    // Toggle 1 more time (odd count 121 -> must end up true with timestamp)
    store.toggleDoseSlot('morning');
    await StoreTestHarness.flushStorage();
    store = await StoreTestHarness.getState();
    const morningAfterOdd = store.schedule.find((s) => s.slot === 'morning');
    const isTrueAfterOdd = morningAfterOdd?.isTaken === true && typeof morningAfterOdd.takenAt === 'string';

    const passed = initiallyFalse && isFalseAfterEven && isTrueAfterOdd;
    recordTest(
      'Rapid 120+ Sequential Toggles State Parity',
      passed,
      `Initially false: ${initiallyFalse}, After 120 toggles: ${isFalseAfterEven}, After 121st: ${isTrueAfterOdd} (takenAt: ${morningAfterOdd?.takenAt})`
    );
  }

  // Test 2.2: Interleaved rapid toggles across multiple slots without cross-talk
  {
    await StoreTestHarness.resetAll();
    let store = await StoreTestHarness.getState();

    // Toggle morning 11 times (ends true)
    // Toggle noon 20 times (ends false)
    // Toggle evening 5 times (ends true)
    for (let i = 0; i < 20; i++) {
      if (i < 11) store.toggleDoseSlot('morning');
      store.toggleDoseSlot('noon');
      if (i < 5) store.toggleDoseSlot('evening');
    }
    await StoreTestHarness.flushStorage();
    store = await StoreTestHarness.getState();

    const m = store.schedule.find((s) => s.slot === 'morning')?.isTaken;
    const n = store.schedule.find((s) => s.slot === 'noon')?.isTaken;
    const e = store.schedule.find((s) => s.slot === 'evening')?.isTaken;

    const passed = m === true && n === false && e === true;
    recordTest(
      'Interleaved Multi-Slot Rapid Toggles Isolation',
      passed,
      `Morning expected true: got ${m}; Noon expected false: got ${n}; Evening expected true: got ${e}`
    );
  }

  // Test 2.3: Kill App persistence after rapid toggles
  {
    // The previous state was: Morning=true, Noon=false, Evening=true
    const restartedStore = await StoreTestHarness.killAndRestartApp();
    const state = restartedStore.getState();

    const m = state.schedule.find((s) => s.slot === 'morning')?.isTaken;
    const n = state.schedule.find((s) => s.slot === 'noon')?.isTaken;
    const e = state.schedule.find((s) => s.slot === 'evening')?.isTaken;

    const passed = m === true && n === false && e === true;
    recordTest(
      'Kill-App Cold Boot State Recovery After Rapid Toggles',
      passed,
      `Recovered morning: ${m}, noon: ${n}, evening: ${e}`
    );
  }

  // =========================================================================
  // TEST GROUP 3: Storage Corruption Scenarios in MockAsyncStorage
  // =========================================================================
  console.log('\n--- GROUP 3: STORAGE CORRUPTION SCENARIOS ---');

  // Test 3.1: Complete JSON Corruption (Unparseable string <<<CORRUPTED_JSON_DATA>>>)
  {
    await StoreTestHarness.resetAll();
    // Simulate severe disk/storage corruption on the persisted store key
    MockAsyncStorage.simulateCorruption('medlens-storage-v1');

    const dumpedRaw = MockAsyncStorage.dump()['medlens-storage-v1'];
    let errorCaught = null;
    let storeAfterCorrupt = null;

    try {
      storeAfterCorrupt = await StoreTestHarness.killAndRestartApp();
    } catch (err) {
      errorCaught = err;
    }

    // In Zustand persist middleware, when storage returns unparseable JSON:
    // createJSONStorage JSON.parse will fail or reject.
    // Let's observe how the app/store behaves.
    const state = storeAfterCorrupt ? storeAfterCorrupt.getState() : null;
    const hasDefaultSchedule = state && Array.isArray(state.schedule) && state.schedule.length === 3;
    const canRecoverWithReset = state ? (state.resetToDemo(), true) : false;

    recordTest(
      'Storage Corruption: Unparseable String Injection',
      Boolean(storeAfterCorrupt && hasDefaultSchedule),
      `Corrupted data in storage: "${dumpedRaw}". App loaded: ${Boolean(storeAfterCorrupt)}, Default schedule preserved: ${hasDefaultSchedule}, Reset demo recovered: ${canRecoverWithReset}`
    );
  }

  // Test 3.2: Truncated JSON String Recovery
  {
    await StoreTestHarness.resetAll();
    // Truncated JSON string
    await MockAsyncStorage.setItem(
      'medlens-storage-v1',
      '{"state":{"schedule":[{"slot":"morning","timeLabel":"08:00","medicines":'
    );

    let storeAfterTruncate = null;
    try {
      storeAfterTruncate = await StoreTestHarness.killAndRestartApp();
    } catch (err) {
      // Observe if thrown or recovered
    }

    const state = storeAfterTruncate ? storeAfterTruncate.getState() : null;
    const hasSchedule = state && Array.isArray(state.schedule) && state.schedule.length === 3;

    recordTest(
      'Storage Corruption: Truncated Incomplete JSON Stream',
      Boolean(storeAfterTruncate && hasSchedule),
      `Loaded: ${Boolean(storeAfterTruncate)}, Default Schedule: ${hasSchedule}`
    );
  }

  // Test 3.3: Semantically Incomplete Schema (Valid JSON but missing keys)
  {
    await StoreTestHarness.resetAll();
    // Valid JSON but corrupted structure (empty state object)
    await MockAsyncStorage.setItem('medlens-storage-v1', JSON.stringify({ state: {}, version: 0 }));

    const restartedStore = await StoreTestHarness.killAndRestartApp();
    const state = restartedStore.getState();

    // Verify recovery via resetToDemo()
    state.resetToDemo();
    const recoveredState = restartedStore.getState();
    const scheduleOk = recoveredState.schedule.length === 3;
    const cabinetOk = recoveredState.cabinet.length > 0;

    const passed = scheduleOk && cabinetOk;
    recordTest(
      'Storage Corruption: Schema Depletion Recovery via resetToDemo()',
      passed,
      `After resetToDemo(): schedule slots = ${recoveredState.schedule.length}, cabinet count = ${recoveredState.cabinet.length}`
    );
  }

  // Test 3.4: Simulated AsyncStorage Read Failure
  {
    await StoreTestHarness.resetAll();
    // Configure MockAsyncStorage to fail next 1 read operation
    MockAsyncStorage.setSimulatedFailures(1, 0);

    let readFailedAsExpected = false;
    try {
      await MockAsyncStorage.getItem('medlens-storage-v1');
    } catch (err) {
      readFailedAsExpected = err.message.includes('Simulated AsyncStorage Read Failure');
    }

    // Subsequent read succeeds because failure counter was decremented
    const secondRead = await MockAsyncStorage.getItem('medlens-storage-v1');
    const readRecovered = typeof secondRead === 'string';

    const passed = readFailedAsExpected && readRecovered;
    recordTest(
      'MockAsyncStorage Simulated Read Failure Injection & Recovery',
      passed,
      `1st read threw expected error: ${readFailedAsExpected}, 2nd read recovered cleanly: ${readRecovered}`
    );
  }

  // Test 3.5: Simulated AsyncStorage Write Failure
  {
    await StoreTestHarness.resetAll();
    // Configure MockAsyncStorage to fail next 1 write operation
    MockAsyncStorage.setSimulatedFailures(0, 1);

    let writeFailedAsExpected = false;
    try {
      await MockAsyncStorage.setItem('test-key', 'test-val');
    } catch (err) {
      writeFailedAsExpected = err.message.includes('Simulated AsyncStorage Write Failure');
    }

    // Next write succeeds
    await MockAsyncStorage.setItem('test-key', 'test-val-recovered');
    const readVal = await MockAsyncStorage.getItem('test-key');
    const writeRecovered = readVal === 'test-val-recovered';

    const passed = writeFailedAsExpected && writeRecovered;
    recordTest(
      'MockAsyncStorage Simulated Write Failure Injection & Recovery',
      passed,
      `1st write threw expected error: ${writeFailedAsExpected}, 2nd write succeeded: ${writeRecovered}`
    );
  }

  // Clean up
  await StoreTestHarness.resetAll();

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n======================================================================');
  console.log('📊 CHALLENGER 1 ADVERSARIAL VERIFICATION SUMMARY');
  console.log('======================================================================');
  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = total - passedCount;

  console.log(`Total Adversarial Probes: ${total}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);

  if (failedCount === 0) {
    console.log('\n🏆 ALL ADVERSARIAL STRESS PROBES PASSED! HARNESS IS ROBUST & FAIL-CLOSED.\n');
  } else {
    console.log('\n💥 SOME ADVERSARIAL PROBES FAILED! INVESTIGATE FAILURES.\n');
  }

  process.exit(failedCount > 0 ? 1 : 0);
}

runAdversarialSuite().catch((err) => {
  console.error('Fatal probe failure:', err);
  process.exit(1);
});
