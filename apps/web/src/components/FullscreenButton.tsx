'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useFullscreen } from '@/hooks/useFullscreen';

const HINT_KEY = 'pm.fullscreenHint.v1';
/** Berapa kali petunjuknya masih ditampilkan sebelum berhenti selamanya. */
const HINT_TIMES = 3;
const HINT_MS = 6000;

/**
 * Ikon layar penuh: empat sudut yang mengembang.
 *
 * Digambar SVG, bukan karakter unicode. Versi pertama memakai "⤢" dan pemain
 * tidak mengenalinya sebagai apa pun — panah miring itu tidak punya arti yang
 * disepakati, dan setiap font menggambarnya berbeda. Bentuk empat sudut ini
 * yang dipakai pemutar video di mana-mana, jadi ia sudah dikenali tanpa perlu
 * dijelaskan.
 */
function Icon({ active }: { readonly active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <g
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      >
        {active ? (
          // Keluar: keempat sudut menguncup ke dalam.
          <>
            <path d="M10 3v7H3" />
            <path d="M14 3v7h7" />
            <path d="M10 21v-7H3" />
            <path d="M14 21v-7h7" />
          </>
        ) : (
          // Masuk: keempat sudut mengembang keluar.
          <>
            <path d="M3 9V3h6" />
            <path d="M21 9V3h-6" />
            <path d="M3 15v6h6" />
            <path d="M21 15v6h-6" />
          </>
        )}
      </g>
    </svg>
  );
}

/**
 * Tombol layar penuh untuk halaman main.
 *
 * Tidak dirender sama sekali kalau browsernya tidak mendukung — terutama iOS
 * Safari, yang hanya mengizinkan layar penuh untuk `<video>`. Tombol yang ada
 * tapi tidak melakukan apa-apa lebih buruk daripada tombol yang tidak ada:
 * pemain akan menekannya berkali-kali dan menyimpulkan gamenya rusak. Di iPhone
 * jalannya lewat memasang gamenya ke home screen, dan itu yang dijelaskan
 * panduan pasang di halaman Pengaturan.
 */
export function FullscreenButton({
  /**
   * Tampilkan tulisannya di samping ikon.
   *
   * Di topbar ruangnya tidak ada, jadi di sana ikon saja. Di layar jeda ruangnya
   * lega — dan di situ justru tidak ada gunanya menahan diri: tombol berlabel
   * langsung dimengerti tanpa perlu petunjuk yang muncul sendiri.
   */
  withLabel = false,
}: {
  readonly withLabel?: boolean;
} = {}) {
  const t = useTranslations('common');
  const { supported, active, toggle } = useFullscreen();
  const [showHint, setShowHint] = useState(false);

  /**
   * Petunjuk sekali lewat, beberapa kali pertama saja.
   *
   * Ikon sebagus apa pun tetap harus dipelajari sekali. Menampilkan label
   * permanen di sebelahnya bukan pilihan — di layar 360 px, topbar-nya sudah
   * dipenuhi tombol kembali dan rekor. Jadi labelnya muncul sendiri di
   * kunjungan-kunjungan pertama lalu pergi untuk selamanya, alih-alih memakan
   * ruang setiap ronde selamanya.
   */
  useEffect(() => {
    // Versi berlabel tidak butuh petunjuk — tulisannya sudah ada di tombolnya.
    if (!supported || withLabel) return;
    let count = 0;
    try {
      count = Number(window.localStorage.getItem(HINT_KEY) ?? '0');
    } catch {
      // Penyimpanan diblokir (mode penyamaran, izin browser). Petunjuknya cukup
      // tidak ditampilkan; ini bukan alasan untuk menjatuhkan halamannya.
      return;
    }
    if (count >= HINT_TIMES) return;

    setShowHint(true);
    try {
      window.localStorage.setItem(HINT_KEY, String(count + 1));
    } catch {
      /* sama seperti di atas */
    }
    const timer = window.setTimeout(() => setShowHint(false), HINT_MS);
    return () => window.clearTimeout(timer);
  }, [supported, withLabel]);

  if (!supported) return null;

  const label = active ? t('exitFullscreen') : t('enterFullscreen');

  return (
    <span className="fs">
      <button
        className={`btn btn--fs${withLabel ? '' : ' btn--icon'}`}
        type="button"
        onClick={() => {
          setShowHint(false);
          toggle();
        }}
        aria-pressed={active}
        // Ikonnya tidak menjelaskan apa pun ke pembaca layar, jadi labelnya
        // ditulis lengkap di sini. Pada versi berlabel tulisannya sudah dibaca
        // dari isi tombolnya, jadi `aria-label` justru tidak dipasang — ia akan
        // MENGGANTI teks yang terlihat, dan nama yang diucapkan bisa berbeda
        // dari nama yang dibaca mata.
        aria-label={withLabel ? undefined : label}
        title={label}
      >
        <Icon active={active} />
        {withLabel && <span>{label}</span>}
      </button>
      {showHint && !active && (
        <span className="fs__hint" aria-hidden="true">
          {t('enterFullscreen')}
        </span>
      )}
    </span>
  );
}
