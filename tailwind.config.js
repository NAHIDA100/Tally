/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // 主题由设置页手动控制（跟随系统/浅/深），不跟设备 prefers-color-scheme 走
  darkMode: 'class',
  theme: {
    // 颜色一律不写进 Tailwind：分类色是逐行动态值，深浅色是运行时切换，
    // 两者都必须来自 src/theme/tokens.ts。Tailwind 只负责布局、间距、圆角、字号。
    extend: {
      borderRadius: {
        card: '16px',
        field: '12px',
        pill: '999px',
      },
    },
  },
  plugins: [],
};
