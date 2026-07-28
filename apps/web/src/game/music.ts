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

/** Nada dasar tangga nada minor pentatonik (A minor), dalam Hz. */
const SCALE = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33];

/** Bass mengikuti akar yang sama, satu oktaf di bawah. */
const BASS = [110.0, 130.81, 146.83, 164.81];

const BPM_CALM = 96;
const BPM_TENSE = 152;

/** Cutoff lowpass: tertutup terdengar jauh dan lembut, terbuka terdengar mendesak. */
const CUTOFF_CALM = 900;
const CUTOFF_TENSE = 5200;

/** Perkusi baru ikut masuk setelah ambang ini — supaya ada yang tersisa untuk naik. */
const PERCUSSION_FROM = 0.45;

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

interface AudioWindow {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

export class Music {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private timer: number | null = null;

  /** Waktu audio nada berikutnya dijadwalkan. */
  private nextNoteAt = 0;
  private step = 0;
  private intensity = 0;
  private muted = false;
  private running = false;
  private volume = DEFAULT_MUSIC_VOLUME;

  /** Dipanggil dari gestur pemain — tanpa itu browser menolak memulai audio. */
  start(): void {
    if (this.running) return;

    const globals = window as unknown as AudioWindow;
    const Ctor = globals.AudioContext ?? globals.webkitAudioContext;
    if (!Ctor) return;

    if (this.context === null) {
      this.context = new Ctor();

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
    this.timer = window.setInterval(() => this.schedule(), LOOKAHEAD_MS);
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
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

  private playStep(at: number): void {
    const step = this.step;

    // Bass di ketukan kuat — fondasi yang membuat sisanya terasa punya tempo.
    if (step % 4 === 0) {
      this.tone(BASS[(step / 4) % BASS.length]!, at, 0.26, 'triangle', 0.5);
    }

    /**
     * Arpeggio berbunyi di SETIAP langkah, termasuk saat tenang.
     *
     * Percobaan pertama melewati separuh langkah di ketegangan rendah, dengan
     * niat menyisakan ruang untuk dipadatkan nanti. Hasilnya justru melawan
     * alasan musik ini ada: keadaan tenang jadi terdengar kosong, dan "kosong"
     * persis keluhan yang mau diobati.
     *
     * Yang membedakan tenang dari tegang sekarang bukan jumlah nada melainkan
     * VOLUME dan cutoff filter — nada yang sama terdengar jauh dan lembut saat
     * filter tertutup, lalu maju dan mendesak saat ia terbuka. Kepadatan tetap
     * punya perannya, tapi lewat lapisan perkusi di bawah.
     */
    const index = step % SCALE.length;
    this.tone(SCALE[index]!, at, 0.12, 'square', 0.13 + this.intensity * 0.17);

    // Perkusi hanya muncul setelah ambang: kalau ia ada sejak awal, tidak ada
    // lagi lapisan baru yang bisa ditambahkan saat keadaan memanas.
    if (this.intensity >= PERCUSSION_FROM && step % 2 === 1) {
      this.noise(at, 0.045, 0.05 + (this.intensity - PERCUSSION_FROM) * 0.12);
    }
  }

  private tone(
    frequency: number,
    at: number,
    duration: number,
    type: OscillatorType,
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
