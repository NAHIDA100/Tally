import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { Pressable, Text, View } from 'react-native';

import { fontSize, radius, spacing } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';

export function UndoToast({
  message,
  onUndo,
  onDismiss,
}: {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
      <Animated.View
        entering={FadeInDown.duration(180)}
        exiting={FadeOut.duration(140)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.text,
          borderRadius: radius.field,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
        }}>
        <Text style={{ color: theme.background, fontSize: fontSize.body, flex: 1 }} numberOfLines={1}>
          {message}
        </Text>
        <Pressable accessibilityRole="button" onPress={onUndo} hitSlop={8} style={{ paddingLeft: spacing.lg }}>
          <Text style={{ color: theme.primary, fontSize: fontSize.body, fontWeight: '600' }}>撤销</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="关闭提示" onPress={onDismiss} hitSlop={8} style={{ paddingLeft: spacing.md }}>
          <Text style={{ color: theme.textMuted, fontSize: fontSize.body }}>×</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
