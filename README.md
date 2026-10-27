# Tally

「3 秒记一笔」的极简记账应用。数据全部存在本机 SQLite，无后端、无账号、无云同步。

## 跑起来

```bash
npm install
npx expo start --localhost
```

`--localhost` 会自动执行 `adb reverse tcp:8081 tcp:8081`，所以手机插着数据线就行，不需要和电脑在同一 Wi-Fi。
手机上的 Expo Go 需要是 SDK 58 版本（本项目 `expo@58`）。

验证：

```bash
npx tsc --noEmit
npx eslint .
npx vitest run
```

> `npx expo lint` 在本机会因为版本判断 bug 拒绝运行，直接用 `npx eslint .`。

## 三条不可违反的约定

1. **金额永远是整数分。** 展示时才格式化成元。禁止 `parseFloat(x) * 100` 这类浮点金额运算 ——
   `0.07 * 100 = 7.000000000000001`，靠 `Math.round` 掩盖迟早会出问题。
   所有转换集中在 [src/logic/money.ts](src/logic/money.ts)，有单测覆盖。
2. **时间存 UTC ISO，展示按本地时区。** 同时冗余存 `occurredDate` / `occurredMonth` 两列，
   因为「按天分组、按月统计」是最高频查询，而对 `occurred_at` 跑 `strftime(...,'localtime')` 会让索引全部失效。
3. **SQL 只出现在 [src/db/repository/](src/db/repository/)。** UI 层不写 SQL，也不直接开数据库。
   转账（`type = 'transfer'`）不计入收入也不计入支出，只改变两个账户的余额。

## 目录

```
app/          expo-router 路由，只放页面
src/
  components/ UI 组件
  charts/     victory-native 封装层（换图表库只动这里）
  hooks/      读数据的钩子，桥接组件与 repository
  db/         client、迁移、预置数据、repository
  logic/      纯函数：金额、日期、统计、预算、CSV、备份。零 RN 依赖，可单测
  theme/      设计 token 与深浅色
  store/      Zustand：UI 状态 + 数据失效信号
```

状态管理刻意做得很薄：数据库是唯一真源，写库成功后 `useAppStore.getState().bump()` 让
[src/hooks/useQuery.ts](src/hooks/useQuery.ts) 重新查询。没有缓存层，因为本地读是毫秒级的。

## 版本锁

`victory-native` 锁 `~42.0.1`，**不要升到 43**。43 的 peer 是 `react-native-skia >=2.15.1`，
而 Expo Go 打包的是 `@shopify/react-native-skia@2.14.0` —— 升上去就必须自建 development build。
42 版可以在 Expo Go 里直接跑。

## 已知取舍

- 金额用 Space Mono 保证等宽。Android 的 Roboto 没有 `tnum` 字形，单靠 `fontVariant: ['tabular-nums']` 不可靠。
- 分类被流水引用时不能直接删：会把引用改派到不可删除的「其他」分类。账户被引用时只能归档。
- 左滑只负责露出「删除」按钮，需要再点一次才真删；删除后 5 秒内可撤销（按原 id 重插）。
- 导出 CSV 的金额单位是「元」（方便 Excel），导出 JSON 是「分」（无损）。导入时两条路径分别处理，
  且按 id 去重 —— 对同一份文件重复导入是幂等的。
- 动效克制：只给撤销提示做了滑入/淡出，按键与 FAB 用 Android 原生 ripple。
  预算进度条**故意不做生长动画** —— Reanimated 的 worklet 产出 `'62%'` 这类百分比宽度在真机上不生效，
  整条会消失且不报错；改用 `scaleX` 又会把圆角端头拉扁。
- 记一笔触到金额上限（¥99,999,999.99，整数部分 8 位）时会拒收这个按键并直接提示上限是多少，
  而不是让键盘看起来失灵。默认账户若已归档，会自动改用第一个可用账户，避免把流水记到看不见的账户上。

## 许可与赞助

MIT 许可，见 [LICENSE](LICENSE)。所有功能免费，没有广告、会员和内购，也不会弹任何付费提醒。
应用内「我的 → 赞助开发者」是纯自愿的入口。

更多实现层面的坑（NativeWind 对 `Pressable` 函数式 style 的影响、victory-native 42 的 API 陷阱、
`budgets` 表为什么不能有外键、Reanimated 百分比宽度）记录在 [AGENTS.md](AGENTS.md)。
