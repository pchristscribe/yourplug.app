import js from '@eslint/js'
import globals from 'globals'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import { defineConfig } from 'eslint/config'

// Note: lints .ts/.js files (composables, stores, utils, config). Does not
// yet lint .vue files — eslint-plugin-vue isn't installed in this workspace.
export default defineConfig([
  {
    ignores: [
      '.nuxt/**',
      '.output/**',
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'package-lock.json',
      'package.json',
      'tsconfig.json'
    ]
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    ...js.configs.recommended,
    languageOptions: { globals: { ...globals.browser, ...globals.node } }
  },
  {
    files: ['**/*.{ts,mts,cts}'],
    plugins: { '@typescript-eslint': tsPlugin },
    languageOptions: { parser: tsParser },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // TS compiler already flags real undefined-reference errors; no-undef
      // produces false positives on Nuxt/Pinia auto-imports (defineNuxtConfig,
      // useRuntimeConfig, $fetch, etc.) that have no static import statement.
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }]
    }
  }
])
