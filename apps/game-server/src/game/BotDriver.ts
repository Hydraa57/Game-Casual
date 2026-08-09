import { BOT_PROFILES, botReactionMs, pickBotTarget } from '@pixelmatrix/shared';
import type { BotDifficulty, BotProfile, Color, Pixel } from '@pixelmatrix/shared';

/**
 * Satu bot yang sedang bermain.
 *
 * Ia TIDAK punya timer sendiri. Seluruh keputusannya diambil dari tick match
 * yang sudah ada, dan itu disengaja: timer terpisah berarti bot bisa mengetuk
 * papan di antara dua tick — memakai daftar pixel yang sudah basi, atau lebih
 * buruk, mengetuk pixel yang sudah diklaim orang lain di tick yang sama.
 * Dengan menumpang tick, bot melihat papan yang persis sama dengan yang baru
 * saja disiarkan ke semua pemain.
 *
 * Ia juga tidak memanggil engine sendiri. Ketukannya masuk lewat
 * `Match.handleClick` — jalur yang sama dengan klik manusia, lengkap dengan
 * rate limiter, aturan beku, penalti bom, dan perhitungan skor. Itulah yang
 * membuat mengalahkan bot berarti sesuatu.
 */
export class BotDriver {
  private readonly profile: BotProfile;
  /**
   * Kapan (jam papan) tiap pixel mulai terlihat oleh bot ini.
   *
   * Diundi sekali per pixel, bukan sekali per bot: jeda yang tetap membuat dua
   * bot setingkat selalu mengetuk pixel yang sama di milidetik yang sama, dan
   * yang satu selalu kalah dari yang lain semata-mata karena urutan iterasi.
   */
  private readonly seenAt = new Map<string, number>();
  /** Jam papan saat bot boleh MEMUTUSKAN lagi — irama tangan, bukan mesin. */
  private nextDecisionAtMs = 0;

  constructor(
    readonly botId: string,
    difficulty: BotDifficulty,
    private readonly random: () => number = Math.random,
  ) {
    this.profile = BOT_PROFILES[difficulty];
  }

  /**
   * Satu kesempatan mengetuk. Mengembalikan `pixelId` atau `null`.
   *
   * `elapsedMs` adalah jam PAPAN, bukan `Date.now()`. Sama seperti
   * `Pixel.spawnedAtMs`, dan itu satu-satunya cara jeda reaksinya bisa
   * dibandingkan dengan umur pixel tanpa mencampur dua sumber waktu.
   */
  step(pixels: readonly Pixel[], targetColors: readonly Color[], elapsedMs: number): string | null {
    this.forgetGonePixels(pixels);

    if (elapsedMs < this.nextDecisionAtMs) return null;

    const visible = pixels.filter((pixel) => elapsedMs >= this.visibleFrom(pixel));
    // Papan benar-benar kosong bukan sebuah keputusan. Kalau tidak ada apa pun
    // untuk dilihat, iramanya tidak terpakai — bot yang menunggu spawn tidak
    // sedang "menahan diri", ia memang tidak punya pilihan.
    if (visible.length === 0) return null;

    /*
      Irama tangan dipakai per KEPUTUSAN, bukan per ketukan. Ini perbaikan bug,
      bukan penalaan.

      Versi sebelumnya hanya memajukan jamnya kalau bot benar-benar mengetuk.
      Akibatnya, saat papan cuma berisi warna yang SALAH, `pickBotTarget`
      dipanggil ulang 20 kali per detik — dan tiap panggilan mengundi lagi
      peluang salahnya. Akurasi 98,5% yang tertulis di profil dengan begitu
      berubah jadi "1,5% per 50 ms selama papannya salah semua", yang praktis
      berarti bot PASTI mengetuk warna salah kalau dibiarkan menunggu cukup
      lama.

      Diukur: match 2 pemain berakhir di ~60 detik karena salah satu bot
      tereliminasi (3 KO = 9 klik salah) — 9 klik salah dari hanya 25 ketukan,
      37% salah pada profil berakurasi 98,5%. Dan karena eliminasi mengakhiri
      match, TIDAK ADA target skor yang bisa membuat match berjalan lebih lama;
      menaikkan target hanya membuat garis finis makin tidak pernah tersentuh.

      Dengan jamnya dimajukan di sini, undiannya jadi sekali per irama tangan —
      persis seperti angka akurasinya dibaca orang.

      Batas klik per detik tetap ditegakkan `Match.handleClick` untuk semua
      orang; angka ini yang membuat iramanya wajar, bukan yang mencegah curang.
    */
    this.nextDecisionAtMs = elapsedMs + this.profile.tapIntervalMs;

    const choice = pickBotTarget(visible, targetColors, this.profile, this.random);
    return choice === null ? null : choice.pixelId;
  }

  /** Kapan pixel ini mulai "terlihat" oleh bot; diundi saat pertama kali ditemui. */
  private visibleFrom(pixel: Pixel): number {
    const known = this.seenAt.get(pixel.id);
    if (known !== undefined) return known;

    const at = pixel.spawnedAtMs + botReactionMs(this.profile, this.random);
    this.seenAt.set(pixel.id, at);
    return at;
  }

  /**
   * Buang pixel yang sudah tidak ada di papan.
   *
   * Tanpa ini, peta ini tumbuh sepanjang match — dan match 300 detik dengan
   * spawn tiap setengah detik meninggalkan ratusan entri per bot yang tidak
   * akan pernah dibaca lagi.
   */
  private forgetGonePixels(pixels: readonly Pixel[]): void {
    if (this.seenAt.size <= pixels.length) return;
    const alive = new Set(pixels.map((pixel) => pixel.id));
    for (const id of this.seenAt.keys()) {
      if (!alive.has(id)) this.seenAt.delete(id);
    }
  }
}
