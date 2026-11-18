/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Search,
  Plus,
  ArrowRightLeft,
  FileSpreadsheet,
  Trash2,
  Send,
  RotateCcw,
  FileEdit,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  BookOpen,
  List,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Transaction } from '../types/database';
import { formatDateIndo, formatRupiah } from '../lib/formatters';
import { exportToExcel } from '../lib/exportUtils';
import { TransactionModal } from '../components/transactions/TransactionModal';
import { TransferModal } from '../components/transactions/TransferModal';
import { AttachmentPreviewModal } from '../components/transactions/AttachmentPreviewModal';
import { ReversalModal } from '../components/transactions/ReversalModal';
import { AdminEditTransactionModal } from '../components/transactions/AdminEditTransactionModal';
import { ConfirmActionModal } from '../components/common/ConfirmActionModal';

const ITEMS_PER_PAGE = 15;

type LedgerColumnKey = 'huria' | 'pembangunan' | 'sosial' | 'sentralisasi' | 'transitoris' | 'lainnya';

interface LedgerColumnBuckets {
  huria: number;
  pembangunan: number;
  sosial: number;
  sentralisasi: number;
  transitoris: number;
  lainnya: number;
}

interface LedgerRowItem {
  key: string;
  rowNo?: number;
  tanggal: string;
  uraian: string;
  isParentHeader?: boolean;
  isSubRow?: boolean;
  jumlah: number | null;
  cols: LedgerColumnBuckets;
  statusText?: string;
}

const emptyBuckets = (): LedgerColumnBuckets => ({
  huria: 0,
  pembangunan: 0,
  sosial: 0,
  sentralisasi: 0,
  transitoris: 0,
  lainnya: 0,
});

const stripSplitSuffix = (desc: string): string =>
  desc
    .replace(/\s*\[45% Bagian Lokal.*?\]$/i, '')
    .replace(/\s*\[55% Otomatis Sentralisasi.*?\]$/i, '')
    .replace(/\s*\[100% Tanpa Sentralisasi\]$/i, '')
    .trim();

const formatLedgerNumber = (val: number | null): string => {
  if (val === null || val === 0) return '-';
  const absFormatted = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(val));
  return val < 0 ? `(${absFormatted})` : absFormatted;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  approved: { label: 'Disetujui', cls: 'text-emerald-700' },
  submitted: { label: 'Diajukan', cls: 'text-blue-700' },
  draft: { label: 'Draf', cls: 'text-amber-700' },
  rejected: { label: 'Ditolak', cls: 'text-rose-700' },
};

export const TransactionsPage: React.FC = () => {
  const { kasList, storageAccounts, transactions, changeStatus, deleteTransaction, createReversalTransaction } = useData();
  const { toast } = useToast();
  const {
    currentUser,
    isLeader,
    isAdmin,
    isAuditor,
    isMajelis,
    userKasAccess,
    canRecordTransactions,
    canTransfer,
    canInputKas,
  } = useAuth();

  // View Mode: Daftar Transaksi vs Buku Kas Bendahara
  const [viewMode, setViewMode] = useState<'list' | 'ledger'>('list');

  // Modals state
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState<string | null>(null);
  const [reversalTargetTx, setReversalTargetTx] = useState<Transaction | null>(null);
  const [editTargetTx, setEditTargetTx] = useState<Transaction | null>(null);
  const [deleteTargetTx, setDeleteTargetTx] = useState<Transaction | null>(null);
  const [recallTargetTx, setRecallTargetTx] = useState<Transaction | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKas, setSelectedKas] = useState('all');
  const [selectedStorage, setSelectedStorage] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPpku, setSelectedPpku] = useState<'all' | 'sentralisasi' | 'dikecualikan'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (!isLeader) {
        const myKasIds = userKasAccess.map((a) => a.kas_id);
        if (!myKasIds.includes(tx.kas_id)) return false;
      }

      if (selectedKas !== 'all' && tx.kas_id !== selectedKas) return false;
      if (selectedStorage !== 'all' && tx.storage_account_id !== selectedStorage) return false;
      if (selectedType !== 'all' && tx.type !== selectedType) return false;
      if (selectedStatus !== 'all' && tx.status !== selectedStatus) return false;

      if (selectedPpku === 'sentralisasi') {
        if (tx.type !== 'income' || tx.is_sentralisasi === false) return false;
      }
      if (selectedPpku === 'dikecualikan') {
        if (tx.type !== 'income' || tx.is_sentralisasi !== false) return false;
      }

      if (startDate && tx.tanggal < startDate) return false;
      if (endDate && tx.tanggal > endDate) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = tx.description.toLowerCase().includes(q);
        const matchReceipt = tx.receipt_no?.toLowerCase().includes(q);
        if (!matchDesc && !matchReceipt) return false;
      }

      return true;
    });
  }, [
    transactions,
    isLeader,
    userKasAccess,
    selectedKas,
    selectedStorage,
    selectedType,
    selectedStatus,
    selectedPpku,
    startDate,
    endDate,
    searchQuery,
  ]);

  // Map a kas_id to one of the 5 core Buku Kas Bendahara columns (or 'lainnya')
  const mapKasToColumn = useMemo(() => {
    return (kasId: string): LedgerColumnKey => {
      const k = kasList.find((item) => item.id === kasId);
      const name = (k?.nama || '').toLowerCase();
      const kode = (k?.kode || '').toLowerCase();
      if (kasId === 'kas-1' || kode === 'kas-umum' || name.includes('umum huria')) return 'huria';
      if (kasId === 'kas-7' || name.includes('pembangunan')) return 'pembangunan';
      if (kasId === 'kas-2' || name.includes('sosial') || name.includes('diakoni')) return 'sosial';
      if (kasId === 'kas-9' || kode === 'kas-sentral' || name.includes('sentralisasi')) return 'sentralisasi';
      if (kasId === 'kas-8' || name.includes('transitoris')) return 'transitoris';
      return 'lainnya';
    };
  }, [kasList]);

  // Build Buku Kas Bendahara rows matching manual cashbook reference
  const ledgerData = useMemo(() => {
    const sorted = [...filteredTransactions].sort((a, b) => {
      if (a.tanggal !== b.tanggal) return a.tanggal.localeCompare(b.tanggal);
      return (a.created_at || '').localeCompare(b.created_at || '');
    });

    const rows: LedgerRowItem[] = [];
    const totals = emptyBuckets();
    let totalJumlah = 0;
    let hasOtherKas = false;
    let seqNo = 1;

    const addTxIntoBuckets = (tx: Transaction, buckets: LedgerColumnBuckets): number => {
      const isInc = tx.type === 'income' || tx.type === 'transfer_in';
      const signed = isInc ? Number(tx.amount) : -Number(tx.amount);

      // Handle unsplit legacy sentralisasi income that holds both portions on one row
      if (
        tx.type === 'income' &&
        tx.is_sentralisasi !== false &&
        !tx.sentralisasi_role &&
        (tx.bpsk_amount ?? 0) > 0
      ) {
        const bpskAmt = Number(tx.bpsk_amount || 0);
        const huriaAmt = Number(tx.huria_amount ?? (Number(tx.amount) - bpskAmt));
        const col = mapKasToColumn(tx.kas_id);
        if (col === 'lainnya') hasOtherKas = true;
        buckets[col] += huriaAmt;
        buckets.sentralisasi += bpskAmt;
        totals[col] += huriaAmt;
        totals.sentralisasi += bpskAmt;
        totalJumlah += signed;
        return signed;
      }

      const col = mapKasToColumn(tx.kas_id);
      if (col === 'lainnya') hasOtherKas = true;
      buckets[col] += signed;
      totals[col] += signed;
      totalJumlah += signed;
      return signed;
    };

    const visitedGroupIds = new Set<string>();
    const groupMap = new Map<string, Transaction[]>();
    sorted.forEach((tx) => {
      if (tx.allocation_group_id) {
        const arr = groupMap.get(tx.allocation_group_id) || [];
        arr.push(tx);
        groupMap.set(tx.allocation_group_id, arr);
      }
    });

    sorted.forEach((tx) => {
      if (tx.allocation_group_id) {
        if (visitedGroupIds.has(tx.allocation_group_id)) return;
        visitedGroupIds.add(tx.allocation_group_id);

        const groupTxs = groupMap.get(tx.allocation_group_id) || [tx];

        if (tx.allocation_group_id.startsWith('alloc-multi-')) {
          // Multi-Pos group (e.g., Ucapan Syukur dari Kel. ... with sub-lines)
          const firstClean = stripSplitSuffix(groupTxs[0].description);
          const emDashIdx = firstClean.indexOf(' — ');
          const parentUraian = emDashIdx >= 0 ? firstClean.slice(0, emDashIdx) : firstClean;

          rows.push({
            key: `hdr-${tx.allocation_group_id}`,
            rowNo: seqNo++,
            tanggal: groupTxs[0].tanggal,
            uraian: parentUraian,
            isParentHeader: true,
            jumlah: null,
            cols: emptyBuckets(),
          });

          // Sub-group by base description so 45% Huria + 55% Sentralisasi share one sub-row
          const subOrder: string[] = [];
          const subMap = new Map<string, Transaction[]>();
          groupTxs.forEach((gTx) => {
            const clean = stripSplitSuffix(gTx.description);
            if (!subMap.has(clean)) {
              subOrder.push(clean);
              subMap.set(clean, []);
            }
            subMap.get(clean)!.push(gTx);
          });

          subOrder.forEach((cleanDesc, sIdx) => {
            const subTxs = subMap.get(cleanDesc)!;
            const buckets = emptyBuckets();
            let subJumlah = 0;
            subTxs.forEach((sTx) => {
              subJumlah += addTxIntoBuckets(sTx, buckets);
            });

            const idx = cleanDesc.indexOf(' — ');
            let subLabel = idx >= 0 ? cleanDesc.slice(idx + 3).trim() : cleanDesc;
            if (!subLabel.startsWith('-')) {
              subLabel = `- ${subLabel}`;
            }

            rows.push({
              key: `sub-${tx.allocation_group_id}-${sIdx}`,
              tanggal: '',
              uraian: subLabel,
              isSubRow: true,
              jumlah: subJumlah,
              cols: buckets,
              statusText: subTxs[0].status,
            });
          });
        } else {
          // Single-entry 45/55 split group -> combine onto ONE cashbook row
          const buckets = emptyBuckets();
          let grpJumlah = 0;
          groupTxs.forEach((gTx) => {
            grpJumlah += addTxIntoBuckets(gTx, buckets);
          });

          rows.push({
            key: `grp-${tx.allocation_group_id}`,
            rowNo: seqNo++,
            tanggal: groupTxs[0].tanggal,
            uraian: stripSplitSuffix(groupTxs[0].description),
            jumlah: grpJumlah,
            cols: buckets,
            statusText: groupTxs[0].status,
          });
        }
        return;
      }

      // Single ungrouped transaction
      const buckets = emptyBuckets();
      const amt = addTxIntoBuckets(tx, buckets);
      rows.push({
        key: tx.id,
        rowNo: seqNo++,
        tanggal: tx.tanggal,
        uraian: stripSplitSuffix(tx.description),
        jumlah: amt,
        cols: buckets,
        statusText: tx.status,
      });
    });

    return { rows, totals, totalJumlah, hasOtherKas };
  }, [filteredTransactions, mapKasToColumn]);

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTransactions = filteredTransactions.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  const filteredTotals = useMemo(() => {
    const masuk = filteredTransactions
      .filter((t) => t.type === 'income' && t.status === 'approved')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const keluar = filteredTransactions
      .filter((t) => t.type === 'expense' && t.status === 'approved')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    return { masuk, keluar };
  }, [filteredTransactions]);

  const handleExportExcel = () => {
    if (viewMode === 'ledger') {
      const ledgerRows = ledgerData.rows.map((r) => {
        const base: Record<string, string | number> = {
          'No.': r.rowNo ?? '',
          Tanggal: r.tanggal ? formatDateIndo(r.tanggal) : '',
          Uraian: r.uraian,
          Jumlah: r.jumlah ?? '',
          'Kas Huria': r.cols.huria || '',
          'Kas Pembangunan': r.cols.pembangunan || '',
          'Kas Diakoni Sosial': r.cols.sosial || '',
          'Kas Sentralisasi': r.cols.sentralisasi || '',
          'Kas Transitoris': r.cols.transitoris || '',
        };
        if (ledgerData.hasOtherKas) {
          base['Kas Seksi Lain'] = r.cols.lainnya || '';
        }
        return base;
      });
      const footer: Record<string, string | number> = {
        'No.': '',
        Tanggal: '',
        Uraian: 'JUMLAH',
        Jumlah: ledgerData.totalJumlah,
        'Kas Huria': ledgerData.totals.huria,
        'Kas Pembangunan': ledgerData.totals.pembangunan,
        'Kas Diakoni Sosial': ledgerData.totals.sosial,
        'Kas Sentralisasi': ledgerData.totals.sentralisasi,
        'Kas Transitoris': ledgerData.totals.transitoris,
      };
      if (ledgerData.hasOtherKas) {
        footer['Kas Seksi Lain'] = ledgerData.totals.lainnya;
      }
      ledgerRows.push(footer);
      exportToExcel(ledgerRows, `Buku_Kas_Bendahara_HKBP_${new Date().toISOString().split('T')[0]}`);
      return;
    }

    const rows = filteredTransactions.map((tx, idx) => {
      const kas = kasList.find((k) => k.id === tx.kas_id);
      const storage = storageAccounts.find((s) => s.id === tx.storage_account_id);
      return {
        No: idx + 1,
        Tanggal: tx.tanggal,
        'No. Bukti': tx.receipt_no || '-',
        'Nama Kas': kas?.nama || '-',
        'Tempat Penyimpanan': storage?.nama || '-',
        Jenis: tx.type,
        Uraian: tx.description,
        'Nominal (Rp)': Number(tx.amount),
        Status: tx.status,
      };
    });

    exportToExcel(rows, `Data_Transaksi_HKBP_Hutaraja_${new Date().toISOString().split('T')[0]}`);
  };

  const handleConfirmRecallToDraft = async () => {
    if (!recallTargetTx) return;
    const res = await changeStatus(recallTargetTx.id, 'draft');
    setRecallTargetTx(null);
    if (!res.success) {
      toast.error(res.error || 'Gagal menarik transaksi ke Draf.');
      return;
    }
    toast.success('Transaksi ditarik kembali ke Draf.');
  };

  const handleSubmitDraft = async (txId: string) => {
    const res = await changeStatus(txId, 'submitted');
    if (!res.success) {
      toast.error(res.error || 'Gagal mengajukan transaksi.');
      return;
    }
    toast.success('Draf transaksi diajukan untuk persetujuan.');
  };

  const handleConfirmDelete = async (reason?: string) => {
    if (!deleteTargetTx) return;
    const res = await deleteTransaction(deleteTargetTx.id, reason);
    setDeleteTargetTx(null);
    if (!res.success) {
      toast.error(res.error || 'Gagal menghapus transaksi.');
      return;
    }
    toast.success('Transaksi berhasil dihapus.');
  };

  const handleConfirmReversal = async (txId: string, reason: string) => {
    await createReversalTransaction(txId, reason);
    setReversalTargetTx(null);
  };

  return (
    <div className="space-y-5 w-full max-w-7xl mx-auto min-w-0">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Transaksi &amp; Buku Kas
          </h1>
          <p className="text-xs text-slate-500">
            Pemasukan, pengeluaran, dan transfer dana kas huria
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Segmented Switch */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 min-h-[34px] rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Daftar</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('ledger')}
              className={`px-3 py-1.5 min-h-[34px] rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                viewMode === 'ledger'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Buku Kas Bendahara</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 min-h-[40px] bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Ekspor Excel</span>
          </button>

          {(isAdmin || (canTransfer && kasList.some((k) => k.is_active && canInputKas(k.id)))) && (
            <button
              type="button"
              onClick={() => setIsTransferModalOpen(true)}
              className="px-3.5 py-2 min-h-[40px] bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <ArrowRightLeft className="w-4 h-4 text-blue-700" />
              <span>Transfer</span>
            </button>
          )}

          {(isAdmin || (canRecordTransactions && kasList.some((k) => k.is_active && canInputKas(k.id)))) && (
            <button
              type="button"
              onClick={() => setIsTxModalOpen(true)}
              className="px-4 py-2 min-h-[40px] bg-[#0B132B] hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Catat Transaksi</span>
            </button>
          )}

          {isAuditor && (
            <NavLink
              to="/audit"
              className="px-3.5 py-2 min-h-[40px] bg-purple-800 hover:bg-purple-900 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Modul Audit</span>
            </NavLink>
          )}
        </div>
      </div>

      {/* Compact Read-only Mode Strip */}
      {(isAuditor || isMajelis) && (
        <div className="px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between gap-2 text-xs text-slate-700">
          <span>
            {isAuditor
              ? 'Mode Badan Audit (Read-Only): periksa nota & mutasi, catat temuan di Modul Audit.'
              : 'Mode Pengawasan Majelis (Read-Only): pemantauan mutasi kas huria.'}
          </span>
          {isAuditor && (
            <NavLink to="/audit" className="font-semibold text-purple-800 hover:underline shrink-0">
              Tulis Temuan →
            </NavLink>
          )}
        </div>
      )}

      {/* Summary Strip */}
      <div className="bg-white rounded-2xl border border-slate-200/90 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        <div className="p-4 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">Pemasukan Disetujui</span>
          <span className="text-base sm:text-lg font-bold font-mono text-emerald-700 tabular-nums">
            +{formatRupiah(filteredTotals.masuk)}
          </span>
        </div>
        <div className="p-4 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">Pengeluaran Disetujui</span>
          <span className="text-base sm:text-lg font-bold font-mono text-rose-700 tabular-nums">
            -{formatRupiah(filteredTotals.keluar)}
          </span>
        </div>
        <div className="p-4 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">Total Catatan</span>
          <span className="text-base sm:text-lg font-bold font-mono text-slate-900 tabular-nums">
            {filteredTransactions.length} Baris
          </span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari uraian atau nomor bukti..."
              className="w-full h-10 pl-9 pr-3 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600"
            />
          </div>

          <select
            value={selectedKas}
            onChange={(e) => {
              setSelectedKas(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-white"
          >
            <option value="all">Semua Kas</option>
            {kasList.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-white"
          >
            <option value="all">Semua Status</option>
            <option value="approved">Disetujui</option>
            <option value="submitted">Diajukan</option>
            <option value="draft">Draf</option>
            <option value="rejected">Ditolak</option>
          </select>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          <select
            value={selectedStorage}
            onChange={(e) => {
              setSelectedStorage(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-200 bg-white"
          >
            <option value="all">Semua Simpanan</option>
            {storageAccounts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama}
              </option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-200 bg-white"
          >
            <option value="all">Semua Jenis</option>
            <option value="income">Pemasukan</option>
            <option value="expense">Pengeluaran</option>
            <option value="transfer_in">Transfer Masuk</option>
            <option value="transfer_out">Transfer Keluar</option>
          </select>

          <select
            value={selectedPpku}
            onChange={(e) => {
              setSelectedPpku(e.target.value as 'all' | 'sentralisasi' | 'dikecualikan');
              setCurrentPage(1);
            }}
            className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-200 bg-white"
          >
            <option value="all">Semua Sentralisasi</option>
            <option value="sentralisasi">Sentralisasi (45/55)</option>
            <option value="dikecualikan">Non-Sentralisasi (100%)</option>
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-200"
            aria-label="Dari tanggal"
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-200"
            aria-label="Sampai tanggal"
          />
        </div>
      </div>

      {/* ---------------- VIEW 1: BUKU KAS BENDAHARA (SPREADSHEET FORMAT) ---------------- */}
      {viewMode === 'ledger' ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Buku Kas Bendahara</h2>
              <p className="text-[11px] text-slate-500">
                Pembagian otomatis kolom kas dan sentralisasi sesuai pencatatan per transaksi
              </p>
            </div>
            <span className="text-[11px] text-slate-500 font-mono tabular-nums">
              {ledgerData.rows.filter((r) => !r.isSubRow).length} Pos Transaksi
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[920px]">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3 text-center border-r border-slate-200 w-12">No.</th>
                  <th className="py-2.5 px-3 text-left border-r border-slate-200 w-28">Tanggal</th>
                  <th className="py-2.5 px-3 text-left border-r border-slate-200 min-w-[240px]">Uraian</th>
                  <th className="py-2.5 px-3 text-right border-r border-slate-200 w-28">Jumlah</th>
                  <th className="py-2.5 px-3 text-right border-r border-slate-200 w-28">Kas Huria</th>
                  <th className="py-2.5 px-3 text-right border-r border-slate-200 w-32">Kas Pembangunan</th>
                  <th className="py-2.5 px-3 text-right border-r border-slate-200 w-32">Kas Diakoni Sosial</th>
                  <th className="py-2.5 px-3 text-right border-r border-slate-200 w-28">Kas Sentralisasi</th>
                  <th className={`py-2.5 px-3 text-right w-28 ${ledgerData.hasOtherKas ? 'border-r border-slate-200' : ''}`}>
                    Kas Transitoris
                  </th>
                  {ledgerData.hasOtherKas && (
                    <th className="py-2.5 px-3 text-right w-28">Kas Lain</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {ledgerData.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={ledgerData.hasOtherKas ? 10 : 9}
                      className="py-12 text-center text-slate-400"
                    >
                      Tidak ada catatan pada Buku Kas Bendahara untuk filter saat ini.
                    </td>
                  </tr>
                ) : (
                  ledgerData.rows.map((row) => (
                    <tr
                      key={row.key}
                      className={
                        row.isParentHeader
                          ? 'bg-slate-100/80 font-semibold text-slate-900'
                          : 'hover:bg-slate-50/70 text-slate-800'
                      }
                    >
                      <td className="py-2 px-3 text-center border-r border-slate-200 font-mono tabular-nums text-slate-600">
                        {row.rowNo ?? ''}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-mono tabular-nums whitespace-nowrap text-slate-600">
                        {row.tanggal ? formatDateIndo(row.tanggal) : ''}
                      </td>
                      <td
                        className={`py-2 px-3 border-r border-slate-200 ${
                          row.isSubRow ? 'pl-6 text-slate-700' : 'font-medium text-slate-900'
                        }`}
                      >
                        {row.uraian}
                      </td>
                      <td className="py-2 px-3 text-right border-r border-slate-200 font-mono font-semibold tabular-nums whitespace-nowrap">
                        {row.isParentHeader ? '' : formatLedgerNumber(row.jumlah)}
                      </td>
                      <td className="py-2 px-3 text-right border-r border-slate-200 font-mono tabular-nums whitespace-nowrap">
                        {row.isParentHeader ? '' : formatLedgerNumber(row.cols.huria)}
                      </td>
                      <td className="py-2 px-3 text-right border-r border-slate-200 font-mono tabular-nums whitespace-nowrap">
                        {row.isParentHeader ? '' : formatLedgerNumber(row.cols.pembangunan)}
                      </td>
                      <td className="py-2 px-3 text-right border-r border-slate-200 font-mono tabular-nums whitespace-nowrap">
                        {row.isParentHeader ? '' : formatLedgerNumber(row.cols.sosial)}
                      </td>
                      <td className="py-2 px-3 text-right border-r border-slate-200 font-mono tabular-nums whitespace-nowrap text-blue-900">
                        {row.isParentHeader ? '' : formatLedgerNumber(row.cols.sentralisasi)}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap ${
                          ledgerData.hasOtherKas ? 'border-r border-slate-200' : ''
                        }`}
                      >
                        {row.isParentHeader ? '' : formatLedgerNumber(row.cols.transitoris)}
                      </td>
                      {ledgerData.hasOtherKas && (
                        <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          {row.isParentHeader ? '' : formatLedgerNumber(row.cols.lainnya)}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
              {ledgerData.rows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-300">
                    <td colSpan={3} className="py-3 px-4 text-center tracking-wider">
                      JUMLAH
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap border-l border-slate-700">
                      {formatLedgerNumber(ledgerData.totalJumlah)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap border-l border-slate-700">
                      {formatLedgerNumber(ledgerData.totals.huria)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap border-l border-slate-700">
                      {formatLedgerNumber(ledgerData.totals.pembangunan)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap border-l border-slate-700">
                      {formatLedgerNumber(ledgerData.totals.sosial)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap border-l border-slate-700 text-amber-300">
                      {formatLedgerNumber(ledgerData.totals.sentralisasi)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap border-l border-slate-700">
                      {formatLedgerNumber(ledgerData.totals.transitoris)}
                    </td>
                    {ledgerData.hasOtherKas && (
                      <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap border-l border-slate-700">
                        {formatLedgerNumber(ledgerData.totals.lainnya)}
                      </td>
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ) : (
        /* ---------------- VIEW 2: DAFTAR TRANSAKSI ---------------- */
        <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Tanggal &amp; Bukti</th>
                  <th className="py-3 px-4">Kas &amp; Simpanan</th>
                  <th className="py-3 px-4">Uraian</th>
                  <th className="py-3 px-4 text-right">Nominal</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Tidak ada transaksi yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  paginatedTransactions.map((tx) => {
                    const kas = kasList.find((k) => k.id === tx.kas_id);
                    const storage = storageAccounts.find((s) => s.id === tx.storage_account_id);
                    const isInc = tx.type === 'income' || tx.type === 'transfer_in';
                    const statusInfo = STATUS_META[tx.status] || { label: tx.status, cls: 'text-slate-600' };

                    const porsiNote =
                      tx.type !== 'income'
                        ? null
                        : tx.is_sentralisasi === false || tx.sentralisasi_role === 'non_sentralisasi'
                        ? '100% Non-Sentralisasi'
                        : tx.sentralisasi_role === 'bpsk_share'
                        ? '55% Sentralisasi (BPSK)'
                        : tx.sentralisasi_role === 'huria_share'
                        ? '45% Bagian Lokal'
                        : `BPSK ${formatRupiah(tx.bpsk_amount ?? Math.round(tx.amount * 0.55))}`;

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap align-top">
                          <div className="font-mono text-slate-900 font-medium tabular-nums">
                            {formatDateIndo(tx.tanggal)}
                          </div>
                          {tx.receipt_no && (
                            <div className="text-[11px] text-slate-400 font-mono">{tx.receipt_no}</div>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap align-top">
                          <div className="font-semibold text-slate-900">{kas?.nama}</div>
                          <div className="text-[11px] text-slate-500">{storage?.nama}</div>
                        </td>

                        <td className="py-3 px-4 max-w-sm align-top">
                          <div className="font-medium text-slate-900 line-clamp-2">{tx.description}</div>
                          {(tx.attachment_url || tx.is_reversal || tx.reject_note) && (
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px]">
                              {tx.attachment_url && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewAttachmentUrl(tx.attachment_url!)}
                                  className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
                                >
                                  <Paperclip className="w-3 h-3" />
                                  <span>Lihat Bukti</span>
                                </button>
                              )}
                              {tx.is_reversal && <span className="text-amber-700 font-medium">Koreksi</span>}
                              {tx.reject_note && (
                                <span className="text-rose-600 truncate max-w-[200px]" title={tx.reject_note}>
                                  Alasan: {tx.reject_note}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td
                          className={`py-3 px-4 text-right font-mono font-bold whitespace-nowrap tabular-nums align-top ${
                            isInc ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          <div>
                            {isInc ? '+' : '-'}
                            {formatRupiah(tx.amount)}
                          </div>
                          {porsiNote && (
                            <div className="text-[10px] font-sans font-normal text-slate-500 mt-0.5">
                              {porsiNote}
                            </div>
                          )}
                        </td>

                        <td className={`py-3 px-4 text-center whitespace-nowrap font-semibold align-top ${statusInfo.cls}`}>
                          {statusInfo.label}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap align-top">
                          <div className="flex items-center justify-end gap-1">
                            {isAdmin && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setEditTargetTx(tx)}
                                  title="Edit Transaksi (Admin)"
                                  className="p-2 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                  <FileEdit className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTargetTx(tx)}
                                  title="Hapus Transaksi (Admin)"
                                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}

                            {tx.status === 'draft' &&
                              canInputKas(tx.kas_id) &&
                              (isAdmin || tx.created_by === currentUser?.id) && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleSubmitDraft(tx.id)}
                                    title="Ajukan untuk Persetujuan"
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  >
                                    <Send className="w-4 h-4" />
                                  </button>
                                  {!isAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => setDeleteTargetTx(tx)}
                                      title="Hapus Draf"
                                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </>
                              )}

                            {tx.status === 'submitted' &&
                              tx.created_by === currentUser?.id &&
                              canInputKas(tx.kas_id) && (
                                <button
                                  type="button"
                                  onClick={() => setRecallTargetTx(tx)}
                                  className="px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                                >
                                  Tarik Draf
                                </button>
                              )}

                            {tx.status === 'approved' && !tx.is_reversal && canInputKas(tx.kas_id) && (
                              <button
                                type="button"
                                onClick={() => setReversalTargetTx(tx)}
                                title="Buat Koreksi/Pembalik"
                                className="p-2 text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Cards View */}
          <div className="md:hidden divide-y divide-slate-100 px-4">
            {paginatedTransactions.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                Tidak ada transaksi yang cocok.
              </div>
            ) : (
              paginatedTransactions.map((tx) => {
                const kas = kasList.find((k) => k.id === tx.kas_id);
                const storage = storageAccounts.find((s) => s.id === tx.storage_account_id);
                const isInc = tx.type === 'income' || tx.type === 'transfer_in';
                const statusInfo = STATUS_META[tx.status] || { label: tx.status, cls: 'text-slate-600' };

                return (
                  <div key={tx.id} className="py-3.5 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-slate-500 tabular-nums">
                        {formatDateIndo(tx.tanggal)}
                        {tx.receipt_no ? ` · ${tx.receipt_no}` : ''}
                      </span>
                      <span className={`font-semibold ${statusInfo.cls}`}>{statusInfo.label}</span>
                    </div>

                    <div className="font-semibold text-slate-900 text-sm leading-snug">
                      {tx.description}
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-[11px] text-slate-500 truncate">
                        {kas?.nama} · {storage?.nama}
                      </span>

                      <div className="text-right shrink-0">
                        <span
                          className={`font-mono font-bold tabular-nums text-sm block ${
                            isInc ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {isInc ? '+' : '-'}
                          {formatRupiah(tx.amount)}
                        </span>
                        {tx.type === 'income' && (
                          <span className="text-[10px] text-slate-500 block">
                            {tx.is_sentralisasi === false || tx.sentralisasi_role === 'non_sentralisasi'
                              ? '100% Non-Sentralisasi'
                              : tx.sentralisasi_role === 'bpsk_share'
                              ? '55% Sentralisasi'
                              : tx.sentralisasi_role === 'huria_share'
                              ? '45% Lokal Huria'
                              : `BPSK ${formatRupiah(tx.bpsk_amount ?? Math.round(tx.amount * 0.55))}`}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <div>
                        {tx.attachment_url && (
                          <button
                            type="button"
                            onClick={() => setPreviewAttachmentUrl(tx.attachment_url!)}
                            className="min-h-[36px] text-xs font-medium text-blue-700 inline-flex items-center gap-1"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            <span>Bukti</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditTargetTx(tx)}
                              className="px-3 min-h-[36px] text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg inline-flex items-center gap-1"
                            >
                              <FileEdit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTargetTx(tx)}
                              className="p-2 min-h-[36px] min-w-[36px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg inline-flex items-center justify-center"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {tx.status === 'draft' &&
                          canInputKas(tx.kas_id) &&
                          (isAdmin || tx.created_by === currentUser?.id) && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSubmitDraft(tx.id)}
                                className="px-3 min-h-[36px] text-xs font-semibold text-white bg-blue-700 rounded-lg inline-flex items-center gap-1"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Ajukan</span>
                              </button>
                              {!isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => setDeleteTargetTx(tx)}
                                  className="p-2 min-h-[36px] min-w-[36px] text-rose-600 inline-flex items-center justify-center"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}

                        {tx.status === 'approved' && !tx.is_reversal && canInputKas(tx.kas_id) && (
                          <button
                            type="button"
                            onClick={() => setReversalTargetTx(tx)}
                            className="px-3 min-h-[36px] text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg inline-flex items-center gap-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Koreksi</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <span>
              {filteredTransactions.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1} -{' '}
              {Math.min(safePage * ITEMS_PER_PAGE, filteredTransactions.length)} dari {filteredTransactions.length} transaksi
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-slate-700 tabular-nums">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Modals */}
      <TransactionModal isOpen={isTxModalOpen} onClose={() => setIsTxModalOpen(false)} />
      <TransferModal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} />
      <AttachmentPreviewModal
        isOpen={Boolean(previewAttachmentUrl)}
        imageUrl={previewAttachmentUrl}
        onClose={() => setPreviewAttachmentUrl(null)}
      />
      <ReversalModal
        isOpen={Boolean(reversalTargetTx)}
        transaction={reversalTargetTx}
        onClose={() => setReversalTargetTx(null)}
        onConfirm={handleConfirmReversal}
      />
      <AdminEditTransactionModal
        isOpen={Boolean(editTargetTx)}
        transaction={editTargetTx}
        onClose={() => setEditTargetTx(null)}
      />
      <ConfirmActionModal
        isOpen={Boolean(deleteTargetTx)}
        onClose={() => setDeleteTargetTx(null)}
        onConfirm={handleConfirmDelete}
        variant="danger"
        title="Konfirmasi Hapus Transaksi"
        message="Apakah Anda yakin ingin menghapus transaksi ini secara permanen? Tindakan ini tidak dapat dibatalkan."
        warningText={
          deleteTargetTx?.status === 'approved'
            ? 'Peringatan: Transaksi ini berstatus Disetujui. Menghapusnya akan mengubah saldo resmi kas.'
            : undefined
        }
        summaryRows={
          deleteTargetTx
            ? [
                { label: 'Tanggal', newValue: formatDateIndo(deleteTargetTx.tanggal) },
                {
                  label: 'Kas / Dana',
                  newValue: kasList.find((k) => k.id === deleteTargetTx.kas_id)?.nama || deleteTargetTx.kas_id,
                },
                { label: 'Uraian', newValue: deleteTargetTx.description },
                { label: 'Nominal', newValue: formatRupiah(deleteTargetTx.amount), highlight: true },
                { label: 'Status', newValue: deleteTargetTx.status.toUpperCase() },
              ]
            : []
        }
        showReasonInput={isAdmin}
        reasonLabel="Alasan Penghapusan (Audit Trail)"
        reasonPlaceholder="Contoh: Salah input nominal / transaksi ganda..."
        confirmLabel="Ya, Hapus Transaksi"
        cancelLabel="Batal"
      />
      <ConfirmActionModal
        isOpen={Boolean(recallTargetTx)}
        onClose={() => setRecallTargetTx(null)}
        onConfirm={handleConfirmRecallToDraft}
        variant="warning"
        title="Konfirmasi Tarik ke Draf"
        message="Tarik kembali pengajuan transaksi ini menjadi status Draft?"
        summaryRows={
          recallTargetTx
            ? [
                { label: 'Tanggal', newValue: formatDateIndo(recallTargetTx.tanggal) },
                { label: 'Uraian', newValue: recallTargetTx.description },
                { label: 'Nominal', newValue: formatRupiah(recallTargetTx.amount) },
              ]
            : []
        }
        confirmLabel="Ya, Tarik ke Draf"
        cancelLabel="Batal"
      />
    </div>
  );
};
