'use client';

import { useTranslations } from 'next-intl';

export interface SoundControlsProps {
  readonly muted: boolean;
  readonly volume: number;
  onToggleMute(): void;
  onVolumeChange(volume: number): void;
}

/**
 * Tombol bisu + slider volume musik, dipakai solo maupun multiplayer.
 *
 * Satu komponen untuk keduanya karena pelajaran yang sama sudah dua kali muncul
 * di proyek ini: tampilan yang digandakan akan menyimpang, lalu salah satunya
 * diam-diam berhenti benar (lihat TargetIndicator dan LevelBar).
 */
export function SoundControls({ muted, volume, onToggleMute, onVolumeChange }: SoundControlsProps) {
  const t = useTranslations('solo');

  return (
    <div className="sound">
      <button className="btn" type="button" onClick={onToggleMute}>
        {muted ? t('muteOff') : t('muteOn')}
      </button>

      <label className="sound__volume">
        <span className="hud__label">{t('musicVolume')}</span>
        <input
          type="range"
          min={0}
          max={100}
          // Slider dinonaktifkan saat bisu, tidak disembunyikan: menghilangkannya
          // membuat tata letak melompat setiap kali tombol bisu ditekan.
          disabled={muted}
          value={Math.round(volume * 100)}
          onChange={(event) => onVolumeChange(Number(event.target.value) / 100)}
          aria-label={t('musicVolume')}
        />
      </label>
    </div>
  );
}
