import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View, type ViewStyle } from 'react-native';

import { listAccounts } from '@/src/db/repository/accounts';
import { listCategories } from '@/src/db/repository/categories';
import {
  createTransaction,
  getFrequentCategories,
  updateTransaction,
} from '@/src/db/repository/transactions';
import {
  combineDayTime,
  dayKeyOf,
  formatDayTitle,
  formatTime,
  monthKeyOf,
  parseIso,
} from '@/src/logic/date';
import { appendDigit, centsToInputString, formatKeypadDisplay, formatMoney, parseAmountInput } from '@/src/logic/money';
import { useQuery } from '@/src/hooks/useQuery';
import { useAppStore } from '@/src/store/app';
import { hapticSelect, hapticSuccess } from '@/src/utils/haptics';
import { AmountHeader } from '@/src/components/AmountHeader';
import { CategoryGrid, FrequentCategories } from '@/src/components/CategoryGrid';
import { NumberPad } from '@/src/components/NumberPad';
import { PickerModal } from '@/src/components/PickerModal';
import { TypeToggle } from '@/src/components/TypeToggle';
import { fontSize, radius, spacing } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';
import type { Category, CategoryType, Transaction, TransactionType } from '@/src/types';

/**
 * 记一笔与编辑流水共用的表单。
 *
 * 金额状态保存的是「键盘敲出来的字符串」而不是数字：这样 "12." 这种中间态能如实显示，
 * 也保证只有 parseAmountInput 一个出口把字符串变成分，不会出现半路浮点转换。
 */
export function EntryForm({
  transaction,
  onDone,
}: {
  transaction?: Transaction;
  onDone: () => void;
}) {
  const theme = useTheme();
  const db = useSQLiteContext();
  const bump = useAppStore((state) => state.bump);
  const defaultAccountId = useAppStore((state) => state.defaultAccountId);
  const currencySymbol = useAppStore((state) => state.currencySymbol);

  const [amount, setAmount] = useState(() =>
    transaction ? centsToInputString(transaction.amount) : '',
  );
  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'expense');
  const [categoryId, setCategoryId] = useState<string | null>(transaction?.categoryId ?? null);
  const [accountId, setAccountId] = useState<string | null>(transaction?.accountId ?? defaultAccountId);
  const [toAccountId, setToAccountId] = useState<string | null>(transaction?.toAccountId ?? null);
  const [occurredAt, setOccurredAt] = useState<Date>(() =>
    transaction ? parseIso(transaction.occurredAt) : new Date(),
  );
  const [note, setNote] = useState(transaction?.note ?? '');
  const [picking, setPicking] = useState<'date' | 'time' | null>(null);
  const [accountTarget, setAccountTarget] = useState<'from' | 'to' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isTransfer = type === 'transfer';
  /** 转账没有分类；切到转账时按支出分类兜底，避免 listCategories 收到 'transfer' */
  const categoryType: CategoryType = type === 'income' ? 'income' : 'expense';

  const month = monthKeyOf(occurredAt);
  const { data: catalog } = useQuery(
    async (handle) => {
      // 连归档账户一起取：编辑一条记在已归档账户上的旧账时，
      // 界面上要还能说出它原本记在哪个账户，而不是显示「选择账户」。
      const allAccounts = await listAccounts(handle, true);
      const accounts = allAccounts.filter((a) => !a.isArchived);
      if (isTransfer) return { categories: [] as Category[], frequent: [], accounts, allAccounts };
      const [categories, frequent] = await Promise.all([
        listCategories(handle, categoryType),
        getFrequentCategories(handle, categoryType, month, 5),
      ]);
      return { categories, frequent, accounts, allAccounts };
    },
    [type, categoryType, month, isTransfer],
  );

  const categories = catalog?.categories ?? [];
  const availableAccounts = catalog?.accounts;
  const accounts = availableAccounts ?? [];
  const allAccounts = catalog?.allAccounts ?? [];

  /**
   * 默认账户可能已经被归档或删掉：归档账户不在候选列表里，
   * 继续用储存在 state 里的旧 id 会把新账记到一个余额页再也看不见的账户上。
   * 但只对「记一笔」做兜底 —— 编辑旧账时擅自换账户是在篡改历史。
   */
  const fromAccountId = useMemo(() => {
    if (!availableAccounts) return accountId;
    if (accountId && availableAccounts.some((a) => a.id === accountId)) return accountId;
    if (transaction) return accountId;
    return availableAccounts[0]?.id ?? null;
  }, [availableAccounts, accountId, transaction]);

  /** 转入账户没有「退回到第一个」这种合理默认，无效就清空，让提交时报错引导用户 */
  const toAccountIdSafe = useMemo(() => {
    if (!availableAccounts || !isTransfer) return toAccountId;
    return toAccountId && availableAccounts.some((a) => a.id === toAccountId) ? toAccountId : null;
  }, [availableAccounts, toAccountId, isTransfer]);

  const nameOf = (id: string | null) => {
    const account = allAccounts.find((a) => a.id === id);
    if (!account) return '选择账户';
    return account.isArchived ? `${account.name}（已归档）` : account.name;
  };
  const cents = parseAmountInput(amount);
  const canSave =
    cents !== null &&
    cents > 0 &&
    fromAccountId !== null &&
    (isTransfer
      ? toAccountIdSafe !== null && toAccountIdSafe !== fromAccountId
      : categoryId !== null);

  const frequentIds = useMemo(() => new Set(catalog?.frequent.map((c) => c.categoryId) ?? []), [catalog]);
  const frequent = (catalog?.frequent ?? [])
    .map((f) => categories.find((c) => c.id === f.categoryId))
    .filter((c): c is Category => Boolean(c));
  const rest = categories.filter((c) => !frequentIds.has(c.id));

  const append = (digit: string) => {
    const next = appendDigit(amount, digit);
    // 触到上限时 parseAmountInput 判非法。只保持原值会让按键看起来坏了，
    // 所以拒收的同时要说清上限（真机验证：¥99,999,999 之后一位就进不去）。
    if (parseAmountInput(next) === null) {
      setError('金额上限 99,999,999.99');
      return;
    }
    setError(null);
    setAmount(next);
  };

  async function submit() {
    if (cents === null || cents <= 0) {
      setError('请输入金额');
      return;
    }
    if (fromAccountId === null) {
      setError('请选择账户');
      return;
    }
    if (isTransfer) {
      if (toAccountIdSafe === null) {
        setError('请选择转入账户');
        return;
      }
      if (toAccountIdSafe === fromAccountId) {
        setError('转出与转入账户不能相同');
        return;
      }
    } else if (categoryId === null) {
      setError('请选择分类');
      return;
    }
    setError(null);
    try {
      const draft = {
        type,
        amount: cents,
        categoryId: isTransfer ? null : categoryId,
        accountId: fromAccountId,
        toAccountId: isTransfer ? toAccountIdSafe : null,
        occurredAt,
        note: note.trim(),
        tags: [] as string[],
      };
      if (transaction) await updateTransaction(db, transaction.id, draft);
      else await createTransaction(db, draft);
      hapticSuccess();
      bump();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Pressable accessibilityRole="button" onPress={onDone} hitSlop={12} style={{ padding: spacing.xs }}>
          <MaterialCommunityIcons name="close" size={26} color={theme.textMuted} />
        </Pressable>
        <TypeToggle
          value={type}
          onChange={(next) => {
            hapticSelect();
            setType(next);
          }}
        />
        <View style={{ width: 34 }} />
      </View>

      <AmountHeader
        display={`${currencySymbol}${formatKeypadDisplay(amount)}`}
        hint={error ?? hintFor(type, cents, currencySymbol)}
        error={error !== null}
        onClear={() => {
          setAmount('');
          setError(null);
        }}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
        {isTransfer ? (
          <View style={{ gap: spacing.md }}>
            <MetaRow icon="arrow-right-bold-circle-outline" onPress={() => setAccountTarget('from')}>
              转出：{nameOf(fromAccountId)}
            </MetaRow>
            <MetaRow icon="arrow-left-bold-circle-outline" onPress={() => setAccountTarget('to')}>
              转入：{nameOf(toAccountIdSafe)}
            </MetaRow>
          </View>
        ) : (
          <>
            {frequent.length > 0 ? (
              <FrequentCategories
                items={frequent}
                selectedId={categoryId}
                onSelect={(c) => {
                  hapticSelect();
                  setCategoryId(c.id);
                }}
              />
            ) : null}
            <CategoryGrid
              items={rest}
              selectedId={categoryId}
              onSelect={(c) => {
                hapticSelect();
                setCategoryId(c.id);
              }}
            />
          </>
        )}

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          {/* 日期与账户并排：竖着排会把备注挤到键盘下面，而备注恰恰是最常改的字段 */}
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <MetaRow icon="calendar-blank-outline" onPress={() => setPicking('date')} style={{ flex: 1 }}>
              {dayLabel(occurredAt)} {formatTime(occurredAt)}
            </MetaRow>
            {isTransfer ? null : (
              <MetaRow icon="wallet-outline" onPress={() => setAccountTarget('from')} style={{ flex: 1 }}>
                {nameOf(fromAccountId)}
              </MetaRow>
            )}
          </View>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="添加备注"
            placeholderTextColor={theme.textMuted}
            maxLength={200}
            style={{
              color: theme.text,
              backgroundColor: theme.surface,
              borderRadius: radius.field,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              fontSize: fontSize.body,
            }}
          />
        </View>
      </ScrollView>

      <NumberPad
        onDigit={append}
        onDot={() => {
          setError(null);
          setAmount((prev) => (prev.includes('.') ? prev : prev === '' ? '0.' : `${prev}.`));
        }}
        onBackspace={() => {
          setError(null);
          setAmount((prev) => prev.slice(0, -1));
        }}
        onSubmit={submit}
        submitEnabled={canSave}
        submitLabel={transaction ? '更新' : '保存'}
      />

      {picking ? (
        <DateTimePicker
          value={occurredAt}
          mode={picking}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_event, selected) => {
            if (!selected) {
              setPicking(null);
              return;
            }
            if (picking === 'date') {
              const next = new Date(selected);
              next.setHours(occurredAt.getHours(), occurredAt.getMinutes(), 0, 0);
              setOccurredAt(next);
              setPicking('time');
            } else {
              const next = combineDayTime(dayKeyOf(occurredAt), formatTime(selected));
              setOccurredAt(next);
              setPicking(null);
            }
          }}
        />
      ) : null}

      <PickerModal
        visible={accountTarget !== null}
        title={accountTarget === 'to' ? '转入账户' : '账户'}
        selectedId={accountTarget === 'to' ? toAccountIdSafe : fromAccountId}
        options={accounts
          // 转入列表里排除当前转出账户：自己转给自己是一条没有意义的记录
          .filter((a) => accountTarget !== 'to' || a.id !== fromAccountId)
          .map((a) => ({ id: a.id, label: a.name }))}
        onSelect={(id) => {
          if (accountTarget === 'to') setToAccountId(id);
          else setAccountId(id);
        }}
        onClose={() => setAccountTarget(null)}
      />
    </View>
  );
}

function dayLabel(date: Date): string {
  return formatDayTitle(dayKeyOf(date), dayKeyOf(new Date()));
}

function hintFor(type: TransactionType, cents: number | null, symbol: string): string {
  if (cents === null || cents === 0) return '请输入金额';
  const label = type === 'expense' ? '支出' : type === 'income' ? '收入' : '转账';
  return `预计${label} ${formatMoney(cents, symbol)}`;
}

function MetaRow({
  icon,
  onPress,
  children,
  style,
}: {
  icon: 'calendar-blank-outline' | 'wallet-outline' | 'arrow-right-bold-circle-outline' | 'arrow-left-bold-circle-outline';
  onPress: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: theme.surface,
        borderRadius: radius.field,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        ...style,
      }}>
      <MaterialCommunityIcons name={icon} size={20} color={theme.textMuted} />
      <Text numberOfLines={1} style={{ color: theme.text, fontSize: fontSize.body, flex: 1 }}>
        {children}
      </Text>
    </Pressable>
  );
}
