const STORAGE_KEY = 'pm.muted.v1';

/**
 * Preferensi bunyi dipakai bersama solo dan multiplayer.
 *
 * Sebelumnya mute hanya state komponen, jadi pemain yang mematikan bunyi di
 * solo tetap mendapat suara penuh begitu masuk multiplayer. Untuk game yang
 * dimainkan di tempat umum, itu justru momen paling salah untuk berbunyi.
 */
export function readMuted(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  } catch {
    // Tidak apa-apa — preferensinya cuma tidak bertahan sampai kunjungan berikutnya.
  }
}
