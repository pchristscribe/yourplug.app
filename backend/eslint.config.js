import js from '@eslint/js'
import globals from 'globals'
import { defineConfig } from 'eslint/config'

export default defineConfig([
  {
    ignores: ['node_modules/**', 'coverage/**', 'package.json']
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    ...js.configs.recommended,
    languageOptions: { globals: { ...globals.node, ...globals.es2024 } },
    rules: {
      // Fastify handlers must accept the full (request, reply, options) signature
      // even when a given call site doesn't use every parameter.
      'no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_' }]
    }
  }
])
