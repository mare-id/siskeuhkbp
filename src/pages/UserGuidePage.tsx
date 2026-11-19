/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  Printer,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Shield,
  Calculator,
  Users,
  ChevronDown,
  ChevronUp,
  Church,
  FolderArchive,
  FileSpreadsheet,
  ReceiptText,
  Lock,
  Scale,
  FileCheck,
  DollarSign,
  Database,
  ArrowRightLeft,
  Calendar,
  HeartHandshake,
  Upload,
  CheckSquare,
  FileEdit,
  Landmark,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { PPKU_DOCUMENT_URL, PPKU_SK_NUMBER } from '../lib/ppkuRules';
import { formatRupiah } from '../lib/formatters';

type RoleFilterId =
  | 'all'
  | 'bendahara_umum'
  | 'bendahara_seksi'
  | 'ketua_seksi'
  | 'pendeta_ressort'
  | 'sekretaris'
  | 'auditor'
  | 'admin';

interface GuideChapter {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  roles: RoleFilterId[];
  keywords: string;
  content: React.ReactNode;
}

export const UserGuidePage: React.FC = () => {
  const { currentUser, hasBendaharaKasAccess, hasKetuaKasAccess } = useAuth();
  const { settings } = useData();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleFilterId>('all');
  const [openChapter, setOpenChapter] = useState<string>('bab-bendahara-transaksi');

  const detectCurrentUserFilter = (): RoleFilterId => {
    if (!currentUser) return 'all';
    if (currentUser.role === 'admin') return 'admin';
    if (currentUser.role === 'bendahara_umum') return 'bendahara_umum';
    if (currentUser.role === 'auditor') return 'auditor';
    if (currentUser.role === 'pendeta_ressort') return 'pendeta_ressort';
    if (currentUser.role === 'sekretaris') return 'sekretaris';
    if (currentUser.role === 'majelis') return 'ketua_seksi';
    if (currentUser.role === 'pengurus_kas') {
      if (hasKetuaKasAccess && !hasBendaharaKasAccess) return 'ketua_seksi';
      return 'bendahara_seksi';
    }
    return 'all';
  };

  const roleFilters: Array<{ id: RoleFilterId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'all', label: 'Semua Peran', icon: BookOpen },
    { id: 'bendahara_umum', label: 'Bendahara Umum', icon: DollarSign },
    { id: 'bendahara_seksi', label: 'Bendahara Kas / Seksi', icon: ReceiptText },
    { id: 'ketua_seksi', label: 'Ketua Kas & Majelis', icon: CheckSquare },
    { id: 'pendeta_ressort', label: 'Pendeta Ressort', icon: Church },
    { id: 'sekretaris', label: 'Sekretaris Huria', icon: FileText },
    { id: 'auditor', label: 'Badan Audit Huria', icon: Shield },
    { id: 'admin', label: 'Administrator', icon: Database },
  ];

  const receiptThresholdText = formatRupiah(settings.receipt_required_threshold || 500000);

  const chapters: GuideChapter[] = useMemo(
    () => [
      {
        id: 'bab-dasar',
        number: '01',
        title: 'Landasan Hukum, Aturan PPKU 2023 & Pemisahan Tugas',
        subtitle: 'Acuan HKBP 2002 Amandemen IV, PPKU Sentralisasi 55/45, Basis Kas Dimodifikasi ISAK 35, dan Matriks Wewenang',
        roles: [
          'all',
          'bendahara_umum',
          'bendahara_seksi',
          'ketua_seksi',
          'pendeta_ressort',
          'sekretaris',
          'auditor',
          'admin',
        ],
        keywords:
          'ppku 2023 sentralisasi 55 45 bpsk isak 35 aturan peraturan hkbp peran hak akses independensi audit',
        content: (
          <div className="space-y-5 text-xs text-slate-700 leading-relaxed">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="font-bold text-slate-900 text-sm">
                  Pedoman Pengelolaan Keuangan Umum (PPKU) HKBP 2023 ({PPKU_SK_NUMBER})
                </h4>
                <a
                  href={PPKU_DOCUMENT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-[#0B132B] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 w-fit whitespace-nowrap"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Buka Dokumen PPKU (PDF)</span>
                </a>
              </div>
              <ul className="space-y-1 list-disc pl-4 text-slate-600">
                <li>
                  <strong>Sentralisasi Keuangan (55% BPSK / 45% Huria):</strong> Penerimaan objek sentralisasi otomatis dipecah aplikasi: 45% masuk ke Kas tujuan di huria, dan 55% langsung terakumulasi ke <strong>Kas Sentralisasi (BPSK)</strong> untuk disetor paling lambat H+3 setelah ibadah.
                </li>
                <li>
                  <strong>Non-Sentralisasi (100% Lokal):</strong> Penerimaan khusus seperti Pembangunan Lokal, Diakonia Sosial/Duka, Transitoris/Titipan, atau Beasiswa dicatat 100% pada kas lokal dengan memilih Dasar Pengecualian.
                </li>
                <li>
                  <strong>Pelean Taon (Persembahan Tahunan Keluarga):</strong> Kewajiban tahunan keluarga jemaat dihitung per lingkungan, dicatat masuk ke <strong>Kas Umum Huria</strong>, dan otomatis dikenakan sentralisasi 55%.
                </li>
                <li>
                  <strong>Kewajiban Nota ({receiptThresholdText}):</strong> Pengeluaran bernilai sama atau lebih besar dari {receiptThresholdText} wajib melampirkan foto/URL bukti nota sah.
                </li>
              </ul>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
              <table className="w-full text-left text-xs border-collapse min-w-[680px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-800 font-semibold">
                  <tr>
                    <th className="p-3">Peran di SIKU</th>
                    <th className="p-3">Menu &amp; Tugas Operasional</th>
                    <th className="p-3">Batasan Pengendalian Internal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  <tr>
                    <td className="p-3 font-semibold text-slate-900">Bendahara Umum</td>
                    <td className="p-3">
                      Catat transaksi (manual &amp; impor Excel), Pelean Taon, Transfer, Anggaran, Pembukaan Buku, Data LPJ, Tutup Buku, Setoran BPSK, Laporan ISAK 35, Data Master Keluarga/Kas.
                    </td>
                    <td className="p-3 text-rose-700">Dilarang merangkap Badan Audit; tidak dapat mengedit paksa transaksi approved (gunakan Reversal).</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-900">Bendahara Kas / Seksi</td>
                    <td className="p-3">
                      Input transaksi &amp; impor Excel pada kas yang ditugaskan, ajukan transfer kas seksi, kelola panjar &amp; inventaris seksi, cek Rekap Pelean Taon &amp; Warta.
                    </td>
                    <td className="p-3 text-rose-700">Transaksi yang diajukan harus disetujui Ketua Kas terkait; tidak bisa Tutup Buku.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-900">Ketua Kas / Majelis</td>
                    <td className="p-3">
                      Menyetujui atau menolak transaksi &amp; transfer pada kas yang dinaungi (menu Persetujuan), memantau Dashboard, Warta, Laporan, &amp; Rekap Pelean Taon.
                    </td>
                    <td className="p-3 text-rose-700">Tidak menginput transaksi kas (kecuali diberi akses ganda oleh Admin sesuai kebutuhan jemaat).</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-900">Pendeta Ressort</td>
                    <td className="p-3">
                      Menetapkan Tim Badan Audit, mengesahkan APBG &amp; Pembukaan Buku, menerima Laporan Semester &amp; LPJ, memantau Sentralisasi 55/45 &amp; Rekap Pelean Taon.
                    </td>
                    <td className="p-3 text-rose-700">Bersifat pengawasan &amp; pengesahan pimpinan; bukan operator kuitansi harian.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-900">Sekretaris Huria</td>
                    <td className="p-3">
                      Mengambil ringkasan Warta Keuangan mingguan berdasarkan Tanggal Warta, meneruskan Laporan Semester ke Pendeta, mencatat tanggal pewartaan ibadah.
                    </td>
                    <td className="p-3 text-rose-700">Akses baca pembukuan (read-only); tidak memegang kas fisik atau rekening.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-900">Badan Audit Huria</td>
                    <td className="p-3">
                      Uji bukti transaksi (Lolos/Temuan), opname fisik brankas/bank, checklist pemeriksaan berkala (Triwulan/Semester/Tahunan), Berita Acara 2/3 suara, cek Audit Trail.
                    </td>
                    <td className="p-3 text-rose-700">Independen mutlak (Read-Only terhadap transaksi; tidak bisa mencatat atau menyetujui belanja).</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-900">Administrator</td>
                    <td className="p-3">
                      Kelola Pengguna &amp; Hak Akses Kas, Data Master lengkap, Edit/Hapus Transaksi darurat (dengan Audit Trail), Pengaturan Kop Gereja &amp; Kebijakan Saldo.
                    </td>
                    <td className="p-3 text-rose-700">Semua perubahan darurat oleh Admin otomatis terekam lengkap di Audit Trail.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ),
      },
      {
        id: 'bab-bendahara-transaksi',
        number: '02',
        title: 'Bendahara: Langkah Catat Transaksi Manual, Tanggal Warta, Multi Pos & Pelean Taon',
        subtitle: 'Panduan lengkap fungsi pencatatan di menu Transaksi Kas beserta 4 contoh kasus nyata',
        roles: ['all', 'bendahara_umum', 'bendahara_seksi'],
        keywords:
          'bendahara catat transaksi tanggal warta minggu berikutnya 1 pos multi pos ucapan syukur pelean taon kel. sentralisasi non sentralisasi draft ajukan reversal',
        content: (
          <div className="space-y-5 text-xs text-slate-700 leading-relaxed">
            <p className="text-slate-600">
              Menu <strong>Transaksi Kas</strong> digunakan oleh <strong>Bendahara Umum</strong> maupun <strong>Bendahara Kas / Seksi</strong> (sesuai hak akses kas masing-masing) untuk mencatat penerimaan dan pengeluaran harian.
            </p>

            {/* Langkah Kerja Umum */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2.5">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ReceiptText className="w-4 h-4 text-blue-700" />
                <span>Langkah Kerja Standar: Catat Transaksi Manual</span>
              </h4>
              <ol className="list-decimal pl-4 space-y-1.5 text-slate-600">
                <li>
                  Buka menu <strong>Transaksi Kas</strong> lalu klik tombol <strong>+ Catat Transaksi</strong> di pojok kanan atas.
                </li>
                <li>
                  Pilih jenis transaksi pada tombol atas modal: <strong>+ Pemasukan</strong> atau <strong>- Pengeluaran</strong>. Khusus Pemasukan, pilih mode <strong>1 Pos Kas</strong> atau <strong>Multi Pos / Ucapan Syukur</strong>.
                </li>
                <li>
                  Isi <strong>Nominal (Rp)</strong> dengan angka penuh (pemisah ribuan diformat otomatis).
                </li>
                <li>
                  Isi <strong>Tanggal Transaksi *</strong> (tanggal uang diterima/dikeluarkan) dan <strong>Tanggal Warta</strong> (kalender tanggal warta jemaat; tersedia tombol cepat <strong>Minggu Berikutnya</strong> agar otomatis memilih hari Minggu terdekat).
                </li>
                <li>
                  Pilih <strong>Kas Tujuan / Sumber</strong>, <strong>Tempat Simpan</strong> (Tunai / Rekening Bank), dan <strong>Kategori</strong>. Isi <strong>No. Bukti</strong> bila ada (misal <span className="font-mono">BKM-01</span> atau <span className="font-mono">BKK-04</span>).
                </li>
                <li>
                  Untuk Pemasukan, tentukan <strong>Status Sentralisasi</strong>: <strong>Sentralisasi (45/55)</strong> atau <strong>Non-Sentralisasi (100%)</strong> beserta Dasar Pengecualiannya.
                </li>
                <li>
                  Isi <strong>Uraian</strong> transaksi secara jelas dan unggah <strong>Foto Nota / Bukti</strong> (wajib untuk pengeluaran &ge; {receiptThresholdText}).
                </li>
                <li>
                  Klik <strong>Simpan Draft</strong> bila masih ingin diperiksa ulang sebelum diajukan, atau klik <strong>Ajukan</strong> agar masuk ke antrean <strong>Persetujuan</strong> Ketua Kas.
                </li>
              </ol>
            </div>

            {/* 4 Contoh Nyata Lengkap */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 text-sm">Contoh Pengisian Kasus Nyata</h4>

              {/* Contoh 1 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="font-bold text-slate-900">
                  Contoh A — Pemasukan 1 Pos Sentralisasi (45/55): Pelean Kebaktian Minggu
                </div>
                <p className="text-slate-600">
                  Kebaktian Minggu tanggal 15 November 2026 terkumpul Pelean Ibadah IA sebesar <strong>Rp 4.000.000</strong> tunai di Brankas Gereja dan akan diwartakan pada Warta Jemaat tanggal 22 November 2026.
                </p>
                <div className="p-3 rounded-lg bg-white border border-slate-200 font-mono text-[11px] space-y-1 text-slate-700">
                  <p>• Mode: <strong>+ Pemasukan</strong> &rarr; <strong>1 Pos Kas</strong></p>
                  <p>• Nominal: <strong>4.000.000</strong> | Tgl Transaksi: <strong>2026-11-15</strong> | Tgl Warta: <strong>2026-11-22</strong> (klik Minggu Berikutnya)</p>
                  <p>• Kas Tujuan: <strong>Kas Umum Huria</strong> | Tempat Simpan: <strong>Kas Tunai / Brankas</strong> | Kategori: <strong>Pelean Ibadah IA</strong></p>
                  <p>• Status Sentralisasi: <strong>Sentralisasi (45/55)</strong> &rarr; Sistem otomatis membagi Rp 1.800.000 ke Kas Huria &amp; Rp 2.200.000 ke Kas Sentralisasi (BPSK).</p>
                  <p>• Uraian: <em>Pelean Ibadah Minggu IA, 15 Nov 2026</em> &rarr; Klik <strong>Ajukan</strong>.</p>
                </div>
              </div>

              {/* Contoh 2 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="font-bold text-slate-900">
                  Contoh B — Pemasukan Non-Sentralisasi (100%): Sumbangan Khusus Pembangunan
                </div>
                <p className="text-slate-600">
                  Seorang jemaat mentransfer <strong>Rp 5.000.000</strong> ke Rekening Bank BRI khusus untuk renovasi atap gereja.
                </p>
                <div className="p-3 rounded-lg bg-white border border-slate-200 font-mono text-[11px] space-y-1 text-slate-700">
                  <p>• Mode: <strong>+ Pemasukan</strong> &rarr; <strong>1 Pos Kas</strong></p>
                  <p>• Kas Tujuan: <strong>Kas Pembangunan</strong> | Tempat Simpan: <strong>Bank BRI Huria</strong></p>
                  <p>• Status Sentralisasi: Pilih <strong>Non-Sentralisasi (100%)</strong> &rarr; Dasar Pengecualian: <strong>Pembangunan Lokal</strong></p>
                  <p>• Hasil: Seluruh <strong>Rp 5.000.000 (100%)</strong> utuh masuk ke Kas Pembangunan tanpa potongan 55%.</p>
                </div>
              </div>

              {/* Contoh 3 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="font-bold text-slate-900">
                  Contoh C — Pemasukan Multi Pos / Ucapan Syukur Keluarga
                </div>
                <p className="text-slate-600">
                  Satu amplop Ucapan Syukur (Hamauliateon) dari <strong>Kel. St. R. Sinaga</strong> senilai total <strong>Rp 600.000</strong> dengan rincian: Rp 200.000 ke Kas Huria, Rp 100.000 ke Pembangunan, Rp 100.000 ke Diakonia Sosial, Rp 100.000 ke Pendeta, dan Rp 100.000 ke Lingkungan.
                </p>
                <div className="p-3 rounded-lg bg-white border border-slate-200 font-mono text-[11px] space-y-1 text-slate-700">
                  <p>• Mode: <strong>+ Pemasukan</strong> &rarr; <strong>Multi Pos / Ucapan Syukur</strong> (atau klik tombol <em>Contoh Ucapan Syukur</em> untuk mengisi template baris cepat).</p>
                  <p>• Baris #1: <em>Ke Kas Huria</em> | Kas Umum Huria | 200.000 | pilih <strong>Sentralisasi (45/55)</strong> (45% Huria Rp 90rb, 55% BPSK Rp 110rb).</p>
                  <p>• Baris #2: <em>Ke Kas Pembangunan</em> | Kas Pembangunan | 100.000 | pilih <strong>Non-Sentralisasi (100%)</strong>.</p>
                  <p>• Baris #3: <em>Ke Kas Diakonia Sosial</em> | Kas Diakonia Sosial | 100.000 | pilih <strong>Non-Sentralisasi (100%)</strong>.</p>
                  <p>• Baris #4 &amp; #5: <em>Ke Pendeta</em> &amp; <em>Ke Lingkungan</em> | Kas Transitoris | masing-masing 100.000 | <strong>Non-Sentralisasi (100%)</strong>.</p>
                  <p>• Uraian Utama: <em>Ucapan Syukur Kel. St. R. Sinaga</em> &rarr; Klik <strong>Ajukan</strong>. Di <strong>Buku Kas Bendahara</strong>, seluruh baris tampil rapi di bawah 1 header induk.</p>
                </div>
              </div>

              {/* Contoh 4 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="font-bold text-slate-900">
                  Contoh D — Pencatatan Pelean Taon (Persembahan Tahunan Keluarga) &amp; Format Otomatis &quot;Kel. &quot;
                </div>
                <p className="text-slate-600">
                  Pembayaran Pelean Taon tahun anggaran 2026 sebesar <strong>Rp 300.000</strong> dari keluarga di Lingkungan Efesus.
                </p>
                <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                  <li>
                    Pilih <strong>+ Pemasukan</strong> &rarr; <strong>1 Pos Kas</strong> &rarr; Kategori: <strong>Pelean Bulanan/Tahunan</strong>. Kotak khusus <strong>Persembahan Tahunan (Pelean Taon)</strong> otomatis aktif, Kas dikunci ke <strong>Kas Umum Huria</strong>, dan Sentralisasi otomatis 55%.
                  </li>
                  <li>
                    Pilih <strong>Tahun Anggaran 2026</strong> dan <strong>Nama Lingkungan: Efesus</strong>.
                  </li>
                  <li>
                    Pilih <strong>Nama Keluarga</strong> dari dropdown database. Bila belum terdaftar, klik tab <strong>Input Manual</strong> lalu ketik namanya saja, misalnya <span className="font-mono">St. Saruddin Naibaho, BA (+) / Maria Magdalena Siregar, BA</span> — aplikasi otomatis menambahkan awalan <strong>&quot;Kel. &quot;</strong> saat disimpan dan dapat langsung disimpan ke Master Data Keluarga.
                  </li>
                  <li>
                    Pilih <strong>Tanggal Penerimaan</strong>, pastikan <strong>Tanggal Warta</strong> terisi, masukkan nominal <strong>300.000</strong>, lalu klik <strong>Ajukan</strong>. Uraian terisi otomatis menjadi <span className="font-mono">Pelean Taon 2026 - Kel. St. Saruddin Naibaho... (Lingkungan Efesus)</span>.
                  </li>
                </ol>
              </div>
            </div>

            {/* Koreksi & Buku Kas */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-slate-700" />
                <span>Tampilan Buku Kas Bendahara &amp; Koreksi Transaksi (Reversal)</span>
              </h4>
              <ul className="list-disc pl-4 space-y-1 text-slate-600">
                <li>
                  Gunakan sakelar <strong>Daftar | Buku Kas Bendahara</strong> di kanan atas halaman Transaksi Kas untuk melihat buku kas lajur per kolom kas (Huria, Pembangunan, Diakonia Sosial, Sentralisasi, Transitoris) sekaligus mengekspornya ke Excel.
                </li>
                <li>
                  Transaksi berstatus <strong>Diajukan</strong> dapat ditarik kembali ke draf lewat tombol <strong>Tarik Draf</strong> sebelum disetujui. Transaksi yang sudah <strong>Disetujui</strong> tidak boleh dihapus sembarangan—gunakan tombol <strong>Koreksi / Pembalik (Reversal)</strong> lalu input nominal yang benar.
                </li>
              </ul>
            </div>
          </div>
        ),
      },
      {
        id: 'bab-excel-import',
        number: '03',
        title: 'Bendahara: Impor Transaksi & Transfer Massal via Template Excel',
        subtitle: 'Cara unduh template resmi ber-dropdown, kunci tanggal seragam YYYY-MM-DD, penggunaan ID Grup Multi-Pos, dan pratinjau validasi',
        roles: ['all', 'bendahara_umum', 'bendahara_seksi'],
        keywords:
          'impor excel template dropdown tanggal seragam yyyy-mm-dd id grup multi pos syukur-01 pelean taon transfer antar kas',
        content: (
          <div className="space-y-5 text-xs text-slate-700 leading-relaxed">
            <p className="text-slate-600">
              Untuk mencatat puluhan transaksi sekaligus (misalnya rekap pelean minggu, pembagian Ucapan Syukur, atau setoran Pelean Taon satu lingkungan), Bendahara dapat menggunakan fitur <strong>Impor Excel</strong> pada menu <strong>Transaksi Kas</strong>.
            </p>

            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2.5">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-700" />
                <span>Langkah Kerja Impor Transaksi Excel</span>
              </h4>
              <ol className="list-decimal pl-4 space-y-1.5 text-slate-600">
                <li>
                  Buka menu <strong>Transaksi Kas</strong> &rarr; klik tombol <strong>Impor Excel</strong> &rarr; klik <strong>Unduh Template Excel</strong>.
                </li>
                <li>
                  Buka file <span className="font-mono">.xlsx</span> di Excel / LibreOffice / Google Sheets. Seluruh pilihan aplikasi sudah tersedia sebagai <strong>menu dropdown</strong> dan seluruh kolom tanggal sudah dikunci berformat seragam <strong>YYYY-MM-DD</strong> (contoh: <span className="font-mono">2026-11-19</span>).
                </li>
                <li>
                  Isi transaksi mulai baris ke-4 pada sheet <strong>Transaksi_Kas</strong> (untuk Pemasukan, Pengeluaran, Multi Pos, maupun Pelean Taon) atau sheet <strong>Transfer_Antar_Kas</strong> (untuk mutasi pindah buku/setor bank). Jangan hapus sheet <strong>Referensi_Dropdown</strong> karena sheet tersebut menampung daftar pilihan aktif dari database.
                </li>
                <li>
                  Unggah kembali file <span className="font-mono">.xlsx</span> ke kotak unggah pada jendela <strong>Impor Transaksi via Excel</strong>.
                </li>
                <li>
                  Periksa tabel <strong>Pratinjau &amp; Validasi</strong>:
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    <li>Baris berstatus <strong>Siap impor</strong> berwarna hijau siap disimpan.</li>
                    <li>Bila ada pengeluaran &ge; {receiptThresholdText} tanpa URL nota, Anda bisa langsung klik tombol <strong>Unggah Nota</strong> di baris pratinjau tersebut.</li>
                    <li>Bila ada keluarga Pelean Taon yang baru pertama kali membayar, centang opsi <strong>Simpan keluarga baru ke Master</strong> agar otomatis masuk ke database jemaat dengan awalan <span className="font-mono">Kel. </span>.</li>
                  </ul>
                </li>
                <li>
                  Klik <strong>Impor Entri Transaksi</strong> hingga proses selesai.
                </li>
              </ol>
            </div>

            {/* Contoh Penggunaan ID Grup Multi Pos */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
              <h4 className="font-bold text-slate-900 text-xs">
                Contoh Penerapan &quot;ID Grup Multi-Pos&quot; di Excel (Ucapan Syukur)
              </h4>
              <p className="text-slate-600">
                Misal dalam 1 hari ada 2 amplop Ucapan Syukur yang masing-masing dibagi ke beberapa pos kas. Berikan kode grup yang sama per amplop (misalnya <span className="font-mono font-bold">SYUKUR-01</span> untuk amplop pertama dan <span className="font-mono font-bold">SYUKUR-02</span> untuk amplop kedua):
              </p>
              <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
                <table className="w-full text-left text-[11px] border-collapse min-w-[760px]">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2">Mode Input</th>
                      <th className="p-2">ID Grup Multi-Pos</th>
                      <th className="p-2">Tgl Transaksi</th>
                      <th className="p-2">Kas Tujuan</th>
                      <th className="p-2 text-right">Nominal</th>
                      <th className="p-2">Sentralisasi</th>
                      <th className="p-2">Uraian Transaksi</th>
                      <th className="p-2">Sub-Uraian Multi-Pos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    <tr>
                      <td className="p-2">Multi Pos (Gabung Grup)</td>
                      <td className="p-2 font-bold text-blue-700">SYUKUR-01</td>
                      <td className="p-2">2026-11-19</td>
                      <td className="p-2">Kas Umum Huria</td>
                      <td className="p-2 text-right">200.000</td>
                      <td className="p-2">Sentralisasi (45/55)</td>
                      <td className="p-2 font-sans">Ucapan Syukur Kel. M. Sihombing</td>
                      <td className="p-2 font-sans">Ke Kas Huria</td>
                    </tr>
                    <tr>
                      <td className="p-2">Multi Pos (Gabung Grup)</td>
                      <td className="p-2 font-bold text-blue-700">SYUKUR-01</td>
                      <td className="p-2">2026-11-19</td>
                      <td className="p-2">Kas Diakonia Sosial</td>
                      <td className="p-2 text-right">100.000</td>
                      <td className="p-2">Non-Sentralisasi (100%)</td>
                      <td className="p-2 font-sans">Ucapan Syukur Kel. M. Sihombing</td>
                      <td className="p-2 font-sans">Ke Diakonia Sosial</td>
                    </tr>
                    <tr>
                      <td className="p-2">Multi Pos (Gabung Grup)</td>
                      <td className="p-2 font-bold text-blue-700">SYUKUR-01</td>
                      <td className="p-2">2026-11-19</td>
                      <td className="p-2">Kas Transitoris</td>
                      <td className="p-2 text-right">100.000</td>
                      <td className="p-2">Non-Sentralisasi (100%)</td>
                      <td className="p-2 font-sans">Ucapan Syukur Kel. M. Sihombing</td>
                      <td className="p-2 font-sans">Ke Pendeta</td>
                    </tr>
                    <tr className="bg-slate-50/70">
                      <td className="p-2">Multi Pos (Gabung Grup)</td>
                      <td className="p-2 font-bold text-emerald-700">SYUKUR-02</td>
                      <td className="p-2">2026-11-19</td>
                      <td className="p-2">Kas Umum Huria</td>
                      <td className="p-2 text-right">200.000</td>
                      <td className="p-2">Sentralisasi (45/55)</td>
                      <td className="p-2 font-sans">Ucapan Syukur Kel. R. Sinaga</td>
                      <td className="p-2 font-sans">Ke Kas Huria</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-500">
                Untuk mode <strong>1 Pos Kas</strong> dan <strong>Pelean Taon</strong>, biarkan kolom <strong>ID Grup Multi-Pos</strong> kosong.
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'bab-bendahara-lainnya',
        number: '04',
        title: 'Bendahara: Transfer, Pelean Taon, Pembukaan Buku, APBG, Tutup Buku & LPJ',
        subtitle: 'Langkah kerja modul pendukung bendahara harian hingga pertanggungjawaban akhir tahun ISAK 35',
        roles: ['all', 'bendahara_umum', 'bendahara_seksi'],
        keywords:
          'transfer antar kas rekening pembukaan buku saldo awal anggaran apbg realokasi tutup buku rekonsiliasi bank rekap pelean taon panjar inventaris aset bpsk 55',
        content: (
          <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
            {/* 1. Transfer */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-indigo-700" />
                <span>A. Transfer Dana Antar Kas / Rekening (Mutasi Saldo Tanpa Pengaruhi Laba-Rugi)</span>
              </h4>
              <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                <li>Klik tombol <strong>Transfer</strong> di halaman Transaksi Kas (atau isi sheet <strong>Transfer_Antar_Kas</strong> di template Excel).</li>
                <li>Isi Nominal, Tanggal Transfer, Nomor Slip (opsional), pilih <strong>Kas &amp; Tempat Simpan Asal</strong> lalu pilih <strong>Kas &amp; Tempat Simpan Tujuan</strong>.</li>
                <li>Klik <strong>Ajukan Transfer Dana</strong>.</li>
              </ol>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-700">
                <strong>Contoh Setor Tunai ke Bank:</strong> Kas Pengirim = <em>Kas Umum Huria (Kas Tunai)</em> &rarr; Kas Penerima = <em>Kas Umum Huria (Bank BRI Huria)</em> sebesar Rp 10.000.000. Cukup 1 persetujuan Ketua Kas Huria. Jika beda kas (mis. subsidi ke Kas Diakonia), Ketua Kas penerima wajib mengonfirmasi penerimaan dana.
              </div>
            </div>

            {/* 2. Rekap Pelean Taon */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                <HeartHandshake className="w-4 h-4 text-emerald-700" />
                <span>B. Memantau &amp; Mencatat Cepat lewat Menu Rekap Pelean Taon</span>
              </h4>
              <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                <li>Buka menu <strong>Rekap Pelean Taon</strong> untuk melihat daftar seluruh keluarga per Lingkungan beserta status <strong>Sudah Bayar / Belum Bayar</strong>.</li>
                <li>Filter berdasarkan <strong>Tahun Anggaran</strong>, <strong>Lingkungan</strong> (Efesus, Letare, Exaudi, dll.), atau <strong>Status Pembayaran</strong>.</li>
                <li>Klik tombol <strong>Catat Bayar</strong> langsung pada nama keluarga yang belum membayar untuk membuka form Catat Transaksi dengan data keluarga &amp; lingkungan terisi otomatis.</li>
                <li>Klik <strong>Ekspor Excel</strong> untuk mencetak daftar rekap pemeriksaan pengurus per lingkungan.</li>
              </ol>
            </div>

            {/* 3. Pembukaan Buku & Anggaran */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-700" />
                  <span>C. Pembukaan Buku (Saldo Awal)</span>
                </h4>
                <p className="text-slate-600">
                  Wajib diselesaikan sebelum transaksi tahun pertama dicatat: buka menu <strong>Pembukaan Buku</strong>, atur Tanggal Mulai Pemakaian, input saldo awal masing-masing kas &amp; bank, cocokkan saldo fisik vs buku, lalu minta pengesahan agar kas berstatus <strong>Terkunci (Locked)</strong>.
                </p>
              </div>

              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-amber-700" />
                  <span>D. Anggaran (APBG) &amp; Realokasi</span>
                </h4>
                <p className="text-slate-600">
                  Buka menu <strong>Anggaran (APBG)</strong> untuk menyusun rencana pemasukan/belanja per tahun dan sebaran bulanannya. Bila ada pos anggaran yang perlu digeser, gunakan tombol <strong>Realokasi Anggaran</strong> agar riwayat pergeseran tercatat rapi.
                </p>
              </div>
            </div>

            {/* 4. Data Pendukung LPJ, Sentralisasi BPSK & Tutup Buku */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                <FolderArchive className="w-4 h-4 text-purple-700" />
                <span>E. Data Pendukung LPJ, Penyetoran BPSK 55%, &amp; Tutup Buku Bulanan</span>
              </h4>
              <ul className="list-disc pl-4 space-y-1 text-slate-600">
                <li>
                  <strong>Data Pendukung LPJ:</strong> Catat <em>Inventaris Aset Tetap</em> (penyusutan otomatis), <em>Panjar Kegiatan</em> (panitia wajib setor LPJ max 14 hari; contoh panjar Natal Rp 5.000.000 realisasi Rp 4.650.000 &rarr; kembalikan sisa Rp 350.000), <em>Piutang/Utang</em>, dan narasi <em>Catatan atas Laporan Keuangan (CaLK)</em>.
                </li>
                <li>
                  <strong>Sentralisasi (55/45):</strong> Buka menu <strong>Sentralisasi (55/45)</strong> untuk melihat total kewajiban 55% yang belum disetor ke Virtual Account BPSK HKBP, lalu catat bukti pengiriman setorannya per minggu/bulan.
                </li>
                <li>
                  <strong>Tutup Buku &amp; Rekonsiliasi Bank (Khusus Bendahara Umum):</strong> Setiap akhir bulan, pastikan tidak ada transaksi menggantung (Draft/Diajukan), cocokkan saldo buku dengan Rekening Koran bank, lalu klik <strong>Kunci Buku Bulan Ini</strong> di menu <strong>Tutup Buku</strong>. Setelah 12 bulan selesai, susun <strong>Laporan Semester &amp; LPJ ISAK 35</strong> di menu <strong>Laporan &amp; LPJ</strong>.
                </li>
              </ul>
            </div>
          </div>
        ),
      },
      {
        id: 'bab-ketua-majelis',
        number: '05',
        title: 'Ketua Kas / Dewan & Majelis: Persetujuan Transaksi, Konfirmasi Transfer & Pengawasan',
        subtitle: 'Langkah memeriksa antrean pengajuan bendahara, menolak transaksi keliru, dan konfirmasi terima transfer antar kas',
        roles: ['all', 'ketua_seksi', 'bendahara_umum'],
        keywords:
          'ketua seksi ketua kas majelis parartaon persetujuan setujui tolak konfirmasi terima transfer antar kas',
        content: (
          <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
            <p className="text-slate-600">
              Pemegang akses <strong>Ketua Kas</strong> (Ketua Seksi/Dewan atau Ketua Parartaon) bertanggung jawab memverifikasi dan menyetujui transaksi yang diinput Bendahara sebelum saldo resmi berubah. Sementara peran <strong>Majelis</strong> mengawasi realisasi seluruh kas secara <em>read-only</em>.
            </p>

            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2.5">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-700" />
                <span>Langkah Kerja 1: Menyetujui atau Menolak Transaksi di Menu Persetujuan</span>
              </h4>
              <ol className="list-decimal pl-4 space-y-1.5 text-slate-600">
                <li>Buka menu <strong>Persetujuan</strong> (angka pengingat di menu menunjukkan jumlah antrean yang menunggu Anda).</li>
                <li>Klik ikon/tombol <strong>Lihat Bukti Nota</strong> pada transaksi pengeluaran untuk memastikan nota asli cocok dengan nominal dan tanggalnya.</li>
                <li>Periksa ketepatan <strong>Kas</strong>, <strong>Kategori</strong>, serta status <strong>Sentralisasi 45/55 vs Non-Sentralisasi</strong> untuk pemasukan.</li>
                <li>Klik <strong>Setujui</strong> bila semua benar (saldo kas langsung termutasi resmi). Jika salah input/nota tidak sah, klik <strong>Tolak</strong> dan tuliskan alasan jelasnya agar bendahara dapat memperbaiki.</li>
              </ol>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-700">
                <strong>Contoh Pemeriksaan Ketua Seksi Pembangunan:</strong> Bendahara Pembangunan mengajukan pengeluaran Rp 2.400.000 untuk pembelian semen. Ketua memeriksa foto nota toko bangunan (sesuai Rp 2.400.000, bertanggal benar) &rarr; klik <strong>Setujui</strong>. Jika foto nota buram/nominal di nota hanya Rp 2.100.000 &rarr; klik <strong>Tolak</strong> dengan catatan: <em>&quot;Nominal input Rp 2,4 jt tidak sesuai foto nota Rp 2,1 jt, mohon perbaiki.&quot;</em>
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-blue-700" />
                <span>Langkah Kerja 2: Konfirmasi Penerimaan Transfer Antar Kas</span>
              </h4>
              <p className="text-slate-600">
                Ketika terjadi <strong>Transfer Antar Kas Berbeda</strong> (misalnya bantuan subsidi dari <em>Kas Umum Huria</em> ke <em>Kas Diakonia Sosial</em> sebesar Rp 3.000.000), dibutuhkan 2 tahap otorisasi: (1) disetujui oleh Ketua Kas Pengirim, lalu (2) dikonfirmasi penerimaannya oleh Ketua Kas Penerima di menu <strong>Persetujuan</strong> dengan mengecek mutasi masuk/slip transfer sebelum mengklik <strong>Konfirmasi Terima</strong>.
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'bab-pendeta',
        number: '06',
        title: 'Pendeta Ressort: Pengesahan APBG, Penugasan Badan Audit & Laporan Huria',
        subtitle: 'Langkah pimpinan jemaat memantau sentralisasi BPSK, menetapkan penugasan audit, serta menandatangani laporan semester & LPJ',
        roles: ['all', 'pendeta_ressort'],
        keywords:
          'pendeta ressort pimpinan penugasan badan audit laporan semester lpj tahunan sentralisasi bpsk rekap pelean taon',
        content: (
          <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2.5">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Church className="w-4 h-4 text-indigo-700" />
                <span>Daftar Tugas &amp; Langkah Kerja Pendeta Ressort</span>
              </h4>
              <ol className="list-decimal pl-4 space-y-1.5 text-slate-600">
                <li>
                  <strong>Pengawasan Dashboard &amp; Sentralisasi (55/45):</strong> Pantau ringkasan saldo seluruh kas di <strong>Dashboard</strong>, progres pembayaran <strong>Rekap Pelean Taon</strong> per lingkungan, dan kepatuhan penyetoran 55% BPSK H+3 di menu <strong>Sentralisasi (55/45)</strong>.
                </li>
                <li>
                  <strong>Penugasan Badan Audit Huria:</strong> Buka menu <strong>Badan Audit</strong> &rarr; tab <strong>Penugasan &amp; Tim Audit</strong> untuk membuka periode pemeriksaan baru (Triwulan I–IV, Semester I–II, atau Tahunan) dan menetapkan susunan 1 Ketua + 2 Anggota Badan Audit independen.
                </li>
                <li>
                  <strong>Persetujuan Anggaran &amp; Penguncian APBG:</strong> Buka menu <strong>Anggaran (APBG)</strong> untuk meninjau rancangan APBG dan mengunci anggaran yang telah disahkan Rapat Huria.
                </li>
                <li>
                  <strong>Penerimaan &amp; Pengesahan Laporan Semester / LPJ:</strong> Pada menu <strong>Laporan &amp; LPJ</strong>, laporan semester yang sudah diaudit dan diteruskan Sekretaris akan berstatus <em>Dikirim ke Pendeta</em>; tinjau angka snapshot lalu berikan catatan persetujuan untuk diwartakan kepada jemaat.
                </li>
              </ol>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-700">
                <strong>Contoh Kasus Pendeta Ressort:</strong> Menjelang penutupan Triwulan II, Pendeta membuka menu <strong>Badan Audit</strong> &rarr; klik <strong>Buka Periode Audit</strong> &rarr; pilih <em>Semester I (Jan–Jun) 2026</em> &rarr; tetapkan batas waktu pemeriksaan 10 hari kerja agar Badan Audit dapat mulai melakukan opname kas &amp; uji petik bukti.
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'bab-sekretaris',
        number: '07',
        title: 'Sekretaris Huria: Warta Keuangan Mingguan, Laporan Semester & Administrasi Jemaat',
        subtitle: 'Langkah penyiapan Warta Keuangan berdasarkan Tanggal Warta, penerusan laporan ke Pendeta, dan pemantauan Pelean Taon',
        roles: ['all', 'sekretaris'],
        keywords:
          'sekretaris huria warta keuangan tanggal warta laporan semester diwartakan mimbar rekap pelean taon',
        content: (
          <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2.5">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-700" />
                <span>Langkah Kerja 1: Menyusun &amp; Mencetak Warta Keuangan Mingguan</span>
              </h4>
              <ol className="list-decimal pl-4 space-y-1.5 text-slate-600">
                <li>Buka menu <strong>Warta Keuangan</strong>.</li>
                <li>Pilih tanggal Minggu warta atau rentang <strong>Tanggal Warta</strong> yang sesuai dengan ibadah Minggu berjalan (sistem menyaring transaksi berdasarkan kolom <em>Tanggal Warta</em> yang telah diinput Bendahara).</li>
                <li>Periksa daftar penerimaan (termasuk pembagian 45% Huria &amp; 55% Sentralisasi, Multi Pos Ucapan Syukur, serta rincian nama keluarga pembayar <strong>Pelean Taon</strong>) dan daftar pengeluaran.</li>
                <li>Ekspor ke Excel/PDF atau salin ringkasannya untuk ditempatkan di lembaran Warta Jemaat Minggu.</li>
              </ol>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-700">
                <strong>Contoh Warta Jemaat Minggu 22 Nov 2026:</strong> Sekretaris memfilter Tanggal Warta <em>2026-11-22</em>. Sistem langsung menampilkan seluruh Pelean Minggu lalu, Ucapan Syukur Kel. M. Sihombing, serta daftar pembayar Pelean Taon (mis. Kel. St. R. Sinaga — Efesus Rp 300.000) yang dijadwalkan diwartakan tanggal 22 November.
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Langkah Kerja 2: Penerusan Laporan Semester &amp; Pencatatan Status Diwartakan</span>
              </h4>
              <p className="text-slate-600">
                Di menu <strong>Laporan &amp; LPJ</strong>, setelah Bendahara Umum menyusun snapshot Semester I/II dan Badan Audit menerbitkan Berita Acara, Sekretaris bertugas meneruskan berkas resmi ke <strong>Pendeta Ressort</strong>, lalu setelah dibacakan di ibadah Minggu mencatat <strong>Tanggal Diwartakan</strong> dan media pewartaan (<em>Warta Jemaat / Mimbar</em>) agar siklus laporan berstatus tuntas (<strong>Diwartakan</strong>).
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'bab-auditor',
        number: '08',
        title: 'Badan Audit Huria: Uji Bukti Transaksi, Opname Kas & Berita Acara 2/3 Suara',
        subtitle: 'Langkah verifikasi kuitansi, pencatatan temuan, 6 poin pemeriksaan berkala AP HKBP, dan Audit Trail',
        roles: ['all', 'auditor'],
        keywords:
          'badan audit uji bukti transaksi lolos temuan opname fisik kas pemeriksaan berkala berita acara 2/3 suara audit trail',
        content: (
          <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2.5">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-700" />
                <span>Langkah Kerja 1: Uji Bukti Transaksi (Verifikasi per Item)</span>
              </h4>
              <ol className="list-decimal pl-4 space-y-1.5 text-slate-600">
                <li>Buka menu <strong>Uji Bukti Transaksi</strong> atau masuk ke menu <strong>Badan Audit</strong> &rarr; tab <strong>Verifikasi Transaksi</strong>.</li>
                <li>Filter bulan/triwulan dan kas yang diperiksa. Buka lampiran nota dengan mengklik <strong>Lihat Bukti</strong>.</li>
                <li>Cocokkan tanggal transaksi, tanggal warta, nama penerima, nominal, dan tanda tangan pada kuitansi.</li>
                <li>Klik <strong>Lolos</strong> bila bukti lengkap &amp; sah. Jika ada kejanggalan (nota tidak ada, nominal selisih, atau pengeluaran tanpa persetujuan Ketua), klik <strong>Temuan</strong> dan tuliskan deskripsi serta tenggat tindak lanjutnya.</li>
              </ol>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-700">
                <strong>Contoh Temuan Audit:</strong> Pengeluaran Rp 1.250.000 untuk konsumsi Rapat Parhalado tanggal 12 Okt tercatat tanpa foto kuitansi/cap warung &rarr; Auditor klik <strong>Temuan</strong>, pilih tingkat <em>Wajib Diperbaiki</em>, tulis catatan: <em>&quot;Harap unggah foto kuitansi asli konsumsi rapat paling lambat 7 hari.&quot;</em>
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-700" />
                <span>Langkah Kerja 2: Opname Fisik Kas, 6 Poin Kepatuhan &amp; Opini Kolegial 2/3 Suara</span>
              </h4>
              <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                <li>Catat perhitungan uang kertas/koin fisik di brankas pada sub-menu <strong>Opname Kas Fisik</strong> dan bandingkan dengan saldo buku (selisih harus Rp 0 atau dijelaskan secara tertulis).</li>
                <li>Lengkapi <strong>6 Poin Pemeriksaan Berkala AP HKBP</strong> (kecocokan kas fisik/bank, keabsahan kuitansi, kepatuhan APBG, panjar tidak menggantung, penyetoran BPSK 55%, dan tindak lanjut temuan lama).</li>
                <li>Setiap dari 3 anggota Badan Audit mengisi opini pribadinya (<em>Sesuai / Sesuai dengan Catatan / Perlu Perbaikan</em>). Berita Acara resmi baru sah diterbitkan bila minimal <strong>2 dari 3 suara</strong> telah masuk.</li>
                <li>Cek menu <strong>Audit Trail</strong> kapan saja untuk melacak riwayat seluruh aktivitas perubahan/penghapusan data di sistem.</li>
              </ol>
            </div>
          </div>
        ),
      },
      {
        id: 'bab-admin',
        number: '09',
        title: 'Administrator: Data Master, Impor Keluarga, Edit/Hapus Darurat & Pengaturan',
        subtitle: 'Langkah pengelolaan user & hak akses kas, template master data keluarga per lingkungan, admin override transaksi, dan kop gereja',
        roles: ['all', 'admin'],
        keywords:
          'administrator data master keluarga lingkungan impor template master edit hapus transaksi audit trail pengaturan batas nota kop gereja',
        content: (
          <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2.5">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Database className="w-4 h-4 text-slate-800" />
                <span>Langkah Kerja 1: Kelola Data Master &amp; Impor Daftar Keluarga Jemaat</span>
              </h4>
              <ol className="list-decimal pl-4 space-y-1.5 text-slate-600">
                <li>Buka menu <strong>Data Master</strong> untuk mengelola <em>Kas Huria</em>, <em>Tahun Anggaran</em>, <em>Tempat Simpan</em>, <em>Kategori</em>, <em>Pengguna</em>, dan <em>Hak Akses Kas</em> (menentukan user mana menjadi <strong>Bendahara</strong> input atau <strong>Ketua</strong> penyetuju pada kas tertentu).</li>
                <li>Untuk menyiapkan data jemaat fitur Pelean Taon, buka tab <strong>Keluarga &amp; Lingkungan</strong> &rarr; klik <strong>Unduh Template Excel</strong>.</li>
                <li>Anda dapat memakai format 1 sheet gabungan atau file multi-sheet di mana nama tab adalah nama lingkungan (misal tab <em>EFESUS, LETARE, EXAUDI, JUDIKA, GALATIA, JEREMIA</em>).</li>
                <li>Unggah file Excel tersebut untuk pratinjau. Sistem otomatis memastikan seluruh nama keluarga diawali teks <strong>&quot;Kel. &quot;</strong> (contoh: <em>Kel. St. R. Sinaga / Br. Sitepu</em>) serta mendeteksi lingkungan baru atau duplikasi.</li>
              </ol>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                <FileEdit className="w-4 h-4 text-blue-700" />
                <span>Langkah Kerja 2: Edit / Hapus Transaksi Darurat &amp; Pengaturan Kebijakan</span>
              </h4>
              <ul className="list-disc pl-4 space-y-1 text-slate-600">
                <li>
                  <strong>Edit &amp; Hapus Transaksi (Admin):</strong> Bila terjadi salah input fatal pada transaksi yang sudah masuk, buka menu <strong>Edit &amp; Hapus Transaksi</strong> (atau tombol Edit/Hapus di Transaksi Kas). Wajib mengisi alasan perubahan/penghapusan agar terekam di <strong>Audit Trail</strong>.
                </li>
                <li>
                  <strong>Pengaturan:</strong> Buka menu <strong>Pengaturan</strong> untuk memperbarui nama gereja, pejabat penandatangan (Pendeta, Sekretaris, Bendahara Umum, Ketua Parartaon), nomor Virtual Account BPSK, batas nominal wajib nota ({receiptThresholdText}), dan opsi blokir pengeluaran jika saldo tidak mencukupi.
                </li>
              </ul>
            </div>
          </div>
        ),
      },
      {
        id: 'bab-faq',
        number: '10',
        title: 'Tanya Jawab (FAQ) & Solusi Cepat Kendala Operasional',
        subtitle: 'Jawaban masalah umum seputar tanggal Excel, awalan Kel., kunci periode, dan pembatalan transaksi',
        roles: [
          'all',
          'bendahara_umum',
          'bendahara_seksi',
          'ketua_seksi',
          'pendeta_ressort',
          'sekretaris',
          'auditor',
          'admin',
        ],
        keywords:
          'faq tanya jawab masalah error tanggal excel kel. hapus kas reversal kunci tutup buku sentralisasi',
        content: (
          <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
            <div className="border border-slate-200 rounded-xl p-3.5 bg-white space-y-1">
              <p className="font-bold text-slate-900">
                T: Bagaimana bila nama keluarga di Pelean Taon diketik tanpa &quot;Kel.&quot; (baik di aplikasi maupun di Excel)?
              </p>
              <p className="text-slate-600">
                <strong>J:</strong> Sistem otomatis menambahkan awalan <strong>&quot;Kel. &quot;</strong> saat disimpan atau diimpor sehingga format di database, Warta Keuangan, dan Rekap Pelean Taon selalu rapi dan seragam.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-3.5 bg-white space-y-1">
              <p className="font-bold text-slate-900">
                T: Mengapa baris Excel ditolak saat impor karena tanggal tidak valid atau periode terkunci?
              </p>
              <p className="text-slate-600">
                <strong>J:</strong> Pastikan tanggal diisi sesuai format terkunci template (<span className="font-mono">YYYY-MM-DD</span>, misalnya <span className="font-mono">2026-11-19</span>), tanggal transaksi tidak lebih awal dari Tanggal Mulai Pemakaian Pembukaan Buku, pembukaan buku kas tujuan sudah Dikunci (Locked), dan bulan tersebut belum dilakukan Tutup Buku.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-3.5 bg-white space-y-1">
              <p className="font-bold text-slate-900">
                T: Bagaimana jika transaksi sudah berstatus Disetujui ternyata salah nominal atau salah pilih kas?
              </p>
              <p className="text-slate-600">
                <strong>J:</strong> Untuk menjaga integritas pembukuan, Bendahara menggunakan tombol <strong>Koreksi / Pembalik (Reversal)</strong> agar sistem membuat jurnal lawan bernilai minus secara transparan, lalu mencatat ulang transaksi yang benar. Untuk kasus darurat teknis, hubungi Administrator melalui menu <strong>Edit &amp; Hapus Transaksi</strong> dengan alasan yang dicatat di Audit Trail.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-3.5 bg-white space-y-1">
              <p className="font-bold text-slate-900">
                T: Mengapa Kas yang sudah pernah dipakai tidak bisa dihapus di Data Master?
              </p>
              <p className="text-slate-600">
                <strong>J:</strong> Kas yang memiliki riwayat transaksi, saldo awal, panjar, atau aset dilindungi dari penghapusan permanen agar laporan tahun-tahun sebelumnya tidak rusak. Gunakan opsi <strong>Nonaktifkan Kas</strong> bila kas tersebut tidak digunakan lagi.
              </p>
            </div>
          </div>
        ),
      },
    ],
    [receiptThresholdText]
  );

  const filteredChapters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return chapters.filter((ch) => {
      const matchRole = selectedRole === 'all' || ch.roles.includes(selectedRole);
      const matchQuery =
        !q ||
        ch.title.toLowerCase().includes(q) ||
        ch.subtitle.toLowerCase().includes(q) ||
        ch.number.toLowerCase().includes(q) ||
        ch.keywords.toLowerCase().includes(q);
      return matchRole && matchQuery;
    });
  }, [chapters, selectedRole, searchQuery]);

  const myDetectedRole = detectCurrentUserFilter();

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 min-w-0">
      {/* Header Banner */}
      <div className="rounded-2xl bg-[#0B132B] text-white p-5 sm:p-7 border border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-slate-300 flex flex-wrap items-center gap-2">
              <span>Dokumentasi Operasional SIKU</span>
              <span aria-hidden="true">·</span>
              <span>{settings.church_name || 'HKBP Hutaraja'}</span>
              <span aria-hidden="true">·</span>
              <span>PPKU 2023 &amp; ISAK 35</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Buku Panduan Langkah Kerja per Peran &amp; Contoh Kasus
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Panduan praktis setiap fitur (Catat Transaksi, Tanggal Warta, Multi Pos Ucapan Syukur, Pelean Taon, Impor Excel, Transfer, Persetujuan, Audit, hingga LPJ) lengkap dengan langkah kerja per peran pengguna dan contoh pengisiannya.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={PPKU_DOCUMENT_URL}
              target="_blank"
              rel="noreferrer"
              className="min-h-[44px] sm:min-h-[40px] px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <Landmark className="w-4 h-4" />
              <span>Dokumen PPKU HKBP (PDF)</span>
            </a>
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[44px] sm:min-h-[40px] px-4 py-2 bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs rounded-xl inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-700" />
              <span>Cetak / PDF Panduan</span>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative max-w-xl">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari topik atau kata kunci (mis. 'pelean taon', 'excel', 'id grup', 'warta', 'audit', 'reversal')..."
            className="w-full min-h-[44px] sm:min-h-[40px] pl-10 pr-16 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-300 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-300"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[34px] px-2.5 text-xs text-slate-200 hover:text-white cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Role Filter Bar */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Users className="w-4 h-4 text-blue-700" />
            <span>Pilih Peran Pengguna untuk Melihat Langkah Kerja &amp; Contohnya:</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>
              Akun Anda: <strong className="text-slate-900">{currentUser?.full_name || currentUser?.role}</strong>
            </span>
            {myDetectedRole !== 'all' && selectedRole !== myDetectedRole && (
              <button
                type="button"
                onClick={() => {
                  setSelectedRole(myDetectedRole);
                  const firstMatch = chapters.find((c) => c.roles.includes(myDetectedRole));
                  if (firstMatch) setOpenChapter(firstMatch.id);
                }}
                className="text-blue-700 hover:underline font-semibold whitespace-nowrap cursor-pointer"
              >
                Tampilkan Peran Saya
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {roleFilters.map((rf) => {
            const Icon = rf.icon;
            const isSelected = selectedRole === rf.id;
            return (
              <button
                key={rf.id}
                type="button"
                onClick={() => {
                  setSelectedRole(rf.id);
                  const firstMatch = chapters.find((c) => rf.id === 'all' || c.roles.includes(rf.id));
                  if (firstMatch) setOpenChapter(firstMatch.id);
                }}
                className={`px-3.5 py-2 min-h-[44px] sm:min-h-[38px] rounded-xl text-xs font-semibold inline-flex items-center gap-2 shrink-0 whitespace-nowrap transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                <span>{rf.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accordion Chapters */}
      <div className="space-y-3.5">
        {filteredChapters.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 space-y-2">
            <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-800 text-sm">Topik panduan tidak ditemukan</p>
            <p className="text-xs text-slate-500">
              Tidak ada bab yang cocok dengan kata kunci &quot;{searchQuery}&quot;. Coba kata kunci lain seperti &quot;excel&quot;, &quot;pelean taon&quot;, &quot;persetujuan&quot;, atau &quot;audit&quot;.
            </p>
          </div>
        ) : (
          filteredChapters.map((ch) => {
            const isOpen = openChapter === ch.id;
            return (
              <div
                key={ch.id}
                id={ch.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenChapter(isOpen ? '' : ch.id)}
                  className={`w-full p-4 sm:p-5 min-h-[56px] text-left flex items-start sm:items-center justify-between gap-4 transition-colors cursor-pointer ${
                    isOpen ? 'bg-slate-50 border-b border-slate-200' : 'hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 transition-colors ${
                        isOpen ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {ch.number}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
                        {ch.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">{ch.subtitle}</p>
                    </div>
                  </div>

                  <div className="shrink-0 p-1.5 rounded-lg text-slate-400">
                    {isOpen ? (
                      <ChevronUp className="w-5 h-5 text-blue-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </div>
                </button>

                {isOpen && <div className="p-4 sm:p-6 bg-white">{ch.content}</div>}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Help Strip */}
      <div className="bg-slate-900 rounded-2xl p-5 sm:p-6 text-white flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center md:text-left">
          <h4 className="font-bold text-sm sm:text-base text-white">
            Butuh Bantuan Teknis atau Koreksi Data?
          </h4>
          <p className="text-xs text-slate-300 max-w-xl">
            Hubungi Bendahara Umum atau Administrator Sistem {settings.church_name} apabila mengalami kendala hak akses kas, pembukaan buku, atau perbaikan transaksi yang sudah terkunci.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSelectedRole('all');
            setOpenChapter('bab-faq');
            const el = document.getElementById('bab-faq');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          className="w-full md:w-auto min-h-[44px] sm:min-h-[40px] px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer shrink-0"
        >
          Buka FAQ Cepat
        </button>
      </div>
    </div>
  );
};
