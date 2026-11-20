/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';

export const MONTH_NAMES_INDO = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function formatRupiah(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount || 0);
  if (isNaN(num)) return 'Rp 0';

  const isNegative = num < 0;
  const absValue = Math.abs(num);

  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(absValue)
    .replace(/\u00a0/g, ' ');

  return isNegative ? `-${formatted}` : formatted;
}

export function formatDateIndo(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
    return format(d, 'd MMMM yyyy', { locale: id });
  } catch {
    return String(dateInput);
  }
}

export function formatDateShort(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
    return format(d, 'dd/MM/yyyy', { locale: id });
  } catch {
    return String(dateInput);
  }
}

export function formatDateTimeIndo(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
    return format(d, 'd MMMM yyyy HH:mm', { locale: id });
  } catch {
    return String(dateInput);
  }
}

export function getIndoMonthName(monthIndex1to12: number): string {
  return MONTH_NAMES_INDO[Math.max(0, Math.min(11, monthIndex1to12 - 1))] || '';
}

export function formatNamaKeluarga(raw: string | null | undefined): string {
  const cleaned = (raw || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const withoutPrefix = cleaned.replace(/^(?:keluarga|kel)(?:\s*[.,:]\s*|\s+)/i, '').trim();
  if (!withoutPrefix) return '';
  return `Kel. ${withoutPrefix}`;
}

export function parseYmdParts(
  dateStr: string | null | undefined
): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const match = String(dateStr).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (!Number.isFinite(year) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return { year, month, day };
}

export function getYmdYear(dateStr: string | null | undefined): number {
  const parts = parseYmdParts(dateStr);
  if (parts) return parts.year;
  if (!dateStr) return 0;
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getFullYear();
}

export function getYmdMonth(dateStr: string | null | undefined): number {
  const parts = parseYmdParts(dateStr);
  if (parts) return parts.month;
  if (!dateStr) return 0;
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getMonth() + 1;
}

export function getTodayYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function sortStorageAccountsPreferred<
  T extends { id?: string; nama?: string; tipe?: string }
>(accounts: T[]): T[] {
  const getPriority = (acc: T): number => {
    const nama = (acc.nama || '').toLowerCase();
    const isTunaiHuria =
      acc.id === 'stor-1' ||
      ((acc.tipe === 'cash' || nama.includes('tunai') || nama.includes('brankas')) &&
        nama.includes('huria'));
    if (isTunaiHuria) return 0;
    if (acc.tipe === 'cash' || nama.includes('tunai') || nama.includes('brankas')) return 1;
    return 2;
  };

  return [...accounts].sort((a, b) => {
    const diff = getPriority(a) - getPriority(b);
    if (diff !== 0) return diff;
    return (a.nama || '').localeCompare(b.nama || '', 'id');
  });
}
