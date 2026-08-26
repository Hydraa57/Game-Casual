import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SOLO_STARTING_LIVES } from '@pixelmatrix/shared';
import type { GameEvent, HudSnapshot, Pixel } from '@pixelmatrix/shared';
import { MAX_FRAME_MS, MesinSolo } from './MesinSolo';

/**
 * Satu ronde solo dimainkan sungguhan di sini, frame demi frame.
 *
 * Ini satu-satunya bagian aplikasi Android yang bisa dibuktikan tanpa HP, dan
 * karena itu ia dipakai sejauh mungkin: yang diuji bukan "fungsinya
 * terpanggil", tapi apakah menap warna yang benar menambah skor, apakah menap
 * bom mengurangi nyawa, dan apakah nyawa habis benar-benar mengakhiri ronde.
 *
 * Yang TIDAK diuji di sini: tampilannya. Lihat catatan di ANDROID-NATIVE.md.
 */

/** Frame 60 fps. Dipakai supaya waktu di test berjalan seperti di HP. */
const FRAME_MS = 16;

interface Rakitan {
  readonly mesin: MesinSolo;
  readonly hud: HudSnapshot[];
  readonly events: GameEvent[];
}

function rakit(opsi: { seed?: number; levelAwal?: number } = {}): Rakitan {
  const hud: HudSnapshot[] = [];
  const events: GameEvent[] = [];
  const mesin = new MesinSolo({
    seed: opsi.seed ?? 12345,
    levelAwal: opsi.levelAwal,
    onHud: (s) => hud.push(s),
    onEvent: (e) => events.push(e),
  });
  return { mesin, hud, events };
}

/** Majukan sampai `syarat` terpenuhi, atau menyerah setelah `batasFrame`. */
function majukanSampai(mesin: MesinSolo, syarat: () => boolean, batasFrame = 2000): boolean {
  for (let i = 0; i < batasFrame; i += 1) {
    if (syarat()) return true;
    mesin.majukan(FRAME_MS);
  }
  return syarat();
}

/** Pixel biasa pertama yang warnanya termasuk warna target. */
function cariTarget(mesin: MesinSolo): Pixel | undefined {
  const target = mesin.debugState.board.targetColors;
  return mesin.pixels.find((p) => p.kind === 'normal' && target.includes(p.color));
}

/** Pixel biasa pertama yang warnanya BUKAN warna target. */
function cariBukanTarget(mesin: MesinSolo): Pixel | undefined {
  const target = mesin.debugState.board.targetColors;
  return mesin.pixels.find((p) => p.kind === 'normal' && !target.includes(p.color));
}

function tap(mesin: MesinSolo, pixel: Pixel): void {
  mesin.tapSel(pixel.cell.row, pixel.cell.col);
}

describe('MesinSolo — sebelum dimulai', () => {
  it('mulai dari idle dan tidak berjalan sendiri', () => {
    const { mesin } = rakit();
    expect(mesin.status).toBe('idle');

    // Sepuluh frame tanpa `mulai()` tidak boleh mengubah apa pun. Ini yang
    // membuat pemain sempat menaruh jempolnya sebelum pixel pertama muncul.
    for (let i = 0; i < 10; i += 1) mesin.majukan(FRAME_MS);

    expect(mesin.status).toBe('idle');
    expect(mesin.elapsedMs).toBe(0);
    expect(mesin.pixels).toHaveLength(0);
  });

  it('tap diabaikan saat belum berjalan', () => {
    const { mesin, events } = rakit();
    mesin.tapSel(0, 0);
    expect(events).toHaveLength(0);
  });
});

describe('MesinSolo — permainan sungguhan', () => {
  let r: Rakitan;

  beforeEach(() => {
    r = rakit();
    r.mesin.mulai();
  });

  it('pixel mulai bermunculan setelah dimulai', () => {
    expect(majukanSampai(r.mesin, () => r.mesin.pixels.length > 0)).toBe(true);
    expect(r.events.some((e) => e.type === 'pixelSpawned')).toBe(true);
  });

  it('menap warna target menambah skor dan combo', () => {
    majukanSampai(r.mesin, () => cariTarget(r.mesin) !== undefined);
    const pixel = cariTarget(r.mesin);
    expect(pixel).toBeDefined();

    const sebelum = r.mesin.debugState.score;
    tap(r.mesin, pixel!);
    const sesudah = r.mesin.debugState.score;

    expect(sesudah.score).toBeGreaterThan(sebelum.score);
    expect(sesudah.combo).toBe(sebelum.combo + 1);
    expect(sesudah.correctClicks).toBe(sebelum.correctClicks + 1);
    expect(r.events.some((e) => e.type === 'pixelClaimed')).toBe(true);
  });

  it('menap warna yang salah mengurangi nyawa dan memutus combo', () => {
    // Kumpulkan combo dulu supaya putusnya benar-benar terlihat.
    majukanSampai(r.mesin, () => cariTarget(r.mesin) !== undefined);
    tap(r.mesin, cariTarget(r.mesin)!);
    expect(r.mesin.debugState.score.combo).toBe(1);

    majukanSampai(r.mesin, () => cariBukanTarget(r.mesin) !== undefined);
    const salah = cariBukanTarget(r.mesin);
    expect(salah).toBeDefined();

    const nyawaSebelum = r.mesin.debugState.score.lives;
    tap(r.mesin, salah!);

    expect(r.mesin.debugState.score.lives).toBe(nyawaSebelum! - 1);
    expect(r.mesin.debugState.score.combo).toBe(0);
    expect(r.mesin.debugState.score.wrongClicks).toBe(1);
  });

  it('menap sel kosong tidak dihukum sama sekali', () => {
    majukanSampai(r.mesin, () => r.mesin.pixels.length > 0);

    // Cari sel yang benar-benar kosong.
    const terisi = new Set(r.mesin.pixels.map((p) => `${p.cell.row},${p.cell.col}`));
    let kosong: { row: number; col: number } | null = null;
    for (let row = 0; row < 8 && kosong === null; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        if (!terisi.has(`${row},${col}`)) {
          kosong = { row, col };
          break;
        }
      }
    }
    expect(kosong).not.toBeNull();

    const sebelum = r.mesin.debugState.score;
    r.mesin.tapSel(kosong!.row, kosong!.col);
    const sesudah = r.mesin.debugState.score;

    expect(sesudah.lives).toBe(sebelum.lives);
    expect(sesudah.score).toBe(sebelum.score);
    expect(sesudah.wrongClicks).toBe(sebelum.wrongClicks);
    expect(sesudah.combo).toBe(sebelum.combo);
  });

  it('nyawa habis mengakhiri ronde', () => {
    for (let i = 0; i < SOLO_STARTING_LIVES; i += 1) {
      const ketemu = majukanSampai(r.mesin, () => cariBukanTarget(r.mesin) !== undefined);
      expect(ketemu).toBe(true);
      tap(r.mesin, cariBukanTarget(r.mesin)!);
    }

    expect(r.mesin.debugState.score.lives).toBe(0);
    expect(r.mesin.status).toBe('gameOver');
    expect(r.events.some((e) => e.type === 'gameOver')).toBe(true);

    // Setelah game over, tap tidak boleh mengubah apa pun lagi.
    const skorAkhir = r.mesin.debugState.score.score;
    majukanSampai(r.mesin, () => false, 20);
    expect(r.mesin.debugState.score.score).toBe(skorAkhir);
  });
});

describe('MesinSolo — jeda', () => {
  it('membekukan waktu, lalu melanjutkannya', () => {
    const { mesin } = rakit();
    mesin.mulai();
    majukanSampai(mesin, () => mesin.elapsedMs > 200);

    const beku = mesin.elapsedMs;
    mesin.jeda();
    expect(mesin.status).toBe('paused');

    for (let i = 0; i < 30; i += 1) mesin.majukan(FRAME_MS);
    expect(mesin.elapsedMs).toBe(beku);

    mesin.lanjutkan();
    expect(mesin.status).toBe('running');
    mesin.majukan(FRAME_MS);
    expect(mesin.elapsedMs).toBeGreaterThan(beku);
  });

  it('tap diabaikan saat sedang jeda', () => {
    const { mesin } = rakit();
    mesin.mulai();
    majukanSampai(mesin, () => cariTarget(mesin) !== undefined);
    const pixel = cariTarget(mesin)!;

    mesin.jeda();
    const sebelum = mesin.debugState.score.score;
    tap(mesin, pixel);
    expect(mesin.debugState.score.score).toBe(sebelum);
  });
});

describe('MesinSolo — frame yang melompat', () => {
  it('satu frame raksasa dijepit di MAX_FRAME_MS', () => {
    const { mesin } = rakit();
    mesin.mulai();

    // Aplikasi ditaruh di latar belakang lima detik lalu dibuka lagi.
    mesin.majukan(5000);

    expect(mesin.elapsedMs).toBe(MAX_FRAME_MS);
  });
});

describe('MesinSolo — HUD', () => {
  it('tidak dipancarkan ulang kalau tidak ada yang berubah', () => {
    const { mesin, hud } = rakit();
    mesin.mulai();

    // Majukan dengan delta 0: `step` menolaknya, jadi tidak ada satu pun
    // nilai yang berubah dan HUD tidak boleh dikabari.
    const jumlahAwal = hud.length;
    for (let i = 0; i < 20; i += 1) mesin.majukan(0);

    expect(hud.length).toBe(jumlahAwal);
  });

  it('mencerminkan skor dan nyawa yang sebenarnya', () => {
    const { mesin, hud } = rakit();
    mesin.mulai();
    majukanSampai(mesin, () => cariTarget(mesin) !== undefined);
    tap(mesin, cariTarget(mesin)!);

    const terakhir = hud[hud.length - 1]!;
    expect(terakhir.score).toBe(mesin.debugState.score.score);
    expect(terakhir.lives).toBe(SOLO_STARTING_LIVES);
    expect(terakhir.combo).toBe(1);
    expect(terakhir.status).toBe('running');
  });
});

describe('MesinSolo — mekanik level tinggi', () => {
  it('bom muncul di level 8 dan menap-nya mengurangi nyawa', () => {
    const { mesin, events } = rakit({ levelAwal: 8 });
    mesin.mulai();

    const adaBom = majukanSampai(mesin, () => mesin.pixels.some((p) => p.kind === 'bomb'), 6000);
    expect(adaBom).toBe(true);

    const bom = mesin.pixels.find((p) => p.kind === 'bomb')!;
    const nyawaSebelum = mesin.debugState.score.lives!;
    tap(mesin, bom);

    expect(mesin.debugState.score.lives).toBeLessThan(nyawaSebelum);
    expect(events.some((e) => e.type === 'bombHit')).toBe(true);
  });

  /*
    Jumlah warna target ditentukan saat targetnya BERGANTI, bukan saat levelnya
    disetel. Jadi mulai dari Lv 12 masih membawa satu warna dari state awal
    sampai pergantian target pertama — dan itu memang perilaku yang benar, sama
    persis dengan yang terjadi di web lewat `?level=12`.

    Test ini sempat gagal karena saya berasumsi sebaliknya. Dibiarkan menunggu
    pergantian target, bukan "diperbaiki" dengan menyuntik warna ke state:
    yang diuji harus jalur yang sama dengan yang dilewati saat main sungguhan.
  */
  it('dua warna target aktif setelah pergantian target di level 12', () => {
    const { mesin, events } = rakit({ levelAwal: 12 });
    mesin.mulai();
    expect(mesin.debugState.board.targetColors).toHaveLength(1);

    const berganti = majukanSampai(
      mesin,
      () => events.some((e) => e.type === 'targetChanged'),
      3000,
    );
    expect(berganti).toBe(true);
    expect(mesin.debugState.board.targetColors).toHaveLength(2);
  });

  it('tetap satu warna target di bawah level 12', () => {
    const { mesin, events } = rakit({ levelAwal: 11 });
    mesin.mulai();
    majukanSampai(mesin, () => events.some((e) => e.type === 'targetChanged'), 3000);
    expect(mesin.debugState.board.targetColors).toHaveLength(1);
  });
});

describe('MesinSolo — glyph saat chaos blackout', () => {
  it('bom tetap menampilkan tandanya walau glyph disembunyikan', () => {
    // Cari seed yang benar-benar memberi modifier `blackout` di suatu level
    // chaos, daripada mengarang state — supaya yang diuji jalur yang sama
    // dengan yang dipakai saat main.
    let ketemu: MesinSolo | null = null;
    for (let seed = 1; seed < 400 && ketemu === null; seed += 1) {
      const kandidat = new MesinSolo({
        seed,
        levelAwal: 21,
        onHud: () => {},
        onEvent: () => {},
      });
      kandidat.mulai();
      const contoh: Pixel = {
        id: 'x',
        cell: { row: 0, col: 0 },
        color: 'red',
        kind: 'normal',
        spawnedAtMs: 0,
        lifetimeMs: 1000,
      };
      if (kandidat.sembunyikanGlyph(contoh)) ketemu = kandidat;
    }

    expect(ketemu, 'tidak ada seed yang memberi blackout di Lv 21').not.toBeNull();

    const bom: Pixel = {
      id: 'b',
      cell: { row: 1, col: 1 },
      color: 'red',
      kind: 'bomb',
      spawnedAtMs: 0,
      lifetimeMs: 1000,
    };
    // Bom yang tidak bisa dibedakan dari pixel biasa bukan kesulitan, itu
    // jebakan — jadi tandanya tidak pernah ikut disembunyikan.
    expect(ketemu!.sembunyikanGlyph(bom)).toBe(false);
  });
});

describe('MesinSolo — determinisme', () => {
  it('seed yang sama menghasilkan papan yang sama persis', () => {
    const jalankan = () => {
      const { mesin } = rakit({ seed: 777 });
      mesin.mulai();
      for (let i = 0; i < 300; i += 1) mesin.majukan(FRAME_MS);
      return mesin.pixels.map((p) => `${p.cell.row},${p.cell.col},${p.color},${p.kind}`);
    };

    expect(jalankan()).toEqual(jalankan());
  });

  it('seed berbeda menghasilkan papan berbeda', () => {
    const jalankan = (seed: number) => {
      const { mesin } = rakit({ seed });
      mesin.mulai();
      for (let i = 0; i < 300; i += 1) mesin.majukan(FRAME_MS);
      return mesin.pixels.map((p) => `${p.cell.row},${p.cell.col},${p.color}`).join('|');
    };

    expect(jalankan(1)).not.toBe(jalankan(2));
  });

  it('tanpa seed, jam yang dipakai', () => {
    const jam = vi.spyOn(Date, 'now').mockReturnValue(4242);
    try {
      const mesin = new MesinSolo({ onHud: () => {}, onEvent: () => {} });
      expect(mesin.debugState.board.chaosSeed).toBe(4242);
    } finally {
      jam.mockRestore();
    }
  });
});
