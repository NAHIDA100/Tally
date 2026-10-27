import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { listCategories } from '@/src/db/repository/categories';
import {
  copyBudgetsFromPreviousMonth,
  deleteBudget,
  listBudgets,
  upsertBudget,
} from '@/src/db/repository/budgets';
import { getCategoryTotals, getMonthSummary } from '@/src/db/repository/transactions';
import { addMonths, formatMonthTitle, monthKeyOf } from '@/src/logic/date';
import { categoryBudgetViews, computeBudgetProgress, type BudgetProgress } from '@/src/logic/budget';
import { centsToInputString, formatAbsMoney, formatMoney, parseAmountLoose } from '@/src/logic/money';
import { CategoryIcon } from '@/src/components/CategoryIcon';
import { MonthSwitcher } from '@/src/components/MonthSwitcher';
import { ProgressBar } from '@/src/components/ProgressBar';
import { Screen } from '@/src/components/Screen';
import { useQuery } from '@/src/hooks/useQuery';
import { useAppStore } from '@/src/store/app';
import { amountFont, fontSize, radius, spacing, type Theme } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';

export default function BudgetScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const symbol = useAppStore((state) => state.currencySymbol);
  const bump = useAppStore((state) => state.bump);
  const dataVersion = useAppStore((state) => state.dataVersion);

  const currentMonth = monthKeyOf(new Date());
  const [month, setMonth] = useState(currentMonth);
  const [editing, setEditing] = useState<{ categoryId: string | null } | null>(null);

  const { data } = useQuery(
    async (handle) => {
      const [budgets, totals, summary, categories] = await Promise.all([
        listBudgets(handle, month),
        getCategoryTotals(handle, month, 'expense'),
        getMonthSummary(handle, month),
        listCategories(handle, 'expense'),
      ]);
      const categoryBudgets = budgets
        .filter((b) => b.categoryId !== null)
        .map((b) => ({ categoryId: b.categoryId as string, limit: b.amount }));
      const views = categoryBudgetViews(
        categoryBudgets,
        totals.map((t) => ({ categoryId: t.categoryId, total: t.total })),
      );
      const totalBudget = budgets.find((b) => b.categoryId === null);
      return {
        budgets,
        views,
        categories,
        totalProgress: totalBudget
          ? { budget: totalBudget, ...computeBudgetProgress(totalBudget.amount, summary.expense) }
          : null,
      };
    },
    [month, dataVersion],
  );

  const nameOf = (categoryId: string) =>
    data?.categories.find((c) => c.id === categoryId)?.name ?? '已删除分类';
  const iconOf = (categoryId: string) => data?.categories.find((c) => c.id === categoryId)?.icon;
  const colorOf = (categoryId: string) => data?.categories.find((c) => c.id === categoryId)?.color ?? '#64748B';

  async function copyFromPrevious() {
    const from = addMonths(month, -1);
    const count = await copyBudgetsFromPreviousMonth(db, from, month);
    bump();
    Alert.alert('已复制', `从 ${formatMonthTitle(from)} 复制了 ${count} 条预算`);
  }

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12} style={{ padding: spacing.xs }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontSize: fontSize.title, fontWeight: '600', flex: 1 }}>预算</Text>
        <Pressable accessibilityRole="button" onPress={() => void copyFromPrevious()} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: spacing.md }}>
          <MaterialCommunityIcons name="content-copy" size={17} color={theme.textMuted} />
          <Text style={{ color: theme.textMuted, fontSize: fontSize.caption }}>复制上月</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="新增预算" onPress={() => setEditing({ categoryId: null })} hitSlop={10}>
          <MaterialCommunityIcons name="plus" size={24} color={theme.primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <MonthSwitcher month={month} onChange={setMonth} maxMonth={currentMonth} />

        {data?.totalProgress ? (
          <View style={{ marginTop: spacing.xl }}>
            <Text style={{ color: theme.textMuted, fontSize: fontSize.caption, marginBottom: spacing.sm }}>总预算</Text>
            <BudgetLine
              theme={theme}
              symbol={symbol}
              title="全部支出"
              icon="wallet-outline"
              color={theme.primary}
              progress={data.totalProgress}
              onPress={() => setEditing({ categoryId: null })}
            />
          </View>
        ) : (
          <Text style={{ color: theme.textMuted, marginTop: spacing.xl, fontSize: fontSize.body }}>
            还没有设置总预算
          </Text>
        )}

        {data && data.views.length > 0 ? (
          <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>
            <Text style={{ color: theme.textMuted, fontSize: fontSize.caption }}>分类预算</Text>
            {data.views.map((view) => {
              const budget = data.budgets.find((b) => b.categoryId === view.categoryId);
              if (!budget) return null;
              return (
                <BudgetLine
                  key={view.categoryId}
                  theme={theme}
                  symbol={symbol}
                  title={nameOf(view.categoryId)}
                  icon={iconOf(view.categoryId)}
                  color={colorOf(view.categoryId)}
                  progress={view}
                  onPress={() => setEditing({ categoryId: view.categoryId })}
                />
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      {editing ? (
        <BudgetEditorSheet
          month={month}
          initialCategoryId={editing.categoryId}
          existing={data?.budgets.find((b) => b.categoryId === editing.categoryId)}
          categories={data?.categories ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            bump();
            setEditing(null);
          }}
        />
      ) : null}
    </Screen>
  );
}

function BudgetLine({
  theme,
  symbol,
  title,
  icon,
  color,
  progress,
  onPress,
}: {
  theme: Theme;
  symbol: string;
  title: string;
  icon?: string;
  color: string;
  progress: BudgetProgress;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ backgroundColor: theme.surface, borderRadius: radius.card, padding: spacing.lg, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <CategoryIcon name={icon} color={color} boxSize={28} size={16} />
        <Text style={{ color: theme.text, fontSize: fontSize.body, flex: 1 }}>{title}</Text>
        <Text style={[amountFont, { color: progress.isOver ? theme.warning : theme.textMuted, fontSize: fontSize.caption }]}>
          {progress.isOver
            ? `超 ${formatAbsMoney(-progress.remaining, symbol)}`
            : `剩 ${formatAbsMoney(progress.remaining, symbol)}`}
        </Text>
      </View>
      <ProgressBar progress={progress} theme={theme} />
      <Text style={[amountFont, { color: theme.textMuted, fontSize: fontSize.caption }]}>
        {formatMoney(progress.spent, symbol)} / {formatAbsMoney(progress.limit, symbol)}
      </Text>
    </Pressable>
  );
}

function BudgetEditorSheet({
  month,
  initialCategoryId,
  existing,
  categories,
  onClose,
  onSaved,
}: {
  month: string;
  initialCategoryId: string | null;
  existing?: { id: string; amount: number };
  categories: { id: string; name: string; icon: string; color: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const theme = useTheme();
  const db = useSQLiteContext();
  const [categoryId, setCategoryId] = useState<string | null>(initialCategoryId);
  const [amountText, setAmountText] = useState(existing ? centsToInputString(existing.amount) : '');
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const cents = parseAmountLoose(amountText);
    if (cents === null || cents <= 0) {
      setError('请输入大于 0 的预算金额');
      return;
    }
    try {
      await upsertBudget(db, month, categoryId, cents);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.overlay, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" onPress={onClose} style={{ flex: 1 }} />
        <View
          style={{
            backgroundColor: theme.surface,
            borderTopLeftRadius: radius.card,
            borderTopRightRadius: radius.card,
            padding: spacing.lg,
            gap: spacing.lg,
            paddingBottom: spacing.xxl,
          }}>
          <Text style={{ color: theme.text, fontSize: fontSize.title, fontWeight: '600' }}>
            {existing ? '修改预算' : '设置预算'}
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setCategoryId(null)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.pill,
                backgroundColor: categoryId === null ? theme.primary : theme.surfaceAlt,
              }}>
              <Text style={{ color: categoryId === null ? theme.textOnPrimary : theme.textMuted, fontSize: fontSize.caption }}>
                总预算
              </Text>
            </Pressable>
            {categories.map((category) => (
              <Pressable
                key={category.id}
                accessibilityRole="button"
                onPress={() => setCategoryId(category.id)}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.pill,
                  backgroundColor: category.id === categoryId ? theme.primary : theme.surfaceAlt,
                }}>
                <Text
                  style={{
                    color: category.id === categoryId ? theme.textOnPrimary : theme.textMuted,
                    fontSize: fontSize.caption,
                  }}>
                  {category.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <TextInput
            value={amountText}
            onChangeText={(text) => {
              setAmountText(text);
              setError(null);
            }}
            placeholder="每月金额"
            placeholderTextColor={theme.textMuted}
            keyboardType="numbers-and-punctuation"
            style={{
              color: theme.text,
              backgroundColor: theme.surfaceAlt,
              borderRadius: radius.field,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              fontSize: fontSize.body,
            }}
          />

          {error ? <Text style={{ color: theme.danger, fontSize: fontSize.body }}>{error}</Text> : null}

          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            {existing ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  void deleteBudget(db, existing.id).then(onSaved);
                }}
                style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.field, borderWidth: 1, borderColor: theme.danger }}>
                <Text style={{ color: theme.danger }}>删除</Text>
              </Pressable>
            ) : null}
            <View style={{ flex: 1 }} />
            <Pressable accessibilityRole="button" onPress={onClose} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
              <Text style={{ color: theme.textMuted }}>取消</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void save()}
              style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.field, backgroundColor: theme.primary }}>
              <Text style={{ color: theme.textOnPrimary, fontWeight: '600' }}>保存</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
