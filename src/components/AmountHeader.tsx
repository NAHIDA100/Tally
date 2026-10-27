import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View } from 'react-native';

import { amountFont, fontSize, radius, spacing } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';

/**
 * 记一笔顶部的金额卡。
 *
 * 金额用等宽数字：连续按 1→7 时数字宽度不变，否则整串数字会左右跳动。
 */
export function AmountHeader({
  display,
  hint,
  error,
  onClear,
}: {
  display: string;
  hint: string;
  error: boolean;
  onClear: () => void;
}) {
  const theme = useTheme();
  return (
    <LinearGradient
      colors={[theme.gradientFrom, theme.gradientTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        marginHorizontal: spacing.lg,
        marginTop: spacing.lg,
        borderRadius: radius.card,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.xl,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: spacing.sm }}>
        <Text
          style={[
            amountFont,
            {
              color: theme.textOnGradient,
              fontSize: fontSize.amount,
              fontWeight: '700',
            },
          ]}>
          {display}
        </Text>
      </View>
      <Text
        style={{
          color: error ? '#FFE9E2' : theme.textOnGradient,
          opacity: error ? 1 : 0.8,
          fontSize: fontSize.body,
          textAlign: 'center',
          marginTop: spacing.xs,
        }}>
        {hint}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="清空金额"
        onPress={onClear}
        style={{
          position: 'absolute',
          right: spacing.lg,
          bottom: spacing.lg,
          paddingHorizontal: spacing.md,
          paddingVertical: 4,
          borderRadius: radius.pill,
          backgroundColor: 'rgba(255,255,255,0.18)',
        }}>
        <Text style={{ color: theme.textOnGradient, fontSize: fontSize.caption }}>清空</Text>
      </Pressable>
    </LinearGradient>
  );
}
