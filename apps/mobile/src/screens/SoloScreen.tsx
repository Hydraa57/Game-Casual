import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAX_CONTINUES } from '@pixelmatrix/shared';
import type { GameEvent, HudSnapshot, Pixel } from '@pixelmatrix/shared';
import { Hud } from '../components/Hud';
import { Papan } from '../components/Papan';
import { TombolChunky } from '../components/TombolChunky';
import { MesinSolo } from '../game/MesinSolo';
import { latarGradien, font, radius, warna } from '../theme';

/** Jarak papan dari tepi layar. */
const PADDING = 14;

export interface SoloScreenProps {
  readonly onKeluar: () => void;
}

/**
 * Layar mode solo.
 *
 * **Jalan sepenuhnya offline.** Tidak ada satu pun permintaan jaringan di
 * layar ini: seluruh aturan mainnya ada di `@pixelmatrix/shared` yang ikut
 * dipaketkan ke dalam APK. Itu salah satu dari tiga alasan aplikasi native ini
 * diminta, dan yang menentukan pilihan React Native sejak awal.
 *
 * Yang digambar di sini hanya tampilan; yang menjalankan permainan adalah
 * `MesinSolo`, yang tidak tahu apa-apa soal React dan diuji terpisah.
 */
export function SoloScreen({ onKeluar }: SoloScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const tanganiEvent = useCallback((_event: GameEvent) => {
    // Bunyi dan getaran menyusul di patch audio. Handler-nya sudah ada supaya
    // mesinnya tidak perlu diubah lagi saat itu tiba.
  }, []);

  /*
    Mesin dibuat SEKALI, lewat penginisialisasi `useState`.

    Kalau ia dibuat langsung di badan komponen, ia ikut dibuat ulang tiap render
    dan ronde yang sedang berjalan hilang setiap ada satu nilai yang berubah.
    Dan kalau konstruktornya yang memancarkan HUD awal, ia akan memicu
    `setState` di tengah render — karena itu nilai awalnya dibaca dari getter
    `hud`, bukan ditunggu dari callback.
  */
  const [mesin] = useState(
    () => new MesinSolo({ onHud: (s) => setSnapshot(s), onEvent: tanganiEvent }),
  );
  const [snapshot, setSnapshot] = useState<HudSnapshot>(() => mesin.hud);
  /**
   * Pixel disimpan di state supaya papannya ikut dirender ulang tiap frame.
   *
   * Sengaja array baru tiap frame: `remainingRatio` berubah terus-menerus, jadi
   * pudarnya pixel memang harus digambar ulang 60× per detik. Yang TIDAK
   * dirender ulang setiap frame adalah HUD — `MesinSolo` hanya mengabari saat
   * ada nilai yang benar-benar berubah.
   */
  const [pixels, setPixels] = useState<readonly Pixel[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [ukuranPapan, setUkuranPapan] = useState(0);

  // ------------------------------------------------------------- gelung frame

  useEffect(() => {
    let hidup = true;
    let sebelumnya: number | null = null;
    let permintaan = 0;

    const frame = (waktu: number) => {
      if (!hidup) return;
      const delta = sebelumnya === null ? 0 : waktu - sebelumnya;
      sebelumnya = waktu;

      if (delta > 0) mesin.majukan(delta);
      setPixels(mesin.pixels);
      setElapsedMs(mesin.elapsedMs);

      permintaan = requestAnimationFrame(frame);
    };

    permintaan = requestAnimationFrame(frame);
    return () => {
      hidup = false;
      cancelAnimationFrame(permintaan);
    };
  }, [mesin]);

  // ----------------------------------------------------------------- tampilan

  const lebarTersedia = width - PADDING * 2;
  const sisiPapan = Math.max(0, Math.min(lebarTersedia, ukuranPapan));

  const berjalan = snapshot.status === 'running';
  const adaTirai = snapshot.status !== 'running';

  return (
    <View style={[gaya.akar, { backgroundImage: latarGradien(width) }]}>
      <StatusBar barStyle="dark-content" />

      <View style={[gaya.isi, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
        <View style={gaya.kepala}>
          <Pressable onPress={onKeluar} hitSlop={12} style={gaya.tombolKecil}>
            <Text style={gaya.tombolKecilTeks}>‹ Keluar</Text>
          </Pressable>
          {berjalan && (
            <Pressable onPress={() => mesin.jeda()} hitSlop={12} style={gaya.tombolKecil}>
              <Text style={gaya.tombolKecilTeks}>Jeda</Text>
            </Pressable>
          )}
        </View>

        <Hud snapshot={snapshot} />

        {/*
          Papannya mengambil sisa ruang yang ADA, bukan ukuran yang ditebak.
          Di HP pendek, HUD dan papan saling berebut tinggi; mengukurnya lewat
          onLayout membuat papan menyusut sendiri alih-alih terpotong di bawah.
        */}
        <View
          style={gaya.wadahPapan}
          onLayout={(e) => setUkuranPapan(Math.floor(e.nativeEvent.layout.height))}
        >
          {sisiPapan > 0 && (
            <Papan
              pixels={pixels}
              elapsedMs={elapsedMs}
              ukuran={sisiPapan}
              sembunyikanGlyph={(p) => mesin.sembunyikanGlyph(p)}
              onTapSel={(row, col) => mesin.tapSel(row, col)}
            />
          )}
        </View>
      </View>

      {adaTirai && (
        <Tirai
          snapshot={snapshot}
          onMulai={() => mesin.mulai()}
          onLanjutkan={() => mesin.lanjutkan()}
          onLanjutCheckpoint={() => mesin.lanjutDariCheckpoint()}
          onKeluar={onKeluar}
        />
      )}
    </View>
  );
}

/**
 * Tirai yang menutupi papan saat ronde belum jalan.
 *
 * Satu komponen untuk tiga keadaan (belum mulai, jeda, kalah) karena ketiganya
 * menjawab pertanyaan yang sama: apa yang bisa saya tekan sekarang. Memisahnya
 * jadi tiga overlay hanya memperbanyak tempat yang bisa berbeda gayanya.
 */
function Tirai({
  snapshot,
  onMulai,
  onLanjutkan,
  onLanjutCheckpoint,
  onKeluar,
}: {
  readonly snapshot: HudSnapshot;
  readonly onMulai: () => void;
  readonly onLanjutkan: () => void;
  readonly onLanjutCheckpoint: () => void;
  readonly onKeluar: () => void;
}) {
  const kalah = snapshot.status === 'gameOver';
  const jeda = snapshot.status === 'paused';

  return (
    <View style={gaya.tirai}>
      <View style={gaya.kartuTirai}>
        <Text style={gaya.judulTirai}>{kalah ? 'Nyawa habis' : jeda ? 'Jeda' : 'Siap?'}</Text>

        {kalah ? (
          <>
            <Text style={gaya.rinci}>
              Skor {snapshot.score} · Level {snapshot.level}
            </Text>
            <Text style={gaya.rinci}>
              Combo terbaik {snapshot.bestCombo} · Akurasi {Math.round(snapshot.accuracy * 100)}%
            </Text>
          </>
        ) : (
          <Text style={gaya.rinci}>
            {jeda
              ? 'Papannya dibekukan. Tidak ada pixel yang pudar selama ini.'
              : 'Tap pixel yang warnanya sama dengan warna target sebelum pudar.'}
          </Text>
        )}

        <View style={gaya.tombolTirai}>
          {kalah && snapshot.canContinue && (
            <TombolChunky
              label={`Lanjut dari Level ${snapshot.checkpointLevel} (${snapshot.continuesLeft} tersisa)`}
              nada="utama"
              onPress={onLanjutCheckpoint}
            />
          )}

          <TombolChunky
            label={jeda ? 'Lanjutkan' : kalah ? 'Main lagi' : 'Mulai'}
            nada={kalah && snapshot.canContinue ? 'grape' : 'utama'}
            onPress={jeda ? onLanjutkan : onMulai}
          />

          <TombolChunky label="Keluar" onPress={onKeluar} />
        </View>

        {kalah && !snapshot.canContinue && snapshot.checkpointLevel !== null && (
          <Text style={gaya.catatan}>Continue sudah habis ({MAX_CONTINUES} per ronde).</Text>
        )}
      </View>
    </View>
  );
}

const gaya = StyleSheet.create({
  akar: {
    flex: 1,
    backgroundColor: warna.bg,
  },
  isi: {
    flex: 1,
    paddingHorizontal: PADDING,
    gap: 8,
  },
  kepala: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tombolKecil: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: warna.borderStrong,
    backgroundColor: warna.surface,
  },
  tombolKecilTeks: {
    fontFamily: font.judulTebal,
    fontSize: 13,
    color: warna.text,
  },
  wadahPapan: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tirai: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Nila pekat, bukan hitam: latar papannya sendiri nila, jadi tirainya
    // terbaca sebagai bagian dari game dan bukan sebagai dialog sistem.
    backgroundColor: 'rgba(43, 27, 83, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  kartuTirai: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: warna.surface,
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: warna.borderStrong,
    padding: 20,
    gap: 10,
  },
  judulTirai: {
    fontFamily: font.judulTebalSekali,
    fontSize: 26,
    color: warna.grape,
    textAlign: 'center',
  },
  rinci: {
    fontFamily: font.badan,
    fontSize: 14.5,
    lineHeight: 22,
    color: warna.textDim,
    textAlign: 'center',
  },
  tombolTirai: {
    gap: 10,
    marginTop: 6,
  },
  catatan: {
    fontFamily: font.badan,
    fontSize: 12.5,
    color: warna.textDim,
    textAlign: 'center',
  },
});
