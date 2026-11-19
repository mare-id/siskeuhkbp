/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pedoman Pengelolaan Keuangan Umum (PPKU) HKBP Tahun 2023
 * Dasar Hukum: SK Ephorus HKBP No. 1670/L08/XII/2022 (7 Desember 2022)
 */

import { Category, Transaction } from '../types/database';

export const PPKU_SK_NUMBER = 'SK Ephorus No. 1670/L08/XII/2022';
export const PPKU_EFFECTIVE_YEAR = 2023;
export const PPKU_DOCUMENT_URL =
  '/assets/aistudio/pdf-pedoman-pengelolaan-keuangan-umum-hkbp-2023-paraf_compress_f3e26fb8.pdf';

// Pasal 4 ayat (2): Pembagian Sentralisasi 55% BPSK / 45% Huria
export const PPKU_BPSK_RATE = 0.55;
export const PPKU_HURIA_RATE = 0.45;

// Pasal 4 ayat (2) huruf a: Penyetoran maksimal 3 hari setelah ibadah jemaat
export const PPKU_BPSK_DEADLINE_DAYS = 3;

// Pasal 20: Batas pertanggungjawaban keuangan kepanitiaan non-rutin maksimal 14 hari
export const PPKU_PANJAR_DEADLINE_DAYS = 14;

// Pasal 21: Batas nominal tata cara pengadaan barang/jasa
export const PPKU_PROCUREMENT_DIRECT_MAX = 50_000_000;
export const PPKU_PROCUREMENT_SELECTION_MAX = 100_000_000;

export type PpkuProcurementTier =
  | 'pengadaan_langsung'
  | 'penunjukan_langsung'
  | 'tender_terbatas';

export interface PpkuProcurementRule {
  tier: PpkuProcurementTier;
  label: string;
  pasalRef: string;
  requirement: string;
  minQuotesRequired: number;
  badgeClass: string;
}

/**
 * Menentukan tata cara pengadaan barang/jasa berdasarkan nominal belanja
 * sesuai PPKU HKBP 2023 Pasal 21.
 */
export function getPpkuProcurementRule(amount: number): PpkuProcurementRule {
  const cleanAmount = Math.max(0, Number(amount) || 0);

  if (cleanAmount <= PPKU_PROCUREMENT_DIRECT_MAX) {
    return {
      tier: 'pengadaan_langsung',
      label: 'Pengadaan Langsung (<= Rp 50 Juta)',
      pasalRef: 'PPKU Pasal 21 ayat (1) & Pasal 18 ayat (3)',
      requirement:
        'Dilakukan secara langsung sesuai harga pasar yang wajar dengan wajib dilampiri kuitansi/nota yang sah.',
      minQuotesRequired: 1,
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    };
  }

  if (cleanAmount <= PPKU_PROCUREMENT_SELECTION_MAX) {
    return {
      tier: 'penunjukan_langsung',
      label: 'Penunjukan Langsung / Beauty Contest (> Rp 50 Jt – Rp 100 Jt)',
      pasalRef: 'PPKU Pasal 21 ayat (2)',
      requirement:
        'Wajib melalui mekanisme Penunjukan Langsung terhadap 1 penyedia terpilih (beauty contest) disertai dokumen penawaran harga dan kuitansi sah.',
      minQuotesRequired: 1,
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    };
  }

  return {
    tier: 'tender_terbatas',
    label: 'Tender / Seleksi Terbatas (> Rp 100 Juta)',
    pasalRef: 'PPKU Pasal 21 ayat (3)',
    requirement:
      'Wajib melalui Tender Terbatas / Seleksi Terbatas dengan minimal 2 (dua) penawaran tertulis dari rekanan berbeda serta berita acara penetapan pemenang.',
    minQuotesRequired: 2,
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-300',
  };
}

export type BpskComplianceStatus =
  | 'lunas'
  | 'dalam_batas_h3'
  | 'batas_hari_ini'
  | 'terlambat_h3';

export interface BpskComplianceEvaluation {
  status: BpskComplianceStatus;
  totalBpskObligation: number;
  totalBpskRemitted: number;
  outstandingBpsk: number;
  oldestUnremittedDate: string | null;
  latestIncomeDate: string | null;
  deadlineDate: string | null;
  daysElapsed: number;
  daysRemaining: number;
  summaryText: string;
}

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function diffDaysIso(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  const t1 = Date.UTC(y1, (m1 || 1) - 1, d1 || 1);
  const t2 = Date.UTC(y2, (m2 || 1) - 1, d2 || 1);
  return Math.floor((t2 - t1) / (1000 * 60 * 60 * 24));
}

function todayLocalIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Menghitung pembagian 55% Kas Sentralisasi (BPSK) dan 45% Kas Tujuan (Huria)
 * atau 100% ke Kas Tujuan apabila bukan objek sentralisasi.
 */
export function splitSentralisasiAmount(
  amount: number,
  isSentralisasi: boolean
): { bpskAmount: number; huriaAmount: number } {
  const cleanAmount = Math.max(0, Math.round(Number(amount) || 0));
  if (!isSentralisasi) {
    return { bpskAmount: 0, huriaAmount: cleanAmount };
  }
  const bpskAmount = Math.round(cleanAmount * PPKU_BPSK_RATE);
  return { bpskAmount, huriaAmount: cleanAmount - bpskAmount };
}

function isBpskRemittanceCategoryOrTx(tx: Transaction, cat?: Category): boolean {
  if (cat?.id === 'cat-out-bpsk' || cat?.kode === 'OUT-01') return true;
  const catName = (cat?.nama || '').toLowerCase();
  if (catName.includes('bpsk') || catName.includes('sentralisasi ke kas pusat')) return true;
  if (!cat) {
    const desc = (tx.description || '').toLowerCase();
    return (desc.includes('setoran') || desc.includes('transfer')) && desc.includes('bpsk');
  }
  return false;
}

function getBpskPortion(tx: Transaction): number {
  const amt = Number(tx.amount) || 0;
  if (tx.sentralisasi_role === 'huria_share') return 0;
  if (tx.sentralisasi_role === 'bpsk_share') return amt;
  if (tx.bpsk_amount !== undefined && tx.bpsk_amount !== null) return Number(tx.bpsk_amount);
  return Math.round(amt * PPKU_BPSK_RATE);
}

/**
 * Mengevaluasi kepatuhan batas waktu penyetoran 55% Sentralisasi ke Virtual Account BPSK HKBP
 * maksimal 3 hari setelah ibadah jemaat (PPKU HKBP 2023 Pasal 4 ayat 2a & Pasal 10).
 */
export function evaluateBpskRemittanceCompliance(
  transactions: Transaction[],
  categories: Category[],
  referenceDateStr: string = todayLocalIso()
): BpskComplianceEvaluation {
  const approved = transactions.filter((tx) => tx.status === 'approved');
  const txById = new Map(approved.map((tx) => [tx.id, tx]));
  const catById = new Map(categories.map((c) => [c.id, c]));

  // Identifikasi ID transaksi asli yang telah dibalik/dikoreksi di periode yang sama
  const reversedTargetIds = new Set<string>();
  approved.forEach((tx) => {
    if (tx.is_reversal && tx.reverses_id && txById.has(tx.reverses_id)) {
      reversedTargetIds.add(tx.reverses_id);
    }
  });

  // Penerimaan objek sentralisasi yang belum dibalik untuk perhitungan antrean FIFO H+3
  const sentralisasiIncomes = approved
    .filter((tx) => {
      if (tx.type !== 'income' || tx.is_reversal) return false;
      if (reversedTargetIds.has(tx.id)) return false;
      const isExcluded = tx.is_sentralisasi === false || tx.sentralisasi_role === 'non_sentralisasi';
      return !isExcluded;
    })
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  let totalBpskObligation = 0;
  sentralisasiIncomes.forEach((tx) => {
    totalBpskObligation += getBpskPortion(tx);
  });

  // Kurangi kewajiban BPSK apabila terdapat reversal di irisan ini yang transaksi aslinya di luar irisan
  approved.forEach((tx) => {
    if (!tx.is_reversal || tx.type !== 'expense') return;
    if (tx.reverses_id && txById.has(tx.reverses_id)) return; // sudah dikeluarkan via reversedTargetIds
    const isExcluded = tx.is_sentralisasi === false || tx.sentralisasi_role === 'non_sentralisasi';
    if (!isExcluded) {
      totalBpskObligation -= getBpskPortion(tx);
    }
  });
  totalBpskObligation = Math.max(0, totalBpskObligation);

  let totalBpskRemitted = 0;
  approved.forEach((tx) => {
    if (tx.type === 'expense' && !tx.is_reversal) {
      if (reversedTargetIds.has(tx.id)) return;
      const cat = tx.category_id ? catById.get(tx.category_id) : undefined;
      if (isBpskRemittanceCategoryOrTx(tx, cat)) {
        totalBpskRemitted += Number(tx.amount) || 0;
      }
    } else if (tx.is_reversal && tx.type === 'income') {
      // Reversal atas setoran BPSK (jika aslinya di luar irisan, kurangi setoran)
      if (tx.reverses_id && txById.has(tx.reverses_id)) return;
      const cat = tx.category_id ? catById.get(tx.category_id) : undefined;
      if (isBpskRemittanceCategoryOrTx(tx, cat)) {
        totalBpskRemitted -= Number(tx.amount) || 0;
      }
    }
  });
  totalBpskRemitted = Math.max(0, totalBpskRemitted);

  const outstandingBpsk = Math.max(0, totalBpskObligation - totalBpskRemitted);
  const latestIncomeDate =
    sentralisasiIncomes.length > 0
      ? sentralisasiIncomes[sentralisasiIncomes.length - 1].tanggal
      : null;

  if (outstandingBpsk <= 0 || sentralisasiIncomes.length === 0) {
    return {
      status: 'lunas',
      totalBpskObligation,
      totalBpskRemitted,
      outstandingBpsk: 0,
      oldestUnremittedDate: null,
      latestIncomeDate,
      deadlineDate: null,
      daysElapsed: 0,
      daysRemaining: PPKU_BPSK_DEADLINE_DAYS,
      summaryText:
        totalBpskObligation === 0
          ? 'Belum ada penerimaan objek sentralisasi pada periode ini.'
          : 'Seluruh kewajiban 55% Sentralisasi BPSK telah disetorkan lunas tepat waktu.',
    };
  }

  // FIFO: Temukan tanggal penerimaan pelean tertua yang porsi 55%-nya belum lunas disetor
  let remainingRemitted = totalBpskRemitted;
  let oldestUnremittedDate = sentralisasiIncomes[0].tanggal;
  for (const tx of sentralisasiIncomes) {
    const bpsk = getBpskPortion(tx);
    if (bpsk <= 0) continue;
    if (remainingRemitted >= bpsk) {
      remainingRemitted -= bpsk;
    } else {
      oldestUnremittedDate = tx.tanggal;
      break;
    }
  }

  const deadlineDate = addDaysIso(oldestUnremittedDate, PPKU_BPSK_DEADLINE_DAYS);
  const daysElapsed = Math.max(0, diffDaysIso(oldestUnremittedDate, referenceDateStr));
  const daysRemaining = PPKU_BPSK_DEADLINE_DAYS - daysElapsed;

  if (daysElapsed > PPKU_BPSK_DEADLINE_DAYS) {
    return {
      status: 'terlambat_h3',
      totalBpskObligation,
      totalBpskRemitted,
      outstandingBpsk,
      oldestUnremittedDate,
      latestIncomeDate,
      deadlineDate,
      daysElapsed,
      daysRemaining,
      summaryText: `Melewati batas H+${PPKU_BPSK_DEADLINE_DAYS} PPKU Pasal 4(2)a (${daysElapsed} hari sejak transaksi ${oldestUnremittedDate}). Segera setor ke Virtual Account BPSK HKBP.`,
    };
  }

  if (daysElapsed === PPKU_BPSK_DEADLINE_DAYS) {
    return {
      status: 'batas_hari_ini',
      totalBpskObligation,
      totalBpskRemitted,
      outstandingBpsk,
      oldestUnremittedDate,
      latestIncomeDate,
      deadlineDate,
      daysElapsed,
      daysRemaining: 0,
      summaryText: `Hari ke-3 batas akhir penyetoran (H+3 jatuh hari ini). Segera transfer porsi 55% ke Virtual Account BPSK HKBP.`,
    };
  }

  return {
    status: 'dalam_batas_h3',
    totalBpskObligation,
    totalBpskRemitted,
    outstandingBpsk,
    oldestUnremittedDate,
    latestIncomeDate,
    deadlineDate,
    daysElapsed,
    daysRemaining,
    summaryText: `Dalam tenggang waktu H+${PPKU_BPSK_DEADLINE_DAYS} PPKU Pasal 4(2)a (tersisa ${daysRemaining} hari s.d. ${deadlineDate}).`,
  };
}

/**
 * 11 Jenis Pelean Huria Resmi berdasarkan PPKU HKBP 2023 Pasal 4 ayat (3) huruf a–k
 */
export const PPKU_OFFICIAL_PELEAN_11 = [
  { huruf: 'a', nama: 'Pelean Ibadah Ia', kategoriKode: 'IN-01' },
  { huruf: 'b', nama: 'Pelean Ibadah Ib', kategoriKode: 'IN-01' },
  { huruf: 'c', nama: 'Pelean Ibadah II', kategoriKode: 'IN-01' },
  { huruf: 'd', nama: 'Pelean Ibadah Partangiangan', kategoriKode: 'IN-03' },
  { huruf: 'e', nama: 'Pelean Ibadah Sermon Kategorial', kategoriKode: 'IN-04' },
  { huruf: 'f', nama: 'Pelean Ibadah Partumpolon / Pasupasu', kategoriKode: 'IN-09' },
  { huruf: 'g', nama: 'Pelean Ibadah Ulaon Na Badia (Perjamuan Kudus)', kategoriKode: 'IN-05B' },
  { huruf: 'h', nama: 'Pelean Ibadah Khusus / Kasual', kategoriKode: 'IN-05' },
  { huruf: 'i', nama: 'Pelean Hamauliateon', kategoriKode: 'IN-06' },
  { huruf: 'j', nama: 'Pelean Persepuluhan', kategoriKode: 'IN-02B' },
  { huruf: 'k', nama: 'Pelean Bulanan / Tahunan Jemaat (termasuk Sekolah Minggu & Remaja)', kategoriKode: 'IN-02' },
];
