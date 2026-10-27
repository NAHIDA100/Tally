import { Modal, Pressable, FlatList, Text, View } from 'react-native';

import { fontSize, radius, spacing } from '@/src/theme/tokens';
import { useTheme } from '@/src/theme/useTheme';

export interface PickerOption {
  id: string;
  label: string;
  hint?: string;
}

/**
 * 通用底部选项表。Android 上没有 ActionSheetIOS，而账户/分类这类选择只需要
 * 「一屏能看完的单选列表」，用原生 Modal 比引入一套 UI 库轻得多。
 */
export function PickerModal({
  visible,
  title,
  options,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" onPress={onClose} style={{ flex: 1, backgroundColor: theme.overlay }}>
        <View style={{ flex: 1 }} />
      </Pressable>
      <View
        style={{
          backgroundColor: theme.surface,
          borderTopLeftRadius: radius.card,
          borderTopRightRadius: radius.card,
          paddingBottom: spacing.xl,
          maxHeight: '70%',
        }}>
        <Text style={{ color: theme.text, fontSize: fontSize.title, fontWeight: '600', padding: spacing.lg }}>
          {title}
        </Text>
        <FlatList
          data={options}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const active = item.id === selectedId;
            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onSelect(item.id);
                  onClose();
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: spacing.lg,
                  paddingHorizontal: spacing.lg,
                  borderTopWidth: 1,
                  borderTopColor: theme.divider,
                }}>
                <Text style={{ color: theme.text, fontSize: fontSize.body }}>{item.label}</Text>
                {item.hint ? (
                  <Text style={{ color: active ? theme.primary : theme.textMuted, fontSize: fontSize.body }}>
                    {item.hint}
                  </Text>
                ) : null}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}
