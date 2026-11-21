-- =============================================================================
-- MIGRASI 08: PENYIMPANAN BUKTI TRANSAKSI KE GOOGLE DRIVE (PRIVAT)
-- =============================================================================
-- Aman dijalankan berkali-kali (idempotent). Tidak menghapus atau mengubah kolom lama
-- sehingga bukti transaksi lama di Supabase Storage tetap dapat dibuka.
-- Jalankan di Supabase Dashboard -> SQL Editor -> New Query -> Run.
-- =============================================================================

alter table public.transactions
  add column if not exists drive_file_id text;

alter table public.transactions
  add column if not exists drive_file_name text;

alter table public.transactions
  add column if not exists drive_mime_type text;

alter table public.transactions
  add column if not exists drive_link text;

create index if not exists idx_transactions_drive_file_id
  on public.transactions(drive_file_id)
  where drive_file_id is not null;
