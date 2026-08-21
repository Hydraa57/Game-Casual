import React, { useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { font, warna } from '../theme';

/**
 * Satu kotak pixel yang melayang di sekeliling judul.
 *
 * Angka-angkanya — posisi, ukuran, kemiringan, durasi, jeda — disalin dari
 * `.landing__pixel--1..5` di CSS web, termasuk keputusan yang mudah terlewat:
 * **durasinya sengaja tidak ada yang berkelipatan** (3,1 / 3,4 / 3,7 / 4,1 /
 * 4,6 detik). Kalau seragam atau berkelipatan, kelimanya bertemu di puncak yang
 * sama secara berkala dan gerakannya berubah jadi denyut serempak — yang justru
 * terbaca seperti animasi murahan.
 */
function KotakMelayang({
  ukuran,
  isi,
  putar,
  durasiMs,
  jedaMs,
  posisi,
}: {
  readonly ukuran: number;
  readonly isi: string;
  readonly putar: number;
  readonly durasiMs: number;
  readonly jedaMs: number;
  readonly posisi: {
    top?: number | string;
    bottom?: number | string;
    left?: number | string;
    right?: number | string;
  };
}) {
  const maju = useSharedValue(0);

  useEffect(() => {
    // 0 → 1 → 0, berulang selamanya. `withDelay` yang membuat tiap kotak
    // memulai di fase yang berbeda.
    maju.value = withDelay(
      jedaMs,
      withRepeat(
        withSequence(
          withTiming(1, { duration: durasiMs / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: durasiMs / 2, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, [maju, durasiMs, jedaMs]);

  const gayaAnimasi = useAnimatedStyle(() => ({
    transform: [
      { translateY: -7 * maju.value },
      // Kemiringan dasar ikut disusun ulang di sini. Di CSS ini adalah
      // masalah nyata — `transform` cuma satu properti, jadi animasi yang
      // memakai translate akan MENIMPA rotate yang ditulis terpisah, dan semua
      // kotaknya kembali lurus. Di React Native transform-nya juga satu array,
      // jadi jebakannya sama persis.
      { rotate: `${putar + 7 * maju.value}deg` },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        gaya.kotak,
        { width: ukuran, height: ukuran, backgroundColor: isi },
        posisi as object,
        gayaAnimasi,
      ]}
    />
  );
}

/** Warna kotaknya diambil dari palet papan — hiasannya memperkenalkan warna yang sebentar lagi ditap. */
const KOTAK = [
  {
    ukuran: 26,
    isi: '#e43b44',
    putar: -12,
    durasiMs: 3400,
    jedaMs: 0,
    posisi: { top: 2, left: '4%' },
  },
  {
    ukuran: 18,
    isi: '#4d9be6',
    putar: 14,
    durasiMs: 4100,
    jedaMs: 500,
    posisi: { top: '12%', right: '-1%' },
  },
  {
    ukuran: 22,
    isi: '#63c74d',
    putar: 9,
    durasiMs: 3700,
    jedaMs: 1100,
    posisi: { bottom: 0, left: '12%' },
  },
  {
    ukuran: 16,
    isi: '#fee761',
    putar: -18,
    durasiMs: 4600,
    jedaMs: 200,
    posisi: { top: 6, right: '16%' },
  },
  {
    ukuran: 20,
    isi: '#f77622',
    putar: -7,
    durasiMs: 3100,
    jedaMs: 800,
    posisi: { bottom: -2, right: '4%' },
  },
] as const;

/** Tebal garis tepi putih di sekeliling huruf — `-webkit-text-stroke: 6px` di web. */
const TEBAL_GARIS = 6;

/**
 * Delapan arah salinan untuk memalsukan garis tepi.
 *
 * React Native tidak punya padanan `-webkit-text-stroke`, jadi garisnya dibuat
 * dengan menumpuk salinan putih teks yang sama, digeser ke segala arah, di
 * BELAKANG teks berwarnanya. Delapan arah (empat lurus + empat diagonal) sudah
 * cukup rapat untuk tebal 6 px; di bawah itu sudut hurufnya mulai bergerigi.
 *
 * Diagonalnya dibagi √2 supaya jaraknya sama dengan yang lurus — tanpa itu
 * garisnya menggembung di keempat sudut.
 */
const DIAGONAL = TEBAL_GARIS / Math.SQRT2;
const ARAH = [
  { x: -TEBAL_GARIS, y: 0 },
  { x: TEBAL_GARIS, y: 0 },
  { x: 0, y: -TEBAL_GARIS },
  { x: 0, y: TEBAL_GARIS },
  { x: -DIAGONAL, y: -DIAGONAL },
  { x: DIAGONAL, y: -DIAGONAL },
  { x: -DIAGONAL, y: DIAGONAL },
  { x: DIAGONAL, y: DIAGONAL },
] as const;

/**
 * Satu kata judul, lengkap dengan garis tepi putih dan bayangan padatnya.
 *
 * Urutan gambarnya penting dan meniru `paint-order: stroke fill` di web: garis
 * lebih dulu, isian di atasnya. Kalau dibalik — isian dulu lalu garis — garis
 * setebal 6 px akan memakan bagian dalam huruf dan bentuknya jadi kurus.
 */
function KataJudul({
  kata,
  warnaIsi,
  ukuran,
}: {
  readonly kata: string;
  readonly warnaIsi: string;
  readonly ukuran: number;
}) {
  const gayaTeks = {
    fontFamily: font.judulTebalSekali,
    fontSize: ukuran,
    lineHeight: ukuran * 1.15,
  };

  return (
    <View>
      {ARAH.map((arah) => (
        <Text
          key={`${arah.x},${arah.y}`}
          aria-hidden
          style={[
            gaya.kataGaris,
            gayaTeks,
            { transform: [{ translateX: arah.x }, { translateY: arah.y }] },
          ]}
        >
          {kata}
        </Text>
      ))}
      <Text style={[gayaTeks, { color: warnaIsi }]}>{kata}</Text>
    </View>
  );
}

/**
 * Judul "Pixel Matrix" beserta kotak-kotak melayangnya.
 *
 * Dua kata dengan dua warna, bukan gradien pelangi melintasi hurufnya — versi
 * pertama di web memakai gradien enam warna dan pemain membacanya sebagai
 * bendera, bukan sebagai logo game. Keceriaannya dibawa oleh ORNAMEN.
 */
export function LogoPixelMatrix() {
  const { width } = useWindowDimensions();
  // `clamp(2.2rem, 13vw, 3.6rem)` di web, dengan 1rem = 16 px.
  const ukuran = Math.min(Math.max(35.2, width * 0.13), 57.6);

  return (
    <View style={gaya.bingkai}>
      {KOTAK.map((k) => (
        <KotakMelayang key={k.isi} {...k} />
      ))}
      <View style={[gaya.judulBaris, { gap: ukuran * 0.32 }]}>
        <KataJudul kata="Pixel" warnaIsi={warna.grape} ukuran={ukuran} />
        <KataJudul kata="Matrix" warnaIsi={warna.bubblegum} ukuran={ukuran} />
      </View>
    </View>
  );
}

const gaya = StyleSheet.create({
  bingkai: {
    // Ruang untuk kotak-kotak yang menonjol keluar dari kotak judulnya.
    paddingVertical: 18,
    paddingHorizontal: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kotak: {
    position: 'absolute',
    borderRadius: 5,
    borderWidth: 3,
    borderColor: warna.borderStrong,
    boxShadow: '0 3px 0 rgba(53, 41, 107, 0.2)',
  },
  judulBaris: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  kataGaris: {
    // Ditumpuk tepat di atas teks isian. `absoluteFillObject` sudah tidak ada
    // di tipe RN 0.87, dan menuliskan keempat sisinya juga lebih jelas: yang
    // menentukan ukuran kotaknya adalah teks isian, salinan garis cuma
    // menempel mengikutinya.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    color: warna.surface,
    // Bayangan padat tanpa blur, sama seperti `text-shadow: 0 5px 0` di web.
    // Ditaruh pada salinan GARIS, bukan pada isian, supaya bayangannya jatuh
    // dari siluet luar huruf dan bukan dari huruf bagian dalamnya.
    textShadowColor: 'rgba(53, 41, 107, 0.22)',
    textShadowOffset: { width: 0, height: 5 },
    textShadowRadius: 0,
  },
});
