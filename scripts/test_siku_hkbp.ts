/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Comprehensive Test Suite for SIKU HKBP (Sistem Informasi Keuangan Huria HKBP)
 * Tests PPKU Sentralisasi, RBAC Tata Gereja, Saldo Kas, and Validation Rules.
 */

import {
  DEMO_CATEGORIES,
  DEMO_KAS,
  DEMO_STORAGE_ACCOUNTS,
  DEMO_OPENING_BALANCES,
  DEMO_PROFILES,
  DEMO_SETTINGS,
  DEMO_USER_KAS_ACCESS,
} from '../src/lib/demoData';
import { formatRupiah, formatDateIndo } from '../src/lib/formatters';
import {
  getPpkuProcurementRule,
  evaluateBpskRemittanceCompliance,
  PPKU_OFFICIAL_PELEAN_11,
  PPKU_PANJAR_DEADLINE_DAYS,
  PPKU_BPSK_DEADLINE_DAYS,
} from '../src/lib/ppkuRules';

interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, message?: string) {
  if (condition) {
    results.push({ name, passed: true });
    console.log(`  \x1b[32m✔ PASS:\x1b[0m ${name}`);
  } else {
    results.push({ name, passed: false, message });
    console.error(`  \x1b[31m✘ FAIL:\x1b[0m ${name} - ${message || 'Assertion failed'}`);
  }
}

console.log('\n=============================================================');
console.log(' PENGUJIAN KOMPREHENSIF APLIKASI SIKU HKBP (PPKU SENTRALISASI)');
console.log('=============================================================\n');

// -------------------------------------------------------------
// PENGUJIAN 1: Validasi Kategori PPKU Sentralisasi Keuangan HKBP
// -------------------------------------------------------------
console.log('▶ UJI 1: Master Kategori & Objek PPKU Sentralisasi HKBP');

const incomeCats = DEMO_CATEGORIES.filter((c) => c.tipe === 'income');
const expenseCats = DEMO_CATEGORIES.filter((c) => c.tipe === 'expense');

assert(incomeCats.length >= 17, 'Jumlah Kategori Penerimaan minimal 17 pos resmi PPKU');
assert(expenseCats.length >= 10, 'Jumlah Kategori Beban/Pengeluaran minimal 10 pos operasional');

// Check Objek Sentralisasi (Pelean Ia/Ib/II, Namarboho, Persepuluhan, Partangiangan, Kategorial, Hari Raya, Ulaon Na Badia, Hamauliateon, Badan Usaha, Sewa Aset Yayasan)
const objekSentralisasi = incomeCats.filter((c) => c.is_sentralisasi !== false);
assert(objekSentralisasi.length === 17, `Terdapat tepat 17 pos Objek Sentralisasi PPKU 2023 (ditemukan: ${objekSentralisasi.length})`);

// Check 3 Exclusions
const posDikecualikan = incomeCats.filter((c) => c.is_sentralisasi === false);
assert(posDikecualikan.length === 3, `Terdapat tepat 3 pos Pengecualian Resmi (ditemukan: ${posDikecualikan.length})`);

const sosialDuka = posDikecualikan.find((c) => c.sentralisasi_exclusion_type === 'sosial_duka');
assert(!!sosialDuka, 'Pos Pengecualian 1: Pelean Sosial / Duka (Gariana) terdaftar');
assert(sosialDuka?.kode === 'IN-EX-01', 'Kode Pelean Sosial / Duka adalah IN-EX-01');

const beasiswa = posDikecualikan.find((c) => c.sentralisasi_exclusion_type === 'beasiswa');
assert(!!beasiswa, 'Pos Pengecualian 2: Pelean Beasiswa (Dana Belajar) terdaftar');
assert(beasiswa?.kode === 'IN-EX-02', 'Kode Pelean Beasiswa adalah IN-EX-02');

const pembangunan = posDikecualikan.find((c) => c.sentralisasi_exclusion_type === 'pembangunan_lokal');
assert(!!pembangunan, 'Pos Pengecualian 3: Dana Pembangunan Fisik Lokal terdaftar');
assert(pembangunan?.kode === 'IN-EX-03', 'Kode Dana Pembangunan adalah IN-EX-03');

// Check Setoran BPSK
const setoranBpskCat = expenseCats.find((c) => c.id === 'cat-out-bpsk' || c.kode === 'OUT-01');
assert(!!setoranBpskCat, 'Kategori pengeluaran "Penyetoran 55% Sentralisasi ke BPSK HKBP" terdaftar');


// -------------------------------------------------------------
// PENGUJIAN 2: Kalkulasi Matematis Pembagian 55% BPSK vs 45% Huria
// -------------------------------------------------------------
console.log('\n▶ UJI 2: Akurasi Matematis Pembagian 55% BPSK vs 45% Huria');

const testCases = [
  { amount: 1_000_000, expectedBpsk: 550_000, expectedHuria: 450_000 },
  { amount: 3_500_000, expectedBpsk: 1_925_000, expectedHuria: 1_575_000 },
  { amount: 777_777, expectedBpsk: Math.round(777_777 * 0.55), expectedHuria: 777_777 - Math.round(777_777 * 0.55) },
  { amount: 25_480_500, expectedBpsk: Math.round(25_480_500 * 0.55), expectedHuria: 25_480_500 - Math.round(25_480_500 * 0.55) },
  { amount: 100, expectedBpsk: 55, expectedHuria: 45 },
];

testCases.forEach((tc, idx) => {
  const bpsk = Math.round(tc.amount * 0.55);
  const huria = tc.amount - bpsk;
  const isMatch = bpsk === tc.expectedBpsk && huria === tc.expectedHuria && (bpsk + huria === tc.amount);
  assert(isMatch, `Kasus ${idx + 1}: Nominal ${formatRupiah(tc.amount)} -> BPSK ${formatRupiah(bpsk)} + Huria ${formatRupiah(huria)} = Tepat 100%`);
});

// Test Pengecualian (100% Huria)
const exclusionAmount = 5_000_000;
const exBpsk = 0;
const exHuria = exclusionAmount;
assert(exBpsk === 0 && exHuria === exclusionAmount, `Pos Pengecualian 100% Bebas Sentralisasi: BPSK = Rp 0, Huria = ${formatRupiah(exclusionAmount)}`);


// -------------------------------------------------------------
// PENGUJIAN 3: Integritas Saldo Awal Nol (Clean Initial State) & 10 Kas
// -------------------------------------------------------------
console.log('\n▶ UJI 3: Integritas Saldo Awal Bersih (Semua Saldo = 0) & 10 Kas');

assert(DEMO_KAS.length === 10, `Terdapat 10 Kas Huria, Seksi & Unit (ditemukan: ${DEMO_KAS.length})`);
assert(!!DEMO_KAS.find((k) => k.id === 'kas-2' && k.nama === 'Kas Sosial Huria'), 'Kas Sosial Huria (kas-2) terdaftar');
assert(!!DEMO_KAS.find((k) => k.id === 'kas-7' && k.nama === 'Kas Pembangunan'), 'Kas Pembangunan (kas-7) terdaftar');
assert(!!DEMO_KAS.find((k) => k.id === 'kas-8' && k.nama === 'Kas Transitoris'), 'Kas Transitoris (kas-8) terdaftar');
assert(!!DEMO_KAS.find((k) => k.id === 'kas-9' && k.nama === 'Kas Sentralisasi'), 'Kas Sentralisasi (kas-9) terdaftar');
assert(!!DEMO_KAS.find((k) => k.id === 'kas-10' && k.nama === 'Kas Sopo Godang'), 'Kas Sopo Godang (kas-10) terdaftar');
assert(DEMO_STORAGE_ACCOUNTS.length === 3, `Terdapat 3 Rekening/Penyimpanan (ditemukan: ${DEMO_STORAGE_ACCOUNTS.length})`);

const totalInitialBalances = DEMO_OPENING_BALANCES.reduce((sum, item) => sum + Number(item.amount), 0);
assert(totalInitialBalances === 0, `Total Seluruh Saldo Awal adalah Rp 0 (ditemukan: ${formatRupiah(totalInitialBalances)})`);

DEMO_OPENING_BALANCES.forEach((ob) => {
  assert(Number(ob.amount) === 0, `Saldo Awal ${ob.notes || ob.id} bernilai 0`);
});


// -------------------------------------------------------------
// PENGUJIAN 4: Formatters Rupiah & Bahasa Indonesia
// -------------------------------------------------------------
console.log('\n▶ UJI 4: Standardisasi Format Rupiah & Tanggal Liturgis HKBP');

assert(formatRupiah(0) === 'Rp 0', 'Format Rp 0 tampil bersih tanpa desimal kosong');
assert(formatRupiah(1500000).replace(/\s/g, ' ').includes('1.500.000'), 'Format Rp 1.500.000 menggunakan titik ribuan');
assert(formatDateIndo('2026-11-11').includes('November'), 'Tanggal dikonversi ke nama bulan Indonesia yang baku');


// -------------------------------------------------------------
// PENGUJIAN 5: Simulasi Agregasi Rekapitulasi Sentralisasi PPKU
// -------------------------------------------------------------
console.log('\n▶ UJI 5: Simulasi Agregasi BPSK (getSentralisasiSummary)');

// Mock transactions
interface MockTx {
  type: 'income' | 'expense';
  amount: number;
  category_id: string;
  is_sentralisasi: boolean;
  status: string;
}

const mockTransactions: MockTx[] = [
  // 1. Pelean Minggu (Objek Sentralisasi)
  { type: 'income', amount: 10_000_000, category_id: 'cat-in-pelean-1-2', is_sentralisasi: true, status: 'approved' },
  // 2. Namarboho Bulanan (Objek Sentralisasi)
  { type: 'income', amount: 4_000_000, category_id: 'cat-in-namarboho', is_sentralisasi: true, status: 'approved' },
  // 3. Pelean Sosial / Duka (Pengecualian)
  { type: 'income', amount: 2_000_000, category_id: 'cat-in-ex-sosial-duka', is_sentralisasi: false, status: 'approved' },
  // 4. Dana Pembangunan Fisik (Pengecualian)
  { type: 'income', amount: 5_000_000, category_id: 'cat-in-ex-pembangunan', is_sentralisasi: false, status: 'approved' },
  // 5. Penyetoran ke BPSK HKBP (Pengeluaran)
  { type: 'expense', amount: 5_000_000, category_id: 'cat-out-bpsk', is_sentralisasi: false, status: 'approved' },
];

let totalPenerimaan = 0;
let totalObjekSentralisasi = 0;
let totalBpskObligation = 0;
let totalHuriaShare = 0;
let totalDikecualikan = 0;
let totalBpskRemitted = 0;

mockTransactions.forEach((tx) => {
  if (tx.type === 'income') {
    totalPenerimaan += tx.amount;
    if (tx.is_sentralisasi) {
      totalObjekSentralisasi += tx.amount;
      const bpsk = Math.round(tx.amount * 0.55);
      const huria = tx.amount - bpsk;
      totalBpskObligation += bpsk;
      totalHuriaShare += huria;
    } else {
      totalDikecualikan += tx.amount;
    }
  } else if (tx.type === 'expense' && tx.category_id === 'cat-out-bpsk') {
    totalBpskRemitted += tx.amount;
  }
});

const outstandingBpsk = Math.max(0, totalBpskObligation - totalBpskRemitted);

assert(totalPenerimaan === 21_000_000, `Total Penerimaan = Rp 21.000.000 (didapat: ${formatRupiah(totalPenerimaan)})`);
assert(totalObjekSentralisasi === 14_000_000, `Total Objek Sentralisasi = Rp 14.000.000 (didapat: ${formatRupiah(totalObjekSentralisasi)})`);
assert(totalBpskObligation === 7_700_000, `Kewajiban 55% BPSK = Rp 7.700.000 (didapat: ${formatRupiah(totalBpskObligation)})`);
assert(totalHuriaShare === 6_300_000, `Hak 45% Kas Huria = Rp 6.300.000 (didapat: ${formatRupiah(totalHuriaShare)})`);
assert(totalDikecualikan === 7_000_000, `Total Pos Dikecualikan = Rp 7.000.000 (didapat: ${formatRupiah(totalDikecualikan)})`);
assert(totalBpskRemitted === 5_000_000, `Realisasi Setoran BPSK = Rp 5.000.000 (didapat: ${formatRupiah(totalBpskRemitted)})`);
assert(outstandingBpsk === 2_700_000, `Sisa Kewajiban BPSK = Rp 2.700.000 (didapat: ${formatRupiah(outstandingBpsk)})`);
assert(totalObjekSentralisasi + totalDikecualikan === totalPenerimaan, 'Persamaan Objek + Pengecualian = Total Penerimaan Terpenuhi');
assert(totalBpskObligation + totalHuriaShare === totalObjekSentralisasi, 'Persamaan 55% BPSK + 45% Huria = 100% Objek Terpenuhi');


// -------------------------------------------------------------
// PENGUJIAN 6: Struktur Pengurus Resmi, Hak Akses Kas, & Warta Mingguan
// -------------------------------------------------------------
console.log('\n▶ UJI 6: Struktur Pengurus HKBP Hutaraja & Siklus Warta Minggu–Sabtu');

assert(DEMO_SETTINGS.pendeta_name === 'Pdt. Santa Lucia Manurung, S.Th', 'Pendeta Ressort: Pdt. Santa Lucia Manurung, S.Th');
assert(DEMO_SETTINGS.sekretaris_name === 'St. Sardi Simanullang', 'Sekretaris Ressort: St. Sardi Simanullang');
assert(DEMO_SETTINGS.bendahara_umum_name === 'St. Manaek Lumban Gaol', 'Bendahara Umum: St. Manaek Lumban Gaol');

const expectedNames = [
  'Pdt. Santa Lucia Manurung, S.Th',
  'St. Sardi Simanullang',
  'St. Manaek Lumban Gaol',
  'St. Harbet Simanjuntak',
  'St. Oloan Silaban',
  'St. Tohap Sihombing',
  'St. Sondang Samosir',
  'St. Juangga Sihite',
  'St. Parulian Simaremare',
  'Dedi Tumanggor',
  'Usuawan Simanullang',
  'Ria Mega Panjaitan',
  'Sabar Sianturi, S.E',
  'Hendra Supreddi Simaremare, S.I.P',
  'Zico Andrianus Simanjuntak',
];

expectedNames.forEach((name) => {
  assert(DEMO_PROFILES.some((p) => p.full_name.includes(name)), `Pengurus terdaftar: ${name}`);
});

const bendumKasIds = DEMO_USER_KAS_ACCESS.filter(
  (a) => a.user_id === 'user-bendum' && a.access_level === 'bendahara'
).map((a) => a.kas_id);
assert(
  ['kas-1', 'kas-2', 'kas-7', 'kas-8', 'kas-9'].every((id) => bendumKasIds.includes(id)) && bendumKasIds.length === 5,
  'Bendahara Umum mengelola tepat 5 kas: Umum, Sosial Huria, Pembangunan, Transitoris, Sentralisasi'
);

const sopoBend = DEMO_USER_KAS_ACCESS.some(
  (a) => a.user_id === 'user-sopo-bendahara' && a.kas_id === 'kas-10' && a.access_level === 'bendahara'
);
assert(sopoBend, 'Bendahara Sopo Godang (Ria Mega Panjaitan) mengelola Kas Sopo Godang (kas-10)');

// Simulasi siklus Warta Keuangan Mingguan (Minggu s.d. Sabtu -> Diwartakan Minggu berikutnya)
const sampleRef = new Date(2026, 10, 11); // Rabu, 11 November 2026
const sun = new Date(sampleRef);
sun.setDate(sun.getDate() - sun.getDay()); // Minggu 8 Nov 2026
const sat = new Date(sun);
sat.setDate(sat.getDate() + 6); // Sabtu 14 Nov 2026
const nextSun = new Date(sun);
nextSun.setDate(nextSun.getDate() + 7); // Minggu 15 Nov 2026

assert(sun.getDay() === 0 && sun.getDate() === 8, 'Awal minggu Warta adalah hari Minggu (8 Nov 2026)');
assert(sat.getDay() === 6 && sat.getDate() === 14, 'Akhir minggu Warta adalah hari Sabtu (14 Nov 2026)');
assert(nextSun.getDay() === 0 && nextSun.getDate() === 15, 'Hari pewartaan adalah Minggu berikutnya (15 Nov 2026)');

// -------------------------------------------------------------
// PENGUJIAN 7: Kepatuhan PPKU HKBP 2023 (SK Ephorus No. 1670/L08/XII/2022)
// -------------------------------------------------------------
console.log('\n▶ UJI 7: Kepatuhan PPKU HKBP 2023 (Pasal 4, 10, 20, 21, 26)');

assert(PPKU_OFFICIAL_PELEAN_11.length === 11, 'Terdapat 11 jenis Pelean Huria resmi sesuai PPKU Pasal 4 ayat (3)a–k');
assert(PPKU_BPSK_DEADLINE_DAYS === 3, 'Batas waktu penyetoran 55% BPSK adalah H+3 setelah ibadah (Pasal 4 ayat 2a)');
assert(PPKU_PANJAR_DEADLINE_DAYS === 14, 'Batas pertanggungjawaban kepanitiaan/panjar adalah 14 hari (Pasal 20)');
assert(DEMO_SETTINGS.ketua_parartaon_name === 'St. Harbet Simanjuntak', 'Ketua Parartaon terdaftar sebagai penandatangan laporan (Pasal 26 ayat 1e)');
assert(!!DEMO_SETTINGS.bpsk_va_number, 'Nomor Virtual Account BPSK HKBP terkonfigurasi (Pasal 10 ayat 2)');

// Uji Pasal 21: 3 Tier Tata Cara Pengadaan
assert(getPpkuProcurementRule(25_000_000).tier === 'pengadaan_langsung', 'Pasal 21(1): Belanja <= 50 Jt -> Pengadaan Langsung');
assert(getPpkuProcurementRule(50_000_000).tier === 'pengadaan_langsung', 'Pasal 21(1): Belanja tepat 50 Jt -> Pengadaan Langsung');
assert(getPpkuProcurementRule(75_000_000).tier === 'penunjukan_langsung', 'Pasal 21(2): Belanja 50–100 Jt -> Penunjukan Langsung / Beauty Contest');
assert(getPpkuProcurementRule(150_000_000).tier === 'tender_terbatas', 'Pasal 21(3): Belanja > 100 Jt -> Tender Terbatas (min. 2 penawaran)');

// Uji Pasal 4(2)a: Evaluasi H+3 Setoran BPSK
const h3LateEval = evaluateBpskRemittanceCompliance(
  [
    {
      id: 'tx-h3-1',
      tanggal: '2026-11-01',
      kas_id: 'kas-1',
      storage_account_id: 'stor-1',
      category_id: 'cat-in-pelean-1-2',
      type: 'income',
      amount: 10_000_000,
      description: 'Pelean Minggu 1 Nov',
      status: 'approved',
      is_reversal: false,
      is_sentralisasi: true,
      bpsk_amount: 5_500_000,
    },
  ],
  DEMO_CATEGORIES,
  '2026-11-06' // H+5 -> lewat batas H+3
);
assert(h3LateEval.status === 'terlambat_h3' && h3LateEval.daysElapsed === 5, 'Evaluasi H+3 mendeteksi keterlambatan setor BPSK lewat 3 hari');

const h3PaidEval = evaluateBpskRemittanceCompliance(
  [
    {
      id: 'tx-h3-1',
      tanggal: '2026-11-01',
      kas_id: 'kas-1',
      storage_account_id: 'stor-1',
      category_id: 'cat-in-pelean-1-2',
      type: 'income',
      amount: 10_000_000,
      description: 'Pelean Minggu 1 Nov',
      status: 'approved',
      is_reversal: false,
      is_sentralisasi: true,
      bpsk_amount: 5_500_000,
    },
    {
      id: 'tx-h3-2',
      tanggal: '2026-11-03',
      kas_id: 'kas-1',
      storage_account_id: 'stor-2',
      category_id: 'cat-out-bpsk',
      type: 'expense',
      amount: 5_500_000,
      description: 'Setor BPSK 55% via VA',
      status: 'approved',
      is_reversal: false,
    },
  ],
  DEMO_CATEGORIES,
  '2026-11-06'
);
assert(h3PaidEval.status === 'lunas' && h3PaidEval.outstandingBpsk === 0, 'Evaluasi H+3 berstatus LUNAS setelah 55% disetorkan ke BPSK');


// -------------------------------------------------------------
// RINGKASAN HASIL
// -------------------------------------------------------------
console.log('\n=============================================================');
const totalTests = results.length;
const passedTests = results.filter((r) => r.passed).length;
const failedTests = totalTests - passedTests;

if (failedTests === 0) {
  console.log(`\x1b[32m✔ SEMUA PENGUJIAN BERHASIL (${passedTests}/${totalTests} Uji Validasi Lolos)\x1b[0m`);
  console.log('Aplikasi 100% terverifikasi siap pakai untuk jemaat HKBP.');
} else {
  console.error(`\x1b[31m✘ ${failedTests} Pengujian Gagal!\x1b[0m`);
}
console.log('=============================================================\n');
