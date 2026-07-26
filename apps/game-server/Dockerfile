# Game server Pixel Matrix.
# Sengaja host-agnostic: image ini jalan sama saja di Render, Fly.io, Railway,
# Koyeb, atau VPS biasa. Yang dibutuhkan host cuma satu hal — koneksi WebSocket
# yang hidup lama. Platform serverless (termasuk Vercel Functions) TIDAK bisa
# menjalankan ini; lihat README bagian Deployment.
# Debian slim, bukan alpine: server dijalankan lewat tsx yang membawa binary
# esbuild native. Alpine (musl) menambah satu variabel yang tidak sebanding
# dengan selisih ukuran image-nya.
FROM node:22-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app

# Manifest disalin lebih dulu supaya layer install ter-cache selama daftar
# dependensinya tidak berubah.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/game-server/package.json apps/game-server/

# `...` di akhir filter berarti "paket ini beserta dependensi workspace-nya".
# Jadi apps/web (Next + Phaser, ratusan MB) tidak ikut terpasang.
#
# devDependencies sengaja ikut: server dijalankan lewat `tsx`, karena
# @pixelmatrix/shared mengekspor TypeScript apa adanya tanpa langkah build.
RUN pnpm install --frozen-lockfile --filter @pixelmatrix/game-server...

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/game-server apps/game-server

ENV NODE_ENV=production
# Kebanyakan host menimpa PORT lewat env; index.ts sudah membacanya.
ENV PORT=3001
EXPOSE 3001

# CORS_ORIGIN WAJIB diisi di produksi dengan origin web-nya, misal
# https://pixel-matrix.vercel.app. Kalau dibiarkan kosong, server menerima
# koneksi dari origin mana pun.
CMD ["pnpm", "--filter", "@pixelmatrix/game-server", "start"]
