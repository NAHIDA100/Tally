import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Switch, Text, View } from 'react-native';

import { listAccountBalances, type AccountWithBalance } from '@/src/db/repository/accounts';
import { ACCOUNT_TYPE_LABELS } from '@/src/constants/labels';
import { netWorth } from '@/src/logic/balance';
import { formatMoney } from '@/src/logic/money';
import { CategoryIcon } from '@/src/components/CategoryIcon';
import { Screen } from '@/src/components/Screen';
import { useQuery } from '@/src/hooks/useQuery';
import { useAppStore } from '@/src/store/app';
import { amountFont, fontSize, radius, spacing } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';

export default function AccountsScreen() {
  const theme = useTheme();
  const symbol = useAppStore((state) => state.currencySymbol);
  const dataVersion = useAppStore((state) => state.dataVersion);
  const [showArchived, setShowArchived] = useState(false);

  const { data } = useQuery((db) => listAccountBalances(db, showArchived), [showArchived, dataVersion]);
  const accounts = data ?? [];
  /** 净资产只算未归档账户：归档意味着「这笔钱不在我的盘子里了」 */
  const worth = netWorth(accounts.filter((a) => !a.isArchived).map((a) => a.balance));

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg }}>
        <Text style={{ color: theme.text, fontSize: fontSize.headline, fontWeight: '700' }}>账户</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="新增账户"
          onPress={() => router.push({ pathname: '/accounts/[id]', params: { id: 'new' } })}
          hitSlop={10}
          style={{ padding: spacing.sm }}>
          <MaterialCommunityIcons name="plus" size={24} color={theme.primary} />
        </Pressable>
      </View>

      <View
        style={{
          marginHorizontal: spacing.lg,
          marginTop: spacing.lg,
          marginBottom: spacing.md,
          padding: spacing.lg,
          borderRadius: radius.card,
          backgroundColor: theme.surface,
        }}>
        <Text style={{ color: theme.textMuted, fontSize: fontSize.caption }}>净资产</Text>
        <Text style={[amountFont, { color: theme.text, fontSize: fontSize.headline, fontWeight: '700', marginTop: 2 }]}>
          {formatMoney(worth, symbol)}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
        <Text style={{ color: theme.textMuted, fontSize: fontSize.caption }}>显示已归档</Text>
        <Switch
          value={showArchived}
          onValueChange={setShowArchived}
          trackColor={{ true: theme.primary, false: theme.divider }}
          thumbColor={theme.surface}
        />
      </View>

      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AccountCell item={item} symbol={symbol} />}
        ListEmptyComponent={
          <Text style={{ color: theme.textMuted, textAlign: 'center', marginTop: spacing.xxl }}>
            还没有账户
          </Text>
        }
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
      />
    </Screen>
  );
}

function AccountCell({ item, symbol }: { item: AccountWithBalance; symbol: string }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/accounts/[id]', params: { id: item.id } })}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm,
        borderRadius: radius.field,
        backgroundColor: theme.surface,
        opacity: item.isArchived ? 0.55 : 1,
      }}>
      <CategoryIcon name={item.icon} color={item.color} boxSize={40} size={21} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontSize: fontSize.body, fontWeight: '500' }}>
          {item.name}
          {item.isArchived ? <Text style={{ color: theme.textMuted }}>  · 已归档</Text> : null}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: fontSize.caption, marginTop: 2 }}>
          {ACCOUNT_TYPE_LABELS[item.type]} · {item.transactionCount} 笔
        </Text>
      </View>
      <Text style={[amountFont, { color: item.balance < 0 ? theme.expense : theme.text, fontSize: fontSize.title, fontWeight: '600' }]}>
        {formatMoney(item.balance, symbol)}
      </Text>
    </Pressable>
  );
}
