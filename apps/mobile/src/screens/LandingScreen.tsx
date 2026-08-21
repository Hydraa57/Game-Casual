import React from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ALL_COLORS, COLOR_GLYPH, COLOR_HEX } from '@pixelmatrix/shared';
import { LogoPixelMatrix } from '../components/LogoPixelMatrix';
import { TombolChunky } from '../components/TombolChunky';
import { radius, warna } from '../theme';

/** `COLOR_HEX` menyimpan angka 0xRRGGBB; React Native butuh string "#rrggbb". */
function keCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

/**
 * Halaman awal.
 *
 * Enam petak warna di bawah menu BUKAN hiasan yang kebetulan mirip: warna dan
 * glyph-nya dibaca langsung dari `ALL_COLORS`, `COLOR_HEX`, dan `COLOR_GLYPH`
 * milik `@pixelmatrix/shared` — modul yang sama persis yang dipakai server saat
 * memutuskan pixel mana yang benar. Kalau suatu hari palet papannya berubah,
 * petak-petak ini ikut berubah tanpa ada yang menyentuh berkas ini.
 *
 * Itu juga yang membuatnya berguna lebih dari sekadar tampilan: selama petak
 * ini tergambar dengan warna yang benar, seluruh rantai — pnpm workspace,
 * symlink, Metro, dan transpilasi TypeScript dari luar folder aplikasi —
 * terbukti bekerja.
 */
export function LandingScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[gaya.akar, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* `backgroundColor` sudah tidak ada di RN 0.87: Android sekarang
          edge-to-edge, dan warna bilah statusnya diambil dari halaman di
          belakangnya. Yang tersisa hanya memilih warna ikonnya. */}
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={gaya.isi} showsVerticalScrollIndicator={false}>
        <LogoPixelMatrix />

        <Text style={gaya.tagline}>Otak · Santai · Bareng</Text>

        <View style={gaya.menu}>
          <TombolChunky label="Main Solo" utama onPress={() => {}} />
          <TombolChunky label="Main Bareng" onPress={() => {}} />
        </View>

        <View style={gaya.kartu}>
          <Text style={gaya.kartuJudul}>WARNA PAPAN</Text>
          <View style={gaya.petakBaris}>
            {ALL_COLORS.map((color) => (
              <View key={color} style={[gaya.petak, { backgroundColor: keCss(COLOR_HEX[color]) }]}>
                <Text style={gaya.petakGlyph}>{COLOR_GLYPH[color]}</Text>
              </View>
            ))}
          </View>
          <Text style={gaya.kartuHint}>
            Warna dan bentuknya diambil dari aturan main yang sama dengan server — bukan disalin.
          </Text>
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
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 24,
  },
  tagline: {
    textAlign: 'center',
    color: warna.textDim,
    fontSize: 15,
    letterSpacing: 1,
  },
  menu: {
    gap: 14,
  },
  kartu: {
    backgroundColor: warna.surface,
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: warna.border,
    padding: 16,
    gap: 12,
  },
  kartuJudul: {
    color: warna.textDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  petakBaris: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  petak: {
    width: 44,
    height: 44,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: warna.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petakGlyph: {
    fontSize: 20,
    // Glyph digambar gelap, sama seperti di papan sungguhan: enam warna papan
    // semuanya terang, dan glyph putih di atasnya justru hilang.
    color: warna.borderStrong,
  },
  kartuHint: {
    color: warna.textDim,
    fontSize: 13,
    lineHeight: 19,
  },
});
