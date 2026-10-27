import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View } from 'react-native';

import { withAlpha } from '@/src/utils/color';

type GlyphMap = typeof MaterialCommunityIcons.glyphMap;
export type IconName = keyof GlyphMap;

const FALLBACK_ICON: IconName = 'label-outline';

/** 分类/账户的图标名来自数据库，可能是任意字符串；不在字库里的名字会渲染成空白，
 *  所以统一兜底，而不是让界面出现一个看不见的方块。 */
export function toIconName(value: string | null | undefined): IconName {
  if (value && value in MaterialCommunityIcons.glyphMap) return value as IconName;
  return FALLBACK_ICON;
}

export function CategoryIcon({
  name,
  color,
  background,
  iconColor,
  size = 22,
  boxSize = 40,
}: {
  name: string | null | undefined;
  /** 分类自身的颜色：默认决定图标色，并在没有显式底色时提供 12% 透明底 */
  color: string;
  background?: string;
  iconColor?: string;
  size?: number;
  boxSize?: number;
}) {
  return (
    <View
      style={{
        width: boxSize,
        height: boxSize,
        borderRadius: boxSize * 0.3,
        backgroundColor: background ?? withAlpha(color, 0.12),
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <MaterialCommunityIcons name={toIconName(name)} size={size} color={iconColor ?? color} />
    </View>
  );
}
