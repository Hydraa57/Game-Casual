import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Fredoka, Nunito } from 'next/font/google';
import { notFound } from 'next/navigation';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';
import { routing } from '@/i18n/routing';
import '../globals.css';

/**
 * Dua font, dua pekerjaan yang berbeda.
 *
 * Sebelumnya seluruh game memakai monospace sistem — pilihan yang membuat
 * tampilannya terbaca sebagai terminal, bukan sebagai mainan. Untuk game
 * kasual yang ingin terasa ceria, huruf berujung bulat adalah setengah dari
 * kesannya.
 *
 * `Fredoka` untuk judul, tombol, dan angka: gemuk dan membulat, jenis huruf
 * yang memang dipakai aplikasi anak dan game kasual. `Nunito` untuk kalimat:
 * ujungnya juga bulat sehingga nadanya menyambung, tapi jauh lebih tenang —
 * paragraf yang diset dengan huruf display akan melelahkan dibaca.
 *
 * Keduanya diambil lewat `next/font`, yang mengunduhnya SAAT BUILD lalu
 * menyajikannya dari domain kita sendiri. Tidak ada permintaan ke server font
 * pihak ketiga saat pemain membuka game, jadi tidak ada blokir CSP, tidak ada
 * kedipan teks tanpa font, dan tidak ada satu pun byte tambahan dari jaringan
 * asing di jalur pemuatan.
 */
const fredoka = Fredoka({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display-src',
  display: 'swap',
});

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-body-src',
  display: 'swap',
});

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
  // Warna bilah sistem mengikuti latar halaman yang sekarang terang. Kalau
  // dibiarkan gelap, notch dan bilah status membingkai halaman krem dengan
  // pita hitam — persis kesan yang dirombak di patch ini.
  themeColor: '#fff6e9',
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
      statusBarStyle: 'default',
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
    <html lang={locale} className={`${fredoka.variable} ${nunito.variable}`}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        {/* Tidak menggambar apa pun. Ditaruh di layout supaya pendaftarannya
            terjadi di halaman mana pun pemain mendarat — termasuk tautan room
            yang dibagikan teman, yang justru paling sering jadi kunjungan
            pertama seseorang ke game ini. */}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
