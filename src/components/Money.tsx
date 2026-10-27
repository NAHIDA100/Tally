import { Text, type TextProps, type TextStyle } from 'react-native';

import { formatAbsMoney, formatMoney, type Cents } from '@/src/logic/money';
import { amountFont } from '@/src/theme/tokens';
import { useAppStore } from '@/src/store/app';

/**
 * 所有金额展示的唯一出口。
 *
 * fontVariant: tabular-nums 在 Android 上对系统字体不一定生效（Roboto 没有 tnum），
 * 阶段 6 会用 expo-font 挂一个等宽数字字体兜底；这里先把样式收口，
 * 到时候只改这一处。
 */
export function Money({
  value,
  signed = false,
  color,
  style,
  ...rest
}: Omit<TextProps, 'children'> & { value: Cents; signed?: boolean; color?: string }) {
  const symbol = useAppStore((state) => state.currencySymbol);
  const text = signed ? formatMoney(value, symbol) : formatAbsMoney(value, symbol);
  return (
    <Text style={[amountFont as TextStyle, style]} {...rest}>
      {text}
    </Text>
  );
}
