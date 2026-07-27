import { setRequestLocale } from 'next-intl/server';
import { MultiplayerRoom } from '@/components/MultiplayerRoom';
import { PlayGate } from '@/components/PlayGate';

/**
 * Seluruh alur multiplayer ada di satu halaman: gabung, lobby, dan (nanti)
 * match. Pindah route akan memutus socket dan memaksa join ulang, jadi kode room
 * hanya lewat `?code=` untuk link undangan.
 */
export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);

  const code = typeof query.code === 'string' ? query.code.toUpperCase() : '';
  return (
    <PlayGate>
      <MultiplayerRoom initialCode={code} />
    </PlayGate>
  );
}
