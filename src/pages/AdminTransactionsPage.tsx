/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  Search,
  FileEdit,
  Trash2,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Receipt,
  CheckCircle2,
  Clock,
  XCircle,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Transaction } from '../types/database';
import { formatDateIndo, formatRupiah } from '../lib/formatters';
import { AdminEditTransactionModal } from '../components/transactions/AdminEditTransactionModal';
import { AttachmentPreviewModal } from '../components/transactions/AttachmentPreviewModal';
import { MobileTransactionDetailModal } from '../components/transactions/MobileTransactionDetailModal';
import { ConfirmActionModal, ConfirmSummaryRow } from '../components/common/ConfirmActionModal';

const ITEMS_PER_PAGE = 15;

const STATUS_BADGE: Record<Transaction['status'], { label: string; cls: string }> = {
  approved: { label: 'Disetujui', cls: 'bg-emerald-100 text-emerald-900 border-emerald-200' },
  submitted: { label: 'Diajukan', cls: 'bg-blue-100 text-blue-900 border-blue-200' },
  draft: { label: 'Draft', cls: 'bg-amber-100 text-amber-900 border-amber-200' },
  rejected: { label: 'Ditolak', cls: 'bg-rose-100 text-rose-900 border-rose-200' },
};

export const AdminTransactionsPage: React.FC = () => {
  const { kasList, storageAccounts, categories, transactions, deleteTransaction } = useData();
  const { toast } = useToast();

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKas, setSelectedKas] = useState('all');
  const [selectedStorage, setSelectedStorage] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Mobile adaptive states
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [detailTargetTx, setDetailTargetTx] = useState<Transaction | null>(null);

  // Modal states
  const [editTargetTx, setEditTargetTx] = useState<Transaction | null>(null);
  const [deleteTargetTx, setDeleteTargetTx] = useState<Transaction | null>(null);
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState<string | null>(null);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (selectedKas !== 'all' && tx.kas_id !== selectedKas) return false;
      if (selectedStorage !== 'all' && tx.storage_account_id !== selectedStorage) return false;
      if (selectedType !== 'all' && tx.type !== selectedType) return false;
      if (selectedStatus !== 'all' && tx.status !== selectedStatus) return false;
      if (startDate && tx.tanggal < startDate) return false;
      if (endDate && tx.tanggal > endDate) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = tx.description.toLowerCase().includes(q);
        const matchReceipt = (tx.receipt_no || '').toLowerCase().includes(q);
        const matchId = tx.id.toLowerCase().includes(q);
        if (!matchDesc && !matchReceipt && !matchId) return false;
      }

      return true;
    });
  }, [
    transactions,
    selectedKas,
    selectedStorage,
    selectedType,
    selectedStatus,
    startDate,
    endDate,
    searchQuery,
  ]);

  const stats = useMemo(() => {
    return {
      total: filteredTransactions.length,
      approved: filteredTransactions.filter((t) => t.status === 'approved').length,
      pending: filteredTransactions.filter((t) => t.status === 'draft' || t.status === 'submitted').length,
      rejected: filteredTransactions.filter((t) => t.status === 'rejected').length,
    };
  }, [filteredTransactions]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTransactions = filteredTransactions.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  const deleteSummaryRows: ConfirmSummaryRow[] = useMemo(() => {
    if (!deleteTargetTx) return [];
    const kas = kasList.find((k) => k.id === deleteTargetTx.kas_id);
    const storage = storageAccounts.find((s) => s.id === deleteTargetTx.storage_account_id);
    const cat = categories.find((c) => c.id === deleteTargetTx.category_id);
    return [
      { label: 'Tanggal Transaksi', newValue: formatDateIndo(deleteTargetTx.tanggal) },
      ...(deleteTargetTx.tanggal_warta
        ? [{ label: 'Tanggal Warta', newValue: formatDateIndo(deleteTargetTx.tanggal_warta) }]
        : []),
      { label: 'No. Bukti', newValue: deleteTargetTx.receipt_no || '-' },
      { label: 'Kas / Dana', newValue: kas?.nama || deleteTargetTx.kas_id },
      { label: 'Tempat Simpan', newValue: storage?.nama || deleteTargetTx.storage_account_id },
      { label: 'Kategori', newValue: cat?.nama || (deleteTargetTx.type.includes('transfer') ? 'Transfer' : '-') },
      { label: 'Uraian', newValue: deleteTargetTx.description },
      {
        label: 'Nominal',
        newValue: `${deleteTargetTx.type === 'income' || deleteTargetTx.type === 'transfer_in' ? '+' : '-'}${formatRupiah(
          deleteTargetTx.amount
        )}`,
        highlight: true,
      },
      { label: 'Status', newValue: STATUS_BADGE[deleteTargetTx.status].label },
    ];
  }, [deleteTargetTx, kasList, storageAccounts, categories]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedKas('all');
    setSelectedStorage('all');
    setSelectedType('all');
    setSelectedStatus('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const handleConfirmDelete = async (reason?: string) => {
    if (!deleteTargetTx) return;
    const res = await deleteTransaction(deleteTargetTx.id, reason);
    setDeleteTargetTx(null);

    if (!res.success) {
      toast.error(res.error || 'Gagal menghapus transaksi.');
      return;
    }

    toast.success('Transaksi berhasil dihapus dari database Supabase.');
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Edit &amp; Hapus Transaksi (Admin)
          </h1>
          <p className="text-xs text-slate-500">
            Setiap perubahan atau penghapusan membutuhkan konfirmasi dan tercatat di Audit Trail
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetFilters}
          className="px-3.5 py-2 min-h-[40px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Filter</span>
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Transaksi
            </span>
            <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
              {stats.total}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <Receipt className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Disetujui
            </span>
            <span className="text-xl font-bold font-mono text-emerald-700 tabular-nums">
              {stats.approved}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Draft / Diajukan
            </span>
            <span className="text-xl font-bold font-mono text-amber-700 tabular-nums">
              {stats.pending}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Ditolak
            </span>
            <span className="text-xl font-bold font-mono text-rose-700 tabular-nums">
              {stats.rejected}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
            <XCircle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari uraian, nomor bukti, atau ID transaksi..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </div>

          <select
            value={selectedKas}
            onChange={(e) => {
              setSelectedKas(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full text-xs p-2 rounded-xl border border-slate-200 bg-white"
          >
            <option value="all">Semua Kas (Dana)</option>
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
            className="w-full text-xs p-2 rounded-xl border border-slate-200 bg-white"
          >
            <option value="all">Semua Status</option>
            <option value="approved">Disetujui (Approved)</option>
            <option value="submitted">Diajukan (Submitted)</option>
            <option value="draft">Draft</option>
            <option value="rejected">Ditolak (Rejected)</option>
          </select>
        </div>

        {/* Mobile Collapsible Filter Toggle */}
        <div className="md:hidden pt-1">
          <button
            type="button"
            onClick={() => setShowMobileFilters((v) => !v)}
            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 flex items-center justify-between"
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Filter Lanjutan (Simpanan, Jenis, Tanggal)</span>
              {(selectedStorage !== 'all' || selectedType !== 'all' || startDate || endDate) && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                  Aktif
                </span>
              )}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${showMobileFilters ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        <div
          className={`${
            showMobileFilters ? 'grid' : 'hidden'
          } md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs`}
        >
          <select
            value={selectedStorage}
            onChange={(e) => {
              setSelectedStorage(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full min-h-[44px] md:min-h-0 text-xs p-2 rounded-xl border border-slate-200 bg-white"
          >
            <option value="all">Semua Tempat Simpan</option>
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
            className="w-full min-h-[44px] md:min-h-0 text-xs p-2 rounded-xl border border-slate-200 bg-white"
          >
            <option value="all">Semua Jenis</option>
            <option value="income">Pemasukan (+)</option>
            <option value="expense">Pengeluaran (-)</option>
            <option value="transfer_in">Transfer Masuk</option>
            <option value="transfer_out">Transfer Keluar</option>
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full min-h-[44px] md:min-h-0 text-xs p-2 rounded-xl border border-slate-200"
            aria-label="Dari tanggal"
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full min-h-[44px] md:min-h-0 text-xs p-2 rounded-xl border border-slate-200"
            aria-label="Sampai tanggal"
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Tanggal &amp; Bukti</th>
                <th className="py-3 px-4">Kas &amp; Simpanan</th>
                <th className="py-3 px-4">Uraian &amp; Kategori</th>
                <th className="py-3 px-4 text-right">Nominal</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Tidak ada transaksi yang sesuai dengan filter saat ini.
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx) => {
                  const kas = kasList.find((k) => k.id === tx.kas_id);
                  const storage = storageAccounts.find((s) => s.id === tx.storage_account_id);
                  const cat = categories.find((c) => c.id === tx.category_id);
                  const isInc = tx.type === 'income' || tx.type === 'transfer_in';
                  const badge = STATUS_BADGE[tx.status];

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap align-top">
                        <div className="font-mono font-semibold text-slate-900 tabular-nums">
                          {formatDateIndo(tx.tanggal)}
                        </div>
                        {tx.tanggal_warta && (
                          <div className="text-[11px] font-mono text-blue-700 mt-0.5">
                            Warta: {formatDateIndo(tx.tanggal_warta)}
                          </div>
                        )}
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          {tx.receipt_no || '-'}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap align-top">
                        <div className="font-semibold text-slate-900">{kas?.nama || tx.kas_id}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {storage?.nama || tx.storage_account_id}
                        </div>
                      </td>

                      <td className="py-3 px-4 max-w-sm align-top">
                        <div className="font-medium text-slate-900 leading-snug">{tx.description}</div>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500">
                          <span>
                            {cat?.nama || (tx.type.includes('transfer') ? 'Transfer Antar Kas' : 'Tanpa Kategori')}
                          </span>
                          {tx.attachment_url && (
                            <button
                              type="button"
                              onClick={() => setPreviewAttachmentUrl(tx.attachment_url!)}
                              className="inline-flex items-center gap-1 text-blue-700 hover:underline font-medium"
                            >
                              <Paperclip className="w-3 h-3" />
                              <span>Lihat Bukti</span>
                            </button>
                          )}
                        </div>
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
                        {tx.type === 'income' && (
                          <div className="text-[10px] font-sans font-medium text-slate-500 mt-0.5">
                            {tx.is_sentralisasi === false
                              ? '100% Kas Tujuan'
                              : `BPSK ${formatRupiah(
                                  tx.bpsk_amount ?? Math.round(tx.amount * 0.55)
                                )}`}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap align-top">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap align-top">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditTargetTx(tx)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors"
                          >
                            <FileEdit className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTargetTx(tx)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-slate-100 p-4 space-y-3">
          {paginatedTransactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Tidak ada transaksi yang sesuai dengan filter.
            </div>
          ) : (
            paginatedTransactions.map((tx) => {
              const kas = kasList.find((k) => k.id === tx.kas_id);
              const storage = storageAccounts.find((s) => s.id === tx.storage_account_id);
              const isInc = tx.type === 'income' || tx.type === 'transfer_in';
              const badge = STATUS_BADGE[tx.status];

              return (
                <div key={tx.id} className="pt-3 first:pt-0 space-y-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setDetailTargetTx(tx)}
                    className="w-full text-left space-y-2 active:opacity-80"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-slate-600 tabular-nums truncate">
                        {formatDateIndo(tx.tanggal)}
                        {tx.tanggal_warta ? ` · Warta ${formatDateIndo(tx.tanggal_warta)}` : ''}
                        {tx.receipt_no ? ` · ${tx.receipt_no}` : ''}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0 ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="font-semibold text-slate-900 text-sm">{tx.description}</div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-500 truncate">
                        {kas?.nama} · {storage?.nama}
                      </span>
                      <span
                        className={`font-mono font-bold tabular-nums text-sm shrink-0 ${
                          isInc ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {isInc ? '+' : '-'}
                        {formatRupiah(tx.amount)}
                      </span>
                    </div>
                  </button>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div>
                      {tx.attachment_url && (
                        <button
                          type="button"
                          onClick={() => setPreviewAttachmentUrl(tx.attachment_url!)}
                          className="px-2.5 py-1.5 min-h-[44px] sm:min-h-0 rounded-lg bg-slate-50 text-blue-700 border border-slate-200 font-semibold inline-flex items-center gap-1"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>Bukti</span>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditTargetTx(tx)}
                        className="px-3.5 py-1.5 min-h-[44px] sm:min-h-0 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-semibold inline-flex items-center gap-1"
                      >
                        <FileEdit className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTargetTx(tx)}
                        className="px-3.5 py-1.5 min-h-[44px] sm:min-h-0 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-semibold inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <span>
            Menampilkan{' '}
            {filteredTransactions.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1} -{' '}
            {Math.min(safePage * ITEMS_PER_PAGE, filteredTransactions.length)} dari{' '}
            {filteredTransactions.length} transaksi
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="p-2 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold tabular-nums px-1">
              Halaman {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="p-2 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal (with Change Confirmation inside) */}
      <AdminEditTransactionModal
        isOpen={Boolean(editTargetTx)}
        transaction={editTargetTx}
        onClose={() => setEditTargetTx(null)}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmActionModal
        isOpen={Boolean(deleteTargetTx)}
        onClose={() => setDeleteTargetTx(null)}
        onConfirm={handleConfirmDelete}
        variant="danger"
        title="Konfirmasi Hapus Transaksi"
        message="Apakah Anda yakin ingin menghapus transaksi ini secara permanen? Tindakan ini tidak dapat dibatalkan dan akan langsung memperbarui saldo kas."
        warningText={
          deleteTargetTx?.status === 'approved'
            ? 'Peringatan: Transaksi ini berstatus Disetujui (Approved). Menghapusnya akan mengubah saldo resmi kas & laporan warta/LPJ.'
            : deleteTargetTx?.transfer_id
            ? 'Catatan: Transaksi ini bagian dari Transfer Antar Kas. Menghapus satu sisi dapat memengaruhi keseimbangan transfer antar kas.'
            : undefined
        }
        summaryRows={deleteSummaryRows}
        showReasonInput
        reasonLabel="Alasan Penghapusan (Tercatat di Audit Trail)"
        reasonPlaceholder="Contoh: Transaksi ganda / salah input periode..."
        confirmLabel="Ya, Hapus Transaksi"
        cancelLabel="Batal"
      />

      {/* Attachment Preview Modal */}
      <AttachmentPreviewModal
        isOpen={Boolean(previewAttachmentUrl)}
        imageUrl={previewAttachmentUrl}
        onClose={() => setPreviewAttachmentUrl(null)}
      />

      {/* Mobile Transaction Detail Sheet */}
      <MobileTransactionDetailModal
        isOpen={Boolean(detailTargetTx)}
        transaction={detailTargetTx}
        kasName={kasList.find((k) => k.id === detailTargetTx?.kas_id)?.nama}
        storageName={storageAccounts.find((s) => s.id === detailTargetTx?.storage_account_id)?.nama}
        categoryName={categories.find((c) => c.id === detailTargetTx?.category_id)?.nama}
        onClose={() => setDetailTargetTx(null)}
        onPreviewAttachment={(url) => {
          setDetailTargetTx(null);
          setPreviewAttachmentUrl(url);
        }}
        onEdit={(tx) => setEditTargetTx(tx)}
        onDelete={(tx) => setDeleteTargetTx(tx)}
      />
    </div>
  );
};
