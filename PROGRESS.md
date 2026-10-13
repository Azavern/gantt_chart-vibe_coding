# PROGRESS.md

Checklist pengerjaan mengikuti `blueprint.md`. Tanda `[x]` hanya diberikan setelah perintah
verifikasinya benar-benar dijalankan dan hasilnya lolos.

## Fase 0 — Fondasi

- [x] Monorepo npm workspaces (`shared`, `server`, `client`)
- [x] tsconfig dasar, Vite + React + Tailwind, Express `/api/health`
- [x] Skrip root, `.gitignore`, `.env.example`, `PROGRESS.md`
- [x] Gate: `npm install` dan `npm run typecheck` sukses

## Fase 1 — Mesin inti (`shared`)

- [x] `dates.ts` (tanggal UTC murni)
- [x] `calendar.ts` (6.2) + validasi weekendDays
- [x] `scheduler.ts` (6.3, 6.4, 6.5, 6.6)
- [x] `cpm.ts` (6.8), `pert.ts` (6.9), `cost.ts` (6.10)
- [x] `schemas.ts` + `types.ts` + `analysis.ts` (bentuk respons analisis)
- [x] Unit test termasuk seluruh vektor uji 6.11
- [x] Gate: `npm test -w shared` lolos — 56 test pada 6 file

## Fase 2 — Backend

- [x] Skema Prisma + migrasi (`server/prisma/migrations/20261013131141_init`)
- [x] Auth (register, login, me) dengan bcryptjs + jsonwebtoken
- [x] Seluruh rute Bagian 7 + cek kepemilikan
- [x] `recompute` dan `snapshot`
- [x] Middleware error dan validasi
- [x] Seed idempoten (Bagian 9): 17 tugas, 4 anggota, 2 hari libur
- [x] Test integrasi Supertest (auth, CRUD tugas, parent-child, FS/SS lag, siklus, kalender,
      assignment, analisis, lintas pengguna ditolak)
- [x] Gate: typecheck + test server lolos (36 test), `npm run db:seed` berhasil

## Fase 3 — Frontend

- [x] Halaman Login, Register, Projects
- [x] Halaman Gantt (tabel + timeline SVG, panah dependensi, drag & resize, dialog tugas)
- [x] Halaman Tim (anggota, alokasi, biaya, over-alokasi)
- [x] Halaman Kalender (akhir pekan, libur, kalender mini)
- [x] Halaman Analisis (ringkasan, tabel CPM, jalur kritis, PERT)
- [x] Test komponen dan halaman: bar Gantt, panah dependensi, geser/tarik bar, validasi form,
      node kritis PERT, smoke test semua halaman
- [x] Gate: typecheck, test (21 test), build client lolos

## Fase 4 — Integrasi dan verifikasi

- [x] `npm install`, `npm run typecheck`, `npm test`, `npm run build` lolos tanpa error
- [x] `npm run dev` melayani `http://localhost:3001/api/health` dan `http://localhost:5173`
- [x] Acceptance Checklist Bagian 12 (rincian di bawah)

## Fase 5 — Rapikan sebelum push

- [x] `.gitignore` mengecualikan `node_modules`, `dist`, `.env`, `*.db`, `*.db-journal`, `coverage`
- [x] `README.md` sesuai kenyataan (fitur, stack, cara jalan, akun demo, ringkasan API, asumsi)
- [x] Tidak ada rahasia / file `.env` / database ter-track (dipindai dengan `git status`,
      `git ls-files`, dan pemeriksaan pola rahasia)

## Fase 6 — Push ke GitHub

- [ ] URL repository dari manusia
- [ ] Commit lokal dibuat (`git log` menunjukkan commit awal)
- [ ] `git push -u origin main`

---

## Acceptance checklist (Bagian 12)

**Tugas**

- [x] Tambah, ubah, dan hapus tugas berhasil — `server/src/tests/tasks.test.ts`
- [x] Durasi, tanggal mulai, prioritas, dan warna tersimpan — `tasks.test.ts`
- [x] Sub-tugas bisa dibuat, induk menghitung rentang dan progres otomatis — `tasks.test.ts`
      (durasi 11 hari kerja, progres 40 dari anak 100%/0%)

**Dependensi dan Gantt**

- [x] FS/SS dengan lag mengubah posisi bar sesuai 6.4 dan vektor uji 6.11 —
      `shared/src/scheduler.test.ts`, `server/src/tests/dependencies.test.ts`
- [x] Bar Gantt tampil, panah FS dan SS ada, bar bisa digeser dan di-resize —
      `client/src/components/gantt/GanttTimeline.test.tsx` (bar + panah, label "SS +2") dan
      `GanttChart.test.tsx` (geser → `PATCH /tasks/:id { startDate }`, tarik → `{ durationDays }`)
- [x] Dependensi yang membentuk siklus ditolak dengan pesan jelas — `dependencies.test.ts`
      (kode `CYCLE_DETECTED`, status 422)

**Resource**

- [x] Tambah anggota tim dan alokasikan ke tugas — `server/src/tests/resources.test.ts`
- [x] Biaya dan peringatan over-alokasi benar — `resources.test.ts` (Rp 2.500.000 untuk 5 hari
      alokasi 50% dengan gaji Rp 22.000.000; peringatan 120% pada 3 hari kerja)

**Kalender**

- [x] Ubah akhir pekan dan tambah hari libur, jadwal bergeser otomatis — `calendar.test.ts`
- [x] Durasi tidak menghitung akhir pekan dan hari libur — `calendar.test.ts` dan vektor uji 6.11

**Analisis**

- [x] Halaman Analisis menampilkan Critical Path dan diagram PERT dengan node kritis merah —
      `client/src/components/pert/PertChart.test.tsx`, `client/src/pages/pages.test.tsx`

**Persistensi dan akun**

- [x] Data berasal dari database (bukan localStorage) dan bertahan setelah halaman dimuat ulang —
      seluruh mutasi diuji lewat API dan dibaca kembali dari database
- [x] Register, login, logout berfungsi; pengguna A tidak bisa melihat data pengguna B —
      `auth.test.ts`, `access.test.ts` (semua akses lintas pengguna dijawab 404)

**Repository**

- [x] Ada folder `src` di tiap workspace, `package.json`, dan `README.md`
- [x] `node_modules`, `.env`, dan file database tidak ikut ter-commit
- [x] `npm run typecheck`, `npm test`, dan `npm run build` lolos tanpa error

---

## Catatan verifikasi

- Verifikasi antarmuka dilakukan pada browser sungguhan (Chrome headless) dengan server dan database
  yang berjalan: halaman Gantt, Tim, Kalender, dan Analisis dari data seed berhasil dirender,
  termasuk nama tugas, biaya, peringatan over-alokasi, dan jalur kritis.
- Test integrasi server memakai database SQLite terpisah yang dibuat dari migrasi, sehingga tidak
  menyentuh `server/prisma/dev.db`.
- Belum diverifikasi secara otomatis: interaksi nyata memakai keyboard dan pembaca layar,
  serta tampilan pada perangkat fisik; kedua hal ini disarankan diperiksa manual.
