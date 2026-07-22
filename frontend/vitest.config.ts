import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'happy-dom',
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },
  },
  resolve: {
    // Nuxt 4 keeps sources in ./app, so '~' and '@' must resolve there.
    // The '~/app/*' forms are matched first so existing imports of both
    // shapes keep working. Order matters: vite tries these in sequence.
    alias: [
      { find: /^~\/app\//, replacement: fileURLToPath(new URL('./app/', import.meta.url)) },
      { find: /^@\/app\//, replacement: fileURLToPath(new URL('./app/', import.meta.url)) },
      { find: /^~\//, replacement: fileURLToPath(new URL('./app/', import.meta.url)) },
      { find: /^@\//, replacement: fileURLToPath(new URL('./app/', import.meta.url)) },
    ],
  },
})
