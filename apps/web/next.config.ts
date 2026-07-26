import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // @pixelmatrix/shared mengekspor TypeScript source langsung, jadi Next yang
  // meng-transpile-nya. Tidak ada langkah build antara → tidak ada dist basi.
  transpilePackages: ['@pixelmatrix/shared'],

  // Supaya bisa dibuka dari HP di jaringan yang sama (`pnpm dev` sudah listen
  // di 0.0.0.0). Ganti/tambah IP LAN kamu kalau Next memblokir permintaannya.
  allowedDevOrigins: ['127.0.0.1', '192.168.0.0/16', '10.0.0.0/8'],
};

export default withNextIntl(nextConfig);
