import type {
  BentukGelombang,
  KonteksAudio,
  NodeFilter,
  NodeGain,
  PembuatKonteks,
  PembuatPengulang,
} from './tipe';

/**
 * Musik latar yang disintesis, bukan file audio.
 *
 * Kenapa disintesis — tiga alasan, dan yang pertama yang menentukan:
 *
 * 1. NFR muat halaman SUDAH terlampaui (~3482 ms vs target 3 dtk, lihat
 *    docs/PERFORMANCE.md). Menambah beberapa megabyte audio memperburuk angka
 *    yang sudah merah, di jaringan yang justru paling sering dipakai pemain.
 * 2. Yang diminta adalah parameter BERKELANJUTAN: makin dekat kemenangan, makin
 *    tegang. Crossfade antar-stem yang sudah jadi tetap terdengar berpindah;
 *    tempo dan filter yang digeser mulus tidak.
 * 3. Seluruh SFX game ini sudah disintesis tanpa satu file aset pun. Menambah
 *    pipeline aset hanya untuk musik berarti dua cara berbeda menghasilkan
 *    bunyi di satu game.
 *
 * Yang dikorbankan, dan ini nyata: ini BUKAN lagu yang akan nempel di kepala.
 * Yang dihasilkan adalah bed arpeggio yang menghanyutkan dan bisa berubah
 * tegang — bukan komposisi.
 */

/**
 * Tangga nada: C MAYOR pentatonik.
 *
 * Diganti dari A minor pentatonik, dan inilah perubahan yang paling menentukan.
 * Pemain melaporkan musiknya terdengar menegangkan alih-alih ceria, dan
 * penyebabnya bukan tempo atau timbre — melainkan kuncinya. Minor terdengar
 * murung menurut definisinya; riset musik game kasual sepakat pada satu hal
 * yang sama: mayor untuk ceria.
 *
 * Pentatonik mayor dipilih di antara tangga nada mayar lainnya karena ia tidak
 * punya jarak setengah nada sama sekali — tidak ada dua nada di dalamnya yang
 * bisa berbunyi bersamaan dan terdengar bertabrakan. Itu sifat yang membuatnya
 * jadi tangga nada baku musik anak di mana-mana, dan yang membuat arpeggio acak
 * pun tetap enak didengar.
 *
 * Rentangnya C5–E6, wilayah marimba dan kalimba — cerah tanpa melengking.
 */
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];

/**
 * Bass: progresi I–V–vi–IV (C–G–Am–F).
 *
 * Empat akor yang menopang kira-kira separuh lagu pop yang pernah ada, dan
 * alasannya bukan kebetulan: ia bergerak pulang ke akarnya di setiap putaran,
 * jadi ia terdengar "menyelesaikan diri" berulang-ulang. Itu yang membuat loop
 * pendek tidak terasa memutar hal yang sama, melainkan bernapas.
 */
const BASS = [130.81, 98.0, 110.0, 87.31];

/**
 * 116 BPM saat ceria — di dalam rentang 110–130 yang dipakai musik game kasual,
 * dan tepat di sekitar 110–114 yang lazim untuk musik anak yang riang.
 */
const BPM_CALM = 116;
const BPM_TENSE = 148;

/**
 * Cutoff lowpass.
 *
 * Yang tenang dulu 900 Hz — dan itu bukan "lembut", itu TERTUTUP. Nada yang
 * dipotong di 900 Hz kehilangan hampir seluruh kilaunya dan terdengar redup,
 * jauh, dan murung. Keadaan ceria harus terdengar TERBUKA; yang membedakannya
 * dari keadaan tegang adalah tempo, lapisan, dan warna nada — bukan seberapa
 * banyak suaranya diredam.
 */
const CUTOFF_CALM = 3200;
const CUTOFF_TENSE = 6400;

/** Lapisan mendesak baru masuk setelah ambang ini. */
const TENSE_FROM = 0.45;

/**
 * Gain saat volume disetel penuh.
 *
 * Bukan 1.0: musik ini latar, dan SFX-lah yang membawa informasi permainan
 * (klik benar, bom, nyawa). Plafon ini menjaga agar volume maksimum pun tidak
 * menenggelamkan bunyi yang justru perlu didengar.
 *
 * Versi pertama memakai gain tetap 0.12 tanpa pengaturan apa pun, dan pemain
 * melaporkannya terlalu pelan. 0.12 sekarang jadi kira-kira posisi 0.24 di
 * slider — masih bisa dipilih, tapi bukan lagi satu-satunya pilihan.
 */
const MAX_GAIN = 0.5;

/** Volume awal sebelum pemain menyetelnya. */
export const DEFAULT_MUSIC_VOLUME = 0.6;

/**
 * Penjadwalan dilakukan di depan, bukan satu-per-satu lewat setTimeout.
 *
 * Ini pola "dua jam" yang baku di Web Audio: timer JavaScript tidak akurat dan
 * ikut tersendat kalau tab sibuk, sedangkan jam AudioContext berjalan mulus di
 * thread audio. Jadi timer hanya dipakai untuk bertanya "ada nada yang jatuh
 * dalam 120 ms ke depan?", dan penjadwalan sesungguhnya memakai waktu audio.
 * Tanpa ini, ketukan akan goyah persis saat papan paling ramai.
 */
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.12;

export interface OpsiMusic {
  readonly buatKonteks: PembuatKonteks;
  readonly buatPengulang: PembuatPengulang;
}

export class Music {
  private context: KonteksAudio | null = null;
  private master: NodeGain | null = null;
  private filter: NodeFilter | null = null;
  /** Cara menghentikan pengulang yang sedang jalan; `null` kalau tidak jalan. */
  private hentikanPengulang: (() => void) | null = null;

  /** Waktu audio nada berikutnya dijadwalkan. */
  private nextNoteAt = 0;
  private step = 0;
  private intensity = 0;
  private muted = false;
  private running = false;
  private volume = DEFAULT_MUSIC_VOLUME;

  /** Dipanggil dari gestur pemain — tanpa itu browser menolak memulai audio. */
  constructor(private readonly opsi: OpsiMusic) {}

  start(): void {
    if (this.running) return;

    if (this.context === null) {
      this.context = this.opsi.buatKonteks();
      if (this.context === null) return;

      this.filter = this.context.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = CUTOFF_CALM;
      this.filter.Q.value = 1.2;

      this.master = this.context.createGain();
      this.master.gain.value = this.targetGain();

      this.filter.connect(this.master);
      this.master.connect(this.context.destination);
    }

    void this.context.resume();
    this.running = true;
    this.nextNoteAt = this.context.currentTime + 0.05;
    this.hentikanPengulang = this.opsi.buatPengulang(() => this.schedule(), LOOKAHEAD_MS);
  }

  stop(): void {
    this.running = false;
    if (this.hentikanPengulang !== null) {
      this.hentikanPengulang();
      this.hentikanPengulang = null;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyGain();
  }

  /** Volume 0..1 dari pengaturan pemain. */
  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    this.applyGain();
  }

  private targetGain(): number {
    return this.muted ? 0 : this.volume * MAX_GAIN;
  }

  private applyGain(): void {
    if (!this.master || !this.context) return;
    // Digeser mulus, bukan dipotong: perubahan gain mendadak terdengar sebagai
    // "klik" di sebagian perangkat, dan slider yang digeser cepat akan
    // menghasilkan deretan klik itu.
    this.master.gain.setTargetAtTime(this.targetGain(), this.context.currentTime, 0.05);
  }

  /**
   * Setel ketegangan 0..1. Aman dipanggil sesering apa pun.
   *
   * Filter digeser lewat `setTargetAtTime`, bukan ditulis langsung: nilai yang
   * melompat pada filter terdengar sebagai bunyi "zip". Tempo tidak perlu
   * diperhalus karena ia hanya dibaca saat menjadwalkan nada berikutnya.
   */
  setIntensity(value: number): void {
    this.intensity = Math.min(1, Math.max(0, value));
    if (this.filter && this.context) {
      const cutoff = CUTOFF_CALM + (CUTOFF_TENSE - CUTOFF_CALM) * this.intensity;
      this.filter.frequency.setTargetAtTime(cutoff, this.context.currentTime, 0.3);
    }
  }

  dispose(): void {
    this.stop();
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.filter = null;
  }

  // ----------------------------------------------------------------- internal

  private schedule(): void {
    const context = this.context;
    if (!context || !this.running) return;

    const beatSeconds = 60 / (BPM_CALM + (BPM_TENSE - BPM_CALM) * this.intensity);
    // Satu langkah = seperdelapan ketukan.
    const stepSeconds = beatSeconds / 2;

    while (this.nextNoteAt < context.currentTime + SCHEDULE_AHEAD_S) {
      this.playStep(this.nextNoteAt);
      this.nextNoteAt += stepSeconds;
      this.step = (this.step + 1) % 16;
    }
  }

  /**
   * Pola melodi 16 langkah.
   *
   * Ditulis sebagai INDEKS ke tangga nada, bukan diambil berurutan (`step %
   * 8`). Menyusuri tangga nada dari bawah ke atas berulang-ulang terdengar
   * seperti latihan jari, bukan lagu — naik, naik, naik, ulang. Pola ini
   * naik-turun dengan lompatan kecil, bentuk yang membuat telinga mengenalinya
   * sebagai melodi meski nadanya sedikit.
   *
   * `-1` berarti diam. Jeda itu yang memberi melodinya bentuk; deretan nada
   * tanpa satu pun jeda terdengar sebagai arus, bukan frasa.
   */
  private static readonly MELODY = [0, 2, 4, 2, 3, -1, 2, 0, 1, 3, 5, 3, 2, -1, 1, 0];

  private playStep(at: number): void {
    const step = this.step;
    const tense = Math.max(0, (this.intensity - TENSE_FROM) / (1 - TENSE_FROM));

    // Bass di ketukan kuat — fondasi yang membuat sisanya terasa punya tempo.
    if (step % 4 === 0) {
      this.tone(BASS[(step / 4) % BASS.length]!, at, 0.3, 'triangle', 0.5);
    }

    /*
      Melodi bertimbre MARIMBA, bukan gelombang kotak.

      Gelombang kotak itu bunyi chiptune, dan chiptune terdengar tajam dan
      elektronik — nada yang sama akan terdengar mendesak berapa pun kuncinya.
      Riset musik game kasual menyebut satu keluarga instrumen yang sama
      berulang-ulang: marimba, xylophone, pizzicato, ukulele. Semuanya
      DIPUKUL ATAU DIPETIK: serangan sangat cepat lalu peluruhan pendek, tanpa
      nada yang ditahan.

      Itu yang ditiru di sini — gelombang segitiga (lembut, sedikit harmonik)
      dengan peluruhan pendek. Nada kedua satu oktaf di atas dengan volume
      seperlima menirukan "denting" kayu yang dipukul; tanpanya segitiga polos
      terdengar seperti seruling, bukan marimba.
    */
    const nada = Music.MELODY[step % Music.MELODY.length]!;
    if (nada >= 0) {
      const freq = SCALE[nada % SCALE.length]!;
      this.tone(freq, at, 0.34, 'triangle', 0.22);
      this.tone(freq * 2, at, 0.1, 'sine', 0.045);
    }

    /*
      Iringan berdenting di sela-sela melodi, hanya saat CERIA.

      Ia yang mengisi ruang supaya keadaan ceria tidak terdengar kosong — dan
      ia menghilang justru saat keadaan menegang, menyisakan tempat untuk
      lapisan mendesak di bawah. Jadi bedanya tenang dan tegang bukan sekadar
      "lebih keras", melainkan bunyi yang berbeda isinya.
    */
    if (this.intensity < TENSE_FROM && step % 4 === 2) {
      this.tone(SCALE[(step / 2) % SCALE.length]! * 2, at, 0.14, 'sine', 0.05);
    }

    /*
      Lapisan babak akhir: denyut rendah di setiap ketukan.

      Bukan sekadar musik yang sama dimainkan lebih cepat — ada bunyi BARU yang
      masuk, dan itu yang membuat pemain menoleh. Nada rendah berulang di
      tempo ketukan terbaca sebagai detak: tubuh mengenalinya sebagai hitungan
      mundur tanpa perlu ada yang menjelaskan.
    */
    if (tense > 0 && step % 2 === 0) {
      this.tone(BASS[0]! / 2, at, 0.12, 'square', 0.05 + tense * 0.1);
    }

    // Perkusi menyusul di ketegangan penuh.
    if (tense > 0.35 && step % 2 === 1) {
      this.noise(at, 0.045, 0.04 + tense * 0.1);
    }
  }

  private tone(
    frequency: number,
    at: number,
    duration: number,
    type: BentukGelombang,
    gain: number,
  ): void {
    const context = this.context;
    const filter = this.filter;
    if (!context || !filter) return;

    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;

    const envelope = context.createGain();
    // Serangan sangat pendek lalu peluruhan eksponensial: itu yang membuat nada
    // terdengar "dipetik" alih-alih seperti sirene yang dinyalakan-dimatikan.
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(gain, at + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);

    osc.connect(envelope);
    envelope.connect(filter);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  private noise(at: number, duration: number, gain: number): void {
    const context = this.context;
    const filter = this.filter;
    if (!context || !filter) return;

    const frames = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frames; index += 1) data[index] = Math.random() * 2 - 1;

    const source = context.createBufferSource();
    source.buffer = buffer;

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(gain, at);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);

    source.connect(envelope);
    envelope.connect(filter);
    source.start(at);
  }
}
