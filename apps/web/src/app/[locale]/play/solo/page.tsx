import { setRequestLocale } from 'next-intl/server';
import { SoloGame } from '@/components/SoloGame';

export default async function SoloPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <SoloGame />;
}
