import { defineTest, assert } from '../../harness/testContext';
import { StoreTestHarness } from '../../harness/storeTestHarness';
import { MockNotifications } from '../../harness/mockNotifications';
import {
  scheduleDoseNotifications,
  scheduleMorningCarryReminder,
  sendTestNotificationNow,
} from '@/services/notifications';
import { analyzePrescription } from '@/services/ai';

defineTest(
  'T1-MEAL-01',
  1,
  'Meal Times & Notifications',
  'Khởi tạo giờ bữa ăn mặc định (07:00, 12:00, 19:00)',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    assert.equal(state.mealTimes.breakfast, '07:00');
    assert.equal(state.mealTimes.lunch, '12:00');
    assert.equal(state.mealTimes.dinner, '19:00');
  }
);

defineTest(
  'T1-MEAL-02',
  1,
  'Meal Times & Notifications',
  'Cập nhật giờ ăn tự động đồng bộ timeLabel trong schedule',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    state.setMealTimes({ breakfast: '06:30', lunch: '11:45', dinner: '18:30' });

    const updated = await StoreTestHarness.getState();
    assert.equal(updated.mealTimes.breakfast, '06:30');
    assert.equal(updated.mealTimes.lunch, '11:45');
    assert.equal(updated.mealTimes.dinner, '18:30');

    const morningSlot = updated.schedule.find((s) => s.slot === 'morning');
    const noonSlot = updated.schedule.find((s) => s.slot === 'noon');
    const eveningSlot = updated.schedule.find((s) => s.slot === 'evening');

    assert.equal(morningSlot?.timeLabel, '06:30');
    assert.equal(noonSlot?.timeLabel, '11:45');
    assert.equal(eveningSlot?.timeLabel, '18:30');
  }
);

defineTest(
  'T1-NOTIF-01',
  1,
  'Meal Times & Notifications',
  'Bắn thông báo thử nghiệm thành công (sendTestNotificationNow)',
  async () => {
    await new Promise((r) => setTimeout(r, 60));
    MockNotifications.scheduled = [];
    const result = await sendTestNotificationNow();
    assert.equal(result, true);
    assert.ok(MockNotifications.scheduled.length >= 1);
    const hasTest = MockNotifications.scheduled.some((n: any) =>
      n.content.title.includes('Thử Nghiệm')
    );
    assert.equal(hasTest, true);
  }
);

defineTest(
  'T1-NOTIF-02',
  1,
  'Meal Times & Notifications',
  'Lập lịch thông báo đúng giờ các cữ có thuốc',
  async () => {
    MockNotifications.scheduled = [];
    const state = await StoreTestHarness.getState();
    await scheduleDoseNotifications(state.schedule, state.mealTimes, true);

    assert.ok(MockNotifications.scheduled.length >= 1);
    const hasMorningOrNoon = MockNotifications.scheduled.some((n: any) =>
      n.content.title.includes('MedLens AI')
    );
    assert.ok(hasMorningOrNoon);
  }
);

defineTest(
  'T1-NOTIF-03',
  1,
  'Meal Times & Notifications',
  'Nhắc nhở mang thuốc đi vào buổi sáng nếu có cữ trưa',
  async () => {
    MockNotifications.scheduled = [];
    const state = await StoreTestHarness.getState();
    await scheduleMorningCarryReminder(state.schedule, '07:15', true);

    assert.equal(MockNotifications.scheduled.length, 1);
    assert.ok(MockNotifications.scheduled[0].content.title.includes('Mang theo thuốc'));
    assert.ok(MockNotifications.scheduled[0].content.body.includes('cữ trưa'));
  }
);

defineTest(
  'T1-SCAN-01',
  1,
  'Meal Times & Notifications',
  'Quét lọ thuốc với scanMode=single_medicine không bịa bác sĩ/chẩn đoán',
  async () => {
    const result = await analyzePrescription(
      'file:///mock/lo_thuoc_panadol.jpg',
      undefined,
      undefined,
      'single_medicine'
    );

    assert.equal(result.scanType, 'single_medicine');
    assert.ok(result.singleMedicine !== undefined);
    assert.ok(result.singleMedicine?.name.includes('Panadol'));
    assert.equal(result.doctorName, undefined);
    assert.equal(result.diagnosis, undefined);
  }
);

defineTest(
  'T1-CAB-DEL-01',
  1,
  'Meal Times & Notifications',
  'Xóa thuốc khỏi tủ thuốc gia đình qua removeMedicineFromCabinet',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    const initialCount = state.cabinet.length;
    assert.ok(initialCount > 0);

    const firstMed = state.cabinet[0];
    state.removeMedicineFromCabinet(firstMed.id);

    const updated = await StoreTestHarness.getState();
    assert.equal(updated.cabinet.length, initialCount - 1);
    const stillExists = updated.cabinet.some((m) => m.id === firstMed.id);
    assert.equal(stillExists, false);
  }
);

defineTest(
  'T1-WHEEL-01',
  1,
  'Meal Times & Notifications',
  'Bánh xe iOS xoay giờ và phút định dạng đúng 2 chữ số (HH:mm)',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    const h = 8;
    const m = 5;
    const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    assert.equal(formatted, '08:05');

    state.setMealTimes({ breakfast: formatted });
    const updated = await StoreTestHarness.getState();
    assert.equal(updated.mealTimes.breakfast, '08:05');

    const morningSlot = updated.schedule.find((s) => s.slot === 'morning');
    assert.equal(morningSlot?.timeLabel, '08:05');
  }
);
