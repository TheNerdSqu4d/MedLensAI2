import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  MedState,
  TimeSlot,
  Medicine,
  DoseSlot,
  PrescriptionAnalysisResult,
  HealthProfile,
  MealTimes,
} from '@/types/medlens';
import { MOCK_SCHEDULE, MOCK_CABINET, MOCK_FAMILY_MEMBERS } from '@/mocks/mockData';
import { rescheduleAllNotifications } from '@/services/notifications';

const DEFAULT_MEAL_TIMES: MealTimes = {
  breakfast: '07:00',
  lunch: '12:00',
  dinner: '19:00',
};

export const useMedStore = create<MedState>()(
  persist(
    (set, get) => ({
      schedule: MOCK_SCHEDULE,
      cabinet: MOCK_CABINET,
      selectedMedicine: null,
      familyMembers: MOCK_FAMILY_MEMBERS,
      activeMemberId: 'tam',
      notificationScope: 'all',
      mealTimes: DEFAULT_MEAL_TIMES,
      notificationsEnabled: true,
      morningReminderEnabled: true,
      memberSchedules: {
        tam: MOCK_SCHEDULE,
        bo: MOCK_SCHEDULE.map((s) => ({ ...s, medicines: s.medicines.filter((_, i) => i === 0) })),
        me: MOCK_SCHEDULE.map((s) => ({ ...s, medicines: s.medicines.filter((_, i) => i > 0) })),
      },

      setMealTimes: (times: Partial<MealTimes>) => {
        const { mealTimes, schedule, memberSchedules, notificationsEnabled, morningReminderEnabled } = get();
        const updatedMealTimes = { ...mealTimes, ...times };

        const updateSlotTimeLabel = (slot: DoseSlot) => {
          if (slot.slot === 'morning' && updatedMealTimes.breakfast) {
            return { ...slot, timeLabel: updatedMealTimes.breakfast };
          }
          if (slot.slot === 'noon' && updatedMealTimes.lunch) {
            return { ...slot, timeLabel: updatedMealTimes.lunch };
          }
          if (slot.slot === 'evening' && updatedMealTimes.dinner) {
            return { ...slot, timeLabel: updatedMealTimes.dinner };
          }
          return slot;
        };

        const updatedSchedule = schedule.map(updateSlotTimeLabel);

        const updatedMemberSchedules: Record<string, DoseSlot[]> = {};
        if (memberSchedules) {
          for (const [mId, mSlots] of Object.entries(memberSchedules)) {
            updatedMemberSchedules[mId] = mSlots.map(updateSlotTimeLabel);
          }
        }

        set({
          mealTimes: updatedMealTimes,
          schedule: updatedSchedule,
          memberSchedules: updatedMemberSchedules,
        });

        try {
          rescheduleAllNotifications(updatedSchedule, updatedMealTimes, notificationsEnabled, morningReminderEnabled);
        } catch {}
      },

      setNotificationsEnabled: (enabled: boolean) => {
        set({ notificationsEnabled: enabled });
        const { schedule, mealTimes, morningReminderEnabled } = get();
        try {
          rescheduleAllNotifications(schedule, mealTimes, enabled, morningReminderEnabled);
        } catch {}
      },

      setMorningReminderEnabled: (enabled: boolean) => {
        set({ morningReminderEnabled: enabled });
        const { schedule, mealTimes, notificationsEnabled } = get();
        try {
          rescheduleAllNotifications(schedule, mealTimes, notificationsEnabled, enabled);
        } catch {}
      },

      setActiveMember: (memberId: string) => {
        const { memberSchedules, schedule, activeMemberId } = get();
        const currentSchedules = {
          ...(memberSchedules || {}),
          [activeMemberId]: schedule,
        };
        const nextSchedule = currentSchedules[memberId] || MOCK_SCHEDULE;
        set({
          activeMemberId: memberId,
          memberSchedules: currentSchedules,
          schedule: nextSchedule,
        });
      },

      addFamilyMember: (name: string, relation: string, healthProfile?: HealthProfile) => {
        const id = `member-${Date.now()}`;
        const newMember = {
          id,
          name,
          relation,
          avatarColor: '#059669',
          role: 'patient' as const,
          healthProfile: healthProfile || {
            bloodType: 'Chưa rõ',
            dobYear: 1995,
            gender: 'Khác' as const,
            chronicConditions: [],
            allergies: ['Chưa ghi nhận dị ứng thuốc'],
            metrics: {
              bloodPressure: '120/80 mmHg',
              bloodSugar: '5.4 mmol/L',
              weight: '60 kg',
              height: '165 cm',
            },
            doctorNotes: 'Hồ sơ sức khỏe mới tạo. Vui lòng cập nhật đầy đủ thông tin y tế.',
          },
        };
        const { familyMembers, memberSchedules } = get();
        set({
          familyMembers: [...familyMembers, newMember],
          memberSchedules: {
            ...(memberSchedules || {}),
            [id]: MOCK_SCHEDULE.map((s) => ({ ...s, medicines: [], isTaken: false })),
          },
        });
      },

      setNotificationScope: (scope: 'all' | 'me') => {
        set({ notificationScope: scope });
      },

      toggleDoseSlot: (slot: TimeSlot) => {
        set((state) => {
          const newSchedule = state.schedule.map((doseSlot) => {
            if (doseSlot.slot !== slot) return doseSlot;
            const willBeTaken = !doseSlot.isTaken;
            return {
              ...doseSlot,
              isTaken: willBeTaken,
              takenAt: willBeTaken ? new Date().toISOString() : undefined,
              medicines: doseSlot.medicines.map((m) => ({ ...m, isTaken: willBeTaken })),
            };
          });

          return {
            schedule: newSchedule,
            memberSchedules: {
              ...(state.memberSchedules || {}),
              [state.activeMemberId]: newSchedule,
            },
          };
        });
      },

      toggleMedicineTaken: (slot: TimeSlot, medicineId: string) => {
        set((state) => {
          const newSchedule = state.schedule.map((doseSlot) => {
            if (doseSlot.slot !== slot) return doseSlot;
            const updatedMeds = doseSlot.medicines.map((m) =>
              m.id === medicineId ? { ...m, isTaken: !m.isTaken } : m
            );
            const allTaken = updatedMeds.length > 0 && updatedMeds.every((m) => m.isTaken);
            return {
              ...doseSlot,
              medicines: updatedMeds,
              isTaken: allTaken,
              takenAt: allTaken ? doseSlot.takenAt || new Date().toISOString() : undefined,
            };
          });

          return {
            schedule: newSchedule,
            memberSchedules: {
              ...(state.memberSchedules || {}),
              [state.activeMemberId]: newSchedule,
            },
          };
        });
      },

      importPrescription: (analysis: PrescriptionAnalysisResult) => {
        const { schedule, cabinet } = get();

        // 1. Smart Merge into schedule:
        // For each medicine in analysis, if assigned to a timeSlot, add it if not already in that slot.
        // Crucially preserve each slot's isTaken and takenAt status!
        const updatedSchedule = schedule.map((doseSlot) => {
          const medicinesToAdd: Medicine[] = [];

          for (const analyzedMed of analysis.medicines) {
            if (analyzedMed.timeSlots && analyzedMed.timeSlots.includes(doseSlot.slot)) {
              const alreadyExists =
                doseSlot.medicines.some(
                  (existing) =>
                    existing.id === analyzedMed.id ||
                    existing.name.trim().toLowerCase() === analyzedMed.name.trim().toLowerCase()
                ) ||
                medicinesToAdd.some(
                  (pending) =>
                    pending.id === analyzedMed.id ||
                    pending.name.trim().toLowerCase() === analyzedMed.name.trim().toLowerCase()
                );

              if (!alreadyExists) {
                // Strip timeSlots property to keep pure Medicine
                const { timeSlots: _, ...cleanMedicine } = analyzedMed;
                medicinesToAdd.push(cleanMedicine);
              }
            }
          }

          if (medicinesToAdd.length === 0) {
            return doseSlot;
          }

          return {
            ...doseSlot,
            medicines: [...doseSlot.medicines, ...medicinesToAdd],
            // Strictly preserve isTaken and takenAt
            isTaken: doseSlot.isTaken,
            takenAt: doseSlot.takenAt,
          };
        });

        // 2. Synchronize new medicines into the cabinet
        const updatedCabinet = [...cabinet];
        for (const analyzedMed of analysis.medicines) {
          const alreadyInCabinet = updatedCabinet.some(
            (cabMed) =>
              cabMed.id === analyzedMed.id ||
              cabMed.name.trim().toLowerCase() === analyzedMed.name.trim().toLowerCase()
          );

          if (!alreadyInCabinet) {
            const { timeSlots: _, ...cleanMedicine } = analyzedMed;
            updatedCabinet.push(cleanMedicine);
          }
        }

        set({
          schedule: updatedSchedule,
          cabinet: updatedCabinet,
        });
      },

      addSingleMedicine: (
        medicine: Medicine,
        timeSlots: TimeSlot[] = ['morning'],
        addToCabinet = true,
        addToSchedule = true,
        memberId?: string
      ) => {
        const { schedule, cabinet, activeMemberId, memberSchedules } = get();
        const targetId = memberId || activeMemberId;

        // Retrieve the schedule of target member
        const baseSchedule =
          targetId === activeMemberId
            ? schedule
            : memberSchedules?.[targetId] || [
                { slot: 'morning', timeLabel: '08:00', medicines: [], isTaken: false },
                { slot: 'noon', timeLabel: '12:30', medicines: [], isTaken: false },
                { slot: 'evening', timeLabel: '20:00', medicines: [], isTaken: false },
              ];

        let targetSchedule = baseSchedule;

        if (addToSchedule && timeSlots && timeSlots.length > 0) {
          targetSchedule = baseSchedule.map((doseSlot) => {
            if (!timeSlots.includes(doseSlot.slot)) return doseSlot;
            const exists = doseSlot.medicines.some(
              (m) =>
                m.id === medicine.id ||
                m.name.trim().toLowerCase() === medicine.name.trim().toLowerCase()
            );
            if (exists) return doseSlot;
            return {
              ...doseSlot,
              medicines: [...doseSlot.medicines, medicine],
            };
          });
        }

        let newCabinet = cabinet;
        if (addToCabinet) {
          const exists = cabinet.some(
            (m) =>
              m.id === medicine.id ||
              m.name.trim().toLowerCase() === medicine.name.trim().toLowerCase()
          );
          if (!exists) {
            newCabinet = [...cabinet, medicine];
          }
        }

        const updatedSchedules = {
          ...(memberSchedules || {}),
          [activeMemberId]: targetId === activeMemberId ? targetSchedule : schedule,
          [targetId]: targetSchedule,
        };

        set({
          activeMemberId: targetId, // Automatically switch active profile so user sees it right away!
          schedule: targetSchedule,
          memberSchedules: updatedSchedules,
          cabinet: newCabinet,
        });
      },

      addMedicines: (
        medicines: (Medicine & { timeSlots: TimeSlot[] })[],
        addToCabinet: boolean,
        addToSchedule: boolean,
        memberId?: string
      ) => {
        const { schedule, cabinet, activeMemberId, memberSchedules } = get();
        const targetId = memberId || activeMemberId;

        const baseSchedule =
          targetId === activeMemberId
            ? schedule
            : memberSchedules?.[targetId] || [
                { slot: 'morning', timeLabel: '08:00', medicines: [], isTaken: false },
                { slot: 'noon', timeLabel: '12:30', medicines: [], isTaken: false },
                { slot: 'evening', timeLabel: '20:00', medicines: [], isTaken: false },
              ];

        let targetSchedule = baseSchedule;

        if (addToSchedule) {
          targetSchedule = baseSchedule.map((doseSlot) => {
            const medsToAdd: Medicine[] = [];
            for (const med of medicines) {
              if (med.timeSlots && med.timeSlots.includes(doseSlot.slot)) {
                const alreadyExists =
                  doseSlot.medicines.some(
                    (ex) =>
                      ex.id === med.id ||
                      ex.name.trim().toLowerCase() === med.name.trim().toLowerCase()
                  ) ||
                  medsToAdd.some(
                    (pen) =>
                      pen.id === med.id ||
                      pen.name.trim().toLowerCase() === med.name.trim().toLowerCase()
                  );
                if (!alreadyExists) {
                  const { timeSlots: _, ...clean } = med;
                  medsToAdd.push(clean);
                }
              }
            }
            if (medsToAdd.length === 0) return doseSlot;
            return {
              ...doseSlot,
              medicines: [...doseSlot.medicines, ...medsToAdd],
            };
          });
        }

        let newCabinet = cabinet;
        if (addToCabinet) {
          const updatedCab = [...newCabinet];
          for (const med of medicines) {
            const exists = updatedCab.some(
              (m) =>
                m.id === med.id ||
                m.name.trim().toLowerCase() === med.name.trim().toLowerCase()
            );
            if (!exists) {
              const { timeSlots: _, ...clean } = med;
              updatedCab.push(clean);
            }
          }
          newCabinet = updatedCab;
        }

        const updatedSchedules = {
          ...(memberSchedules || {}),
          [activeMemberId]: targetId === activeMemberId ? targetSchedule : schedule,
          [targetId]: targetSchedule,
        };

        set({
          activeMemberId: targetId, // Automatically switch active profile so user sees it right away!
          schedule: targetSchedule,
          memberSchedules: updatedSchedules,
          cabinet: newCabinet,
        });
      },

      updateMedicine: (medicineOrId: Medicine | string, updates?: Partial<Medicine>) => {
        const { schedule, cabinet, memberSchedules } = get();
        const targetId = typeof medicineOrId === 'string' ? medicineOrId : medicineOrId.id;
        const patch = typeof medicineOrId === 'string' ? updates || {} : medicineOrId;

        const updatedSchedule = schedule.map((slot) => ({
          ...slot,
          medicines: slot.medicines.map((m) =>
            m.id === targetId ? { ...m, ...patch } : m
          ),
        }));

        const updatedCabinet = cabinet.map((m) =>
          m.id === targetId ? { ...m, ...patch } : m
        );

        // Also update member schedules
        const updatedMemberSchedules: Record<string, DoseSlot[]> = {};
        if (memberSchedules) {
          for (const [memId, memSlots] of Object.entries(memberSchedules)) {
            updatedMemberSchedules[memId] = memSlots.map((slot) => ({
              ...slot,
              medicines: slot.medicines.map((m) =>
                m.id === targetId ? { ...m, ...patch } : m
              ),
            }));
          }
        }

        set({
          cabinet: updatedCabinet,
          schedule: updatedSchedule,
          memberSchedules: updatedMemberSchedules,
        });
      },

      removeMedicineFromCabinet: (medicineId: string) => {
        set((state) => ({
          cabinet: state.cabinet.filter((m) => m.id !== medicineId),
          selectedMedicine:
            state.selectedMedicine?.id === medicineId ? null : state.selectedMedicine,
        }));
      },

      updateHealthProfile: (memberId: string, profile: Partial<HealthProfile>) => {
        set((state) => ({
          familyMembers: state.familyMembers.map((m) => {
            if (m.id !== memberId) return m;
            return {
              ...m,
              healthProfile: {
                ...(m.healthProfile || { chronicConditions: [], allergies: [] }),
                ...profile,
                metrics: {
                  ...(m.healthProfile?.metrics || {}),
                  ...(profile.metrics || {}),
                },
              },
            };
          }),
        }));
      },

      resetToDemo: () => {
        set({
          schedule: MOCK_SCHEDULE.map((slot) => ({
            ...slot,
            medicines: slot.medicines.map((med) => ({ ...med })),
            isTaken: false,
            takenAt: undefined,
          })),
          cabinet: MOCK_CABINET.map((med) => ({ ...med })),
          selectedMedicine: null,
          familyMembers: MOCK_FAMILY_MEMBERS.map((m) => ({ ...m })),
          activeMemberId: 'tam',
          notificationScope: 'all',
          mealTimes: { ...DEFAULT_MEAL_TIMES },
          notificationsEnabled: true,
          morningReminderEnabled: true,
        });
      },

      setSelectedMedicine: (medicine: Medicine | null) => {
        set({ selectedMedicine: medicine });
      },

      updateMedicineCount: (medicineId: string, count: number) => {
        set((state) => ({
          cabinet: state.cabinet.map((m) =>
            m.id === medicineId ? { ...m, remainingCount: Math.max(0, count) } : m
          ),
        }));
      },
    }),
    {
      name: 'medlens-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
