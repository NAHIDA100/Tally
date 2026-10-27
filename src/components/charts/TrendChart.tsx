import { Bar, CartesianChart } from 'victory-native';
import { Text, View } from 'react-native';

import { fontSize } from '@/src/theme/tokens';
import type { Theme } from '@/src/theme/tokens';

export interface TrendDatum {
  /** 必须是数字：CartesianChart 的 x 轴是线性刻度，喂字符串会得到 NaN 位置，
   *  真机上表现为「所有柱子糊成一整块」而不是 6 根分开的柱子 */
  x: number;
  expense: number;
  [key: string]: string | number;
}

/**
 * 近 N 个月支出柱状图。
 *
 * value 传的是「元」而不是分：柱高只需要相对比例，这里是一次性的显示缩放，
 * 不参与任何金额合计（合计永远在整数分上做）。
 *
 * 月份标签用一行等分 flex 的 RN Text 而不是 Skia 坐标轴 —— 柱子的 x 也是等距分布的，
 * 两者天然对齐，省掉整套 axis 配置。
 */
export function TrendChart({
  data,
  labels,
  height,
  theme,
}: {
  data: TrendDatum[];
  labels: readonly string[];
  height: number;
  theme: Theme;
}) {
  const max = data.reduce((acc, d) => Math.max(acc, d.expense), 0);
  // 全 0 时给一个 1 的上界，否则 domain=[0,0] 会让 Skia 除零画不出东西
  const domainMax = max > 0 ? max * 1.15 : 1;

  // 首帧 useQuery 还没回来时 data 是空数组，victory 的 points[key] 会缺项，
  // 直接喂给 Bar 就是读 undefined。这里留白比画一个空坐标系更诚实。
  if (data.length === 0) {
    return <View style={{ height, justifyContent: 'center' }} />;
  }

  return (
    <View>
      {/* CartesianChart 没有 containerStyle，靠父容器撑开；只有 PolarChart 才接收它 */}
      <View style={{ height }}>
        <CartesianChart
          data={data}
          xKey="x"
          yKeys={['expense']}
          domain={{ x: [0, data.length - 1], y: [0, domainMax] }}
          padding={{ left: 0, right: 0, top: 6, bottom: 0 }}>
          {({ points, chartBounds }) => (
            <Bar
              points={points.expense}
              chartBounds={chartBounds}
              color={theme.primary}
              // innerPadding 是 0–1 的比例（barWidth = (1 - innerPadding) * 轴长 / (点数 - 1)），
              // 传像素值会得到负宽度，Skia 画出反向矩形糊成一整块
              innerPadding={0.35}
              roundedCorners={{ topLeft: 4, topRight: 4 }}
            />
          )}
        </CartesianChart>
      </View>

      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        {labels.map((label, index) => (
          <Text
            key={`${label}-${index}`}
            style={{ flex: 1, textAlign: 'center', color: theme.textMuted, fontSize: fontSize.caption }}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}
