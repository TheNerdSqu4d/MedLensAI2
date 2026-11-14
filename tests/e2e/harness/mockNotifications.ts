const MockNotifications: any = {
  scheduled: [] as any[],
  setNotificationHandler: () => {},
  getPermissionsAsync: async () => ({ status: 'granted' }),
  requestPermissionsAsync: async () => ({ status: 'granted' }),
  scheduleNotificationAsync: async (options: any) => {
    MockNotifications.scheduled.push(options);
    return `notif-${Date.now()}-${Math.random()}`;
  },
  cancelAllScheduledNotificationsAsync: async () => {
    MockNotifications.scheduled = [];
  },
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
    TIME_INTERVAL: 'timeInterval',
  },
  AndroidNotificationPriority: {
    HIGH: 'high',
    DEFAULT: 'default',
  },
};

MockNotifications.MockNotifications = MockNotifications;

export { MockNotifications };
export default MockNotifications;
declare const module: any;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MockNotifications;
}
