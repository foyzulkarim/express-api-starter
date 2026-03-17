import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  // Base ignores
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  // Config files - linted without type information
  {
    files: ['*.config.ts', '*.config.js'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
  // Source files - linted with full type information
  {
    files: ['src/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TypeScript-specific rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // Import organization
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      // Architectural boundary rules using no-restricted-imports
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@prisma/client'],
              message:
                '@prisma/client can only be imported in infrastructure/database or features/*/infra files',
              allowTypeImports: true,
            },
            {
              group: ['express'],
              importNames: ['Request', 'Response', 'NextFunction', 'Router'],
              message:
                'Express types should not be imported in domain layer files - keep domain framework-agnostic',
            },
          ],
        },
      ],
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },
  },
);
