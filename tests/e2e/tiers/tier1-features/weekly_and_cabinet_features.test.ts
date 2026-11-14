import { defineTest, assert } from '../../harness/testContext';
import { StoreTestHarness } from '../../harness/storeTestHarness';
import { useMedStore } from '@/store/useMedStore';
import { MOCK_ALL_WEEKS } from '@/mocks/mockData';

defineTest(
  'T1-WEEK-01',
  1,
  'Lịch Tuần & Đa Tuần',
  'Cấu trúc dữ liệu lịch lưu 1 tháng tức 4 tuần tròn (Tuần 1, Tuần 2, Tuần 3, Tuần 4)',
  async () => {
    assert.ok(Array.isArray(MOCK_ALL_WEEKS), 'MOCK_ALL_WEEKS must be an array');
    assert.equal(MOCK_ALL_WEEKS.length, 4, 'Must contain exactly 4 weeks of a full month');

    assert.equal(MOCK_ALL_WEEKS[0].label, 'Tuần 1');
    assert.equal(MOCK_ALL_WEEKS[1].label, 'Tuần 2');
    assert.equal(MOCK_ALL_WEEKS[2].label, 'Tuần 3');
    assert.equal(MOCK_ALL_WEEKS[3].label, 'Tuần 4');
  }
);

defineTest(
  'T1-WEEK-02',
  1,
  'Lịch Tuần & Đa Tuần',
  'Bấm vào ngày đỏ hiển thị chi tiết cữ chưa uống',
  async () => {
    const curWeek = MOCK_ALL_WEEKS[1];
    const missedDay = curWeek.matrix.find((d) => d.dayLabel === 'T4');
    assert.ok(missedDay, 'Must find T4 in matrix');
    assert.equal(missedDay!.noon, false, 'Noon dose was missed');
    assert.ok(Array.isArray(missedDay!.missedDetails), 'Must have missedDetails array');
    assert.ok(missedDay!.missedDetails!.length > 0, 'Must have at least 1 missed detail');
    assert.ok(missedDay!.missedDetails![0].medicineName.includes('Metformin'), 'Missed med is Metformin');
  }
);

defineTest(
  'T1-CAB-01',
  1,
  'Tủ Thuốc & Thành Viên',
  'Cập nhật giờ ăn/uống riêng cho từng thành viên',
  async () => {
    await StoreTestHarness.resetAll();
    const store = useMedStore.getState();
    assert.equal(typeof store.updateMemberMealTimes, 'function', 'updateMemberMealTimes must be defined');

    store.updateMemberMealTimes!('bo', { breakfast: '06:00', lunch: '11:00', dinner: '18:00' });
    const bo = useMedStore.getState().familyMembers.find((m) => m.id === 'bo');
    assert.equal(bo?.mealTimes?.breakfast, '06:00');
    assert.equal(bo?.mealTimes?.lunch, '11:00');
    assert.equal(bo?.mealTimes?.dinner, '18:00');
  }
);

defineTest(
  'T1-CAB-02',
  1,
  'Tủ Thuốc & Thành Viên',
  'Uống thuốc tự động giảm số viên trong tủ và xóa thuốc khỏi tủ xóa khỏi tất cả lịch',
  async () => {
    await StoreTestHarness.resetAll();
    const initialCabinet = useMedStore.getState().cabinet;
    const targetMed = initialCabinet.find((m) => m.name.includes('Amlodipine'));
    assert.ok(targetMed, 'Must have Amlodipine in cabinet');
    const initialCount = targetMed!.remainingCount;

    // Uống thuốc cữ sáng -> trừ 1 viên trong tủ
    useMedStore.getState().toggleMedicineTaken('morning', targetMed!.id);
    const cabinetAfterTaken = useMedStore.getState().cabinet;
    const medAfterTaken = cabinetAfterTaken.find((m) => m.id === targetMed!.id);
    assert.equal(medAfterTaken?.remainingCount, initialCount - 1, 'Remaining count must decrease by 1');

    // Xóa thuốc khỏi tủ -> tự động biến mất khỏi schedule
    useMedStore.getState().removeMedicineFromCabinet(targetMed!.id);
    const finalCabinet = useMedStore.getState().cabinet;
    assert.ok(!finalCabinet.some((m) => m.id === targetMed!.id), 'Medicine must be removed from cabinet');

    const finalSchedule = useMedStore.getState().schedule;
    const morningSlot = finalSchedule.find((s) => s.slot === 'morning');
    assert.ok(!morningSlot?.medicines.some((m) => m.id === targetMed!.id), 'Medicine must be removed from morning schedule');
  }
);
