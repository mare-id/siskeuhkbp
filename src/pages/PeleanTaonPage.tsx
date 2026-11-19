/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Search,
  Plus,
  FileSpreadsheet,
  Printer,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  Landmark,
  Filter,
  HeartHandshake,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { formatDateIndo, formatRupiah, formatNamaKeluarga } from '../lib/formatters';
import { PeleanTaonPrefill, TransactionModal } from '../components/transactions/TransactionModal';

interface PaymentGroup {
  groupId: string;
  familyId: string | null;
  familyName: string;
  lingkungan: string;
  tanggal: string;
  tanggalWarta: string | null;
  grossAmount: number;
  huriaAmount: number;
  bpskAmount: number;
  status: 'approved' | 'pending';
}

interface FamilyRekapRow {
  key: string;
  familyId?: string;
  namaKeluarga: string;
  lingkungan: string;
  kepalaKeluarga?: string | null;
  isManualOnly: boolean;
  approvedAmount: number;
  approvedHuria: number;
  approvedBpsk: number;
  pendingAmount: number;
  latestTanggal: string | null;
  latestTanggalWarta: string | null;
  paymentStatus: 'paid' | 'pending' | 'unpaid';
  paymentCount: number;
}

const normalizeNameKey = (val: string) =>
  formatNamaKeluarga(val).toLowerCase().replace(/\s+/g, ' ');

export const PeleanTaonPage: React.FC = () => {
  const {
    families,
    lingkunganList,
    transactions,
    fiscalYears,
    settings,
  } = useData();
  const { isAdmin, canRecordTransactions, canInputKas } = useAuth();

  const canRecordPeleanTaon = isAdmin || (canRecordTransactions && canInputKas('kas-1'));

  const availableYears = useMemo(() => {
    const yrs = new Set<number>(fiscalYears.map((f) => f.year));
    yrs.add(settings.active_year);
    transactions.forEach((tx) => {
      if (tx.pelean_taon_year) yrs.add(Number(tx.pelean_taon_year));
    });
    return Array.from(yrs).sort((a, b) => b - a);
  }, [fiscalYears, settings.active_year, transactions]);

  const [selectedYear, setSelectedYear] = useState<number>(settings.active_year);
  const [selectedLingkungan, setSelectedLingkungan] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'paid' | 'unpaid' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txPrefill, setTxPrefill] = useState<PeleanTaonPrefill | null>(null);

  // Exclude reversed & rejected transactions
  const paymentGroups = useMemo<PaymentGroup[]>(() => {
    const reversedIds = new Set(
      transactions.filter((t) => t.is_reversal && t.reverses_id).map((t) => t.reverses_id!)
    );

    const matchingTxs = transactions.filter((tx) => {
      if (tx.type !== 'income' || tx.is_reversal || tx.status === 'rejected') return false;
      if (reversedIds.has(tx.id)) return false;

      const isPeleanTaon =
        Boolean(tx.pelean_taon_year) ||
        tx.category_id === 'cat-in-namarboho' ||
        /pelean\s*taon/i.test(tx.description);
      if (!isPeleanTaon) return false;

      const txYear = tx.pelean_taon_year || new Date(tx.tanggal).getFullYear();
      return txYear === selectedYear;
    });

    const groupedMap = new Map<string, typeof matchingTxs>();
    matchingTxs.forEach((tx) => {
      const gKey = tx.allocation_group_id || tx.id;
      const list = groupedMap.get(gKey) || [];
      list.push(tx);
      groupedMap.set(gKey, list);
    });

    const groups: PaymentGroup[] = [];
    groupedMap.forEach((rows, groupId) => {
      const primary =
        rows.find((r) => r.sentralisasi_role === 'huria_share') ||
        rows.find((r) => r.family_name || r.family_id) ||
        rows[0];

      const grossAmount = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);

      let huriaAmount = 0;
      let bpskAmount = 0;
      const hasSplitTag = rows.some(
        (r) => r.sentralisasi_role === 'huria_share' || r.sentralisasi_role === 'bpsk_share'
      );

      if (rows.length > 1 || hasSplitTag) {
        huriaAmount = rows
          .filter((r) => r.sentralisasi_role === 'huria_share')
          .reduce((s, r) => s + Number(r.amount || 0), 0);
        bpskAmount = rows
          .filter((r) => r.sentralisasi_role === 'bpsk_share')
          .reduce((s, r) => s + Number(r.amount || 0), 0);
        if (huriaAmount + bpskAmount === 0) {
          bpskAmount = primary.is_sentralisasi !== false ? Math.round(grossAmount * 0.55) : 0;
          huriaAmount = grossAmount - bpskAmount;
        }
      } else {
        if (primary.is_sentralisasi === false) {
          huriaAmount = grossAmount;
          bpskAmount = 0;
        } else {
          bpskAmount = primary.bpsk_amount ?? Math.round(grossAmount * 0.55);
          huriaAmount = primary.huria_amount ?? grossAmount - bpskAmount;
        }
      }

      const wartaRow = rows.find((r) => Boolean(r.tanggal_warta));
      const allApproved = rows.every((r) => r.status === 'approved');

      // Fallback parse family name if recorded without structured family_name column
      let inferredName = primary.family_name || '';
      if (!inferredName && primary.description) {
        const dashSplit = primary.description.split('—');
        if (dashSplit.length >= 2) {
          inferredName = dashSplit[1].replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
        }
      }

      groups.push({
        groupId,
        familyId: primary.family_id || null,
        familyName: inferredName ? formatNamaKeluarga(inferredName) : primary.description,
        lingkungan: primary.lingkungan || 'Lainnya',
        tanggal: primary.tanggal,
        tanggalWarta: wartaRow?.tanggal_warta || null,
        grossAmount,
        huriaAmount,
        bpskAmount,
        status: allApproved ? 'approved' : 'pending',
      });
    });

    return groups;
  }, [transactions, selectedYear]);

  // Combine Master Families + PaymentGroups into Rekap Rows
  const allRekapRows = useMemo<FamilyRekapRow[]>(() => {
    const familyById = new Map(families.filter((f) => f.is_active !== false).map((f) => [f.id, f]));
    const familyByName = new Map(
      families
        .filter((f) => f.is_active !== false)
        .map((f) => [normalizeNameKey(f.nama_keluarga), f])
    );

    const rowMap = new Map<string, FamilyRekapRow>();

    // 1. Seed all active families from master data
    families
      .filter((f) => f.is_active !== false)
      .forEach((f) => {
        rowMap.set(f.id, {
          key: f.id,
          familyId: f.id,
          namaKeluarga: formatNamaKeluarga(f.nama_keluarga),
          lingkungan: f.lingkungan,
          kepalaKeluarga: f.kepala_keluarga,
          isManualOnly: false,
          approvedAmount: 0,
          approvedHuria: 0,
          approvedBpsk: 0,
          pendingAmount: 0,
          latestTanggal: null,
          latestTanggalWarta: null,
          paymentStatus: 'unpaid',
          paymentCount: 0,
        });
      });

    // 2. Attach payment groups
    paymentGroups.forEach((pg) => {
      const matched =
        (pg.familyId ? familyById.get(pg.familyId) : undefined) ||
        familyByName.get(normalizeNameKey(pg.familyName));

      const mapKey = matched ? matched.id : `manual:${normalizeNameKey(pg.familyName)}:${normalizeNameKey(pg.lingkungan)}`;
      let entry = rowMap.get(mapKey);

      if (!entry) {
        entry = {
          key: mapKey,
          namaKeluarga: pg.familyName,
          lingkungan: pg.lingkungan || 'Lainnya',
          isManualOnly: true,
          approvedAmount: 0,
          approvedHuria: 0,
          approvedBpsk: 0,
          pendingAmount: 0,
          latestTanggal: null,
          latestTanggalWarta: null,
          paymentStatus: 'unpaid',
          paymentCount: 0,
        };
        rowMap.set(mapKey, entry);
      }

      entry.paymentCount += 1;
      if (pg.status === 'approved') {
        entry.approvedAmount += pg.grossAmount;
        entry.approvedHuria += pg.huriaAmount;
        entry.approvedBpsk += pg.bpskAmount;
      } else {
        entry.pendingAmount += pg.grossAmount;
      }

      if (!entry.latestTanggal || pg.tanggal > entry.latestTanggal) {
        entry.latestTanggal = pg.tanggal;
      }
      if (pg.tanggalWarta && (!entry.latestTanggalWarta || pg.tanggalWarta > entry.latestTanggalWarta)) {
        entry.latestTanggalWarta = pg.tanggalWarta;
      }
    });

    const result = Array.from(rowMap.values()).map((r) => {
      const paymentStatus: FamilyRekapRow['paymentStatus'] =
        r.approvedAmount > 0 ? 'paid' : r.pendingAmount > 0 ? 'pending' : 'unpaid';
      return { ...r, paymentStatus };
    });

    return result.sort(
      (a, b) => a.lingkungan.localeCompare(b.lingkungan) || a.namaKeluarga.localeCompare(b.namaKeluarga)
    );
  }, [families, paymentGroups]);

  // All distinct Lingkungan names ordered by master `lingkunganList`
  const orderedLingkunganNames = useMemo(() => {
    const masterNames = lingkunganList.map((l) => l.nama);
    const extraNames = Array.from(new Set(allRekapRows.map((r) => r.lingkungan))).filter(
      (name) => !masterNames.some((m) => m.toLowerCase() === name.toLowerCase())
    );
    return [...masterNames, ...extraNames];
  }, [lingkunganList, allRekapRows]);

  // Per-Lingkungan Summary
  const lingkunganStats = useMemo(() => {
    return orderedLingkunganNames.map((nama) => {
      const rows = allRekapRows.filter((r) => r.lingkungan.toLowerCase() === nama.toLowerCase());
      const total = rows.length;
      const paid = rows.filter((r) => r.paymentStatus === 'paid').length;
      const pending = rows.filter((r) => r.paymentStatus === 'pending').length;
      const unpaid = total - paid - pending;
      const bruto = rows.reduce((s, r) => s + r.approvedAmount, 0);
      const huria = rows.reduce((s, r) => s + r.approvedHuria, 0);
      const bpsk = rows.reduce((s, r) => s + r.approvedBpsk, 0);
      const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
      return { nama, total, paid, pending, unpaid, bruto, huria, bpsk, pct };
    });
  }, [orderedLingkunganNames, allRekapRows]);

  // Filtered Rows for Display
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allRekapRows.filter((r) => {
      if (
        selectedLingkungan !== 'all' &&
        r.lingkungan.toLowerCase() !== selectedLingkungan.toLowerCase()
      ) {
        return false;
      }
      if (selectedStatus !== 'all' && r.paymentStatus !== selectedStatus) {
        return false;
      }
      if (q) {
        return (
          r.namaKeluarga.toLowerCase().includes(q) ||
          r.lingkungan.toLowerCase().includes(q) ||
          (r.kepalaKeluarga || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allRekapRows, selectedLingkungan, selectedStatus, searchQuery]);

  // Overall KPI Metrics (scoped to selected Lingkungan if one is selected, else all)
  const kpiMetrics = useMemo(() => {
    const scope =
      selectedLingkungan === 'all'
        ? allRekapRows
        : allRekapRows.filter((r) => r.lingkungan.toLowerCase() === selectedLingkungan.toLowerCase());

    const totalKeluarga = scope.length;
    const paidCount = scope.filter((r) => r.paymentStatus === 'paid').length;
    const pendingCount = scope.filter((r) => r.paymentStatus === 'pending').length;
    const unpaidCount = totalKeluarga - paidCount - pendingCount;
    const totalBruto = scope.reduce((s, r) => s + r.approvedAmount, 0);
    const totalHuria = scope.reduce((s, r) => s + r.approvedHuria, 0);
    const totalBpsk = scope.reduce((s, r) => s + r.approvedBpsk, 0);
    const paidPercent = totalKeluarga > 0 ? Math.round((paidCount / totalKeluarga) * 100) : 0;

    return {
      totalKeluarga,
      paidCount,
      pendingCount,
      unpaidCount,
      paidPercent,
      totalBruto,
      totalHuria,
      totalBpsk,
    };
  }, [allRekapRows, selectedLingkungan]);

  const openPayModalForFamily = (row?: FamilyRekapRow) => {
    if (!row) {
      setTxPrefill({ year: selectedYear });
    } else {
      setTxPrefill({
        familyId: row.familyId,
        familyName: row.namaKeluarga,
        lingkungan: row.lingkungan,
        year: selectedYear,
      });
    }
    setTxModalOpen(true);
  };

  // Excel Export matching church's spreadsheet format (Multi-sheet per Lingkungan + Rekap)
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Ringkasan Per Lingkungan
    const summaryHeader = [
      [`REKAPITULASI PERSEMBAHAN TAHUNAN (PELEAN TAON) HKBP HUTARAJA`],
      [`TAHUN ANGGARAN : ${selectedYear}`],
      [''],
      [
        'NO',
        'LINGKUNGAN',
        'TOTAL KELUARGA',
        'SUDAH BAYAR',
        'MENUNGGU PERSETUJUAN',
        'BELUM BAYAR',
        'PERSENTASE (%)',
        'TOTAL BRUTO (RP)',
        'KAS HURIA 45% (RP)',
        'SENTRALISASI BPSK 55% (RP)',
      ],
    ];
    const summaryBody = lingkunganStats.map((st, idx) => [
      idx + 1,
      st.nama,
      st.total,
      st.paid,
      st.pending,
      st.unpaid,
      `${st.pct}%`,
      st.bruto,
      st.huria,
      st.bpsk,
    ]);
    const summaryFooter = [
      '',
      'TOTAL KESELURUHAN',
      lingkunganStats.reduce((s, x) => s + x.total, 0),
      lingkunganStats.reduce((s, x) => s + x.paid, 0),
      lingkunganStats.reduce((s, x) => s + x.pending, 0),
      lingkunganStats.reduce((s, x) => s + x.unpaid, 0),
      '',
      lingkunganStats.reduce((s, x) => s + x.bruto, 0),
      lingkunganStats.reduce((s, x) => s + x.huria, 0),
      lingkunganStats.reduce((s, x) => s + x.bpsk, 0),
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet([...summaryHeader, ...summaryBody, summaryFooter]);
    wsSummary['!cols'] = [
      { wch: 5 },
      { wch: 18 },
      { wch: 15 },
      { wch: 14 },
      { wch: 20 },
      { wch: 14 },
      { wch: 15 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Rekap_Lingkungan');

    // Sheet 2+: Per Lingkungan (or Filtered)
    const targetLingkungan =
      selectedLingkungan === 'all' ? orderedLingkunganNames : [selectedLingkungan];

    targetLingkungan.forEach((lingName) => {
      const lingRows = allRekapRows.filter(
        (r) =>
          r.lingkungan.toLowerCase() === lingName.toLowerCase() &&
          (selectedStatus === 'all' || r.paymentStatus === selectedStatus)
      );
      if (lingRows.length === 0) return;

      const sheetData: unknown[][] = [
        ['DAFTAR PEMBAYARAN PERSEMBAHAN TAHUNAN (PELEAN TAON) HKBP HUTARAJA'],
        [`TAHUN : ${selectedYear} — LINGKUNGAN : ${lingName.toUpperCase()}`],
        [''],
        ['NO', 'NAMA KELUARGA', 'LINGKUNGAN', 'JUMLAH', 'TGL BAYAR', 'TGL WARTA', 'STATUS'],
      ];

      lingRows.forEach((r, idx) => {
        const displayAmount = r.approvedAmount > 0 ? r.approvedAmount : r.pendingAmount;
        sheetData.push([
          idx + 1,
          r.namaKeluarga,
          r.lingkungan,
          displayAmount > 0 ? displayAmount : '',
          r.latestTanggal ? formatDateIndo(r.latestTanggal) : '',
          r.latestTanggalWarta ? formatDateIndo(r.latestTanggalWarta) : '',
          r.paymentStatus === 'paid'
            ? 'Sudah Bayar'
            : r.paymentStatus === 'pending'
            ? 'Menunggu Persetujuan'
            : 'Belum Bayar',
        ]);
      });

      const totalLing = lingRows.reduce((s, r) => s + r.approvedAmount, 0);
      sheetData.push(['', 'JUMLAH DISETUJUI', '', totalLing, '', '', '']);

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws['!cols'] = [
        { wch: 5 },
        { wch: 40 },
        { wch: 15 },
        { wch: 16 },
        { wch: 18 },
        { wch: 18 },
        { wch: 20 },
      ];
      const safeSheetName = lingName.slice(0, 30).replace(/[\\/?*[\]]/g, '');
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName || 'Lingkungan');
    });

    XLSX.writeFile(wb, `Rekap_Pelean_Taon_${selectedYear}_HKBP_Hutaraja.xlsx`);
  };

  // PDF Export
  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DAFTAR PEMBAYARAN PERSEMBAHAN TAHUNAN (PELEAN TAON) HKBP HUTARAJA', 14, 15);
    doc.setFontSize(9.5);
    doc.text(
      `TAHUN : ${selectedYear}${selectedLingkungan !== 'all' ? `   ·   LINGKUNGAN : ${selectedLingkungan.toUpperCase()}` : '   ·   SEMUA LINGKUNGAN'}`,
      14,
      21
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(
      `Terkumpul Disetujui: ${formatRupiah(kpiMetrics.totalBruto)} (45% Kas Huria: ${formatRupiah(
        kpiMetrics.totalHuria
      )} · 55% Sentralisasi BPSK: ${formatRupiah(kpiMetrics.totalBpsk)})`,
      14,
      27
    );

    const bodyRows = filteredRows.map((r, idx) => {
      const displayAmt = r.approvedAmount > 0 ? r.approvedAmount : r.pendingAmount;
      return [
        idx + 1,
        r.namaKeluarga,
        r.lingkungan,
        displayAmt > 0 ? formatRupiah(displayAmt) : '-',
        r.latestTanggal ? formatDateIndo(r.latestTanggal) : '-',
        r.latestTanggalWarta ? formatDateIndo(r.latestTanggalWarta) : '-',
        r.paymentStatus === 'paid'
          ? 'Lunas/Bayar'
          : r.paymentStatus === 'pending'
          ? 'Draf/Ajuan'
          : 'Belum Bayar',
      ];
    });

    autoTable(doc, {
      startY: 31,
      head: [['NO', 'NAMA KELUARGA', 'LINGKUNGAN', 'JUMLAH', 'TGL BAYAR', 'TGL WARTA', 'STATUS']],
      body: bodyRows,
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [11, 19, 43], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        3: { halign: 'right' },
      },
    });

    doc.save(`Daftar_Pelean_Taon_${selectedYear}_HKBP_Hutaraja.pdf`);
  };

  return (
    <div className="space-y-5 w-full max-w-7xl mx-auto min-w-0">
      {/* Header & Top Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Rekap Pelean Taon per Lingkungan
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitoring pembayaran Persembahan Tahunan (Pelean Taon) keluarga jemaat HKBP Hutaraja T.A. {selectedYear}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="min-h-[44px] sm:min-h-[40px] px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Ekspor Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            className="min-h-[44px] sm:min-h-[40px] px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-4 h-4 text-blue-700" />
            <span>Cetak PDF</span>
          </button>

          {canRecordPeleanTaon && (
            <button
              type="button"
              onClick={() => openPayModalForFamily()}
              className="min-h-[44px] sm:min-h-[40px] px-4 py-2 bg-[#0B132B] hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Catat Pelean Taon</span>
            </button>
          )}
        </div>
      </div>

      {/* Info Banner PPKU Rule */}
      <div className="px-4 py-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 text-xs flex items-start gap-2.5">
        <Landmark className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Ketentuan Pelean Taon HKBP Hutaraja:</strong> Wajib setiap tahun bagi seluruh keluarga jemaat dengan nominal tidak dibatasi. Seluruh penerimaan Pelean Taon otomatis dibukukan ke <strong>Kas Umum Huria (45%)</strong> dan disentralisasi ke <strong>BPSK Pusat (55%)</strong>.
        </p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>Total Keluarga</span>
            <Users className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 tabular-nums mt-1">
            {kpiMetrics.totalKeluarga} KK
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-emerald-200/80">
          <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-700">
            <span>Sudah Bayar</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-emerald-700 tabular-nums mt-1">
            {kpiMetrics.paidCount}{' '}
            <span className="text-xs font-semibold text-emerald-600">({kpiMetrics.paidPercent}%)</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-rose-200/80">
          <div className="flex items-center justify-between text-[11px] font-semibold text-rose-700">
            <span>Belum Bayar</span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-rose-700 tabular-nums mt-1">
            {kpiMetrics.unpaidCount}
            {kpiMetrics.pendingCount > 0 && (
              <span className="text-[11px] font-normal text-amber-700 block">
                +{kpiMetrics.pendingCount} menunggu ACC
              </span>
            )}
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90">
          <span className="text-[11px] font-semibold text-slate-500 block">Total Bruto (Disetujui)</span>
          <div className="text-sm sm:text-base font-bold font-mono text-slate-900 tabular-nums mt-1">
            {formatRupiah(kpiMetrics.totalBruto)}
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90">
          <span className="text-[11px] font-semibold text-emerald-700 block">Kas Huria (45%)</span>
          <div className="text-sm sm:text-base font-bold font-mono text-emerald-700 tabular-nums mt-1">
            {formatRupiah(kpiMetrics.totalHuria)}
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90">
          <span className="text-[11px] font-semibold text-blue-700 block">Sentralisasi BPSK (55%)</span>
          <div className="text-sm sm:text-base font-bold font-mono text-blue-700 tabular-nums mt-1">
            {formatRupiah(kpiMetrics.totalBpsk)}
          </div>
        </div>
      </div>

      {/* Ringkasan Per Lingkungan */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <HeartHandshake className="w-4 h-4 text-primary" />
            <span>Capaian Per Lingkungan (Klik kartu untuk filter)</span>
          </h2>
          {selectedLingkungan !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedLingkungan('all')}
              className="text-xs font-semibold text-blue-700 hover:underline"
            >
              Tampilkan Semua Lingkungan
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {lingkunganStats.map((st) => {
            const isSelected = selectedLingkungan.toLowerCase() === st.nama.toLowerCase();
            return (
              <button
                key={st.nama}
                type="button"
                onClick={() => setSelectedLingkungan(isSelected ? 'all' : st.nama)}
                className={`text-left p-3.5 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-500/20'
                    : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-bold text-sm text-slate-900">Lingkungan {st.nama}</span>
                  <span className="text-xs font-mono font-bold text-emerald-700 tabular-nums">
                    {st.paid}/{st.total} KK ({st.pct}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden mb-2">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all"
                    style={{ width: `${st.pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-600">
                  <span>Belum bayar: <strong className="text-rose-700">{st.unpaid}</strong></span>
                  <span className="font-mono font-bold text-slate-800 tabular-nums">
                    {formatRupiah(st.bruto)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
        <div className="relative sm:col-span-2 md:col-span-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama keluarga..."
            className="w-full min-h-[44px] sm:min-h-[40px] pl-9 pr-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/25"
          />
        </div>

        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="w-full min-h-[44px] sm:min-h-[40px] px-3 rounded-xl border border-slate-200 bg-white font-semibold"
          aria-label="Tahun Anggaran"
        >
          {availableYears.map((yr) => (
            <option key={yr} value={yr}>
              Tahun Anggaran {yr}
            </option>
          ))}
        </select>

        <select
          value={selectedLingkungan}
          onChange={(e) => setSelectedLingkungan(e.target.value)}
          className="w-full min-h-[44px] sm:min-h-[40px] px-3 rounded-xl border border-slate-200 bg-white"
          aria-label="Filter Lingkungan"
        >
          <option value="all">Semua Lingkungan ({orderedLingkunganNames.length})</option>
          {orderedLingkunganNames.map((nama) => (
            <option key={nama} value={nama}>
              Lingkungan {nama}
            </option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value as 'all' | 'paid' | 'unpaid' | 'pending')}
          className="w-full min-h-[44px] sm:min-h-[40px] px-3 rounded-xl border border-slate-200 bg-white"
          aria-label="Filter Status Pembayaran"
        >
          <option value="all">Semua Status ({allRekapRows.length})</option>
          <option value="paid">Sudah Bayar</option>
          <option value="unpaid">Belum Bayar</option>
          <option value="pending">Menunggu Persetujuan / Draf</option>
        </select>
      </div>

      {/* Data Table (Desktop) & Card List (Mobile) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
            <Filter className="w-3.5 h-3.5" />
            <span>Menampilkan {filteredRows.length} Keluarga</span>
          </span>
          <span className="font-mono text-[11px] hidden sm:inline">
            Format sesuai Daftar Pelean Taon HKBP Hutaraja
          </span>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 w-12 text-center">NO</th>
                <th className="py-3 px-4">NAMA KELUARGA</th>
                <th className="py-3 px-4">LINGKUNGAN</th>
                <th className="py-3 px-4 text-right">JUMLAH</th>
                <th className="py-3 px-4">TGL BAYAR</th>
                <th className="py-3 px-4">TGL WARTA</th>
                <th className="py-3 px-4 text-center">STATUS</th>
                {canRecordPeleanTaon && <th className="py-3 px-4 text-right">AKSI</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={canRecordPeleanTaon ? 8 : 7} className="py-12 text-center text-slate-400">
                    Tidak ada keluarga yang sesuai filter. Tambahkan daftar keluarga melalui menu Data Master → Keluarga &amp; Lingkungan.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const displayAmount = row.approvedAmount > 0 ? row.approvedAmount : row.pendingAmount;
                  return (
                    <tr key={row.key} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-slate-500 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{row.namaKeluarga}</div>
                        {row.isManualOnly && (
                          <span className="text-[10px] text-amber-700 font-medium">
                            Input manual (belum di Master Keluarga)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-semibold text-[11px]">
                          {row.lingkungan}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                        {displayAmount > 0 ? (
                          <span className={row.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-amber-700'}>
                            {formatRupiah(displayAmount)}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums whitespace-nowrap text-slate-700">
                        {row.latestTanggal ? formatDateIndo(row.latestTanggal) : '-'}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums whitespace-nowrap text-blue-700">
                        {row.latestTanggalWarta ? formatDateIndo(row.latestTanggalWarta) : '-'}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {row.paymentStatus === 'paid' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10px]">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Sudah Bayar</span>
                          </span>
                        ) : row.paymentStatus === 'pending' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px]">
                            <Clock className="w-3 h-3" />
                            <span>Menunggu ACC</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px]">
                            <span>Belum Bayar</span>
                          </span>
                        )}
                      </td>
                      {canRecordPeleanTaon && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openPayModalForFamily(row)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 transition-colors ${
                              row.paymentStatus === 'unpaid'
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            <Plus className="w-3 h-3" />
                            <span>{row.paymentStatus === 'unpaid' ? 'Catat Bayar' : 'Tambah'}</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List */}
        <div className="md:hidden divide-y divide-slate-100 px-4">
          {filteredRows.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Tidak ada data keluarga yang sesuai filter.
            </div>
          ) : (
            filteredRows.map((row, idx) => {
              const displayAmount = row.approvedAmount > 0 ? row.approvedAmount : row.pendingAmount;
              return (
                <div key={row.key} className="py-3.5 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[11px] text-slate-400">#{idx + 1}</span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10px]">
                          {row.lingkungan}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm mt-1 leading-snug">
                        {row.namaKeluarga}
                      </h3>
                    </div>

                    {row.paymentStatus === 'paid' ? (
                      <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10px]">
                        Sudah Bayar
                      </span>
                    ) : row.paymentStatus === 'pending' ? (
                      <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px]">
                        Menunggu ACC
                      </span>
                    ) : (
                      <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px]">
                        Belum Bayar
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="text-[11px] text-slate-500 space-y-0.5 font-mono">
                      <div>Bayar: {row.latestTanggal ? formatDateIndo(row.latestTanggal) : '-'}</div>
                      <div className="text-blue-700">
                        Warta: {row.latestTanggalWarta ? formatDateIndo(row.latestTanggalWarta) : '-'}
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`text-base font-bold font-mono tabular-nums ${
                          row.paymentStatus === 'paid'
                            ? 'text-emerald-700'
                            : row.paymentStatus === 'pending'
                            ? 'text-amber-700'
                            : 'text-slate-300'
                        }`}
                      >
                        {displayAmount > 0 ? formatRupiah(displayAmount) : 'Rp 0'}
                      </div>
                      {row.approvedAmount > 0 && (
                        <div className="text-[10px] text-slate-500 font-mono">
                          45%: {formatRupiah(row.approvedHuria)} · 55%: {formatRupiah(row.approvedBpsk)}
                        </div>
                      )}
                    </div>
                  </div>

                  {canRecordPeleanTaon && (
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => openPayModalForFamily(row)}
                        className={`min-h-[44px] px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 ${
                          row.paymentStatus === 'unpaid'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                        <span>{row.paymentStatus === 'unpaid' ? 'Catat Bayar Pelean Taon' : 'Tambah Pembayaran'}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Transaction Modal with Pelean Taon Prefill */}
      <TransactionModal
        isOpen={txModalOpen}
        onClose={() => {
          setTxModalOpen(false);
          setTxPrefill(null);
        }}
        defaultPeleanTaon={txPrefill}
      />
    </div>
  );
};
