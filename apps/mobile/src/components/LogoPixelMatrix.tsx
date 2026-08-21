import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { warna } from '../theme';

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
  readonly posisi: { top?: number; bottom?: number; left?: number; right?: number };
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
        posisi,
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
    posisi: { top: 2, left: 16 },
  },
  {
    ukuran: 18,
    isi: '#4d9be6',
    putar: 14,
    durasiMs: 4100,
    jedaMs: 500,
    posisi: { top: 18, right: 4 },
  },
  {
    ukuran: 22,
    isi: '#63c74d',
    putar: 9,
    durasiMs: 3700,
    jedaMs: 1100,
    posisi: { bottom: 0, left: 42 },
  },
  {
    ukuran: 16,
    isi: '#fee761',
    putar: -18,
    durasiMs: 4600,
    jedaMs: 200,
    posisi: { top: 6, right: 58 },
  },
  {
    ukuran: 20,
    isi: '#f77622',
    putar: -7,
    durasiMs: 3100,
    jedaMs: 800,
    posisi: { bottom: -2, right: 16 },
  },
] as const;

/**
 * Judul "Pixel Matrix" beserta kotak-kotak melayangnya.
 *
 * Dua kata dengan dua warna, bukan gradien pelangi melintasi hurufnya — versi
 * pertama di web memakai gradien enam warna dan pemain membacanya sebagai
 * bendera, bukan sebagai logo game. Keceriaannya dibawa oleh ORNAMEN.
 */
export function LogoPixelMatrix() {
  return (
    <View style={gaya.bingkai}>
      {KOTAK.map((k) => (
        <KotakMelayang key={k.isi} {...k} />
      ))}
      <View style={gaya.judulBaris}>
        <Text style={[gaya.kata, { color: warna.grape }]}>Pixel</Text>
        <Text style={[gaya.kata, { color: warna.bubblegum }]}>Matrix</Text>
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
  },
  judulBaris: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  kata: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
});
