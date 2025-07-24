import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'], // 包含所有单元测试
    exclude: ['e2e/**/*.spec.ts'], // 排除E2E测试
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});