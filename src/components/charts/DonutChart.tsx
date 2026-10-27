import { Pie, PolarChart } from 'victory-native';
import { Text, View } from 'react-native';

import { amountFont, fontSize } from '@/src/theme/tokens';
import type { Theme } from '@/src/theme/tokens';

/**
 * victory-native 的泛型约束是 `RawData extends Record<string, unknown>`，
 * 普通 interface 不满足它（缺索引签名），会让 labelKey/valueKey 全部推断成 never。
 * 补一个索引签名即可让键名字面量被正确推断。
 */
export interface DonutDatum {
  label: string;
  value: number;
  color: string;
  [key: string]: string | number;
}

/**
 * 分类占比环形图。
 *
 * 中心文字用普通 RN Text 绝对定位盖在 Skia 画布上，而不是 victory-native 的
 * Pie.Label / Skia Text —— 后者必须显式加载一个 SkFont 才能渲染中文，
 * 为一个标签引入字体加载链路不值得。
 *
 * 这一层是图表的唯一出口：万一 Skia 在 Expo Go 上出问题，
 * 换成 react-native-gifted-charts 只需要改这个目录。
 */
export function DonutChart({
  data,
  size,
  theme,
  centerLabel,
  centerValue,
}: {
  data: DonutDatum[];
  size: number;
  theme: Theme;
  centerLabel: string;
  centerValue: string;
}) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <PolarChart
        data={data}
        labelKey="label"
        valueKey="value"
        colorKey="color"
        containerStyle={{ width: size, height: size }}>
        {/* Pie.Slice 自己从 PieSliceContext 取 slice.color，不需要也不接受颜色 prop */}
        <Pie.Chart innerRadius="72%">
          {() => <Pie.Slice />}
        </Pie.Chart>
      </PolarChart>

      <View pointerEvents="none" style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ color: theme.textMuted, fontSize: fontSize.caption }}>{centerLabel}</Text>
        <Text style={[amountFont, { color: theme.text, fontSize: fontSize.headline, fontWeight: '700' }]}>
          {centerValue}
        </Text>
      </View>
    </View>
  );
}
