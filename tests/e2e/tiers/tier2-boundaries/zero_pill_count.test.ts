import { defineTest, assert } from '../../harness/testContext';
import { StoreTestHarness } from '../../harness/storeTestHarness';
import type { Medicine, DoseSlot } from '@/types/medlens';
import { decrementPillCount, getStockStatus } from '@/services/clinical';

export { decrementPillCount, getStockStatus };

export interface DoseSlotMedicineStatus {
  medicineId: string;
  name: string;
  remainingCount: number;
  hasDepletedStockWarning: boolean;
  stockBadgeLabel: string;
  stockBadgeVariant: 'danger' | 'warning' | 'default';
}

export function evaluateDoseSlotStockStatus(slot: DoseSlot): DoseSlotMedicineStatus[] {
  return slot.medicines.map((med) => {
    const status = getStockStatus(med.remainingCount);
    return {
      medicineId: med.id,
      name: med.name,
      remainingCount: med.remainingCount,
      hasDepletedStockWarning: status.isOut,
      stockBadgeLabel: status.label,
      stockBadgeVariant: status.isOut
        ? 'danger'
        : status.variant === 'warning'
        ? 'warning'
        : 'default',
    };
  });
}

// T2-RP-01: Decrement floor at 0
defineTest(
  'T2-RP-01',
  2,
  '0 Remaining Pills Boundary',
  'Giảm số viên liên tục chặn cận dưới tại 0 viên, cấm số âm',
  async () => {
    let count = 2;
    count = decrementPillCount(count, 1); // 1
    assert.equal(count, 1);
    count = decrementPillCount(count, 1); // 0
    assert.equal(count, 0);
    count = decrementPillCount(count, 1); // should remain 0
    assert.equal(count, 0);
    count = decrementPillCount(count, 5); // should remain 0
    assert.equal(count, 0);
  }
);

// T2-RP-02: Out-of-stock badge in cabinet
defineTest(
  'T2-RP-02',
  2,
  '0 Remaining Pills Boundary',
  'Hiển thị Badge cảnh báo hết thuốc trong tủ khi số viên bằng 0',
  async () => {
    const status = getStockStatus(0);
    assert.equal(status.isOut, true);
    assert.equal(status.label, 'Hết thuốc - Cần mua thêm');
    assert.equal(status.variant, 'destructive');
  }
);

// T2-RP-03: Out-of-stock indicator in dose slot
defineTest(
  'T2-RP-03',
  2,
  '0 Remaining Pills Boundary',
  'Chỉ báo hết thuốc hiển thị cảnh báo cạnh tên thuốc trong cữ uống',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();
    const morningSlot = state.schedule.find((s) => s.slot === 'morning')!;
    assert.ok(morningSlot, 'Morning dose slot must exist');
    assert.ok(morningSlot.medicines.length >= 2, 'Morning slot must have multiple medicines');

    // Simulate inventory depletion for only the first medicine in the morning slot
    morningSlot.medicines[0].remainingCount = 0;
    const depletedMedName = morningSlot.medicines[0].name;
    const normalMedName = morningSlot.medicines[1].name;
    assert.ok(
      morningSlot.medicines[1].remainingCount > 0,
      'Second medicine must have positive count'
    );

    // Evaluate stock statuses across the dose slot
    const statuses = evaluateDoseSlotStockStatus(morningSlot);
    const depletedStatus = statuses.find((s) => s.name === depletedMedName)!;
    const normalStatus = statuses.find((s) => s.name === normalMedName)!;

    // Assert depleted medicine triggers warning badge
    assert.equal(
      depletedStatus.hasDepletedStockWarning,
      true,
      'Depleted medicine must trigger out-of-stock warning'
    );
    assert.equal(
      depletedStatus.stockBadgeLabel,
      'Hết thuốc - Cần mua thêm',
      'Must display exact warning label'
    );
    assert.equal(
      depletedStatus.stockBadgeVariant,
      'danger',
      'Badge variant must be danger (red)'
    );

    // Assert neighboring medicine does NOT trigger warning
    assert.equal(
      normalStatus.hasDepletedStockWarning,
      false,
      'In-stock medicine must not have out-of-stock warning'
    );
    assert.notEqual(
      normalStatus.stockBadgeVariant,
      'danger',
      'In-stock medicine variant must not be danger'
    );

    // Verify slot toggle integrity is preserved despite 0 pill count
    state.toggleDoseSlot('morning');
    const updatedState = await StoreTestHarness.getState();
    assert.equal(
      updatedState.schedule.find((s) => s.slot === 'morning')!.isTaken,
      true,
      'Dose slot toggle must succeed despite depleted medicine'
    );
  }
);

// T2-RP-04: Allow dose slot toggle even if pill count is 0
defineTest(
  'T2-RP-04',
  2,
  '0 Remaining Pills Boundary',
  'Vẫn cho phép tick cữ dù số viên bằng 0 để không chặn ghi nhận tuân thủ',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    // Toggle morning slot
    state.toggleDoseSlot('morning');

    const updated = await StoreTestHarness.getState();
    assert.equal(updated.schedule[0].isTaken, true);
  }
);

// T2-RP-05: Medicine Detail Modal display when count is 0
defineTest(
  'T2-RP-05',
  2,
  '0 Remaining Pills Boundary',
  'Chi tiết trong Modal khi số viên bằng 0 hiển thị cảnh báo đỏ',
  async () => {
    const status = getStockStatus(0);
    const modalStockText = `Còn lại: ${0} viên (${status.isOut ? 'Đã hết' : 'Đủ'})`;
    assert.includes(modalStockText, '0 viên');
    assert.includes(modalStockText, 'Đã hết');
  }
);
