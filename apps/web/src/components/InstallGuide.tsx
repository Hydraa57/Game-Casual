'use client';

import { useTranslations } from 'next-intl';
import { InstallDiagnostics } from './InstallDiagnostics';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

/**
 * Peragaan satu langkah: HP kecil yang isinya digambar CSS, dengan jari yang
 * mengetuk bagian yang harus ditekan.
 *
 * Digambar dengan elemen biasa, bukan gambar atau video. Alasannya bukan
 * kepuritanan: panduan ini dibuka justru oleh pemain yang koneksinya pas-pasan,
 * dan menyuruhnya mengunduh berkas hanya untuk membaca cara memasang aplikasi
 * agar tidak perlu mengunduh apa-apa lagi itu bertentangan dengan tujuannya.
 */
function Step({
  index,
  text,
  children,
}: {
  readonly index: number;
  readonly text: string;
  readonly children: React.ReactNode;
}) {
  return (
    <li className="install__step">
      <div className="install__phone" aria-hidden="true">
        {children}
      </div>
      <p className="install__text">
        <span className="install__num">{index}</span>
        {text}
      </p>
    </li>
  );
}

/** Ikon aplikasi mini — papan 2x2 dengan warna game yang sesungguhnya. */
function AppIcon({ popping = false }: { readonly popping?: boolean }) {
  return (
    <span className={`install__icon${popping ? ' install__icon--pop' : ''}`}>
      <i style={{ background: '#e43b44' }} />
      <i style={{ background: '#4d9be6' }} />
      <i style={{ background: '#fee761' }} />
      <i style={{ background: '#63c74d' }} />
    </span>
  );
}

/**
 * Panduan memasang gamenya sebagai aplikasi.
 *
 * Bentuknya berbeda per platform karena kemampuannya memang berbeda, bukan
 * karena selera:
 *
 * - Android/Chrome memancarkan `beforeinstallprompt`, jadi di sana ada TOMBOL
 *   yang benar-benar memasang.
 * - iOS Safari tidak punya API sama sekali. Yang bisa dibantu hanya
 *   petunjuknya, dan petunjuk berupa daftar teks gampang salah diikuti —
 *   karena itu setiap langkahnya diperagakan.
 */
export function InstallGuide() {
  const t = useTranslations('install');
  const { installed, canPrompt, platform, install } = useInstallPrompt();

  if (installed) {
    return (
      <section className="card install install--done">
        <h2 className="card__title">{t('title')}</h2>
        <p className="hint hint--ok">{t('alreadyInstalled')}</p>
      </section>
    );
  }

  // Platform yang tidak dikenali (Firefox, browser dalam aplikasi) mendapat
  // KEDUA panduan. Menebak lalu menampilkan yang salah lebih membingungkan
  // daripada menampilkan dua-duanya dan membiarkan pemain memilih.
  const showAndroid = platform !== 'ios';
  const showIos = platform === 'ios' || platform === 'other';

  return (
    <section className="card install">
      <h2 className="card__title">{t('title')}</h2>
      <p className="hint">{t('why')}</p>

      {canPrompt && (
        <button className="btn btn--primary btn--block" type="button" onClick={install}>
          {t('installNow')}
        </button>
      )}

      {/* Ditaruh DI ATAS panduan langkah-langkah, bukan di bawahnya. Yang
          membukanya adalah orang yang sudah mencoba dan gagal; menyuruhnya
          menggulir melewati panduan yang sudah tidak menolong itu untuk
          menemukan jawabannya adalah urutan yang terbalik. */}
      <InstallDiagnostics canPrompt={canPrompt} />

      {showAndroid && (
        <div className="install__platform">
          <h3 className="install__platformTitle">{t('android.title')}</h3>
          <ol className="install__steps">
            <Step index={1} text={t('android.step1')}>
              <span className="install__bar install__bar--top">
                <span className="install__url" />
                <span className="install__menu install__tapTarget">⋮</span>
              </span>
              <span className="install__finger install__finger--topRight" />
            </Step>
            <Step index={2} text={t('android.step2')}>
              <span className="install__sheet">
                <span className="install__row install__row--highlight">
                  <AppIcon />
                  {t('android.sheetLabel')}
                </span>
                <span className="install__row" />
                <span className="install__row" />
              </span>
              <span className="install__finger install__finger--sheet" />
            </Step>
            <Step index={3} text={t('android.step3')}>
              <span className="install__home">
                <AppIcon popping />
                <span className="install__homeLabel">Pixel Matrix</span>
              </span>
            </Step>
          </ol>
        </div>
      )}

      {showIos && (
        <div className="install__platform">
          <h3 className="install__platformTitle">{t('ios.title')}</h3>
          {/* Peringatan ini yang paling sering menyelamatkan orang: di iPhone,
              hanya Safari yang bisa memasang. Pemain yang mencobanya dari
              Chrome akan mencari tombol yang memang tidak ada di sana. */}
          <p className="hint hint--warn">{t('ios.safariOnly')}</p>
          <ol className="install__steps">
            <Step index={1} text={t('ios.step1')}>
              <span className="install__bar install__bar--bottom">
                <span className="install__share install__tapTarget">
                  <span className="install__shareArrow">↑</span>
                </span>
                <span className="install__url" />
              </span>
              <span className="install__finger install__finger--bottomLeft" />
            </Step>
            <Step index={2} text={t('ios.step2')}>
              <span className="install__sheet">
                <span className="install__row" />
                <span className="install__row install__row--highlight">
                  <span className="install__plus">+</span>
                  {t('ios.sheetLabel')}
                </span>
                <span className="install__row" />
              </span>
              <span className="install__finger install__finger--sheet" />
            </Step>
            <Step index={3} text={t('ios.step3')}>
              <span className="install__home">
                <AppIcon popping />
                <span className="install__homeLabel">Pixel Matrix</span>
              </span>
            </Step>
          </ol>
        </div>
      )}
    </section>
  );
}
