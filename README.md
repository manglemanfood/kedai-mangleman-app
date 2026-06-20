# 🍱 Kedai MangLeman - Sistem Manajemen FnB

Aplikasi manajemen bisnis FnB lengkap untuk Kedai MangLeman.

## Fitur
- 📝 **Form Order Customer** (publik, QR/link)
- 📋 **Rekap Order Harian** (realtime, update status)
- 👥 **CRM Pelanggan** (VIP/Loyal/Regular/Baru)
- 💸 **Pengeluaran Toko** (multi kategori)
- 📦 **Stok & Inventory** (bahan baku + menu jadi)
- 📖 **Manajemen Resep** (bahan tiap menu)
- 🧮 **Kalkulator HPP** (realtime dari resep)
- 📊 **Laporan Laba Rugi** (realtime)
- 🎯 **Target Bulanan** (set & monitor progress)
- 💡 **Analisa Bisnis** (insight & rekomendasi)
- 🍱 **Manajemen Menu** (kelola daftar menu)

## Setup

### 1. Jalankan SQL di Supabase
Buka Supabase Dashboard → SQL Editor → paste isi file `schema.sql` → Run

### 2. Deploy ke Vercel
1. Push repo ini ke GitHub
2. Import di vercel.com
3. Set environment variables:
   - `REACT_APP_SUPABASE_URL` = `https://bsfvrlfskdbrdwjhvden.supabase.co`
   - `REACT_APP_SUPABASE_ANON_KEY` = (anon key kamu)
4. Deploy!

## URL
- **Customer Order**: `https://[app].vercel.app/order`
- **Dashboard Internal**: `https://[app].vercel.app/dashboard`

## Tech Stack
- React 18
- Supabase (PostgreSQL + Realtime)
- Recharts
- React Router v6
- Vercel (hosting)
