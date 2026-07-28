/**
 * Umur proses server: mematikan diri dengan rapi, dan bertahan dari kesalahan
 * yang tidak terduga.
 *
 * Ini bukan kelengkapan teoretis. Render me-restart service ini setiap kali ada
 * push, dan sebelum ini tidak ada satu pun penanganan SIGTERM: interval game
 * loop terus berjalan, proses tidak pernah keluar sendiri, dan host akhirnya
 * membunuhnya dengan SIGKILL. Pemain yang sedang main melihat koneksi mati
 * begitu saja tanpa penjelasan.
 */

export interface ShutdownTargets {
  /** Hentikan semua interval match yang sedang jalan. */
  readonly stopMatches: () => void;
  /** Beri tahu semua client sebelum koneksinya diputus. */
  readonly notifyClients: () => void;
  /** Tutup server Socket.IO dan HTTP-nya. */
  readonly closeServers: () => Promise<void>;
}

/**
 * Batas waktu menutup dengan rapi.
 *
 * Render memberi 30 detik sebelum SIGKILL. Angka ini di bawahnya supaya
 * penutupan kita yang selesai duluan, bukan dipotong di tengah jalan.
 */
export const SHUTDOWN_TIMEOUT_MS = 10_000;

/**
 * Bungkus urutan penutupan supaya bisa diuji tanpa proses sungguhan.
 *
 * Mengembalikan fungsi yang aman dipanggil berkali-kali: SIGTERM dan SIGINT
 * bisa datang beruntun, dan menjalankan urutan ini dua kali akan menutup server
 * yang sudah tertutup lalu melempar di tengah proses keluar.
 */
export function createShutdown(targets: ShutdownTargets): () => Promise<void> {
  let started = false;

  return async () => {
    if (started) return;
    started = true;

    // Urutannya penting. Client diberi tahu SELAGI koneksinya masih hidup —
    // setelah server ditutup tidak ada lagi jalan untuk mengabarkan apa pun,
    // dan pemain cuma melihat "server tidak terjangkau".
    targets.notifyClients();
    targets.stopMatches();

    await Promise.race([
      targets.closeServers(),
      new Promise<void>((resolve) => setTimeout(resolve, SHUTDOWN_TIMEOUT_MS)),
    ]);
  };
}

/**
 * Jangan biarkan satu kesalahan tak tertangani membunuh seluruh server.
 *
 * Satu proses melayani SEMUA room. Tanpa ini, satu exception di jalur mana pun
 * mengakhiri setiap match yang sedang berjalan di server itu — bukan hanya
 * milik pemain yang memicunya.
 *
 * `uncaughtException` sengaja TIDAK membuat proses keluar. Panduan Node
 * menyarankan keluar karena state-nya dianggap tidak menentu, dan itu benar
 * untuk proses yang memegang transaksi. Server ini memegang papan permainan di
 * memori: mengakhiri proses menjamin semua orang kehilangan match-nya,
 * sementara melanjutkan hanya BERISIKO satu room jadi aneh. Untuk game hobi,
 * risiko itu jelas lebih murah daripada kepastian itu.
 */
export function guardProcess(log: (message: string, error: unknown) => void): void {
  process.on('uncaughtException', (error) => {
    log('[game-server] exception tak tertangani', error);
  });
  process.on('unhandledRejection', (reason) => {
    log('[game-server] promise ditolak tanpa penangan', reason);
  });
}
