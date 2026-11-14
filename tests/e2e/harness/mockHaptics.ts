export enum ImpactFeedbackStyle {
  Light = 'light',
  Medium = 'medium',
  Heavy = 'heavy',
  Soft = 'soft',
  Rigid = 'rigid',
}

export enum NotificationFeedbackType {
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
}

export interface HapticCall {
  method: 'impactAsync' | 'notificationAsync' | 'selectionAsync';
  arg?: any;
  timestamp: number;
}

export class MockHapticsController {
  private static calls: HapticCall[] = [];

  static recordCall(method: HapticCall['method'], arg?: any) {
    this.calls.push({ method, arg, timestamp: Date.now() });
  }

  static getCalls(): HapticCall[] {
    return [...this.calls];
  }

  static getCallsByMethod(method: HapticCall['method']): HapticCall[] {
    return this.calls.filter((c) => c.method === method);
  }

  static clear(): void {
    this.calls = [];
  }
}

export async function impactAsync(style: ImpactFeedbackStyle = ImpactFeedbackStyle.Medium): Promise<void> {
  MockHapticsController.recordCall('impactAsync', style);
}

export async function notificationAsync(type: NotificationFeedbackType = NotificationFeedbackType.Success): Promise<void> {
  MockHapticsController.recordCall('notificationAsync', type);
}

export async function selectionAsync(): Promise<void> {
  MockHapticsController.recordCall('selectionAsync');
}
