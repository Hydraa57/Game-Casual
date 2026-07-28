'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

export interface LevelBarProps {
  readonly level: number;
  /** 0..1 — seberapa dekat ke level berikutnya. */
  readonly fraction: number;
  /** Teks sisa menuju level berikutnya, mis. "8 klik lagi" atau "6 dtk lagi". */
  readonly remainingLabel: string;
  /** Kurva sudah mentok; level masih naik tapi kesulitannya tidak lagi bertambah. */
  readonly atMax: boolean;
}

/**
 * Bar progres menuju level berikutnya.
 *
 * Sebelum ini kenaikan level sepenuhnya tak terduga: pemain tahu ia naik hanya
 * SETELAH terjadi. Padahal justru mengetahui "tinggal sedikit lagi" yang
 * membuat orang bertahan satu ronde lagi — itu bagian yang hilang dari
 * kurva progres, bukan sekadar hiasan.
 *
 * Satu komponen untuk solo dan multiplayer meski sumber angkanya berbeda (klik
 * vs waktu). Pelajaran dari indikator warna target: tampilan yang digandakan
 * akan menyimpang, dan salah satunya akan diam-diam berhenti benar.
 */
export function LevelBar({ level, fraction, remainingLabel, atMax }: LevelBarProps) {
  const t = useTranslations('solo');
  const [celebrating, setCelebrating] = useState(false);
  const previousLevel = useRef(level);

  /**
   * Kilau saat level benar-benar naik.
   *
   * Dipicu dari PERUBAHAN angka level, bukan dari `fraction` yang kembali ke
   * nol: di multiplayer bar-nya bergerak terus dan sempat menyentuh nol pada
   * setiap tick pertama level baru, jadi memakai fraction akan menyalakan
   * kilau ini berkali-kali untuk satu kenaikan.
   */
  useEffect(() => {
    if (level === previousLevel.current) return;
    const naik = level > previousLevel.current;
    previousLevel.current = level;
    if (!naik) return;

    setCelebrating(true);
    const timer = setTimeout(() => setCelebrating(false), 900);
    return () => clearTimeout(timer);
  }, [level]);

  return (
    <div className={`levelBar${celebrating ? ' levelBar--up' : ''}`}>
      <div className="levelBar__head">
        <span className="hud__label">
          {t('level')} {level}
          {atMax && <span className="badge"> {t('maxLevel')}</span>}
        </span>
        <span className="levelBar__remaining">{remainingLabel}</span>
      </div>
      <div
        className="levelBar__track"
        role="progressbar"
        aria-valuenow={Math.round(fraction * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('levelProgress')}
      >
        <div className="levelBar__fill" style={{ width: `${Math.min(100, fraction * 100)}%` }} />
      </div>
    </div>
  );
}
