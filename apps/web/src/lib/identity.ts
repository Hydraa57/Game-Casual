const GUEST_KEY = 'pm.playAsGuest.v1';

/**
 * Pilihan "main sebagai guest" disimpan lokal.
 *
 * Diingat, bukan ditanyakan tiap kunjungan: gerbang identitas ada supaya
 * pilihannya SADAR sekali, bukan supaya jadi penghalang berulang. Teman yang
 * membuka link undangan cukup memilih sekali, lalu langsung masuk lobby di
 * kunjungan berikutnya.
 */
export function readGuestChoice(): boolean {
  try {
    return window.localStorage.getItem(GUEST_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeGuestChoice(chosen: boolean): void {
  try {
    if (chosen) window.localStorage.setItem(GUEST_KEY, '1');
    else window.localStorage.removeItem(GUEST_KEY);
  } catch {
    // Browser yang memblokir storage: pemain akan ditanya lagi nanti. Bukan
    // alasan untuk menghentikan permainan.
  }
}
