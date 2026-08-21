import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LandingScreen } from './screens/LandingScreen';

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
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <LandingScreen />
    </SafeAreaProvider>
  );
}
