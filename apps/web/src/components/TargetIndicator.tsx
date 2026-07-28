'use client';

import { useTranslations } from 'next-intl';
import { COLOR_GLYPH } from '@pixelmatrix/shared';
import type { Color } from '@pixelmatrix/shared';
import { cssColor } from '@/game/palette';

export interface TargetIndicatorProps {
  readonly colors: readonly Color[];
  /**
   * Tinta untuk tiap kata saat mode Stroop aktif; `null` = tampilan biasa.
   * Panjangnya harus sama dengan `colors`.
   */
  readonly ink: readonly Color[] | null;
}

/**
 * Indikator warna target, dipakai solo maupun multiplayer.
 *
 * Satu komponen untuk keduanya dengan sengaja: kalau dua tampilan terpisah,
 * mode Stroop akan aktif di satu mode dan tidak di mode lain tanpa ada yang
 * menyadarinya. Bug "indikator target tidak ada di multiplayer" pernah terjadi
 * tepat karena tampilannya digandakan.
 */
export function TargetIndicator({ colors, ink }: TargetIndicatorProps) {
  const t = useTranslations('solo');
  const stroop = ink !== null;

  return (
    <>
      {/*
        Kotak warna DISEMBUNYIKAN saat Stroop aktif, dan ini bukan pilihan
        kosmetik: kotak itu memperlihatkan warna target apa adanya, jadi
        membiarkannya berarti jawabannya tetap terpampang dan seluruh mode ini
        tidak melakukan apa pun. Yang tersisa hanyalah kata-katanya.
      */}
      {!stroop && (
        <span className="hud__swatches">
          {colors.map((color) => (
            <span
              key={color}
              className="hud__swatch"
              style={{ background: cssColor(color) }}
              aria-hidden="true"
            >
              {COLOR_GLYPH[color]}
            </span>
          ))}
        </span>
      )}

      <span className="hud__targetText">
        <span className="hud__label">{stroop ? t('targetStroop') : t('target')}</span>
        <div className={`stat__value${stroop ? ' hud__stroop' : ''}`}>
          {colors.map((color, index) => (
            <span key={color}>
              {index > 0 && <span className="hud__stroopPlus"> + </span>}
              <span
                // Warna tinta hanya dipakai saat Stroop; di mode biasa teksnya
                // memakai warna teks normal supaya tetap paling mudah dibaca.
                style={stroop ? { color: cssColor(ink[index] ?? color) } : undefined}
              >
                {color.toUpperCase()}
              </span>
            </span>
          ))}
        </div>
      </span>
    </>
  );
}
