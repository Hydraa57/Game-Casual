import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Apakah pengguna meminta animasi dikurangi.
 *
 * Android punya setelannya sendiri di Setelan → Aksesibilitas ("Hapus animasi"
 * / "Remove animations"), dan orang yang menyalakannya biasanya punya alasan
 * medis: gerakan besar di layar memicu pusing atau mual pada sebagian orang.
 * Mengabaikannya bukan sekadar kurang sopan — untuk mereka itu membuat
 * gamenya tidak bisa dimainkan sama sekali.
 *
 * Versi web sudah menghormatinya lewat `prefers-reduced-motion` sejak papannya
 * dibuat; berkas ini menutup lubang yang sama di Android.
 *
 * Yang dimatikan hanyalah GERAK — guncangan, gelombang pelangi, pixel yang
 * melompat masuk. Perubahan opasitas tetap jalan, karena memudar bukan gerak
 * dan menghapusnya berarti menghapus umpan balik tanpa alasan.
 */
export function useGerakDikurangi(): boolean {
  const [dikurangi, setDikurangi] = useState(false);

  useEffect(() => {
    let hidup = true;

    // Setelannya bisa diubah SELAGI aplikasi terbuka, jadi nilai awal saja
    // tidak cukup — pendengarnya yang membuat perubahan itu langsung berlaku.
    void AccessibilityInfo.isReduceMotionEnabled().then((nilai) => {
      if (hidup) setDikurangi(nilai);
    });
    const langganan = AccessibilityInfo.addEventListener('reduceMotionChanged', setDikurangi);

    return () => {
      hidup = false;
      langganan.remove();
    };
  }, []);

  return dikurangi;
}
