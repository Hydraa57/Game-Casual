'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Overlay besar yang TIDAK boleh dikurung papan.
 *
 * Papan memakai `overflow: hidden` — perlu, karena pixel yang beranimasi keluar
 * dari tepinya harus terpotong. Tapi konsekuensinya: overlay yang isinya lebih
 * tinggi dari papan ikut terpotong. Diukur di layar hasil multiplayer dengan
 * tiga peserta: isinya butuh 364 px sementara papannya 336 px, jadi judul
 * "Match over" hilang 23 px di atas dan tombol "Back to lobby" hilang 23 px di
 * bawah — dua bagian yang justru paling perlu dilihat dan ditekan.
 *
 * Kenapa PORTAL dan bukan sekadar `position: fixed`: papan berada di dalam
 * `.boardArea` yang memakai `container-type: size`, dan itu menyalakan
 * containment. Elemen ber-`position: fixed` di dalam elemen yang ter-contain
 * mengukur dirinya terhadap KOTAK ITU, bukan terhadap layar — jadi `fixed`
 * saja tidak akan lolos dari kurungannya. Memindahkannya ke `document.body`
 * lewat portal adalah satu-satunya cara yang benar-benar keluar.
 *
 * Dirender hanya setelah terpasang di browser: `document.body` tidak ada saat
 * halaman dirender di server.
 */
export function BoardModal({
  children,
  className = '',
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  const [siap, setSiap] = useState(false);
  useEffect(() => setSiap(true), []);
  if (!siap) return null;

  return createPortal(
    // `role`/`aria-modal` ada di sini, bukan di pemanggilnya: keempat pemakainya
    // (jeda, game over, hasil match, tutorial) sama-sama momen modal — permainan
    // memang berhenti dan tidak ada yang bisa dilakukan di belakangnya.
    <div className={`overlay overlay--modal ${className}`.trim()} role="dialog" aria-modal="true">
      {children}
    </div>,
    document.body,
  );
}
