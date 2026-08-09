'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useInstallDiagnostics } from '@/hooks/useInstallDiagnostics';

const LABEL: Record<string, string> = {
  secure: 'checkSecure',
  manifest: 'checkManifest',
  sw: 'checkSw',
  prompt: 'checkPrompt',
};

/**
 * Panel "kenapa tombol pasangnya tidak muncul".
 *
 * Ditambahkan karena panduan pasang yang sudah beranimasi pun tidak menolong
 * pemain yang tombolnya memang tidak pernah muncul: panduan menjelaskan CARA
 * memasang, sementara yang dibutuhkan adalah ALASAN kenapa tidak bisa. Dari
 * sisi pengembang keadaan itu tidak terlihat sama sekali — semua syaratnya ada
 * di perangkat pemain, dan tidak satu pun terkirim ke server.
 *
 * **Hanya muncul saat ada yang benar-benar salah dari sisi SITUS.** Empat
 * baris "✓ HTTP 200" di halaman orang yang pemasangannya baik-baik saja itu
 * bukan informasi, itu kotoran — dan halaman Pengaturan bukan panel
 * pengembang. Selama HTTPS, manifest, dan service worker-nya beres, panel ini
 * tidak menggambar apa pun.
 *
 * Yang TIDAK ikut memunculkannya: browser yang tidak menawarkan pemasangan.
 * Itu keadaan yang normal di iPhone dan sudah dijelaskan panduan langkah demi
 * langkah tepat di bawahnya; memunculkan panel diagnosa untuk itu berarti
 * setiap pengguna iPhone melihat laporan teknis yang tidak menyiratkan apa-apa
 * selain "ada yang rusak" — padahal tidak ada.
 */
export function InstallDiagnostics({ canPrompt }: { readonly canPrompt: boolean }) {
  const t = useTranslations('install');
  const { checks, summary } = useInstallDiagnostics(canPrompt);
  const [copied, setCopied] = useState(false);

  const salin = useCallback(() => {
    void navigator.clipboard?.writeText(summary).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }, [summary]);

  if (checks.length === 0) return null;

  const gagal = (id: string): boolean => checks.some((c) => c.id === id && c.pass === false);
  // Tiga syarat yang memang tanggung jawab situs ini. Hanya ini yang berhak
  // memunculkan panelnya.
  const adaMasalahSitus = gagal('secure') || gagal('manifest') || gagal('sw');
  if (!adaMasalahSitus) return null;

  // Kegagalan yang punya jalan keluar langsung diberi saran, bukan dibiarkan
  // sebagai tanda silang tanpa tindak lanjut.
  const perluMuatUlang = gagal('sw') && !gagal('secure') && !gagal('manifest');

  return (
    <div className="diag">
      <h3 className="install__platformTitle">{t('diagTitle')}</h3>
      <p className="hint">{t('diagHint')}</p>

      <ul className="diag__list">
        {checks.map((check) => (
          <li
            key={check.id}
            className={`diag__row${check.pass === false ? ' diag__row--bad' : ''}`}
          >
            <span className="diag__mark" aria-hidden="true">
              {check.pass === null ? '…' : check.pass ? '✓' : '✕'}
            </span>
            <span className="diag__name">{t(LABEL[check.id] ?? check.id)}</span>
            {check.detail !== '' && <span className="diag__detail">{check.detail}</span>}
          </li>
        ))}
      </ul>

      {perluMuatUlang && <p className="hint hint--warn">{t('diagReloadHint')}</p>}

      <div className="diag__actions">
        <button className="btn btn--small btn--ghost" type="button" onClick={salin}>
          {copied ? t('diagCopied') : t('diagCopy')}
        </button>
        <button
          className="btn btn--small btn--ghost"
          type="button"
          onClick={() => window.location.reload()}
        >
          {t('diagRetry')}
        </button>
      </div>
    </div>
  );
}
