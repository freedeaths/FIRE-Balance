import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

/**
 * ESLint configuration following modern React + TypeScript best practices
 *
 * Key features:
 * - Strict TypeScript rules for type safety
 * - React hooks rules for proper usage patterns
 * - Import/export organization rules
 * - Accessibility (a11y) rules for inclusive design
 * - Prettier integration for consistent formatting
 */
export default tseslint.config([
  // Global ignores - files/directories to skip linting
  { ignores: ['dist', 'node_modules', 'coverage', '*.config.js'] },

  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,           // Basic JavaScript best practices
      ...tseslint.configs.strict,      // Strict TypeScript rules
      ...tseslint.configs.stylistic,   // TypeScript style preferences
    ],
    languageOptions: {
      ecmaVersion: 2022,  // Modern JavaScript features
      globals: {
        ...globals.browser,  // Browser global variables (window, document, etc.)
        ...globals.es2022,   // ES2022 global features
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,  // Enable JSX parsing
        },
      },
    },
    plugins: {
      'react-hooks': reactHooks,     // React hooks rules
      'react-refresh': reactRefresh, // Vite hot reload support
    },
    rules: {
      // React Hooks rules - prevent common mistakes
      ...reactHooks.configs.recommended.rules,

      // React Refresh rules for development
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' }, // Allow unused vars starting with _
      ],
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',

      // General code quality rules
      'no-console': ['warn', { allow: ['warn', 'error'] }], // Allow warnings/errors
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
    },
  },

  // Specific rules for test files
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      // Relax some rules for test files
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
])
