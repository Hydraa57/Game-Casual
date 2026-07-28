'use client';

import { useTranslations } from 'next-intl';
import { BOMB_LIFE_COST, GOLD_POINT_MULTIPLIER, KIND_GLYPH, MAX_LIVES } from '@pixelmatrix/shared';
import type { TutorialTopic } from '@pixelmatrix/shared';

/**
 * Lambang yang mewakili tiap penjelasan.
 *
 * Glyph pixel spesial diambil dari KIND_GLYPH, bukan ditulis ulang: `constants`
 * sudah punya test yang menjaga glyph-glyph itu tidak bertabrakan satu sama
 * lain (lihat game.test.ts), dan menyalinnya ke sini akan membuat kartu
 * tutorial menampilkan bentuk yang berbeda dari yang ada di papan.
 */
const TOPIC_GLYPH: Record<TutorialTopic, string> = {
  gold: KIND_GLYPH.gold,
  life: KIND_GLYPH.life,
  bomb: KIND_GLYPH.bomb,
  dualTarget: '◆◆',
  chaos: '⚡',
};

export interface TutorialCardProps {
  readonly topic: TutorialTopic;
  readonly level: number;
  onDismiss(): void;
}

/**
 * Kartu penjelasan satu mekanik, muncul saat mekaniknya pertama kali aktif.
 *
 * Permainan DIBEKUKAN selama kartu ini tampil — itu bukan efek samping, itu
 * intinya. Penjelasan yang muncul sambil papan terus berjalan berarti pemain
 * harus memilih antara membaca dan bermain, dan ia akan memilih bermain lalu
 * menutupnya tanpa dibaca.
 */
export function TutorialCard({ topic, level, onDismiss }: TutorialCardProps) {
  const t = useTranslations('tutorial');

  return (
    <div className="overlay overlay--tutorial" role="dialog" aria-modal="true">
      <span className="tutorial__badge">{t('unlocked', { level })}</span>
      <div className="tutorial__glyph" aria-hidden="true">
        {TOPIC_GLYPH[topic]}
      </div>
      <h2 className="overlay__title">{t(`${topic}.title`)}</h2>
      <p className="tutorial__body">
        {t(`${topic}.body`, {
          lives: BOMB_LIFE_COST,
          multiplier: GOLD_POINT_MULTIPLIER,
          maxLives: MAX_LIVES,
        })}
      </p>
      {/* Tombolnya satu dan besar: pemain sedang di tengah ronde dan ingin
          kembali bermain, bukan memilih di antara beberapa opsi. */}
      <button className="btn btn--primary" type="button" onClick={onDismiss} autoFocus>
        {t('gotIt')}
      </button>
    </div>
  );
}
