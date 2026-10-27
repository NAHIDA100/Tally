import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { View, type ViewStyle } from 'react-native';

import { spacing } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';

/**
 * 统一的安全区容器。edges 默认排除底部：tab 页的底部由自定义 TabBar 自己处理，
 * 再叠一次会让内容区凭空少 34pt。
 */
export function Screen({
  children,
  style,
  edges = ['top', 'left', 'right'],
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: Edge[];
}) {
  const theme = useTheme();
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, paddingHorizontal: spacing.lg, ...style }}>{children}</View>
    </SafeAreaView>
  );
}
