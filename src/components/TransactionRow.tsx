import { Pressable, Text, View } from 'react-native';

import { CategoryIcon } from '@/src/components/CategoryIcon';
import { formatTime, parseIso } from '@/src/logic/date';
import { formatAbsMoney } from '@/src/logic/money';
import { amountFont, fontSize, spacing } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';
import { useAppStore } from '@/src/store/app';
import type { TransactionWithRefs } from '@/src/types';

export function TransactionRow({
  item,
  onPress,
}: {
  item: TransactionWithRefs;
  onPress: () => void;
}) {
  const theme = useTheme();
  const symbol = useAppStore((state) => state.currencySymbol);

  const isTransfer = item.type === 'transfer';
  const title = isTransfer
    ? `转账到 ${item.toAccountName ?? '未知账户'}`
    : (item.categoryName ?? '未分类');
  const color = isTransfer ? theme.text : item.type === 'expense' ? theme.expense : theme.income;
  const iconColor = isTransfer ? theme.primary : (item.categoryColor ?? theme.textMuted);
  const time = formatTime(parseIso(item.occurredAt));

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        backgroundColor: theme.surface,
      }}>
      <CategoryIcon name={isTransfer ? 'swap-horizontal' : item.categoryIcon} color={iconColor} boxSize={38} size={20} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: theme.text, fontSize: fontSize.body, fontWeight: '500' }}>
          {title}
        </Text>
        <Text numberOfLines={1} style={{ color: theme.textMuted, fontSize: fontSize.caption, marginTop: 2 }}>
          {item.note ? `${item.note} · ${time}` : time}
        </Text>
      </View>
      <Text style={[amountFont, { color, fontSize: fontSize.title, fontWeight: '600' }]}>
        {formatAbsMoney(item.amount, symbol)}
      </Text>
    </Pressable>
  );
}
