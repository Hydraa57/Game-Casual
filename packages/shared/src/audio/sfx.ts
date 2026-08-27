import type { BentukGelombang, KonteksAudio, PembuatKonteks, Penggetar } from './tipe';

export interface OpsiSfx {
  readonly buatKonteks: PembuatKonteks;
  /** Boleh dikosongkan — platform tanpa getar cukup tidak mengisinya. */
  readonly getar?: Penggetar;
}

/**
 * Efek suara chiptune sederhana lewat Web Audio — **tanpa satu pun file aset**,
 * jadi tidak menambah beban unduhan awal (NFR: load < 3 detik, penting di
 * jaringan seluler) dan tidak menambah ukuran APK.
 *
 * Ada di paket bersama, bukan di salah satu klien, karena setiap angka di
 * bawah ini adalah keputusan yang sudah ditala lewat playtest: frekuensi tiap
 * nada, panjang peluruhannya, dan urutan arpeggio yang membedakan "dapat
 * nyawa" dari "naik level". Menyalinnya ke sisi Android berarti dua game yang
 * lama-lama berbeda bunyinya.
 *
 * Konteks audionya DISUNTIK: web memberi `window.AudioContext`, Android memberi
 * `AudioContext` dari `react-native-audio-api`. Keduanya mengikuti spesifikasi
 * yang sama, dan berkas ini tidak perlu tahu bedanya.
 */
export class Sfx {
  private context: KonteksAudio | null = null;
  private muted = false;

  constructor(private readonly opsi: OpsiSfx) {}

  /**
   * Wajib dipanggil dari dalam gesture pemain: browser HP (terutama iOS
   * Safari) menolak membuat/melanjutkan AudioContext di luar interaksi.
   */
  unlock(): void {
    if (this.context === null) {
      this.context = this.opsi.buatKonteks();
      if (this.context === null) return;
    }
    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
  }

  private getar(pola: number | readonly number[]): void {
    // Getar ikut dimatikan bersama bunyi: keduanya adalah "umpan balik yang
    // mengganggu orang di sekitar", dan pemain yang mematikan suara di tempat
    // umum hampir selalu memaksudkan keduanya.
    if (this.muted) return;
    this.opsi.getar?.(pola);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  /** Nada naik seiring combo, jadi rentetan panjang terasa makin memuaskan. */
  correct(combo: number): void {
    const step = Math.min(Math.floor(combo / 5), 4);
    this.tone(600 + step * 140, 0.09, 'square', 0.09);
  }

  wrong(): void {
    this.tone(150, 0.22, 'sawtooth', 0.1);
    // Getar singkat: di HP ini feedback paling jelas tanpa harus melihat HUD.
    this.getar(40);
  }

  /** Bom: lebih rendah, lebih panjang, dan getar lebih panjang dari klik salah. */
  bomb(): void {
    this.tone(90, 0.32, 'sawtooth', 0.13);
    this.tone(60, 0.32, 'square', 0.09, 0.04);
    this.getar([50, 40, 90]);
  }

  /** Nyawa: arpeggio naik supaya terasa jelas sebagai hadiah. */
  life(): void {
    this.tone(660, 0.1, 'triangle', 0.09, 0);
    this.tone(880, 0.1, 'triangle', 0.09, 0.08);
    this.tone(1180, 0.16, 'triangle', 0.09, 0.16);
  }

  /**
   * Naik level: fanfare pendek, bukan sekadar arpeggio.
   *
   * Versi pertama tiga nada `triangle` pelan (0,07) — praktis tidak terdengar
   * di atas musik latar dan bunyi klik, padahal ini satu-satunya momen di mana
   * permainan berubah. Sekarang tiga hal ditumpuk supaya jelas terdengar
   * sebagai PERISTIWA:
   *
   * 1. Arpeggio naik `square` yang lebih keras dan lebih lebar rentangnya.
   * 2. Nada kelima di bawahnya, jadi akordnya terdengar penuh, bukan kurus.
   * 3. Ekor berkilau dua nada tinggi — bagian yang membuatnya terbaca sebagai
   *    "hadiah", bukan sekadar "pemberitahuan".
   *
   * Tetap dijaga BEDA dari `life()`: keduanya kabar baik, tapi tertukar berarti
   * pemain mengira nyawanya bertambah padahal kesulitannya yang naik.
   */
  levelUp(): void {
    this.tone(523, 0.12, 'square', 0.11, 0);
    this.tone(659, 0.12, 'square', 0.11, 0.08);
    this.tone(784, 0.14, 'square', 0.12, 0.16);
    this.tone(1046, 0.34, 'square', 0.13, 0.24);
    // Nada bawah yang menopang akordnya.
    this.tone(261, 0.4, 'triangle', 0.09, 0.24);
    // Ekor berkilau.
    this.tone(1568, 0.18, 'triangle', 0.06, 0.34);
    this.tone(2093, 0.22, 'triangle', 0.05, 0.42);
    // Getar sangat singkat: di HP inilah yang paling sulit dilewatkan, dan
    // naik level adalah satu-satunya kabar baik yang layak menggetarkan.
    this.getar(25);
  }

  /**
   * Pixel emas: berkilau, dan jelas BUKAN sekadar klik benar yang lebih keras.
   *
   * Sebelumnya emas tidak punya bunyinya sendiri sama sekali — ia hanya
   * memainkan `correct()` seperti pixel biasa, padahal nilainya lima kali
   * lipat. Momen paling menguntungkan di seluruh permainan terdengar persis
   * seperti momen yang paling biasa.
   */
  gold(): void {
    this.tone(1046, 0.09, 'triangle', 0.1, 0);
    this.tone(1318, 0.09, 'triangle', 0.1, 0.05);
    this.tone(1568, 0.1, 'triangle', 0.11, 0.1);
    this.tone(2093, 0.26, 'sine', 0.09, 0.15);
  }

  gameOver(): void {
    this.tone(420, 0.14, 'square', 0.09, 0);
    this.tone(320, 0.14, 'square', 0.09, 0.14);
    this.tone(200, 0.3, 'square', 0.09, 0.28);
  }

  /**
   * Nyawa habis di multiplayer — dibekukan, tapi belum keluar.
   *
   * Dibedakan dari `gameOver()`: yang ini turun lalu BERHENTI menggantung
   * alih-alih jatuh sampai dasar, karena pemain memang akan kembali beberapa
   * detik lagi. Bunyi yang terdengar final untuk keadaan yang tidak final
   * membuat orang mengira rondenya sudah habis.
   */
  knockedOut(): void {
    this.tone(392, 0.16, 'square', 0.1, 0);
    this.tone(294, 0.3, 'square', 0.1, 0.14);
    this.getar([60, 50, 60]);
  }

  /** Tereliminasi: jatuh sampai dasar, dan tidak ada yang menyusul. */
  eliminated(): void {
    this.tone(392, 0.14, 'sawtooth', 0.1, 0);
    this.tone(294, 0.14, 'sawtooth', 0.1, 0.14);
    this.tone(196, 0.16, 'sawtooth', 0.1, 0.28);
    this.tone(131, 0.5, 'triangle', 0.11, 0.42);
    this.getar([90, 60, 140]);
  }

  /**
   * Match selesai. `won` menentukan arahnya, dan itu satu-satunya hal yang
   * benar-benar ingin diketahui pemain di milidetik pertama layar hasil.
   */
  matchEnd(won: boolean): void {
    if (won) {
      // Fanfare naik, akor mayor — sama keluarga bunyinya dengan naik level,
      // tapi lebih panjang dan lebih penuh supaya tidak tertukar.
      this.tone(523, 0.12, 'square', 0.11, 0);
      this.tone(659, 0.12, 'square', 0.11, 0.1);
      this.tone(784, 0.12, 'square', 0.12, 0.2);
      this.tone(1046, 0.5, 'square', 0.13, 0.3);
      this.tone(659, 0.5, 'triangle', 0.08, 0.3);
      this.tone(392, 0.55, 'triangle', 0.09, 0.3);
      this.getar([40, 60, 40, 60, 90]);
      return;
    }
    // Kalah: turun, tapi tetap hangat (segitiga, bukan gergaji). Ini game
    // santai yang dimainkan bareng teman — kekalahan tidak perlu terdengar
    // seperti hukuman.
    this.tone(587, 0.16, 'triangle', 0.1, 0);
    this.tone(494, 0.16, 'triangle', 0.1, 0.15);
    this.tone(392, 0.45, 'triangle', 0.1, 0.3);
  }

  dispose(): void {
    void this.context?.close();
    this.context = null;
  }

  private tone(
    frequency: number,
    durationSec: number,
    type: BentukGelombang,
    volume: number,
    delaySec = 0,
  ): void {
    if (this.muted || this.context === null) return;

    const context = this.context;
    const startAt = context.currentTime + delaySec;

    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(volume, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + durationSec + 0.02);
  }
}
