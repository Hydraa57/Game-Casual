import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLOR_GLYPH } from '@pixelmatrix/shared';
import type { ChaosModifier, Color, HudSnapshot } from '@pixelmatrix/shared';
import { warnaPapanCss } from '../game/palet';
import { font, warna } from '../theme';

const LABEL_CHAOS: Record<ChaosModifier, string> = {
  rush: 'DERAS',
  blackout: 'GELAP',
  bombRain: 'HUJAN BOM',
  shuffle: 'ACAK',
};

/**
 * Indikator warna target.
 *
 * Kotak warnanya DISEMBUNYIKAN saat mode Stroop aktif, dan itu bukan pilihan
 * kosmetik: kotak itu memperlihatkan warna target apa adanya, jadi
 * membiarkannya berarti jawabannya tetap terpampang dan seluruh mode ini tidak
 * melakukan apa pun. Yang tersisa hanyalah kata-katanya.
 */
function IndikatorTarget({
  colors,
  ink,
}: {
  readonly colors: readonly Color[];
  readonly ink: readonly Color[] | null;
}) {
  const stroop = ink !== null;

  return (
    <>
      {!stroop && (
        <View style={gaya.petakBaris}>
          {colors.map((color) => (
            <View key={color} style={[gaya.petak, { backgroundColor: warnaPapanCss(color) }]}>
              <Text style={gaya.petakGlyph} allowFontScaling={false}>
                {COLOR_GLYPH[color]}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={gaya.targetTeks}>
        <Text style={gaya.label}>{stroop ? 'BACA KATANYA' : 'TARGET'}</Text>
        <Text style={gaya.nilai} numberOfLines={1}>
          {colors.map((color, i) => (
            <Text key={color}>
              {i > 0 && <Text style={gaya.tambah}> + </Text>}
              <Text
                // Warna tinta hanya dipakai saat Stroop; di mode biasa teksnya
                // memakai warna teks normal supaya tetap paling mudah dibaca.
                style={stroop ? { color: warnaPapanCss(ink[i] ?? color) } : undefined}
              >
                {color.toUpperCase()}
              </Text>
            </Text>
          ))}
        </Text>
      </View>
    </>
  );
}

/**
 * Bar progres menuju level berikutnya.
 *
 * Ditaruh tepat di bawah indikator target dan DI ATAS papan: itu satu-satunya
 * tempat yang sudah dilirik pemain sepanjang ronde. Bar di bawah papan praktis
 * tidak pernah terlihat.
 */
function BarLevel({
  level,
  fraction,
  sisaKlik,
  atMax,
}: {
  readonly level: number;
  readonly fraction: number;
  readonly sisaKlik: number;
  readonly atMax: boolean;
}) {
  return (
    <View style={gaya.bar}>
      <View style={gaya.barKepala}>
        <Text style={gaya.label}>
          LEVEL {level}
          {atMax ? '  MAX' : ''}
        </Text>
        <Text style={gaya.barSisa} numberOfLines={1}>
          {sisaKlik} klik lagi
        </Text>
      </View>
      <View style={gaya.barLintasan}>
        <View style={[gaya.barIsi, { width: `${Math.min(100, fraction * 100)}%` }]} />
      </View>
    </View>
  );
}

function Angka({
  label,
  nilai,
  petunjuk,
  nada,
}: {
  readonly label: string;
  readonly nilai: string | number;
  readonly petunjuk?: string;
  readonly nada?: 'combo' | 'bahaya';
}) {
  const warnaNada =
    nada === 'combo' ? warna.accentInk : nada === 'bahaya' ? warna.danger : warna.text;

  return (
    <View style={gaya.angka}>
      <Text style={gaya.label}>{label}</Text>
      <Text style={[gaya.nilai, { color: warnaNada }]} numberOfLines={1}>
        {nilai}
        {petunjuk === undefined ? '' : ` ${petunjuk}`}
      </Text>
    </View>
  );
}

export function Hud({ snapshot }: { readonly snapshot: HudSnapshot }) {
  return (
    <View style={gaya.hud}>
      <View
        style={[
          gaya.target,
          // Pergantian warna target sebentar lagi. Di web ini berkedip; di sini
          // bingkainya menegas — sama-sama peringatan, tanpa gerakan berulang
          // yang bisa mengganggu sebagian orang.
          snapshot.targetImminent && { borderColor: warna.text },
        ]}
      >
        <IndikatorTarget colors={snapshot.targetColors} ink={snapshot.stroopInk} />
        {snapshot.chaos !== null && (
          <View style={gaya.lencanaChaos}>
            <Text style={gaya.lencanaTeks}>{LABEL_CHAOS[snapshot.chaos]}</Text>
          </View>
        )}
      </View>

      <BarLevel
        level={snapshot.level}
        fraction={snapshot.levelFraction}
        sisaKlik={snapshot.clicksToNextLevel}
        atMax={snapshot.atMaxLevel}
      />

      <View style={gaya.deretAngka}>
        <Angka label="SKOR" nilai={snapshot.score} />
        <Angka
          label="COMBO"
          nilai={snapshot.combo > 0 ? snapshot.combo : '—'}
          petunjuk={snapshot.multiplier > 1 ? `×${snapshot.multiplier}` : undefined}
          nada={snapshot.multiplier > 1 ? 'combo' : undefined}
        />
        <Angka
          label="NYAWA"
          nilai={snapshot.lives === null ? '∞' : '▮'.repeat(snapshot.lives) || '—'}
          nada={snapshot.lives !== null && snapshot.lives <= 1 ? 'bahaya' : undefined}
        />
      </View>
    </View>
  );
}

const gaya = StyleSheet.create({
  hud: {
    gap: 8,
  },
  target: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: warna.surface,
    borderWidth: 2,
    borderColor: warna.border,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  petakBaris: {
    flexDirection: 'row',
    gap: 6,
  },
  petak: {
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  petakGlyph: {
    fontSize: 19,
    // Glyph digambar gelap: enam warna papan semuanya terang, dan glyph putih
    // di atasnya justru hilang.
    color: 'rgba(0, 0, 0, 0.55)',
    includeFontPadding: false,
  },
  targetTeks: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontFamily: font.judulTebal,
    fontSize: 11.5,
    color: warna.textDim,
    letterSpacing: 0.46,
  },
  nilai: {
    fontFamily: font.judulTebalSekali,
    fontSize: 18.4,
    color: warna.text,
  },
  tambah: {
    color: warna.textDim,
  },
  lencanaChaos: {
    backgroundColor: warna.bubblegum,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  lencanaTeks: {
    fontFamily: font.judulTebalSekali,
    fontSize: 11.5,
    color: warna.textOnDeep,
  },
  bar: {
    gap: 4.8,
  },
  barKepala: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  barSisa: {
    fontFamily: font.badan,
    fontSize: 12.8,
    color: warna.textDim,
    // Boleh menyusut sampai hilang: ia hanya keterangan dari bar yang tepat di
    // bawahnya, jadi ia yang paling layak mengalah kalau barisnya sempit.
    flexShrink: 1,
  },
  barLintasan: {
    height: 12,
    borderRadius: 999,
    // Bingkai tipis supaya lintasannya tetap terlihat di halaman krem — tanpa
    // itu, bar kosong dan halaman kosong terlihat sama persis.
    borderWidth: 2,
    borderColor: warna.border,
    backgroundColor: warna.surface,
    overflow: 'hidden',
  },
  barIsi: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: warna.accent,
  },
  deretAngka: {
    flexDirection: 'row',
    gap: 8,
  },
  angka: {
    flex: 1,
    backgroundColor: warna.surface,
    borderWidth: 2,
    borderColor: warna.border,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    minWidth: 0,
  },
});
