This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## 本项目已在本机真机验证过的约束（HONOR LYN-AN00 / Expo Go 58.0.5）

- **`Pressable` 的 `style` 不能写成函数形式。** 本项目用 NativeWind v4 + `jsxImportSource: 'nativewind'`，
  所有 JSX 走 css-interop；`style={({pressed}) => ({...})}` 会让整个 style 被丢弃，
  真机表现为「背景色与边框全部消失、组件变成透明」，且**不报任何错误**。
  按压反馈改用 `android_ripple`，或自己用 state 传静态对象。
- **`Image` 的百分比宽度约束不住它。** 真机上 `style={{ width: '100%', aspectRatio: 1 }}`
  让图片按原始像素画（赞赏码 1037px），把外层卡片一起撑出屏幕右边界。
  用 `useWindowDimensions()` 算出像素值传进去。
- **中文段落不能在 JSX 里换行写。** 源码换行会被折叠成一个空格，
  「……完成，\n 开发者」渲染成「完成， 开发者」，中文中间凭空一道缝。整段写在一行。
- **底部栏中间凸起的 FAB 不能用负 margin。** Android 会把超出父容器边界的子视图裁掉；
  正确做法见 `src/components/AppTabBar.tsx`：外层透明容器 + 栏体与 FAB 各自绝对定位。
- **`colorScheme.set()` 必须传「原始偏好」，不能传解析后的 light/dark。**
  NativeWind v4 的 `set()` 底层写的是原生 `Appearance` 覆盖，而 `useColorScheme()` 读回来的
  正是这个覆盖（见 `react-native-css-interop/runtime/native/appearance-observables.js`）。
  所以只 set `'light'/'dark'` 就再也清不掉了 —— 用户从「深色」切回「跟随系统」时，
  解析出来的还是刚被强制的深色，界面卡在深色不动。传 `'system'` 才会走
  `setColorScheme('unspecified')` 把覆盖清掉。
- **不要给 `react-native-reanimated/plugin` 手写进 babel plugins。** SDK 58 的 `babel-preset-expo`
  检测到 `react-native-worklets` 已安装会自动注入，重复添加会让 worklet 转换跑两遍。
- **`victory-native` 锁 `~42.0.1`，不要升到 43。** 43 的 peer 是 `react-native-skia >=2.15.1`，
  而 Expo Go 打包的是 `@shopify/react-native-skia@2.14.0`，升上去就必须自建 development build。
- **`npx expo export --platform android` 只验证模块解析，不执行任何应用代码**，不能当成「能跑」的证据。
  真正的运行时验证需要真机：`npx expo start --localhost`（自动 `adb reverse tcp:8081`）。
- **`npx expo lint` 在本机不可用**：它会装 eslint 9.39.5 然后以「需要 8.57.0 或更高」拒绝运行。
  直接用 `npx eslint .`。

## victory-native 42 的三个坑（都是真机跑出来 / 读 dist 才确认的）

- **`Bar` 的 `innerPadding` 是 0–1 的比例，不是像素。** 实现是 `barWidth = (1 - innerPadding) * 轴长 / (点数 - 1)`，
  所以传 `10` 会得到负宽度，Skia 画出反向矩形 —— 真机表现为「一整块绿色填满绘图区」而不是报错。用 `0.35` 这种量级。
- **`Pie` 的数据不走 props。** `PieChart` 从 `PolarChart` 的 context 读 `data / labelKey / valueKey / colorKey`；
  `Pie.Slice` 自己从 context 取 `slice.color`，**既不接 `fill` 也不接 `color`**。
- **`CartesianChart` 没有 `containerStyle`**（只有 `PolarChart` 有），靠父容器给高度。
  另外传给泛型的 datum 类型必须带索引签名，否则 `RawData extends Record<string, unknown>` 不成立，
  `xKey/yKeys` 会全部推断成 `never`。

## 数据库

- `budgets.category_id` 用空串 `''` 表示「月度总预算」（SQLite 的 UNIQUE 认为 NULL 互不相等）。
  **因此这一列不能加外键** —— `''` 不是任何真实分类的 id，写总预算必然 `FOREIGN KEY constraint failed`
  （v1 就是这么写的，migration v2 重建表去掉了它；级联删除由 `deleteCategory` 显式做）。
- **expo-sqlite 58 不用 Android 的 `databases/` 目录。** 库文件在 `<filesDir>/SQLite/<name>`
  （见 `node_modules/expo-sqlite/android/.../SQLiteModule.kt` 的 `defaultDatabaseDirectory`）。
  任何绕过 RN 直接读库的原生代码（桌面卡片就是）必须自己拼这个路径；
  用 `context.getDatabasePath("tally.db")` 会指向一个永远不存在的文件。
- **库是 WAL 模式**：原生侧只读打开在 `-shm` 缺失时会 `SQLITE_CANTOPEN`，所以要用
  `OPEN_READWRITE` 打开、只跑 SELECT，并显式 `enableWriteAheadLogging()`。
- **原生侧读库必须全进程共用一条连接，不能每次查询各 open/close。**
  逐次打开会把读视图钉死在第一次打开时的 WAL 快照上：真机连点三次主题，卡片三次都画
  第一次的值，等 25 秒也不追上来，`SQLiteDatabase.releaseMemory()` 和传自定义
  `CursorFactory` 都救不了（后者更糟 —— `newCursor` 返回 null 会让查询直接失败，
  卡片变成「暂时读不到账本」）。见 `WidgetData.connection()` 的 `shared`。
  症状识别：**App 自己读得到新值，卡片读不到** —— 说明是第二条连接的快照问题。
- **读库失败不许伪装成 0。** 卡片最初写 `summary?.expense ?: 0L`，于是「路径找错」被画成
  `¥0.00` —— 对记账 App 这是最坏的失败模式，数字合理、没有任何异常线索。
  现在读不到一律画 `--`，列表区区分「暂时读不到账本」和「还没有记录」。

## 桌面卡片（`modules/tally-widget`，纯 Kotlin）

- **不要用 RN 库 `react-native-android-widget`。** 它的 `onUpdate` 走 WorkManager → headless JS →
  画位图，荣耀的省电策略约 10 秒就冻结进程，卡片始终是透明的，桌面当成失败丢掉；
  而且它的 config plugin 把 receiver 硬写成 `exported: 'false'`，系统根本投不进广播。
  现在的做法：`AppWidgetProvider` 在 `onUpdate` 里**同步**查库并交回 RemoteViews。
- 四个档位：2×2 快速记一笔 / 4×1 收入支出结余 / 4×2 最近账单 / 4×3 支出分析。
  receiver 写在模块自己的 `AndroidManifest.xml` 里，靠 AGP 的 manifest 合并进包，不需要 config plugin。
- **RemoteViews 只能用白名单控件**，能按比例画的只有 `ProgressBar` —— 所以分析条用
  `setProgressBar(id, 1000, 千分比, false)`，千分比算法要和 JS 侧 `withShares` 对齐。
- **配色是从 `src/theme/tokens.ts` 手抄的十六进制**（`WidgetSupport.kt`），改 token 必须同步改它。
- 刷新时机：`bump()`（写库后）、主题、货币符号 → `TallyWidget.refresh()`。
  系统侧的 `updatePeriodMillis` 被 Android 夹到 ≥30 分钟，不能指望它。
- **已知限制：系统深色模式切换时卡片不会立刻重画**（App 界面会，见上面的主题条目）。
  桌面不会为配置变化重投 `APPWIDGET_UPDATE`，卡片要等到下一次刷新（进 App 改一下设置，或最多 30 分钟）。

## 动效（Reanimated 4）

- **worklet 里拼出来的百分比宽度不生效。** `useAnimatedStyle(() => ({ width: `${v * 100}%` }))`
  真机结果是宽度恒为 0 —— 预算进度条整条消失只剩轨道，而且**不报错，tsc 与 eslint 全过**。
  要动画化宽度得先 `onLayout` 量出像素再动数值；`scaleX` 也不行，会把 pill 的圆角端头拉扁。
  所以 `ProgressBar` 的宽度保持静态。
- 改完动画相关代码必须真机看结果，静态闸门证明不了它「能动」。

## 出原生包（Android / 本机 Windows 的三堵墙）

`npx expo prebuild --platform android` 后 `cd android && ./gradlew assembleRelease`。
第一次跑会依次撞上三件事，都不是代码问题：

1. **Gradle 分发下不来。** `services.gradle.org/distributions/...` 会 302 到 **GitHub Releases**，
   这台机器到不了 GitHub，Java 侧表现为 `SSLHandshakeException: PKIX path building failed`
   —— 看着像证书坏了，其实是重定向目标不可达。注意 **curl 能通不代表 Java 能通**：
   本机 curl 用 Schannel（走 Windows 证书库），而 Maven Central / Google Maven 用 Java
   默认信任库是**正常 200** 的，别去改 truststore。
   解法：从镜像手下 zip（`mirrors.huaweicloud.com/gradle/gradle-9.4.1-bin.zip`），
   再把 `gradle/wrapper/gradle-wrapper.properties` 的 `distributionUrl` 指到 `file\:/D:/gradle-dist/...`。
   **`file:` 后面那个斜杠不能省**：写成 `file:D:/...` 是 opaque URI，
   `GradleWrapperMain` 里 `URI.getPath()` 返回 null，构建在第一行就 NPE 崩掉（实测）。
2. **要 JDK 17。** RN 0.88 的 Gradle 插件声明 `languageVersion=17` 工具链，本机只有 21，
   而自动下载又走 foojay→GitHub。解法：装到 `D:/jdk17`，在**用户级** `~/.gradle/gradle.properties` 写
   `org.gradle.java.installations.paths` + `org.gradle.java.installations.auto-download=false`。
   放用户级而不是项目里，是因为它属于这台机器，且 `prebuild` 会重写 `android/gradle.properties`。
3. **Windows 260 字符路径上限。** gesture-handler 的 codegen 会把完整源码绝对路径嵌进 `.o` 文件名，
   实测约 339 字符，**换多短的根目录都救不回来**（固定长文件名就占 250+）。
   必须同时满足两条：SDK 里装 `cmake;3.31.6`（带 ninja 1.12.1，3.22.1 的 ninja 1.10.2 不行），
   并在 `android/gradle.properties` 设 `android.cmakeVersion=3.31.6`
   （Expo 的 `ExpoRootProjectPlugin.maybeOverrideCmakeVersion` 会把它推到所有子工程）；
   **且**系统开 `LongPathsEnabled=1`（HKLM，要管理员，属于用户自己的机器改动）。
   只升 ninja 不注册表 = 同一个错误照旧。

其它：`sdkmanager.bat` 的包名含 `;`，在 bash→cmd 两层转义下会被当成分隔符，用
`yes | powershell -NoProfile -Command "& '...\sdkmanager.bat' 'cmake;3.31.6'"` 传参。
`adb install` 传主机文件路径时**别**加 `MSYS_NO_PATHCONV=1`，否则 adb 收到字面的 `/d/...`。

产物现状：`android/gradle.properties` 里 `reactNativeArchitectures=armeabi-v7a,arm64-v8a`，
只出两个 ARM ABI，APK **75.1MB**（四个 ABI 时是 153MB，其中 140MB 是 Skia 静态库）。
签名走 `keystore/keystore.properties` + `keystore/tally-release.jks`（`CN=Tally`），
缺该文件时 `gradle/release-signing.gradle` 自动退回 debug keystore，所以别人 clone 也能构建。
**keystore 口令只在这台机器上，丢了以后新包就装不上老数据（换签必须卸载），别删也别提交。**

这三条在 `android/` 里的落地（`gradle.properties` 的两项、wrapper 离线发行包、`local.properties`、
`app/build.gradle` 末尾的签名 `apply from`）现在由 `plugins/withTallyBuildConfig` 自动重放，
**prebuild 之后不用再手工还原**。插件本身有两个坑：

- `withGradleProperties` 的 `modResults` 是带标签的条目数组（`{type:'property'|'comment'|'empty'}`），
  写回时按 `type` 分派；推裸 `{key, value}` 会让 prebuild 直接抛
  `Invalid properties type "undefined"`。
- `mod-compiler.js` 给 `dangerous` 的优先级是 **-1（最先跑）**、`finalized` 是 1（最后跑）。
  要直接改生成文件必须用 `withFinalizedMod`，放 `withDangerousMod` 有被后续 base mod 覆盖的风险。
- 插件数组顺序会影响同名 mod 的合成：`withMod.js` 里 `plugins.reverse()`，
  所以 mod 的执行顺序与 `app.json` 的 `plugins` 数组**相反**。

另外这台机器独有的两件事别写进项目文件：`~/.gradle/gradle.properties` 的 JDK 17 工具链路径、
HKLM 的 `LongPathsEnabled=1`。

## 导出与分享（真机踩过的两个坑）

- **`adb shell input text` 注入不了中文。** ASCII 正常，CJK 直接抛异常 —— 这是 Android
  `input` 工具自身的限制，不是本机编码问题。所以任何要输入中文的 UI 流程都没法自动化，
  别在这上面绕，交给人工。
- **荣耀分享面板的「保存」是静默空操作。** 点完面板直接关闭回到 App，共享存储、
  MediaStore、`Android/data/<pkg>/` 里全都找不到落盘文件，也没有任何报错或提示。
- **不要试图把导出写到 `Android/data/<pkg>/files`**：expo-file-system 的新 API 会校验路径
  必须属于本应用的 `filesDir`/`cacheDir`，写外部绝对路径会被
  `FileSystemFile.create → Missing 'READ' permission` 拒绝（真机实测，会把导出整个弄坏）。
  而且就算能写，Android 11+ 的文件管理器基本不显示 `Android/data`，用户照样找不到。
  结论：`Paths.document` 与 `Paths.cache` 在 Android 上**都是内部存储**，没有更落地的选项；
  取文件只能靠分享面板里选一个**具体应用**（文件管理 / QQ / 微信）。
  `export-import.tsx` 因此在写盘成功后先弹确认框明说这一点，再让用户主动选接收应用，
  而不是像以前那样直接替他弹分享面板。


