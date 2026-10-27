import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';

import {
  countCategoryUsage,
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '@/src/db/repository/categories';
import { CategoryIcon, type IconName } from '@/src/components/CategoryIcon';
import { ColorPicker, IconPicker } from '@/src/components/IconPicker';
import { Screen } from '@/src/components/Screen';
import { useQuery } from '@/src/hooks/useQuery';
import { useAppStore } from '@/src/store/app';
import { fontSize, radius, spacing } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';
import type { Category, CategoryType } from '@/src/types';

export default function CategoriesScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const bump = useAppStore((state) => state.bump);
  const dataVersion = useAppStore((state) => state.dataVersion);

  const [type, setType] = useState<CategoryType>('expense');
  const [editing, setEditing] = useState<Category | 'new' | null>(null);

  const { data } = useQuery((handle) => listCategories(handle, type), [type, dataVersion]);
  const categories = data ?? [];

  async function remove(category: Category) {
    const used = await countCategoryUsage(db, category.id);
    Alert.alert(
      `删除「${category.name}」`,
      used > 0
        ? `有 ${used} 笔流水用了这个分类。删除后这些流水会归到「其他」，金额不受影响。`
        : '确定删除这个分类吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            void deleteCategory(db, category.id)
              .then(() => {
                bump();
                setEditing(null);
              })
              .catch((error: unknown) => {
                Alert.alert('删除失败', error instanceof Error ? error.message : '未知错误');
              });
          },
        },
      ],
    );
  }

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12} style={{ padding: spacing.xs }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <Text style={{ color: theme.text, fontSize: fontSize.title, fontWeight: '600' }}>分类</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="新增分类"
          onPress={() => setEditing('new')}
          hitSlop={10}
          style={{ padding: spacing.xs }}>
          <MaterialCommunityIcons name="plus" size={24} color={theme.primary} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.lg }}>
        {(['expense', 'income'] as CategoryType[]).map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            onPress={() => setType(option)}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: spacing.sm,
              borderRadius: radius.pill,
              backgroundColor: option === type ? theme.primary : theme.surface,
            }}>
            <Text style={{ color: option === type ? theme.textOnPrimary : theme.textMuted }}>
              {option === 'expense' ? '支出分类' : '收入分类'}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => setEditing(item)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: theme.divider,
            }}>
            <CategoryIcon name={item.icon} color={item.color} boxSize={36} size={20} />
            <Text style={{ color: theme.text, fontSize: fontSize.body, flex: 1 }}>{item.name}</Text>
            {item.isPreset ? (
              <Text style={{ color: theme.textMuted, fontSize: fontSize.caption }}>预置</Text>
            ) : null}
            <MaterialCommunityIcons name="chevron-right" size={18} color={theme.divider} />
          </Pressable>
        )}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
      />

      {editing ? (
        <CategoryEditor
          category={editing === 'new' ? null : editing}
          type={type}
          onClose={() => setEditing(null)}
          onSaved={() => {
            bump();
            setEditing(null);
          }}
          onRequestDelete={(category) => {
            setEditing(null);
            void remove(category);
          }}
        />
      ) : null}
    </Screen>
  );
}

function CategoryEditor({
  category,
  type,
  onClose,
  onSaved,
  onRequestDelete,
}: {
  category: Category | null;
  type: CategoryType;
  onClose: () => void;
  onSaved: () => void;
  onRequestDelete: (category: Category) => void;
}) {
  const theme = useTheme();
  const db = useSQLiteContext();
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? 'tag');
  const [color, setColor] = useState(category?.color ?? '#0F766E');
  const [showIcons, setShowIcons] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    try {
      if (category) {
        await updateCategory(db, category.id, { name, icon, color });
      } else {
        await createCategory(db, { name, type, icon, color });
      }
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
            {category ? '编辑分类' : '新增分类'}
          </Text>

          <TextInput
            value={name}
            onChangeText={(text) => {
              setName(text);
              setError(null);
            }}
            editable={!category?.isPreset}
            placeholder="分类名称"
            placeholderTextColor={theme.textMuted}
            maxLength={8}
            style={{
              color: theme.text,
              backgroundColor: theme.surfaceAlt,
              borderRadius: radius.field,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              fontSize: fontSize.body,
            }}
          />
          {category?.isPreset ? (
            <Text style={{ color: theme.textMuted, fontSize: fontSize.caption }}>
              预置分类的名称参与统计与导入的对应关系，只能改图标和颜色。
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => setShowIcons(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: theme.surfaceAlt, borderRadius: radius.field, padding: spacing.md }}>
            <CategoryIcon name={icon} color={color} boxSize={36} size={20} />
            <Text style={{ color: theme.textMuted, fontSize: fontSize.body }}>{icon}</Text>
          </Pressable>

          <ColorPicker value={color} onChange={setColor} />

          {error ? <Text style={{ color: theme.danger, fontSize: fontSize.body }}>{error}</Text> : null}

          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            {category && !category.isPreset ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => onRequestDelete(category)}
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

      <IconPicker visible={showIcons} value={icon} onSelect={(next: IconName) => setIcon(next)} onClose={() => setShowIcons(false)} />
    </Modal>
  );
}
