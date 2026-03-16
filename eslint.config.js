import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'
import prettierConfig from 'eslint-config-prettier'
import globals from 'globals'

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        React: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // v7 introduced set-state-in-effect but it flags common legitimate patterns
      // (e.g. setX(null) in else branches). Downgrade to warn until codebase is
      // refactored to use derived state / reducers.
      'react-hooks/set-state-in-effect': 'warn',
      // TypeScript compiler handles undefined references; disable the redundant
      // no-undef rule for .ts/.tsx files to avoid false positives on type names.
      'no-undef': 'off',
      // Allow _-prefixed identifiers to be unused (conventional "intentionally
      // unused" marker, e.g. destructured parameters like (_err, value) => ...).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  prettierConfig,
]
