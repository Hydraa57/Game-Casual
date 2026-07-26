'use client';

import { useTranslations } from 'next-intl';
import { COLOR_GLYPH } from '@pixelpulse/shared';
import type { HudSnapshot } from '@/game/hudSnapshot';
import { cssColor } from '@/game/palette';

export function Hud({ snapshot }: { snapshot: HudSnapshot }) {
  const t = useTranslations('solo');

  return (
    <div className="hud">
      <div className={`hud__target${snapshot.targetImminent ? ' hud__target--warning' : ''}`}>
        <span
          className="hud__swatch"
          style={{ background: cssColor(snapshot.targetColor) }}
          aria-hidden="true"
        >
          {COLOR_GLYPH[snapshot.targetColor]}
        </span>
        <span>
          <span className="hud__label">{t('target')}</span>
          <div className="stat__value">{snapshot.targetColor.toUpperCase()}</div>
        </span>
      </div>

      <div className="hud__stats">
        <Stat label={t('score')} value={snapshot.score} />
        <Stat
          label={t('combo')}
          value={snapshot.combo > 0 ? `${snapshot.combo}` : '—'}
          hint={snapshot.multiplier > 1 ? `×${snapshot.multiplier}` : undefined}
          tone={snapshot.multiplier > 1 ? 'combo' : undefined}
        />
        <Stat label={t('level')} value={snapshot.level} />
        <Stat
          label={t('lives')}
          value={snapshot.lives === null ? '∞' : '▮'.repeat(snapshot.lives) || '—'}
          tone={snapshot.lives !== null && snapshot.lives <= 1 ? 'danger' : undefined}
        />
      </div>
    </div>
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
