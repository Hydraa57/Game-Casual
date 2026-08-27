import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ALL_COLORS } from '@pixelmatrix/shared';
import { warnaPapanCss } from '../game/palet';
import { font, warna } from '../theme';

/**
 * Efek sekali-jalan di atas papan.
 *
 * Semuanya membersihkan dirinya sendiri: tiap komponen memanggil `onSelesai`
 * saat animasinya habis, dan papan membuang efek itu dari daftarnya. Tanpa itu,
 * satu ronde panjang akan menumpuk ratusan View mati yang tidak pernah dilepas.
 *
 * Dipisah ke berkas sendiri karena `Papan` sudah cukup padat: papan mengurus
 * apa yang ADA di layar, berkas ini mengurus apa yang BARU SAJA TERJADI.
 */

/** Semua efek mendapat id unik supaya React tidak menyatukan dua efek berbeda. */
export interface EfekDasar {
  readonly id: number;
  readonly onSelesai: (id: number) => void;
}

// ------------------------------------------------------------------ ledakan

export interface PropsLedakan extends EfekDasar {
  readonly kiri: number;
  readonly atas: number;
  readonly ukuran: number;
  readonly isi: string;
}

/**
 * Kilatan kotak yang membesar lalu hilang di tempat pixel direbut.
 *
 * Warnanya diambil dari pixel yang baru saja diambil, bukan warna tetap:
 * itu yang membuat semburannya terbaca sebagai "yang tadi itu" alih-alih
 * sebagai kilatan generik.
 */
export function Ledakan({ id, onSelesai, kiri, atas, ukuran, isi }: PropsLedakan) {
  const maju = useSharedValue(0);

  useEffect(() => {
    maju.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }, (habis) => {
      if (habis === true) runOnJS(onSelesai)(id);
    });
  }, [maju, id, onSelesai]);

  const gayaAnimasi = useAnimatedStyle(() => ({
    opacity: 0.85 * (1 - maju.value),
    transform: [{ scale: 1 + maju.value * 1.4 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        gaya.ledakan,
        { left: kiri, top: atas, width: ukuran, height: ukuran, backgroundColor: isi },
        gayaAnimasi,
      ]}
    />
  );
}

// ------------------------------------------------------------- skor melayang

export interface PropsSkor extends EfekDasar {
  readonly kiri: number;
  readonly atas: number;
  readonly ukuranSel: number;
  readonly teks: string;
}

/** Angka poin yang naik lalu pudar — bukti bahwa ketukan itu berbuah. */
export function SkorMelayang({ id, onSelesai, kiri, atas, ukuranSel, teks }: PropsSkor) {
  const maju = useSharedValue(0);

  /*
    Jarak naiknya DIJEPIT supaya angkanya tidak pernah keluar dari papan.

    Papan memakai `overflow: 'hidden'`, jadi apa pun yang melewati tepi atas
    terpotong bersih — dan pixel di baris teratas justru yang paling sering
    diketuk di awal ronde. Tanpa jepitan ini, poin pertama yang dilihat pemain
    adalah poin yang hilang separuh.

    Versi web tidak punya masalah ini karena Phaser menggambar di kanvas yang
    lebih tinggi dari papannya.
  */
  const naik = Math.min(ukuranSel * 0.8, Math.max(0, atas));

  useEffect(() => {
    maju.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }, (habis) => {
      if (habis === true) runOnJS(onSelesai)(id);
    });
  }, [maju, id, onSelesai]);

  const gayaAnimasi = useAnimatedStyle(() => ({
    // Pudarnya dimulai di paruh kedua, bukan sejak awal: angka yang langsung
    // memudar tidak sempat terbaca.
    opacity: maju.value < 0.5 ? 1 : 1 - (maju.value - 0.5) * 2,
    // Membesar dari 0,7 ke 1 seperti di web: itu yang membuatnya terbaca
    // sebagai REAKSI atas ketukan, bukan sebagai teks yang kebetulan bergerak.
    transform: [
      { translateY: -maju.value * naik },
      { scale: 0.7 + Math.min(1, maju.value * 3) * 0.3 },
    ],
  }));

  return (
    <Animated.Text
      pointerEvents="none"
      allowFontScaling={false}
      style={[
        gaya.skor,
        { left: kiri, top: atas, width: ukuranSel, fontSize: ukuranSel * 0.34 },
        gayaAnimasi,
      ]}
    >
      {teks}
    </Animated.Text>
  );
}

// ------------------------------------------------------------- teks di tengah

export interface PropsTeksTengah extends EfekDasar {
  readonly teks: string;
  readonly warnaTeks: string;
  readonly ukuran: number;
  readonly lamaMs?: number;
}

/**
 * Teks besar di tengah papan — dipakai combo dan naik level.
 *
 * Satu komponen untuk keduanya karena gerakannya memang sama: melompat masuk,
 * ditahan sebentar, lalu naik sambil pudar. Yang berbeda cuma kata dan warnanya.
 */
export function TeksTengah({
  id,
  onSelesai,
  teks,
  warnaTeks,
  ukuran,
  lamaMs = 800,
}: PropsTeksTengah) {
  const maju = useSharedValue(0);

  useEffect(() => {
    // 0 → 1 (masuk) → 2 (keluar). Ditahan di 1 selama sisa waktunya.
    maju.value = withSequence(
      withTiming(1, { duration: 170, easing: Easing.out(Easing.back(2)) }),
      withDelay(
        lamaMs - 170 - 260,
        withTiming(2, { duration: 260, easing: Easing.in(Easing.quad) }, (habis) => {
          if (habis === true) runOnJS(onSelesai)(id);
        }),
      ),
    );
  }, [maju, id, onSelesai, lamaMs]);

  const gayaAnimasi = useAnimatedStyle(() => {
    const masuk = Math.min(1, maju.value);
    const keluar = Math.max(0, maju.value - 1);
    return {
      opacity: masuk * (1 - keluar),
      transform: [{ scale: 0.6 + masuk * 0.45 - keluar * 0.1 }, { translateY: -keluar * 30 }],
    };
  });

  return (
    <Animated.Text
      pointerEvents="none"
      allowFontScaling={false}
      style={[gaya.tengah, { color: warnaTeks, fontSize: ukuran }, gayaAnimasi]}
    >
      {teks}
    </Animated.Text>
  );
}

// ---------------------------------------------------------- perayaan level

export interface PropsPerayaan extends EfekDasar {
  readonly gridSize: number;
  readonly ukuranSel: number;
  readonly inset: number;
}

/**
 * Gelombang pelangi melintasi seluruh papan saat naik level.
 *
 * Diagonal, bukan menyapu lurus: penundaannya dihitung dari `row + col`, jadi
 * gelombangnya berjalan dari pojok kiri-atas ke kanan-bawah. Itu yang membuatnya
 * terbaca sebagai satu gerakan, bukan sebagai baris-baris yang menyala sendiri.
 *
 * Warnanya dari palet papan yang sesungguhnya — perayaan yang memakai warna
 * lain akan terasa datang dari game yang berbeda.
 */
export function PerayaanLevel({ id, onSelesai, gridSize, ukuranSel, inset }: PropsPerayaan) {
  const maju = useSharedValue(0);
  const total = (gridSize - 1) * 2;

  useEffect(() => {
    maju.value = withTiming(1, { duration: 900, easing: Easing.linear }, (habis) => {
      if (habis === true) runOnJS(onSelesai)(id);
    });
  }, [maju, id, onSelesai]);

  const petak: React.ReactElement[] = [];
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      petak.push(
        <PetakPelangi
          key={`${row}-${col}`}
          maju={maju}
          fase={(row + col) / Math.max(1, total)}
          kiri={col * ukuranSel + inset}
          atas={row * ukuranSel + inset}
          ukuran={ukuranSel - inset * 2}
          isi={warnaPapanCss(ALL_COLORS[(row + col) % ALL_COLORS.length]!)}
        />,
      );
    }
  }

  return <>{petak}</>;
}

function PetakPelangi({
  maju,
  fase,
  kiri,
  atas,
  ukuran,
  isi,
}: {
  readonly maju: { value: number };
  readonly fase: number;
  readonly kiri: number;
  readonly atas: number;
  readonly ukuran: number;
  readonly isi: string;
}) {
  const gayaAnimasi = useAnimatedStyle(() => {
    // Tiap petak menyala saat gelombangnya lewat, lalu langsung padam.
    // Lebar gelombangnya 0,35 dari seluruh durasi.
    const jarak = Math.abs(maju.value * 1.35 - fase * 0.9 - 0.2);
    const nyala = Math.max(0, 1 - jarak / 0.22);
    return { opacity: nyala * 0.75, transform: [{ scale: 0.7 + nyala * 0.3 }] };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        gaya.petakPelangi,
        { left: kiri, top: atas, width: ukuran, height: ukuran, backgroundColor: isi },
        gayaAnimasi,
      ]}
    />
  );
}

const gaya = StyleSheet.create({
  ledakan: {
    position: 'absolute',
    borderRadius: 8,
  },
  skor: {
    position: 'absolute',
    textAlign: 'center',
    fontFamily: font.judulTebalSekali,
    color: warna.textOnDeep,
    includeFontPadding: false,
    // Bayangan tipis supaya angkanya terbaca di atas warna papan apa pun.
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  tengah: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '42%',
    textAlign: 'center',
    fontFamily: font.judulTebalSekali,
    includeFontPadding: false,
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  petakPelangi: {
    position: 'absolute',
    borderRadius: 6,
  },
});
