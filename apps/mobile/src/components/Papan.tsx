import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { GRID_SIZE, remainingRatio } from '@pixelmatrix/shared';
import type { Pixel } from '@pixelmatrix/shared';
import { GARIS_KISI, gayaPixel, kepekatan, LATAR_PAPAN } from '../game/palet';
import { warna } from '../theme';

/**
 * Jarak pixel dari tepi selnya, sebagai PECAHAN lebar sel.
 *
 * Ditulis sebagai pecahan, bukan angka px, dengan alasan yang sama seperti di
 * web: papan 10×10 (untuk match ramai nanti) ikut mengecil secara proporsional
 * alih-alih memakai ukuran yang tiba-tiba kebesaran dan saling tindih.
 */
const INSET_RATIO = 6 / 80;
const GLYPH_RATIO = 40 / 80;

export interface PapanProps {
  readonly pixels: readonly Pixel[];
  readonly elapsedMs: number;
  /** Panjang sisi papan dalam px layar. Papan selalu persegi. */
  readonly ukuran: number;
  readonly gridSize?: number;
  /** Menyembunyikan glyph pixel biasa — modifier chaos `blackout`. */
  readonly sembunyikanGlyph?: (pixel: Pixel) => boolean;
  readonly onTapSel: (row: number, col: number) => void;
}

/**
 * Papan permainan, digambar dengan `View` biasa.
 *
 * **Tanpa Skia, dan itu keputusan yang diukur, bukan penghematan asal.** Papan
 * ini paling banyak berisi 64 kotak berwarna dengan satu huruf di tengahnya;
 * pustaka penggambar GPU menambah ~14 MB ke unduhan tiap pemain untuk pekerjaan
 * yang bisa dilakukan komponen bawaan. Kalau suatu saat efeknya (partikel,
 * kilau emas) membuat ini tersendat, di situlah Skia dipertimbangkan lagi —
 * dengan bukti, bukan dengan firasat.
 *
 * Satu penangan sentuh untuk SELURUH papan, bukan 64 penangan per sel. Selain
 * lebih murah, itu yang membuat target sentuhnya selebar sel walau gambar
 * pixelnya lebih kecil — jempol yang meleset beberapa piksel tetap dihitung
 * mengenai selnya.
 */
export function Papan({
  pixels,
  elapsedMs,
  ukuran,
  gridSize = GRID_SIZE,
  sembunyikanGlyph,
  onTapSel,
}: PapanProps) {
  const sel = ukuran / gridSize;
  const inset = sel * INSET_RATIO;

  const garis = useMemo(
    () => Array.from({ length: gridSize - 1 }, (_, i) => (i + 1) * sel),
    [gridSize, sel],
  );

  function tangani(e: GestureResponderEvent): void {
    const { locationX, locationY } = e.nativeEvent;
    const col = Math.floor(locationX / sel);
    const row = Math.floor(locationY / sel);
    // Sentuhan yang jatuh tepat di tepi bisa menghasilkan indeks di luar papan.
    if (row < 0 || col < 0 || row >= gridSize || col >= gridSize) return;
    onTapSel(row, col);
  }

  return (
    <View
      style={[gaya.papan, { width: ukuran, height: ukuran }]}
      // `onStartShouldSetResponder` mengambil sentuhan di awal, bukan setelah
      // jari diangkat: game ini dinilai dari kecepatan, jadi tap harus dihitung
      // saat jari MENYENTUH.
      onStartShouldSetResponder={() => true}
      onResponderGrant={tangani}
    >
      {garis.map((posisi) => (
        <View key={`h${posisi}`} style={[gaya.garisH, { top: posisi }]} pointerEvents="none" />
      ))}
      {garis.map((posisi) => (
        <View key={`v${posisi}`} style={[gaya.garisV, { left: posisi }]} pointerEvents="none" />
      ))}

      {pixels.map((pixel) => {
        const g = gayaPixel(pixel);
        const tersembunyi = sembunyikanGlyph?.(pixel) === true;

        return (
          <View
            key={pixel.id}
            pointerEvents="none"
            style={[
              gaya.pixel,
              {
                left: pixel.cell.col * sel + inset,
                top: pixel.cell.row * sel + inset,
                width: sel - inset * 2,
                height: sel - inset * 2,
                backgroundColor: g.isi,
                borderColor: g.garis,
                borderWidth: g.tebalGaris,
                borderRadius: sel * 0.14,
                opacity: kepekatan(pixel, remainingRatio(pixel, elapsedMs)),
              },
            ]}
          >
            {!tersembunyi && (
              <Text
                style={[gaya.glyph, { fontSize: sel * GLYPH_RATIO, color: g.warnaGlyph }]}
                // Glyph tidak boleh ikut diperbesar setelan ukuran huruf sistem:
                // ia harus tetap muat di dalam selnya berapa pun setelan itu.
                allowFontScaling={false}
              >
                {g.glyph}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const gaya = StyleSheet.create({
  papan: {
    backgroundColor: LATAR_PAPAN,
    borderRadius: 18,
    borderWidth: 4,
    borderColor: warna.borderStrong,
    overflow: 'hidden',
    position: 'relative',
  },
  garisH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: GARIS_KISI,
  },
  garisV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: GARIS_KISI,
  },
  pixel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    // Bawaan Android menambah jarak baris di sekitar teks; tanpa dimatikan,
    // glyph-nya tidak duduk tepat di tengah selnya.
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
