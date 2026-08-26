#!/usr/bin/env python3
"""Bikin ikon peluncur Android dari ikon PWA web.

Sumbernya `apps/web/public/icon-maskable-512.png` — ikon yang SAMA dengan yang
dipakai versi web, bukan gambar baru yang kebetulan mirip. Itu yang membuat
kedua versi punya ikon yang benar-benar sama, dan yang membuat mengubah ikonnya
cukup di satu tempat.

Yang dihasilkan:

  mipmap-*/ic_launcher_foreground.png   lapisan depan ikon adaptif (108 dp)
  mipmap-*/ic_launcher.png              ikon lama untuk Android 7 (minSdk 24)
  mipmap-*/ic_launcher_round.png        versi bulat untuk peluncur yang memintanya

Lapisan BELAKANG ikon adaptif bukan gambar, melainkan satu warna di
`values/ic_launcher_background.xml` — Android menggeser kedua lapisan saat
animasi peluncur, dan warna polos tidak akan pernah memperlihatkan tepi.

Jalankan ulang setelah ikon web berubah:

    python3 apps/mobile/scripts/buat-ikon.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

AKAR = Path(__file__).resolve().parents[3]
SUMBER = AKAR / "apps/web/public/icon-maskable-512.png"
RES = AKAR / "apps/mobile/android/app/src/main/res"

LATAR = (43, 27, 83)  # #2b1b53 — sama dengan latar papan permainan.

# Kepadatan layar Android. Angkanya: (nama folder, dp per px).
KEPADATAN = [
    ("mdpi", 1),
    ("hdpi", 1.5),
    ("xhdpi", 2),
    ("xxhdpi", 3),
    ("xxxhdpi", 4),
]

# Ikon adaptif berukuran 108 dp, tapi peluncur hanya menjamin 72 dp di TENGAH
# yang terlihat — sisanya bisa terpotong bentuk apa pun (lingkaran, kotak
# membulat, tetesan). Isi ikonnya ditaruh di dalam batas itu.
KANVAS_DP = 108
AMAN_DP = 72

# Ikon lama (pra-Android 8) berukuran 48 dp dan tidak dipotong.
LAMA_DP = 48


def muat_isi() -> Image.Image:
    """Ambil kotak-kotaknya saja, tanpa latar nila, terpotong pas di tepinya."""
    sumber = Image.open(SUMBER).convert("RGBA")
    piksel = sumber.load()
    assert piksel is not None

    # Latar nila dijadikan tembus pandang. Ambangnya longgar (30 per kanal)
    # supaya sisa kompresi PNG di tepi warna tidak tertinggal sebagai bingkai
    # gelap tipis di sekeliling tiap kotak.
    for y in range(sumber.height):
        for x in range(sumber.width):
            r, g, b, a = piksel[x, y]
            if abs(r - LATAR[0]) < 30 and abs(g - LATAR[1]) < 30 and abs(b - LATAR[2]) < 30:
                piksel[x, y] = (r, g, b, 0)

    kotak = sumber.getbbox()
    if kotak is None:
        raise SystemExit("ikon sumber kosong setelah latarnya dibuang")
    return sumber.crop(kotak)


def simpan(gambar: Image.Image, folder: str, nama: str) -> None:
    tujuan = RES / f"mipmap-{folder}"
    tujuan.mkdir(parents=True, exist_ok=True)
    berkas = tujuan / f"{nama}.png"
    gambar.save(berkas, "PNG", optimize=True)
    print(f"{berkas.relative_to(AKAR)}  {gambar.width}×{gambar.height}")


def main() -> None:
    isi = muat_isi()

    for folder, skala in KEPADATAN:
        # --- lapisan depan ikon adaptif ---------------------------------------
        kanvas_px = round(KANVAS_DP * skala)
        aman_px = round(AMAN_DP * skala)

        muat = isi.resize((aman_px, aman_px), Image.LANCZOS)
        depan = Image.new("RGBA", (kanvas_px, kanvas_px), (0, 0, 0, 0))
        tepi = (kanvas_px - aman_px) // 2
        depan.paste(muat, (tepi, tepi), muat)
        simpan(depan, folder, "ic_launcher_foreground")

        # --- ikon lama (Android 7) --------------------------------------------
        lama_px = round(LAMA_DP * skala)
        # Isinya lebih longgar di sini (78%) karena ikon lama tidak dipotong
        # bentuk apa pun, jadi tidak ada yang perlu disisakan.
        isi_px = round(lama_px * 0.78)
        muat_lama = isi.resize((isi_px, isi_px), Image.LANCZOS)

        persegi = Image.new("RGBA", (lama_px, lama_px), (*LATAR, 255))
        tepi_lama = (lama_px - isi_px) // 2
        persegi.paste(muat_lama, (tepi_lama, tepi_lama), muat_lama)
        simpan(persegi, folder, "ic_launcher")

        # Versi bulat: latar nila dipotong lingkaran, isinya tetap di tengah.
        topeng = Image.new("L", (lama_px * 4, lama_px * 4), 0)
        ImageDraw.Draw(topeng).ellipse((0, 0, lama_px * 4 - 1, lama_px * 4 - 1), fill=255)
        topeng = topeng.resize((lama_px, lama_px), Image.LANCZOS)

        bulat = Image.new("RGBA", (lama_px, lama_px), (0, 0, 0, 0))
        bulat.paste(persegi, (0, 0), topeng)
        simpan(bulat, folder, "ic_launcher_round")


if __name__ == "__main__":
    main()
