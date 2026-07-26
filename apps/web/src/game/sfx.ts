type AudioContextConstructor = new () => AudioContext;

/** Safari lama hanya punya `webkitAudioContext`. */
interface AudioCapableWindow {
  AudioContext?: AudioContextConstructor;
  webkitAudioContext?: AudioContextConstructor;
}

/**
 * Efek suara chiptune sederhana lewat WebAudio — tanpa file aset sama sekali,
 * jadi tidak menambah beban unduhan awal (NFR: load < 3 detik, penting di
 * jaringan seluler).
 */
export class Sfx {
  private context: AudioContext | null = null;
  private muted = false;

  /**
   * Wajib dipanggil dari dalam gesture pemain: browser HP (terutama iOS
   * Safari) menolak membuat/melanjutkan AudioContext di luar interaksi.
   */
  unlock(): void {
    if (this.context === null) {
      const scope = window as unknown as AudioCapableWindow;
      const Ctor: AudioContextConstructor | undefined =
        scope.AudioContext ?? scope.webkitAudioContext;
      if (!Ctor) return;
      this.context = new Ctor();
    }
    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
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
    navigator.vibrate?.(40);
  }

  gameOver(): void {
    this.tone(420, 0.14, 'square', 0.09, 0);
    this.tone(320, 0.14, 'square', 0.09, 0.14);
    this.tone(200, 0.3, 'square', 0.09, 0.28);
  }

  dispose(): void {
    void this.context?.close();
    this.context = null;
  }

  private tone(
    frequency: number,
    durationSec: number,
    type: OscillatorType,
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
