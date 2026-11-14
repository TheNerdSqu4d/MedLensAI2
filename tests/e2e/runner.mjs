#!/usr/bin/env node

/**
 * Master CLI Test Runner for MedLens AI E2E Test Suite
 * Executes 4-tier requirement-driven tests in headless Node.js
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// 1. Initialize bootstrap (Module hooks, @/* resolution, AsyncStorage & Haptics shims)
require('./harness/bootstrap.cjs');

// 2. Import test registry
const { testRegistry } = require('./harness/testContext.ts');

// 3. Load all test suite files across all 4 tiers
const testSuiteFiles = [
  // Tier 1: Feature Coverage (55 tests across 11 features)
  './tiers/tier1-features/adherence_card.test.ts',
  './tiers/tier1-features/dose_slots.test.ts',
  './tiers/tier1-features/dose_toggle_haptics.test.ts',
  './tiers/tier1-features/medicine_detail_modal.test.ts',
  './tiers/tier1-features/preset1_routine.test.ts',
  './tiers/tier1-features/preset2_conflict.test.ts',
  './tiers/tier1-features/skeleton_loader.test.ts',
  './tiers/tier1-features/dual_layer_alert.test.ts',
  './tiers/tier1-features/smart_merge_cta.test.ts',
  './tiers/tier1-features/cabinet_filters.test.ts',
  './tiers/tier1-features/reset_demo.test.ts',
  './tiers/tier1-features/meal_times_and_notifications.test.ts',

  // Tier 2: Boundary & Corner Cases (35 tests across 7 domains)
  './tiers/tier2-boundaries/empty_cabinet.test.ts',
  './tiers/tier2-boundaries/zero_pill_count.test.ts',
  './tiers/tier2-boundaries/expired_medicines.test.ts',
  './tiers/tier2-boundaries/offline_network_fallback.test.ts',
  './tiers/tier2-boundaries/missing_fields_prescription.test.ts',
  './tiers/tier2-boundaries/midday_partial_merge.test.ts',
  './tiers/tier2-boundaries/duplicate_ingestion.test.ts',

  // Tier 3: Combinations & Pairwise (16 tests)
  './tiers/tier3-combinations/pairwise_combinations.test.ts',

  // Tier 4: Real-World Scenarios (5 scenarios + UI HIG AST compliance)
  './tiers/tier4-scenarios/patient_journeys.test.ts',
];

for (const suitePath of testSuiteFiles) {
  require(suitePath);
}

// 4. Parse CLI options
const args = process.argv.slice(2);
let tierFilter = null;
let nameFilter = null;

for (const arg of args) {
  if (arg.startsWith('--tier=')) {
    tierFilter = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--filter=')) {
    nameFilter = arg.split('=')[1].toLowerCase();
  }
}

// 5. Filter tests
let testsToRun = testRegistry;
if (tierFilter !== null && !isNaN(tierFilter)) {
  testsToRun = testsToRun.filter((t) => t.tier === tierFilter);
}
if (nameFilter) {
  testsToRun = testsToRun.filter(
    (t) =>
      t.id.toLowerCase().includes(nameFilter) ||
      t.title.toLowerCase().includes(nameFilter) ||
      t.category.toLowerCase().includes(nameFilter)
  );
}

// 6. Test Runner Execution & Formatting
console.log('\n======================================================================');
console.log('🧪 MEDLENS AI — OPAQUE-BOX E2E TEST RUNNER');
console.log('======================================================================');
console.log(`📋 Total Registered Tests: ${testRegistry.length}`);
console.log(`🎯 Tests Selected for Execution: ${testsToRun.length}`);
if (tierFilter !== null) console.log(`🔍 Filter: Tier ${tierFilter} only`);
if (nameFilter) console.log(`🔍 Filter: Pattern "${nameFilter}"`);
console.log('----------------------------------------------------------------------\n');

async function runTestSuite() {
  const startTime = Date.now();
  let passed = 0;
  let failed = 0;
  const failureList = [];

  let currentTier = null;
  let currentCategory = null;

  for (const test of testsToRun) {
    if (test.tier !== currentTier) {
      currentTier = test.tier;
      console.log(`\n🔷 [TIER ${currentTier}] ${getTierDescription(currentTier)}`);
      currentCategory = null;
    }

    if (test.category !== currentCategory) {
      currentCategory = test.category;
      console.log(`   📂 ${currentCategory}:`);
    }

    const testStart = Date.now();
    try {
      await test.fn();
      const duration = Date.now() - testStart;
      passed++;
      console.log(`      ✅ [${test.id}] ${test.title} (${duration}ms)`);
    } catch (err) {
      const duration = Date.now() - testStart;
      failed++;
      failureList.push({ test, err, duration });
      console.log(`      ❌ [${test.id}] ${test.title} (${duration}ms)`);
      console.log(`         ⚠️  ${err.message || err}`);
    }
  }

  const totalTime = Date.now() - startTime;

  console.log('\n======================================================================');
  console.log('📊 EXECUTION SUMMARY');
  console.log('======================================================================');
  console.log(`⏱️  Total Duration: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`✅ Passed: ${passed} / ${testsToRun.length}`);
  console.log(`❌ Failed: ${failed} / ${testsToRun.length}`);

  if (failed > 0) {
    console.log('\n❌ DETAILED FAILURE LIST:');
    failureList.forEach(({ test, err }, idx) => {
      console.log(`\n${idx + 1}) [${test.id}] (Tier ${test.tier}) ${test.title}`);
      console.log(`   Error: ${err.stack || err.message || err}`);
    });
    console.log('\n💥 Test run FAILED. Exiting with code 1.\n');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! Exiting with code 0.\n');
    process.exit(0);
  }
}

function getTierDescription(tier) {
  switch (tier) {
    case 1:
      return 'FEATURE COVERAGE (ISOLATED HAPPY PATHS)';
    case 2:
      return 'BOUNDARY & CORNER CASES (EDGE CONDITIONS & FALLBACKS)';
    case 3:
      return 'CROSS-FEATURE COMBINATIONS (PAIRWISE INTERACTIONS)';
    case 4:
      return 'REAL-WORLD APPLICATION SCENARIOS & PATIENT JOURNEYS';
    default:
      return '';
  }
}

runTestSuite().catch((fatalErr) => {
  console.error('\n💥 FATAL RUNNER ERROR:', fatalErr);
  process.exit(1);
});
