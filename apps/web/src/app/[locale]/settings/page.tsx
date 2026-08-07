import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { InstallGuide } from '@/components/InstallGuide';
import { SettingsPanel } from '@/components/SettingsPanel';
import { Link } from '@/i18n/navigation';

/**
 * Halaman Pengaturan: bahasa, bunyi, dan panduan memasang gamenya sebagai
 * aplikasi.
 *
 * Ketiganya disatukan karena ketiganya adalah hal yang diatur SEKALI lalu
 * dilupakan — bukan bagian dari permainan. Menaruhnya di dalam layar main
 * berarti memakan ruang layar setiap ronde untuk sesuatu yang disentuh sekali
 * seumur pemakaian.
 */
export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Settings />;
}

function Settings() {
  const t = useTranslations('settings');

  return (
    <main className="shell">
      <div className="topbar">
        <Link className="btn btn--small" href="/">
          ← {t('back')}
        </Link>
      </div>

      <h1 className="pageTitle">{t('title')}</h1>

      <SettingsPanel />
      <InstallGuide />
    </main>
  );
}
