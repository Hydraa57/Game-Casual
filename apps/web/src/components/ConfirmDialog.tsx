'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

export interface ConfirmDialogProps {
  readonly title: string;
  readonly body: string;
  /** Label tombol yang MELANJUTKAN tindakan (keluar, meninggalkan room). */
  readonly confirmLabel: string;
  onConfirm(): void;
  onCancel(): void;
}

/**
 * Konfirmasi sebelum tindakan yang tidak bisa dibatalkan.
 *
 * Keluar dari ronde solo membuang skor yang sedang berjalan; keluar dari room
 * melepas kursi dan — kalau match sedang jalan — mengakhirinya untuk lawan juga.
 * Keduanya cuma sejauh satu ketukan yang tidak sengaja di layar HP.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const t = useTranslations('common');
  const cancelRef = useRef<HTMLButtonElement>(null);

  /**
   * Fokus jatuh ke BATAL, bukan ke tombol keluar.
   *
   * Dialog ini muncul karena pemain mungkin salah tekan; menaruh fokus di
   * tombol yang merusak berarti satu ketukan berikutnya — atau satu Enter —
   * tetap melakukan hal yang justru mau dicegah.
   */
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="confirm" role="dialog" aria-modal="true">
      {/* Latar gelap ikut bisa ditekan untuk membatalkan — di HP itu gerakan
          paling alami untuk "bukan itu maksud saya".

          Labelnya DIBEDAKAN dari tombol "Batal" di bawah. Keduanya sempat
          bernama sama, dan akibatnya ada dua kontrol dengan nama identik di
          satu dialog: pembaca layar menyebut "Batal" dua kali tanpa cara
          membedakannya, dan pemilihan berdasarkan nama jadi ambigu. */}
      <button
        className="confirm__backdrop"
        type="button"
        aria-label={t('dismiss')}
        onClick={onCancel}
      />

      <div className="confirm__panel">
        <h2 className="overlay__title">{title}</h2>
        <p className="confirm__body">{body}</p>

        <div className="confirm__actions">
          <button className="btn" type="button" onClick={onCancel} ref={cancelRef}>
            {t('cancel')}
          </button>
          <button className="btn btn--danger" type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
