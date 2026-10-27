import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';

import { listAccounts } from '@/src/db/repository/accounts';
import { listCategories } from '@/src/db/repository/categories';
import {
  deleteTransaction,
  listTransactions,
  restoreTransaction,
} from '@/src/db/repository/transactions';
import { dayKeyOf, formatDayTitle, monthKeyOf, parseIso, weekdayLabel } from '@/src/logic/date';
import { formatMoney, type Cents } from '@/src/logic/money';
import { groupByDay, summarize } from '@/src/logic/stats';
import { FilterSheet, isFiltering } from '@/src/components/FilterSheet';
import { MonthSwitcher } from '@/src/components/MonthSwitcher';
import { Screen } from '@/src/components/Screen';
import { SwipeableRow } from '@/src/components/SwipeableRow';
import { TransactionRow } from '@/src/components/TransactionRow';
import { UndoToast } from '@/src/components/UndoToast';
import { useQuery } from '@/src/hooks/useQuery';
import { useAppStore } from '@/src/store/app';
import { amountFont, fontSize, radius, spacing } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';
import { hapticDelete, hapticSelect } from '@/src/utils/haptics';
import type { Transaction, TransactionFilter, TransactionWithRefs } from '@/src/types';

const UNDO_WINDOW_MS = 5000;

export default function BillsScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const bump = useAppStore((state) => state.bump);
  const symbol = useAppStore((state) => state.currencySymbol);

  const currentMonth = monthKeyOf(new Date());
  const [month, setMonth] = useState(currentMonth);
  const [filter, setFilter] = useState<TransactionFilter>({ month: currentMonth });
  const [showFilter, setShowFilter] = useState(false);
  const [undoTarget, setUndoTarget] = useState<Transaction | null>(null);

  const queryKey = JSON.stringify({ month, filter });
  const { data: rows } = useQuery(
    (db) => listTransactions(db, filter),
    [queryKey],
  );

  const groups = useMemo(() => groupByDay(rows ?? []), [rows]);
  const totals = useMemo(() => summarize(rows ?? []), [rows]);
  const filtering = isFiltering(filter);

  const { data: catalog } = useQuery(
    (db) => Promise.all([listCategories(db), listAccounts(db)]).then(([categories, accounts]) => ({ categories, accounts })),
    [],
  );

  const handleDelete = useCallback(
    async (item: TransactionWithRefs) => {
      hapticDelete();
      setUndoTarget(item);
      await deleteTransaction(db, item.id);
      bump();
    },
    [bump, db],
  );

  // 撤销窗口只有 5 秒：超时后把目标清掉，否则用户会在很久以后「复活」一条已经忘了的账
  useEffect(() => {
    if (!undoTarget) return;
    const timer = setTimeout(() => setUndoTarget(null), UNDO_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [undoTarget]);

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        {filtering ? (
          <Text style={{ color: theme.text, fontSize: fontSize.title, fontWeight: '600' }}>筛选结果</Text>
        ) : (
          <MonthSwitcher month={month} onChange={setMonth} maxMonth={currentMonth} />
        )}

        <Summary totals={totals} symbol={symbol} />

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowFilter(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: spacing.md,
              paddingVertical: 6,
              borderRadius: radius.pill,
              backgroundColor: filtering ? theme.primarySoft : theme.surface,
            }}>
            <MaterialCommunityIcons name="filter-variant" size={16} color={filtering ? theme.primary : theme.textMuted} />
            <Text style={{ color: filtering ? theme.primary : theme.textMuted, fontSize: fontSize.caption }}>
              {filtering ? '筛选中' : '筛选'}
            </Text>
          </Pressable>
          <Text style={{ color: theme.textMuted, fontSize: fontSize.caption }}>共 {rows?.length ?? 0} 笔</Text>
        </View>
      </View>

      {groups.length === 0 ? (
        <EmptyState />
      ) : (
        <SectionList
          sections={groups.map((group) => ({
            key: group.day,
            day: group.day,
            net: group.net,
            // SectionList 只认 data 这个键名，不能沿用 groupByDay 的 items
            data: group.items,
          }))}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <DayHeader day={section.day} net={section.net} symbol={symbol} />
          )}
          renderItem={({ item }) => (
            <SwipeableRow onDelete={() => void handleDelete(item)}>
              <TransactionRow
                item={item}
                onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })}
              />
            </SwipeableRow>
          )}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
        />
      )}

      {showFilter ? (
        <FilterSheet
          visible
          filter={filter}
          month={month}
          categories={catalog?.categories ?? []}
          accounts={catalog?.accounts ?? []}
          onApply={(next) => {
            setFilter(next);
            if (next.month) setMonth(next.month);
          }}
          onClose={() => setShowFilter(false)}
        />
      ) : null}

      {undoTarget ? (
        <UndoToast
          message="已删除这笔记录"
          onUndo={async () => {
            hapticSelect();
            await restoreTransaction(db, undoTarget);
            setUndoTarget(null);
            bump();
          }}
          onDismiss={() => setUndoTarget(null)}
        />
      ) : null}
    </Screen>
  );
}

function Summary({ totals, symbol }: { totals: ReturnType<typeof summarize>; symbol: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', marginVertical: spacing.lg }}>
      <Cell label="收入" value={totals.income} color={theme.income} symbol={symbol} />
      <Cell label="支出" value={totals.expense} color={theme.expense} symbol={symbol} />
      <Cell label="结余" value={totals.net} color={theme.text} symbol={symbol} signed />
    </View>
  );
}

function Cell({
  label,
  value,
  color,
  symbol,
  signed,
}: {
  label: string;
  value: Cents;
  color: string;
  symbol: string;
  signed?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: theme.textMuted, fontSize: fontSize.caption }}>{label}</Text>
      <Text style={[amountFont, { color, fontSize: fontSize.title, fontWeight: '600', marginTop: 2 }]}>
        {signed ? formatMoney(value, symbol) : formatMoney(value, symbol).replace('-', '')}
      </Text>
    </View>
  );
}

function DayHeader({ day, net, symbol }: { day: string; net: Cents; symbol: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        paddingTop: spacing.lg,
        paddingBottom: spacing.sm,
      }}>
      <Text style={{ color: theme.text, fontSize: fontSize.body, fontWeight: '600' }}>
        {formatDayTitle(day, dayKeyOf(new Date()))}
        <Text style={{ color: theme.textMuted, fontWeight: '400' }}>
          {'  '}
          {weekdayLabel(parseIso(`${day}T12:00:00`))}
        </Text>
      </Text>
      <Text style={[amountFont, { color: net < 0 ? theme.expense : theme.income, fontSize: fontSize.caption }]}>
        {formatMoney(net, symbol)}
      </Text>
    </View>
  );
}

function EmptyState() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}>
      <MaterialCommunityIcons name="note-text-outline" size={44} color={theme.divider} />
      <Text style={{ color: theme.textMuted, marginTop: spacing.md, fontSize: fontSize.body }}>
        还没有记录
      </Text>
      <Text style={{ color: theme.textMuted, fontSize: fontSize.caption, marginTop: 4 }}>
        点中间的「＋」记一笔
      </Text>
    </View>
  );
}
