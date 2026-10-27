import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from '@/src/constants/labels';
import {
  createAccount,
  deleteAccount,
  getAccount,
  updateAccount,
} from '@/src/db/repository/accounts';
import { countTransactionsByAccount } from '@/src/db/repository/transactions';
import { centsToInputString, parseAmountLoose } from '@/src/logic/money';
import { ColorPicker, IconPicker } from '@/src/components/IconPicker';
import { CategoryIcon, type IconName } from '@/src/components/CategoryIcon';
import { Screen } from '@/src/components/Screen';
import { useQuery } from '@/src/hooks/useQuery';
import { useAppStore } from '@/src/store/app';
import { fontSize, radius, spacing } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';
import type { AccountType } from '@/src/types';

export default function AccountEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const db = useSQLiteContext();
  const bump = useAppStore((state) => state.bump);

  const { data: existing } = useQuery(
    (handle) => (isNew ? Promise.resolve(null) : getAccount(handle, id)),
    [id],
  );

  if (!isNew && !existing) {
    return <LoadingOrMissing isNew={isNew} loading={!existing} />;
  }

  return (
    <AccountEditor
      key={existing?.id ?? 'new'}
      initial={existing ?? undefined}
      accountId={isNew ? null : existing!.id}
      db={db}
      onSaved={() => {
        bump();
        router.back();
      }}
    />
  );
}

function LoadingOrMissing({ isNew, loading }: { isNew: boolean; loading: boolean }) {
  const theme = useTheme();
  return (
    <Screen style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: theme.textMuted }}>{loading || isNew ? '加载中…' : '账户不存在'}</Text>
    </Screen>
  );
}

function AccountEditor({
  initial,
  accountId,
  db,
  onSaved,
}: {
  initial?: { name: string; type: AccountType; initialBalance: number; icon: string; color: string; isArchived: boolean };
  accountId: string | null;
  db: ReturnType<typeof useSQLiteContext>;
  onSaved: () => void;
}) {
  const theme = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<AccountType>(initial?.type ?? 'cash');
  const [balanceText, setBalanceText] = useState(() => {
    if (!initial) return '';
    // centsToInputString 面向记一笔键盘，金额恒为正所以不带符号；
    // 账户初始余额可以是负数（信用卡欠款），这里把符号补回来。
    const sign = initial.initialBalance < 0 ? '-' : '';
    return `${sign}${centsToInputString(initial.initialBalance)}`;
  });
  const [icon, setIcon] = useState<string>(initial?.icon ?? 'cash');
  const [color, setColor] = useState(initial?.color ?? '#0F766E');
  const [showIcons, setShowIcons] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const parsed = balanceText.trim() === '' ? 0 : parseAmountLoose(balanceText);
    if (parsed === null) {
      setError('初始余额格式不正确');
      return;
    }
    try {
      if (accountId) {
        await updateAccount(db, accountId, {
          name,
          type,
          initialBalance: parsed,
          icon,
          color,
          isArchived: initial?.isArchived ?? false,
        });
      } else {
        await createAccount(db, { name, type, initialBalance: parsed, icon, color });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    }
  }

  async function toggleArchive() {
    if (!accountId || !initial) return;
    try {
      await updateAccount(db, accountId, {
        name,
        type,
        initialBalance: parseAmountLoose(balanceText) ?? initial.initialBalance,
        icon,
        color,
        isArchived: !initial.isArchived,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    }
  }

  async function remove() {
    if (!accountId) return;
    const used = await countTransactionsByAccount(db, accountId);
    if (used > 0) {
      Alert.alert('无法删除', `该账户下已有 ${used} 笔流水。改为归档可以把它从列表里收起来，同时保留历史记录。`, [
        { text: '取消', style: 'cancel' },
        { text: '改为归档', onPress: () => void toggleArchive() },
      ]);
      return;
    }
    Alert.alert('删除账户', '确定删除这个账户吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          void deleteAccount(db, accountId).then(() => {
            onSaved();
          });
        },
      },
    ]);
  }

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12} style={{ padding: spacing.xs }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontSize: fontSize.title, fontWeight: '600', flex: 1 }}>
          {accountId ? '编辑账户' : '新增账户'}
        </Text>
        <Pressable accessibilityRole="button" onPress={() => void save()} style={{ padding: spacing.md, borderRadius: radius.pill, backgroundColor: theme.primary }}>
          <Text style={{ color: theme.textOnPrimary, fontWeight: '600' }}>保存</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <Field label="名称">
          <TextInput
            value={name}
            onChangeText={(text) => {
              setName(text);
              setError(null);
            }}
            placeholder="例如 招商银行"
            placeholderTextColor={theme.textMuted}
            maxLength={20}
            style={{
              color: theme.text,
              backgroundColor: theme.surface,
              borderRadius: radius.field,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              fontSize: fontSize.body,
            }}
          />
        </Field>

        <Field label="类型">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {ACCOUNT_TYPES.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                onPress={() => setType(option)}
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.pill,
                  backgroundColor: option === type ? theme.primary : theme.surface,
                  borderWidth: 1,
                  borderColor: option === type ? theme.primary : theme.divider,
                }}>
                <Text style={{ color: option === type ? theme.textOnPrimary : theme.text, fontSize: fontSize.caption }}>
                  {ACCOUNT_TYPE_LABELS[option]}
                </Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label="初始余额（可留空，信用卡可填负数）">
          <TextInput
            value={balanceText}
            onChangeText={(text) => {
              setBalanceText(text);
              setError(null);
            }}
            placeholder="0"
            placeholderTextColor={theme.textMuted}
            keyboardType="numbers-and-punctuation"
            style={{
              color: theme.text,
              backgroundColor: theme.surface,
              borderRadius: radius.field,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              fontSize: fontSize.body,
            }}
          />
        </Field>

        <Field label="图标">
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowIcons(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: theme.surface, borderRadius: radius.field, padding: spacing.md }}>
            <CategoryIcon name={icon} color={color} boxSize={36} size={20} />
            <Text style={{ color: theme.textMuted, fontSize: fontSize.body }}>{icon}</Text>
          </Pressable>
        </Field>

        <Field label="颜色">
          <ColorPicker value={color} onChange={setColor} />
        </Field>

        {error ? <Text style={{ color: theme.danger, fontSize: fontSize.body }}>{error}</Text> : null}

        {accountId ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void remove()}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.field, borderWidth: 1, borderColor: theme.danger }}>
            <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.danger} />
            <Text style={{ color: theme.danger }}>删除账户</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <IconPicker visible={showIcons} value={icon} onSelect={(next: IconName) => setIcon(next)} onClose={() => setShowIcons(false)} />
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View>
      <Text style={{ color: theme.textMuted, fontSize: fontSize.caption, marginBottom: spacing.sm }}>{label}</Text>
      {children}
    </View>
  );
}
