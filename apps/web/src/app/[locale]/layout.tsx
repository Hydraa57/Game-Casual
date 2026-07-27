import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { routing } from '@/i18n/routing';
import '../globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Zoom dimatikan dengan sengaja: di game tap-cepat, double-tap zoom bikin
  // tap kedua hilang dan pemain merasa game-nya yang salah.
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f0e17',
  // Papan mengisi layar sampai ke area notch saat dipasang sebagai PWA;
  // jarak amannya diurus `env(safe-area-inset-*)` di globals.css.
  viewportFit: 'cover',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });

  return {
    title: t('title'),
    description: t('description'),
    manifest: '/manifest.webmanifest',
    // iOS Safari mengabaikan ikon di manifest; hanya apple-touch-icon yang
    // dipakainya untuk ikon di home screen.
    appleWebApp: {
      capable: true,
      title: 'Pixel Matrix',
      statusBarStyle: 'black-translucent',
    },
    other: {
      // Next hanya memancarkan `mobile-web-app-capable` (nama standar yang
      // menggantikan versi ber-prefiks apple). iOS di bawah 16.4 masih hanya
      // mengenali nama lamanya, jadi ditambahkan manual — tanpa ini game
      // dibuka dengan address bar Safari, bukan layar penuh.
      'apple-mobile-web-app-capable': 'yes',
    },
    icons: {
      icon: [
        { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: '/apple-icon.png',
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
