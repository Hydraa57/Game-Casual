import { describe, expect, it } from 'vitest';
import {
  BOT_DIFFICULTIES,
  BOT_PROFILES,
  botDisplayName,
  botReactionMs,
  pickBotTarget,
} from './bot';
import type { BotDifficulty } from './bot';
import { MAX_CLICKS_PER_SECOND } from '../constants/game';
import type { Color, Pixel, PixelKind } from '../types/index';

const px = (id: string, color: Color, kind: PixelKind = 'normal'): Pixel => ({
  id,
  cell: { row: 0, col: 0 },
  color,
  kind,
  spawnedAtMs: 0,
  lifetimeMs: 3000,
});

/** Undian yang bisa diatur, supaya keputusan bot bisa diperiksa satu per satu. */
const scripted = (values: readonly number[]): (() => number) => {
  let i = 0;
  return () => values[i++] ?? 0.5;
};

describe('profil bot', () => {
  it('makin sulit berarti makin cepat DAN makin jarang salah', () => {
    // Kalau salah satunya tidak monoton, "medium" bisa lebih sulit dari "hard"
    // di keadaan tertentu — dan pilihan tingkat kesulitan jadi bohong.
    const order: BotDifficulty[] = ['easy', 'medium', 'hard'];
    for (let i = 1; i < order.length; i += 1) {
      const prev = BOT_PROFILES[order[i - 1]!];
      const curr = BOT_PROFILES[order[i]!];
      expect(curr.reactionMs).toBeLessThan(prev.reactionMs);
      expect(curr.tapIntervalMs).toBeLessThan(prev.tapIntervalMs);
      expect(curr.accuracy).toBeGreaterThan(prev.accuracy);
      expect(curr.bombAwareness).toBeGreaterThan(prev.bombAwareness);
      expect(curr.goldPriority).toBeGreaterThan(prev.goldPriority);
    }
  });

  it('bot tercepat pun tidak lebih cepat dari refleks manusia', () => {
    // Waktu reaksi visual manusia dewasa ~250 ms sebelum memutuskan apa pun.
    // Bot di bawah itu bukan lawan yang sulit, ia mustahil — dan pemain yang
    // merasa tidak mungkin menang akan berhenti mencoba.
    expect(BOT_PROFILES.hard.reactionMs).toBeGreaterThanOrEqual(250);
  });

  it('tidak ada tingkat yang mengetuk lebih cepat dari batas anti-curang', () => {
    // MAX_CLICKS_PER_SECOND = 8 (125 ms). Bot yang menyentuh batas itu akan
    // ditolak rate limiter di tengah match dan terlihat seperti tersendat —
    // padahal yang salah profilnya, bukan koneksinya.
    for (const difficulty of BOT_DIFFICULTIES) {
      expect(BOT_PROFILES[difficulty].tapIntervalMs).toBeGreaterThan(1000 / MAX_CLICKS_PER_SECOND);
    }
  });

  it('setiap tingkat punya profil', () => {
    for (const difficulty of BOT_DIFFICULTIES) {
      expect(BOT_PROFILES[difficulty]).toBeDefined();
    }
  });
});

describe('waktu reaksi', () => {
  it('bervariasi di sekitar nilai dasarnya', () => {
    const profile = BOT_PROFILES.medium;
    const samples = Array.from({ length: 200 }, () => botReactionMs(profile, Math.random));
    const unique = new Set(samples);
    expect(unique.size).toBeGreaterThan(20);
    for (const sample of samples) {
      expect(sample).toBeGreaterThanOrEqual(profile.reactionMs / 2);
      expect(sample).toBeLessThanOrEqual(profile.reactionMs + profile.reactionJitterMs + 1);
    }
  });

  it('undian paling ekstrem pun tetap di atas refleks manusia', () => {
    // random() = 0 adalah sebaran paling negatif yang mungkin. Ini yang menjaga
    // agar menaikkan `reactionJitterMs` nanti tidak diam-diam melahirkan bot
    // yang mengetuk lebih cepat dari siapa pun yang bisa mengalahkannya.
    for (const difficulty of BOT_DIFFICULTIES) {
      expect(botReactionMs(BOT_PROFILES[difficulty], () => 0)).toBeGreaterThanOrEqual(200);
    }
  });
});

describe('pemilihan pixel', () => {
  const targets: Color[] = ['red'];

  it('papan kosong berarti tidak mengetuk apa pun', () => {
    expect(pickBotTarget([], targets, BOT_PROFILES.hard, Math.random)).toBeNull();
  });

  it('memilih warna target saat tidak sedang salah', () => {
    const board = [px('a', 'red'), px('b', 'blue')];
    // Undian hanya diambil saat memang ada keputusan: tidak ada bom, emas,
    // atau nyawa di papan ini, jadi yang pertama diundi adalah akurasi.
    const choice = pickBotTarget(board, targets, BOT_PROFILES.hard, scripted([0.1, 0]));
    expect(choice?.pixelId).toBe('a');
    expect(choice?.mistake).toBe(false);
  });

  it('bot yang lengah bisa menekan bom sungguhan', () => {
    const board = [px('bom', 'red', 'bomb'), px('a', 'red')];
    // Undiannya DITURUNKAN dari profilnya, bukan ditulis sebagai angka mati:
    // profil ini ditala ulang lewat simulasi, dan angka tetap di sini akan
    // diam-diam berhenti menguji apa yang namanya janjikan begitu ambangnya
    // bergeser melewatinya.
    const lengah = BOT_PROFILES.easy.bombAwareness + 0.01;
    const choice = pickBotTarget(board, targets, BOT_PROFILES.easy, scripted([lengah, 0]));
    expect(choice?.pixelId).toBe('bom');
    expect(choice?.mistake).toBe(true);
  });

  it('bot yang waspada melewati bom dan mengambil target', () => {
    const board = [px('bom', 'red', 'bomb'), px('a', 'red')];
    const waspada = BOT_PROFILES.hard.bombAwareness - 0.01;
    const choice = pickBotTarget(board, targets, BOT_PROFILES.hard, scripted([waspada, 0]));
    expect(choice?.pixelId).toBe('a');
  });

  it('nyawa selalu diambil, tingkat kesulitan apa pun', () => {
    // Tidak ada tingkat yang perlu menolak nyawa gratis — melewatkannya cuma
    // terlihat seperti bot yang rusak, bukan bot yang lemah.
    const board = [px('nyawa', 'blue', 'life'), px('a', 'red')];
    for (const difficulty of BOT_DIFFICULTIES) {
      const choice = pickBotTarget(board, targets, BOT_PROFILES[difficulty], scripted([0.5, 0]));
      expect(choice?.pixelId).toBe('nyawa');
    }
  });

  it('emas dikejar bot pintar dan sering dilewatkan bot lemah', () => {
    const board = [px('emas', 'blue', 'gold'), px('a', 'red')];
    // random() < goldPriority → diambil.
    const kejar = BOT_PROFILES.hard.goldPriority - 0.01;
    const smart = pickBotTarget(board, targets, BOT_PROFILES.hard, scripted([kejar, 0]));
    expect(smart?.pixelId).toBe('emas');

    // 0.8 > goldPriority easy (0.25) → dilewatkan, dan akurasinya lolos (0.1),
    // jadi ia mengambil warna target biasa.
    const lewat = BOT_PROFILES.easy.goldPriority + 0.01;
    const weak = pickBotTarget(board, targets, BOT_PROFILES.easy, scripted([lewat, 0.1, 0]));
    expect(weak?.pixelId).toBe('a');
  });

  it('klik salahnya klik salah sungguhan, bukan diam', () => {
    // Ini yang membuat bot bisa dikalahkan: kesalahannya dihitung engine
    // seperti kesalahan manusia — poin berkurang dan combonya putus.
    const board = [px('a', 'red'), px('salah', 'blue')];
    // Lihat catatan di tes bom: undiannya diturunkan dari profilnya.
    const meleset = BOT_PROFILES.easy.accuracy + 0.01;
    const choice = pickBotTarget(board, targets, BOT_PROFILES.easy, scripted([meleset, 0]));
    expect(choice?.pixelId).toBe('salah');
    expect(choice?.mistake).toBe(true);
  });

  it('tidak bisa salah kalau papan hanya berisi warna target', () => {
    // Memaksanya diam di keadaan ini akan membuatnya terlihat menganggur,
    // padahal yang dimodelkan adalah salah pilih — dan tidak ada yang salah
    // untuk dipilih.
    const board = [px('a', 'red'), px('b', 'red')];
    const meleset = BOT_PROFILES.easy.accuracy + 0.01;
    const choice = pickBotTarget(board, targets, BOT_PROFILES.easy, scripted([meleset, 0]));
    expect(choice).not.toBeNull();
    expect(choice?.mistake).toBe(false);
  });

  it('mengikuti dua warna target di level atas', () => {
    const dual: Color[] = ['red', 'green'];
    const board = [px('a', 'green'), px('b', 'blue')];
    const choice = pickBotTarget(board, dual, BOT_PROFILES.hard, scripted([0.1, 0]));
    expect(choice?.pixelId).toBe('a');
  });
});

describe('nama bot', () => {
  it('netral bahasa — tingkat kesulitannya dibawa lencana, bukan nama', () => {
    // Nama dibuat sekali di server dan dilihat semua orang di room. Nama
    // berbahasa Indonesia akan muncul apa adanya di layar pemain yang memilih
    // English, dan saat itu yang tersimpan tinggal string-nya.
    const name = botDisplayName([]);
    expect(name).toMatch(/^Bot \d+$/);
    for (const difficulty of BOT_DIFFICULTIES) {
      expect(name.toLowerCase()).not.toContain(difficulty);
    }
  });

  it('tidak pernah kembar di satu room', () => {
    const taken: string[] = [];
    for (let i = 0; i < 4; i += 1) taken.push(botDisplayName(taken));
    expect(new Set(taken).size).toBe(4);
  });

  it('mengisi nomor yang kosong, bukan melompatinya', () => {
    // Host mengeluarkan "Bot 1" lalu menambah bot lagi: hasilnya harus "Bot 1"
    // lagi, bukan "Bot 3" — nomor yang melompat terbaca seperti ada bot yang
    // hilang diam-diam.
    expect(botDisplayName(['Bot 2'])).toBe('Bot 1');
  });
});
