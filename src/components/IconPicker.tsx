import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FlatList, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { categoryPalette, fontSize, radius, spacing } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';
import type { IconName } from '@/src/components/CategoryIcon';

/**
 * 可选图标白名单。
 *
 * 不直接放开全部 7448 个字形：一是列表没人翻，二是用户会挑出语义重复的图标，
 * 三是名字写错时图标会静默变成空白。这里每个名字都对着
 * @expo/vector-icons 的 MaterialCommunityIcons glyphmap 校验过。
 */
export const ICON_CHOICES: IconName[] = [
  'cash',
  'cash-multiple',
  'credit-card',
  'bank',
  'bank-outline',
  'wallet',
  'purse',
  'piggy-bank',
  'chart-line',
  'chart-donut',
  'briefcase',
  'store',
  'hand-coin',
  'receipt',
  'percent',
  'home-variant',
  'home-city',
  'key',
  'sofa',
  'fridge',
  'washing-machine',
  'kettle',
  'lightbulb',
  'vacuum',
  'brush',
  'broom',
  'car',
  'bus-side',
  'train-car',
  'taxi',
  'bicycle',
  'walk',
  'airplane',
  'ferry',
  'gas-station',
  'map-marker',
  'compass',
  'food',
  'food-variant',
  'silverware-fork-knife',
  'coffee',
  'cake',
  'pizza',
  'beer',
  'bottle-wine',
  'shopping',
  'shopping-outline',
  'cart',
  'tshirt-crew',
  'hanger',
  'shoe-sneaker',
  'gift',
  'tag',
  'ticket',
  'movie',
  'music',
  'gamepad-variant',
  'palette',
  'camera',
  'book-open',
  'file-document-check',
  'school',
  'puzzle',
  'medical-bag',
  'pill',
  'heart',
  'eyedropper',
  'dumbbell',
  'tennis-ball',
  'cellphone',
  'message-text',
  'wifi',
  'laptop',
  'printer',
  'headphones',
  'watch',
  'water',
  'fire',
  'snowflake',
  'leaf',
  'flower',
  'tree',
  'paw',
  'dog',
  'cat',
  'fish',
  'bird',
  'rabbit',
  'baby',
  'trophy',
  'star',
  'flag',
  'bookmark',
  'shield-check',
  'umbrella',
  'handshake',
  'earth',
  'rocket',
  'robot',
  'apps',
  'plus-circle',
];

export function IconPicker({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: string;
  onSelect: (name: IconName) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.overlay, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" onPress={onClose} style={{ flex: 1 }} />
        <View
          style={{
            backgroundColor: theme.surface,
            borderTopLeftRadius: radius.card,
            borderTopRightRadius: radius.card,
            paddingBottom: spacing.xxl,
          }}>
          <Text
            style={{
              color: theme.text,
              fontSize: fontSize.title,
              fontWeight: '600',
              padding: spacing.lg,
            }}>
            选择图标
          </Text>
          <FlatList
            data={ICON_CHOICES}
            numColumns={7}
            keyExtractor={(name) => name}
            style={{ maxHeight: 360 }}
            renderItem={({ item }) => {
              const active = item === value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  style={{
                    flex: 1,
                    aspectRatio: 1,
                    margin: 4,
                    borderRadius: radius.field,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active ? theme.primary : theme.surfaceAlt,
                  }}>
                  <MaterialCommunityIcons
                    name={item}
                    size={22}
                    color={active ? theme.textOnPrimary : theme.text}
                  />
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
      {categoryPalette.map((color) => {
        const active = color === value;
        return (
          <Pressable
            key={color}
            accessibilityRole="button"
            accessibilityLabel={`颜色 ${color}`}
            onPress={() => onChange(color)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: color,
              borderWidth: active ? 3 : 0,
              borderColor: theme.text,
            }}
          />
        );
      })}
    </ScrollView>
  );
}
