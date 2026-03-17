import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    exclude: ['**/*.integration.test.ts', 'node_modules/**', 'dist/**'],
    passWithNoTests: true,
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
