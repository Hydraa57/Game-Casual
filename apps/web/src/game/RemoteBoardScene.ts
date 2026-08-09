import * as Phaser from 'phaser';
import {
  AVATAR_GLYPH,
  chaosHidesGlyphs,
  GRID_SIZE,
  isComboMilestone,
  MP_WRONG_CLICK_COOLDOWN_MS,
} from '@pixelmatrix/shared';
import type { AvatarId, ChaosModifier, Cell, Color, Pixel, PixelKind } from '@pixelmatrix/shared';
import { BoardRenderer } from './BoardRenderer';
import { BOARD_BACKGROUND } from './palette';
import type { Sfx } from './sfx';

interface DebugWindow {
  __pmRemote?: {
    pixels: () => Pixel[];
    targets: () => Color[];
    /** Jumlah sel yang BENAR-BENAR dipakai renderer, bukan yang dikira client. */
    gridSize: () => number;
  };
}

export interface RemoteBoardOptions {
  /** Dipanggil saat pemain menap sebuah pixel; pengirimannya diurus pemanggil. */
  readonly onTapPixel: (pixelId: string) => void;
  readonly sfx: Sfx;
}

/**
 * Papan multiplayer.
 *
 * Bedanya dengan solo: scene ini TIDAK menjalankan engine. Ia hanya menggambar
 * apa yang dikirim server dan meneruskan tap. Server yang memutuskan siapa
 * mengklaim pixel — itulah yang membuat "siapa cepat dia dapat" adil dan tidak
 * bisa dicurangi dari sisi client.
 */
export class RemoteBoardScene extends Phaser.Scene {
  /**
   * Renderer papan. `undefined` sampai Phaser menjalankan `create()`.
   *
   * Tanda tanya, BUKAN tanda seru. `createRemoteGame` mengembalikan scene ini
   * seketika sementara Phaser baru mem-boot-nya beberapa frame kemudian, jadi
   * setiap event server yang tiba di celah itu menyentuh renderer yang belum
   * ada. `setGridSize` sudah lama membawa penjaga `if (!this.boardView) return`
   * untuk persis alasan ini — penjaga satu tempat sementara dua puluhan tempat
   * lain memakai `!` untuk meyakinkan TypeScript bahwa masalahnya tidak ada.
   *
   * Belum pernah tertangkap sebagai kegagalan sungguhan, dan itu memang bukan
   * alasan perubahannya: yang diperbaiki adalah tipe yang BERBOHONG. Selama
   * `!` dipakai, kompilator ikut menutupi celah yang nyata alih-alih
   * menunjukkannya.
   *
   * Bentuk yang benar: MODEL (pixel, target, chaos) selalu diperbarui,
   * gambarnya menyusul. `create()` menggambar ulang apa pun yang sudah
   * menumpuk, jadi tidak ada event yang hilang — hanya tertunda beberapa frame.
   */
  private boardView?: BoardRenderer;
  /**
   * Jumlah sel papan yang sedang digambar.
   *
   * Scene ini dibuat saat halaman match dipasang — SEBELUM `game:started`
   * datang, jadi ukuran papan sebenarnya belum diketahui waktu `create()`
   * berjalan. Papan digambar dengan ukuran baku dulu, lalu `setGridSize`
   * menggantinya begitu server memberi tahu.
   */
  private gridSize = GRID_SIZE;
  private pixels = new Map<string, Pixel>();
  private elapsedMs = 0;
  private chaos: ChaosModifier | null = null;
  private targets: readonly Color[] = [];
  private interactive = false;
  private cooldownUntil = 0;
  private frozen = false;

  constructor(private readonly options: RemoteBoardOptions) {
    super('remote-board');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BOARD_BACKGROUND);
    this.boardView = new BoardRenderer(this, this.gridSize);
    this.boardView.drawGrid();
    // Susul keadaan yang sudah tiba sebelum Phaser siap.
    if (this.pixels.size > 0) {
      this.boardView.redraw([...this.pixels.values()], chaosHidesGlyphs(this.chaos));
    }
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);

    if (process.env.NODE_ENV !== 'production') {
      // Kait untuk uji end-to-end: tes perlu tahu pixel mana yang berwarna
      // target supaya bisa mengetuk sel yang sama dari dua device sekaligus.
      (window as unknown as DebugWindow).__pmRemote = {
        pixels: () => [...this.pixels.values()],
        targets: () => [...this.targets],
        gridSize: () => this.gridSize,
      };
    }
  }

  /**
   * Pemain sedang beku karena nyawanya habis.
   *
   * Server sudah mengabaikan ketukannya, tapi diblokir di sini juga supaya
   * tidak ada pesan sia-sia terbang di jaringan seluler selama 5 detik itu.
   */
  setFrozen(frozen: boolean): void {
    this.frozen = frozen;
  }

  /** Warna target saat ini — dikirim server lewat `game:started`/`targetChanged`. */
  setTargets(colors: readonly Color[]): void {
    this.targets = colors;
  }

  /**
   * Pakai papan sebanyak ini selnya. Datang dari server, tidak pernah ditebak.
   *
   * Dipanggil dari `game:started` DAN dari resync — pemain yang kembali di
   * tengah match melewatkan `game:started` sepenuhnya, dan tanpa panggilan
   * kedua ia akan menggambar papan 8×8 di atas match 10×10. Papannya akan
   * terlihat wajar; yang salah adalah setiap ketukannya mendarat di sel yang
   * berbeda dari yang dilihatnya, tanpa satu pun error yang menandainya.
   *
   * Aman dipanggil berkali-kali: ukuran yang sama tidak melakukan apa-apa.
   */
  setGridSize(gridSize: number): void {
    if (gridSize === this.gridSize || !Number.isFinite(gridSize) || gridSize < 2) return;
    this.gridSize = gridSize;
    // Scene bisa belum sempat `create()` kalau eventnya datang sangat awal;
    // nilainya sudah tersimpan dan akan dipakai saat renderer-nya dibuat.
    if (!this.boardView) return;

    const isi = [...this.pixels.values()];
    this.boardView?.destroy();
    this.boardView = new BoardRenderer(this, gridSize);
    this.boardView.drawGrid();
    // Pixel yang sedang hidup digambar ulang di koordinat baru. Membuangnya
    // akan membuat papan kosong beberapa detik tepat setelah pemain kembali.
    this.boardView?.redraw(isi, chaosHidesGlyphs(this.chaos));
  }

  override update(_time: number, delta: number): void {
    if (!this.interactive) return;
    // Waktu dihitung lokal hanya untuk animasi memudar; skor sepenuhnya milik
    // server, jadi selisih kecil di sini tidak berpengaruh ke permainan.
    this.elapsedMs += delta;
    this.boardView?.refreshFade([...this.pixels.values()], this.elapsedMs);
  }

  // ---------------------------------------------------------------- dari server

  beginMatch(): void {
    this.interactive = true;
    this.frozen = false;
    this.cooldownUntil = 0;
    this.elapsedMs = 0;
    this.pixels.clear();
    this.boardView?.clear();
  }

  endMatch(): void {
    this.interactive = false;
    this.pixels.clear();
    this.boardView?.clear();
  }

  setChaos(chaos: ChaosModifier | null): void {
    if (chaos === this.chaos) return;
    this.chaos = chaos;
    // Glyph muncul/hilang saat modifier berganti, jadi papan digambar ulang.
    this.boardView?.redraw([...this.pixels.values()], chaosHidesGlyphs(chaos));
  }

  spawn(pixel: Pixel): void {
    // Waktu spawn diselaraskan ke jam lokal scene supaya animasi memudarnya
    // sesuai walau `elapsedMs` server dan client tidak persis sama.
    const local: Pixel = { ...pixel, spawnedAtMs: this.elapsedMs };
    this.pixels.set(pixel.id, local);
    this.boardView?.add(local, chaosHidesGlyphs(this.chaos) && pixel.kind === 'normal');
  }

  expire(pixelId: string): void {
    this.pixels.delete(pixelId);
    this.boardView?.remove(pixelId, 'fade');
  }

  claimed(
    pixelId: string,
    cell: Cell,
    points: number,
    byMe: boolean,
    combo: number,
    avatar: AvatarId | null,
    kind: PixelKind = 'normal',
  ): void {
    this.pixels.delete(pixelId);
    // Semburan dipanggil SEBELUM remove: warnanya dibaca dari view yang masih
    // ada di papan.
    this.boardView?.burstAt(pixelId, cell);
    this.boardView?.remove(pixelId, 'pop');
    // Poin lawan tetap ditampilkan tapi diredupkan: kamu perlu tahu pixel itu
    // direbut, tanpa mengira itu poinmu.
    this.boardView?.floatingScore(cell, `+${points}`, byMe ? '#fffffe' : '#a7a4c4');
    // `avatar` null hanya kalau event datang sebelum daftar pemain sampai —
    // capnya dilewati, tapi poin dan suaranya tetap jalan.
    if (avatar !== null) this.boardView?.claimMark(cell, AVATAR_GLYPH[avatar], byMe);
    if (!byMe) return;

    /*
      Pixel spesial punya bunyinya sendiri, sama seperti di solo.

      Sebelumnya ketiganya memainkan `correct()` yang sama: mengambil ♥ di
      multiplayer tidak terdengar berbeda dari mengetuk pixel biasa, padahal
      di solo ia punya arpeggio sendiri. Pemain yang bermain di kedua mode akan
      mengira nyawanya tidak bertambah — dan sejak nyawa jadi milik REGU, itu
      justru informasi yang paling perlu didengar.
    */
    if (kind === 'life') this.options.sfx.life();
    else if (kind === 'gold') this.options.sfx.gold();
    else this.options.sfx.correct(combo);

    // Popup combo HANYA untuk combo sendiri. Combo lawan tidak boleh menutupi
    // papanmu — itu hukuman untuk pemain yang sedang tertinggal.
    if (isComboMilestone(combo)) this.boardView?.comboPopup(combo);
  }

  /** Nyawa habis — dibekukan, tapi akan kembali. */
  knockedOut(): void {
    this.options.sfx.knockedOut();
    this.cameras.main.flash(200, 228, 59, 68);
  }

  /** Keluar dari permainan untuk selamanya. */
  eliminated(): void {
    this.options.sfx.eliminated();
  }

  /** Match usai. Bunyinya berbeda antara menang dan kalah. */
  matchEnd(won: boolean): void {
    this.options.sfx.matchEnd(won);
  }

  rejected(reason: 'wrongColor' | 'tooLate' | 'notFound' | 'rateLimited' | 'notRunning'): void {
    // `notFound` berarti pixelnya sudah direbut orang lain — itu bukan kesalahan
    // pemain, jadi tidak ada efek apa pun.
    if (reason !== 'wrongColor') return;
    // Jeda singkat setelah salah warna. Tanpa ini, cara main paling efektif
    // adalah menggeprek layar sembarangan: penalti skornya kecil, sementara
    // peluang menyerobot pixel jadi jauh lebih besar.
    this.cooldownUntil = Date.now() + MP_WRONG_CLICK_COOLDOWN_MS;
    this.options.sfx.wrong();
    this.cameras.main.shake(140, 0.008);
  }

  bomb(pixelId: string, byMe: boolean): void {
    this.pixels.delete(pixelId);
    this.boardView?.remove(pixelId, 'pop');
    if (!byMe) return;
    this.options.sfx.bomb();
    this.cameras.main.shake(260, 0.016);
    this.cameras.main.flash(160, 228, 59, 68);
  }

  /**
   * Ganti SELURUH isi papan dengan kumpulan pixel ini.
   *
   * Dipakai dua hal yang kelihatan berbeda tapi operasinya sama: modifier chaos
   * `shuffle` yang mengacak posisi, dan resync saat pemain kembali di tengah
   * match. Keduanya sama-sama berarti "lupakan yang sekarang ada di papan,
   * inilah keadaan yang benar".
   */

  /**
   * Spanduk naik level; dipanggil MatchView saat tick membawa level baru.
   *
   * Bunyinya dipicu DI SINI, bukan di MatchView. Solo memicunya dari event
   * `levelUp` engine, dan multiplayer tidak punya event itu — levelnya datang
   * lewat tick. Akibatnya naik level di MP sempat sepenuhnya bisu: animasinya
   * jalan, bunyinya tidak. Menaruhnya di satu tempat bersama animasinya membuat
   * keduanya tidak mungkin terpisah lagi.
   */
  levelBanner(level: number): void {
    this.boardView?.levelCelebration(level);
    this.options.sfx.levelUp();
  }

  /** Denyut papan saat warna target berganti. */
  targetPulse(): void {
    this.boardView?.targetPulse();
  }

  replaceBoard(pixels: readonly Pixel[]): void {
    this.pixels.clear();
    for (const pixel of pixels)
      this.pixels.set(pixel.id, { ...pixel, spawnedAtMs: this.elapsedMs });
    this.boardView?.redraw([...this.pixels.values()], chaosHidesGlyphs(this.chaos));
  }

  shuffle(pixels: readonly Pixel[]): void {
    this.replaceBoard(pixels);
  }

  // ---------------------------------------------------------------- internal

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.interactive || this.frozen || Date.now() < this.cooldownUntil) return;

    const cell = this.boardView?.cellAt(pointer.x, pointer.y);
    if (!cell) return;

    const pixel = [...this.pixels.values()].find(
      (candidate) => candidate.cell.row === cell.row && candidate.cell.col === cell.col,
    );
    // Tap di sel kosong tidak dikirim ke server sama sekali — tidak ada yang
    // perlu diputuskan, dan itu menghemat pesan di jaringan seluler.
    if (!pixel) return;

    this.options.onTapPixel(pixel.id);
  }
}
