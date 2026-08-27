import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LandingScreen } from './screens/LandingScreen';
import { RoomScreen } from './screens/RoomScreen';
import { SoloScreen } from './screens/SoloScreen';

type Layar = 'awal' | 'solo' | 'bareng';

/**
 * Aplikasi Android Pixel Matrix.
 *
 * Klien NATIVE, bukan situs yang dibungkus: tidak ada WebView di mana pun, dan
 * setiap hal yang terlihat di layar adalah komponen Android sungguhan.
 *
 * Yang dipakai bersama dengan web adalah ATURAN MAINNYA, lewat
 * `@pixelmatrix/shared` — warna papan, glyph, kurva kesulitan, rumus skor,
 * dan seluruh engine solo. Itu keputusan yang menentukan: mode solo harus
 * jalan tanpa internet, jadi engine-nya wajib ada di HP, dan menyalinnya ke
 * bahasa lain berarti dua salinan aturan main yang pasti akan menyimpang.
 *
 * **Perpindahan layar diurus satu `useState`, bukan pustaka navigasi.** Dengan
 * dua layar, react-navigation menambah beberapa paket dan ratusan KB untuk
 * mengelola satu nilai. Begitu layar ketiga dan keempat datang (lobby, hasil
 * match) keputusan ini layak ditinjau ulang — tapi menambahnya sekarang berarti
 * membayar di muka untuk kerumitan yang belum ada.
 */
export default function App() {
  const [layar, setLayar] = useState<Layar>('awal');

  const keAwal = useCallback(() => setLayar('awal'), []);

  /**
   * Tombol Back Android.
   *
   * Tanpa ini, menekan Back di tengah ronde menutup seluruh aplikasi — perilaku
   * baku Android saat tidak ada yang menanganinya. Mengembalikan `true` berarti
   * "sudah saya tangani"; di layar awal ia sengaja TIDAK ditangani, supaya Back
   * di sana tetap keluar dari aplikasi seperti yang diharapkan pemain.
   */
  useEffect(() => {
    if (layar === 'awal') return;

    const langganan = BackHandler.addEventListener('hardwareBackPress', () => {
      keAwal();
      return true;
    });
    return () => langganan.remove();
  }, [layar, keAwal]);

  return (
    <SafeAreaProvider>
      {layar === 'solo' ? (
        <SoloScreen onKeluar={keAwal} />
      ) : layar === 'bareng' ? (
        <RoomScreen onKeluar={keAwal} />
      ) : (
        <LandingScreen
          onMainSolo={() => setLayar('solo')}
          onMainBareng={() => setLayar('bareng')}
        />
      )}
    </SafeAreaProvider>
  );
}
