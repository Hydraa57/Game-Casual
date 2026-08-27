import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { GRID_SIZE, remainingRatio } from '@pixelmatrix/shared';
import type { Cell, Pixel } from '@pixelmatrix/shared';
import { useGerakDikurangi } from '../game/gerak';
import { GARIS_KISI, gayaPixel, kepekatan, LATAR_PAPAN } from '../game/palet';
import { Ledakan, PerayaanLevel, SkorMelayang, TeksTengah } from './efek';
import { warna } from '../theme';

/**
 * Jarak pixel dari tepi selnya, sebagai PECAHAN lebar sel.
 *
 * Ditulis sebagai pecahan, bukan angka px, dengan alasan yang sama seperti di
 * web: papan 10×10 (untuk match ramai) ikut mengecil secara proporsional
 * alih-alih memakai ukuran yang tiba-tiba kebesaran dan saling tindih.
 */
const INSET_RATIO = 6 / 80;
const GLYPH_RATIO = 40 / 80;

/** Efek yang sedang hidup di atas papan. */
type Efek =
  | { readonly jenis: 'ledakan'; readonly id: number; readonly cell: Cell; readonly isi: string }
  | { readonly jenis: 'skor'; readonly id: number; readonly cell: Cell; readonly teks: string }
  | {
      readonly jenis: 'teks';
      readonly id: number;
      readonly teks: string;
      readonly warnaTeks: string;
      readonly lamaMs: number;
    }
  | { readonly jenis: 'perayaan'; readonly id: number };

/**
 * Cara memicu efek dari luar.
 *
 * Imperatif, bukan lewat props, dan itu disengaja: efek-efek ini adalah
 * KEJADIAN, bukan keadaan. Menjadikannya props berarti papan harus menebak dari
 * perubahan nilai kapan sesuatu "baru saja terjadi" — dan tebakan itu selalu
 * salah untuk dua kejadian identik yang berurutan (dua klik benar dengan poin
 * yang sama persis tidak akan memicu efek kedua).
 */
export interface KaitPapan {
  klaim(cell: Cell, isi: string, poin: number): void;
  salah(): void;
  bom(): void;
  naikLevel(level: number): void;
  combo(nilai: number): void;
  comboPutus(sebelumnya: number): void;
  gantiTarget(): void;
  bersihkan(): void;
}

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
 * yang bisa dilakukan komponen bawaan.
 *
 * Satu penangan sentuh untuk SELURUH papan, bukan 64 penangan per sel. Selain
 * lebih murah, itu yang membuat target sentuhnya selebar sel walau gambar
 * pixelnya lebih kecil — jempol yang meleset beberapa piksel tetap dihitung
 * mengenai selnya.
 */
export const Papan = forwardRef<KaitPapan, PapanProps>(function Papan(
  { pixels, elapsedMs, ukuran, gridSize = GRID_SIZE, sembunyikanGlyph, onTapSel },
  ref,
) {
  const sel = ukuran / gridSize;
  const inset = sel * INSET_RATIO;
  const gerakDikurangi = useGerakDikurangi();

  const [efek, setEfek] = useState<readonly Efek[]>([]);
  const idBerikut = useRef(1);

  /** Guncangan papan dan kilatan warna — keduanya milik seluruh papan. */
  const guncang = useSharedValue(0);
  const kilat = useSharedValue(0);
  /*
    Warna kilatannya ikut berubah, dan itu bukan hiasan.

    Satu lapisan yang selalu MERAH dipakai bersama oleh bom dan pergantian
    target akan mengajarkan hal yang salah: kilatan merah sudah berarti "kamu
    baru saja kena bom", jadi memakainya lagi saat target berganti membuat
    pemain mengira dirinya dihukum padahal aturannya cuma berubah.
  */
  const warnaKilat = useSharedValue<string>(warna.danger);

  const buangEfek = useCallback((id: number) => {
    setEfek((daftar) => daftar.filter((e) => e.id !== id));
  }, []);

  const tambahEfek = useCallback((buat: (id: number) => Efek) => {
    const id = idBerikut.current;
    idBerikut.current += 1;
    setEfek((daftar) => [...daftar, buat(id)]);
  }, []);

  useImperativeHandle(
    ref,
    (): KaitPapan => ({
      klaim(cell, isi, poin) {
        tambahEfek((id) => ({ jenis: 'ledakan', id, cell, isi }));
        tambahEfek((id) => ({ jenis: 'skor', id, cell, teks: `+${poin}` }));
      },
      salah() {
        if (gerakDikurangi) return;
        // Guncangan pendek dan halus. Klik salah sering terjadi; guncangan
        // sekeras bom akan membuat papannya terasa gemetar sepanjang ronde.
        guncang.value = withSequence(
          withTiming(-1, { duration: 40 }),
          withTiming(1, { duration: 70 }),
          withTiming(0, { duration: 40 }),
        );
      },
      /*
        Bom sengaja TIDAK menyemburkan kotak di selnya.

        `bombHit` tidak membawa koordinat sel — hanya id pixelnya, dan pixelnya
        sudah dilepas dari papan saat event itu tiba. Melacaknya sendiri bisa,
        tapi tidak sepadan: kilatan merahnya menutupi SELURUH papan, jadi
        semburan kecil di baliknya praktis tidak terlihat.
      */
      bom() {
        // Lebih keras dan lebih panjang dari klik salah: bom itu kesalahan yang
        // paling mahal, dan pemain harus langsung tahu tanpa melihat HUD.
        //
        // Kilatan merahnya TETAP ada walau gerak dikurangi: ia perubahan
        // opasitas, bukan gerak, dan ia satu-satunya penanda bom yang tersisa
        // di layar setelah guncangannya dimatikan.
        if (!gerakDikurangi) {
          guncang.value = withSequence(
            withTiming(-1, { duration: 45 }),
            withTiming(1, { duration: 60 }),
            withTiming(-0.7, { duration: 60 }),
            withTiming(0.5, { duration: 55 }),
            withTiming(0, { duration: 40 }),
          );
        }
        warnaKilat.value = warna.danger;
        kilat.value = withSequence(
          withTiming(1, { duration: 60 }),
          withTiming(0, { duration: 220 }),
        );
      },
      naikLevel(level) {
        // Gelombang pelangi menyapu seluruh layar — persis jenis gerakan yang
        // dimaksud setelan itu. Teks "LEVEL N"-nya tetap muncul, jadi naik
        // level tidak pernah lewat tanpa diberitahu.
        if (!gerakDikurangi) tambahEfek((id) => ({ jenis: 'perayaan', id }));
        tambahEfek((id) => ({
          jenis: 'teks',
          id,
          teks: `LEVEL ${level}`,
          warnaTeks: warna.lemon,
          lamaMs: 1000,
        }));
      },
      combo(nilai) {
        tambahEfek((id) => ({
          jenis: 'teks',
          id,
          teks: `COMBO ×${nilai}`,
          warnaTeks: warna.accent,
          lamaMs: 800,
        }));
      },
      comboPutus(sebelumnya) {
        tambahEfek((id) => ({
          jenis: 'teks',
          id,
          teks: `COMBO ${sebelumnya} PUTUS`,
          warnaTeks: warna.danger,
          lamaMs: 700,
        }));
      },
      gantiTarget() {
        // Mata pemain ada di PAPAN, dan papan adalah satu-satunya tempat yang
        // tidak memberi tanda apa pun saat aturannya berubah.
        warnaKilat.value = warna.sky;
        kilat.value = withSequence(
          withTiming(0.35, { duration: 90 }),
          withTiming(0, { duration: 260 }),
        );
      },
      bersihkan() {
        setEfek([]);
      },
    }),
    [tambahEfek, guncang, kilat, warnaKilat, gerakDikurangi],
  );

  const garis = useMemo(
    () => Array.from({ length: gridSize - 1 }, (_, i) => (i + 1) * sel),
    [gridSize, sel],
  );

  const gayaGuncang = useAnimatedStyle(() => ({
    transform: [{ translateX: guncang.value * ukuran * 0.015 }],
  }));

  const gayaKilat = useAnimatedStyle(() => ({
    opacity: kilat.value * 0.55,
    backgroundColor: warnaKilat.value,
  }));

  function tangani(e: GestureResponderEvent): void {
    const { locationX, locationY } = e.nativeEvent;
    const col = Math.floor(locationX / sel);
    const row = Math.floor(locationY / sel);
    // Sentuhan yang jatuh tepat di tepi bisa menghasilkan indeks di luar papan.
    if (row < 0 || col < 0 || row >= gridSize || col >= gridSize) return;
    onTapSel(row, col);
  }

  return (
    <Animated.View
      style={[gaya.papan, { width: ukuran, height: ukuran }, gayaGuncang]}
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

      {pixels.map((pixel) => (
        <PixelView
          key={pixel.id}
          pixel={pixel}
          sel={sel}
          inset={inset}
          elapsedMs={elapsedMs}
          sembunyikan={sembunyikanGlyph?.(pixel) === true}
          gerakDikurangi={gerakDikurangi}
        />
      ))}

      {efek.map((e) => {
        switch (e.jenis) {
          case 'ledakan':
            return (
              <Ledakan
                key={e.id}
                id={e.id}
                onSelesai={buangEfek}
                kiri={e.cell.col * sel + inset}
                atas={e.cell.row * sel + inset}
                ukuran={sel - inset * 2}
                isi={e.isi}
              />
            );
          case 'skor':
            return (
              <SkorMelayang
                key={e.id}
                id={e.id}
                onSelesai={buangEfek}
                kiri={e.cell.col * sel}
                // Dimulai dari TENGAH sel, bukan dari tepi atasnya — sama
                // seperti web, dan itu juga yang memberi baris teratas ruang
                // untuk naik sedikit alih-alih diam di tempat.
                atas={e.cell.row * sel + sel * 0.33}
                ukuranSel={sel}
                teks={e.teks}
              />
            );
          case 'teks':
            return (
              <TeksTengah
                key={e.id}
                id={e.id}
                onSelesai={buangEfek}
                teks={e.teks}
                warnaTeks={e.warnaTeks}
                ukuran={ukuran * 0.085}
                lamaMs={e.lamaMs}
              />
            );
          case 'perayaan':
            return (
              <PerayaanLevel
                key={e.id}
                id={e.id}
                onSelesai={buangEfek}
                gridSize={gridSize}
                ukuranSel={sel}
                inset={inset}
              />
            );
        }
      })}

      <Animated.View pointerEvents="none" style={[gaya.kilat, gayaKilat]} />
    </Animated.View>
  );
});

/**
 * Satu pixel di papan.
 *
 * Komponen tersendiri supaya ia bisa punya animasi MUNCUL. Pixel yang langsung
 * ada dengan ukuran penuh terbaca seperti gambar yang di-refresh; yang melompat
 * masuk terbaca sebagai sesuatu yang datang — dan itu yang membuat papan terasa
 * hidup alih-alih seperti tabel yang diperbarui.
 */
function PixelView({
  pixel,
  sel,
  inset,
  elapsedMs,
  sembunyikan,
  gerakDikurangi,
}: {
  readonly pixel: Pixel;
  readonly sel: number;
  readonly inset: number;
  readonly elapsedMs: number;
  readonly sembunyikan: boolean;
  readonly gerakDikurangi: boolean;
}) {
  const g = gayaPixel(pixel);
  // Mulai dari 1 kalau gerak dikurangi: pixelnya langsung ada dengan ukuran
  // penuh, tanpa satu frame pun dalam keadaan mengecil.
  const muncul = useSharedValue(gerakDikurangi ? 1 : 0);

  React.useEffect(() => {
    if (gerakDikurangi) return;
    muncul.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.back(1.6)) });
  }, [muncul, gerakDikurangi]);

  const gayaMuncul = useAnimatedStyle(() => ({
    transform: [{ scale: 0.55 + muncul.value * 0.45 }],
  }));

  return (
    <Animated.View
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
        gayaMuncul,
      ]}
    >
      {!sembunyikan && (
        <Text
          style={[gaya.glyph, { fontSize: sel * GLYPH_RATIO, color: g.warnaGlyph }]}
          // Glyph tidak boleh ikut diperbesar setelan ukuran huruf sistem: ia
          // harus tetap muat di dalam selnya berapa pun setelan itu.
          allowFontScaling={false}
        >
          {g.glyph}
        </Text>
      )}
    </Animated.View>
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
  kilat: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Warnanya ditentukan `warnaKilat` saat kilatannya dipicu; nilai di sini
    // hanya supaya lapisannya tidak pernah tanpa warna sebelum dipakai.
    backgroundColor: warna.danger,
  },
});
