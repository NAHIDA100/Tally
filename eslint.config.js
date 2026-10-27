// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // .expo/ 是 expo-router 自动生成的类型文件，不该被本项目的 lint 规则评价
    ignores: ['dist/*', '.expo/*'],
  },
]);
