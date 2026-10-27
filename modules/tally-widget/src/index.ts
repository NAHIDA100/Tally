import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

interface TallyWidgetNativeModule {
  refresh(): void;
}

/**
 * 桌面卡片只在 Android 上有实现，而且在 Expo Go / web 里这个原生模块根本不存在。
 * 所以这里一律静默降级：调用方不该因为「卡片没刷新」而把记账流程带崩。
 */
let cached: TallyWidgetNativeModule | null | undefined;

function loadModule(): TallyWidgetNativeModule | null {
  if (cached !== undefined) return cached;
  if (Platform.OS !== 'android') {
    cached = null;
    return null;
  }
  try {
    cached = requireNativeModule<TallyWidgetNativeModule>('TallyWidget');
  } catch (error) {
    // Expo Go 里没有这个模块。这里必须留一条日志：真机上「模块没注册」和
    // 「刷新没生效」在桌面上完全一样，都是卡片一动不动，只能靠这条区分。
    console.warn('桌面卡片刷新不可用（Expo Go / 未链接原生模块时属正常）:', error);
    cached = null;
  }
  return cached;
}

export function refreshTallyWidgets(): void {
  try {
    loadModule()?.refresh();
  } catch (error) {
    // 刷新失败最坏只是卡片停留在旧数字，系统仍会按 updatePeriodMillis 兜底
    console.warn('桌面卡片刷新调用失败:', error);
  }
}
