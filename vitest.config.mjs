import {defineConfig} from 'vitest/config';

export default defineConfig({
  define: {
    // Injected by scripts/build.js for the real bundle.
    __LOUNGE_VERSION__: JSON.stringify('0.0.0-test')
  },
  test: {
    include: ['test/**/*.test.js'],
    environment: 'jsdom'
  }
});
