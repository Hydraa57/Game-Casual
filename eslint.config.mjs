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
      // Klien Prisma dibangkitkan dari schema.prisma — bukan kode yang kita tulis.
      'packages/db/generated/**',
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
  {
    // Skrip build/tooling: dijalankan langsung oleh Node, jadi global Node
    // (Buffer, console, process) memang tersedia di sini.
    files: ['**/scripts/**/*.mjs', '**/scripts/**/*.js'],
    languageOptions: {
      globals: { Buffer: 'readonly', console: 'readonly', process: 'readonly' },
    },
  },
  {
    // Service worker punya global-nya sendiri: `self` adalah
    // ServiceWorkerGlobalScope, bukan window, dan `caches`/`fetch`/`clients`
    // hanya ada di sana. Dipisahkan per berkas, bukan dilonggarkan global —
    // `caches` yang tiba-tiba boleh dipakai di kode halaman akan lolos diam-diam
    // dan baru gagal di browser lama.
    files: ['apps/web/public/sw.js'],
    languageOptions: {
      globals: {
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        clients: 'readonly',
        URL: 'readonly',
        Promise: 'readonly',
      },
    },
  },
);
