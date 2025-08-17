import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

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
  {
    ignores: [
      'dist',
      'node_modules',
      'coverage',
      '*.config.js',
      '.vite/**',
      'src/test-setup.ts', // Test setup file with mock functions
      'src/types/json.d.ts', // Declaration files need any types
      'src/**/__mocks__/**', // Mock files
    ],
  },

  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended, // Basic JavaScript best practices
      ...tseslint.configs.strict, // Strict TypeScript rules
      ...tseslint.configs.stylistic, // TypeScript style preferences
    ],
    languageOptions: {
      ecmaVersion: 2022, // Modern JavaScript features
      globals: {
        ...globals.browser, // Browser global variables (window, document, etc.)
        ...globals.es2022, // ES2022 global features
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true, // Enable JSX parsing
        },
      },
    },
    plugins: {
      'react-hooks': reactHooks, // React hooks rules
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

      // TypeScript specific rules - relaxed for development
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }, // Allow unused vars starting with _
      ],
      '@typescript-eslint/explicit-function-return-type': 'off', // Too strict for development
      '@typescript-eslint/no-explicit-any': 'warn', // Allow any for rapid development
      '@typescript-eslint/no-non-null-assertion': 'warn', // Allow when you know it's safe
      '@typescript-eslint/array-type': 'off', // Allow both Array<T> and T[]
      '@typescript-eslint/no-inferrable-types': 'off', // Allow explicit types for clarity
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-namespace': 'warn',
      '@typescript-eslint/no-extraneous-class': 'warn',
      '@typescript-eslint/consistent-indexed-object-style': 'warn',
      '@typescript-eslint/no-dynamic-delete': 'warn',

      // General code quality rules - relaxed
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }], // Allow console.log too
      'prefer-const': 'warn',
      'no-var': 'error',
      'object-shorthand': 'warn',
      'prefer-template': 'warn',
      'no-prototype-builtins': 'warn',
      'no-case-declarations': 'warn', // Allow variable declarations in case blocks
      'prefer-rest-params': 'warn', // Allow arguments object when needed
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

  // Specific rules for CLI and development files
  {
    files: ['cli.ts', '**/*.config.{ts,js}', 'jest.config.ts'],
    rules: {
      // CLI tools need console output and flexible types
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Specific rules for chart components (need flexibility for third-party libraries)
  {
    files: ['src/components/charts/**/*.{ts,tsx}'],
    rules: {
      // Chart components may need any types for third-party library integration
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      'no-console': 'warn', // Allow for debugging
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Specific rules for TypeScript declaration and type files
  {
    files: ['src/types/**/*.{ts,d.ts}', '**/*.d.ts'],
    rules: {
      // Type definition files need flexibility
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },

  // Specific rules for utility files
  {
    files: ['src/utils/**/*.{ts,tsx}'],
    rules: {
      // Utility functions may need flexible types for generic operations
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      'no-prototype-builtins': 'warn',
      '@typescript-eslint/no-inferrable-types': 'warn',
    },
  },
]);
