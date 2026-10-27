import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { dayKeyOf, parseIso } from '@/src/logic/date';
import { fontSize, radius, spacing } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';
import type { Account, Category, TransactionFilter } from '@/src/types';

export type DateScope = 'month' | 'all' | 'range';

export interface DraftFilter {
  keyword: string;
  categoryId?: string;
  accountId?: string;
  scope: DateScope;
  from?: string;
  to?: string;
}

export function draftToFilter(draft: DraftFilter, month: string): TransactionFilter {
  if (draft.scope === 'range' && draft.from && draft.to) {
    return { from: draft.from, to: draft.to, categoryId: draft.categoryId, accountId: draft.accountId, keyword: draft.keyword || undefined };
  }
  if (draft.scope === 'all') {
    return { categoryId: draft.categoryId, accountId: draft.accountId, keyword: draft.keyword || undefined };
  }
  return { month, categoryId: draft.categoryId, accountId: draft.accountId, keyword: draft.keyword || undefined };
}

function draftFromFilter(filter: TransactionFilter): DraftFilter {
  if (filter.from && filter.to) return { keyword: filter.keyword ?? '', scope: 'range', from: filter.from, to: filter.to, categoryId: filter.categoryId, accountId: filter.accountId };
  if (!filter.month) return { keyword: filter.keyword ?? '', scope: 'all', categoryId: filter.categoryId, accountId: filter.accountId };
  return { keyword: filter.keyword ?? '', scope: 'month', categoryId: filter.categoryId, accountId: filter.accountId };
}

export function isFiltering(filter: TransactionFilter): boolean {
  return Boolean(filter.categoryId || filter.accountId || filter.keyword || (filter.from && filter.to));
}

/**
 * 筛选面板。分类/账户用可横向滚动的 chip 而不是二级页面，
 * 因为「只看这一类」通常是临时视角，要能一眼看到已选状态并一键取消。
 */
export function FilterSheet({
  visible,
  filter,
  month,
  categories,
  accounts,
  onApply,
  onClose,
}: {
  visible: boolean;
  filter: TransactionFilter;
  month: string;
  categories: Category[];
  accounts: Account[];
  onApply: (next: TransactionFilter) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState<DraftFilter>(() => draftFromFilter(filter));
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);

  const patch = (next: Partial<DraftFilter>) => setDraft((prev) => ({ ...prev, ...next }));

  const scopes: { value: DateScope; label: string }[] = [
    { value: 'month', label: '本月' },
    { value: 'all', label: '全部' },
    { value: 'range', label: '自定义' },
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: spacing.xxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg }}>
          <Text style={{ color: theme.text, fontSize: fontSize.title, fontWeight: '600' }}>筛选</Text>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12} style={{ padding: spacing.sm }}>
            <Text style={{ color: theme.textMuted, fontSize: fontSize.body }}>取消</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
          <TextInput
            value={draft.keyword}
            onChangeText={(text) => patch({ keyword: text })}
            placeholder="搜索备注或标签"
            placeholderTextColor={theme.textMuted}
            style={{
              color: theme.text,
              backgroundColor: theme.surface,
              borderRadius: radius.field,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              fontSize: fontSize.body,
            }}
          />

          <Group title="时间范围">
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {scopes.map((scope) => (
                <Chip key={scope.value} label={scope.label} active={draft.scope === scope.value} onPress={() => patch({ scope: scope.value })} />
              ))}
            </View>
            {draft.scope === 'range' ? (
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                <Chip
                  label={draft.from ? `起 ${draft.from}` : '开始日期'}
                  active={false}
                  onPress={() => setPicking('from')}
                />
                <Chip label={draft.to ? `止 ${draft.to}` : '结束日期'} active={false} onPress={() => setPicking('to')} />
              </View>
            ) : null}
          </Group>

          <Group title="分类">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <Chip label="全部" active={!draft.categoryId} onPress={() => patch({ categoryId: undefined })} />
              {categories.map((category) => (
                <Chip
                  key={category.id}
                  label={category.name}
                  active={draft.categoryId === category.id}
                  onPress={() => patch({ categoryId: draft.categoryId === category.id ? undefined : category.id })}
                />
              ))}
            </View>
          </Group>

          <Group title="账户">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <Chip label="全部" active={!draft.accountId} onPress={() => patch({ accountId: undefined })} />
              {accounts.map((account) => (
                <Chip
                  key={account.id}
                  label={account.name}
                  active={draft.accountId === account.id}
                  onPress={() => patch({ accountId: draft.accountId === account.id ? undefined : account.id })}
                />
              ))}
            </View>
          </Group>
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderTopWidth: 1, borderTopColor: theme.divider }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setDraft({ keyword: '', scope: 'month' });
              onApply({ month });
              onClose();
            }}
            style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.field, backgroundColor: theme.surface }}>
            <Text style={{ color: theme.textMuted, fontSize: fontSize.body }}>重置</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onApply(draftToFilter(draft, month));
              onClose();
            }}
            style={{ flex: 2, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.field, backgroundColor: theme.primary }}>
            <Text style={{ color: theme.textOnPrimary, fontSize: fontSize.body, fontWeight: '600' }}>查看结果</Text>
          </Pressable>
        </View>
      </View>

      {picking ? (
        <DateTimePicker
          value={parseIso(`${draft[picking] ?? dayKeyOf(new Date())}T00:00:00`)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_event, selected) => {
            const key = picking;
            setPicking(null);
            if (!selected || !key) return;
            patch({ [key]: dayKeyOf(selected) } as Partial<DraftFilter>);
          }}
        />
      ) : null}
    </Modal>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View>
      <Text style={{ color: theme.textMuted, fontSize: fontSize.caption, marginBottom: spacing.sm }}>{title}</Text>
      {children}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.pill,
        backgroundColor: active ? theme.primary : theme.surface,
        borderWidth: 1,
        borderColor: active ? theme.primary : theme.divider,
      }}>
      <Text style={{ color: active ? theme.textOnPrimary : theme.text, fontSize: fontSize.caption }}>{label}</Text>
    </Pressable>
  );
}
