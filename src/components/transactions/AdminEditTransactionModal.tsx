/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Save,
  AlertCircle,
  Paperclip,
  Trash2,
  Landmark,
  ShieldAlert,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import {
  SentralisasiExclusionType,
  SentralisasiRole,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../types/database';
import { formatDateIndo, formatRupiah } from '../../lib/formatters';
import { splitSentralisasiAmount } from '../../lib/ppkuRules';
import { ConfirmActionModal, ConfirmSummaryRow } from '../common/ConfirmActionModal';

interface AdminEditTransactionModalProps {
  isOpen: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onSaved?: () => void;
}

const STATUS_LABELS: Record<TransactionStatus, string> = {
  draft: 'Draft',
  submitted: 'Diajukan',
  approved: 'Disetujui (Approved)',
  rejected: 'Ditolak (Rejected)',
};

const TYPE_LABELS: Record<TransactionType, string> = {
  income: 'Pemasukan (+)',
  expense: 'Pengeluaran (-)',
  transfer_in: 'Transfer Masuk',
  transfer_out: 'Transfer Keluar',
};

const EXCLUSION_LABELS: Record<SentralisasiExclusionType, string> = {
  sosial_duka: 'Sosial & Duka (Diakonia Sosial)',
  beasiswa: 'Beasiswa / Pendidikan',
  pembangunan_lokal: 'Pembangunan Lokal Jemaat',
  transitoris: 'Dana Transitoris / Titipan',
  lainnya: 'Lainnya (Non-Sentralisasi)',
};

export const AdminEditTransactionModal: React.FC<AdminEditTransactionModalProps> = ({
  isOpen,
  transaction,
  onClose,
  onSaved,
}) => {
  const { kasList, storageAccounts, categories, updateTransaction } = useData();
  const { toast } = useToast();

  const [tanggal, setTanggal] = useState('');
  const [type, setType] = useState<TransactionType>('income');
  const [kasId, setKasId] = useState('');
  const [storageAccountId, setStorageAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [receiptNo, setReceiptNo] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [status, setStatus] = useState<TransactionStatus>('draft');
  const [rejectNote, setRejectNote] = useState('');
  const [isSentralisasi, setIsSentralisasi] = useState(true);
  const [sentralisasiRole, setSentralisasiRole] = useState<SentralisasiRole | ''>('');
  const [exclusionType, setExclusionType] = useState<SentralisasiExclusionType>('lainnya');
  const [changeReason, setChangeReason] = useState('');
  const [formError, setFormError] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Populate fields when transaction changes
  useEffect(() => {
    if (isOpen && transaction) {
      setTanggal(transaction.tanggal || '');
      setType(transaction.type || 'income');
      setKasId(transaction.kas_id || '');
      setStorageAccountId(transaction.storage_account_id || '');
      setCategoryId(transaction.category_id || '');
      setAmount(String(transaction.amount ?? ''));
      setDescription(transaction.description || '');
      setReceiptNo(transaction.receipt_no || '');
      setAttachmentUrl(transaction.attachment_url || '');
      setStatus(transaction.status || 'draft');
      setRejectNote(transaction.reject_note || '');
      const sentFlag =
        transaction.is_sentralisasi !== undefined ? transaction.is_sentralisasi !== false : true;
      setIsSentralisasi(sentFlag);
      setSentralisasiRole(
        transaction.sentralisasi_role && transaction.sentralisasi_role !== 'non_sentralisasi'
          ? transaction.sentralisasi_role
          : ''
      );
      setExclusionType(transaction.sentralisasi_exclusion_type || 'lainnya');
      setChangeReason('');
      setFormError('');
      setIsConfirmOpen(false);
    }
  }, [isOpen, transaction, categories]);

  const filteredCategories = useMemo(() => {
    const targetTipe = type === 'expense' || type === 'transfer_out' ? 'expense' : 'income';
    return categories.filter((c) => c.is_active && c.tipe === targetTipe);
  }, [categories, type]);

  const parsedAmount = useMemo(() => {
    const num = Number(amount);
    return Number.isFinite(num) && num > 0 ? Math.round(num) : 0;
  }, [amount]);

  const sentralisasiPreview = useMemo(() => {
    if (type !== 'income') return { bpskAmount: 0, huriaAmount: 0 };
    if (!isSentralisasi) return { bpskAmount: 0, huriaAmount: parsedAmount };
    if (sentralisasiRole === 'huria_share') return { bpskAmount: 0, huriaAmount: parsedAmount };
    if (sentralisasiRole === 'bpsk_share') return { bpskAmount: parsedAmount, huriaAmount: 0 };
    return splitSentralisasiAmount(parsedAmount, true);
  }, [type, isSentralisasi, sentralisasiRole, parsedAmount]);

  const confirmRows: ConfirmSummaryRow[] = useMemo(() => {
    if (!transaction) return [];
    const rows: ConfirmSummaryRow[] = [];

    const oldKasName = kasList.find((k) => k.id === transaction.kas_id)?.nama || transaction.kas_id;
    const newKasName = kasList.find((k) => k.id === kasId)?.nama || kasId;

    const oldStorageName =
      storageAccounts.find((s) => s.id === transaction.storage_account_id)?.nama ||
      transaction.storage_account_id;
    const newStorageName =
      storageAccounts.find((s) => s.id === storageAccountId)?.nama || storageAccountId;

    const oldCatName =
      categories.find((c) => c.id === transaction.category_id)?.nama ||
      (transaction.type.includes('transfer') ? 'Transfer Antar Kas' : '-');
    const newCatName =
      categories.find((c) => c.id === categoryId)?.nama ||
      (type.includes('transfer') ? 'Transfer Antar Kas' : '-');

    if (tanggal !== transaction.tanggal) {
      rows.push({
        label: 'Tanggal',
        oldValue: formatDateIndo(transaction.tanggal),
        newValue: formatDateIndo(tanggal),
        highlight: true,
      });
    } else {
      rows.push({ label: 'Tanggal', newValue: formatDateIndo(tanggal) });
    }

    if (type !== transaction.type) {
      rows.push({
        label: 'Jenis Transaksi',
        oldValue: TYPE_LABELS[transaction.type],
        newValue: TYPE_LABELS[type],
        highlight: true,
      });
    }

    if (kasId !== transaction.kas_id) {
      rows.push({
        label: 'Kas / Dana',
        oldValue: oldKasName,
        newValue: newKasName,
        highlight: true,
      });
    } else {
      rows.push({ label: 'Kas / Dana', newValue: newKasName });
    }

    if (storageAccountId !== transaction.storage_account_id) {
      rows.push({
        label: 'Tempat Simpan',
        oldValue: oldStorageName,
        newValue: newStorageName,
        highlight: true,
      });
    }

    if ((categoryId || '') !== (transaction.category_id || '')) {
      rows.push({
        label: 'Kategori',
        oldValue: oldCatName,
        newValue: newCatName,
        highlight: true,
      });
    }

    if (parsedAmount !== Number(transaction.amount)) {
      rows.push({
        label: 'Nominal',
        oldValue: formatRupiah(transaction.amount),
        newValue: formatRupiah(parsedAmount),
        highlight: true,
      });
    } else {
      rows.push({ label: 'Nominal', newValue: formatRupiah(parsedAmount) });
    }

    if (status !== transaction.status) {
      rows.push({
        label: 'Status',
        oldValue: STATUS_LABELS[transaction.status],
        newValue: STATUS_LABELS[status],
        highlight: true,
      });
    }

    const oldSentLabel =
      transaction.type !== 'income'
        ? 'Tidak berlaku'
        : transaction.is_sentralisasi === false
        ? 'Non-Sentralisasi (100% Kas Tujuan)'
        : 'Objek Sentralisasi (55% BPSK / 45% Huria)';
    const newSentLabel =
      type !== 'income'
        ? 'Tidak berlaku'
        : !isSentralisasi
        ? 'Non-Sentralisasi (100% Kas Tujuan)'
        : sentralisasiRole === 'huria_share'
        ? 'Objek Sentralisasi (Porsi 45% Huria)'
        : sentralisasiRole === 'bpsk_share'
        ? 'Objek Sentralisasi (Porsi 55% BPSK)'
        : `Objek Sentralisasi (BPSK ${formatRupiah(sentralisasiPreview.bpskAmount)} / Huria ${formatRupiah(
            sentralisasiPreview.huriaAmount
          )})`;

    if (type === 'income' && (oldSentLabel !== newSentLabel || parsedAmount !== Number(transaction.amount))) {
      rows.push({
        label: 'Aturan Sentralisasi PPKU',
        oldValue: oldSentLabel,
        newValue: newSentLabel,
        highlight: oldSentLabel !== newSentLabel,
      });
    }

    if (description.trim() !== transaction.description.trim()) {
      rows.push({
        label: 'Uraian',
        oldValue: transaction.description,
        newValue: description.trim(),
        highlight: true,
      });
    }

    if ((receiptNo.trim() || '-') !== (transaction.receipt_no || '-')) {
      rows.push({
        label: 'No. Bukti',
        oldValue: transaction.receipt_no || '-',
        newValue: receiptNo.trim() || '-',
        highlight: true,
      });
    }

    return rows;
  }, [
    transaction,
    kasList,
    storageAccounts,
    categories,
    tanggal,
    type,
    kasId,
    storageAccountId,
    categoryId,
    parsedAmount,
    status,
    isSentralisasi,
    sentralisasiRole,
    sentralisasiPreview,
    description,
    receiptNo,
  ]);

  if (!isOpen || !transaction) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setFormError('Ukuran lampiran maksimal 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAttachmentUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCategoryChange = (newCatId: string) => {
    setCategoryId(newCatId);
  };

  const handleValidateAndAskConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!tanggal) {
      setFormError('Tanggal transaksi wajib diisi.');
      return;
    }
    if (!kasId) {
      setFormError('Pilih Kas (Dana) terlebih dahulu.');
      return;
    }
    if (!storageAccountId) {
      setFormError('Pilih Tempat Penyimpanan (Tunai/Bank) terlebih dahulu.');
      return;
    }
    if (parsedAmount <= 0) {
      setFormError('Nominal transaksi harus lebih dari Rp 0.');
      return;
    }
    if (!description.trim()) {
      setFormError('Uraian / keterangan transaksi wajib diisi.');
      return;
    }
    if (status === 'rejected' && !rejectNote.trim()) {
      setFormError('Alasan penolakan wajib diisi jika status diubah menjadi Ditolak.');
      return;
    }

    setIsConfirmOpen(true);
  };

  const handleConfirmedSave = async (confirmReason?: string) => {
    const finalReason = confirmReason || changeReason.trim() || undefined;
    const updates: Partial<Transaction> = {
      tanggal,
      type,
      kas_id: kasId,
      storage_account_id: storageAccountId,
      category_id: type.includes('transfer') ? null : categoryId || null,
      amount: parsedAmount,
      description: description.trim(),
      receipt_no: receiptNo.trim() || null,
      attachment_url: attachmentUrl.trim() || null,
      status,
      reject_note: status === 'rejected' ? rejectNote.trim() : null,
      is_sentralisasi: type === 'income' ? isSentralisasi : false,
      sentralisasi_role:
        type === 'income'
          ? isSentralisasi
            ? sentralisasiRole || null
            : 'non_sentralisasi'
          : null,
      sentralisasi_exclusion_type:
        type === 'income' && !isSentralisasi ? exclusionType : null,
    };

    const res = await updateTransaction(transaction.id, updates, finalReason);
    setIsConfirmOpen(false);

    if (!res.success) {
      setFormError(res.error || 'Gagal memperbarui transaksi.');
      toast.error(res.error || 'Gagal memperbarui transaksi.');
      return;
    }

    toast.success('Perubahan transaksi berhasil disimpan ke database Supabase.');
    onSaved?.();
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
      >
        <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-2xl w-full max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 mobile-sheet-enter">
          <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0 bg-slate-50">
            <div className="w-10 h-1 rounded-full bg-slate-300" />
          </div>
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-slate-50 shrink-0">
            <div className="min-w-0 pr-2">
              <h3 className="font-bold text-sm sm:text-base text-slate-900">Edit Transaksi Kas (Admin)</h3>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                ID: {transaction.id} · Status Saat Ini: {STATUS_LABELS[transaction.status]}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 sm:p-1.5 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors shrink-0"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleValidateAndAskConfirm} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {transaction.status === 'approved' && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Transaksi berstatus Approved. Perubahan langsung memperbarui saldo kas &amp; Audit Trail.</span>
              </div>
            )}

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Transaksi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full text-xs md:text-sm p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jenis Transaksi <span className="text-rose-500">*</span>
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as TransactionType)}
                  className="w-full text-xs md:text-sm p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                >
                  <option value="income">Pemasukan (+)</option>
                  <option value="expense">Pengeluaran (-)</option>
                  <option value="transfer_in">Transfer Masuk</option>
                  <option value="transfer_out">Transfer Keluar</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kas / Dana <span className="text-rose-500">*</span>
                </label>
                <select
                  value={kasId}
                  onChange={(e) => setKasId(e.target.value)}
                  className="w-full text-xs md:text-sm p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  required
                >
                  <option value="">-- Pilih Kas --</option>
                  {kasList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama} ({k.kode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tempat Penyimpanan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={storageAccountId}
                  onChange={(e) => setStorageAccountId(e.target.value)}
                  className="w-full text-xs md:text-sm p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  required
                >
                  <option value="">-- Pilih Tempat Simpan --</option>
                  {storageAccounts.map((sa) => (
                    <option key={sa.id} value={sa.id}>
                      {sa.nama} ({sa.tipe === 'bank' ? 'Bank' : 'Tunai'})
                    </option>
                  ))}
                </select>
              </div>

              {!type.includes('transfer') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategori Transaksi
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full text-xs md:text-sm p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  >
                    <option value="">-- Tanpa Kategori --</option>
                    {filteredCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.kode ? `[${c.kode}] ` : ''}
                        {c.nama}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nominal (Rp) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full text-xs md:text-sm p-2.5 rounded-xl border border-slate-200 font-mono font-bold tabular-nums focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  required
                />
                {parsedAmount > 0 && (
                  <p className="text-[11px] font-mono text-slate-500 mt-1 tabular-nums">
                    Terbaca: {formatRupiah(parsedAmount)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Bukti / Kuitansi
                </label>
                <input
                  type="text"
                  value={receiptNo}
                  onChange={(e) => setReceiptNo(e.target.value)}
                  placeholder="Contoh: BKM-2025-001"
                  className="w-full text-xs md:text-sm p-2.5 rounded-xl border border-slate-200 font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status Persetujuan
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TransactionStatus)}
                  className="w-full text-xs md:text-sm p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                >
                  <option value="draft">Draft (Belum Diajukan)</option>
                  <option value="submitted">Diajukan (Menunggu Persetujuan)</option>
                  <option value="approved">Disetujui (Approved)</option>
                  <option value="rejected">Ditolak (Rejected)</option>
                </select>
              </div>
            </div>

            {status === 'rejected' && (
              <div>
                <label className="block text-xs font-semibold text-rose-700 mb-1">
                  Catatan Penolakan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Tuliskan alasan penolakan transaksi..."
                  className="w-full text-xs md:text-sm p-2.5 rounded-xl border border-rose-200 bg-rose-50/40 focus:outline-hidden focus:ring-2 focus:ring-rose-300"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Uraian / Keterangan Transaksi <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-xs md:text-sm p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                required
              />
            </div>

            {/* PPKU Sentralisasi Setting for Income */}
            {type === 'income' && (
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-blue-700" />
                    <span className="text-xs font-bold text-slate-900">
                      Pengaturan Sentralisasi Keuangan HKBP (PPKU 55% / 45%)
                    </span>
                  </div>
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={isSentralisasi}
                      onChange={(e) => setIsSentralisasi(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className={isSentralisasi ? 'text-blue-700' : 'text-emerald-700'}>
                      {isSentralisasi ? 'Objek Sentralisasi (55/45)' : 'Non-Sentralisasi (100% Kas)'}
                    </span>
                  </label>
                </div>

                {isSentralisasi ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="sm:col-span-1">
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Porsi Pencatatan
                      </label>
                      <select
                        value={sentralisasiRole}
                        onChange={(e) => setSentralisasiRole(e.target.value as SentralisasiRole | '')}
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                      >
                        <option value="">Gabungan (Otomatis 55/45)</option>
                        <option value="huria_share">Khusus Porsi 45% Huria</option>
                        <option value="bpsk_share">Khusus Porsi 55% BPSK</option>
                      </select>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">Bagian BPSK Pusat (55%)</span>
                      <span className="font-mono font-bold text-blue-700 tabular-nums">
                        {formatRupiah(sentralisasiPreview.bpskAmount)}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">Bagian Kas Huria (45%)</span>
                      <span className="font-mono font-bold text-emerald-700 tabular-nums">
                        {formatRupiah(sentralisasiPreview.huriaAmount)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Dasar Pengecualian Sentralisasi
                      </label>
                      <select
                        value={exclusionType}
                        onChange={(e) => setExclusionType(e.target.value as SentralisasiExclusionType)}
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                      >
                        {Object.entries(EXCLUSION_LABELS).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                      <span className="text-slate-600">Masuk 100% Kas Tujuan:</span>
                      <span className="font-mono font-bold text-emerald-700 tabular-nums">
                        {formatRupiah(parsedAmount)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Attachment */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Lampiran Bukti Nota / Kuitansi (Opsional)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <label className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer inline-flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Unggah Gambar/Bukti Baru</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
                {attachmentUrl && (
                  <button
                    type="button"
                    onClick={() => setAttachmentUrl('')}
                    className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Hapus Lampiran</span>
                  </button>
                )}
              </div>
              {attachmentUrl && (
                <p className="text-[11px] text-emerald-700 font-medium truncate">
                  Lampiran tersimpan ({attachmentUrl.startsWith('data:') ? 'Gambar terlampir' : attachmentUrl})
                </p>
              )}
            </div>

            {/* Admin Change Reason */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alasan Perubahan (Tercatat di Audit Trail)
              </label>
              <input
                type="text"
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Contoh: Koreksi nominal salah input / koreksi pos kas..."
                className="w-full text-xs md:text-sm p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>

            </div>
            {/* Sticky Footer Actions */}
            <div className="px-4 sm:px-6 pt-3 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] sm:py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 min-h-[44px] sm:min-h-0 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 min-h-[44px] sm:min-h-0 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Konfirmasi Mengubah Transaksi */}
      <ConfirmActionModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmedSave}
        variant="warning"
        title="Konfirmasi Perubahan Transaksi"
        message="Apakah Anda yakin ingin menyimpan perubahan data transaksi ini ke database? Perubahan akan langsung memperbarui saldo kas dan laporan terkait."
        warningText={
          transaction.status === 'approved'
            ? 'Perhatian: Transaksi ini berstatus Disetujui (Approved). Pastikan perubahan telah sesuai bukti kuitansi sah.'
            : transaction.transfer_id
            ? 'Catatan: Transaksi ini merupakan bagian dari Transfer Antar Kas. Pastikan sisi pasangan transfer juga disesuaikan bila nominal atau tanggal diubah.'
            : undefined
        }
        summaryRows={confirmRows}
        showReasonInput
        reasonLabel="Catatan / Alasan Perubahan (Opsional)"
        reasonPlaceholder="Contoh: Koreksi nominal atau uraian sesuai kuitansi fisik..."
        initialReason={changeReason}
        confirmLabel="Ya, Simpan Perubahan"
        cancelLabel="Periksa Kembali"
      />
    </>
  );
};
