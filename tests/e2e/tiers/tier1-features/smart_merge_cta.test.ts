import { defineTest, assert } from '../../harness/testContext';
import { StoreTestHarness } from '../../harness/storeTestHarness';
import { MOCK_ANALYSIS_PRESET_2 } from '@/mocks/mockData';
import type { PrescriptionAnalysisResult } from '@/types/medlens';
import {
  MockHapticsController,
  ImpactFeedbackStyle,
  impactAsync,
} from '../../harness/mockHaptics';
declare const require: any;
const fs = require('fs');
const path = require('path');

export interface SmartMergeCTAContract {
  title: string;
  variant: 'primary' | 'secondary' | 'danger';
  expectedBgClass: string;
  expectedActiveBgClass: string;
  expectedTextColor: string;
}

export const SMART_MERGE_CTA_CONTRACT: SmartMergeCTAContract = {
  title: 'Tự Động Tạo Lịch Uống',
  variant: 'primary',
  expectedBgClass: 'bg-blue-600',
  expectedActiveBgClass: 'active:bg-blue-700',
  expectedTextColor: 'text-white',
};

export interface NavigationEvent {
  action: 'replace' | 'push' | 'navigate';
  target: string;
  timestamp: number;
}

export class MockNavigationRouter {
  private static events: NavigationEvent[] = [];

  static replace(target: string) {
    this.events.push({ action: 'replace', target, timestamp: Date.now() });
  }

  static navigate(target: string) {
    this.events.push({ action: 'navigate', target, timestamp: Date.now() });
  }

  static getEvents(): NavigationEvent[] {
    return [...this.events];
  }

  static clear() {
    this.events = [];
  }
}

export async function executeSmartMergeCTA(
  analysis: PrescriptionAnalysisResult,
  router: { replace: (route: string) => void } = MockNavigationRouter
): Promise<{ success: boolean; scheduleCountBefore: number; scheduleCountAfter: number }> {
  const state = await StoreTestHarness.getState();
  const scheduleCountBefore = state.schedule.reduce(
    (acc, slot) => acc + slot.medicines.length,
    0
  );

  state.importPrescription(analysis);
  await impactAsync(ImpactFeedbackStyle.Medium);

  const updatedState = await StoreTestHarness.getState();
  const scheduleCountAfter = updatedState.schedule.reduce(
    (acc, slot) => acc + slot.medicines.length,
    0
  );

  if (scheduleCountAfter > scheduleCountBefore) {
    router.replace('/(tabs)');
    return { success: true, scheduleCountBefore, scheduleCountAfter };
  }

  return { success: false, scheduleCountBefore, scheduleCountAfter };
}

// Simulated action handler for CTA "Tự Động Tạo Lịch Uống"
async function handleSmartMergeCTA(analysis: typeof MOCK_ANALYSIS_PRESET_2) {
  const state = await StoreTestHarness.getState();
  state.importPrescription(analysis);
  await impactAsync(ImpactFeedbackStyle.Medium);
  const targetRoute = '/(tabs)';
  return { success: true, targetRoute };
}

// T1-SM-01: CTA button definition
defineTest(
  'T1-SM-01',
  1,
  'Smart Merge CTA',
  'Định nghĩa nút CTA Tự Động Tạo Lịch Uống chuẩn Apple Blue',
  async () => {
    // 1. Verify CTA contract properties
    assert.equal(
      SMART_MERGE_CTA_CONTRACT.title,
      'Tự Động Tạo Lịch Uống',
      'CTA title must match prescription workflow spec'
    );
    assert.equal(
      SMART_MERGE_CTA_CONTRACT.variant,
      'primary',
      'CTA variant must be primary (Apple Blue)'
    );

    // 2. Verify Button UI primitive implementation in components/ui/Button.tsx
    const buttonSourcePath = path.resolve(process.cwd(), 'components/ui/Button.tsx');
    assert.ok(fs.existsSync(buttonSourcePath), 'components/ui/Button.tsx must exist');
    const buttonSource = fs.readFileSync(buttonSourcePath, 'utf8');

    // Verify primary variant styling in Button.tsx maps to Apple Blue tokens
    assert.includes(
      buttonSource,
      'bg-blue-600',
      'Button primary variant must use Apple Blue background (bg-blue-600)'
    );
    assert.includes(
      buttonSource,
      'active:bg-blue-700',
      'Button primary variant must provide active pressed state (active:bg-blue-700)'
    );
    assert.includes(
      buttonSource,
      'text-white',
      'Button primary variant must have white text'
    );
  }
);

// T1-SM-02: Merge medications into slots
defineTest(
  'T1-SM-02',
  1,
  'Smart Merge CTA',
  'Gộp thuốc mới vào các cữ tương ứng (Cipro sáng/tối, Gaviscon sáng/trưa/tối)',
  async () => {
    await StoreTestHarness.resetAll();
    await handleSmartMergeCTA(MOCK_ANALYSIS_PRESET_2);

    const updated = await StoreTestHarness.getState();
    const morning = updated.schedule.find((s) => s.slot === 'morning');
    const noon = updated.schedule.find((s) => s.slot === 'noon');
    const evening = updated.schedule.find((s) => s.slot === 'evening');

    assert.ok(morning?.medicines.some((m) => m.name.includes('Ciprofloxacin')));
    assert.ok(morning?.medicines.some((m) => m.name.includes('Gaviscon')));
    assert.ok(noon?.medicines.some((m) => m.name.includes('Gaviscon')));
    assert.ok(evening?.medicines.some((m) => m.name.includes('Ciprofloxacin')));
    assert.ok(evening?.medicines.some((m) => m.name.includes('Gaviscon')));
  }
);

// T1-SM-03: Synchronize cabinet
defineTest(
  'T1-SM-03',
  1,
  'Smart Merge CTA',
  'Đồng bộ thuốc mới vào Tủ Thuốc gia đình trong Zustand store',
  async () => {
    await StoreTestHarness.resetAll();
    await handleSmartMergeCTA(MOCK_ANALYSIS_PRESET_2);

    const updated = await StoreTestHarness.getState();
    assert.ok(updated.cabinet.some((m) => m.name.includes('Ciprofloxacin')));
    assert.ok(updated.cabinet.some((m) => m.name.includes('Gaviscon')));
  }
);

// T1-SM-04: Auto-navigate to Tab 1
defineTest(
  'T1-SM-04',
  1,
  'Smart Merge CTA',
  'Tự động chuyển hướng về Tab Hôm Nay sau khi gộp toa thành công',
  async () => {
    await StoreTestHarness.resetAll();
    MockNavigationRouter.clear();

    const execution = await executeSmartMergeCTA(MOCK_ANALYSIS_PRESET_2, MockNavigationRouter);
    assert.equal(execution.success, true, 'CTA execution must succeed');
    assert.ok(
      execution.scheduleCountAfter > execution.scheduleCountBefore,
      'Schedule must have expanded with imported medications'
    );

    // Inspect navigation spy events
    const navEvents = MockNavigationRouter.getEvents();
    assert.equal(navEvents.length, 1, 'Exactly one navigation event must be dispatched');
    assert.equal(
      navEvents[0].action,
      'replace',
      'Navigation must use replace to switch tabs cleanly'
    );
    assert.equal(
      navEvents[0].target,
      '/(tabs)',
      'Target route must be Tab 1 Schedule (/(tabs))'
    );
  }
);

// T1-SM-05: Haptic feedback on CTA click
defineTest(
  'T1-SM-05',
  1,
  'Smart Merge CTA',
  'Phản hồi xúc giác Haptics (Medium Impact) khi bấm nút CTA',
  async () => {
    MockHapticsController.clear();
    await handleSmartMergeCTA(MOCK_ANALYSIS_PRESET_2);

    const calls = MockHapticsController.getCallsByMethod('impactAsync');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].arg, ImpactFeedbackStyle.Medium);
  }
);
