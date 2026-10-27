import { View } from 'react-native';

import { clampedRatio, type BudgetProgress } from '@/src/logic/budget';
import { radius, type Theme } from '@/src/theme/tokens';

/**
 * 预算进度条。超支时整条换成 warning 色并画满 ——
 * 这时候「还剩多少」已经没有意义，「超了」才是唯一要传达的信息。
 *
 * 宽度刻意保持静态：用 Reanimated 的 worklet 产出 `'62%'` 这类百分比字符串
 * 在真机上不会生效（进度条一直是空的），而 scaleX 又会把圆角端头拉扁。
 */
export function ProgressBar({ progress, theme }: { progress: BudgetProgress; theme: Theme }) {
  const width = `${clampedRatio(progress) * 100}%`;
  return (
    <View
      style={{
        height: 6,
        borderRadius: radius.pill,
        backgroundColor: theme.surfaceAlt,
        overflow: 'hidden',
      }}>
      <View
        style={{
          width: width as `${number}%`,
          height: '100%',
          borderRadius: radius.pill,
          backgroundColor: progress.isOver ? theme.warning : theme.primary,
        }}
      />
    </View>
  );
}
