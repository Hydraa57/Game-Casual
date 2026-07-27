-- Pengetatan akses khusus Supabase.
--
-- JANGAN dijadikan migrasi Prisma: role `anon` dan `authenticated` hanya ada di
-- Supabase, jadi file ini akan gagal di PostgreSQL biasa. Jalankan sekali per
-- project Supabase, setelah migrasi Prisma selesai.
--
-- Kenapa perlu: Supabase mengekspos seluruh tabel di skema `public` lewat
-- PostgREST memakai anon key — dan anon key memang dirancang untuk publik.
-- Tanpa file ini, siapa pun yang punya anon key bisa mengunduh hash password
-- untuk di-crack offline, dan membaca token sesi untuk masuk sebagai orang lain.
--
-- Aman untuk aplikasi: seluruh tabel dimiliki role `postgres`, yang juga dipakai
-- Prisma. Pemilik tabel melewati RLS maupun hak akses kolom, jadi game-server
-- dan web tidak terpengaruh sama sekali.

ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SoloScore" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Match" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MatchPlayer" ENABLE ROW LEVEL SECURITY;

-- Tertutup rapat: RLS aktif tanpa satu pun policy, jadi role publik tidak
-- mendapat baris apa pun. Linter Supabase menandai ini sebagai INFO "RLS
-- enabled, no policy" — itu memang keadaan yang dituju di sini, bukan kelalaian.
REVOKE ALL ON public."Session" FROM anon, authenticated;
REVOKE ALL ON public."SoloScore" FROM anon, authenticated;
REVOKE ALL ON public."Match" FROM anon, authenticated;
REVOKE ALL ON public."MatchPlayer" FROM anon, authenticated;

-- Leaderboard: satu-satunya data yang boleh dibaca publik.
--
-- Policy RLS bekerja per BARIS, bukan per kolom. Policy SELECT di "User" akan
-- ikut membuka passwordHash — jadi pembatasan kolomnya HARUS memakai GRANT
-- tingkat kolom. Keduanya diperlukan; salah satu saja tidak cukup.
REVOKE ALL ON public."User" FROM anon, authenticated;
GRANT SELECT (username, avatar, "soloHighScore") ON public."User" TO anon, authenticated;

CREATE POLICY "leaderboard_public_read" ON public."User"
  FOR SELECT
  TO anon, authenticated
  USING ("soloHighScore" > 0);
