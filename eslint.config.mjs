import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      // Wajib `import type` — selaras dengan verbatimModuleSyntax di tsconfig.base.json
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Config file di root dijalankan Node, bukan bagian dari project TS
    files: ['*.mjs', '*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
