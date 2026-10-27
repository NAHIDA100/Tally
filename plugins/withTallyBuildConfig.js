const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  withAppBuildGradle,
  withFinalizedMod,
  withGradleProperties,
} = require('expo/config-plugins');

/**
 * 让 expo prebuild 之后仍然可直接构建的几件事。
 *
 * android/ 是 CNG 产物，每次 prebuild 都会清空重建，之前这些补丁每次都要手工还原，
 * 已经反复踩过。集中到一个插件里，prebuild 自动重放。
 */

// SDK 自带的 cmake;3.22.1 只带 ninja 1.10.2，遇到 gesture-handler codegen
// 那种把完整源码绝对路径嵌进 .o 文件名的情况会超 Windows 260 字符上限。
// ninja 1.12.1（随 cmake;3.31.6）支持长路径，且需要系统开 LongPathsEnabled。
const CMAKE_VERSION = '3.31.6';

// 真机只需 ARM；带上 x86/x86_64 会让 APK 从 75MB 涨到 153MB。
const ARCHITECTURES = 'armeabi-v7a,arm64-v8a';

/**
 * 分发版下载源。
 *
 * 优先级：显式 TALLY_GRADLE_URL > 本机已存在的离线包 > 不动（沿用 prebuild 生成的官方源）。
 * 本机到不了 GitHub，而 services.gradle.org 会 302 到 GitHub Releases，所以官方源在这里必挂；
 * 但把镜像硬编码进插件会让别的机器莫名其妙，因此只在探测到离线包时才改写。
 *
 * 离线包必须写成 file:/D:/...（file: 后面带一个斜杠）。
 * 拼成 file:D:/... 的话 GradleWrapperMain 解析出的是 opaque URI，
 * URI.getPath() 返回 null，构建在第一行就崩：
 *   NullPointerException: Cannot invoke "String.lastIndexOf(String)"
 *   because the return value of "java.net.URI.getPath()" is null
 */
const LOCAL_GRADLE_DIST = 'D:/gradle-dist/gradle-9.4.1-bin.zip';
const LOCAL_GRADLE_DIST_URL = `file:/${LOCAL_GRADLE_DIST}`;

function resolveDistributionUrl() {
  if (process.env.TALLY_GRADLE_URL) return process.env.TALLY_GRADLE_URL;
  return fs.existsSync(LOCAL_GRADLE_DIST) ? LOCAL_GRADLE_DIST_URL : null;
}

const SIGNING_APPLY_LINE = "apply from: '../../gradle/release-signing.gradle'";
const SIGNING_MARKER = '// tally: release signing';

/**
 * gradle.properties 的 modResults 是带 type 标签的条目数组（parsePropertiesFile
 * 按行分成 empty / comment / property）。写回时 propertiesListToString 会按 type
 * 分派，缺 type 的条目直接抛 `Invalid properties type "undefined"` ——
 * 这里踩过一次，不能用裸的 {key, value}。
 */
function upsertProperty(items, key, value) {
  const existing = items.find((item) => item.type === 'property' && item.key === key);
  if (existing) {
    existing.value = value;
  } else {
    items.push({ type: 'property', key, value });
  }
}

function withBuildProperties(config) {
  return withGradleProperties(config, (cfg) => {
    upsertProperty(cfg.modResults, 'android.cmakeVersion', CMAKE_VERSION);
    upsertProperty(cfg.modResults, 'reactNativeArchitectures', ARCHITECTURES);
    return cfg;
  });
}

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    const contents = cfg.modResults.contents;
    if (contents.includes(SIGNING_MARKER)) return cfg;

    cfg.modResults.contents =
      `${contents.trimEnd()}\n\n${SIGNING_MARKER}\n` +
      `// 签名逻辑放在项目根的 gradle/release-signing.gradle，这里只引入一行：\n` +
      `// 模板文件被 prebuild 重写时不需要做字符串手术。\n${SIGNING_APPLY_LINE}\n`;
    return cfg;
  });
}

/**
 * 这两样没有对应的官方 mod（wrapper 发行版、local.properties），只能直接改文件。
 *
 * 必须用 finalized 而不是 dangerous：mod-compiler.js 给 dangerous 的优先级是 -1、
 * finalized 是 1，也就是 dangerous 在所有 mod 里最先跑。放 dangerous 的话
 * 模板复制和后续 base mod 可能把我写完的内容再覆盖回去。
 */
function withGeneratedAndroidFiles(config) {
  return withFinalizedMod(config, [
    'android',
    async (cfg) => {
      const androidRoot = cfg.modRequest.platformProjectRoot;

      const distributionUrl = resolveDistributionUrl();
      const wrapperPath = path.join(androidRoot, 'gradle/wrapper', 'gradle-wrapper.properties');
      if (distributionUrl && fs.existsSync(wrapperPath)) {
        const contents = fs.readFileSync(wrapperPath, 'utf8');
        // properties 里第一个 ':' 也是键值分隔符，Gradle 自己的写法是只转义 scheme 后那个。
        const escaped = distributionUrl.replace(':', String.fromCharCode(92) + ':');
        const next = contents.replace(/^distributionUrl=.*$/m, () => `distributionUrl=${escaped}`);
        if (next !== contents) fs.writeFileSync(wrapperPath, next, 'utf8');
      }

      // local.properties 也被 prebuild 清掉；按当前机器的 ANDROID_HOME 重建，
      // 这样不导出环境变量的构建方式（如 Android Studio）也能找到 SDK。
      const sdkDir = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
      const localPropsPath = path.join(androidRoot, 'local.properties');
      if (sdkDir && !fs.existsSync(localPropsPath)) {
        // 这里不写反斜杠字面量：多层 shell / 工具转义会把它压掉，导致路径被写坏。
        const BS = String.fromCharCode(92);
        const unix = sdkDir.split(BS).join('/');
        const value = unix.split(':').join(BS + ':');
        fs.writeFileSync(localPropsPath, `sdk.dir=${value}${os.EOL}`, 'utf8');
      }

      return cfg;
    },
  ]);
}

module.exports = function withTallyBuildConfig(config) {
  return withGeneratedAndroidFiles(withReleaseSigning(withBuildProperties(config)));
};
