import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { refreshTallyWidgets } from '../modules/tally-widget/src';
import { listAccounts } from '@/src/db/repository/accounts';
import { setSetting } from '@/src/db/repository/settings';
import { PickerModal } from '@/src/components/PickerModal';
import { Screen } from '@/src/components/Screen';
import { useQuery } from '@/src/hooks/useQuery';
import { useAppStore, type ThemePreference } from '@/src/store/app';
import { fontSize, radius, spacing, type Theme } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const symbol = useAppStore((state) => state.currencySymbol);
  const [currencyDraft, setCurrencyDraft] = useState(symbol);

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12} style={{ padding: spacing.xs }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontSize: fontSize.title, fontWeight: '600' }}>设置</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xxl }}>
        <Group title="主题" theme={theme}>
          <ThemePicker theme={theme} />
        </Group>

        <Group title="默认货币符号" theme={theme}>
          <CurrencyField theme={theme} value={currencyDraft} onChange={setCurrencyDraft} />
        </Group>

        <Group title="默认账户" theme={theme}>
          <DefaultAccountPicker theme={theme} />
        </Group>

        <Group title="数据" theme={theme}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/export-import')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.surface,
              borderRadius: radius.field,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
            }}>
            <MaterialCommunityIcons name="export-variant" size={20} color={theme.textMuted} />
            <Text style={{ color: theme.text, fontSize: fontSize.body, flex: 1, marginLeft: spacing.md }}>
              导出与导入
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={theme.divider} />
          </Pressable>
        </Group>
      </ScrollView>
    </Screen>
  );
}

function Group({ title, theme, children }: { title: string; theme: Theme; children: React.ReactNode }) {
  return (
    <View>
      <Text style={{ color: theme.textMuted, fontSize: fontSize.caption, marginBottom: spacing.sm }}>{title}</Text>
      {children}
    </View>
  );
}

function ThemePicker({ theme }: { theme: Theme }) {
  const db = useSQLiteContext();
  const value = useAppStore((state) => state.themePreference);
  const setThemePreference = useAppStore((state) => state.setThemePreference);

  const choose = (next: ThemePreference) => {
    setThemePreference(next);
    // 卡片是从库里读主题的，所以刷新要排在写库之后；顺序反过来卡片就画成上一个主题。
    void setSetting(db, 'theme', next).then(
      refreshTallyWidgets,
      (error: unknown) => console.warn(`theme-persist-failed: ${String(error)}`),
    );
  };

  return (
    <View style={{ flexDirection: 'row', backgroundColor: theme.surfaceAlt, borderRadius: radius.pill, padding: 4 }}>
      {THEME_OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => choose(option.value)}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: spacing.sm,
              borderRadius: radius.pill,
              backgroundColor: active ? theme.surface : 'transparent',
            }}>
            <Text
              style={{
                fontSize: fontSize.body,
                color: active ? theme.primary : theme.textMuted,
                fontWeight: active ? '600' : '400',
              }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CurrencyField({
  theme,
  value,
  onChange,
}: {
  theme: Theme;
  value: string;
  onChange: (next: string) => void;
}) {
  const db = useSQLiteContext();
  const setCurrencySymbol = useAppStore((state) => state.setCurrencySymbol);

  function update(text: string) {
    // 只留 1–3 个字符：再多就不是货币符号而是文本了，会破坏金额对齐
    const clean = text.trim().slice(0, 3);
    onChange(clean);
    if (clean === '') return;
    setCurrencySymbol(clean);
    void setSetting(db, 'currencySymbol', clean).then(refreshTallyWidgets);
  }

  return (
    <TextInput
      value={value}
      onChangeText={update}
      maxLength={3}
      placeholder="¥"
      placeholderTextColor={theme.textMuted}
      style={{
        color: theme.text,
        backgroundColor: theme.surface,
        borderRadius: radius.field,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        fontSize: fontSize.title,
      }}
    />
  );
}

function DefaultAccountPicker({ theme }: { theme: Theme }) {
  const db = useSQLiteContext();
  const [open, setOpen] = useState(false);
  const accountId = useAppStore((state) => state.defaultAccountId);
  const name = useAppStore((state) => state.defaultAccountName);
  const setDefaultAccount = useAppStore((state) => state.setDefaultAccount);
  const { data } = useQuery((handle) => listAccounts(handle), []);

  const accounts = data ?? [];

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.surface,
          borderRadius: radius.field,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        }}>
        <MaterialCommunityIcons name="wallet-outline" size={20} color={theme.textMuted} />
        <Text style={{ color: theme.text, fontSize: fontSize.body, flex: 1, marginLeft: spacing.md }}>
          {name ?? '未选择'}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color={theme.divider} />
      </Pressable>

      <PickerModal
        visible={open}
        title="默认账户"
        selectedId={accountId}
        options={accounts.map((a) => ({ id: a.id, label: a.name }))}
        onSelect={(id) => {
          const account = accounts.find((a) => a.id === id);
          if (!account) return;
          setDefaultAccount(account.id, account.name);
          void setSetting(db, 'defaultAccountId', account.id);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
