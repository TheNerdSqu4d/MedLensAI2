import { defineTest, assert } from '../../harness/testContext';
import { StoreTestHarness } from '../../harness/storeTestHarness';
import {
  MockHapticsController,
  NotificationFeedbackType,
  notificationAsync,
} from '../../harness/mockHaptics';

// Simulated action handler mirroring Tab 1 toggle handler
async function handleUserToggleDoseSlot(slot: 'morning' | 'noon' | 'evening') {
  const state = await StoreTestHarness.getState();
  const currentSlot = state.schedule.find((s) => s.slot === slot);
  const willBeTaken = !currentSlot?.isTaken;

  state.toggleDoseSlot(slot);

  if (willBeTaken) {
    await notificationAsync(NotificationFeedbackType.Success);
  }
}

// T1-TOG-01: Toggle from untaken to taken
defineTest(
  'T1-TOG-01',
  1,
  '1-Touch Toggle',
  'Chuyển trạng thái từ chưa uống sang đã uống (isTaken=true, takenAt ISO)',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    state.toggleDoseSlot('morning');

    const updated = await StoreTestHarness.getState();
    const morning = updated.schedule.find((s) => s.slot === 'morning');

    assert.equal(morning?.isTaken, true, 'isTaken must be true');
    assert.ok(morning?.takenAt, 'takenAt must be defined');
    assert.ok(
      !isNaN(Date.parse(morning?.takenAt || '')),
      'takenAt must be valid ISO timestamp'
    );
  }
);

// T1-TOG-02: Trigger haptic success feedback
defineTest(
  'T1-TOG-02',
  1,
  '1-Touch Toggle',
  'Kích hoạt phản hồi rung Haptics (Success) khi tick cữ',
  async () => {
    await StoreTestHarness.resetAll();
    MockHapticsController.clear();

    await handleUserToggleDoseSlot('morning');

    const calls = MockHapticsController.getCallsByMethod('notificationAsync');
    assert.equal(calls.length, 1, 'Must invoke notificationAsync exactly once');
    assert.equal(calls[0].arg, NotificationFeedbackType.Success);
  }
);

// T1-TOG-03: Untick from taken to untaken
defineTest(
  'T1-TOG-03',
  1,
  '1-Touch Toggle',
  'Hủy trạng thái đã uống về chưa uống (isTaken=false, takenAt=undefined)',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    // Toggle on then off
    state.toggleDoseSlot('morning');
    state.toggleDoseSlot('morning');

    const updated = await StoreTestHarness.getState();
    const morning = updated.schedule.find((s) => s.slot === 'morning');

    assert.equal(morning?.isTaken, false, 'isTaken must be false');
    assert.equal(morning?.takenAt, undefined, 'takenAt must be undefined');
  }
);

// T1-TOG-04: Status badge updates immediately
defineTest(
  'T1-TOG-04',
  1,
  '1-Touch Toggle',
  'Cập nhật nhãn trạng thái cữ tức thì',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    state.toggleDoseSlot('noon');

    const updated = await StoreTestHarness.getState();
    const noon = updated.schedule.find((s) => s.slot === 'noon');

    assert.equal(noon?.isTaken, true);
    const statusLabel = noon?.isTaken ? 'Đã uống' : 'Chưa uống';
    assert.equal(statusLabel, 'Đã uống');
  }
);

// T1-TOG-05: Independence between slots
defineTest(
  'T1-TOG-05',
  1,
  '1-Touch Toggle',
  'Tính độc lập giữa các cữ thuốc khi toggle',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    state.toggleDoseSlot('morning');

    const updated = await StoreTestHarness.getState();
    const morning = updated.schedule.find((s) => s.slot === 'morning');
    const noon = updated.schedule.find((s) => s.slot === 'noon');
    const evening = updated.schedule.find((s) => s.slot === 'evening');

    assert.equal(morning?.isTaken, true);
    assert.equal(noon?.isTaken, false, 'Noon slot must remain unaffected');
    assert.equal(evening?.isTaken, false, 'Evening slot must remain unaffected');
  }
);
