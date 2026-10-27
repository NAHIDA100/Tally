import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import {
  getCategoryTotals,
  getMonthSummary,
  getMonthTotals,
} from '@/src/db/repository/transactions';
import { dayKeyOf, lastMonths, monthKeyOf } from '@/src/logic/date';
import { averageDailyExpense, withShares } from '@/src/logic/stats';
import { DonutChart } from '@/src/components/charts/DonutChart';
import { TrendChart } from '@/src/components/charts/TrendChart';
import { CategoryIcon } from '@/src/components/CategoryIcon';
import { MonthSwitcher } from '@/src/components/MonthSwitcher';
import { Screen } from '@/src/components/Screen';
import { useQuery } from '@/src/hooks/useQuery';
import { useAppStore } from '@/src/store/app';
import { amountFont, fontSize, radius, spacing, type Theme } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';
import { formatAbsMoney, formatMoney, type Cents } from '@/src/logic/money';
import type { CategoryType } from '@/src/types';

export default function StatsScreen() {
  const theme = useTheme();
  const symbol = useAppStore((state) => state.currencySymbol);
  const dataVersion = useAppStore((state) => state.dataVersion);

  const currentMonth = monthKeyOf(new Date());
  const [month, setMonth] = useState(currentMonth);
  const [sliceType, setSliceType] = useState<CategoryType>('expense');

  const { data } = useQuery(
    async (db) => {
      const [summary, totals, trend] = await Promise.all([
        getMonthSummary(db, month),
        getCategoryTotals(db, month, sliceType),
        getMonthTotals(db, lastMonths(month, 6)),
      ]);
      return { summary, totals, trend };
    },
    [month, sliceType, dataVersion],
  );

  const summary = data?.summary;
  const shares = withShares(data?.totals ?? []);
  const sliceTotal = shares.reduce((acc, s) => acc + s.total, 0);
  const hasSlices = shares.length > 0;

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }} showsVerticalScrollIndicator={false}>
        <MonthSwitcher month={month} onChange={setMonth} maxMonth={currentMonth} />

        {summary ? <Overview summary={summary} month={month} symbol={symbol} theme={theme} /> : null}

        <SectionTitle title="分类占比" theme={theme}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {(['expense', 'income'] as CategoryType[]).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                onPress={() => setSliceType(option)}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: 4,
                  borderRadius: radius.pill,
                  backgroundColor: option === sliceType ? theme.primarySoft : 'transparent',
                }}>
                <Text style={{ fontSize: fontSize.caption, color: option === sliceType ? theme.primary : theme.textMuted }}>
                  {option === 'expense' ? '支出' : '收入'}
                </Text>
              </Pressable>
            ))}
          </View>
        </SectionTitle>

        {hasSlices ? (
          <View style={{ alignItems: 'center', marginTop: spacing.md }}>
            <DonutChart
              data={shares.map((s) => ({ label: s.name, value: s.total, color: s.color }))}
              size={200}
              theme={theme}
              centerLabel={sliceType === 'expense' ? '总支出' : '总收入'}
              centerValue={formatAbsMoney(sliceTotal, symbol)}
            />
            <View style={{ width: '100%', marginTop: spacing.lg, gap: spacing.md }}>
              {shares.map((share) => (
                <View key={share.categoryId} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <CategoryIcon name={share.icon} color={share.color} boxSize={30} size={17} />
                  <Text style={{ color: theme.text, fontSize: fontSize.body, flex: 1 }} numberOfLines={1}>
                    {share.name}
                  </Text>
                  <Text style={{ color: theme.textMuted, fontSize: fontSize.caption, width: 46, textAlign: 'right' }}>
                    {share.percent}%
                  </Text>
                  <Text style={[amountFont, { color: theme.text, fontSize: fontSize.body, width: 92, textAlign: 'right' }]}>
                    {formatAbsMoney(share.total, symbol)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <EmptyHint theme={theme} />
        )}

        <SectionTitle title="近 6 个月支出" theme={theme} />
        <View style={{ marginTop: spacing.md }}>
          <TrendChart
            data={(data?.trend ?? []).map((t, index) => ({ x: index, expense: t.expense }))}
            labels={(data?.trend ?? []).map((t) => t.month.slice(5))}
            height={150}
            theme={theme}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Overview({
  summary,
  month,
  symbol,
  theme,
}: {
  summary: Awaited<ReturnType<typeof getMonthSummary>>;
  month: string;
  symbol: string;
  theme: Theme;
}) {
  const daily = averageDailyExpense(summary.expense, month, dayKeyOf(new Date()));
  return (
    <View style={{ flexDirection: 'row', marginTop: spacing.lg }}>
      <Cell label="收入" value={summary.income} color={theme.income} symbol={symbol} />
      <Cell label="支出" value={summary.expense} color={theme.expense} symbol={symbol} />
      <Cell label="结余" value={summary.net} color={theme.text} symbol={symbol} signed />
      <Cell label="日均支出" value={daily} color={theme.textMuted} symbol={symbol} />
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
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color, fontSize: fontSize.caption }}>{label}</Text>
      <Text style={[amountFont, { color, fontSize: fontSize.body, fontWeight: '600', marginTop: 2 }]}>
        {signed ? formatMoney(value, symbol) : formatAbsMoney(value, symbol)}
      </Text>
    </View>
  );
}

function SectionTitle({
  title,
  theme,
  children,
}: {
  title: string;
  theme: Theme;
  children?: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xxl }}>
      <Text style={{ color: theme.text, fontSize: fontSize.title, fontWeight: '600' }}>{title}</Text>
      {children}
    </View>
  );
}

function EmptyHint({ theme }: { theme: Theme }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
      <MaterialCommunityIcons name="chart-donut" size={40} color={theme.divider} />
      <Text style={{ color: theme.textMuted, marginTop: spacing.md }}>这个月还没有数据</Text>
    </View>
  );
}
