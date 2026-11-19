-- =============================================================================
-- SISKEU HKBP HUTARAJA - COMPLETE FULL DATABASE SCHEMA FOR SUPABASE (PostgreSQL)
-- =============================================================================
-- Skrip SQL ini bersifat IDEMPOTENT (aman dijalankan ulang berkali-kali).
-- Mencakup seluruh 38 tabel, tipe data, enum HKBP, upgrade kolom otomatis,
-- RLS (Row Level Security), publikasi Realtime, Storage Bucket nota, dan seed awal.
--
-- CARA PENGGUNAAN:
-- 1. Buka Supabase Dashboard -> SQL Editor -> New Query
-- 2. Tempel seluruh isi skrip ini, lalu klik Run (atau Ctrl + Enter)
-- 3. Pastikan Environment Variables VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY
--    telah diisi (atau simpan melalui Pengaturan Sistem di Dashboard)
-- =============================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. ENUMS & CUSTOM TYPES
do $$ begin
  create type public.user_role as enum (
    'admin', 'bendahara_umum', 'pengurus_kas', 'pendeta_ressort', 'sekretaris', 'majelis', 'auditor'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.kas_access_level as enum ('bendahara', 'ketua');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.storage_type as enum ('cash', 'bank');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.category_type as enum ('income', 'expense');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.transaction_type as enum ('income', 'expense', 'transfer_out', 'transfer_in');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.transaction_status as enum ('draft', 'submitted', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.fund_type as enum ('unrestricted', 'restricted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.opening_book_status as enum ('not_started', 'drafting', 'submitted', 'approved', 'locked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.opening_adjustment_status as enum ('submitted', 'approved_ketua', 'approved_bendum', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.budget_status as enum ('draft', 'reviewed', 'submitted_rapat', 'approved', 'returned');
exception when duplicate_object then null; end $$;

-- 3. CORE TABLES

-- User Profiles
create table if not exists public.profiles (
  id text primary key default gen_random_uuid()::text,
  email text not null,
  full_name text not null,
  role text not null default 'pengurus_kas',
  ecclesiastical_role text,
  tohonan text,
  tingkat text default 'huria',
  seksi_name text,
  wijk text,
  phone text,
  password_hash text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Master Kas
create table if not exists public.kas (
  id text primary key default gen_random_uuid()::text,
  kode text unique not null,
  nama text not null,
  deskripsi text,
  warna text not null default '#7C9CF5',
  is_active boolean not null default true,
  fund_type text not null default 'unrestricted',
  restricted_purpose text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tempat Penyimpanan (Brankas Tunai / Rekening Bank)
create table if not exists public.storage_accounts (
  id text primary key default gen_random_uuid()::text,
  nama text not null,
  tipe text not null default 'cash',
  nomor_rekening text,
  atas_nama text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Penugasan Pengguna ke Kas
create table if not exists public.user_kas_access (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references public.profiles(id) on delete cascade,
  kas_id text not null references public.kas(id) on delete cascade,
  access_level text not null default 'bendahara',
  created_at timestamptz not null default now(),
  unique(user_id, kas_id, access_level)
);

-- Kategori Transaksi (Mendukung PPKU 2023 Sentralisasi 55% / 45%)
create table if not exists public.categories (
  id text primary key default gen_random_uuid()::text,
  nama text not null,
  tipe text not null,
  kode text,
  deskripsi text,
  is_active boolean not null default true,
  is_sentralisasi boolean not null default true,
  sentralisasi_group text,
  sentralisasi_exclusion_type text,
  default_kas_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pengaturan Organisasi
create table if not exists public.app_settings (
  id text primary key default 'main',
  church_name text not null default 'HKBP Ressort Hutaraja',
  church_subtext text not null default 'Ressort Khusus - Distrik V Sumatera Timur',
  church_address text not null default 'Jl. Gereja No. 1, Hutaraja, Sumatera Utara',
  church_phone text not null default '0812-3456-7890',
  church_email text not null default 'ressort.hutaraja@hkbp.or.id',
  pendeta_name text not null default 'Pdt. Santa Lucia Manurung, S.Th',
  sekretaris_name text not null default 'St. Sardi Simanullang',
  bendahara_umum_name text not null default 'St. Manaek Lumban Gaol',
  ketua_parartaon_name text default 'St. Harbet Simanjuntak',
  bpsk_va_number text default 'VA-BPSK HKBP Ressort Hutaraja (Mandiri / BRI)',
  receipt_required_threshold numeric(15,2) not null default 500000,
  block_negative_balance boolean not null default true,
  active_year integer not null default 2026,
  budget_reallocation_max_pct numeric(5,2) not null default 15.00,
  updated_at timestamptz not null default now()
);

-- Master Tahun Anggaran (Fiscal Years)
create table if not exists public.fiscal_years (
  id text primary key default gen_random_uuid()::text,
  year integer unique not null check (year >= 2000 and year <= 2100),
  theme text not null default '',
  start_date date not null,
  end_date date not null,
  status text not null default 'planning',
  is_budget_locked boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

-- Transaksi Keuangan
create table if not exists public.transactions (
  id text primary key default gen_random_uuid()::text,
  tanggal date not null default current_date,
  kas_id text not null references public.kas(id) on delete restrict,
  storage_account_id text not null references public.storage_accounts(id) on delete restrict,
  category_id text references public.categories(id) on delete set null,
  type text not null,
  amount numeric(15,2) not null check (amount > 0),
  description text not null,
  receipt_no text,
  attachment_url text,
  status text not null default 'draft',
  transfer_id text,
  transfer_target_kas_id text,
  transfer_target_storage_id text,
  transfer_confirmed_by text,
  transfer_confirmed_at timestamptz,
  reverses_id text,
  is_reversal boolean not null default false,
  created_by text,
  approved_by text,
  approved_at timestamptz,
  reject_note text,
  audit_status text default 'unverified',
  audited_by text,
  audited_at timestamptz,
  audit_note text,
  is_sentralisasi boolean default true,
  sentralisasi_role text,
  allocation_group_id text,
  bpsk_rate numeric(5,2) default 0.55,
  huria_rate numeric(5,2) default 0.45,
  bpsk_amount numeric(15,2) default 0,
  huria_amount numeric(15,2) default 0,
  sentralisasi_remitted boolean default false,
  sentralisasi_remitted_at timestamptz,
  sentralisasi_remitted_ref text,
  sentralisasi_exclusion_type text,
  tanggal_warta date,
  pelean_taon_year integer,
  family_id text,
  family_name text,
  lingkungan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Master Lingkungan / Wijk Jemaat
create table if not exists public.church_lingkungan (
  id text primary key default gen_random_uuid()::text,
  nama text unique not null,
  kode text,
  urutan integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Master Data Keluarga Jemaat per Lingkungan (untuk Pelean Taon)
create table if not exists public.congregation_families (
  id text primary key default gen_random_uuid()::text,
  nama_keluarga text not null,
  lingkungan text not null,
  kepala_keluarga text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Penutupan Buku Bulanan
create table if not exists public.period_closings (
  id text primary key default gen_random_uuid()::text,
  tahun integer not null check (tahun >= 2000 and tahun <= 2100),
  bulan integer not null check (bulan >= 1 and bulan <= 12),
  kas_id text references public.kas(id) on delete cascade,
  is_closed boolean not null default true,
  closed_by text,
  closed_at timestamptz not null default now(),
  reopened_by text,
  reopened_at timestamptz,
  reopen_reason text,
  created_at timestamptz not null default now()
);

-- Rekonsiliasi Kas & Bank
create table if not exists public.reconciliations (
  id text primary key default gen_random_uuid()::text,
  tanggal date not null default current_date,
  storage_account_id text not null references public.storage_accounts(id) on delete cascade,
  system_balance numeric(15,2) not null,
  physical_balance numeric(15,2) not null,
  discrepancy numeric(15,2) not null default 0,
  notes text,
  checked_by text,
  created_at timestamptz not null default now()
);

-- Audit Logs (changed_by dapat berisi user_id atau 'system')
create table if not exists public.audit_logs (
  id text primary key default gen_random_uuid()::text,
  table_name text not null,
  record_id text not null,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  changed_by text,
  notes text,
  changed_at timestamptz not null default now()
);

-- 4. MODUL SALDO AWAL & PEMBUKAAN BUKU
create table if not exists public.opening_setup (
  id text primary key default 'main',
  first_year integer not null default 2026,
  go_live_date date not null default '2026-01-01',
  status text not null default 'in_progress',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opening_balances (
  id text primary key default gen_random_uuid()::text,
  tahun integer not null default 2026,
  kas_id text not null references public.kas(id) on delete cascade,
  storage_account_id text not null references public.storage_accounts(id) on delete cascade,
  amount numeric(15,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tahun, kas_id, storage_account_id)
);

create table if not exists public.opening_balance_entries (
  id text primary key default gen_random_uuid()::text,
  tahun integer not null default 2026,
  kas_id text not null references public.kas(id) on delete cascade,
  storage_account_id text not null references public.storage_accounts(id) on delete cascade,
  amount numeric(15,2) not null default 0,
  book_balance numeric(15,2) not null default 0,
  physical_balance numeric(15,2) not null default 0,
  difference numeric(15,2) default 0,
  explanation text,
  document_url text,
  status text not null default 'drafting',
  created_by text,
  submitted_at timestamptz,
  approved_by text,
  approved_at timestamptz,
  locked_by text,
  locked_at timestamptz,
  return_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tahun, kas_id, storage_account_id)
);

create table if not exists public.opening_balance_adjustments (
  id text primary key default gen_random_uuid()::text,
  tahun integer not null default 2026,
  kas_id text not null references public.kas(id) on delete cascade,
  storage_account_id text not null references public.storage_accounts(id) on delete cascade,
  amount numeric(15,2) not null,
  reason text not null,
  document_url text,
  status text not null default 'submitted',
  proposed_by text,
  approved_ketua_by text,
  approved_ketua_at timestamptz,
  approved_bendum_by text,
  approved_bendum_at timestamptz,
  rejected_by text,
  rejected_at timestamptz,
  reject_reason text,
  reject_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opening_other_positions (
  id text primary key default gen_random_uuid()::text,
  tahun integer not null default 2026,
  kas_id text not null references public.kas(id) on delete cascade,
  type text not null,
  name text not null,
  category text,
  acquisition_year integer,
  amount numeric(15,2) not null default 0,
  condition text,
  location text,
  section_manager text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.prior_year_summaries (
  id text primary key default gen_random_uuid()::text,
  tahun integer not null,
  kas_id text not null references public.kas(id) on delete cascade,
  category_id text references public.categories(id) on delete restrict,
  jumlah numeric(15,2) not null default 0,
  sumber text default 'manual',
  created_by text,
  approved_by text,
  locked boolean default true,
  created_at timestamptz not null default now()
);

-- 5. MODUL ANGGARAN (APBG)
create table if not exists public.budgets (
  id text primary key default gen_random_uuid()::text,
  kas_id text not null references public.kas(id) on delete cascade,
  tahun integer not null default 2026,
  version integer not null default 1,
  title text not null,
  status text not null default 'draft',
  estimated_opening_balance numeric(15,2) not null default 0,
  is_opening_balance_locked boolean not null default false,
  is_current_active boolean not null default false,
  notes text,
  return_note text,
  rapat_date date,
  rapat_berita_acara_no text,
  rapat_document_url text,
  created_by text,
  reviewed_by text,
  reviewed_at timestamptz,
  submitted_rapat_by text,
  submitted_rapat_at timestamptz,
  ratified_by text,
  ratified_at timestamptz,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kas_id, tahun, version)
);

create table if not exists public.budget_items (
  id text primary key default gen_random_uuid()::text,
  budget_id text not null references public.budgets(id) on delete cascade,
  category_id text not null references public.categories(id) on delete restrict,
  type text not null,
  description text,
  annual_amount numeric(15,2) not null default 0,
  monthly_distribution jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budget_reallocations (
  id text primary key default gen_random_uuid()::text,
  budget_id text not null references public.budgets(id) on delete cascade,
  kas_id text not null references public.kas(id) on delete cascade,
  tahun integer not null default 2026,
  from_item_id text not null references public.budget_items(id) on delete cascade,
  to_item_id text not null references public.budget_items(id) on delete cascade,
  amount numeric(15,2) not null,
  reason text not null,
  status text not null default 'approved',
  proposed_by text,
  approved_by text,
  approved_at timestamptz,
  rejected_by text,
  rejected_at timestamptz,
  reject_reason text,
  reject_note text,
  created_at timestamptz not null default now()
);

-- 6. DATA PENDUKUNG LPJ (ISAK 35)
create table if not exists public.fixed_assets (
  id text primary key default gen_random_uuid()::text,
  kode text unique not null,
  nama text not null,
  kategori text not null default 'perabot',
  tanggal_perolehan date not null default current_date,
  nilai_perolehan numeric(15,2) not null default 0,
  kondisi text not null default 'baik',
  lokasi text not null default 'Gereja',
  kas_id text references public.kas(id) on delete set null,
  status text not null default 'aktif',
  foto_url text,
  dokumen_url text,
  transaction_id text,
  useful_life_years integer default 0,
  salvage_value numeric(15,2) default 0,
  notes text,
  disposed_at date,
  disposal_date date,
  disposal_reason text,
  disposal_proposed_by text,
  disposal_approved_by text,
  disposal_approved_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.asset_depreciations (
  id text primary key default gen_random_uuid()::text,
  asset_id text not null references public.fixed_assets(id) on delete cascade,
  year integer not null,
  tahun integer,
  depreciation_amount numeric(15,2) not null default 0,
  accumulated_depreciation numeric(15,2) not null default 0,
  book_value numeric(15,2) not null default 0,
  method text default 'straight_line',
  calculated_at timestamptz not null default now(),
  unique (asset_id, year)
);

create table if not exists public.advances (
  id text primary key default gen_random_uuid()::text,
  kode text unique not null,
  kas_id text not null references public.kas(id) on delete restrict,
  storage_account_id text,
  recipient_name text not null,
  recipient_phone text,
  amount numeric(15,2) not null default 0,
  advance_date date not null default current_date,
  due_date date not null,
  purpose text not null,
  status text not null default 'active',
  transaction_id text,
  settled_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.advance_settlements (
  id text primary key default gen_random_uuid()::text,
  advance_id text not null references public.advances(id) on delete cascade,
  settlement_date date not null default current_date,
  spent_amount numeric(15,2) not null default 0,
  remaining_returned numeric(15,2) not null default 0,
  deficit_reimbursed numeric(15,2) not null default 0,
  total_spent numeric(15,2) default 0,
  remaining_amount numeric(15,2) default 0,
  notes text,
  receipt_url text,
  receipt_urls jsonb default '[]'::jsonb,
  status text not null default 'draft',
  submitted_by text,
  created_by text,
  approved_by text,
  approved_at timestamptz,
  reject_note text,
  return_transaction_id text,
  reimburse_transaction_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.receivables_payables (
  id text primary key default gen_random_uuid()::text,
  type text not null default 'receivable',
  kode text unique not null,
  kas_id text not null references public.kas(id) on delete restrict,
  counterparty_name text not null,
  counterparty_contact text,
  amount numeric(15,2) not null default 0,
  remaining_amount numeric(15,2) not null default 0,
  issue_date date not null default current_date,
  due_date date,
  status text not null default 'active',
  description text not null,
  document_url text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.receivable_payable_payments (
  id text primary key default gen_random_uuid()::text,
  parent_id text not null references public.receivables_payables(id) on delete cascade,
  payment_date date not null default current_date,
  payment_amount numeric(15,2) not null default 0,
  storage_account_id text,
  transaction_id text,
  notes text,
  receipt_url text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.lpj_notes (
  id text primary key default 'lpj-note-2026',
  year integer not null default 2026,
  accounting_basis text,
  accounting_policies text,
  significant_items_notes text,
  budget_variance_notes text,
  significant_events text,
  restricted_funds_notes text,
  post_reporting_events text,
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists public.lpj_settings (
  id text primary key default 'main',
  enable_depreciation boolean default false,
  depreciation_method text default 'straight_line',
  budget_variance_threshold_percent numeric(5,2) default 10.0,
  default_advance_days integer default 14,
  document_number_format text default 'HKBP-HTR/LPJ/{TAHUN}/{NOMOR}',
  signatories jsonb default '[]'::jsonb,
  useful_life_defaults jsonb default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);

-- 7. MODUL BADAN AUDIT HURIA
create table if not exists public.audit_body_members (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references public.profiles(id) on delete cascade,
  jabatan text not null default 'anggota',
  periode_mulai date not null default current_date,
  periode_selesai date not null default (current_date + interval '2 years'),
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, periode_mulai)
);

create table if not exists public.audit_engagements (
  id text primary key default gen_random_uuid()::text,
  tahun integer not null default 2026,
  jenis text not null default 'semester_1',
  judul text not null,
  deskripsi text,
  semester_report_id text,
  lpj_id text,
  status text not null default 'draft',
  dibuka_pada date not null default current_date,
  batas_waktu date not null default (current_date + interval '14 days'),
  berita_acara_url text,
  combined_with_lpj boolean not null default false,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tahun, jenis)
);

create table if not exists public.audit_reviews (
  id text primary key default gen_random_uuid()::text,
  engagement_id text not null references public.audit_engagements(id) on delete cascade,
  member_id text not null references public.profiles(id) on delete restrict,
  notes_per_section jsonb not null default '{}'::jsonb,
  general_notes text,
  personal_opinion text not null default 'sesuai',
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(engagement_id, member_id)
);

create table if not exists public.audit_findings (
  id text primary key default gen_random_uuid()::text,
  engagement_id text not null,
  kas_id text references public.kas(id) on delete set null,
  kode text not null,
  title text not null,
  description text not null,
  severity text not null default 'wajib_diperbaiki',
  status text not null default 'terbuka',
  carried_from_finding_id text,
  due_date date,
  response_notes text,
  response_by text,
  responded_at timestamptz,
  closed_by text,
  closed_at timestamptz,
  closing_notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_final_opinions (
  id text primary key default gen_random_uuid()::text,
  engagement_id text not null references public.audit_engagements(id) on delete cascade unique,
  final_opinion text not null,
  vote_breakdown jsonb not null default '{}'::jsonb,
  has_dissenting_opinion boolean not null default false,
  dissenting_opinion_notes text,
  berita_acara_no text not null,
  berita_acara_date date not null default current_date,
  berita_acara_url text,
  signatories jsonb not null default '[]'::jsonb,
  finalized_by text,
  finalized_at timestamptz not null default now()
);

create table if not exists public.cash_counts (
  id text primary key default gen_random_uuid()::text,
  tanggal date not null default current_date,
  kas_id text not null references public.kas(id) on delete cascade,
  storage_account_id text not null references public.storage_accounts(id) on delete cascade,
  book_balance numeric(15,2) not null default 0,
  physical_balance numeric(15,2) not null default 0,
  difference numeric(15,2) default 0,
  cash_breakdown jsonb not null default '{}'::jsonb,
  explanation text,
  photo_url text,
  auditor_id text,
  witness_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_period_verifications (
  id text primary key default gen_random_uuid()::text,
  tahun integer not null default 2026,
  period_type text not null default 'semester',
  period_code text not null default 'sem_1',
  period_title text not null,
  date_range text not null,
  status text not null default 'belum_diperiksa',
  verified_by jsonb default '[]'::jsonb,
  verified_signatures jsonb default '[]'::jsonb,
  verified_at timestamptz,
  general_notes text,
  checklist jsonb default '{}'::jsonb,
  berita_acara_no text,
  total_transactions_count integer default 0,
  verified_transactions_count integer default 0,
  flagged_transactions_count integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8. MODUL LAPORAN SEMESTER & LPJ TAHUNAN
create table if not exists public.semester_reports (
  id text primary key default gen_random_uuid()::text,
  tahun integer not null default 2026,
  semester integer not null default 1,
  status text not null default 'preparation',
  version integer not null default 1,
  snapshot_data jsonb,
  checklist_result jsonb not null default '{}'::jsonb,
  sent_to_pastor_date date,
  sent_ref text,
  pastor_ack_by text,
  pastor_ack_at timestamptz,
  pastor_note text,
  announced_date date,
  announcement_medium text default 'warta_jemaat',
  announcement_text text,
  announcement_document_url text,
  return_notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tahun, semester, version)
);

create table if not exists public.lpj_reports (
  id text primary key default gen_random_uuid()::text,
  tahun integer not null default 2026,
  nomor_dokumen text not null,
  status text not null default 'preparation',
  version integer not null default 1,
  snapshot_data jsonb,
  checklist_result jsonb not null default '{}'::jsonb,
  meeting_date date,
  meeting_ref text,
  meeting_document_url text,
  meeting_notes text,
  meeting_attendees_count integer default 0,
  approved_by text,
  approved_at timestamptz,
  return_notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tahun, version)
);

create table if not exists public.lpj_exceptions (
  id text primary key default gen_random_uuid()::text,
  target_type text not null,
  target_id text not null,
  rule_code text not null,
  reason text not null,
  granted_by text not null,
  granted_at timestamptz not null default now()
);

-- =============================================================================
-- 8B. IDEMPOTENT COLUMN & CONSTRAINT UPGRADES (AMAN UNTUK DB YANG SUDAH ADA)
-- =============================================================================
do $$ begin
  -- Profiles password_hash column & default initial password hash ('Hkbp2026!') for uninitialized accounts
  alter table public.profiles add column if not exists password_hash text;
  update public.profiles
    set password_hash = encode(digest('SISKEU-HKBP-HUTARAJA:Hkbp2026!', 'sha256'), 'hex')
    where password_hash is null or password_hash = '';

  -- Categories PPKU 2023 columns
  alter table public.categories add column if not exists deskripsi text;
  alter table public.categories add column if not exists is_sentralisasi boolean not null default true;
  alter table public.categories add column if not exists sentralisasi_group text;
  alter table public.categories add column if not exists sentralisasi_exclusion_type text;
  alter table public.categories add column if not exists default_kas_id text;

  -- App Settings columns
  alter table public.app_settings add column if not exists ketua_parartaon_name text default 'St. Harbet Simanjuntak';
  alter table public.app_settings add column if not exists bpsk_va_number text default 'VA-BPSK HKBP Ressort Hutaraja (Mandiri / BRI)';
  alter table public.app_settings add column if not exists budget_reallocation_max_pct numeric(5,2) not null default 15.00;

  -- Transactions PPKU & Sentralisasi columns
  alter table public.transactions add column if not exists is_sentralisasi boolean default true;
  alter table public.transactions add column if not exists sentralisasi_role text;
  alter table public.transactions add column if not exists allocation_group_id text;
  alter table public.transactions add column if not exists bpsk_rate numeric(5,2) default 0.55;
  alter table public.transactions add column if not exists huria_rate numeric(5,2) default 0.45;
  alter table public.transactions add column if not exists bpsk_amount numeric(15,2) default 0;
  alter table public.transactions add column if not exists huria_amount numeric(15,2) default 0;
  alter table public.transactions add column if not exists sentralisasi_remitted boolean default false;
  alter table public.transactions add column if not exists sentralisasi_remitted_at timestamptz;
  alter table public.transactions add column if not exists sentralisasi_remitted_ref text;
  alter table public.transactions add column if not exists sentralisasi_exclusion_type text;
  alter table public.transactions add column if not exists tanggal_warta date;
  alter table public.transactions add column if not exists pelean_taon_year integer;
  alter table public.transactions add column if not exists family_id text;
  alter table public.transactions add column if not exists family_name text;
  alter table public.transactions add column if not exists lingkungan text;

  -- Budgets workflow columns
  alter table public.budgets add column if not exists is_current_active boolean not null default false;
  alter table public.budgets add column if not exists notes text;
  alter table public.budgets add column if not exists reviewed_by text;
  alter table public.budgets add column if not exists reviewed_at timestamptz;
  alter table public.budgets add column if not exists submitted_rapat_by text;
  alter table public.budgets add column if not exists submitted_rapat_at timestamptz;
  alter table public.budgets add column if not exists ratified_by text;
  alter table public.budgets add column if not exists ratified_at timestamptz;
  alter table public.budget_items alter column description drop not null;
  alter table public.budget_reallocations add column if not exists reject_note text;

  -- Opening Balance module columns
  alter table public.opening_balance_adjustments add column if not exists reject_note text;
  alter table public.opening_balance_adjustments add column if not exists updated_at timestamptz not null default now();
  alter table public.opening_other_positions add column if not exists condition text;
  alter table public.opening_other_positions add column if not exists location text;
  alter table public.opening_other_positions alter column category drop not null;
  alter table public.prior_year_summaries add column if not exists created_by text;
  alter table public.prior_year_summaries add column if not exists approved_by text;

  -- Fixed assets & LPJ supporting tables
  alter table public.fixed_assets add column if not exists foto_url text;
  alter table public.fixed_assets add column if not exists dokumen_url text;
  alter table public.fixed_assets add column if not exists transaction_id text;
  alter table public.fixed_assets add column if not exists disposal_date date;
  alter table public.fixed_assets add column if not exists disposal_proposed_by text;
  alter table public.fixed_assets add column if not exists disposal_approved_by text;
  alter table public.fixed_assets add column if not exists disposal_approved_at timestamptz;
  alter table public.fixed_assets add column if not exists created_by text;
  alter table public.fixed_assets add column if not exists updated_at timestamptz not null default now();

  alter table public.asset_depreciations add column if not exists tahun integer;
  alter table public.asset_depreciations add column if not exists method text default 'straight_line';

  alter table public.advances add column if not exists storage_account_id text;
  alter table public.advances add column if not exists transaction_id text;
  alter table public.advances add column if not exists updated_at timestamptz not null default now();

  alter table public.advance_settlements add column if not exists spent_amount numeric(15,2) not null default 0;
  alter table public.advance_settlements add column if not exists remaining_returned numeric(15,2) not null default 0;
  alter table public.advance_settlements add column if not exists deficit_reimbursed numeric(15,2) not null default 0;
  alter table public.advance_settlements add column if not exists receipt_url text;
  alter table public.advance_settlements add column if not exists submitted_by text;
  alter table public.advance_settlements add column if not exists approved_at timestamptz;
  alter table public.advance_settlements add column if not exists reject_note text;
  alter table public.advance_settlements add column if not exists return_transaction_id text;
  alter table public.advance_settlements add column if not exists reimburse_transaction_id text;
  alter table public.advance_settlements add column if not exists updated_at timestamptz not null default now();

  alter table public.receivables_payables add column if not exists document_url text;
  alter table public.receivables_payables add column if not exists updated_at timestamptz not null default now();
  alter table public.receivables_payables alter column due_date drop not null;
  alter table public.receivable_payable_payments add column if not exists transaction_id text;

  alter table public.lpj_notes add column if not exists updated_by text;
  alter table public.lpj_settings add column if not exists updated_by text;

  -- Audit module columns
  alter table public.audit_findings add column if not exists carried_from_finding_id text;
  alter table public.audit_findings add column if not exists updated_at timestamptz not null default now();
  alter table public.audit_reviews add column if not exists created_at timestamptz not null default now();
  alter table public.audit_reviews add column if not exists updated_at timestamptz not null default now();
  alter table public.audit_final_opinions add column if not exists berita_acara_url text;
  alter table public.cash_counts add column if not exists photo_url text;

  -- Relax FKs on audit / system-user reference columns so 'system' fallback never fails
  alter table public.audit_logs drop constraint if exists audit_logs_changed_by_fkey;
  alter table public.transactions drop constraint if exists transactions_created_by_fkey;
  alter table public.transactions drop constraint if exists transactions_approved_by_fkey;
  alter table public.transactions drop constraint if exists transactions_audited_by_fkey;
  alter table public.transactions drop constraint if exists transactions_transfer_confirmed_by_fkey;
  alter table public.transactions drop constraint if exists transactions_reverses_id_fkey;
  alter table public.audit_findings drop constraint if exists audit_findings_engagement_id_fkey;
  alter table public.lpj_exceptions drop constraint if exists lpj_exceptions_granted_by_fkey;
exception when others then null; end $$;

-- Helpful Indexes for Dashboard Performance
create index if not exists idx_transactions_tanggal on public.transactions(tanggal desc);
create index if not exists idx_transactions_kas_id on public.transactions(kas_id);
create index if not exists idx_transactions_status on public.transactions(status);
create index if not exists idx_transactions_pelean_taon on public.transactions(pelean_taon_year, lingkungan);
create index if not exists idx_families_lingkungan on public.congregation_families(lingkungan);
create index if not exists idx_budgets_kas_tahun on public.budgets(kas_id, tahun);
create index if not exists idx_audit_logs_changed_at on public.audit_logs(changed_at desc);

-- 9. ROW LEVEL SECURITY (RLS), GRANTS & POLICIES
-- Berikan hak akses dasar schema & tabel untuk role anon, authenticated, dan service_role
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- Buka akses tabel publik agar dashboard & RPC client berfungsi langsung
do $$
declare
  tbl text;
  tables text[] := array[
    'profiles', 'kas', 'storage_accounts', 'user_kas_access', 'categories',
    'app_settings', 'fiscal_years', 'transactions', 'period_closings', 'reconciliations',
    'audit_logs', 'opening_setup', 'opening_balances', 'opening_balance_entries',
    'opening_balance_adjustments', 'opening_other_positions', 'prior_year_summaries',
    'budgets', 'budget_items', 'budget_reallocations', 'fixed_assets',
    'asset_depreciations', 'advances', 'advance_settlements', 'receivables_payables',
    'receivable_payable_payments', 'lpj_notes', 'lpj_settings', 'audit_body_members',
    'audit_engagements', 'audit_reviews', 'audit_findings', 'audit_final_opinions',
    'cash_counts', 'audit_period_verifications', 'semester_reports', 'lpj_reports', 'lpj_exceptions',
    'church_lingkungan', 'congregation_families'
  ];
begin
  foreach tbl in array tables loop
    execute format('grant all on table public.%I to anon, authenticated, service_role;', tbl);
    execute format('alter table public.%I enable row level security;', tbl);
    execute format('drop policy if exists "Allow full access for all" on public.%I;', tbl);
    execute format('create policy "Allow full access for all" on public.%I for all using (true) with check (true);', tbl);
  end loop;
end $$;

-- 10. REALTIME CONFIGURATION
-- Aktifkan streaming perubahan data secara real-time untuk seluruh tabel ke frontend dashboard
do $$
declare
  tbl text;
  tables text[] := array[
    'profiles', 'kas', 'storage_accounts', 'user_kas_access', 'categories',
    'app_settings', 'fiscal_years', 'transactions', 'period_closings', 'reconciliations',
    'audit_logs', 'opening_setup', 'opening_balances', 'opening_balance_entries',
    'opening_balance_adjustments', 'opening_other_positions', 'prior_year_summaries',
    'budgets', 'budget_items', 'budget_reallocations', 'fixed_assets',
    'asset_depreciations', 'advances', 'advance_settlements', 'receivables_payables',
    'receivable_payable_payments', 'lpj_notes', 'lpj_settings', 'audit_body_members',
    'audit_engagements', 'audit_reviews', 'audit_findings', 'audit_final_opinions',
    'cash_counts', 'audit_period_verifications', 'semester_reports', 'lpj_reports', 'lpj_exceptions',
    'church_lingkungan', 'congregation_families'
  ];
begin
  for tbl in select unnest(tables) loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', tbl);
    exception when others then null;
    end;
  end loop;
end $$;

-- 11. STORAGE BUCKET FOR RECEIPTS (BUKTI NOTA)
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

drop policy if exists "Public Access Receipts" on storage.objects;
create policy "Public Access Receipts" on storage.objects for all using (bucket_id = 'receipts') with check (bucket_id = 'receipts');

-- 12. INITIAL SEED DATA (DATA AWAL HKBP RESSORT HUTARAJA)

-- Settings
insert into public.app_settings (id, church_name, church_subtext, church_address, church_phone, church_email, pendeta_name, sekretaris_name, bendahara_umum_name, ketua_parartaon_name, bpsk_va_number, receipt_required_threshold, block_negative_balance, active_year, budget_reallocation_max_pct)
values ('main', 'HKBP Ressort Hutaraja', 'Ressort Khusus - Distrik V Sumatera Timur', 'Jl. Gereja No. 1, Hutaraja, Sumatera Utara', '0812-3456-7890', 'ressort.hutaraja@hkbp.or.id', 'Pdt. Santa Lucia Manurung, S.Th', 'St. Sardi Simanullang', 'St. Manaek Lumban Gaol', 'St. Harbet Simanjuntak', 'VA-BPSK HKBP Ressort Hutaraja (Mandiri / BRI)', 500000, true, 2026, 15.00)
on conflict (id) do nothing;

-- Master Tahun Anggaran
insert into public.fiscal_years (id, year, theme, start_date, end_date, status, is_budget_locked, notes) values
('fy-2024', 2024, 'Tahun Oikumene Inklusif HKBP', '2024-01-01', '2024-12-31', 'closed', true, 'Buku kas tahun 2024 telah ditutup dan disahkan dalam Rapat Huria 2024.'),
('fy-2025', 2025, 'Tahun Pemberdayaan Kemitraan HKBP', '2025-01-01', '2025-12-31', 'closed', true, 'Laporan Pertanggungjawaban (LPJ) Keuangan 2025 telah diaudit dan disahkan.'),
('fy-2026', 2026, 'Tahun Transformasi & Oikoumene Inklusif HKBP', '2026-01-01', '2026-12-31', 'active', true, 'Tahun anggaran operasional berjalan resmi Huria.'),
('fy-2027', 2027, 'Tahun Kesehatian Pelayanan & Misi HKBP', '2027-01-01', '2027-12-31', 'planning', false, 'Periode penyusunan RAPB Parartaon tahun anggaran mendatang.')
on conflict (id) do nothing;

-- Opening Setup
insert into public.opening_setup (id, first_year, go_live_date, status, notes)
values ('main', 2026, '2026-01-01', 'in_progress', 'Pembukaan Buku Keuangan HKBP Ressort Hutaraja Tahun 2026')
on conflict (id) do nothing;

-- LPJ Settings & Notes
insert into public.lpj_settings (
  id, enable_depreciation, depreciation_method, budget_variance_threshold_percent, default_advance_days,
  document_number_format, signatories, useful_life_defaults
)
values (
  'main', false, 'straight_line', 10.0, 14,
  'HKBP-HTR/LPJ/{TAHUN}/{NOMOR}',
  '[
    {"role": "Ketua Parartaon", "title": "Ketua Majelis Perbendaharaan", "name": "St. Harbet Simanjuntak"},
    {"role": "Sekretaris Ressort", "title": "Sekretaris Ressort / Parartaon", "name": "St. Sardi Simanullang"},
    {"role": "Bendahara Umum", "title": "Bendahara Umum / Parartaon", "name": "St. Manaek Lumban Gaol"},
    {"role": "Pendeta Ressort", "title": "Pendeta HKBP Ressort Hutaraja", "name": "Pdt. Santa Lucia Manurung, S.Th"}
  ]'::jsonb,
  '{"tanah": 0, "bangunan": 20, "kendaraan": 5, "alat_musik": 5, "elektronik": 4, "perabot": 5, "lainnya": 4}'::jsonb
)
on conflict (id) do nothing;

insert into public.lpj_notes (id, year, accounting_basis, accounting_policies)
values ('lpj-note-2026', 2026, 'Laporan Keuangan HKBP Ressort Hutaraja Tahun 2026 disusun dengan Basis Kas yang Dimodifikasi (Modified Cash Basis) berdasarkan pedoman ISAK 35 untuk Entitas Berorientasi Nonlaba.', 'Pencatatan kas terpisah per seksi, dana terikat dan tidak terikat, aset tetap historis, panjar sebagai piutang berjalan.')
on conflict (id) do nothing;

-- Master Kas (10 Entitas Kas Resmi Huria, Seksi, & Unit Sopo Godang)
insert into public.kas (id, kode, nama, deskripsi, warna, fund_type, restricted_purpose, is_active) values
('kas-1', 'KAS-UMUM', 'Kas Umum Huria', 'Pusat kas operasional huria dan ressort HKBP Hutaraja (Dikelola Bendahara Umum)', '#7C9CF5', 'unrestricted', null, true),
('kas-2', 'KAS-SOSIAL', 'Kas Sosial Huria', 'Dana sosial huria, bantuan kedukaan, sakit, dan diakonia jemaat (Dikelola Bendahara Umum)', '#A8E6CF', 'restricted', 'Pelayanan kasih, bantuan orang sakit, janda/yatim, dan santunan kedukaan', true),
('kas-3', 'KAS-SM', 'Kas Sekolah Minggu', 'Dana pembinaan anak dan guru Sekolah Minggu', '#FFE8A3', 'unrestricted', null, true),
('kas-4', 'KAS-INA', 'Kas Kaum Ibu (Ina)', 'Dana persekutuan dan kegiatan Seksi Parompuan', '#FFB4A2', 'unrestricted', null, true),
('kas-5', 'KAS-AMA', 'Kas Kaum Bapak (Ama)', 'Dana persekutuan dan kegiatan Seksi Ama', '#B8C0FF', 'unrestricted', null, true),
('kas-6', 'KAS-RNHKBP', 'Kas Naposobulung (Pemuda)', 'Dana kegiatan Remaja dan Naposobulung HKBP Hutaraja', '#CDB4FF', 'unrestricted', null, true),
('kas-7', 'KAS-BANGUN', 'Kas Pembangunan', 'Dana renovasi fisik gereja, pastori, dan sarana ibadah (Dikelola Bendahara Umum)', '#FFD166', 'restricted', 'Pembangunan fisik menara lonceng gereja, renovasi pastori ressort, dan sarana ibadah', true),
('kas-8', 'KAS-TRANSITORIS', 'Kas Transitoris', 'Dana titipan sementara / persembahan khusus yang diteruskan ke pihak terkait (Dikelola Bendahara Umum)', '#94A3B8', 'restricted', 'Titipan dana transitoris sebelum disalurkan kepada penerima/lembaga terkait', true),
('kas-9', 'KAS-SENTRAL', 'Kas Sentralisasi', 'Dana tampungan kewajiban 55% Sentralisasi BPSK HKBP sebelum disetor ke Pusat (Dikelola Bendahara Umum)', '#38BDF8', 'restricted', 'Alokasi 55% Sentralisasi Keuangan HKBP untuk penyetoran resmi ke BPSK HKBP', true),
('kas-10', 'KAS-SOPO', 'Kas Sopo Godang', 'Dana operasional, pemeliharaan, dan pengelolaan gedung serbaguna Sopo Godang (Dikelola Pengurus Sopo Godang)', '#F59E0B', 'unrestricted', null, true)
on conflict (id) do nothing;

-- Storage Accounts
insert into public.storage_accounts (id, nama, tipe, nomor_rekening, atas_nama, is_active) values
('stor-1', 'Brankas Tunai Huria', 'cash', null, 'Bendahara HKBP Hutaraja', true),
('stor-2', 'Bank BRI Ressort Hutaraja', 'bank', '3210-01-002345-53-1', 'HKBP Ressort Hutaraja', true),
('stor-3', 'Bank Mandiri Ressort Hutaraja', 'bank', '107-00-1289456-7', 'HKBP Ressort Hutaraja', true)
on conflict (id) do nothing;

-- Master Kategori Resmi PPKU 2023 (20 Penerimaan Sentralisasi & Pengecualian + 10 Pengeluaran)
insert into public.categories (id, nama, tipe, kode, deskripsi, is_active, is_sentralisasi, sentralisasi_group, sentralisasi_exclusion_type) values
-- Penerimaan Objek Sentralisasi (55% BPSK / 45% Huria)
('cat-in-pelean-1-2', 'Pelean Ibadah Ia, Ib & II (Kebaktian Minggu)', 'income', 'IN-01', 'Pelean Ibadah Ia, Ib, dan II kebaktian hari Minggu (PPKU Pasal 4 ayat 3a-c: 55% BPSK maks. H+3 / 45% Kas Huria)', true, true, 'pelean_mingguan', null),
('cat-in-namarboho', 'Pelean Namarboho / Bulanan / Tahunan Jemaat (incl. SM & Remaja)', 'income', 'IN-02', 'Pelean bulanan/tahunan jemaat termasuk Sekolah Minggu & Remaja (PPKU Pasal 4 ayat 3k: 55% BPSK / 45% Huria)', true, true, 'pelean_mingguan', null),
('cat-in-persepuluhan', 'Pelean Persepuluhan Jemaat', 'income', 'IN-02B', 'Persembahan persepuluhan jemaat sesuai PPKU Pasal 4 ayat 3j (Objek Sentralisasi: 55% BPSK HKBP / 45% Kas Huria)', true, true, 'pelean_mingguan', null),
('cat-in-partangiangan', 'Pelean Ibadah Partangiangan (Lingkungan / Wijk)', 'income', 'IN-03', 'Persembahan partangiangan wijk/sektor sesuai PPKU Pasal 4 ayat 3d (55% BPSK HKBP / 45% Huria)', true, true, 'pelean_mingguan', null),
('cat-in-kategorial', 'Pelean Ibadah & Sermon Kategorial / Seksi', 'income', 'IN-04', 'Pelean kebaktian & sermon kategorial (SM, Remaja, Naposo, Ina, Ama, Lansia) sesuai PPKU Pasal 4 ayat 3e (55% BPSK / 45% Huria)', true, true, 'pelean_mingguan', null),
('cat-in-hari-raya', 'Pelean Hari Raya Gerejawi & Ibadah Khusus / Kasual', 'income', 'IN-05', 'Pelean Natal, Tahun Baru, Paskah, Kenaikan, & Ibadah Khusus/Kasual sesuai PPKU Pasal 4 ayat 3h (55% BPSK / 45% Huria)', true, true, 'pelean_mingguan', null),
('cat-in-ulaon-na-badia', 'Pelean Ibadah Ulaon Na Badia (Perjamuan Kudus)', 'income', 'IN-05B', 'Persembahan Sakramen Perjamuan Kudus sesuai PPKU Pasal 4 ayat 3g (Objek Sentralisasi: 55% BPSK HKBP / 45% Huria)', true, true, 'pelean_mingguan', null),
('cat-in-syukur-altar', 'Pelean Hamauliateon (Syukur Altar / Panggung / Amplop)', 'income', 'IN-06', 'Persembahan syukur jemaat amplop/kotak altar (Objek Sentralisasi: 55% BPSK HKBP / 45% Huria)', true, true, 'pelean_syukur', null),
('cat-in-syukur-baptisan', 'Pelean Syukur Baptisan Kudus (Pandidion)', 'income', 'IN-07', 'Ucapan syukur atas sakramen baptisan kudus (Objek Sentralisasi: 55% BPSK HKBP / 45% Huria)', true, true, 'pelean_syukur', null),
('cat-in-syukur-sidi', 'Pelean Syukur Peneguhan Sidi (Malua)', 'income', 'IN-08', 'Ucapan syukur atas peneguhan sidi jemaat (Objek Sentralisasi: 55% BPSK HKBP / 45% Huria)', true, true, 'pelean_syukur', null),
('cat-in-syukur-nikah', 'Pelean Syukur Pernikahan Kudus (Pamasu-masuon)', 'income', 'IN-09', 'Ucapan syukur pemberkatan pernikahan jemaat (Objek Sentralisasi: 55% BPSK HKBP / 45% Huria)', true, true, 'pelean_syukur', null),
('cat-in-syukur-keluarga', 'Pelean Syukur Keluarga & Syukur Khusus Lainnya', 'income', 'IN-10', 'Ucapan syukur keluarga, ulang tahun, dll (Objek Sentralisasi: 55% BPSK HKBP / 45% Huria)', true, true, 'pelean_syukur', null),
('cat-in-badan-usaha', 'Keuntungan Badan Usaha Milik HKBP', 'income', 'IN-11', 'Penerimaan bagi hasil / keuntungan badan usaha HKBP (Objek Sentralisasi: 55% BPSK HKBP / 45% Huria)', true, true, 'badan_usaha_lembaga', null),
('cat-in-yayasan', 'Kontribusi / Sumbangan Yayasan di Bawah HKBP', 'income', 'IN-12', 'Kontribusi resmi yayasan naungan HKBP (Objek Sentralisasi: 55% BPSK HKBP / 45% Huria)', true, true, 'badan_usaha_lembaga', null),
('cat-in-sewa-aset-yayasan', 'Sewa Aset dari Yayasan HKBP', 'income', 'IN-12B', 'Penerimaan sewa aset dari yayasan di lingkungan HKBP sesuai PPKU Pasal 4 ayat 2c (55% BPSK / 45% Huria)', true, true, 'badan_usaha_lembaga', null),
('cat-in-pendidikan-tinggi', 'Keuntungan Lembaga Pendidikan Tinggi HKBP', 'income', 'IN-13', 'Penerimaan resmi dari perguruan tinggi / lembaga pendidikan HKBP (Objek Sentralisasi: 55% BPSK / 45% Huria)', true, true, 'badan_usaha_lembaga', null),
('cat-in-hibah-eksternal', 'Bantuan, Hibah, & Sumbangan Resmi Pihak Luar', 'income', 'IN-14', 'Bantuan/dana hibah pihak luar sah seizin Pimpinan HKBP (Objek Sentralisasi: 55% BPSK HKBP / 45% Huria)', true, true, 'badan_usaha_lembaga', null),
-- Penerimaan Dikecualikan (100% Non-Sentralisasi)
('cat-in-ex-sosial-duka', 'Pelean Sosial / Duka (Pelean Sosial / Gariana)', 'income', 'IN-EX-01', 'Dikecualikan dari Sentralisasi: 100% dikelola untuk jemaat yang berduka / kemalangan (Kas Diakonia Sosial)', true, false, 'dikecualikan_khusus', 'sosial_duka'),
('cat-in-ex-beasiswa', 'Pelean Beasiswa (Pelean Dana Belajar)', 'income', 'IN-EX-02', 'Dikecualikan dari Sentralisasi: 100% dikelola khusus untuk bantuan pendidikan / beasiswa jemaat', true, false, 'dikecualikan_khusus', 'beasiswa'),
('cat-in-ex-pembangunan', 'Dana Pembangunan Fisik Lokal', 'income', 'IN-EX-03', 'Dikecualikan dari Sentralisasi: 100% dikelola kepanitiaan pembangunan untuk renovasi / pembangunan fisik gereja lokal', true, false, 'dikecualikan_khusus', 'pembangunan_lokal'),
-- Pos Pengeluaran / Beban
('cat-out-bpsk', 'Penyetoran 55% Sentralisasi ke Kas Pusat (BPSK HKBP)', 'expense', 'OUT-01', 'Penyetoran kewajiban sentralisasi 55% ke rekening BPSK HKBP Kantor Pusat', true, false, null, null),
('cat-out-operasional-huria', 'Operasional & Administrasi Pelayanan Huria (45%)', 'expense', 'OUT-02', 'Beban operasional rutin pelayanan lokal huria dari porsi 45%', true, false, null, null),
('cat-out-ibadah', 'Pelayanan Ibadah & Hari Besar Gerejawi', 'expense', 'OUT-03', 'Perlengkapan perjamuan, lilin, cetak warta, konsumsi majelis, dekorasi ibadah', true, false, null, null),
('cat-out-kategorial', 'Kegiatan Seksi Kategorial (Koinonia, Marturia, Diakonia)', 'expense', 'OUT-04', 'Program kerja seksi Sekolah Minggu, Remaja, Pemuda, Ina, Ama, Lansia', true, false, null, null),
('cat-out-sosial-duka', 'Penyaluran Santunan Sosial / Duka (Dana Gariana)', 'expense', 'OUT-05', 'Penyaluran dana duka/kemalangan bagi keluarga jemaat yang berduka', true, false, null, null),
('cat-out-beasiswa', 'Penyaluran Bantuan Beasiswa (Dana Belajar)', 'expense', 'OUT-06', 'Bantuan biaya pendidikan siswa dan mahasiswa berprestasi / kurang mampu', true, false, null, null),
('cat-out-pembangunan', 'Pengeluaran Pembangunan & Renovasi Fisik Gereja', 'expense', 'OUT-07', 'Pembelian material dan upah tukang proyek pembangunan fisik gereja lokal', true, false, null, null),
('cat-out-gedung', 'Pemeliharaan Gedung, Gereja & Inventaris', 'expense', 'OUT-08', 'Perbaikan sarana ibadah, sound system, AC, pengecatan gedung gereja', true, false, null, null),
('cat-out-utilitas', 'Listrik, Air, Telepon & Internet Gereja', 'expense', 'OUT-09', 'Beban langganan utilitas operasional kantor dan gedung gereja', true, false, null, null),
('cat-out-lainnya', 'Pengeluaran Lain-lain yang Sah', 'expense', 'OUT-99', 'Pengeluaran sah lainnya yang disetujui pimpinan jemaat', true, false, null, null)
on conflict (id) do nothing;

-- Initial Saldo Awal (Rp 0)
insert into public.opening_balances (id, tahun, kas_id, storage_account_id, amount, notes) values
('ob-1', 2026, 'kas-1', 'stor-1', 0, 'Brankas Tunai Kas Umum Huria'),
('ob-2', 2026, 'kas-1', 'stor-2', 0, 'Bank BRI Kas Umum Huria'),
('ob-3', 2026, 'kas-2', 'stor-1', 0, 'Brankas Kas Sosial Huria'),
('ob-4', 2026, 'kas-3', 'stor-1', 0, 'Brankas Kas Sekolah Minggu'),
('ob-5', 2026, 'kas-4', 'stor-1', 0, 'Brankas Kas Kaum Ibu'),
('ob-6', 2026, 'kas-5', 'stor-1', 0, 'Brankas Kas Kaum Bapak'),
('ob-7', 2026, 'kas-6', 'stor-1', 0, 'Brankas Kas Pemuda'),
('ob-8', 2026, 'kas-7', 'stor-3', 0, 'Bank Mandiri Kas Pembangunan'),
('ob-9', 2026, 'kas-8', 'stor-1', 0, 'Brankas Kas Transitoris'),
('ob-10', 2026, 'kas-9', 'stor-2', 0, 'Bank BRI Kas Sentralisasi'),
('ob-11', 2026, 'kas-10', 'stor-1', 0, 'Brankas Kas Sopo Godang')
on conflict (id) do nothing;

-- Initial Opening Balance Entries (Drafting Rp 0 siap pembukaan buku)
insert into public.opening_balance_entries (id, tahun, kas_id, storage_account_id, amount, book_balance, physical_balance, difference, explanation, status, created_by) values
('obe-1', 2026, 'kas-1', 'stor-1', 0, 0, 0, 0, 'Saldo awal tunai brankas direset ke nol', 'drafting', 'user-bendum'),
('obe-2', 2026, 'kas-1', 'stor-2', 0, 0, 0, 0, 'Saldo awal rekening BRI direset ke nol', 'drafting', 'user-bendum'),
('obe-3', 2026, 'kas-2', 'stor-1', 0, 0, 0, 0, 'Saldo awal Kas Sosial Huria direset ke nol', 'drafting', 'user-bendum'),
('obe-4', 2026, 'kas-7', 'stor-3', 0, 0, 0, 0, 'Saldo awal Kas Pembangunan direset ke nol', 'drafting', 'user-bendum'),
('obe-5', 2026, 'kas-3', 'stor-1', 0, 0, 0, 0, 'Saldo awal Kas Sekolah Minggu direset ke nol', 'drafting', 'user-bend-sm'),
('obe-6', 2026, 'kas-4', 'stor-1', 0, 0, 0, 0, 'Saldo awal Kas Kaum Ibu direset ke nol', 'drafting', 'user-bend-ina'),
('obe-7', 2026, 'kas-5', 'stor-1', 0, 0, 0, 0, 'Saldo awal Kas Kaum Bapak direset ke nol', 'drafting', 'user-bendum'),
('obe-8', 2026, 'kas-6', 'stor-1', 0, 0, 0, 0, 'Saldo awal Kas Pemuda direset ke nol', 'drafting', 'user-bendum'),
('obe-9', 2026, 'kas-8', 'stor-1', 0, 0, 0, 0, 'Saldo awal Kas Transitoris direset ke nol', 'drafting', 'user-bendum'),
('obe-10', 2026, 'kas-9', 'stor-2', 0, 0, 0, 0, 'Saldo awal Kas Sentralisasi direset ke nol', 'drafting', 'user-bendum'),
('obe-11', 2026, 'kas-10', 'stor-1', 0, 0, 0, 0, 'Saldo awal Kas Sopo Godang direset ke nol', 'drafting', 'user-sopo-bendahara')
on conflict (id) do nothing;

-- Initial Profiles (Struktural Lengkap HKBP Ressort Hutaraja)
-- Password awal standar: 'Hkbp2026!' (Admin dapat mengubah masing-masing akun di Data Master -> Pengguna)
insert into public.profiles (id, email, full_name, role, ecclesiastical_role, tohonan, tingkat, seksi_name, wijk, phone, password_hash, is_active) values
('user-admin', 'admin@hkbp-hutaraja.org', 'St. P. Sitompul (Admin Sistem)', 'admin', 'admin_sistem', 'sintua', 'huria', null, 'Wijk II', '0812-1111-2222', encode(digest('SISKEU-HKBP-HUTARAJA:Hkbp2026!', 'sha256'), 'hex'), true),
('user-pendeta', 'pendeta@hkbp-hutaraja.org', 'Pdt. Santa Lucia Manurung, S.Th (Pendeta Ressort)', 'pendeta_ressort', 'pendeta_ressort', 'pendeta', 'ressort', null, null, '0811-3333-4444', encode(digest('SISKEU-HKBP-HUTARAJA:Hkbp2026!', 'sha256'), 'hex'), true),
('user-sekretaris', 'sekretaris@hkbp-hutaraja.org', 'St. Sardi Simanullang (Sekretaris Ressort / Parartaon)', 'sekretaris', 'sekretaris_huria', 'sintua', 'ressort', 'Majelis Perbendaharaan (Parartaon)', 'Wijk I', '0812-4444-5555', encode(digest('SISKEU-HKBP-HUTARAJA:Hkbp2026!', 'sha256'), 'hex'), true),
('user-bendum', 'bendum@hkbp-hutaraja.org', 'St. Manaek Lumban Gaol (Bendahara Umum / Parartaon)', 'bendahara_umum', 'bendahara_huria', 'sintua', 'huria', 'Majelis Perbendaharaan (Parartaon)', 'Wijk I', '0813-2222-3333', encode(digest('SISKEU-HKBP-HUTARAJA:Hkbp2026!', 'sha256'), 'hex'), true),
('user-parartaon-ketua', 'parartaon.ketua@hkbp-hutaraja.org', 'St. Harbet Simanjuntak (Ketua Parartaon)', 'majelis', 'majelis_perbendaharaan', 'sintua', 'huria', 'Ketua Majelis Perbendaharaan (Parartaon)', 'Wijk II', '0812-4321-8761', encode(digest('SISKEU-HKBP-HUTARAJA:Hkbp2026!', 'sha256'), 'hex'), true),
('user-parartaon-1', 'parartaon.oloan@hkbp-hutaraja.org', 'St. Oloan Silaban (Anggota Parartaon)', 'majelis', 'majelis_perbendaharaan', 'sintua', 'huria', 'Anggota Majelis Perbendaharaan (Parartaon)', 'Wijk III', '0812-4321-8762', encode(digest('SISKEU-HKBP-HUTARAJA:Hkbp2026!', 'sha256'), 'hex'), true),
('user-parartaon-2', 'parartaon.tohap@hkbp-hutaraja.org', 'St. Tohap Sihombing (Anggota Parartaon)', 'majelis', 'majelis_perbendaharaan', 'sintua', 'huria', 'Anggota Majelis Perbendaharaan (Parartaon)', 'Wijk IV', '0812-4321-8763', encode(digest('SISKEU-HKBP-HUTARAJA:Hkbp2026!', 'sha256'), 'hex'), true),
('user-dewan-koinonia', 'koinonia@hkbp-hutaraja.org', 'St. Sondang Samosir (Ketua Dewan Koinonia)', 'pengurus_kas', 'ketua_dewan_koinonia', 'sintua', 'huria', 'Dewan Koinonia', 'Wijk III', '0812-3434-5656', encode(digest('SISKEU-HKBP-HUTARAJA:Hkbp2026!', 'sha256'), 'hex'), true),
('user-dewan-diakonia', 'dewan.diakonia@hkbp-hutaraja.org', 'St. Juangga Sihite (Ketua Dewan Diakonia)', 'pengurus_kas', 'ketua_dewan_diakonia', 'sintua', 'huria', 'Dewan Diakonia', 'Wijk V', '0812-6666-7777', encode(digest('SISKEU-HKBP-HUTARAJA:Hkbp2026!', 'sha256'), 'hex'), true),
('user-dewan-marturia', 'marturia@hkbp-hutaraja.org', 'St. Parulian Simaremare (Ketua Dewan Marturia)', 'pengurus_kas', 'ketua_dewan_marturia', 'sintua', 'huria', 'Dewan Marturia', 'Wijk VI', '0812-7777-5555', encode(digest('SISKEU-HKBP-HUTARAJA:Hkbp2026!', 'sha256'), 'hex'), true),
('user-sopo-ketua', 'sopo.ketua@hkbp-hutaraja.org', 'Dedi Tumanggor (Ketua Pengurus Sopo Godang)', 'pengurus_kas', 'pengurus_sopo_godang', 'non_tahbisan', 'huria', 'Pengurus Sopo Godang', null, '0813-1111-4401', encode(digest('SISKEU-HKBP-HUTARAJA:Hkbp2026!', 'sha256'), 'hex'), true),
('user-sopo-sekretaris', 'sopo.sekretaris@hkbp-hutaraja.org', 'Usuawan Simanullang (Sekretaris Sopo Godang)', 'pengurus_kas', 'pengurus_sopo_godang', 'non_tahbisan', 'huria', 'Pengurus Sopo Godang', null, '0813-1111-4402', encode(digest('SISKEU-HKBP-HUTARAJA:Hkbp2026!', 'sha256'), 'hex'), true),
('user-sopo-bendahara', 'sopo.bendahara@hkbp-hutaraja.org', 'Ria Mega Panjaitan (Bendahara Sopo Godang)', 'pengurus_kas', 'pengurus_sopo_godang', 'non_tahbisan', 'huria', 'Pengurus Sopo Godang', null, '0813-1111-4403', encode(digest('SISKEU-HKBP-HUTARAJA:Hkbp2026!', 'sha256'), 'hex'), true),
('user-bend-sm', 'sm.bendahara@hkbp-hutaraja.org', 'Sdri. L. Panjaitan (Bendahara Sekolah Minggu)', 'pengurus_kas', 'pengurus_seksi_sekolah_minggu', 'non_tahbisan', 'huria', 'Seksi Sekolah Minggu', null, '0813-7777-8888', encode(digest('SISKEU-HKBP-HUTARAJA:Hkbp2026!', 'sha256'), 'hex'), true),
('user-ketua-sm', 'sm.ketua@hkbp-hutaraja.org', 'St. E. Manurung (Ketua Seksi Sekolah Minggu)', 'pengurus_kas', 'pengurus_seksi_sekolah_minggu', 'sintua', 'huria', 'Seksi Sekolah Minggu', 'Wijk II', '0811-8888-9999', encode(digest('SISKEU-HKBP-HUTARAJA:Hkbp2026!', 'sha256'), 'hex'), true),
('user-bend-ina', 'ina.bendahara@hkbp-hutaraja.org', 'Ny. M. Boru Tampubolon (Bendahara Kaum Ibu)', 'pengurus_kas', 'pengurus_seksi_parompuan', 'non_tahbisan', 'huria', 'Seksi Parompuan', null, '0812-9999-0000', encode(digest('SISKEU-HKBP-HUTARAJA:Hkbp2026!', 'sha256'), 'hex'), true),
('user-audit-ketua', 'audit.ketua@hkbp-hutaraja.org', 'Sabar Sianturi, S.E (Ketua Badan Audit)', 'auditor', 'ketua_badan_audit', 'non_tahbisan', 'huria', 'Badan Audit Huria (Ketua merangkap Anggota)', null, '0812-7070-8080', encode(digest('SISKEU-HKBP-HUTARAJA:Hkbp2026!', 'sha256'), 'hex'), true),
('user-audit-1', 'audit.anggota1@hkbp-hutaraja.org', 'Hendra Supreddi Simaremare, S.I.P (Anggota Badan Audit)', 'auditor', 'anggota_badan_audit', 'non_tahbisan', 'huria', 'Badan Audit Huria (Anggota)', null, '0813-8080-9090', encode(digest('SISKEU-HKBP-HUTARAJA:Hkbp2026!', 'sha256'), 'hex'), true),
('user-audit-2', 'audit.anggota2@hkbp-hutaraja.org', 'Zico Andrianus Simanjuntak (Anggota Badan Audit)', 'auditor', 'anggota_badan_audit', 'non_tahbisan', 'huria', 'Badan Audit Huria (Anggota)', null, '0812-9090-0101', encode(digest('SISKEU-HKBP-HUTARAJA:Hkbp2026!', 'sha256'), 'hex'), true)
on conflict (id) do update set password_hash = coalesce(public.profiles.password_hash, excluded.password_hash);

-- User Kas Access
insert into public.user_kas_access (id, user_id, kas_id, access_level) values
('uka-1', 'user-bendum', 'kas-1', 'bendahara'),
('uka-2', 'user-bendum', 'kas-2', 'bendahara'),
('uka-3', 'user-bendum', 'kas-7', 'bendahara'),
('uka-4', 'user-bendum', 'kas-8', 'bendahara'),
('uka-5', 'user-bendum', 'kas-9', 'bendahara'),
('uka-6', 'user-pendeta', 'kas-1', 'ketua'),
('uka-7', 'user-sekretaris', 'kas-1', 'ketua'),
('uka-8', 'user-sekretaris', 'kas-2', 'ketua'),
('uka-9', 'user-sekretaris', 'kas-7', 'ketua'),
('uka-10', 'user-sekretaris', 'kas-8', 'ketua'),
('uka-11', 'user-sekretaris', 'kas-9', 'ketua'),
('uka-12', 'user-dewan-diakonia', 'kas-2', 'ketua'),
('uka-13', 'user-dewan-koinonia', 'kas-3', 'ketua'),
('uka-14', 'user-dewan-koinonia', 'kas-4', 'ketua'),
('uka-15', 'user-dewan-koinonia', 'kas-5', 'ketua'),
('uka-16', 'user-dewan-koinonia', 'kas-6', 'ketua'),
('uka-17', 'user-bend-sm', 'kas-3', 'bendahara'),
('uka-18', 'user-ketua-sm', 'kas-3', 'ketua'),
('uka-19', 'user-bend-ina', 'kas-4', 'bendahara'),
('uka-20', 'user-sopo-ketua', 'kas-10', 'ketua'),
('uka-21', 'user-sopo-sekretaris', 'kas-10', 'ketua'),
('uka-22', 'user-sopo-bendahara', 'kas-10', 'bendahara'),
('uka-23', 'user-dewan-marturia', 'kas-1', 'ketua')
on conflict (id) do nothing;

-- Badan Audit Members
insert into public.audit_body_members (id, user_id, jabatan, periode_mulai, periode_selesai, aktif) values
('abm-1', 'user-audit-ketua', 'ketua', '2025-01-01', '2027-01-01', true),
('abm-2', 'user-audit-1', 'anggota', '2025-01-01', '2027-01-01', true),
('abm-3', 'user-audit-2', 'anggota', '2025-01-01', '2027-01-01', true)
on conflict (id) do nothing;

-- Audit Engagements Awal
insert into public.audit_engagements (id, tahun, jenis, judul, deskripsi, semester_report_id, lpj_id, status, dibuka_pada, batas_waktu, combined_with_lpj, created_by) values
('eng-opening', 2026, 'opening', 'Pemeriksaan Saldo Awal & Pembukaan Buku SISKEU 2026', 'Audit independen atas migrasi saldo pindahan buku manual ke sistem digital per 1 Januari 2026', null, null, 'completed', '2026-01-02', '2026-01-10', false, 'user-audit-ketua'),
('eng-sem1', 2026, 'semester_1', 'Pemeriksaan Keuangan Semester I Tahun 2026', 'Audit berkala realisasi pendapatan, belanja, kas fisik, dan panjar periode Januari - Juni 2026', 'sem-rep-1', null, 'completed', '2026-07-01', '2026-07-15', false, 'user-audit-ketua'),
('eng-tahunan', 2026, 'tahunan', 'Pemeriksaan Laporan Pertanggungjawaban (LPJ) Tahunan ISAK 35 Tahun 2026', 'Audit menyeluruh laporan keuangan tahunan huria dan ressort sebelum diajukan ke Rapat Huria', null, 'lpj-rep-2026', 'in_progress', '2026-12-15', '2027-01-15', true, 'user-audit-ketua')
on conflict (id) do nothing;

-- Semester Reports & LPJ Reports Awal
insert into public.semester_reports (id, tahun, semester, status, version, checklist_result, created_by) values
('sem-rep-1', 2026, 1, 'preparation', 1, '{"months_closed": false, "no_draft_transactions": true, "storages_reconciled": false, "advances_reviewed": true, "budget_variance_explained": false, "prior_findings_resolved": true, "details": {}}'::jsonb, 'user-bendum'),
('sem-rep-2', 2026, 2, 'preparation', 1, '{"months_closed": false, "no_draft_transactions": true, "storages_reconciled": false, "advances_reviewed": true, "budget_variance_explained": false, "prior_findings_resolved": true, "details": {}}'::jsonb, 'user-bendum')
on conflict (id) do nothing;

insert into public.lpj_reports (id, tahun, nomor_dokumen, status, version, checklist_result, created_by) values
('lpj-rep-2026', 2026, 'HKBP-HTR/LPJ/2026/001', 'preparation', 1, '{"all_months_closed": false, "no_pending_transactions": true, "all_reconciliations_completed": false, "overdue_advances_cleared_or_reserved": true, "budget_deviations_clarified": false, "audit_findings_settled": true, "inventory_physical_checked": false, "details": {}}'::jsonb, 'user-bendum')
on conflict (id) do nothing;

insert into public.lpj_exceptions (id, target_type, target_id, rule_code, reason, granted_by, granted_at) values
('exc-1', 'semester', 'sem-rep-1', 'advances_reviewed', 'Dispensasi awal contoh pada template sistem.', 'user-bendum', '2026-07-05T09:00:00Z')
on conflict (id) do nothing;

-- Lingkungan / Wijk Jemaat Awal HKBP Hutaraja
insert into public.church_lingkungan (id, nama, kode, urutan, is_active) values
('ling-efesus', 'Efesus', 'EFS', 1, true),
('ling-letare', 'Letare', 'LTR', 2, true),
('ling-exaudi', 'Exaudi', 'EXD', 3, true),
('ling-judika', 'Judika', 'JDK', 4, true),
('ling-galatia', 'Galatia', 'GLT', 5, true),
('ling-jeremia', 'Jeremia', 'JRM', 6, true)
on conflict (id) do nothing;
