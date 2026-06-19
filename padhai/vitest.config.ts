import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // PGlite (in-memory Postgres used by db tests) has a slow first-run WASM
    // init; the default 5s test timeout is too tight for migrate+insert.
    testTimeout: 15000,
  },
});
