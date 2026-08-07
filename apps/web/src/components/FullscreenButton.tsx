'use client';

import { useTranslations } from 'next-intl';
import { useFullscreen } from '@/hooks/useFullscreen';

/**
 * Tombol layar penuh untuk halaman main.
 *
 * Tidak dirender sama sekali kalau browsernya tidak mendukung — terutama iOS
 * Safari, yang hanya mengizinkan layar penuh untuk `<video>`. Tombol yang ada
 * tapi tidak melakukan apa-apa lebih buruk daripada tombol yang tidak ada:
 * pemain akan menekannya berkali-kali dan menyimpulkan gamenya rusak. Di iPhone
 * jalannya lewat memasang gamenya ke home screen, dan itu yang dijelaskan
 * panduan pasang di halaman awal.
 */
export function FullscreenButton() {
  const t = useTranslations('common');
  const { supported, active, toggle } = useFullscreen();

  if (!supported) return null;

  return (
    <button
      className="btn btn--small btn--icon"
      type="button"
      onClick={toggle}
      aria-pressed={active}
      // Ikonnya sendiri tidak menjelaskan apa pun ke pembaca layar, jadi
      // labelnya ditulis lengkap di sini.
      aria-label={active ? t('exitFullscreen') : t('enterFullscreen')}
      title={active ? t('exitFullscreen') : t('enterFullscreen')}
    >
      <span aria-hidden="true">{active ? '⤡' : '⤢'}</span>
    </button>
  );
}
