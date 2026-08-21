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
      // Proyek Android hasil scaffold React Native: Gradle, Java, dan XML.
      // Bukan kode TypeScript kita, dan ESLint tidak punya urusan di sana.
      'apps/mobile/android/**',
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
    // Berkas konfigurasi React Native (metro, babel, index) dijalankan Node
    // dalam bentuk CommonJS, jadi `module`, `require`, dan `__dirname` memang
    // ada di sana. Dibatasi ke berkas-berkas itu saja, bukan dilonggarkan
    // untuk seluruh aplikasi — kode aplikasinya sendiri ESM dan tidak boleh
    // diam-diam memakai global CommonJS.
    files: ['apps/mobile/metro.config.js', 'apps/mobile/babel.config.js', 'apps/mobile/index.js'],
    languageOptions: {
      globals: { module: 'readonly', require: 'readonly', __dirname: 'readonly' },
    },
    rules: {
      // Metro dan Babel MEMUAT berkas ini sebagai CommonJS sebelum ada
      // transpilasi apa pun; `import` di sini gagal saat build, bukan saat
      // lint. Larangan `require()` tetap berlaku di seluruh kode aplikasi.
      '@typescript-eslint/no-require-imports': 'off',
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
