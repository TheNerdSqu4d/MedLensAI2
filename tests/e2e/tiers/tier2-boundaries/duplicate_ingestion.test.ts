import { defineTest, assert } from '../../harness/testContext';
import { StoreTestHarness } from '../../harness/storeTestHarness';
import { MOCK_ANALYSIS_PRESET_1, MOCK_ANALYSIS_PRESET_2, MED_AMLODIPINE } from '@/mocks/mockData';
import type { PrescriptionAnalysisResult } from '@/types/medlens';

// T2-DUP-01: Case-insensitive name match
defineTest(
  'T2-DUP-01',
  2,
  'Duplicate Medicine Ingestion',
  'Thuốc mới trùng tên khác chữ hoa/thường (toLowerCase) không bị thêm dòng thứ 2',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    const lowerCaseAmlodipine: PrescriptionAnalysisResult = {
      doctorName: 'BS Test',
      diagnosis: 'Test',
      medicines: [
        {
          ...MED_AMLODIPINE,
          id: 'diff-id-same-name',
          name: 'amlodipine 5mg', // lowercase!
          timeSlots: ['morning'],
        },
      ],
      warnings: [],
    };

    const countBefore = state.schedule[0].medicines.length;
    state.importPrescription(lowerCaseAmlodipine);

    const updated = await StoreTestHarness.getState();
    const countAfter = updated.schedule[0].medicines.length;

    assert.equal(countAfter, countBefore, 'Should not add duplicate lowercase amlodipine');
  }
);

// T2-DUP-02: Duplicate ID matching
defineTest(
  'T2-DUP-02',
  2,
  'Duplicate Medicine Ingestion',
  'Thuốc trùng ID định danh duy nhất không bị nhân bản',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    const sameIdMed: PrescriptionAnalysisResult = {
      doctorName: 'BS Test',
      diagnosis: 'Test',
      medicines: [
        {
          ...MED_AMLODIPINE,
          name: 'Amlodipine Khác Tên Nhẹ',
          timeSlots: ['morning'],
        },
      ],
      warnings: [],
    };

    const countBefore = state.schedule[0].medicines.length;
    state.importPrescription(sameIdMed);

    const updated = await StoreTestHarness.getState();
    assert.equal(updated.schedule[0].medicines.length, countBefore);
  }
);

// T2-DUP-03: Existing cabinet medicine not duplicated
defineTest(
  'T2-DUP-03',
  2,
  'Duplicate Medicine Ingestion',
  'Thuốc đã có sẵn trong Tủ Thuốc gia đình không bị nhân đôi bản ghi',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    const cabCountBefore = state.cabinet.length;
    // Import Preset 1 which contains Amlodipine, Metformin, Atorvastatin (all already in cabinet)
    state.importPrescription(MOCK_ANALYSIS_PRESET_1);

    const updated = await StoreTestHarness.getState();
    assert.equal(updated.cabinet.length, cabCountBefore, 'Cabinet count should remain unchanged');
  }
);

// T2-DUP-04: Deduplication within prescription
defineTest(
  'T2-DUP-04',
  2,
  'Duplicate Medicine Ingestion',
  'Đơn thuốc quét có 2 dòng thuốc giống nhau được deduplicate hợp lý',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    const doublePrescription: PrescriptionAnalysisResult = {
      doctorName: 'BS Double',
      diagnosis: 'Double trouble',
      medicines: [
        {
          id: 'new-para-1',
          name: 'Paracetamol Extra 500mg',
          activeIngredient: 'Paracetamol',
          dosage: '1 viên',
          mealTiming: 'after_meal',
          instructions: 'Uống sau ăn',
          purpose: 'Giảm đau',
          remainingCount: 10,
          expiryDate: '2027-01-01',
          category: 'Pain Relief',
          timeSlots: ['noon'],
        },
        {
          id: 'new-para-2',
          name: 'Paracetamol Extra 500mg', // identical name
          activeIngredient: 'Paracetamol',
          dosage: '1 viên',
          mealTiming: 'after_meal',
          instructions: 'Uống sau ăn',
          purpose: 'Giảm đau',
          remainingCount: 10,
          expiryDate: '2027-01-01',
          category: 'Pain Relief',
          timeSlots: ['noon'],
        },
      ],
      warnings: [],
    };

    // Directly pass the raw prescription containing duplicate lines into useMedStore
    // The store's Smart Merge engine must autonomously deduplicate without pre-filtering shortcuts
    state.importPrescription(doublePrescription);

    const updated = await StoreTestHarness.getState();
    const noon = updated.schedule.find((s) => s.slot === 'noon');
    const paras = noon?.medicines.filter((m) => m.name.includes('Paracetamol Extra'));
    assert.equal(paras?.length, 1, 'Should only contain 1 Paracetamol Extra in noon slot');

    // Verify cabinet deduplication as well
    const cabParas = updated.cabinet.filter((m) => m.name.includes('Paracetamol Extra'));
    assert.equal(cabParas.length, 1, 'Cabinet should also only contain 1 Paracetamol Extra record');
  }
);

// T2-DUP-05: Multi-slot medicine assignment
defineTest(
  'T2-DUP-05',
  2,
  'Duplicate Medicine Ingestion',
  'Cùng 1 thuốc được chỉ định cho 2 cữ (Sáng và Tối) xuất hiện ở cả 2 cữ nhưng chỉ 1 lần trong tủ',
  async () => {
    await StoreTestHarness.resetAll();
    const state = await StoreTestHarness.getState();

    const multiSlotPrescription: PrescriptionAnalysisResult = {
      doctorName: 'BS Multi',
      diagnosis: 'Multi-slot',
      medicines: [
        {
          id: 'med-azithromycin-500',
          name: 'Azithromycin 500mg',
          activeIngredient: 'Azithromycin',
          dosage: '1 viên',
          mealTiming: 'before_meal',
          instructions: 'Uống trước ăn',
          purpose: 'Kháng sinh',
          remainingCount: 6,
          expiryDate: '2027-05-20',
          category: 'Antibiotics',
          timeSlots: ['morning', 'evening'],
        },
      ],
      warnings: [],
    };

    state.importPrescription(multiSlotPrescription);

    const updated = await StoreTestHarness.getState();
    const morning = updated.schedule.find((s) => s.slot === 'morning');
    const evening = updated.schedule.find((s) => s.slot === 'evening');

    // Appears in morning
    assert.ok(morning?.medicines.some((m) => m.name.includes('Azithromycin')));
    // Appears in evening
    assert.ok(evening?.medicines.some((m) => m.name.includes('Azithromycin')));

    // Only appears once in cabinet
    const inCab = updated.cabinet.filter((m) => m.name.includes('Azithromycin'));
    assert.equal(inCab.length, 1, 'Should only appear once in cabinet');
  }
);
