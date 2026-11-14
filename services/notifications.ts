import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { DoseSlot, MealTimes, TimeSlot } from '@/types/medlens';

// Cấu hình Notification Handler để hiển thị banner, chuông ngay cả khi app đang mở (Foreground)
if (Platform.OS !== 'web') {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      } as any),
    });
  } catch (err) {
    console.warn('Không thể khởi tạo Notification Handler:', err);
  }
}

/**
 * Yêu cầu quyền thông báo từ hệ điều hành iOS / Android
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (err) {
    console.warn('Lỗi xin quyền thông báo:', err);
    return false;
  }
}

/**
 * Tách chuỗi giờ "HH:mm" thành { hours, minutes }
 */
export function parseTimeString(timeStr?: string, defaultHour = 8, defaultMinute = 0): { hours: number; minutes: number } {
  if (!timeStr || !timeStr.includes(':')) {
    return { hours: defaultHour, minutes: defaultMinute };
  }
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  return {
    hours: isNaN(hours) ? defaultHour : Math.min(23, Math.max(0, hours)),
    minutes: isNaN(minutes) ? defaultMinute : Math.min(59, Math.max(0, minutes)),
  };
}

const SLOT_TITLES: Record<TimeSlot, string> = {
  morning: 'Cữ Sáng',
  noon: 'Cữ Trưa',
  evening: 'Cữ Tối',
};

/**
 * Lập lịch thông báo hàng ngày theo đúng giờ của từng cữ thuốc (Sáng, Trưa, Tối)
 */
export async function scheduleDoseNotifications(
  schedule: DoseSlot[],
  mealTimes: MealTimes,
  enabled = true
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission || !enabled) {
      return;
    }

    // Lập lịch cho từng cữ có thuốc
    for (const slot of schedule) {
      if (!slot.medicines || slot.medicines.length === 0) continue;

      let timeStr = slot.timeLabel;
      if (slot.slot === 'morning') timeStr = mealTimes.breakfast || '07:00';
      if (slot.slot === 'noon') timeStr = mealTimes.lunch || '12:00';
      if (slot.slot === 'evening') timeStr = mealTimes.dinner || '19:00';

      const { hours, minutes } = parseTimeString(timeStr);
      const slotTitle = SLOT_TITLES[slot.slot] || 'Cữ uống';
      const medListText = slot.medicines
        .map((m) => `${m.name} (${m.dosage})`)
        .join(', ');

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🔔 MedLens AI: Đến giờ uống ${slotTitle} (${timeStr})`,
          body: `Thuốc cần uống: ${medListText}. Chúc bạn tuân thủ đúng liệu trình!`,
          sound: true,
          data: { slot: slot.slot, type: 'dose_reminder' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: hours,
          minute: minutes,
        } as any,
      });
    }
  } catch (err) {
    console.warn('Lỗi lập lịch thông báo cữ thuốc:', err);
  }
}

/**
 * Lập lịch thông báo buổi sáng (07:15): Nhắc nhở mang thuốc đi làm/đi học
 */
export async function scheduleMorningCarryReminder(
  schedule: DoseSlot[],
  morningTime: string,
  enabled = true
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission || !enabled) return;

    // Tìm cữ trưa xem có thuốc cần uống không
    const noonSlot = schedule.find((s) => s.slot === 'noon');
    if (!noonSlot || !noonSlot.medicines || noonSlot.medicines.length === 0) {
      return;
    }

    const { hours, minutes } = parseTimeString(morningTime, 7, 15);
    const noonMedNames = noonSlot.medicines.map((m) => m.name).join(', ');
    const noonTime = noonSlot.timeLabel || '12:00';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '☀️ Nhắc nhở buổi sáng: Mang theo thuốc',
        body: `Hôm nay bạn có cữ trưa (${noonTime}) gồm: ${noonMedNames}. Nhớ bỏ thuốc vào túi/balo trước khi ra ngoài nhé!`,
        sound: true,
        data: { type: 'morning_carry_reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: hours,
        minute: minutes,
      } as any,
    });
  } catch (err) {
    console.warn('Lỗi lập lịch nhắc nhở mang thuốc buổi sáng:', err);
  }
}

/**
 * Hủy toàn bộ thông báo đã lên lịch và thiết lập lại theo cài đặt mới
 */
export async function rescheduleAllNotifications(
  schedule: DoseSlot[],
  mealTimes: MealTimes,
  notificationsEnabled = true,
  morningReminderEnabled = true
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!notificationsEnabled) return;

    await scheduleDoseNotifications(schedule, mealTimes, notificationsEnabled);
    if (morningReminderEnabled) {
      await scheduleMorningCarryReminder(schedule, mealTimes.breakfast || '07:00', morningReminderEnabled);
    }
  } catch (err) {
    console.warn('Lỗi rescheduleAllNotifications:', err);
  }
}

/**
 * Gửi ngay 1 thông báo thử nghiệm (Test sau 2-3 giây) phục vụ Demo trực quan
 */
export async function sendTestNotificationNow(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return false;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 [Thử Nghiệm] MedLens AI — Đến giờ uống thuốc',
        body: 'Cữ Trưa (12:00): Metformin 500mg (1 viên, sau ăn no). Hãy uống với 1 cốc nước đầy!',
        sound: true,
        data: { type: 'test_demo' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
      } as any,
    });
    return true;
  } catch (err) {
    console.warn('Lỗi gửi thông báo thử nghiệm:', err);
    return false;
  }
}
