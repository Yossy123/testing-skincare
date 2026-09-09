# NOBYDERM — Frontend Demo

Versi demo standalone dari frontend NOBYDERM yang **tidak memerlukan backend Laravel, database, Redis, maupun Midtrans**. Semua data berasal dari mock API bawaan (in-memory), sehingga project ini bisa langsung dijalankan maupun di-deploy (misalnya ke Vercel) untuk keperluan presentasi ke client.

> Catatan: ini adalah clone presentasi — bukan untuk production. Data mock hilang dan kembali ke nilai awal setiap server cold-start.

## Yang bisa dicoba di demo

- **Storefront**: beranda, katalog produk (search/sort/filter), detail produk, keranjang
- **Akun customer**: login, daftar alamat, checkout multi-step, riwayat & detail pesanan, simulasi pembayaran
- **Klinik**: daftar dokter, form booking, cek slot jadwal, lookup booking
- **Portal Admin**: dashboard KPI, kelola pesanan (proses/kirim/tandai selesai/batalkan/refund), produk, kategori, pelanggan, pasien, dokter, booking, 6 halaman analytics
- **Portal Dokter**: antrian hari ini, jadwal appointment, catatan diagnosa/resep, data pasien

## Akun demo

| Role     | Email                       | Password   |
| -------- | --------------------------- | ---------- |
| Customer | `customer@nobyderm.com`     | `password` |
| Dokter   | `doctor.yoshi@nobyderm.com` | `password` |
| Admin    | `admin@nobyderm.com`        | `password` |

Semua akun juga tersedia sebagai tombol quick-fill di halaman `/login`. Email lain akan otomatis dibuat sebagai akun customer (mode demo).

## Menjalankan lokal

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

Atau mode production:

```bash
npm run build
npm run start
```

## Deploy ke Vercel

Tidak ada environment variable yang perlu diisi manual — konfigurasi demo sudah ada di `.env.production`.

**Cara 1 — via Git (disarankan):**

1. Push folder ini ke repo GitHub (misal `nobyderm-frontend-demo`).
2. Di [vercel.com](https://vercel.com) → **Add New Project** → pilih repo tersebut.
3. Framework preset akan terdeteksi otomatis (Next.js). Langsung klik **Deploy**.

**Cara 2 — via Vercel CLI:**

```bash
npm i -g vercel
cd frontend-demo
vercel --prod
```

Setelah deploy, halaman `HealthStatusCard` di beranda akan menampilkan status **Online & Healthy** karena mock API (`/api/*`) berjalan di serverless function yang sama.

## Cara kerja mock API

- Endpoint mock: `src/app/api/[...path]/route.ts` (catch-all), logika di `src/lib/mock/handler.ts`, seed data di `src/lib/mock/db.ts`.
- Bentuk respons dibuat identik dengan Laravel API asli, sehingga seluruh halaman berjalan tanpa perubahan kode.
- Endpoint khusus demo: `POST /api/payments/simulate` — mensimulasikan pembayaran Midtrans (tombol **"Bayar Sekarang (Simulasi Demo)"** di halaman detail pesanan, aktif saat `NEXT_PUBLIC_DEMO_MODE=true`).
- Keterbatasan: data bersifat in-memory per instance serverless (perubahan bisa ter-reset), gambar produk memakai Unsplash, tidak ada email/WhatsApp/Midtrans asli.
