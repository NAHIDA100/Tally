import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * 只跑 node 环境：src/logic 是零 React Native 依赖的纯函数层，
 * 一旦某个 logic 文件 import 了 RN 模块，这里会直接报
 * "Cannot find module './ReactNativePermissions'" 之类的错——那是分层被破坏的信号。
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
