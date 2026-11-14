# Test Infrastructure Specification: MedLens AI

## 1. Overview & Architecture
MedLens AI implements a requirement-driven, opaque-box automated test framework.
The test harness runs entirely within a headless Node.js environment on Windows, requiring zero native emulators (no Android Virtual Devices or Xcode Simulators) or physical hardware dependencies.
It evaluates application contracts, state persistence, dual-layer AI safety checks, and Apple HIG visual design constraints strictly from the outside.

### Key Tenets
1. **Opaque-Box Testing**: Evaluates MedLens AI strictly against user requirements and public interfaces without native device or emulator dependencies.
2. **Sub-second Execution**: Powered by in-memory mock controllers and runtime TypeScript transpilation, executing the entire 111-test suite in under 3 seconds.
3. **100% Kill App Resilience**: Validates full state persistence via `@react-native-async-storage/async-storage` (key `'medlens-storage-v1'`), simulating application crashes and process death.
4. **Dual-Layer Clinical Interaction Checks**: Validates detection of both Layer 1 intra-prescription conflicts (e.g. Ciprofloxacin + Gaviscon chelation) and Layer 2 cabinet cross-conflicts (e.g. Gaviscon + Aspirin 81mg enteric coating dissolution).
5. **Apple HIG & Clean UI Verification**: Static AST scanner enforcing `#F2F2F7` background, white squircle cards, SF Pro typography, and zero raw HTML tags (`div`, `span`, `p`, `img`, `button`).

---

## 2. Environment & Execution
- **Runtime**: Node.js >= 22 (tested on Node v24.19.0)
- **Operating System**: Windows 10/11 (PowerShell compatible via `npm.cmd`)
- **Execution Commands**:
  - Run entire test suite: `npm.cmd test` (or `node tests/e2e/runner.mjs`)
  - Run specific tier: `npm.cmd test -- --tier=1` (or 2, 3, 4)
  - Run matching filter: `npm.cmd test -- --filter=smart_merge`
  - Compile check + Test: `npm.cmd run test:full` (`npx tsc --noEmit && npm.cmd test`)

---

## 3. Test Harness Subsystems

### 3.1 In-Memory Persistence & Kill App Simulation (`tests/e2e/harness/mockAsyncStorage.ts`)
- `@react-native-async-storage/async-storage` is intercepted with `MockAsyncStorage`.
- Persists data to in-memory key-value map keyed by `'medlens-storage-v1'`.
- Supports full process termination simulation: destroying active store references and re-hydrating from storage.
- Storage corruption & error injection APIs for Tier 2 boundary resilience testing.

### 3.2 Dual-Layer AI & Resilient Fallback Simulation (`tests/e2e/harness/mockNetwork.ts`)
- Supabase Edge Function (`POST /functions/v1/chat-ai`) is intercepted via `MockNetworkController`.
- Simulates Gemini 1.5 Flash Vision responses for Preset 1 (Hypertension + Diabetes) and Preset 2 (Antibiotics + Gastric conflict).
- Simulates offline disconnection, network timeouts, and server 500 errors to verify the 1.2-second resilient zero-crash fallback.

### 3.3 Expo Haptics Spy Recorder (`tests/e2e/harness/mockHaptics.ts`)
- Intercepts `expo-haptics` module calls.
- Records calls to `impactAsync`, `notificationAsync`, and `selectionAsync` with feedback styles.
- Verifies success haptics on dose checkmark toggles, warning haptics on drug interaction detection, and light impact on tab/button navigation.

### 3.4 Automated UI & Apple HIG Compliance Scanner (`tests/e2e/harness/uiValidator.ts`)
- TypeScript AST scanner (`ts.createSourceFile`) recursively analyzes all `.tsx` files in `app/` and `components/` (excluding web shell `app/+html.tsx`).
- Zero raw HTML tags assertion: Immediate failure if any `<div>`, `<span>`, `<p>`, `<img>`, `<button>`, or `<a>` is found.
- Apple Light Grouped Mode assertion: Enforces `#F2F2F7` background, white squircle cards, and absence of dark theme toggle code.
- Reusable UI component assertion: Validates `@/components/ui` (`Button`, `Card`, `Badge`, `Input`, `Skeleton`, `ScreenHeader`) integration.

---

## 4. Test Tier Matrix & Coverage Mapping

| Tier | Category | Test Cases | Scope |
|:---:|:---|:---:|:---|
| **Tier 1** | Feature Coverage (Isolated Happy Paths) | 55 | 11 Core features (5 tests each): Adherence Card, 3 Dose Slots, 1-Touch Toggle, Medicine Detail Modal, Preset 1, Preset 2, Skeleton Loader, Dual-Layer Alert Card, Smart Merge CTA, Cabinet Filters, Reset Demo Data. |
| **Tier 2** | Boundary & Corner Cases | 35 | 7 Boundary domains (5 tests each): Empty Cabinet, 0 Remaining Pills, Expired Medicines, Offline / Network Fallback, Missing Fields in Prescription, Midday Smart Merge with Partial Checkmarks, Duplicate Medicine Ingestion. |
| **Tier 3** | Cross-Feature Combinations | 16 | Pairwise interactions between state, navigation, presets, and storage recovery. |
| **Tier 4** | Real-World Application Scenarios | 5 | End-to-end user journeys (Elderly chronic routine, acute antibiotic clash, rural offline clinic, caregiver cabinet audit, hackathon grand jury demo flow). |
| **Total** | **Comprehensive Automated Suite** | **111** | Full requirement and architectural verification. |

---

## 5. Exit Codes & CI Automation
- **Exit Code 0**: All 111 assertions passed across all 4 tiers.
- **Exit Code 1**: Any assertion failed; logs exact test ID, file path, failing line, and expected vs actual diff.
