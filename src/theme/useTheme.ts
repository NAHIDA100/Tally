import { useColorScheme } from 'react-native';

import { useAppStore } from '@/src/store/app';
import { dark, light, type ColorScheme, type Theme } from '@/src/theme/tokens';

/** 用户偏好 + 系统深浅色 → 实际生效的配色 */
export function useResolvedScheme(): ColorScheme {
  const preference = useAppStore((state) => state.themePreference);
  const system = useColorScheme();
  if (preference === 'system') return system === 'dark' ? 'dark' : 'light';
  return preference;
}

export function useTheme(): Theme {
  return useResolvedScheme() === 'dark' ? dark : light;
}

export function useIsDark(): boolean {
  return useResolvedScheme() === 'dark';
}
