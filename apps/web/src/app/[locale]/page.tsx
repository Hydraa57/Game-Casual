import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { LandingMenu } from '@/components/LandingMenu';
import { LoadingGate } from '@/components/LoadingGate';

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Landing />;
}

/**
 * Halaman awal.
 *
 * Tautan "ganti bahasa" yang dulu menempel di dasar halaman sudah dipindahkan
 * ke menu Pengaturan: sejak kontrol bunyi dikeluarkan dari layar main, bahasa
 * dan suara berada di satu tempat, dan tautan yang tersisa di sini cuma
 * mengulanginya di tempat yang lebih sulit ditemukan.
 */
function Landing() {
  const t = useTranslations('landing');

  return (
    // Aset gamenya diunduh DULU, menunya dibuka setelahnya.
    //
    // Menggantikan `PrefetchGame` di halaman ini: pemanasan saat idle memang
    // tidak menghalangi apa pun, tapi ia juga tidak menjamin apa pun — pemain
    // yang langsung menekan "Main Solo" tetap menunggu ~330 KB Phaser dengan
    // layar yang tidak menjelaskan kenapa. Di sini penantiannya dipindahkan ke
    // depan, di tempat yang memang menjelaskan dirinya.
    //
    // `PrefetchGame` tetap dipakai di lobby room, di mana menahan pemain justru
    // salah: di sana ia sedang menunggu temannya, bukan menunggu unduhan.
    <LoadingGate>
      <main className="shell landing">
        <header className="landing__header">
          {/*
            Judulnya digambar sendiri, bukan sekadar teks berwarna.

            Versi pertama memakai gradien enam warna melintasi hurufnya. Secara
            teknis itu warna papan gamenya sendiri, tapi pemain membacanya
            sebagai bendera pelangi alih-alih sebagai logo game — kesan yang
            sama sekali tidak dituju. Sekarang dua kata dengan dua warna saja,
            digaris tebal seperti stiker, dan keceriaannya dibawa oleh
            ORNAMEN: kotak-kotak pixel kecil dalam warna papan yang melayang di
            sekeliling judul. Itu juga lebih jujur menceritakan gamenya —
            pixel, bukan pelangi.

            Kotaknya `aria-hidden`: ia hiasan, dan membacakannya ke pembaca
            layar hanya menambah bunyi tanpa arti.
          */}
          <div className="landing__logo">
            <span className="landing__pixel landing__pixel--1" aria-hidden="true" />
            <span className="landing__pixel landing__pixel--2" aria-hidden="true" />
            <span className="landing__pixel landing__pixel--3" aria-hidden="true" />
            <span className="landing__pixel landing__pixel--4" aria-hidden="true" />
            <span className="landing__pixel landing__pixel--5" aria-hidden="true" />
            <h1 className="landing__title">
              {t('title')
                .split(' ')
                .map((word, index) => (
                  <span
                    key={word}
                    className={`landing__word landing__word--${index % 2 === 0 ? 'a' : 'b'}`}
                  >
                    {word}
                  </span>
                ))}
            </h1>
          </div>
          {/*
            Tagline dipecah per kata dengan pemisah. Sebagai satu kalimat
            ("Otak Santai Bareng") ia terbaca seperti keterangan yang belum
            selesai; sebagai tiga kata bertitik ia terbaca sebagai tiga kata
            kunci — dan itu memang isinya.

            Pemisahnya `aria-hidden` supaya pembaca layar tetap mendengar
            kalimatnya utuh, bukan "otak titik santai titik bareng".
          */}
          <p className="landing__tagline">
            {t('tagline')
              .split(' ')
              .map((word, index) => (
                <span key={word} className="landing__taglineWord">
                  {index > 0 && (
                    <span className="landing__taglineDot" aria-hidden="true">
                      ◆
                    </span>
                  )}
                  {word}
                </span>
              ))}
          </p>
        </header>

        <p className="landing__intro">{t('intro')}</p>

        <section className="card">
          <h2 className="card__title">{t('howToTitle')}</h2>
          <ol className="steps">
            <li>{t('howTo.step1')}</li>
            <li>{t('howTo.step2')}</li>
            <li>{t('howTo.step3')}</li>
            <li>{t('howTo.step4')}</li>
          </ol>
        </section>

        <LandingMenu />
      </main>
    </LoadingGate>
  );
}
