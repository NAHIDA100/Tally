export type ColorScheme = 'light' | 'dark';

/**
 * 颜色字面量的类型。
 *
 * 用模板字面量而不是 string，是为了让写错的颜色（漏掉 #、写成 rgb() 混进 hex 体系）
 * 在编译期就暴露，而不是到运行时变成透明色。
 * 桌面卡片的原生实现会把这些值抄一份到 Kotlin 里，所以这里越严格越好。
 */
export type ThemeColor = `#${string}` | `rgba(${number}, ${number}, ${number}, ${number})`;

/**
 * 全 App 唯一的颜色来源。
 *
 * 为什么不放进 Tailwind：分类色是逐行动态值（用户自定义），深浅色是运行时可切换的
 * 用户设置而不是设备 prefers-color-scheme。两者都没法在编译期确定，
 * 所以 className 只管布局/间距/圆角/字号，颜色一律从这里取。
 *
 * 换主色方案（例如改成深蓝）只需要替换下面 light/dark 两个字面量。
 */
export interface Theme {
  background: ThemeColor;
  surface: ThemeColor;
  surfaceAlt: ThemeColor;
  /** 分割线、边框 */
  divider: ThemeColor;
  text: ThemeColor;
  textMuted: ThemeColor;
  textOnPrimary: ThemeColor;
  /** 渐变卡上的文字。渐变底色两套主题都偏深，所以恒为浅色；
   *  不能复用 textOnPrimary —— 深色主题下 FAB 用的是亮青 primary，需要深色字 */
  textOnGradient: ThemeColor;

  primary: ThemeColor;
  primarySoft: ThemeColor;
  gradientFrom: ThemeColor;
  gradientTo: ThemeColor;

  /** 支出：暖色但克制，不用正红 */
  expense: ThemeColor;
  /** 收入：绿色，和主色拉开亮度差以免混淆 */
  income: ThemeColor;
  warning: ThemeColor;
  danger: ThemeColor;

  keypadKey: ThemeColor;
  keypadPressed: ThemeColor;
  overlay: ThemeColor;
  tabBar: ThemeColor;
}

export const light: Theme = {
  background: '#F4F6F5',
  surface: '#FFFFFF',
  surfaceAlt: '#EDF1EF',
  divider: '#E2E7E4',
  text: '#141F1C',
  textMuted: '#6C7B76',
  textOnPrimary: '#FFFFFF',
  textOnGradient: '#FFFFFF',

  primary: '#0F766E',
  primarySoft: '#D9EDE8',
  gradientFrom: '#0F766E',
  gradientTo: '#34D399',

  expense: '#C2410C',
  income: '#15803D',
  warning: '#B45309',
  danger: '#B91C1C',

  keypadKey: '#FFFFFF',
  keypadPressed: '#E2E7E4',
  overlay: 'rgba(20, 31, 28, 0.4)',
  tabBar: '#FFFFFF',
};

export const dark: Theme = {
  background: '#0E1413',
  surface: '#17201E',
  surfaceAlt: '#1F2A27',
  divider: '#2B3733',
  text: '#E9EEEC',
  textMuted: '#8FA09A',
  textOnPrimary: '#04110F',
  textOnGradient: '#F2FBF8',

  primary: '#2DD4BF',
  primarySoft: '#123A35',
  gradientFrom: '#0B5F58',
  gradientTo: '#14B8A6',

  expense: '#FB923C',
  income: '#4ADE80',
  warning: '#FBBF24',
  danger: '#F87171',

  keypadKey: '#1F2A27',
  keypadPressed: '#2B3733',
  overlay: 'rgba(0, 0, 0, 0.55)',
  tabBar: '#17201E',
};

export const radius = {
  field: 12,
  card: 16,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const fontSize = {
  caption: 12,
  body: 15,
  title: 17,
  headline: 22,
  /** 金额主展示位 */
  amount: 40,
} as const;

/**
 * 自定义分类可选色。刻意避开 expense/income 两个语义色，
 * 否则用户给「餐饮」挑了个红色，就会和「这是支出」的视觉暗示打架。
 */
export const categoryPalette = [
  '#0F766E',
  '#0EA5E9',
  '#6366F1',
  '#8B5CF6',
  '#D946EF',
  '#DB2777',
  '#DC2626',
  '#EA580C',
  '#CA8A04',
  '#65A30D',
  '#059669',
  '#64748B',
] as const;

/**
 * 金额文本用等宽数字。
 *
 * fontVariant 单独用不够：Android 的 Roboto 没有 tnum 字形，系统会忽略它。
 * 所以同时指定 SpaceMono（真等宽，由 app/_layout.tsx 预加载），
 * 只在数字场景使用——CJK 文字仍走系统字体，否则中文会缺字。
 */
export const amountFont = {
  fontFamily: 'SpaceMono',
  fontVariant: ['tabular-nums'],
  // Space Mono 默认字距偏松，40pt 的结余数字会显得稀稀拉拉；轻微负字距收紧
  letterSpacing: -1,
} as const;
