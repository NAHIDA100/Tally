module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // 不要在这里手写 react-native-reanimated/plugin：SDK 58 的 babel-preset-expo
    // 检测到 react-native-worklets 已安装时会自动注入同一个插件，
    // 再加一遍会让 worklet 转换跑两次。
  };
};
