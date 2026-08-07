'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import type { Locale } from '@/i18n/routing';
import { readMuted, writeMuted } from '@/lib/mute';
import { readMusicVolume, writeMusicVolume } from '@/lib/musicVolume';
import { SoundControls } from './SoundControls';

const LOCALE_LABEL: Record<Locale, string> = {
  id: 'Bahasa Indonesia',
  en: 'English',
};

/**
 * Pengaturan: bahasa dan bunyi, di satu tempat.
 *
 * Ada karena keduanya sebelumnya tersebar dan sulit ditemukan — bahasa cuma
 * sebuah tautan kecil di dasar halaman awal, dan bunyi hanya bisa diubah dari
 * dalam permainan yang sedang berjalan. Setelah kontrol bunyi disembunyikan
 * dari layar main, tempat ini menjadi jalan utamanya.
 *
 * Preferensinya disimpan lewat `lib/mute` dan `lib/musicVolume` yang sama
 * dipakai solo maupun multiplayer, jadi yang diatur di sini langsung berlaku
 * di kedua mode. Tidak ada salinan state kedua di komponen ini yang bisa
 * menyimpang dari yang tersimpan.
 */
export function SettingsPanel() {
  const t = useTranslations('settings');
  const locale = useLocale() as Locale;
  const pathname = usePathname();

  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.6);

  // Dibaca di effect, bukan saat inisialisasi state: localStorage tidak ada
  // saat halaman dirender di server.
  useEffect(() => {
    setMuted(readMuted());
    setVolume(readMusicVolume());
  }, []);

  return (
    <div className="settings__panel">
      <section className="card">
        <h2 className="card__title">{t('language')}</h2>
        <div className="settings__locales">
          {routing.locales.map((option) => (
            <Link
              key={option}
              // `pathname` tanpa prefiks locale, jadi pemain tetap di halaman
              // yang sama setelah bahasanya berganti — bukan dilempar ke
              // halaman awal.
              href={pathname}
              locale={option}
              className={`btn btn--block${option === locale ? ' btn--primary' : ''}`}
              aria-current={option === locale ? 'true' : undefined}
            >
              {LOCALE_LABEL[option]}
            </Link>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="card__title">{t('sound')}</h2>
        <p className="hint">{t('soundHint')}</p>
        <SoundControls
          muted={muted}
          volume={volume}
          onToggleMute={() => {
            const next = !muted;
            setMuted(next);
            writeMuted(next);
          }}
          onVolumeChange={(next) => {
            setVolume(next);
            writeMusicVolume(next);
          }}
        />
      </section>
    </div>
  );
}
