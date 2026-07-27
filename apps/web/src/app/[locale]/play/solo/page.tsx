import { setRequestLocale } from 'next-intl/server';
import { PlayGate } from '@/components/PlayGate';
import { SoloGame } from '@/components/SoloGame';

/**
 * `?level=N` memulai ronde dari level N. Ini alat balancing, jadi sengaja
 * hanya berlaku di development — di produksi parameternya diabaikan supaya
 * high score tidak bisa dikarang lewat URL.
 */
function parseStartLevel(value: string | string[] | undefined): number | undefined {
  if (process.env.NODE_ENV === 'production') return undefined;
  if (typeof value !== 'string') return undefined;

  const level = Number.parseInt(value, 10);
  return Number.isFinite(level) && level > 1 ? level : undefined;
}

export default async function SoloPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);

  return (
    <PlayGate>
      <SoloGame startLevel={parseStartLevel(query.level)} />
    </PlayGate>
  );
}
