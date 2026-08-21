import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { bayangan, radius, warna } from '../theme';

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
 * baloknya terlihat benar-benar menempel ke halaman.
 */
export function TombolChunky({
  label,
  onPress,
  utama = false,
}: {
  readonly label: string;
  readonly onPress: () => void;
  /** Tombol tindakan utama — diisi warna aksen, bukan permukaan terang. */
  readonly utama?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={gaya.area}>
      {({ pressed }) => (
        <>
          {!pressed && <View style={gaya.bayangan} />}
          <View
            style={[
              gaya.balok,
              { backgroundColor: utama ? warna.accent : warna.surface },
              pressed && { transform: [{ translateY: bayangan.offsetY }] },
            ]}
          >
            <Text style={gaya.label}>{label}</Text>
          </View>
        </>
      )}
    </Pressable>
  );
}

const gaya = StyleSheet.create({
  area: {
    // Tinggi bayangan ikut dihitung supaya tombol tidak bergeser saat ditekan.
    marginBottom: bayangan.offsetY,
  },
  bayangan: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: bayangan.offsetY,
    bottom: -bayangan.offsetY,
    borderRadius: radius.md,
    backgroundColor: warna.borderStrong,
  },
  balok: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: warna.borderStrong,
    paddingHorizontal: 20,
  },
  label: {
    color: warna.text,
    fontSize: 18,
    fontWeight: '800',
  },
});
