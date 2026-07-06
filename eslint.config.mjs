import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

// Flat config (ESLint 9). Replaces CRA's eslint-config-react-app — which pinned
// Babel 7 and @typescript-eslint 5 — with modern typescript-eslint 8. Rule
// strictness is kept close to the old react-app setup so the existing code
// still lints clean (this migration is about tooling, not new lint policy).
export default tseslint.config(
  { ignores: ['dist/', 'coverage/'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // TypeScript handles undefined identifiers and prop typing; the codebase
      // uses `any` and occasional `@ts-ignore` deliberately.
      'no-undef': 'off',
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { args: 'none', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },

  // Plain JS (utility + config files) — no type-aware rules.
  {
    files: ['**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  }
)
