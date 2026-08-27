import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AVATAR_GLYPH,
  AVATAR_IDS,
  DEFAULT_AVATAR,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  ROOM_CODE_LENGTH,
} from '@pixelmatrix/shared';
import type { AvatarId, MatchEndedPayload, RoomState, ScoreboardEntry } from '@pixelmatrix/shared';
import { Papan } from '../components/Papan';
import type { KaitPapan } from '../components/Papan';
import { TombolChunky } from '../components/TombolChunky';
import { gayaPixel, warnaPapanCss } from '../game/palet';
import { adaGameServer } from '../net/socket';
import { useRoom } from '../net/useRoom';
import type { KeadaanMatch } from '../net/useRoom';
import { font, latarGradien, radius, warna } from '../theme';

const PADDING = 14;

/** Pesan galat dalam bahasa manusia, bukan kode server. */
const PESAN_GALAT: Record<string, string> = {
  ROOM_NOT_FOUND: 'Kode room-nya tidak ada. Cek lagi hurufnya.',
  ROOM_FULL: 'Room-nya sudah penuh.',
  GAME_IN_PROGRESS: 'Match-nya sudah jalan. Tunggu ronde berikutnya.',
  NICKNAME_TAKEN: 'Nama itu sudah dipakai di room ini.',
  NOT_HOST: 'Cuma host yang bisa melakukan itu.',
  NOT_ENOUGH_PLAYERS: 'Perlu minimal dua pemain.',
  PLAYERS_NOT_READY: 'Masih ada yang belum siap.',
};

export function RoomScreen({ onKeluar }: { readonly onKeluar: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  /*
    Server belum dikonfigurasi.

    Ditangani SEBELUM hook koneksi dipasang, bukan dibiarkan mencoba menyambung
    ke alamat kosong: yang terjadi kalau dibiarkan adalah tombol yang berputar
    lalu gagal tanpa alasan yang bisa dimengerti siapa pun.
  */
  if (!adaGameServer()) {
    return <BelumDikonfigurasi onKeluar={onKeluar} lebar={width} insetAtas={insets.top} />;
  }

  return <RoomAktif onKeluar={onKeluar} />;
}

function BelumDikonfigurasi({
  onKeluar,
  lebar,
  insetAtas,
}: {
  readonly onKeluar: () => void;
  readonly lebar: number;
  readonly insetAtas: number;
}) {
  return (
    <View style={[gaya.akar, { backgroundImage: latarGradien(lebar) }]}>
      <StatusBar barStyle="dark-content" />
      <View style={[gaya.isi, { paddingTop: insetAtas + 24 }]}>
        <View style={gaya.kartu}>
          <Text style={gaya.judul}>Main bareng belum aktif</Text>
          <Text style={gaya.badan}>
            Aplikasi ini belum tahu alamat server main barengnya. Alamat itu harus dibawa di dalam
            aplikasi — beda dengan versi web, yang bisa menebaknya dari halaman yang sedang dibuka.
          </Text>
          <Text style={gaya.badan}>
            Isi `ALAMAT_GAME_SERVER` di `src/net/socket.ts`, lalu bangun ulang APK-nya. Mode solo
            tidak terpengaruh sama sekali — ia memang tidak butuh server.
          </Text>
          <TombolChunky label="Kembali" nada="utama" onPress={onKeluar} />
        </View>
      </View>
    </View>
  );
}

function RoomAktif({ onKeluar }: { readonly onKeluar: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const papanRef = useRef<KaitPapan | null>(null);

  /*
    Efek papan dipicu dari event SERVER, bukan dari ketukan lokal.

    Bedanya penting di papan rebutan: ketukan yang kalah cepat tidak boleh
    menyemburkan apa pun, dan ketukan pemain LAIN harus menyemburkan. Yang tahu
    siapa yang menang cuma server, jadi efeknya menunggu jawabannya — bukan
    ditembakkan optimis saat jari menyentuh.
  */
  const r = useRoom({
    onKlaim: (cell, kind, warnaPixel, poin) => {
      papanRef.current?.klaim(
        cell,
        gayaPixel({ id: '', cell, color: warnaPixel, kind, spawnedAtMs: 0, lifetimeMs: 1 }).isi,
        poin,
      );
    },
    onSalah: () => papanRef.current?.salah(),
    onBom: () => papanRef.current?.bom(),
    onGantiTarget: () => papanRef.current?.gantiTarget(),
  });

  const keluarSemua = useCallback(() => {
    r.keluarRoom();
    onKeluar();
  }, [r, onKeluar]);

  const bermain = r.room !== null && r.room.status === 'playing' && r.hasil === null;

  return (
    <View style={[gaya.akar, { backgroundImage: latarGradien(width) }]}>
      <StatusBar barStyle="dark-content" />
      <View
        style={[gaya.isi, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}
        // Papan tidak boleh ikut ter-scroll saat match berjalan.
      >
        <View style={gaya.kepala}>
          <Pressable onPress={keluarSemua} hitSlop={12} style={gaya.tombolKecil}>
            <Text style={gaya.tombolKecilTeks}>‹ Keluar</Text>
          </Pressable>
          <Text style={gaya.statusKoneksi}>
            {r.status === 'tersambung'
              ? '● online'
              : r.status === 'menyambung'
                ? '○ menyambung'
                : '○ putus'}
          </Text>
        </View>

        {r.kodeGalat !== null && (
          <Pressable onPress={r.bersihkanGalat} style={gaya.galat}>
            <Text style={gaya.galatTeks}>
              {PESAN_GALAT[r.kodeGalat] ?? `Gagal (${r.kodeGalat}). Coba lagi.`}
            </Text>
          </Pressable>
        )}

        {r.hasil !== null ? (
          <Hasil hasil={r.hasil} playerId={r.playerId} onKembali={r.kembaliKeLobby} />
        ) : bermain ? (
          <Match
            match={r.match}
            playerId={r.playerId}
            lebar={width}
            onTapPixel={r.tap}
            papanRef={papanRef}
          />
        ) : r.room !== null ? (
          <Lobby
            room={r.room}
            playerId={r.playerId}
            sibuk={r.sibuk}
            onSiap={r.setSiap}
            onTambahBot={() => r.tambahBot('medium')}
            onMulai={() => void r.mulaiMatch()}
          />
        ) : (
          <Masuk
            sibuk={r.sibuk}
            tersambung={r.status === 'tersambung'}
            onBuat={r.buatRoom}
            onGabung={r.gabungRoom}
          />
        )}
      </View>
    </View>
  );
}

// --------------------------------------------------------------------- masuk

function Masuk({
  sibuk,
  tersambung,
  onBuat,
  onGabung,
}: {
  readonly sibuk: boolean;
  readonly tersambung: boolean;
  readonly onBuat: (nickname: string, avatar: AvatarId) => Promise<boolean>;
  readonly onGabung: (kode: string, nickname: string, avatar: AvatarId) => Promise<boolean>;
}) {
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState<AvatarId>(DEFAULT_AVATAR);
  const [kode, setKode] = useState('');

  const namaSah = nickname.trim().length >= NICKNAME_MIN_LENGTH;
  const bisa = tersambung && !sibuk && namaSah;

  return (
    <ScrollView contentContainerStyle={gaya.gulir} keyboardShouldPersistTaps="handled">
      <View style={gaya.kartu}>
        <Text style={gaya.labelKecil}>NAMA KAMU</Text>
        <TextInput
          style={gaya.masukan}
          value={nickname}
          onChangeText={setNickname}
          placeholder="Nama panggilan"
          placeholderTextColor={warna.textDim}
          maxLength={NICKNAME_MAX_LENGTH}
          autoCapitalize="words"
          autoCorrect={false}
        />

        <Text style={gaya.labelKecil}>KARAKTER</Text>
        <View style={gaya.avatarBaris}>
          {AVATAR_IDS.map((id) => (
            <Pressable
              key={id}
              onPress={() => setAvatar(id)}
              style={[gaya.avatar, id === avatar && gaya.avatarTerpilih]}
              accessibilityRole="radio"
              accessibilityState={{ selected: id === avatar }}
            >
              <Text style={gaya.avatarGlyph}>{AVATAR_GLYPH[id]}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={gaya.kartu}>
        <Text style={gaya.labelKecil}>BUAT ROOM BARU</Text>
        <Text style={gaya.badan}>Kamu jadi host, lalu bagikan kodenya ke teman.</Text>
        <TombolChunky
          label={sibuk ? 'Sebentar…' : 'Buat Room'}
          nada="utama"
          onPress={() => {
            if (bisa) void onBuat(nickname.trim(), avatar);
          }}
        />
      </View>

      <View style={gaya.kartu}>
        <Text style={gaya.labelKecil}>GABUNG PAKAI KODE</Text>
        <TextInput
          style={[gaya.masukan, gaya.masukanKode]}
          value={kode}
          onChangeText={(teks) => setKode(teks.toUpperCase())}
          placeholder={'—'.repeat(ROOM_CODE_LENGTH)}
          placeholderTextColor={warna.textDim}
          maxLength={ROOM_CODE_LENGTH}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <TombolChunky
          label={sibuk ? 'Sebentar…' : 'Gabung'}
          nada="grape"
          onPress={() => {
            if (bisa && kode.trim().length === ROOM_CODE_LENGTH) {
              void onGabung(kode, nickname.trim(), avatar);
            }
          }}
        />
      </View>

      {!tersambung && (
        <Text style={gaya.catatan}>
          Menunggu sambungan ke server. Kalau lama, cek koneksi internetmu.
        </Text>
      )}
      {!namaSah && (
        <Text style={gaya.catatan}>
          Isi nama dulu (minimal {NICKNAME_MIN_LENGTH} huruf) supaya temanmu tahu itu kamu.
        </Text>
      )}
    </ScrollView>
  );
}

// --------------------------------------------------------------------- lobby

function Lobby({
  room,
  playerId,
  sibuk,
  onSiap,
  onTambahBot,
  onMulai,
}: {
  readonly room: RoomState;
  readonly playerId: string | null;
  readonly sibuk: boolean;
  readonly onSiap: (siap: boolean) => void;
  readonly onTambahBot: () => void;
  readonly onMulai: () => void;
}) {
  const saya = room.players.find((p) => p.id === playerId) ?? null;
  const host = room.hostId === playerId;
  const penuh = room.players.length >= room.settings.maxPlayers;

  return (
    <ScrollView contentContainerStyle={gaya.gulir}>
      <View style={gaya.kartu}>
        <Text style={gaya.labelKecil}>KODE ROOM</Text>
        {/* Besar-besaran dan berjarak: kode ini dibacakan ke orang lain, sering
            lewat suara, dan huruf yang rapat paling sering salah didengar. */}
        <Text style={gaya.kodeRoom} selectable>
          {room.roomCode}
        </Text>
        <Text style={gaya.badan}>Bagikan kode ini ke temanmu supaya mereka bisa gabung.</Text>
      </View>

      <View style={gaya.kartu}>
        <Text style={gaya.labelKecil}>
          PEMAIN {room.players.length}/{room.settings.maxPlayers}
        </Text>
        {room.players.map((p) => (
          <View key={p.id} style={gaya.barisPemain}>
            <Text style={gaya.avatarGlyphKecil}>{AVATAR_GLYPH[p.avatar]}</Text>
            <Text style={gaya.namaPemain} numberOfLines={1}>
              {p.nickname}
              {p.id === room.hostId ? ' · host' : ''}
              {p.bot !== null ? ' · bot' : ''}
            </Text>
            <Text style={p.isReady ? gaya.siap : gaya.belumSiap}>{p.isReady ? '✓' : '○'}</Text>
          </View>
        ))}
      </View>

      <View style={gaya.tombolTumpuk}>
        <TombolChunky
          label={saya?.isReady === true ? 'Batal siap' : 'Siap'}
          nada={saya?.isReady === true ? 'polos' : 'utama'}
          onPress={() => onSiap(saya?.isReady !== true)}
        />

        {host && !penuh && <TombolChunky label="Tambah bot" nada="sky" onPress={onTambahBot} />}

        {host && (
          <TombolChunky
            label={sibuk ? 'Sebentar…' : 'Mulai match'}
            nada="grape"
            onPress={onMulai}
          />
        )}

        {!host && <Text style={gaya.catatan}>Menunggu host memulai match.</Text>}
      </View>
    </ScrollView>
  );
}

// --------------------------------------------------------------------- match

function Match({
  match,
  playerId,
  lebar,
  onTapPixel,
  papanRef,
}: {
  readonly match: KeadaanMatch;
  readonly playerId: string | null;
  readonly lebar: number;
  readonly onTapPixel: (pixelId: string) => void;
  readonly papanRef: React.RefObject<KaitPapan | null>;
}) {
  const [tinggiPapan, setTinggiPapan] = useState(0);
  const sisi = Math.max(0, Math.min(lebar - PADDING * 2, tinggiPapan));

  /**
   * Waktu berjalan untuk memudarkan pixel.
   *
   * Papan multiplayer TIDAK punya `elapsedMs` dari engine — papannya milik
   * server. Yang dipakai di sini jam lokal, semata untuk menghitung sisa umur
   * tiap pixel; skor dan siapa yang berhasil merebut tetap sepenuhnya keputusan
   * server.
   */
  const [sekarang, setSekarang] = useState(0);
  useEffect(() => {
    let hidup = true;
    let permintaan = 0;
    const mulai = Date.now();
    const frame = () => {
      if (!hidup) return;
      setSekarang(Date.now() - mulai);
      permintaan = requestAnimationFrame(frame);
    };
    permintaan = requestAnimationFrame(frame);
    return () => {
      hidup = false;
      cancelAnimationFrame(permintaan);
    };
  }, []);

  const detik = Math.max(0, Math.ceil(match.remainingMs / 1000));

  return (
    <View style={gaya.wadahMatch}>
      <View style={gaya.barisAtasMatch}>
        <View style={gaya.petakBaris}>
          {match.targetColors.map((c) => (
            <View key={c} style={[gaya.petakTarget, { backgroundColor: warnaPapanCss(c) }]} />
          ))}
        </View>
        <Text style={gaya.teksLevel}>Lv {match.level}</Text>
        <Text style={[gaya.teksWaktu, match.suddenDeath && { color: warna.danger }]}>
          {match.suddenDeath ? 'SUDDEN DEATH' : `${detik}s`}
        </Text>
      </View>

      <View
        style={gaya.wadahPapan}
        onLayout={(e) => setTinggiPapan(Math.floor(e.nativeEvent.layout.height))}
      >
        {sisi > 0 && (
          <Papan
            ref={papanRef}
            pixels={match.pixels}
            elapsedMs={sekarang}
            ukuran={sisi}
            gridSize={match.gridSize}
            onTapSel={(row, col) => {
              const pixel = match.pixels.find((p) => p.cell.row === row && p.cell.col === col);
              // Yang dikirim adalah ID pixel, bukan koordinat sel. Papannya
              // rebutan: pixel di sel itu bisa sudah direbut orang lain sepersekian
              // detik lalu, dan server yang memutuskan siapa yang lebih dulu.
              if (pixel) onTapPixel(pixel.id);
            }}
          />
        )}
        {match.hitungMundur !== null && (
          <View style={gaya.tiraiHitung}>
            <Text style={gaya.angkaHitung}>{match.hitungMundur}</Text>
          </View>
        )}
      </View>

      <PapanSkor entri={match.scoreboard} playerId={playerId} />
    </View>
  );
}

function PapanSkor({
  entri,
  playerId,
}: {
  readonly entri: readonly ScoreboardEntry[];
  readonly playerId: string | null;
}) {
  return (
    <View style={gaya.papanSkor}>
      {entri.map((e) => (
        <View key={e.playerId} style={[gaya.barisSkor, e.playerId === playerId && gaya.barisSaya]}>
          <Text style={gaya.avatarGlyphKecil}>{AVATAR_GLYPH[e.avatar]}</Text>
          <Text style={gaya.namaPemain} numberOfLines={1}>
            {e.nickname}
          </Text>
          {/* Beku setelah nyawa habis: pemain harus tahu kenapa ketukannya tidak
              menghasilkan apa-apa, bukan mengira gamenya rusak. */}
          {e.frozenMs > 0 && <Text style={gaya.beku}>beku {Math.ceil(e.frozenMs / 1000)}s</Text>}
          {e.eliminated && <Text style={gaya.beku}>keluar</Text>}
          <Text style={gaya.skor}>{e.score}</Text>
        </View>
      ))}
    </View>
  );
}

// --------------------------------------------------------------------- hasil

function Hasil({
  hasil,
  playerId,
  onKembali,
}: {
  readonly hasil: MatchEndedPayload;
  readonly playerId: string | null;
  readonly onKembali: () => void;
}) {
  const alasan: Record<MatchEndedPayload['reason'], string> = {
    targetScore: 'Target skor tercapai',
    timeUp: 'Waktu habis',
    suddenDeath: 'Sudden death',
    elimination: 'Lawan tereliminasi',
  };

  return (
    <ScrollView contentContainerStyle={gaya.gulir}>
      <View style={gaya.kartu}>
        <Text style={gaya.judul}>Hasil</Text>
        <Text style={gaya.badan}>
          {alasan[hasil.reason]} · {Math.round(hasil.durationMs / 1000)} detik
        </Text>

        {hasil.ranking.map((e) => (
          <View
            key={e.playerId}
            style={[gaya.barisSkor, e.playerId === playerId && gaya.barisSaya]}
          >
            <Text style={gaya.peringkat}>{e.rank}</Text>
            <Text style={gaya.avatarGlyphKecil}>{AVATAR_GLYPH[e.avatar]}</Text>
            <Text style={gaya.namaPemain} numberOfLines={1}>
              {e.nickname}
            </Text>
            <Text style={gaya.skor}>{e.score}</Text>
          </View>
        ))}
      </View>

      <TombolChunky label="Kembali ke lobby" nada="utama" onPress={onKembali} />
    </ScrollView>
  );
}

const gaya = StyleSheet.create({
  akar: { flex: 1, backgroundColor: warna.bg },
  isi: { flex: 1, paddingHorizontal: PADDING, gap: 10 },
  gulir: { gap: 12, paddingBottom: 24 },
  kepala: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tombolKecil: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: warna.borderStrong,
    backgroundColor: warna.surface,
  },
  tombolKecilTeks: { fontFamily: font.judulTebal, fontSize: 13, color: warna.text },
  statusKoneksi: { fontFamily: font.badan, fontSize: 12, color: warna.textDim },
  galat: {
    backgroundColor: warna.danger,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  galatTeks: { fontFamily: font.badanTebal, fontSize: 13.5, color: warna.textOnDeep },
  kartu: {
    backgroundColor: warna.surface,
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: warna.border,
    padding: 16,
    gap: 10,
  },
  judul: { fontFamily: font.judulTebalSekali, fontSize: 22, color: warna.grape },
  labelKecil: {
    fontFamily: font.judulTebal,
    fontSize: 11.5,
    letterSpacing: 0.5,
    color: warna.textDim,
  },
  badan: { fontFamily: font.badan, fontSize: 14, lineHeight: 21, color: warna.textDim },
  catatan: { fontFamily: font.badan, fontSize: 13, color: warna.textDim, textAlign: 'center' },
  masukan: {
    borderWidth: 2,
    borderColor: warna.border,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontFamily: font.badanTebal,
    fontSize: 16,
    color: warna.text,
    backgroundColor: warna.bg,
  },
  masukanKode: {
    fontFamily: font.judulTebalSekali,
    fontSize: 26,
    letterSpacing: 8,
    textAlign: 'center',
  },
  avatarBaris: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: warna.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: warna.bg,
  },
  avatarTerpilih: { borderColor: warna.grape, backgroundColor: warna.surfaceRaised },
  avatarGlyph: { fontSize: 24 },
  avatarGlyphKecil: { fontSize: 18 },
  kodeRoom: {
    fontFamily: font.judulTebalSekali,
    fontSize: 40,
    letterSpacing: 8,
    textAlign: 'center',
    color: warna.text,
  },
  barisPemain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  namaPemain: { flex: 1, fontFamily: font.badanTebal, fontSize: 14.5, color: warna.text },
  siap: { fontFamily: font.judulTebalSekali, fontSize: 16, color: warna.successInk },
  belumSiap: { fontFamily: font.judulTebal, fontSize: 16, color: warna.textDim },
  tombolTumpuk: { gap: 10 },
  wadahMatch: { flex: 1, gap: 8 },
  barisAtasMatch: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  petakBaris: { flexDirection: 'row', gap: 6 },
  petakTarget: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  teksLevel: { flex: 1, fontFamily: font.judulTebal, fontSize: 14, color: warna.textDim },
  teksWaktu: { fontFamily: font.judulTebalSekali, fontSize: 16, color: warna.text },
  wadahPapan: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tiraiHitung: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(43, 27, 83, 0.7)',
  },
  angkaHitung: { fontFamily: font.judulTebalSekali, fontSize: 72, color: warna.textOnDeep },
  papanSkor: { gap: 4 },
  barisSkor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: warna.surface,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: warna.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  barisSaya: { borderColor: warna.grape },
  beku: { fontFamily: font.badan, fontSize: 12, color: warna.textDim },
  skor: { fontFamily: font.judulTebalSekali, fontSize: 16, color: warna.text },
  peringkat: {
    fontFamily: font.judulTebalSekali,
    fontSize: 16,
    color: warna.bubblegumInk,
    width: 22,
  },
});
