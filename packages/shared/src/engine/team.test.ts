import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS_LIMIT, TEAM_MATCH_SIZES } from '../constants/index';
import {
  balancedTeamFor,
  canJoinTeam,
  otherTeam,
  teamCapacity,
  teamsReady,
  teamTargetScore,
} from './team';

describe('otherTeam', () => {
  it('bolak-balik antara dua regu', () => {
    expect(otherTeam('a')).toBe('b');
    expect(otherTeam('b')).toBe('a');
    expect(otherTeam(otherTeam('a'))).toBe('a');
  });
});

describe('teamCapacity', () => {
  it('membagi kursi rata ke dua regu', () => {
    expect(teamCapacity(4)).toBe(2);
    expect(teamCapacity(6)).toBe(3);
    expect(teamCapacity(8)).toBe(4);
  });

  it('mendukung 4v4 penuh pada batas room', () => {
    expect(teamCapacity(MAX_PLAYERS_LIMIT)).toBe(4);
  });
});

describe('balancedTeamFor', () => {
  it('mengisi regu yang paling sedikit', () => {
    expect(balancedTeamFor({ a: 2, b: 1 })).toBe('b');
    expect(balancedTeamFor({ a: 1, b: 3 })).toBe('a');
  });

  it('jatuh ke regu pertama saat seri', () => {
    expect(balancedTeamFor({ a: 0, b: 0 })).toBe('a');
    expect(balancedTeamFor({ a: 2, b: 2 })).toBe('a');
  });

  it('empat pemain berturut-turut menghasilkan 2v2', () => {
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 4; i += 1) counts[balancedTeamFor(counts)] += 1;
    expect(counts).toEqual({ a: 2, b: 2 });
  });

  it('delapan pemain berturut-turut menghasilkan 4v4', () => {
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 8; i += 1) counts[balancedTeamFor(counts)] += 1;
    expect(counts).toEqual({ a: 4, b: 4 });
  });
});

describe('canJoinTeam', () => {
  it('menolak regu yang sudah penuh', () => {
    expect(canJoinTeam({ a: 2, b: 0 }, 'a', 4)).toBe(false);
    expect(canJoinTeam({ a: 1, b: 0 }, 'a', 4)).toBe(true);
  });

  /**
   * Sengaja DIIZINKAN. Melarang perpindahan yang membuat tidak seimbang
   * terdengar rapi tapi mengunci lobby: dari 2v2 tidak ada satu pun yang bisa
   * mulai bergerak untuk menyusun ulang timnya tanpa ada yang keluar dulu.
   * Yang menahan match dimulai adalah `teamsReady`, bukan larangan ini.
   */
  it('mengizinkan perpindahan yang membuat regu jadi timpang', () => {
    expect(canJoinTeam({ a: 1, b: 1 }, 'a', 4)).toBe(true);
  });
});

describe('teamsReady', () => {
  it('hanya menerima susunan simetris yang sah', () => {
    expect(teamsReady({ a: 2, b: 2 })).toBe(true);
    expect(teamsReady({ a: 3, b: 3 })).toBe(true);
    expect(teamsReady({ a: 4, b: 4 })).toBe(true);
  });

  it('menolak regu timpang', () => {
    expect(teamsReady({ a: 3, b: 2 })).toBe(false);
    expect(teamsReady({ a: 1, b: 3 })).toBe(false);
  });

  it('menolak regu kosong', () => {
    expect(teamsReady({ a: 0, b: 0 })).toBe(false);
    expect(teamsReady({ a: 4, b: 0 })).toBe(false);
  });

  /**
   * 1v1 simetris dan genap, tapi bukan match beregu — itu duel, dan mode ffa
   * sudah menanganinya tanpa satu pun aturan tambahan.
   */
  it('menolak 1v1', () => {
    expect(teamsReady({ a: 1, b: 1 })).toBe(false);
  });

  it('setuju dengan daftar ukuran match beregu', () => {
    for (const total of TEAM_MATCH_SIZES) {
      expect(teamsReady({ a: total / 2, b: total / 2 })).toBe(true);
    }
  });
});

describe('teamTargetScore', () => {
  it('mengali target dengan jumlah anggota', () => {
    expect(teamTargetScore(1000, 2)).toBe(2000);
    expect(teamTargetScore(1000, 3)).toBe(3000);
    expect(teamTargetScore(1000, 4)).toBe(4000);
  });

  /**
   * Inti dari kenapa dikali: tanpa ini, panjang match berubah drastis mengikuti
   * ukuran regu padahal host memilih angka yang sama. Beban per pemain harus
   * tetap sama besarnya berapa pun regunya.
   */
  it('menjaga beban per pemain tetap sama di semua ukuran regu', () => {
    for (const anggota of [2, 3, 4]) {
      expect(teamTargetScore(1000, anggota) / anggota).toBe(1000);
    }
  });

  it('regu yang kehilangan anggota mendapat target lebih rendah', () => {
    expect(teamTargetScore(1000, 3)).toBeLessThan(teamTargetScore(1000, 4));
  });
});
