-- =============================================================================
-- MIGRATION 07: TANGGAL WARTA, PELEAN TAON, MASTER KELUARGA, & KEEPALIVE
-- =============================================================================
-- Skrip ini 100% AMAN (NON-DESTRUKTIF) dan IDEMPOTENT:
-- 1. TIDAK menghapus, mengubah, atau menimpa data transaksi, kas, saldo,
--    pengguna, password, maupun pengaturan yang sudah ada di Supabase.
-- 2. Hanya menambahkan kolom baru pada tabel `transactions` (baris lama tetap utuh).
-- 3. Membuat tabel baru (`church_lingkungan`, `congregation_families`, `keepalive`)
--    jika belum ada, lengkap dengan index, RLS policy, dan Realtime.
-- 4. Mendukung workflow GitHub Actions `.github/workflows/supabase-keepalive.yml`.
--
-- CARA PENGGUNAAN:
-- Buka Supabase Dashboard -> SQL Editor -> New Query -> Paste -> Run
-- =============================================================================

begin;

-- 1. Tambah kolom Tanggal Warta & Pelean Taon pada tabel `transactions` (tanpa mengubah data lama)
alter table public.transactions add column if not exists tanggal_warta date;
alter table public.transactions add column if not exists pelean_taon_year integer;
alter table public.transactions add column if not exists family_id text;
alter table public.transactions add column if not exists family_name text;
alter table public.transactions add column if not exists lingkungan text;

-- 2. Tabel Master Lingkungan / Wijk Jemaat
create table if not exists public.church_lingkungan (
  id text primary key default gen_random_uuid()::text,
  nama text unique not null,
  kode text,
  urutan integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Isi daftar lingkungan awal HANYA jika tabel masih kosong total
insert into public.church_lingkungan (id, nama, kode, urutan, is_active)
select v.id, v.nama, v.kode, v.urutan, v.is_active
from (values
  ('ling-efesus', 'Efesus', 'EFS', 1, true),
  ('ling-letare', 'Letare', 'LTR', 2, true),
  ('ling-exaudi', 'Exaudi', 'EXD', 3, true),
  ('ling-judika', 'Judika', 'JDK', 4, true),
  ('ling-galatia', 'Galatia', 'GLT', 5, true),
  ('ling-jeremia', 'Jeremia', 'JRM', 6, true)
) as v(id, nama, kode, urutan, is_active)
where not exists (select 1 from public.church_lingkungan limit 1)
on conflict do nothing;

-- 3. Tabel Master Data Keluarga Jemaat per Lingkungan (untuk Pelean Taon)
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

-- 4. Tabel Keep Alive (untuk ping otomatis dari GitHub Actions `supabase-keepalive.yml`)
create table if not exists public.keepalive (
  id integer primary key
);

do $$
begin
  -- Isi 1 baris hanya jika tabel masih kosong (aman jika struktur/tipe kolom berbeda)
  if not exists (select 1 from public.keepalive limit 1) then
    begin
      insert into public.keepalive (id) values (1) on conflict do nothing;
    exception when others then null;
    end;
  end if;
end $$;

-- 5. Indeks untuk performa query Rekap Pelean Taon & Warta
create index if not exists idx_transactions_pelean_taon
  on public.transactions(pelean_taon_year, lingkungan);

create index if not exists idx_transactions_tanggal_warta
  on public.transactions(tanggal_warta desc);

create index if not exists idx_families_lingkungan
  on public.congregation_families(lingkungan);

-- 6. Hak Akses & Row Level Security (HANYA pada tabel baru)
grant usage on schema public to anon, authenticated, service_role;

grant all on table public.church_lingkungan to anon, authenticated, service_role;
alter table public.church_lingkungan enable row level security;
drop policy if exists "Allow full access for all" on public.church_lingkungan;
create policy "Allow full access for all"
  on public.church_lingkungan for all
  using (true)
  with check (true);

grant all on table public.congregation_families to anon, authenticated, service_role;
alter table public.congregation_families enable row level security;
drop policy if exists "Allow full access for all" on public.congregation_families;
create policy "Allow full access for all"
  on public.congregation_families for all
  using (true)
  with check (true);

-- Keepalive cukup read-only (SELECT); pertahankan policy lama jika sudah ada
grant select on table public.keepalive to anon, authenticated, service_role;
alter table public.keepalive enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'keepalive'
  ) then
    create policy "Allow public read keepalive"
      on public.keepalive for select
      using (true);
  end if;
end $$;

-- 7. Aktifkan Realtime untuk tabel master baru (aman jika sudah terdaftar)
do $$
begin
  begin
    alter publication supabase_realtime add table public.church_lingkungan;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.congregation_families;
  exception when others then null;
  end;
end $$;

-- 8. Segarkan schema cache PostgREST agar kolom baru langsung terbaca API
notify pgrst, 'reload schema';

commit;
