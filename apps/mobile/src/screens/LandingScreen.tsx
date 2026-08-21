import React from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogoPixelMatrix } from '../components/LogoPixelMatrix';
import { TombolChunky } from '../components/TombolChunky';
import { bayangan, font, latarGradien, radius, warna } from '../theme';

/**
 * Tagline dipecah per kata dengan pemisah belah ketupat.
 *
 * Sebagai satu kalimat ("Otak Santai Bareng") ia terbaca seperti keterangan
 * yang belum selesai; sebagai tiga kata bertitik ia terbaca sebagai tiga kata
 * kunci — dan itu memang isinya.
 *
 * Belah ketupat, bukan titik bulat: bentuknya sama dengan glyph warna ungu di
 * papan, jadi pemisahnya pun berasal dari gamenya sendiri.
 */
function Tagline() {
  const kata = ['Otak', 'Santai', 'Bareng'];

  return (
    <View style={gaya.tagline}>
      {kata.map((k, i) => (
        <View key={k} style={gaya.taglineKata}>
          {i > 0 && <Text style={gaya.taglineBelahKetupat}>◆</Text>}
          <Text style={gaya.taglineTeks}>{k}</Text>
        </View>
      ))}
    </View>
  );
}

const LANGKAH = [
  'Lihat warna target di bagian atas.',
  'Tap pixel dengan warna itu sebelum memudar.',
  'Warna target berganti sendiri — jangan sampai keliru.',
  'Salah tap: kurang poin dan kurang satu nyawa.',
];

/**
 * Halaman awal.
 *
 * Isinya mengikuti halaman awal web urut demi urut: logo beranimasi, tagline,
 * satu kalimat pengantar, kartu "Cara main", lalu menu. Yang sebelumnya ada di
 * sini — kartu "WARNA PAPAN" berisi enam petak dari `@pixelmatrix/shared` —
 * sudah DIHAPUS: ia perancah untuk membuktikan paket shared benar-benar terbaca
 * dari dalam aplikasi Android, bukan bagian dari design, dan tidak punya
 * padanan di web. Pembuktian itu sekarang dipegang `theme.test.ts`, yang
 * membaca paket yang sama tanpa perlu menempel di layar pemain.
 *
 * **Tombolnya belum melakukan apa-apa.** Papan permainan, lobby, dan papan skor
 * belum ada di sisi Android; yang dikerjakan patch ini murni tampilan.
 */
export function LandingScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  return (
    <View style={[gaya.akar, { backgroundImage: latarGradien(width) }]}>
      {/* `backgroundColor` sudah tidak ada di RN 0.87: Android sekarang
          edge-to-edge, dan warna bilah statusnya diambil dari halaman di
          belakangnya. Yang tersisa hanya memilih warna ikonnya. */}
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={[
          gaya.isi,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <LogoPixelMatrix />
          <Tagline />
        </View>

        <Text style={gaya.intro}>
          Klik pixel yang warnanya sama dengan warna target sebelum pudar. Makin cepat, makin banyak
          poin.
        </Text>

        <View style={gaya.kartu}>
          <Text style={gaya.kartuJudul}>Cara main</Text>
          {LANGKAH.map((teks, i) => (
            <View key={teks} style={gaya.langkah}>
              {/* Nomor langkah ikut berwarna supaya daftarnya terbaca sebagai
                  bagian dari permainan, bukan sebagai syarat & ketentuan. */}
              <Text style={gaya.langkahNomor}>{i + 1}.</Text>
              <Text style={gaya.langkahTeks}>{teks}</Text>
            </View>
          ))}
        </View>

        <View style={gaya.menu}>
          <TombolChunky label="Main Solo" nada="utama" onPress={() => {}} />
          <TombolChunky label="Main Bareng Teman" nada="grape" onPress={() => {}} />
          <TombolChunky label="Papan Skor" nada="sky" onPress={() => {}} />
          <TombolChunky label="Pengaturan" nada="lemon" onPress={() => {}} />
          <TombolChunky label="Tentang & Versi" kecil onPress={() => {}} />
        </View>
      </ScrollView>
    </View>
  );
}

const gaya = StyleSheet.create({
  akar: {
    flex: 1,
    backgroundColor: warna.bg,
  },
  isi: {
    // 18 px, sama seperti padding `body` di web.
    paddingHorizontal: 18,
    gap: 24,
  },
  tagline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  taglineKata: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taglineTeks: {
    color: warna.textDim,
    fontFamily: font.judulSedang,
    fontSize: 16,
    letterSpacing: 0.32,
  },
  taglineBelahKetupat: {
    // Oranye cerah cuma 2,18:1 di krem. Pemisah ini memang hiasan, tapi
    // pemisah yang nyaris tak terlihat juga tidak memisahkan apa pun. Merah
    // muda lulus (4,51:1) sekaligus mengulang warna kata kedua di judul.
    color: warna.bubblegum,
    fontSize: 8.8,
    marginHorizontal: 9.6,
  },
  intro: {
    color: warna.textDim,
    fontFamily: font.badan,
    fontSize: 15.2,
    lineHeight: 25.8,
    textAlign: 'center',
  },
  kartu: {
    backgroundColor: warna.surface,
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: warna.border,
    padding: 18,
    gap: 4,
    boxShadow: `0 ${bayangan.kartu.offsetY}px 0 ${bayangan.kartu.warna}`,
  },
  kartuJudul: {
    fontFamily: font.judulTebal,
    fontSize: 16.8,
    color: warna.grape,
    marginBottom: 12,
  },
  langkah: {
    flexDirection: 'row',
    gap: 8,
  },
  langkahNomor: {
    fontFamily: font.judulTebalSekali,
    fontSize: 15.2,
    lineHeight: 28.1,
    // Di krem ia lulus 4,51:1 — lewat, tapi hanya sejauh 0,01 dari ambang,
    // jadi dipakai versi tulisannya yang lebih gelap.
    color: warna.bubblegumInk,
  },
  langkahTeks: {
    flex: 1,
    color: warna.textDim,
    fontFamily: font.badan,
    fontSize: 15.2,
    lineHeight: 28.1,
  },
  menu: {
    gap: 12,
  },
});
