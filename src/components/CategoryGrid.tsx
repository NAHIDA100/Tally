import { Pressable, ScrollView, Text, View } from 'react-native';

import { CategoryIcon } from '@/src/components/CategoryIcon';
import type { Category } from '@/src/types';
import { fontSize, spacing } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';

const COLUMNS = 5;
const CELL = 68;

/**
 * 分类网格。选中态用「实心圆 + 白图标」而不是描边，
 * 因为在拇指尺寸下描边变化很容易被忽略。
 */
export function CategoryGrid({
  items,
  selectedId,
  onSelect,
  columns = COLUMNS,
}: {
  items: Category[];
  selectedId: string | null;
  onSelect: (category: Category) => void;
  columns?: number;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {items.map((category) => {
        const selected = category.id === selectedId;
        return (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            accessibilityLabel={category.name}
            accessibilityState={{ selected }}
            onPress={() => onSelect(category)}
            style={{ width: `${100 / columns}%`, alignItems: 'center', paddingVertical: spacing.sm }}>
            <CategoryIcon
              name={category.icon}
              color={selected ? theme.textOnPrimary : category.color}
              background={selected ? theme.primary : undefined}
              boxSize={44}
              size={22}
            />
            <Text
              numberOfLines={1}
              style={{
                marginTop: 4,
                fontSize: fontSize.caption,
                color: selected ? theme.text : theme.textMuted,
                fontWeight: selected ? '600' : '400',
              }}>
              {category.name}
            </Text>
          </Pressable>
        );
      })}
      {/* 用假元素补齐最后一行，避免最后一格被 flexWrap 拉伸成半宽 */}
      {Array.from({ length: (columns - (items.length % columns)) % columns }, (_, i) => (
        <View key={`pad-${i}`} style={{ width: `${100 / columns}%`, height: CELL }} />
      ))}
    </View>
  );
}

export function FrequentCategories({
  items,
  selectedId,
  onSelect,
}: {
  items: Category[];
  selectedId: string | null;
  onSelect: (category: Category) => void;
}) {
  const theme = useTheme();
  if (items.length === 0) return null;
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={{ color: theme.textMuted, fontSize: fontSize.caption, marginBottom: spacing.xs }}>
        常用
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {items.map((category) => {
          const selected = category.id === selectedId;
          return (
            <Pressable
              key={category.id}
              accessibilityRole="button"
              accessibilityLabel={category.name}
              accessibilityState={{ selected }}
              onPress={() => onSelect(category)}
              style={{ alignItems: 'center', width: 56 }}>
              <CategoryIcon
                name={category.icon}
                color={selected ? theme.textOnPrimary : category.color}
                background={selected ? theme.primary : undefined}
                boxSize={40}
                size={20}
              />
              <Text
                numberOfLines={1}
                style={{
                  fontSize: fontSize.caption,
                  color: selected ? theme.text : theme.textMuted,
                  fontWeight: selected ? '600' : '400',
                  marginTop: 2,
                }}>
                {category.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
