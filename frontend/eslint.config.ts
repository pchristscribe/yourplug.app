import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    ignores: [
      ".nuxt/**",
      ".output/**",
      "dist/**",
      "node_modules/**",
      ".claude/**",
      "package-lock.json",
      "package.json",
      "tsconfig.json"
    ]
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    ...js.configs.recommended,
    languageOptions: { globals: globals.browser }
  },
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    files: config.files || ["**/*.{js,mjs,cjs,ts,mts,cts}"]
  })),
  ...pluginVue.configs["flat/essential"].map(config => ({
    ...config,
    files: ["**/*.vue"]
  })),
  {
    files: ["**/*.vue"],
    languageOptions: { parserOptions: { parser: tseslint.parser } }
  },
  {
    files: ["app/pages/**/*.vue", "app/layouts/**/*.vue"],
    rules: {
      "vue/multi-word-component-names": "off"
    }
  },
  {
    files: ["app/components/Pagination.vue"],
    rules: {
      "vue/multi-word-component-names": ["error", { ignores: ["Pagination"] }]
    }
  },
  {
    files: ["package.json"],
    ...json.configs.recommended[0]
  },
  {
    files: ["**/*.md"],
    ...markdown.configs.recommended[0]
  },
  {
    files: ["**/*.css"],
    ...css.configs.recommended[0]
  },
]);
