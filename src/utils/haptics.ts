import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * 触觉反馈集中在这里。
 *
 * 刻意全部 fire-and-forget 并吞掉异常：震动失败不是错误，
 * 绝不应该让「保存一笔账」因为设备不支持震动而走到 catch 分支去报错。
 * Android 上 selectionAsync 在部分机型是空操作，所以细粒度反馈优先用 impact。
 */
async function fire(task: Promise<unknown>): Promise<void> {
  try {
    await task;
  } catch {
    // 设备不支持震动时静默降级
  }
}

export function hapticSuccess(): void {
  if (Platform.OS === 'android') {
    void fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    return;
  }
  void fire(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function hapticDelete(): void {
  void fire(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

export function hapticSelect(): void {
  if (Platform.OS === 'android') {
    void fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    return;
  }
  void fire(Haptics.selectionAsync());
}
