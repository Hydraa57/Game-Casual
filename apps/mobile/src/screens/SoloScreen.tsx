import React, { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAX_CONTINUES, soloIntensity, SOLO_STARTING_LIVES } from '@pixelmatrix/shared';
import type { GameEvent, HudSnapshot, Pixel } from '@pixelmatrix/shared';
import { Hud } from '../components/Hud';
import { Papan } from '../components/Papan';
import { TombolChunky } from '../components/TombolChunky';
import { buatMusic, buatSfx } from '../game/audio';
import { MesinSolo } from '../game/MesinSolo';
import { bacaBisu, simpanBisu } from '../lib/preferensi';
import { bacaRekor, simpanRekorKalauLebihTinggi } from '../lib/rekor';
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

  const [rekor, setRekor] = useState(0);
  const [bisu, setBisu] = useState(false);

  /*
    Bunyi dan musik dibuat SEKALI per layar, dipegang di `useState`.

    AudioContext itu sumber daya sistem; membuatnya ulang tiap render akan
    ditolak setelah beberapa kali, dan yang terdengar pemain adalah bunyi yang
    tiba-tiba mati di tengah ronde.
  */
  const [sfx] = useState(buatSfx);
  const [music] = useState(buatMusic);

  const tanganiEvent = useCallback(
    (event: GameEvent) => {
      // Getarnya ikut di sini: `Sfx` bersama yang memegang pola getar tiap
      // kejadian, jadi bunyi dan getar tidak mungkin berpisah.
      switch (event.type) {
        case 'pixelClaimed':
          sfx.correct(event.combo);
          if (event.kind === 'gold') sfx.gold();
          if (event.kind === 'life') sfx.life();
          break;
        case 'clickRejected':
          if (event.reason === 'wrongColor') sfx.wrong();
          break;
        case 'bombHit':
          sfx.bomb();
          break;
        case 'levelUp':
          sfx.levelUp();
          break;
        case 'gameOver':
          sfx.gameOver();
          break;
        default:
          break;
      }

      if (event.type === 'gameOver') {
        // Perbandingannya dilakukan di dalam `simpanRekorKalauLebihTinggi`, yang
        // membaca ulang dari penyimpanan sebelum menulis — `rekor` di state ini
        // bisa saja tertinggal.
        void simpanRekorKalauLebihTinggi(event.score).then(setRekor);
      }
    },
    [sfx],
  );

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

  // ------------------------------------------------------------------- musik

  /*
    Musik hanya berbunyi saat benar-benar bermain.

    Di layar siap, jeda, dan kalah ia berhenti — itu momen untuk membaca dan
    memutuskan, bukan momen untuk didesak. Aturan yang sama dipakai versi web.
  */
  useEffect(() => {
    if (snapshot.status === 'running') music.start();
    else music.stop();
  }, [music, snapshot.status]);

  /* Ketegangan dihitung di `shared`, jadi bisa diuji tanpa audio sama sekali. */
  useEffect(() => {
    music.setIntensity(soloIntensity(snapshot.level, snapshot.lives, SOLO_STARTING_LIVES));
  }, [music, snapshot.level, snapshot.lives]);

  /* AudioContext itu sumber daya sistem — dilepas saat layarnya ditutup. */
  useEffect(
    () => () => {
      music.dispose();
      sfx.dispose();
    },
    [music, sfx],
  );

  // ------------------------------------------------------------------- rekor

  useEffect(() => {
    let hidup = true;
    void bacaRekor().then((nilai) => {
      if (hidup) setRekor(nilai);
    });
    void bacaBisu().then((nilai) => {
      if (!hidup) return;
      setBisu(nilai);
      // Diterapkan langsung, bukan menunggu render berikutnya: musik bisa
      // sudah mulai sebelum pembacaan preferensi ini selesai.
      sfx.setMuted(nilai);
      music.setMuted(nilai);
    });
    return () => {
      hidup = false;
    };
  }, [sfx, music]);

  const gantiBisu = useCallback(() => {
    setBisu((sekarang) => {
      const berikutnya = !sekarang;
      sfx.setMuted(berikutnya);
      music.setMuted(berikutnya);
      void simpanBisu(berikutnya);
      return berikutnya;
    });
  }, [sfx, music]);

  // -------------------------------------------------- aplikasi ke latar belakang

  /**
   * Ronde dibekukan begitu aplikasi ditinggalkan.
   *
   * Tanpa ini, pemain yang menerima telepon kembali ke papan yang sudah berubah
   * — dan bisa kehilangan nyawa untuk pixel yang tidak pernah dilihatnya.
   * Penjepit 100 ms di mesin mencegah papannya kacau, tapi tidak mengembalikan
   * waktu yang hilang; membekukannya di sini yang benar-benar adil.
   */
  useEffect(() => {
    const langganan = AppState.addEventListener('change', (keadaan) => {
      if (keadaan !== 'active') {
        mesin.jeda();
        // Musik yang terus berbunyi setelah aplikasi ditinggalkan adalah salah
        // satu keluhan paling umum tentang game HP.
        music.stop();
      }
    });
    return () => langganan.remove();
  }, [mesin, music]);

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
          {rekor > 0 && <Text style={gaya.rekor}>REKOR {rekor}</Text>}
          <Pressable
            onPress={gantiBisu}
            hitSlop={12}
            style={gaya.tombolKecil}
            accessibilityRole="switch"
            accessibilityState={{ checked: bisu }}
            accessibilityLabel={bisu ? 'Nyalakan suara' : 'Matikan suara'}
          >
            <Text style={gaya.tombolKecilTeks}>{bisu ? '🔇' : '🔊'}</Text>
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
          rekor={rekor}
          onMulai={() => {
            sfx.unlock();
            mesin.mulai();
          }}
          onLanjutkan={() => {
            sfx.unlock();
            mesin.lanjutkan();
          }}
          onLanjutCheckpoint={() => {
            sfx.unlock();
            mesin.lanjutDariCheckpoint();
          }}
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
  rekor,
  onMulai,
  onLanjutkan,
  onLanjutCheckpoint,
  onKeluar,
}: {
  readonly snapshot: HudSnapshot;
  readonly rekor: number;
  readonly onMulai: () => void;
  readonly onLanjutkan: () => void;
  readonly onLanjutCheckpoint: () => void;
  readonly onKeluar: () => void;
}) {
  const kalah = snapshot.status === 'gameOver';
  const jeda = snapshot.status === 'paused';
  /*
    Rekor sudah disimpan lebih dulu oleh penangan event `gameOver`, jadi saat
    tirai ini tergambar `rekor` SUDAH memuat skor ronde ini kalau memang
    memecahkan rekor. Karena itu perbandingannya `>=`, bukan `>` — dengan `>`,
    rekor baru tidak akan pernah terumumkan sama sekali.
  */
  const rekorBaru = kalah && snapshot.score > 0 && snapshot.score >= rekor;

  return (
    <View style={gaya.tirai}>
      <View style={gaya.kartuTirai}>
        <Text style={gaya.judulTirai}>{kalah ? 'Nyawa habis' : jeda ? 'Jeda' : 'Siap?'}</Text>

        {kalah ? (
          <>
            {rekorBaru && <Text style={gaya.rekorBaru}>REKOR BARU</Text>}
            <Text style={gaya.rinci}>
              Skor {snapshot.score} · Level {snapshot.level}
            </Text>
            <Text style={gaya.rinci}>
              Combo terbaik {snapshot.bestCombo} · Akurasi {Math.round(snapshot.accuracy * 100)}%
            </Text>
            {!rekorBaru && rekor > 0 && <Text style={gaya.rinci}>Rekormu {rekor}</Text>}
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
  rekor: {
    flex: 1,
    textAlign: 'center',
    fontFamily: font.judulTebal,
    fontSize: 12.5,
    letterSpacing: 0.5,
    color: warna.textDim,
  },
  rekorBaru: {
    textAlign: 'center',
    fontFamily: font.judulTebalSekali,
    fontSize: 15,
    letterSpacing: 1,
    color: warna.successInk,
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
