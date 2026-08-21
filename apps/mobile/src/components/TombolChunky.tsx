import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { bayangan, font, radius, warna } from '../theme';

/**
 * Warna tombol menurut TUJUANNYA, bukan sekadar dekorasi.
 *
 * Angkanya disalin dari `.btn--*` di `globals.css`. Yang paling penting dibawa
 * ke sini bukan warnanya, melainkan **warna teksnya**: teks putih di atas
 * oranye atau kuning tidak akan pernah lulus kontras — itu jebakan paling umum
 * di palet ceria, dan versi web sudah pernah kena. Yang berlatar terang memakai
 * teks gelap yang DIPATOK, yang berlatar dalam memakai putih.
 */
const NADA = {
  utama: { isi: warna.accent, teks: warna.text, besar: true },
  grape: { isi: warna.grape, teks: warna.textOnDeep, besar: false },
  sky: { isi: warna.sky, teks: warna.textOnDeep, besar: false },
  bubblegum: { isi: warna.bubblegum, teks: warna.textOnDeep, besar: false },
  lemon: { isi: warna.lemon, teks: warna.text, besar: false },
  polos: { isi: warna.surface, teks: warna.text, besar: false },
} as const;

export type NadaTombol = keyof typeof NADA;

/**
 * Tombol balok ala game kasual.
 *
 * Bayangannya digambar sebagai View terpisah di belakang tombol, BUKAN dengan
 * `elevation` Android. Alasannya bahasa visual: `elevation` menggambar bayangan
 * lembut Material yang menyebar ke segala arah, sementara game ini memakai
 * bayangan padat tanpa blur yang bergeser lurus ke bawah — itu yang membuat
 * tombolnya terlihat seperti balok yang bisa ditekan, bukan seperti kartu yang
 * melayang.
 *
 * Saat ditekan, tombolnya turun sejauh tinggi bayangannya sendiri, jadi
 * baloknya terlihat benar-benar menempel ke halaman — persis `transform:
 * translateY(4px)` yang dipakai `.btn:active` di web.
 */
export function TombolChunky({
  label,
  onPress,
  nada = 'polos',
  kecil = false,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly nada?: NadaTombol;
  /** `.btn--small`: untuk tautan yang harus ada tapi bukan tujuan utama siapa pun. */
  readonly kecil?: boolean;
}) {
  const gayaNada = NADA[nada];

  return (
    <Pressable onPress={onPress} style={gaya.area}>
      {({ pressed }) => (
        <>
          {!pressed && <View style={gaya.bayangan} />}
          <View
            style={[
              gaya.balok,
              kecil ? gaya.balokKecil : null,
              { backgroundColor: gayaNada.isi },
              pressed && { transform: [{ translateY: bayangan.tombol.offsetY }] },
            ]}
          >
            <Text
              style={[
                gaya.label,
                { color: gayaNada.teks },
                gayaNada.besar ? gaya.labelBesar : null,
                kecil ? gaya.labelKecil : null,
              ]}
            >
              {label}
            </Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

const gaya = StyleSheet.create({
  area: {
    // Tinggi bayangan ikut dihitung supaya tombol tidak bergeser saat ditekan.
    marginBottom: bayangan.tombol.offsetY,
  },
  bayangan: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: bayangan.tombol.offsetY,
    bottom: -bayangan.tombol.offsetY,
    borderRadius: radius.sm,
    backgroundColor: bayangan.tombol.warna,
  },
  balok: {
    // 48 px: target sentuh jempol, sama seperti `min-height` di web.
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: warna.borderStrong,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  balokKecil: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  label: {
    // Bobot dipilih lewat BERKAS font-nya, bukan lewat `fontWeight` —
    // lihat catatan di `theme.ts`.
    fontFamily: font.judulTebal,
    fontSize: 16,
    letterSpacing: 0.16,
  },
  labelBesar: {
    fontFamily: font.judulTebalSekali,
    fontSize: 18,
  },
  labelKecil: {
    fontSize: 12,
  },
});
