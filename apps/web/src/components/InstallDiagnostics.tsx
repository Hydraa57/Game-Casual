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
 * Panel ini menutup jarak itu dua arah: ia memberi tahu pemain apa yang kurang
 * (dan seringkali ia bisa langsung memperbaikinya sendiri — muat ulang sekali,
 * atau pindah dari Chrome ke Safari di iPhone), dan kalau ternyata bukan itu,
 * satu tombol menyalin seluruh hasilnya untuk dikirim ke orang yang membantu.
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
  // Dua kegagalan yang punya jalan keluar langsung, jadi keduanya diberi
  // saran alih-alih dibiarkan sebagai tanda silang tanpa tindak lanjut.
  const perluMuatUlang = gagal('sw') && !gagal('secure') && !gagal('manifest');
  const situsSiapTapiBrowserTidak = gagal('prompt') && !gagal('sw') && !gagal('manifest');

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
      {situsSiapTapiBrowserTidak && <p className="hint hint--warn">{t('diagBrowserHint')}</p>}

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
