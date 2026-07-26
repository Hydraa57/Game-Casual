'use client';

import { useTranslations } from 'next-intl';
import { COLOR_GLYPH } from '@pixelmatrix/shared';
import type { ChaosModifier, Color } from '@pixelmatrix/shared';
import type { HudSnapshot } from '@/game/hudSnapshot';
import { cssColor } from '@/game/palette';

/** Kunci terjemahan untuk tiap modifier chaos. */
const CHAOS_LABEL: Record<ChaosModifier, string> = {
  rush: 'chaosRush',
  blackout: 'chaosBlackout',
  bombRain: 'chaosBombRain',
  shuffle: 'chaosShuffle',
};

export function Hud({ snapshot }: { snapshot: HudSnapshot }) {
  const t = useTranslations('solo');

  return (
    <div className="hud">
      <div className={`hud__target${snapshot.targetImminent ? ' hud__target--warning' : ''}`}>
        <span className="hud__swatches">
          {snapshot.targetColors.map((color) => (
            <Swatch key={color} color={color} />
          ))}
        </span>
        <span className="hud__targetText">
          <span className="hud__label">{t('target')}</span>
          <div className="stat__value">
            {snapshot.targetColors.map((color) => color.toUpperCase()).join(' + ')}
          </div>
        </span>
        {snapshot.chaos !== null && (
          <span className="badge badge--chaos">{t(CHAOS_LABEL[snapshot.chaos])}</span>
        )}
      </div>

      <div className="hud__stats">
        <Stat label={t('score')} value={snapshot.score} />
        <Stat
          label={t('combo')}
          value={snapshot.combo > 0 ? `${snapshot.combo}` : '—'}
          hint={snapshot.multiplier > 1 ? `×${snapshot.multiplier}` : undefined}
          tone={snapshot.multiplier > 1 ? 'combo' : undefined}
        />
        <Stat
          label={t('level')}
          value={snapshot.level}
          hint={snapshot.atMaxLevel ? t('maxLevel') : undefined}
          tone={snapshot.atMaxLevel ? 'combo' : undefined}
        />
        <Stat
          label={t('lives')}
          value={snapshot.lives === null ? '∞' : '▮'.repeat(snapshot.lives) || '—'}
          tone={snapshot.lives !== null && snapshot.lives <= 1 ? 'danger' : undefined}
        />
      </div>
    </div>
  );
}

function Swatch({ color }: { color: Color }) {
  return (
    <span className="hud__swatch" style={{ background: cssColor(color) }} aria-hidden="true">
      {COLOR_GLYPH[color]}
    </span>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'combo' | 'danger';
}) {
  const toneClass = tone ? ` stat__value--${tone}` : '';
  return (
    <div className="stat">
      <div className="hud__label">{label}</div>
      <div className={`stat__value${toneClass}`}>
        {value}
        {hint ? ` ${hint}` : ''}
      </div>
    </div>
  );
}
