import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['packages/*/src/**/*.test.ts', 'tools/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
          exclude: ['**/*.perf.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'perf',
          include: ['packages/*/src/**/*.perf.test.ts', 'tools/**/*.perf.test.ts'],
          execArgv: ['--expose-gc'],
          environment: 'node',
          testTimeout: 120_000,
        },
      },
    ],
  },
});
