-- ==============================================================================
-- MIGRATION 06: STRUKTUR PENGURUS RESMI, 10 KAS HURIA/UNIT, & BADAN AUDIT
-- ==============================================================================
-- Jalankan migrasi ini di Supabase SQL Editor untuk memperbarui susunan pengurus,
-- daftar 10 kas resmi (termasuk Kas Transitoris, Kas Sentralisasi, Kas Sopo Godang),
-- hak akses kas, serta susunan Badan Audit Huria tanpa mengganggu data transaksi yang ada.

-- 1. Perbarui Pengaturan Pimpinan Resmi Huria / Ressort
insert into public.app_settings (
  id, church_name, church_subtext, church_address, church_phone, church_email,
  pendeta_name, sekretaris_name, bendahara_umum_name, receipt_required_threshold,
  block_negative_balance, active_year
) values (
  'main', 'HKBP Ressort Hutaraja', 'Ressort Khusus - Distrik V Sumatera Timur',
  'Jl. Gereja No. 1, Hutaraja, Sumatera Utara', '0812-3456-7890', 'ressort.hutaraja@hkbp.or.id',
  'Pdt. Santa Lucia Manurung, S.Th', 'St. Sardi Simanullang', 'St. Manaek Lumban Gaol',
  500000, true, 2026
)
on conflict (id) do update set
  pendeta_name = excluded.pendeta_name,
  sekretaris_name = excluded.sekretaris_name,
  bendahara_umum_name = excluded.bendahara_umum_name,
  updated_at = now();

-- 2. Perbarui / Tambahkan 10 Entitas Kas Resmi
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
on conflict (id) do update set
  kode = excluded.kode,
  nama = excluded.nama,
  deskripsi = excluded.deskripsi,
  warna = excluded.warna,
  fund_type = excluded.fund_type,
  restricted_purpose = excluded.restricted_purpose,
  is_active = excluded.is_active,
  updated_at = now();

-- 3. Tambahkan Saldo Awal Nol (0) untuk Kas Baru Jika Belum Ada
insert into public.opening_balances (id, tahun, kas_id, storage_account_id, amount, notes) values
  ('ob-9', 2026, 'kas-8', 'stor-2', 0, 'Saldo Awal Kas Transitoris'),
  ('ob-10', 2026, 'kas-9', 'stor-2', 0, 'Saldo Awal Kas Sentralisasi'),
  ('ob-11', 2026, 'kas-10', 'stor-1', 0, 'Saldo Awal Kas Sopo Godang')
on conflict (id) do nothing;

-- 4. Perbarui & Tambahkan Profil Pengurus, Parartaon, Dewan, Sopo Godang & Badan Audit
insert into public.profiles (id, email, full_name, role, ecclesiastical_role, tohonan, tingkat, seksi_name, wijk, phone, is_active) values
  ('user-admin', 'admin@hkbp-hutaraja.org', 'St. P. Sitompul (Admin Sistem)', 'admin', 'admin_sistem', 'sintua', 'huria', null, 'Wijk II', '0812-1111-2222', true),
  ('user-pendeta', 'pendeta@hkbp-hutaraja.org', 'Pdt. Santa Lucia Manurung, S.Th (Pendeta Ressort)', 'pendeta_ressort', 'pendeta_ressort', 'pendeta', 'ressort', null, null, '0811-3333-4444', true),
  ('user-sekretaris', 'sekretaris@hkbp-hutaraja.org', 'St. Sardi Simanullang (Sekretaris Ressort / Parartaon)', 'sekretaris', 'sekretaris_huria', 'sintua', 'ressort', 'Majelis Perbendaharaan (Parartaon)', 'Wijk I', '0812-4444-5555', true),
  ('user-bendum', 'bendum@hkbp-hutaraja.org', 'St. Manaek Lumban Gaol (Bendahara Umum / Parartaon)', 'bendahara_umum', 'bendahara_huria', 'sintua', 'huria', 'Majelis Perbendaharaan (Parartaon)', 'Wijk I', '0813-2222-3333', true),
  ('user-parartaon-ketua', 'parartaon.ketua@hkbp-hutaraja.org', 'St. Harbet Simanjuntak (Ketua Parartaon)', 'majelis', 'majelis_perbendaharaan', 'sintua', 'huria', 'Ketua Majelis Perbendaharaan (Parartaon)', 'Wijk II', '0812-4321-8761', true),
  ('user-parartaon-1', 'parartaon.oloan@hkbp-hutaraja.org', 'St. Oloan Silaban (Anggota Parartaon)', 'majelis', 'majelis_perbendaharaan', 'sintua', 'huria', 'Anggota Majelis Perbendaharaan (Parartaon)', 'Wijk III', '0812-4321-8762', true),
  ('user-parartaon-2', 'parartaon.tohap@hkbp-hutaraja.org', 'St. Tohap Sihombing (Anggota Parartaon)', 'majelis', 'majelis_perbendaharaan', 'sintua', 'huria', 'Anggota Majelis Perbendaharaan (Parartaon)', 'Wijk IV', '0812-4321-8763', true),
  ('user-dewan-koinonia', 'koinonia@hkbp-hutaraja.org', 'St. Sondang Samosir (Ketua Dewan Koinonia)', 'pengurus_kas', 'ketua_dewan_koinonia', 'sintua', 'huria', 'Dewan Koinonia', 'Wijk III', '0812-3434-5656', true),
  ('user-dewan-diakonia', 'dewan.diakonia@hkbp-hutaraja.org', 'St. Juangga Sihite (Ketua Dewan Diakonia)', 'pengurus_kas', 'ketua_dewan_diakonia', 'sintua', 'huria', 'Dewan Diakonia', 'Wijk V', '0812-6666-7777', true),
  ('user-dewan-marturia', 'marturia@hkbp-hutaraja.org', 'St. Parulian Simaremare (Ketua Dewan Marturia)', 'pengurus_kas', 'ketua_dewan_marturia', 'sintua', 'huria', 'Dewan Marturia', 'Wijk VI', '0812-7777-5555', true),
  ('user-sopo-ketua', 'sopo.ketua@hkbp-hutaraja.org', 'Dedi Tumanggor (Ketua Pengurus Sopo Godang)', 'pengurus_kas', 'pengurus_sopo_godang', 'non_tahbisan', 'huria', 'Pengurus Sopo Godang', null, '0813-1111-4401', true),
  ('user-sopo-sekretaris', 'sopo.sekretaris@hkbp-hutaraja.org', 'Usuawan Simanullang (Sekretaris Sopo Godang)', 'pengurus_kas', 'pengurus_sopo_godang', 'non_tahbisan', 'huria', 'Pengurus Sopo Godang', null, '0813-1111-4402', true),
  ('user-sopo-bendahara', 'sopo.bendahara@hkbp-hutaraja.org', 'Ria Mega Panjaitan (Bendahara Sopo Godang)', 'pengurus_kas', 'pengurus_sopo_godang', 'non_tahbisan', 'huria', 'Pengurus Sopo Godang', null, '0813-1111-4403', true),
  ('user-audit-ketua', 'audit.ketua@hkbp-hutaraja.org', 'Sabar Sianturi, S.E (Ketua Badan Audit)', 'auditor', 'ketua_badan_audit', 'non_tahbisan', 'huria', 'Badan Audit Huria (Ketua merangkap Anggota)', null, '0812-7070-8080', true),
  ('user-audit-1', 'audit.anggota1@hkbp-hutaraja.org', 'Hendra Supreddi Simaremare, S.I.P (Anggota Badan Audit)', 'auditor', 'anggota_badan_audit', 'non_tahbisan', 'huria', 'Badan Audit Huria (Anggota)', null, '0813-8080-9090', true),
  ('user-audit-2', 'audit.anggota2@hkbp-hutaraja.org', 'Zico Andrianus Simanjuntak (Anggota Badan Audit)', 'auditor', 'anggota_badan_audit', 'non_tahbisan', 'huria', 'Badan Audit Huria (Anggota)', null, '0812-9090-0101', true)
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  ecclesiastical_role = excluded.ecclesiastical_role,
  tohonan = excluded.tohonan,
  tingkat = excluded.tingkat,
  seksi_name = excluded.seksi_name,
  wijk = excluded.wijk,
  phone = excluded.phone,
  is_active = excluded.is_active,
  updated_at = now();

-- 5. Sinkronkan Hak Akses Pengurus Kas
delete from public.user_kas_access where id like 'uka-%';

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
on conflict (user_id, kas_id, access_level) do nothing;

-- 6. Pastikan Badan Audit Huria Terdaftar
insert into public.audit_body_members (id, user_id, jabatan, periode_mulai, periode_selesai, aktif) values
  ('abm-1', 'user-audit-ketua', 'ketua', '2025-01-01', '2027-01-01', true),
  ('abm-2', 'user-audit-1', 'anggota', '2025-01-01', '2027-01-01', true),
  ('abm-3', 'user-audit-2', 'anggota', '2025-01-01', '2027-01-01', true)
on conflict (id) do update set
  user_id = excluded.user_id,
  jabatan = excluded.jabatan,
  aktif = excluded.aktif,
  updated_at = now();
