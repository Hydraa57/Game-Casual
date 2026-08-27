/**
 * Bentuk minimal Web Audio API yang dibutuhkan game ini.
 *
 * **Kenapa antarmuka sendiri, bukan tipe `AudioContext` bawaan DOM.** Paket ini
 * dipakai tiga tempat: klien web (punya DOM), aplikasi Android (tidak punya
 * DOM, memakai `react-native-audio-api`), dan game server (tidak punya audio
 * sama sekali). Menyebut tipe DOM di sini akan memaksa `lib: ["DOM"]` masuk ke
 * paket yang juga dikompilasi untuk Node.
 *
 * Yang lebih berguna: antarmuka ini menuliskan dengan tepat SEBERAPA SEDIKIT
 * yang dipakai. Kalau suatu saat mesin audio di salah satu platform tidak
 * mendukung salah satunya, yang tidak didukung terlihat di sini — bukan
 * ditemukan sebagai bunyi yang diam-diam hilang di HP.
 */

export type BentukGelombang = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface ParamAudio {
  value: number;
  setValueAtTime(nilai: number, waktu: number): void;
  linearRampToValueAtTime(nilai: number, waktu: number): void;
  exponentialRampToValueAtTime(nilai: number, waktu: number): void;
  setTargetAtTime(nilai: number, waktu: number, konstantaWaktu: number): void;
}

export interface NodeAudio {
  connect(tujuan: NodeAudio): NodeAudio;
}

export interface NodeGain extends NodeAudio {
  readonly gain: ParamAudio;
}

export interface NodeOsilator extends NodeAudio {
  type: BentukGelombang;
  readonly frequency: ParamAudio;
  start(waktu: number): void;
  stop(waktu: number): void;
}

export interface NodeFilter extends NodeAudio {
  type: string;
  readonly frequency: ParamAudio;
  readonly Q: ParamAudio;
}

export interface BufferAudio {
  getChannelData(kanal: number): Float32Array;
}

export interface NodeSumberBuffer extends NodeAudio {
  buffer: BufferAudio | null;
  start(waktu: number): void;
}

export interface KonteksAudio {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly destination: NodeAudio;
  readonly state: string;
  createOscillator(): NodeOsilator;
  createGain(): NodeGain;
  createBiquadFilter(): NodeFilter;
  createBuffer(kanal: number, panjang: number, sampleRate: number): BufferAudio;
  createBufferSource(): NodeSumberBuffer;
  resume(): unknown;
  close(): unknown;
}

/**
 * Membuat konteks audio, atau `null` kalau platformnya tidak bisa.
 *
 * Web mengembalikan `null` di peramban lama yang tidak punya `AudioContext`
 * sama sekali; permainannya tetap jalan, cuma tanpa bunyi.
 */
export type PembuatKonteks = () => KonteksAudio | null;

/**
 * Menjalankan `panggil` tiap `jedaMs`, dan mengembalikan cara menghentikannya.
 *
 * Disuntik, bukan memanggil `setInterval` langsung: paket ini tidak memuat
 * tipe DOM maupun Node, dan penjadwal di kedua platform tidak sama tipe
 * kembaliannya (`number` di peramban, objek Timeout di React Native).
 */
export type PembuatPengulang = (panggil: () => void, jedaMs: number) => () => void;

/**
 * Menggetarkan perangkat.
 *
 * Satu angka = getar selama itu. Array = **diawali lama GETAR**, lalu diam,
 * lalu getar, bergantian — konvensi `navigator.vibrate` di web.
 *
 * **Konvensi ini harus disebut karena React Native memakai yang BERLAWANAN:**
 * di sana array diawali lama DIAM. Pola yang sama diteruskan apa adanya ke
 * keduanya akan bergeser satu langkah — getaran pertamanya hilang dan yang
 * terdengar justru jeda-jedanya. Yang menyesuaikan adalah adaptor di sisi
 * Android, bukan angka-angka di sini: angka-angka itu sudah ditala lewat
 * playtest dan tidak boleh berubah artinya tergantung platform.
 *
 * Platform yang tidak punya getar cukup mengabaikannya.
 */
export type Penggetar = (pola: number | readonly number[]) => void;
