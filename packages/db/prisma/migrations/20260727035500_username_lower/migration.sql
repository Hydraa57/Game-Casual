-- AlterTable
-- Tabel User masih kosong saat migrasi ini dibuat, jadi kolom NOT NULL tanpa
-- default aman. Kalau nanti perlu diterapkan ke database yang sudah berisi
-- akun, isi dulu dengan lower(username) sebelum menambahkan constraint-nya.
ALTER TABLE "User" ADD COLUMN     "usernameLower" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_usernameLower_key" ON "User"("usernameLower");
