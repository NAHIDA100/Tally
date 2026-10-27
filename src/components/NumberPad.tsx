import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { fontSize, radius, spacing } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';
import type { Theme } from '@/src/theme/tokens';

const DIGIT_ROWS = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
];

/**
 * 自绘常驻数字键盘。
 *
 * 不用系统键盘：系统键盘有焦点闪烁与高度跳动，且每次都要多点一下才能收起，
 * 与「3 秒记一笔」直接冲突。键盘常驻后，金额 → 分类 → 保存是一条不离开屏幕的动线。
 */
export function NumberPad({
  onDigit,
  onDot,
  onBackspace,
  onSubmit,
  submitEnabled,
  submitLabel = '保存',
}: {
  onDigit: (digit: string) => void;
  onDot: () => void;
  onBackspace: () => void;
  onSubmit: () => void;
  submitEnabled: boolean;
  submitLabel?: string;
}) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', padding: spacing.sm, gap: spacing.sm }}>
      <View style={{ flex: 3, gap: spacing.sm }}>
        {DIGIT_ROWS.map((row) => (
          <View key={row.join('')} style={{ flexDirection: 'row', gap: spacing.sm }}>
            {row.map((digit) => (
              <Key key={digit} theme={theme} flex={1} onPress={() => onDigit(digit)} label={digit} />
            ))}
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Key theme={theme} flex={1} onPress={onDot} label="." />
          <Key theme={theme} flex={2} onPress={() => onDigit('0')} label="0" />
        </View>
      </View>

      <View style={{ flex: 1.4, gap: spacing.sm }}>
        <Key theme={theme} icon="backspace-outline" onPress={onBackspace} style={{ height: 56 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={submitLabel}
          accessibilityState={{ disabled: !submitEnabled }}
          android_ripple={{ color: theme.primarySoft, foreground: true }}
          onPress={onSubmit}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.field,
            backgroundColor: submitEnabled ? theme.primary : theme.surfaceAlt,
          }}>
          <Text
            style={{
              fontSize: fontSize.title,
              fontWeight: '600',
              color: submitEnabled ? theme.textOnPrimary : theme.textMuted,
            }}>
            {submitLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Key({
  theme,
  label,
  icon,
  onPress,
  flex,
  style,
}: {
  theme: Theme;
  label?: string;
  icon?: 'backspace-outline';
  onPress: () => void;
  flex?: number;
  style?: { height?: number };
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? '退格'}
      android_ripple={{ color: theme.primarySoft }}
      onPress={onPress}
      style={{
        flex,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.field,
        backgroundColor: theme.keypadKey,
        ...style,
      }}>
      {label !== undefined ? (
        <Text style={{ fontSize: fontSize.headline, color: theme.text }}>{label}</Text>
      ) : (
        <MaterialCommunityIcons name={icon ?? 'backspace-outline'} size={24} color={theme.textMuted} />
      )}
    </Pressable>
  );
}
