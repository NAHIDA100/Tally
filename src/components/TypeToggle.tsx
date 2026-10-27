import { Pressable, Text, View } from 'react-native';

import type { TransactionType } from '@/src/types';
import { fontSize, radius, spacing } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';

const OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: '支出' },
  { value: 'income', label: '收入' },
  { value: 'transfer', label: '转账' },
];

export function TypeToggle({
  value,
  onChange,
}: {
  value: TransactionType;
  onChange: (next: TransactionType) => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignSelf: 'center',
        backgroundColor: theme.surfaceAlt,
        borderRadius: radius.pill,
        padding: 4,
      }}>
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={{
              minWidth: 84,
              alignItems: 'center',
              paddingVertical: spacing.sm,
              borderRadius: radius.pill,
              backgroundColor: active ? theme.surface : 'transparent',
            }}>
            <Text
              style={{
                fontSize: fontSize.body,
                fontWeight: active ? '600' : '400',
                color: active ? activeColor(theme, option.value) : theme.textMuted,
              }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function activeColor(theme: ReturnType<typeof useTheme>, value: TransactionType): string {
  if (value === 'expense') return theme.expense;
  if (value === 'income') return theme.income;
  return theme.primary;
}
