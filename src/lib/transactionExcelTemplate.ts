/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import {
  AppSettings,
  Category,
  ChurchLingkungan,
  CompoundIncomeAllocationItem,
  CongregationFamily,
  FiscalYear,
  Kas,
  KasBalanceSummary,
  OpeningSetup,
  SentralisasiExclusionType,
  StorageAccount,
  TransactionStatus,
} from '../types/database';
import { formatNamaKeluarga, formatRupiah, getTodayYmd } from './formatters';
import { splitSentralisasiAmount } from './ppkuRules';

// -----------------------------------------------------------------------------
// CONSTANTS & LABEL MAPPINGS
// -----------------------------------------------------------------------------

export const SHEET_TRANSAKSI = 'Transaksi_Kas';
export const SHEET_TRANSFER = 'Transfer_Antar_Kas';
export const SHEET_REFERENSI = 'Referensi_Dropdown';
export const SHEET_PETUNJUK = 'Petunjuk_&_Contoh';

const MODE_OPTIONS = ['1 Pos Kas', 'Multi Pos (Gabung Grup)', 'Pelean Taon'] as const;
const JENIS_OPTIONS = ['Pemasukan', 'Pengeluaran'] as const;
const SENTRALISASI_OPTIONS = ['Sentralisasi (45/55)', 'Non-Sentralisasi (100%)'] as const;
const STATUS_SIMPAN_OPTIONS = ['Ajukan', 'Draft'] as const;

export const EXCLUSION_OPTION_MAP: Array<{
  label: string;
  value: SentralisasiExclusionType;
}> = [
  { label: 'Pembangunan Lokal', value: 'pembangunan_lokal' },
  { label: 'Diakonia Sosial / Duka', value: 'sosial_duka' },
  { label: 'Transitoris / Titipan', value: 'transitoris' },
  { label: 'Beasiswa', value: 'beasiswa' },
  { label: 'Non-Sentralisasi Lainnya', value: 'lainnya' },
];

const INDO_MONTHS: Record<string, number> = {
  januari: 1,
  jan: 1,
  februari: 2,
  feb: 2,
  pebruari: 2,
  maret: 3,
  mar: 3,
  april: 4,
  apr: 4,
  mei: 5,
  may: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  agustus: 8,
  agu: 8,
  agt: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  okt: 10,
  oct: 10,
  november: 11,
  nov: 11,
  nopember: 11,
  desember: 12,
  des: 12,
  dec: 12,
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

const isValidYmd = (y: number, m: number, d: number): boolean => {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const check = new Date(Date.UTC(y, m - 1, d));
  return (
    check.getUTCFullYear() === y &&
    check.getUTCMonth() === m - 1 &&
    check.getUTCDate() === d
  );
};

export const normalizeExcelDateCell = (raw: unknown): { value: string | null; error?: string } => {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return { value: null };
  }

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    // Excel serial date -> UTC conversion (avoids local timezone off-by-one shifts)
    const utcMs = Math.round((raw - 25569) * 86400 * 1000);
    const dt = new Date(utcMs);
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth() + 1;
    const d = dt.getUTCDate();
    if (!isValidYmd(y, m, d)) {
      return { value: null, error: 'Tanggal numerik Excel tidak valid.' };
    }
    return { value: `${y}-${pad2(m)}-${pad2(d)}` };
  }

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const m = raw.getMonth() + 1;
    const d = raw.getDate();
    if (!isValidYmd(y, m, d)) {
      return { value: null, error: 'Objek tanggal tidak valid.' };
    }
    return { value: `${y}-${pad2(m)}-${pad2(d)}` };
  }

  const str = String(raw).replace(/\s+/g, ' ').trim();

  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (!isValidYmd(y, m, d)) {
      return { value: null, error: `Tanggal "${str}" bukan tanggal kalender yang valid.` };
    }
    return { value: `${y}-${pad2(m)}-${pad2(d)}` };
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dmyMatch) {
    const d = Number(dmyMatch[1]);
    const m = Number(dmyMatch[2]);
    let y = Number(dmyMatch[3]);
    if (y < 100) y += 2000;
    if (!isValidYmd(y, m, d)) {
      return { value: null, error: `Tanggal "${str}" bukan tanggal valid (format YYYY-MM-DD atau DD/MM/YYYY).` };
    }
    return { value: `${y}-${pad2(m)}-${pad2(d)}` };
  }

  // Indonesian long/short date e.g. "19 November 2026" or "3 Mei 26"
  const indoMatch = str.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})$/);
  if (indoMatch) {
    const d = Number(indoMatch[1]);
    const monthNum = INDO_MONTHS[indoMatch[2].toLowerCase()];
    let y = Number(indoMatch[3]);
    if (y < 100) y += 2000;
    if (!monthNum || !isValidYmd(y, monthNum, d)) {
      return { value: null, error: `Format tanggal "${str}" tidak dikenali. Gunakan YYYY-MM-DD.` };
    }
    return { value: `${y}-${pad2(monthNum)}-${pad2(d)}` };
  }

  return {
    value: null,
    error: `Format tanggal "${str}" tidak seragam. Gunakan format YYYY-MM-DD (contoh: 2026-11-19).`,
  };
};

export const parseNominalCell = (raw: unknown): number => {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.round(raw) : 0;
  }
  const str = String(raw ?? '').trim();
  if (!str) return 0;
  // Handle "Rp 300.000", "300.000", "300,000", or "300000.00"
  const cleanedNoCurrency = str.replace(/rp/gi, '').replace(/\s+/g, '');
  if (/^\d+(\.\d{3})+(,\d+)?$/.test(cleanedNoCurrency)) {
    return Math.round(Number(cleanedNoCurrency.replace(/\./g, '').replace(',', '.')) || 0);
  }
  if (/^\d+(,\d{3})+(\.\d+)?$/.test(cleanedNoCurrency)) {
    return Math.round(Number(cleanedNoCurrency.replace(/,/g, '')) || 0);
  }
  const digits = cleanedNoCurrency.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
};

const formatKasOption = (k: Kas): string => `${k.nama} (${k.kode})`;
const formatStorageOption = (s: StorageAccount): string =>
  `${s.nama} (${s.tipe === 'cash' ? 'Tunai' : 'Bank'})`;
const formatCategoryOption = (c: Category): string =>
  `${c.tipe === 'income' ? '[Masuk]' : '[Keluar]'} ${c.nama}`;

const isPeleanCategory = (cat?: Category | null): boolean => {
  if (!cat) return false;
  if (cat.id === 'cat-in-namarboho') return true;
  return /pelean.*(bulanan|tahunan)/i.test(cat.nama);
};

// -----------------------------------------------------------------------------
// TEMPLATE GENERATOR (EXCELJS WITH REAL DROPDOWNS & STRICT DATE LOCKS)
// -----------------------------------------------------------------------------

export interface TransactionTemplateContext {
  kasList: Kas[];
  selectableKas: Kas[];
  storageAccounts: StorageAccount[];
  categories: Category[];
  fiscalYears: FiscalYear[];
  lingkunganList: ChurchLingkungan[];
  families: CongregationFamily[];
  settings: AppSettings;
  canTransfer: boolean;
}

export async function downloadTransactionExcelTemplate(ctx: TransactionTemplateContext): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = ctx.settings.church_name || 'HKBP Hutaraja';
  wb.created = new Date();

  const activeKasAll = ctx.kasList.filter((k) => k.is_active);
  const activeSelectableKas = ctx.selectableKas.filter((k) => k.is_active);
  const activeStorages = ctx.storageAccounts.filter((s) => s.is_active);
  const activeCategories = [
    ...ctx.categories.filter((c) => c.is_active && c.tipe === 'income').sort((a, b) => a.nama.localeCompare(b.nama, 'id')),
    ...ctx.categories.filter((c) => c.is_active && c.tipe === 'expense').sort((a, b) => a.nama.localeCompare(b.nama, 'id')),
  ];

  const yearSet = new Set<number>(ctx.fiscalYears.map((fy) => fy.year));
  yearSet.add(ctx.settings.active_year || new Date().getFullYear());
  const yearsSorted = Array.from(yearSet).sort((a, b) => b - a).map((y) => String(y));

  const lingMap = new Map<string, string>();
  ctx.lingkunganList
    .filter((l) => l.is_active !== false)
    .sort((a, b) => (a.urutan ?? 99) - (b.urutan ?? 99))
    .forEach((l) => {
      const clean = l.nama.trim();
      if (clean && !lingMap.has(clean.toLowerCase())) lingMap.set(clean.toLowerCase(), clean);
    });
  ctx.families.forEach((f) => {
    const clean = (f.lingkungan || '').trim();
    if (clean && !lingMap.has(clean.toLowerCase())) lingMap.set(clean.toLowerCase(), clean);
  });
  const lingkunganOptions = Array.from(lingMap.values());

  const familyOptions = ctx.families
    .filter((f) => f.is_active !== false)
    .map((f) => formatNamaKeluarga(f.nama_keluarga))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'id'));

  const kasInputLabels =
    activeSelectableKas.length > 0
      ? activeSelectableKas.map(formatKasOption)
      : ['(Tidak ada akses kas)'];
  const kasAllLabels =
    activeKasAll.length > 0 ? activeKasAll.map(formatKasOption) : ['(Tidak ada kas aktif)'];
  const storageLabels =
    activeStorages.length > 0 ? activeStorages.map(formatStorageOption) : ['(Belum ada tempat simpan)'];
  const categoryLabels =
    activeCategories.length > 0 ? activeCategories.map(formatCategoryOption) : ['(Belum ada kategori)'];
  const safeLingkungan =
    lingkunganOptions.length > 0 ? lingkunganOptions : ['Efesus', 'Letare', 'Exaudi', 'Judika', 'Galatia', 'Jeremia'];
  const safeFamilies =
    familyOptions.length > 0
      ? familyOptions
      : ['(Belum ada di database — ketik nama keluarga langsung, awalan Kel. otomatis)'];

  // ---------------------------------------------------------------------------
  // 1. SHEET REFERENSI DROPDOWN (Sumber list untuk seluruh menu dropdown Excel)
  // ---------------------------------------------------------------------------
  const wsRef = wb.addWorksheet(SHEET_REFERENSI);
  const refColumns: Array<{ header: string; values: string[]; width: number }> = [
    { header: 'Mode Input', values: [...MODE_OPTIONS], width: 26 },
    { header: 'Jenis Transaksi', values: [...JENIS_OPTIONS], width: 18 },
    { header: 'Kas Input (Sesuai Akses)', values: kasInputLabels, width: 34 },
    { header: 'Semua Kas Aktif', values: kasAllLabels, width: 34 },
    { header: 'Tempat Simpan', values: storageLabels, width: 34 },
    { header: 'Kategori Transaksi', values: categoryLabels, width: 38 },
    { header: 'Status Sentralisasi', values: [...SENTRALISASI_OPTIONS], width: 26 },
    { header: 'Dasar Pengecualian', values: EXCLUSION_OPTION_MAP.map((e) => e.label), width: 28 },
    { header: 'Tahun Anggaran', values: yearsSorted, width: 16 },
    { header: 'Lingkungan Jemaat', values: safeLingkungan, width: 22 },
    { header: 'Nama Keluarga Jemaat', values: safeFamilies, width: 42 },
    { header: 'Status Simpan', values: [...STATUS_SIMPAN_OPTIONS], width: 16 },
  ];

  wsRef.columns = refColumns.map((col, idx) => ({
    header: col.header,
    key: `col_${idx}`,
    width: col.width,
  }));

  const refHeaderRow = wsRef.getRow(1);
  refHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  refHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  refHeaderRow.height = 24;
  refHeaderRow.alignment = { vertical: 'middle', horizontal: 'left' };

  const maxRefLen = Math.max(...refColumns.map((c) => c.values.length), 1);
  for (let r = 0; r < maxRefLen; r++) {
    const rowValues: string[] = refColumns.map((c) => c.values[r] ?? '');
    const added = wsRef.addRow(rowValues);
    added.font = { size: 10, color: { argb: 'FF334155' } };
  }
  wsRef.views = [{ state: 'frozen', ySplit: 1 }];

  const colLetter = (idxZeroBased: number): string => {
    let n = idxZeroBased;
    let s = '';
    while (n >= 0) {
      s = String.fromCharCode((n % 26) + 65) + s;
      n = Math.floor(n / 26) - 1;
    }
    return s;
  };

  const refRange = (colIdx: number): string => {
    const letter = colLetter(colIdx);
    const endRow = Math.max(2, refColumns[colIdx].values.length + 1);
    return `${SHEET_REFERENSI}!$${letter}$2:$${letter}$${endRow}`;
  };

  // ---------------------------------------------------------------------------
  // 2. SHEET TRANSAKSI KAS (300 baris siap isi, semua fitur & dropdown lengkap)
  // ---------------------------------------------------------------------------
  const wsTx = wb.addWorksheet(SHEET_TRANSAKSI);

  wsTx.mergeCells('A1:S1');
  const txTitleCell = wsTx.getCell('A1');
  txTitleCell.value = `TEMPLATE IMPOR TRANSAKSI KEUANGAN — ${ctx.settings.church_name || 'HKBP HUTARAJA'}`;
  txTitleCell.font = { bold: true, size: 13, color: { argb: 'FF0F172A' } };
  txTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
  txTitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  wsTx.getRow(1).height = 28;

  wsTx.mergeCells('A2:S2');
  const txNoteCell = wsTx.getCell('A2');
  txNoteCell.value =
    'ATURAN PENGISIAN: Gunakan menu dropdown pada kolom bertanda [Dropdown]. Tanggal WAJIB format seragam YYYY-MM-DD (terkunci kalender). Untuk Multi Pos / Ucapan Syukur, isi Mode Input = "Multi Pos (Gabung Grup)" dan samakan "ID Grup Multi-Pos" (mis. SYUKUR-01). Untuk Pelean Taon, isi Tahun, Lingkungan, Nama Keluarga & Tanggal Warta (otomatis masuk Kas Huria & Sentralisasi 55%). Jangan hapus baris header #3.';
  txNoteCell.font = { size: 9.5, italic: true, color: { argb: 'FF1E3A8A' } };
  txNoteCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  txNoteCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
  wsTx.getRow(2).height = 34;

  const txHeaders: Array<{ title: string; width: number; group: 'core' | 'kas' | 'sentral' | 'pelean' | 'meta' }> = [
    { title: 'Mode Input [Dropdown] *', width: 25, group: 'core' }, // A
    { title: 'ID Grup Multi-Pos (Jika Multi Pos)', width: 22, group: 'core' }, // B
    { title: 'Jenis Transaksi [Dropdown] *', width: 21, group: 'core' }, // C
    { title: 'Tanggal Transaksi (YYYY-MM-DD) *', width: 24, group: 'core' }, // D
    { title: 'Tanggal Warta (YYYY-MM-DD)', width: 23, group: 'core' }, // E
    { title: 'Kas Tujuan / Sumber [Dropdown] *', width: 32, group: 'kas' }, // F
    { title: 'Tempat Simpan [Dropdown] *', width: 30, group: 'kas' }, // G
    { title: 'Kategori [Dropdown] *', width: 34, group: 'kas' }, // H
    { title: 'Nominal (Rp) *', width: 18, group: 'kas' }, // I
    { title: 'Status Sentralisasi [Dropdown]', width: 25, group: 'sentral' }, // J
    { title: 'Dasar Pengecualian (Non-Sentralisasi) [Dropdown]', width: 32, group: 'sentral' }, // K
    { title: 'No. Bukti (Opsional)', width: 18, group: 'meta' }, // L
    { title: 'Uraian Transaksi *', width: 36, group: 'meta' }, // M
    { title: 'Sub-Uraian Multi-Pos (Opsional)', width: 26, group: 'meta' }, // N
    { title: 'Tahun Anggaran Pelean Taon [Dropdown]', width: 22, group: 'pelean' }, // O
    { title: 'Lingkungan Pelean Taon [Dropdown]', width: 22, group: 'pelean' }, // P
    { title: 'Nama Keluarga Pelean Taon [Dropdown / Ketik]', width: 38, group: 'pelean' }, // Q
    { title: 'URL Bukti Nota (Opsional)', width: 28, group: 'meta' }, // R
    { title: 'Status Simpan [Dropdown] *', width: 19, group: 'meta' }, // S
  ];

  const txGroupColors: Record<string, string> = {
    core: 'FF0F172A',
    kas: 'FF1E3A8A',
    sentral: 'FF065F46',
    pelean: 'FF3730A3',
    meta: 'FF334155',
  };

  const txHeaderRow = wsTx.getRow(3);
  txHeaderRow.height = 30;
  txHeaders.forEach((h, idx) => {
    const col = wsTx.getColumn(idx + 1);
    col.width = h.width;
    const cell = txHeaderRow.getCell(idx + 1);
    cell.value = h.title;
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: txGroupColors[h.group] } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  const START_ROW = 4;
  const END_ROW_TX = 303; // 300 rows

  const minDate = new Date(Date.UTC(2020, 0, 1));
  const maxDate = new Date(Date.UTC(2099, 11, 31));

  for (let r = START_ROW; r <= END_ROW_TX; r++) {
    const row = wsTx.getRow(r);
    row.height = 20;

    // A: Mode Input
    row.getCell(1).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`=${refRange(0)}`],
      showInputMessage: true,
      promptTitle: 'Mode Input Transaksi',
      prompt: 'Pilih: 1 Pos Kas, Multi Pos (Gabung Grup), atau Pelean Taon.',
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Pilihan Tidak Valid',
      error: 'Pilih Mode Input dari daftar dropdown.',
    };

    // C: Jenis Transaksi
    row.getCell(3).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`=${refRange(1)}`],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Pilihan Tidak Valid',
      error: 'Pilih Pemasukan atau Pengeluaran dari dropdown.',
    };

    // D: Tanggal Transaksi (Date-locked YYYY-MM-DD)
    const cDateTx = row.getCell(4);
    cDateTx.numFmt = 'yyyy-mm-dd';
    cDateTx.dataValidation = {
      type: 'date',
      operator: 'between',
      allowBlank: true,
      formulae: [minDate, maxDate],
      showInputMessage: true,
      promptTitle: 'Tanggal Transaksi (YYYY-MM-DD)',
      prompt: 'Masukkan tanggal valid (contoh: 2026-11-19). Format dikunci seragam YYYY-MM-DD.',
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Tanggal Tidak Valid',
      error: 'Tanggal transaksi harus berupa tanggal valid (YYYY-MM-DD, tahun 2020-2099).',
    };

    // E: Tanggal Warta (Date-locked YYYY-MM-DD)
    const cDateWarta = row.getCell(5);
    cDateWarta.numFmt = 'yyyy-mm-dd';
    cDateWarta.dataValidation = {
      type: 'date',
      operator: 'between',
      allowBlank: true,
      formulae: [minDate, maxDate],
      showInputMessage: true,
      promptTitle: 'Tanggal Warta (YYYY-MM-DD)',
      prompt: 'Wajib untuk Pelean Taon, opsional untuk transaksi lainnya. Format seragam YYYY-MM-DD.',
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Tanggal Warta Tidak Valid',
      error: 'Tanggal Warta harus berupa tanggal valid (YYYY-MM-DD, tahun 2020-2099).',
    };

    // F: Kas Tujuan / Sumber
    row.getCell(6).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`=${refRange(2)}`],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Kas Tidak Valid',
      error: 'Pilih Kas yang tersedia pada dropdown.',
    };

    // G: Tempat Simpan
    row.getCell(7).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`=${refRange(4)}`],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Tempat Simpan Tidak Valid',
      error: 'Pilih Tempat Simpan aktif dari dropdown.',
    };

    // H: Kategori
    row.getCell(8).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`=${refRange(5)}`],
      showInputMessage: true,
      promptTitle: 'Kategori Transaksi',
      prompt: 'Pilih [Masuk] untuk Pemasukan atau [Keluar] untuk Pengeluaran.',
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Kategori Tidak Valid',
      error: 'Pilih Kategori dari daftar dropdown.',
    };

    // I: Nominal
    const cAmt = row.getCell(9);
    cAmt.numFmt = '#,##0';
    cAmt.dataValidation = {
      type: 'decimal',
      operator: 'greaterThan',
      allowBlank: true,
      formulae: [0],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Nominal Tidak Valid',
      error: 'Nominal harus angka lebih besar dari 0 (tanpa titik/huruf).',
    };

    // J: Status Sentralisasi
    row.getCell(10).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`=${refRange(6)}`],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Status Sentralisasi Tidak Valid',
      error: 'Pilih Sentralisasi (45/55) atau Non-Sentralisasi (100%).',
    };

    // K: Dasar Pengecualian
    row.getCell(11).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`=${refRange(7)}`],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Dasar Pengecualian Tidak Valid',
      error: 'Pilih Dasar Pengecualian dari dropdown.',
    };

    // O: Tahun Anggaran Pelean Taon
    row.getCell(15).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`=${refRange(8)}`],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Tahun Anggaran Tidak Valid',
      error: 'Pilih Tahun Anggaran dari dropdown.',
    };

    // P: Lingkungan Pelean Taon
    row.getCell(16).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`=${refRange(9)}`],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Lingkungan Tidak Valid',
      error: 'Pilih Lingkungan jemaat dari dropdown.',
    };

    // Q: Nama Keluarga Pelean Taon (Dropdown + izin ketik manual untuk keluarga baru)
    row.getCell(17).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`=${refRange(10)}`],
      showInputMessage: true,
      promptTitle: 'Nama Keluarga (Dropdown / Ketik Manual)',
      prompt: 'Pilih keluarga dari dropdown atau ketik langsung jika belum terdaftar (awalan "Kel. " ditambah otomatis).',
      showErrorMessage: true,
      errorStyle: 'information',
      errorTitle: 'Keluarga Baru (Input Manual)',
      error: 'Nama keluarga ini belum ada di dropdown Master Data dan akan dicatat sebagai input manual (otomatis berawalan Kel.).',
    };

    // S: Status Simpan
    row.getCell(19).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`=${refRange(11)}`],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Status Simpan Tidak Valid',
      error: 'Pilih Ajukan atau Draft dari dropdown.',
    };
  }

  wsTx.views = [{ state: 'frozen', xSplit: 3, ySplit: 3 }];

  // ---------------------------------------------------------------------------
  // 3. SHEET TRANSFER ANTAR KAS (100 baris siap isi, full dropdown & date lock)
  // ---------------------------------------------------------------------------
  const wsTf = wb.addWorksheet(SHEET_TRANSFER);

  wsTf.mergeCells('A1:I1');
  const tfTitleCell = wsTf.getCell('A1');
  tfTitleCell.value = `TEMPLATE IMPOR TRANSFER ANTAR KAS / REKENING — ${ctx.settings.church_name || 'HKBP HUTARAJA'}`;
  tfTitleCell.font = { bold: true, size: 13, color: { argb: 'FF1E1B4B' } };
  tfTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
  tfTitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  wsTf.getRow(1).height = 28;

  wsTf.mergeCells('A2:I2');
  const tfNoteCell = wsTf.getCell('A2');
  tfNoteCell.value =
    'Gunakan sheet ini untuk Transfer Dana Antar Kas / Setor Tunai ke Bank / Tarik Bank ke Tunai. Tanggal WAJIB seragam (YYYY-MM-DD). Kas Pengirim dan Kas Penerima jika sama wajib memiliki Tempat Simpan yang berbeda.';
  tfNoteCell.font = { size: 9.5, italic: true, color: { argb: 'FF312E81' } };
  tfNoteCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  tfNoteCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
  wsTf.getRow(2).height = 26;

  const tfHeaders: Array<{ title: string; width: number }> = [
    { title: 'Tanggal Transfer (YYYY-MM-DD) *', width: 25 }, // A
    { title: 'Nominal Transfer (Rp) *', width: 22 }, // B
    { title: 'Kas Pengirim [Dropdown] *', width: 34 }, // C
    { title: 'Tempat Simpan Asal [Dropdown] *', width: 32 }, // D
    { title: 'Kas Penerima [Dropdown] *', width: 34 }, // E
    { title: 'Tempat Simpan Tujuan [Dropdown] *', width: 32 }, // F
    { title: 'No. Referensi / Slip (Opsional)', width: 24 }, // G
    { title: 'Uraian / Tujuan Transfer *', width: 38 }, // H
    { title: 'URL Bukti Slip (Opsional)', width: 28 }, // I
  ];

  const tfHeaderRow = wsTf.getRow(3);
  tfHeaderRow.height = 28;
  tfHeaders.forEach((h, idx) => {
    wsTf.getColumn(idx + 1).width = h.width;
    const cell = tfHeaderRow.getCell(idx + 1);
    cell.value = h.title;
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312E81' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });

  const END_ROW_TF = 103;
  for (let r = START_ROW; r <= END_ROW_TF; r++) {
    const row = wsTf.getRow(r);
    row.height = 20;

    // A: Tanggal Transfer
    const cDate = row.getCell(1);
    cDate.numFmt = 'yyyy-mm-dd';
    cDate.dataValidation = {
      type: 'date',
      operator: 'between',
      allowBlank: true,
      formulae: [minDate, maxDate],
      showInputMessage: true,
      promptTitle: 'Tanggal Transfer (YYYY-MM-DD)',
      prompt: 'Masukkan tanggal transfer valid format YYYY-MM-DD.',
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Tanggal Tidak Valid',
      error: 'Tanggal transfer harus valid (YYYY-MM-DD).',
    };

    // B: Nominal Transfer
    const cNominal = row.getCell(2);
    cNominal.numFmt = '#,##0';
    cNominal.dataValidation = {
      type: 'decimal',
      operator: 'greaterThan',
      allowBlank: true,
      formulae: [0],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Nominal Tidak Valid',
      error: 'Nominal transfer harus lebih dari 0.',
    };

    // C: Kas Pengirim
    row.getCell(3).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`=${refRange(2)}`],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Kas Pengirim Tidak Valid',
      error: 'Pilih Kas Pengirim dari dropdown.',
    };

    // D: Tempat Simpan Asal
    row.getCell(4).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`=${refRange(4)}`],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Simpanan Asal Tidak Valid',
      error: 'Pilih Tempat Simpan Asal dari dropdown.',
    };

    // E: Kas Penerima
    row.getCell(5).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`=${refRange(3)}`],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Kas Penerima Tidak Valid',
      error: 'Pilih Kas Penerima dari dropdown.',
    };

    // F: Tempat Simpan Tujuan
    row.getCell(6).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`=${refRange(4)}`],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Simpanan Tujuan Tidak Valid',
      error: 'Pilih Tempat Simpan Tujuan dari dropdown.',
    };
  }
  wsTf.views = [{ state: 'frozen', ySplit: 3 }];

  // ---------------------------------------------------------------------------
  // 4. SHEET PETUNJUK & CONTOH PENGISIAN LENGKAP (Tidak ikut diimpor)
  // ---------------------------------------------------------------------------
  const wsGuide = wb.addWorksheet(SHEET_PETUNJUK);
  wsGuide.getColumn(1).width = 28;
  wsGuide.getColumn(2).width = 96;

  const sampleKas = kasInputLabels[0] || 'Kas Umum Huria (KAS-UMUM)';
  const sampleKasPembangunan =
    kasAllLabels.find((l) => l.toLowerCase().includes('pembangunan')) || sampleKas;
  const sampleKasDiakonia =
    kasAllLabels.find((l) => l.toLowerCase().includes('sosial') || l.toLowerCase().includes('diakoni')) || sampleKas;
  const sampleKasTransitoris =
    kasAllLabels.find((l) => l.toLowerCase().includes('transitoris')) || sampleKas;
  const sampleStorageBank =
    storageLabels.find((l) => l.toLowerCase().includes('bank')) || storageLabels[0] || 'Bank BRI';
  const sampleStorageTunai =
    storageLabels.find((l) => l.toLowerCase().includes('tunai')) || storageLabels[0] || 'Kas Tunai';
  const sampleCatIn =
    categoryLabels.find((l) => l.startsWith('[Masuk]')) || categoryLabels[0] || '[Masuk] Pelean Ibadah IA';
  const sampleCatPeleanTaon =
    categoryLabels.find((l) => /pelean.*(bulanan|tahunan)/i.test(l)) || sampleCatIn;
  const sampleCatSyukur =
    categoryLabels.find((l) => /ucapan\s*syukur/i.test(l)) || sampleCatIn;
  const sampleCatOut =
    categoryLabels.find((l) => l.startsWith('[Keluar]')) || categoryLabels[0] || '[Keluar] Operasional';
  const sampleYear = yearsSorted[0] || String(new Date().getFullYear());
  const sampleLing = safeLingkungan[0] || 'Efesus';
  const sampleFam =
    familyOptions[0] || 'Kel. St. Saruddin Naibaho, BA (+) / Maria Magdalena Siregar, BA';
  const todayStr = getTodayYmd();

  const guideLines: Array<[string, string]> = [
    ['PANDUAN IMPOR TRANSAKSI', `SIKU ${ctx.settings.church_name || 'HKBP Hutaraja'} (Sheet ini TIDAK ikut diimpor, hanya contoh pengisian)`],
    ['1. Aturan Tanggal Seragam', 'Semua kolom tanggal pada sheet Transaksi_Kas & Transfer_Antar_Kas dikunci agar format seragam YYYY-MM-DD (contoh: 2026-11-19).'],
    ['2. Penggunaan Dropdown', 'Klik sel lalu pilih panah dropdown. Jangan mengubah teks sheet Referensi_Dropdown agar daftar pilihan tetap akurat.'],
    ['3. Pemasukan / Pengeluaran 1 Pos', 'Pilih Mode Input = "1 Pos Kas". Untuk Pemasukan, tentukan Status Sentralisasi ("Sentralisasi (45/55)" atau "Non-Sentralisasi (100%)"). Jika Non-Sentralisasi, pilih Dasar Pengecualian.'],
    ['4. Multi Pos / Ucapan Syukur', 'Pilih Mode Input = "Multi Pos (Gabung Grup)". Isi ID Grup Multi-Pos yang SAMA pada beberapa baris (mis. SYUKUR-01), isi Sub-Uraian Multi-Pos per baris (mis. "Ke Kas Huria", "Ke Pendeta"). Sistem akan menggabungkannya dalam 1 bukti Ucapan Syukur.'],
    ['5. Pelean Taon Keluarga', 'Pilih Mode Input = "Pelean Taon". Isi Tahun Anggaran, Lingkungan, Nama Keluarga (bisa pilih dropdown atau ketik manual; awalan "Kel. " otomatis ditambahkan) dan Tanggal Warta. Otomatis masuk Kas Umum Huria & kena Sentralisasi 55%.'],
    ['6. Pengeluaran >= Batas Nota', `Pengeluaran >= ${formatRupiah(ctx.settings.receipt_required_threshold)} wajib memiliki URL Bukti Nota (atau foto nota dapat diunggah langsung saat pratinjau impor di aplikasi).`],
    ['7. Transfer Antar Kas / Rekening', 'Gunakan sheet Transfer_Antar_Kas untuk pindah dana antar rekening/tunai atau antar kas.'],
  ];

  guideLines.forEach((pair, i) => {
    const r = wsGuide.addRow(pair);
    r.getCell(1).font = { bold: true, size: 10, color: { argb: i === 0 ? 'FFFFFFFF' : 'FF0F172A' } };
    r.getCell(2).font = { size: 10, color: { argb: i === 0 ? 'FFFFFFFF' : 'FF334155' } };
    r.getCell(2).alignment = { wrapText: true };
    if (i === 0) {
      r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      r.height = 24;
    } else {
      r.height = 28;
    }
  });

  wsGuide.addRow([]);
  const exHeader = wsGuide.addRow([
    'CONTOH PENGISIAN SHEET Transaksi_Kas (Salin pola ini ke sheet Transaksi_Kas)',
  ]);
  exHeader.font = { bold: true, size: 10, color: { argb: 'FF1E3A8A' } };

  const exTableHeader = wsGuide.addRow(txHeaders.map((h) => h.title.replace(' [Dropdown]', '')));
  exTableHeader.font = { bold: true, size: 9.5, color: { argb: 'FFFFFFFF' } };
  exTableHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };

  const exampleRows = [
    [
      '1 Pos Kas',
      '',
      'Pemasukan',
      todayStr,
      todayStr,
      sampleKas,
      sampleStorageTunai,
      sampleCatIn,
      1500000,
      'Sentralisasi (45/55)',
      '',
      'BKM-01',
      'Pelean Ibadah Minggu IA & IB',
      '',
      '',
      '',
      '',
      '',
      'Ajukan',
    ],
    [
      '1 Pos Kas',
      '',
      'Pemasukan',
      todayStr,
      todayStr,
      sampleKasPembangunan,
      sampleStorageBank,
      sampleCatIn,
      2000000,
      'Non-Sentralisasi (100%)',
      'Pembangunan Lokal',
      'BKM-02',
      'Persembahan Khusus Pembangunan Gedung',
      '',
      '',
      '',
      '',
      '',
      'Ajukan',
    ],
    [
      'Pelean Taon',
      '',
      'Pemasukan',
      todayStr,
      todayStr,
      sampleKas,
      sampleStorageTunai,
      sampleCatPeleanTaon,
      300000,
      'Sentralisasi (45/55)',
      '',
      'PT-01',
      '',
      '',
      sampleYear,
      sampleLing,
      sampleFam,
      '',
      'Ajukan',
    ],
    [
      'Multi Pos (Gabung Grup)',
      'SYUKUR-01',
      'Pemasukan',
      todayStr,
      todayStr,
      sampleKas,
      sampleStorageTunai,
      sampleCatSyukur,
      200000,
      'Sentralisasi (45/55)',
      '',
      'BKM-03',
      'Ucapan Syukur Keluarga M. Sihombing',
      'Ke Kas Huria',
      '',
      '',
      '',
      '',
      'Ajukan',
    ],
    [
      'Multi Pos (Gabung Grup)',
      'SYUKUR-01',
      'Pemasukan',
      todayStr,
      todayStr,
      sampleKasDiakonia,
      sampleStorageTunai,
      sampleCatSyukur,
      100000,
      'Non-Sentralisasi (100%)',
      'Diakonia Sosial / Duka',
      'BKM-03',
      'Ucapan Syukur Keluarga M. Sihombing',
      'Ke Kas Diakonia Sosial',
      '',
      '',
      '',
      '',
      'Ajukan',
    ],
    [
      'Multi Pos (Gabung Grup)',
      'SYUKUR-01',
      'Pemasukan',
      todayStr,
      todayStr,
      sampleKasTransitoris,
      sampleStorageTunai,
      sampleCatSyukur,
      100000,
      'Non-Sentralisasi (100%)',
      'Transitoris / Titipan',
      'BKM-03',
      'Ucapan Syukur Keluarga M. Sihombing',
      'Ke Pendeta',
      '',
      '',
      '',
      '',
      'Ajukan',
    ],
    [
      '1 Pos Kas',
      '',
      'Pengeluaran',
      todayStr,
      '',
      sampleKas,
      sampleStorageTunai,
      sampleCatOut,
      250000,
      '',
      '',
      'BKK-01',
      'Pembelian alat tulis & kertas warta',
      '',
      '',
      '',
      '',
      '',
      'Draft',
    ],
  ];

  exampleRows.forEach((ex) => {
    const row = wsGuide.addRow(ex);
    row.font = { size: 9.5, color: { argb: 'FF334155' } };
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Template_Impor_Transaksi_HKBP_Hutaraja_${getTodayYmd()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// -----------------------------------------------------------------------------
// EXCEL PARSER & VALIDATOR (SINGLE, MULTI-POS, PELEAN TAON, DAN TRANSFER)
// -----------------------------------------------------------------------------

export interface ParsedSingleTransactionItem {
  kind: 'single';
  key: string;
  sheetName: string;
  rowNumber: number;
  mode: '1 Pos Kas' | 'Pelean Taon';
  type: 'income' | 'expense';
  tanggal: string;
  tanggal_warta: string | null;
  kas_id: string;
  kas_name: string;
  storage_account_id: string;
  storage_name: string;
  category_id: string | null;
  category_name: string;
  amount: number;
  is_sentralisasi: boolean;
  sentralisasi_exclusion_type: SentralisasiExclusionType | null;
  receipt_no?: string;
  description: string;
  attachment_url?: string | null;
  status: TransactionStatus;
  // Pelean Taon metadata
  is_pelean_taon: boolean;
  pelean_taon_year?: number | null;
  lingkungan?: string | null;
  family_id?: string | null;
  family_name?: string | null;
  is_new_family?: boolean;
  requires_receipt_upload?: boolean;
  errors: string[];
  warnings: string[];
}

export interface ParsedMultiPosGroupItem {
  kind: 'multi_pos';
  key: string;
  sheetName: string;
  rowNumbers: number[];
  groupId: string;
  tanggal: string;
  tanggal_warta: string | null;
  storage_account_id: string;
  storage_name: string;
  category_id: string | null;
  category_name: string;
  receipt_no?: string;
  description: string;
  attachment_url?: string | null;
  status: TransactionStatus;
  allocations: Array<
    CompoundIncomeAllocationItem & {
      kas_name: string;
      rowNumber: number;
    }
  >;
  total_amount: number;
  total_bpsk_55: number;
  errors: string[];
  warnings: string[];
}

export interface ParsedTransferItem {
  kind: 'transfer';
  key: string;
  sheetName: string;
  rowNumber: number;
  tanggal: string;
  amount: number;
  sourceKasId: string;
  sourceKasName: string;
  sourceStorageId: string;
  sourceStorageName: string;
  targetKasId: string;
  targetKasName: string;
  targetStorageId: string;
  targetStorageName: string;
  receiptNo?: string;
  description: string;
  attachmentUrl?: string;
  errors: string[];
  warnings: string[];
}

export type ParsedExcelImportItem =
  | ParsedSingleTransactionItem
  | ParsedMultiPosGroupItem
  | ParsedTransferItem;

export interface ParseTransactionExcelResult {
  fileName: string;
  items: ParsedExcelImportItem[];
  summary: {
    totalItems: number;
    validItems: number;
    errorItems: number;
    singleCount: number;
    multiPosGroupCount: number;
    transferCount: number;
    peleanTaonCount: number;
    newFamiliesCount: number;
    totalIncome: number;
    totalExpense: number;
    totalTransfer: number;
    totalBpsk55: number;
  };
}

export interface ParseTransactionExcelContext {
  kasList: Kas[];
  storageAccounts: StorageAccount[];
  categories: Category[];
  lingkunganList: ChurchLingkungan[];
  families: CongregationFamily[];
  settings: AppSettings;
  openingSetup: OpeningSetup | null;
  kasBalances: KasBalanceSummary[];
  canInputKas: (kasId: string) => boolean;
  canTransfer: boolean;
  isAdmin: boolean;
  isKasOpeningLocked: (kasId: string) => boolean;
  isPeriodClosed: (year: number, month: number, kasId: string) => boolean;
  isYearLockedByLpj: (year: number) => boolean;
}

const resolveKasFromText = (raw: string, kasList: Kas[]): Kas | undefined => {
  const clean = raw.trim().toLowerCase();
  if (!clean) return undefined;
  return kasList.find((k) => {
    const label = formatKasOption(k).toLowerCase();
    return (
      label === clean ||
      k.nama.toLowerCase() === clean ||
      k.kode.toLowerCase() === clean ||
      k.id.toLowerCase() === clean
    );
  });
};

const resolveStorageFromText = (raw: string, storages: StorageAccount[]): StorageAccount | undefined => {
  const clean = raw.trim().toLowerCase();
  if (!clean) return undefined;
  return storages.find((s) => {
    const label = formatStorageOption(s).toLowerCase();
    return label === clean || s.nama.toLowerCase() === clean || s.id.toLowerCase() === clean;
  });
};

const resolveCategoryFromText = (
  raw: string,
  categories: Category[],
  preferredType?: 'income' | 'expense'
): Category | undefined => {
  const clean = raw.trim().toLowerCase();
  if (!clean) return undefined;
  const stripped = clean.replace(/^\[(masuk|keluar)\]\s*/i, '').trim();

  // Prefer matching type if duplicate category names exist across income/expense
  const matches = categories.filter((c) => {
    const label = formatCategoryOption(c).toLowerCase();
    return (
      label === clean ||
      c.nama.toLowerCase() === clean ||
      c.nama.toLowerCase() === stripped ||
      (c.kode || '').toLowerCase() === clean ||
      c.id.toLowerCase() === clean
    );
  });

  if (preferredType) {
    const sameType = matches.find((c) => c.tipe === preferredType);
    if (sameType) return sameType;
  }
  return matches[0];
};

const resolveExclusionFromText = (raw: string, kasId: string): SentralisasiExclusionType => {
  const clean = raw.trim().toLowerCase();
  if (clean) {
    const found = EXCLUSION_OPTION_MAP.find(
      (e) => e.label.toLowerCase() === clean || e.value.toLowerCase() === clean
    );
    if (found) return found.value;
    if (clean.includes('bangun')) return 'pembangunan_lokal';
    if (clean.includes('sosial') || clean.includes('duka')) return 'sosial_duka';
    if (clean.includes('transitoris') || clean.includes('titipan')) return 'transitoris';
    if (clean.includes('beasiswa')) return 'beasiswa';
  }
  if (kasId === 'kas-7') return 'pembangunan_lokal';
  if (kasId === 'kas-2') return 'sosial_duka';
  if (kasId === 'kas-8') return 'transitoris';
  return 'lainnya';
};

const inferDefaultSentralisasi = (kasId: string): boolean => {
  if (kasId === 'kas-2' || kasId === 'kas-8' || kasId === 'kas-9') return false;
  return true;
};

const isPlaceholderFamilyText = (s: string): boolean =>
  s.startsWith('(belum ada di database');

const isExpenseJenis = (raw: string): boolean => {
  const l = raw.trim().toLowerCase();
  return l.includes('pengeluaran') || l.includes('keluar') || l === 'expense';
};

const isIncomeJenis = (raw: string): boolean => {
  const l = raw.trim().toLowerCase();
  return l.includes('pemasukan') || l.includes('masuk') || l === 'income';
};

export async function parseTransactionExcelFile(
  file: File,
  ctx: ParseTransactionExcelContext
): Promise<ParseTransactionExcelResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });

  const items: ParsedExcelImportItem[] = [];
  const kasHuria = ctx.kasList.find((k) => k.id === 'kas-1' || k.kode === 'KAS-UMUM');
  const sentralisasiKas = ctx.kasList.find((k) => k.id === 'kas-9' || k.kode === 'KAS-SENTRAL');
  const defaultPeleanCat =
    ctx.categories.find((c) => c.is_active && isPeleanCategory(c)) ||
    ctx.categories.find((c) => c.is_active && c.tipe === 'income');

  // Track cumulative projected balance per kas when block_negative_balance is enabled
  const runningKasBalance = new Map<string, number>(
    ctx.kasBalances.map((kb) => [kb.kas_id, kb.saldo_resmi])
  );

  const familyByKey = new Map<string, CongregationFamily>();
  ctx.families.forEach((f) => {
    const key = formatNamaKeluarga(f.nama_keluarga).toLowerCase();
    if (key && !familyByKey.has(key)) familyByKey.set(key, f);
  });

  // Helper to check date + period + opening constraints per kas
  const validateDateAndKasPeriod = (
    dateStr: string,
    kasId: string,
    kasLabel: string,
    isSentralisasiSplit: boolean,
    errors: string[]
  ) => {
    const [yrStr, moStr] = dateStr.split('-');
    const year = parseInt(yrStr, 10);
    const month = parseInt(moStr, 10);

    if (ctx.isYearLockedByLpj(year)) {
      errors.push(`Tahun Anggaran ${year} sudah terkunci permanen oleh LPJ.`);
    }
    if (ctx.openingSetup?.go_live_date && dateStr < ctx.openingSetup.go_live_date) {
      errors.push(`Tanggal (${dateStr}) sebelum tanggal mulai pemakaian (${ctx.openingSetup.go_live_date}).`);
    }
    if (kasId) {
      if (!ctx.isKasOpeningLocked(kasId)) {
        errors.push(`Pembukaan buku untuk ${kasLabel} belum dikunci.`);
      }
      if (ctx.isPeriodClosed(year, month, kasId)) {
        errors.push(`Periode ${month}/${year} untuk ${kasLabel} sudah ditutup.`);
      }
    }
    if (isSentralisasiSplit && sentralisasiKas && kasId !== sentralisasiKas.id) {
      if (!ctx.isKasOpeningLocked(sentralisasiKas.id)) {
        errors.push(`Pembukaan buku ${sentralisasiKas.nama} (porsi 55%) belum dikunci.`);
      }
      if (ctx.isPeriodClosed(year, month, sentralisasiKas.id)) {
        errors.push(`Periode ${month}/${year} untuk ${sentralisasiKas.nama} sudah ditutup.`);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // 1. PARSE SHEET TRANSAKSI_KAS (atau sheet pertama jika nama berbeda)
  // ---------------------------------------------------------------------------
  const txSheetName =
    wb.SheetNames.find((n) => n.trim().toLowerCase() === SHEET_TRANSAKSI.toLowerCase()) ||
    wb.SheetNames.find(
      (n) =>
        n.trim().toLowerCase() !== SHEET_TRANSFER.toLowerCase() &&
        n.trim().toLowerCase() !== SHEET_REFERENSI.toLowerCase() &&
        n.trim().toLowerCase() !== SHEET_PETUNJUK.toLowerCase()
    );

  if (txSheetName) {
    const ws = wb.Sheets[txSheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: true });

    // Locate header row (supports row 3 in our template, or custom within first 15 rows)
    let headerIdx = -1;
    let colMap = {
      mode: 0,
      groupId: 1,
      jenis: 2,
      tanggal: 3,
      tanggalWarta: 4,
      kas: 5,
      storage: 6,
      kategori: 7,
      nominal: 8,
      sentralisasi: 9,
      exclusion: 10,
      receiptNo: 11,
      uraian: 12,
      subUraian: 13,
      peleanYear: 14,
      lingkungan: 15,
      keluarga: 16,
      attachmentUrl: 17,
      status: 18,
    };

    for (let r = 0; r < Math.min(15, matrix.length); r++) {
      const row = matrix[r] || [];
      const textCells = row.map((c) => String(c ?? '').trim().toLowerCase());
      const hasTanggal = textCells.some((t) => t.includes('tanggal transaksi'));
      const hasNominal = textCells.some((t) => t.includes('nominal'));
      if (hasTanggal && hasNominal) {
        headerIdx = r;
        const findCol = (matcher: (t: string) => boolean, fallback: number): number => {
          const found = textCells.findIndex(matcher);
          return found !== -1 ? found : fallback;
        };
        colMap = {
          mode: findCol((t) => t.includes('mode input'), 0),
          groupId: findCol((t) => t.includes('id grup'), 1),
          jenis: findCol((t) => t.includes('jenis transaksi'), 2),
          tanggal: findCol((t) => t.includes('tanggal transaksi'), 3),
          tanggalWarta: findCol((t) => t.includes('tanggal warta'), 4),
          kas: findCol((t) => t.includes('kas tujuan') || t.includes('kas sumber'), 5),
          storage: findCol((t) => t.includes('tempat simpan'), 6),
          kategori: findCol((t) => t.startsWith('kategori'), 7),
          nominal: findCol((t) => t.includes('nominal'), 8),
          sentralisasi: findCol((t) => t.includes('status sentralisasi'), 9),
          exclusion: findCol((t) => t.includes('dasar pengecualian'), 10),
          receiptNo: findCol((t) => t.includes('no. bukti'), 11),
          uraian: findCol((t) => t.startsWith('uraian'), 12),
          subUraian: findCol((t) => t.includes('sub-uraian'), 13),
          peleanYear: findCol((t) => t.includes('tahun anggaran'), 14),
          lingkungan: findCol((t) => t.startsWith('lingkungan'), 15),
          keluarga: findCol((t) => t.includes('nama keluarga'), 16),
          attachmentUrl: findCol((t) => t.includes('url bukti'), 17),
          status: findCol((t) => t.includes('status simpan'), 18),
        };
        break;
      }
    }

    if (headerIdx !== -1) {
      interface RawMultiPosRow {
        rowNumber: number;
        groupId: string;
        jenisRaw: string;
        tanggalRes: { value: string | null; error?: string };
        wartaRes: { value: string | null; error?: string };
        kas?: Kas;
        kasRaw: string;
        storage?: StorageAccount;
        storageRaw: string;
        category?: Category;
        categoryRaw: string;
        amount: number;
        isSentralisasi: boolean;
        exclusionType: SentralisasiExclusionType | null;
        receiptNo: string;
        description: string;
        subDescription: string;
        attachmentUrl: string;
        status: TransactionStatus;
      }

      const multiPosGroups = new Map<string, RawMultiPosRow[]>();
      const multiPosOrder: string[] = [];

      for (let r = headerIdx + 1; r < matrix.length; r++) {
        const row = matrix[r] || [];
        const cellStr = (idx: number): string => String(row[idx] ?? '').trim();

        const hasAnyValue = row.some((v) => String(v ?? '').trim() !== '');
        if (!hasAnyValue) continue;

        const excelRowNum = r + 1;
        const modeRaw = cellStr(colMap.mode);
        const groupIdRaw = cellStr(colMap.groupId);
        const jenisRaw = cellStr(colMap.jenis);
        const tanggalRes = normalizeExcelDateCell(row[colMap.tanggal]);
        const wartaRes = normalizeExcelDateCell(row[colMap.tanggalWarta]);
        const kasRaw = cellStr(colMap.kas);
        const storageRaw = cellStr(colMap.storage);
        const categoryRaw = cellStr(colMap.kategori);
        const amount = parseNominalCell(row[colMap.nominal]);
        const sentralRaw = cellStr(colMap.sentralisasi);
        const exclusionRaw = cellStr(colMap.exclusion);
        const receiptNo = cellStr(colMap.receiptNo);
        const uraianRaw = cellStr(colMap.uraian);
        const subUraianRaw = cellStr(colMap.subUraian);
        const peleanYearRaw = cellStr(colMap.peleanYear);
        const lingkunganRaw = cellStr(colMap.lingkungan);
        const keluargaRaw = cellStr(colMap.keluarga);
        const attachmentUrl = cellStr(colMap.attachmentUrl);
        const statusRaw = cellStr(colMap.status);

        // Determine Mode
        const modeLower = modeRaw.toLowerCase();
        const isMultiPos = modeLower.includes('multi');
        const isPeleanTaon =
          modeLower.includes('pelean taon') ||
          (!modeRaw && (Boolean(keluargaRaw) || Boolean(lingkunganRaw) || Boolean(peleanYearRaw)));

        // Determine status
        const parsedStatus: TransactionStatus =
          statusRaw.toLowerCase() === 'draft' || statusRaw.toLowerCase() === 'draf'
            ? 'draft'
            : 'submitted';

        // Multi Pos Group handling -> buffer and validate together as 1 compound entry
        if (isMultiPos) {
          const resolvedKas = resolveKasFromText(kasRaw, ctx.kasList);
          const resolvedStorage = resolveStorageFromText(storageRaw, ctx.storageAccounts);
          const resolvedCategory = resolveCategoryFromText(categoryRaw, ctx.categories, 'income');

          let isSentral = resolvedKas ? inferDefaultSentralisasi(resolvedKas.id) : true;
          if (sentralRaw) {
            isSentral = !sentralRaw.toLowerCase().includes('non');
          }
          const exType = isSentral
            ? null
            : resolveExclusionFromText(exclusionRaw, resolvedKas?.id || '');

          const effectiveGroupKey = groupIdRaw
            ? groupIdRaw.toUpperCase()
            : `__NO_GROUP_ROW_${excelRowNum}`;

          if (!multiPosGroups.has(effectiveGroupKey)) {
            multiPosGroups.set(effectiveGroupKey, []);
            multiPosOrder.push(effectiveGroupKey);
          }

          multiPosGroups.get(effectiveGroupKey)!.push({
            rowNumber: excelRowNum,
            groupId: groupIdRaw,
            jenisRaw,
            tanggalRes,
            wartaRes,
            kas: resolvedKas,
            kasRaw,
            storage: resolvedStorage,
            storageRaw,
            category: resolvedCategory,
            categoryRaw,
            amount,
            isSentralisasi: isSentral,
            exclusionType: exType,
            receiptNo,
            description: uraianRaw,
            subDescription: subUraianRaw,
            attachmentUrl,
            status: parsedStatus,
          });
          continue;
        }

        // Single / Pelean Taon row
        const errors: string[] = [];
        const warnings: string[] = [];

        let txType: 'income' | 'expense' = 'income';
        if (isPeleanTaon) {
          if (jenisRaw && isExpenseJenis(jenisRaw)) {
            errors.push('Pelean Taon harus berjenis Pemasukan.');
          }
          txType = 'income';
        } else {
          if (!jenisRaw) {
            errors.push('Jenis Transaksi (Pemasukan / Pengeluaran) wajib dipilih.');
          } else if (isExpenseJenis(jenisRaw)) {
            txType = 'expense';
          } else if (isIncomeJenis(jenisRaw)) {
            txType = 'income';
          } else {
            errors.push(`Jenis Transaksi "${jenisRaw}" tidak valid.`);
          }
        }

        if (!tanggalRes.value) {
          errors.push(tanggalRes.error || 'Tanggal Transaksi wajib diisi (format YYYY-MM-DD).');
        }
        if (wartaRes.error) {
          errors.push(`Tanggal Warta: ${wartaRes.error}`);
        }

        let resolvedKas = isPeleanTaon
          ? kasHuria || resolveKasFromText(kasRaw, ctx.kasList)
          : resolveKasFromText(kasRaw, ctx.kasList);

        if (!resolvedKas) {
          errors.push(
            kasRaw
              ? `Kas "${kasRaw}" tidak ditemukan atau tidak aktif.`
              : 'Kas Tujuan / Sumber wajib dipilih.'
          );
        } else {
          if (!resolvedKas.is_active) {
            errors.push(`Kas "${resolvedKas.nama}" berstatus non-aktif.`);
          }
          if (!ctx.canInputKas(resolvedKas.id)) {
            errors.push(`Anda tidak memiliki hak input pada ${resolvedKas.nama}.`);
          }
        }

        const resolvedStorage = resolveStorageFromText(storageRaw, ctx.storageAccounts);
        if (!resolvedStorage) {
          errors.push(
            storageRaw
              ? `Tempat Simpan "${storageRaw}" tidak ditemukan.`
              : 'Tempat Simpan wajib dipilih.'
          );
        } else if (!resolvedStorage.is_active) {
          errors.push(`Tempat Simpan "${resolvedStorage.nama}" berstatus non-aktif.`);
        }

        let resolvedCategory = resolveCategoryFromText(categoryRaw, ctx.categories, txType);
        if (isPeleanTaon && !categoryRaw && defaultPeleanCat) {
          resolvedCategory = defaultPeleanCat;
        }
        if (!resolvedCategory) {
          errors.push(
            categoryRaw
              ? `Kategori "${categoryRaw}" tidak ditemukan.`
              : 'Kategori wajib dipilih.'
          );
        } else if (!resolvedCategory.is_active) {
          errors.push(`Kategori "${resolvedCategory.nama}" tidak aktif.`);
        } else if (resolvedCategory.tipe !== txType) {
          errors.push(
            `Kategori "${resolvedCategory.nama}" berjenis ${
              resolvedCategory.tipe === 'income' ? 'Pemasukan' : 'Pengeluaran'
            }, tidak cocok dengan Jenis "${txType === 'income' ? 'Pemasukan' : 'Pengeluaran'}".`
          );
        }

        if (!amount || amount <= 0) {
          errors.push('Nominal (Rp) harus lebih besar dari 0.');
        }

        // Sentralisasi
        let isSentral = false;
        let exclusionType: SentralisasiExclusionType | null = null;
        if (txType === 'income') {
          if (isPeleanTaon) {
            isSentral = true;
          } else {
            isSentral = sentralRaw
              ? !sentralRaw.toLowerCase().includes('non')
              : resolvedKas
              ? inferDefaultSentralisasi(resolvedKas.id)
              : true;
            if (!isSentral) {
              exclusionType = resolveExclusionFromText(exclusionRaw, resolvedKas?.id || '');
            }
          }
        }

        // Pelean Taon metadata
        let resolvedPeleanYear: number | null = null;
        let resolvedLingkungan: string | null = null;
        let resolvedFamilyId: string | null = null;
        let resolvedFamilyName: string | null = null;
        let isNewFamily = false;

        if (isPeleanTaon) {
          const parsedYr = Number(peleanYearRaw) || ctx.settings.active_year || new Date().getFullYear();
          if (parsedYr < 2000 || parsedYr > 2100) {
            errors.push('Tahun Anggaran Pelean Taon tidak valid.');
          }
          resolvedPeleanYear = parsedYr;

          if (!wartaRes.value) {
            errors.push('Tanggal Warta wajib diisi untuk transaksi Pelean Taon.');
          }

          if (!keluargaRaw || isPlaceholderFamilyText(keluargaRaw.toLowerCase())) {
            errors.push('Nama Keluarga wajib diisi untuk Pelean Taon.');
          } else {
            const formattedFam = formatNamaKeluarga(keluargaRaw);
            resolvedFamilyName = formattedFam;
            const matchedFam = familyByKey.get(formattedFam.toLowerCase());
            if (matchedFam) {
              resolvedFamilyId = matchedFam.id;
              resolvedLingkungan = lingkunganRaw || matchedFam.lingkungan;
            } else {
              isNewFamily = true;
              resolvedLingkungan = lingkunganRaw;
              warnings.push(`Keluarga baru "${formattedFam}" belum ada di Master Data.`);
            }
          }

          if (!resolvedLingkungan) {
            errors.push('Lingkungan Pelean Taon wajib dipilih.');
          } else {
            const matchedLing = ctx.lingkunganList.find(
              (l) => l.nama.toLowerCase() === resolvedLingkungan!.toLowerCase()
            );
            if (matchedLing) resolvedLingkungan = matchedLing.nama;
          }
        }

        let finalDescription = uraianRaw;
        if (!finalDescription) {
          if (isPeleanTaon && resolvedFamilyName && resolvedPeleanYear) {
            finalDescription = `Pelean Taon ${resolvedPeleanYear} - ${resolvedFamilyName}${
              resolvedLingkungan ? ` (Lingkungan ${resolvedLingkungan})` : ''
            }`;
          } else {
            errors.push('Uraian Transaksi wajib diisi.');
          }
        }

        // Period, LPJ lock, Go-Live & Opening Balance Lock
        if (tanggalRes.value && resolvedKas) {
          validateDateAndKasPeriod(
            tanggalRes.value,
            resolvedKas.id,
            resolvedKas.nama,
            txType === 'income' && isSentral,
            errors
          );
        }

        // Expense constraints: receipt threshold & negative balance
        const requiresReceipt =
          txType === 'expense' &&
          amount >= ctx.settings.receipt_required_threshold &&
          !attachmentUrl;

        if (requiresReceipt) {
          warnings.push(
            `Pengeluaran >= ${formatRupiah(
              ctx.settings.receipt_required_threshold
            )} wajib melampirkan bukti nota (isi URL di Excel atau unggah foto pada baris ini sebelum Impor).`
          );
        }

        if (
          txType === 'income' &&
          resolvedKas &&
          amount > 0 &&
          errors.length === 0
        ) {
          if (isSentral && sentralisasiKas && resolvedKas.id !== sentralisasiKas.id) {
            const { bpskAmount, huriaAmount } = splitSentralisasiAmount(amount, true);
            runningKasBalance.set(
              resolvedKas.id,
              (runningKasBalance.get(resolvedKas.id) ?? 0) + huriaAmount
            );
            runningKasBalance.set(
              sentralisasiKas.id,
              (runningKasBalance.get(sentralisasiKas.id) ?? 0) + bpskAmount
            );
          } else {
            runningKasBalance.set(
              resolvedKas.id,
              (runningKasBalance.get(resolvedKas.id) ?? 0) + amount
            );
          }
        }

        if (
          txType === 'expense' &&
          resolvedKas &&
          amount > 0 &&
          ctx.settings.block_negative_balance
        ) {
          const currBal = runningKasBalance.get(resolvedKas.id) ?? 0;
          if (amount > currBal) {
            errors.push(
              `Saldo ${resolvedKas.nama} tidak mencukupi (Tersedia: ${formatRupiah(currBal)}).`
            );
          } else if (errors.length === 0) {
            runningKasBalance.set(resolvedKas.id, currBal - amount);
          }
        }

        items.push({
          kind: 'single',
          key: `single-${excelRowNum}`,
          sheetName: txSheetName,
          rowNumber: excelRowNum,
          mode: isPeleanTaon ? 'Pelean Taon' : '1 Pos Kas',
          type: txType,
          tanggal: tanggalRes.value || '',
          tanggal_warta: wartaRes.value,
          kas_id: resolvedKas?.id || '',
          kas_name: resolvedKas?.nama || kasRaw || '-',
          storage_account_id: resolvedStorage?.id || '',
          storage_name: resolvedStorage?.nama || storageRaw || '-',
          category_id: resolvedCategory?.id || null,
          category_name: resolvedCategory?.nama || categoryRaw || '-',
          amount,
          is_sentralisasi: isSentral,
          sentralisasi_exclusion_type: exclusionType,
          receipt_no: receiptNo || undefined,
          description: finalDescription,
          attachment_url: attachmentUrl || null,
          status: parsedStatus,
          is_pelean_taon: isPeleanTaon,
          pelean_taon_year: resolvedPeleanYear,
          lingkungan: resolvedLingkungan,
          family_id: resolvedFamilyId,
          family_name: resolvedFamilyName,
          is_new_family: isNewFamily,
          requires_receipt_upload: requiresReceipt,
          errors,
          warnings,
        });
      }

      // Finalize buffered Multi-Pos groups
      multiPosOrder.forEach((grpKey) => {
        const rows = multiPosGroups.get(grpKey)!;
        const first = rows[0];
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!first.groupId) {
          errors.push('Baris Multi Pos wajib memiliki "ID Grup Multi-Pos" (mis. SYUKUR-01).');
        }

        const primaryTanggal = first.tanggalRes.value || '';
        if (!primaryTanggal) {
          errors.push(first.tanggalRes.error || 'Tanggal Transaksi pada grup Multi Pos wajib diisi (YYYY-MM-DD).');
        }
        if (first.wartaRes.error) {
          errors.push(`Tanggal Warta: ${first.wartaRes.error}`);
        }

        if (!first.storage) {
          errors.push(
            first.storageRaw
              ? `Tempat Simpan "${first.storageRaw}" tidak ditemukan.`
              : 'Tempat Simpan pada grup Multi Pos wajib dipilih.'
          );
        }

        if (!first.category) {
          errors.push(
            first.categoryRaw
              ? `Kategori "${first.categoryRaw}" tidak ditemukan.`
              : 'Kategori pada grup Multi Pos wajib dipilih.'
          );
        } else if (first.category.tipe !== 'income') {
          errors.push(`Multi Pos hanya untuk Pemasukan; kategori "${first.category.nama}" bertipe Pengeluaran.`);
        }

        const mainDescription =
          rows.find((rw) => rw.description)?.description || '';
        if (!mainDescription) {
          errors.push('Uraian Transaksi utama grup Multi Pos wajib diisi.');
        }

        let totalAmount = 0;
        let totalBpsk55 = 0;

        const allocations: Array<CompoundIncomeAllocationItem & { kas_name: string; rowNumber: number }> = [];

        rows.forEach((rw) => {
          if (rw.jenisRaw && isExpenseJenis(rw.jenisRaw)) {
            errors.push(`Baris ${rw.rowNumber}: Multi Pos hanya mendukung jenis Pemasukan.`);
          }
          if (rw.tanggalRes.value && primaryTanggal && rw.tanggalRes.value !== primaryTanggal) {
            warnings.push(
              `Baris ${rw.rowNumber}: Tanggal (${rw.tanggalRes.value}) berbeda dengan baris pertama grup (${primaryTanggal}); sistem memakai ${primaryTanggal}.`
            );
          }
          if (!rw.kas) {
            errors.push(
              `Baris ${rw.rowNumber}: ${
                rw.kasRaw ? `Kas "${rw.kasRaw}" tidak ditemukan.` : 'Kas Tujuan wajib dipilih.'
              }`
            );
          } else {
            if (!rw.kas.is_active) {
              errors.push(`Baris ${rw.rowNumber}: Kas "${rw.kas.nama}" tidak aktif.`);
            }
            if (!ctx.canInputKas(rw.kas.id)) {
              errors.push(`Baris ${rw.rowNumber}: Anda tidak memiliki hak input pada ${rw.kas.nama}.`);
            }
            if (primaryTanggal) {
              validateDateAndKasPeriod(
                primaryTanggal,
                rw.kas.id,
                rw.kas.nama,
                rw.isSentralisasi,
                errors
              );
            }
          }

          if (!rw.amount || rw.amount <= 0) {
            errors.push(`Baris ${rw.rowNumber}: Nominal harus lebih dari Rp 0.`);
          }

          totalAmount += rw.amount;
          if (rw.isSentralisasi && sentralisasiKas && rw.kas?.id !== sentralisasiKas.id) {
            totalBpsk55 += splitSentralisasiAmount(rw.amount, true).bpskAmount;
          } else if (rw.isSentralisasi) {
            totalBpsk55 += splitSentralisasiAmount(rw.amount, true).bpskAmount;
          }

          allocations.push({
            rowNumber: rw.rowNumber,
            kas_id: rw.kas?.id || '',
            kas_name: rw.kas?.nama || rw.kasRaw || '-',
            amount: rw.amount,
            is_sentralisasi: rw.isSentralisasi,
            sub_description: rw.subDescription || undefined,
            exclusion_type: rw.isSentralisasi ? null : rw.exclusionType,
          });
        });

        // Deduplicate identical errors within the same group
        const uniqueErrors = Array.from(new Set(errors));

        if (uniqueErrors.length === 0) {
          allocations.forEach((a) => {
            if (!a.kas_id || a.amount <= 0) return;
            if (a.is_sentralisasi && sentralisasiKas && a.kas_id !== sentralisasiKas.id) {
              const { bpskAmount, huriaAmount } = splitSentralisasiAmount(a.amount, true);
              runningKasBalance.set(a.kas_id, (runningKasBalance.get(a.kas_id) ?? 0) + huriaAmount);
              runningKasBalance.set(
                sentralisasiKas.id,
                (runningKasBalance.get(sentralisasiKas.id) ?? 0) + bpskAmount
              );
            } else {
              runningKasBalance.set(a.kas_id, (runningKasBalance.get(a.kas_id) ?? 0) + a.amount);
            }
          });
        }

        items.push({
          kind: 'multi_pos',
          key: `multi-${grpKey}-${first.rowNumber}`,
          sheetName: txSheetName,
          rowNumbers: rows.map((rw) => rw.rowNumber),
          groupId: first.groupId || `(Baris ${first.rowNumber})`,
          tanggal: primaryTanggal,
          tanggal_warta: first.wartaRes.value,
          storage_account_id: first.storage?.id || '',
          storage_name: first.storage?.nama || first.storageRaw || '-',
          category_id: first.category?.id || null,
          category_name: first.category?.nama || first.categoryRaw || '-',
          receipt_no: rows.find((rw) => rw.receiptNo)?.receiptNo,
          description: mainDescription,
          attachment_url: rows.find((rw) => rw.attachmentUrl)?.attachmentUrl || null,
          status: first.status,
          allocations,
          total_amount: totalAmount,
          total_bpsk_55: totalBpsk55,
          errors: uniqueErrors,
          warnings: Array.from(new Set(warnings)),
        });
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 2. PARSE SHEET TRANSFER_ANTAR_KAS
  // ---------------------------------------------------------------------------
  const tfSheetName = wb.SheetNames.find(
    (n) => n.trim().toLowerCase() === SHEET_TRANSFER.toLowerCase()
  );

  if (tfSheetName) {
    const wsTf = wb.Sheets[tfSheetName];
    const tfMatrix = XLSX.utils.sheet_to_json<unknown[]>(wsTf, { header: 1, defval: '', raw: true });

    let tfHeaderIdx = -1;
    let tfColMap = {
      tanggal: 0,
      nominal: 1,
      sourceKas: 2,
      sourceStorage: 3,
      targetKas: 4,
      targetStorage: 5,
      receiptNo: 6,
      uraian: 7,
      attachmentUrl: 8,
    };

    for (let r = 0; r < Math.min(15, tfMatrix.length); r++) {
      const row = tfMatrix[r] || [];
      const textCells = row.map((c) => String(c ?? '').trim().toLowerCase());
      const hasTanggal = textCells.some((t) => t.includes('tanggal transfer'));
      const hasPengirim = textCells.some((t) => t.includes('kas pengirim'));
      if (hasTanggal && hasPengirim) {
        tfHeaderIdx = r;
        const findCol = (matcher: (t: string) => boolean, fallback: number): number => {
          const found = textCells.findIndex(matcher);
          return found !== -1 ? found : fallback;
        };
        tfColMap = {
          tanggal: findCol((t) => t.includes('tanggal transfer'), 0),
          nominal: findCol((t) => t.includes('nominal'), 1),
          sourceKas: findCol((t) => t.includes('kas pengirim'), 2),
          sourceStorage: findCol((t) => t.includes('simpan asal') || t.includes('penyimpanan asal'), 3),
          targetKas: findCol((t) => t.includes('kas penerima'), 4),
          targetStorage: findCol((t) => t.includes('simpan tujuan') || t.includes('penyimpanan tujuan'), 5),
          receiptNo: findCol((t) => t.includes('referensi') || t.includes('slip'), 6),
          uraian: findCol((t) => t.includes('uraian') || t.includes('tujuan transfer'), 7),
          attachmentUrl: findCol((t) => t.includes('url bukti'), 8),
        };
        break;
      }
    }

    if (tfHeaderIdx !== -1) {
      for (let r = tfHeaderIdx + 1; r < tfMatrix.length; r++) {
        const row = tfMatrix[r] || [];
        const hasAnyValue = row.some((v) => String(v ?? '').trim() !== '');
        if (!hasAnyValue) continue;

        const excelRowNum = r + 1;
        const cellStr = (idx: number) => String(row[idx] ?? '').trim();

        const tanggalRes = normalizeExcelDateCell(row[tfColMap.tanggal]);
        const amount = parseNominalCell(row[tfColMap.nominal]);
        const srcKasRaw = cellStr(tfColMap.sourceKas);
        const srcStoRaw = cellStr(tfColMap.sourceStorage);
        const dstKasRaw = cellStr(tfColMap.targetKas);
        const dstStoRaw = cellStr(tfColMap.targetStorage);
        const receiptNo = cellStr(tfColMap.receiptNo);
        const uraian = cellStr(tfColMap.uraian);
        const attachmentUrl = cellStr(tfColMap.attachmentUrl);

        const errors: string[] = [];
        const warnings: string[] = [];

        if (!ctx.isAdmin && !ctx.canTransfer) {
          errors.push('Anda tidak memiliki izin Transfer Dana Antar Kas.');
        }

        if (!tanggalRes.value) {
          errors.push(tanggalRes.error || 'Tanggal Transfer wajib diisi (YYYY-MM-DD).');
        }
        if (!amount || amount <= 0) {
          errors.push('Nominal Transfer harus lebih besar dari Rp 0.');
        }

        const srcKas = resolveKasFromText(srcKasRaw, ctx.kasList);
        if (!srcKas) {
          errors.push(srcKasRaw ? `Kas Pengirim "${srcKasRaw}" tidak ditemukan.` : 'Kas Pengirim wajib dipilih.');
        } else {
          if (!ctx.canInputKas(srcKas.id)) {
            errors.push(`Anda tidak memiliki hak input pada Kas Pengirim "${srcKas.nama}".`);
          }
          if (!ctx.isKasOpeningLocked(srcKas.id)) {
            errors.push(`Pembukaan buku Kas Pengirim "${srcKas.nama}" belum dikunci.`);
          }
        }

        const dstKas = resolveKasFromText(dstKasRaw, ctx.kasList);
        if (!dstKas) {
          errors.push(dstKasRaw ? `Kas Penerima "${dstKasRaw}" tidak ditemukan.` : 'Kas Penerima wajib dipilih.');
        } else if (!ctx.isKasOpeningLocked(dstKas.id)) {
          errors.push(`Pembukaan buku Kas Penerima "${dstKas.nama}" belum dikunci.`);
        }

        const srcSto = resolveStorageFromText(srcStoRaw, ctx.storageAccounts);
        if (!srcSto) {
          errors.push(
            srcStoRaw ? `Tempat Simpan Asal "${srcStoRaw}" tidak ditemukan.` : 'Tempat Simpan Asal wajib dipilih.'
          );
        }

        const dstSto = resolveStorageFromText(dstStoRaw, ctx.storageAccounts);
        if (!dstSto) {
          errors.push(
            dstStoRaw
              ? `Tempat Simpan Tujuan "${dstStoRaw}" tidak ditemukan.`
              : 'Tempat Simpan Tujuan wajib dipilih.'
          );
        }

        if (srcKas && dstKas && srcSto && dstSto && srcKas.id === dstKas.id && srcSto.id === dstSto.id) {
          errors.push('Tempat penyimpanan asal & tujuan tidak boleh sama jika kasnya sama.');
        }

        if (!uraian) {
          errors.push('Uraian / Tujuan Transfer wajib diisi.');
        }

        if (tanggalRes.value) {
          const [yrStr, moStr] = tanggalRes.value.split('-');
          const year = parseInt(yrStr, 10);
          const month = parseInt(moStr, 10);
          if (ctx.isYearLockedByLpj(year)) {
            errors.push(`Tahun Anggaran ${year} sudah terkunci permanen oleh LPJ.`);
          }
          if (ctx.openingSetup?.go_live_date && tanggalRes.value < ctx.openingSetup.go_live_date) {
            errors.push(`Tanggal transfer (${tanggalRes.value}) sebelum tanggal mulai pemakaian.`);
          }
          if (srcKas && ctx.isPeriodClosed(year, month, srcKas.id)) {
            errors.push(`Periode ${month}/${year} untuk ${srcKas.nama} sudah ditutup.`);
          }
          if (dstKas && ctx.isPeriodClosed(year, month, dstKas.id)) {
            errors.push(`Periode ${month}/${year} untuk ${dstKas.nama} sudah ditutup.`);
          }
        }

        if (srcKas && dstKas && amount > 0 && ctx.settings.block_negative_balance && srcKas.id !== dstKas.id) {
          const currSrcBal = runningKasBalance.get(srcKas.id) ?? 0;
          if (amount > currSrcBal) {
            errors.push(
              `Saldo ${srcKas.nama} tidak mencukupi untuk transfer (Tersedia: ${formatRupiah(currSrcBal)}).`
            );
          } else if (errors.length === 0) {
            runningKasBalance.set(srcKas.id, currSrcBal - amount);
            runningKasBalance.set(dstKas.id, (runningKasBalance.get(dstKas.id) ?? 0) + amount);
          }
        }

        items.push({
          kind: 'transfer',
          key: `tf-${excelRowNum}`,
          sheetName: tfSheetName,
          rowNumber: excelRowNum,
          tanggal: tanggalRes.value || '',
          amount,
          sourceKasId: srcKas?.id || '',
          sourceKasName: srcKas?.nama || srcKasRaw || '-',
          sourceStorageId: srcSto?.id || '',
          sourceStorageName: srcSto?.nama || srcStoRaw || '-',
          targetKasId: dstKas?.id || '',
          targetKasName: dstKas?.nama || dstKasRaw || '-',
          targetStorageId: dstSto?.id || '',
          targetStorageName: dstSto?.nama || dstStoRaw || '-',
          receiptNo: receiptNo || undefined,
          description: uraian,
          attachmentUrl: attachmentUrl || undefined,
          errors,
          warnings,
        });
      }
    }
  }

  // Compute summary metrics
  let validItems = 0;
  let errorItems = 0;
  let singleCount = 0;
  let multiPosGroupCount = 0;
  let transferCount = 0;
  let peleanTaonCount = 0;
  const uniqueNewFamilies = new Set<string>();
  let totalIncome = 0;
  let totalExpense = 0;
  let totalTransfer = 0;
  let totalBpsk55 = 0;

  items.forEach((item) => {
    const hasMandatoryReceiptMissing =
      item.kind === 'single' && item.requires_receipt_upload && !item.attachment_url;
    const isErr = item.errors.length > 0 || hasMandatoryReceiptMissing;
    if (isErr) {
      errorItems += 1;
    } else {
      validItems += 1;
    }

    if (item.kind === 'single') {
      singleCount += 1;
      if (item.is_pelean_taon) peleanTaonCount += 1;
      if (item.is_new_family && item.family_name) {
        uniqueNewFamilies.add(item.family_name.toLowerCase());
      }
      if (item.type === 'income') {
        totalIncome += item.amount;
        if (item.is_sentralisasi) {
          totalBpsk55 += splitSentralisasiAmount(item.amount, true).bpskAmount;
        }
      } else {
        totalExpense += item.amount;
      }
    } else if (item.kind === 'multi_pos') {
      multiPosGroupCount += 1;
      totalIncome += item.total_amount;
      totalBpsk55 += item.total_bpsk_55;
    } else if (item.kind === 'transfer') {
      transferCount += 1;
      totalTransfer += item.amount;
    }
  });

  return {
    fileName: file.name,
    items,
    summary: {
      totalItems: items.length,
      validItems,
      errorItems,
      singleCount,
      multiPosGroupCount,
      transferCount,
      peleanTaonCount,
      newFamiliesCount: uniqueNewFamilies.size,
      totalIncome,
      totalExpense,
      totalTransfer,
      totalBpsk55,
    },
  };
}
