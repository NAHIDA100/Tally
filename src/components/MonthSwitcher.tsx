import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { addMonths, formatMonthTitle, type MonthKey } from '@/src/logic/date';
import { fontSize } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';

export function MonthSwitcher({
  month,
  onChange,
  maxMonth,
}: {
  month: MonthKey;
  onChange: (next: MonthKey) => void;
  maxMonth: MonthKey;
}) {
  const theme = useTheme();
  const canGoNext = month < maxMonth;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: fontSize.caption }}>
      <Arrow name="chevron-left" onPress={() => onChange(addMonths(month, -1))} />
      <Text style={{ color: theme.text, fontSize: fontSize.title, fontWeight: '600', minWidth: 130, textAlign: 'center' }}>
        {formatMonthTitle(month)}
      </Text>
      <Arrow name="chevron-right" disabled={!canGoNext} onPress={() => canGoNext && onChange(addMonths(month, 1))} />
    </View>
  );
}

function Arrow({
  name,
  onPress,
  disabled,
}: {
  name: 'chevron-left' | 'chevron-right';
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name === 'chevron-left' ? '上个月' : '下个月'}
      accessibilityState={{ disabled: Boolean(disabled) }}
      hitSlop={12}
      onPress={onPress}
      style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
      <MaterialCommunityIcons
        name={name}
        size={22}
        color={disabled ? theme.divider : theme.textMuted}
      />
    </Pressable>
  );
}
