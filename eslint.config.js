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
      // set-state-in-effect flags legitimate early-return guard patterns used
      // throughout this codebase (e.g. if (!id) { setNotFound(true); return }).
      // The rule produces too many false positives to be actionable; disable it.
      'react-hooks/set-state-in-effect': 'off',
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
