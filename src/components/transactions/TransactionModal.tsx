/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Camera,
  Upload,
  X,
  AlertCircle,
  CheckCircle,
  Plus,
  Trash2,
  Layers,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { uploadReceiptFile } from '../../lib/supabase';
import { formatRupiah } from '../../lib/formatters';
import { getPpkuProcurementRule, splitSentralisasiAmount } from '../../lib/ppkuRules';
import { SentralisasiExclusionType } from '../../types/database';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultKasId?: string;
}

interface AllocationDraftRow {
  rowId: string;
  kas_id: string;
  sub_description: string;
  amountInput: string;
  is_sentralisasi: boolean;
  exclusion_type?: SentralisasiExclusionType | null;
}

export const TransactionModal: React.FC<Props> = ({ isOpen, onClose, defaultKasId }) => {
  const {
    kasList,
    storageAccounts,
    categories,
    settings,
    addTransaction,
    addCompoundIncomeTransactions,
    isPeriodClosed,
  } = useData();
  const { canInputKas } = useAuth();

  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [incomeMode, setIncomeMode] = useState<'single' | 'multi'>('single');

  const [tanggal, setTanggal] = useState<string>(new Date().toISOString().split('T')[0]);
  const [kasId, setKasId] = useState<string>('');
  const [storageAccountId, setStorageAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [receiptNo, setReceiptNo] = useState<string>('');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Per-transaction Sentralisasi status (decided during transaction recording)
  const [isSentralisasi, setIsSentralisasi] = useState<boolean>(true);
  const [exclusionType, setExclusionType] = useState<SentralisasiExclusionType>('lainnya');

  // Multi-pos income rows (e.g., Ucapan Syukur)
  const [allocations, setAllocations] = useState<AllocationDraftRow[]>([]);

  const selectableKas = useMemo(
    () => kasList.filter((k) => k.is_active && canInputKas(k.id)),
    [kasList, canInputKas]
  );

  const sentralisasiKas = useMemo(
    () => kasList.find((k) => k.id === 'kas-9' || k.kode === 'KAS-SENTRAL'),
    [kasList]
  );

  const inferExclusionForKas = (kId: string): SentralisasiExclusionType => {
    if (kId === 'kas-8') return 'transitoris';
    if (kId === 'kas-2') return 'sosial_duka';
    if (kId === 'kas-7') return 'pembangunan_lokal';
    return 'lainnya';
  };

  const inferDefaultSentralisasiForKas = (kId: string): boolean => {
    if (kId === 'kas-2' || kId === 'kas-8' || kId === 'kas-9') return false;
    return true;
  };

  useEffect(() => {
    if (isOpen) {
      setError('');
      setIncomeMode('single');
      setAmountInput('');
      setDescription('');
      setReceiptNo('');
      setAttachmentUrl(null);
      setTanggal(new Date().toISOString().split('T')[0]);

      let initialKas = '';
      if (defaultKasId && canInputKas(defaultKasId)) {
        initialKas = defaultKasId;
      } else if (selectableKas.length > 0) {
        const nonSentral = selectableKas.find((k) => k.id !== 'kas-9');
        initialKas = (nonSentral || selectableKas[0]).id;
      }
      setKasId(initialKas);
      setIsSentralisasi(inferDefaultSentralisasiForKas(initialKas));
      setExclusionType(inferExclusionForKas(initialKas));

      if (storageAccounts.length > 0) {
        const activeStor = storageAccounts.filter((s) => s.is_active);
        setStorageAccountId((activeStor[0] || storageAccounts[0]).id);
      }

      setAllocations([
        {
          rowId: `row-${Date.now()}-1`,
          kas_id: initialKas,
          sub_description: 'Ke Kas Huria',
          amountInput: '',
          is_sentralisasi: inferDefaultSentralisasiForKas(initialKas),
          exclusion_type: inferExclusionForKas(initialKas),
        },
      ]);
    }
  }, [isOpen, defaultKasId]);

  useEffect(() => {
    const validCategories = categories.filter((c) => c.tipe === type && c.is_active);
    if (validCategories.length > 0) {
      setCategoryId(validCategories[0].id);
    } else {
      setCategoryId('');
    }
  }, [type, categories]);

  const handleCategoryChange = (newCatId: string) => {
    setCategoryId(newCatId);
    const cat = categories.find((c) => c.id === newCatId);
    if (!defaultKasId && cat?.default_kas_id && canInputKas(cat.default_kas_id)) {
      setKasId(cat.default_kas_id);
      setExclusionType(inferExclusionForKas(cat.default_kas_id));
    }
  };

  const handleKasChange = (newKasId: string) => {
    setKasId(newKasId);
    setExclusionType(inferExclusionForKas(newKasId));
    if (newKasId === 'kas-2' || newKasId === 'kas-8') {
      setIsSentralisasi(false);
    }
  };

  const parseNum = (val: string) => parseFloat(val.replace(/[^0-9]/g, '')) || 0;

  const multiSummary = useMemo(() => {
    let totalGross = 0;
    let totalSentralisasiPool = 0;
    const inflowsByKas: Record<string, { kasName: string; amount: number }> = {};

    const addInflow = (kId: string, amt: number) => {
      if (amt <= 0 || !kId) return;
      const kName = kasList.find((k) => k.id === kId)?.nama || kId;
      if (!inflowsByKas[kId]) {
        inflowsByKas[kId] = { kasName: kName, amount: 0 };
      }
      inflowsByKas[kId].amount += amt;
    };

    allocations.forEach((row) => {
      const amt = parseNum(row.amountInput);
      totalGross += amt;
      if (amt <= 0 || !row.kas_id) return;

      if (row.is_sentralisasi && sentralisasiKas && row.kas_id !== sentralisasiKas.id) {
        const { bpskAmount, huriaAmount } = splitSentralisasiAmount(amt, true);
        totalSentralisasiPool += bpskAmount;
        addInflow(row.kas_id, huriaAmount);
        addInflow(sentralisasiKas.id, bpskAmount);
      } else {
        addInflow(row.kas_id, amt);
      }
    });

    return {
      totalGross,
      totalSentralisasiPool,
      inflows: Object.entries(inflowsByKas).map(([id, data]) => ({ kasId: id, ...data })),
    };
  }, [allocations, kasList, sentralisasiKas]);

  if (!isOpen) return null;

  const rawAmount = parseNum(amountInput);
  const isReceiptMandatory = type === 'expense' && rawAmount >= settings.receipt_required_threshold;
  const selectedKas = kasList.find((k) => k.id === kasId);
  const singleSplit = splitSentralisasiAmount(rawAmount, type === 'income' ? isSentralisasi : false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    const res = await uploadReceiptFile(file);
    if (res.error) {
      setError(`Gagal mengunggah nota: ${res.error.message}`);
    } else if (res.url) {
      setAttachmentUrl(res.url);
    }
    setUploading(false);
  };

  const handleAddAllocationRow = () => {
    const defaultRowKas = (selectableKas.find((k) => k.id !== 'kas-9') || selectableKas[0])?.id || '';
    setAllocations((prev) => [
      ...prev,
      {
        rowId: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kas_id: defaultRowKas,
        sub_description: '',
        amountInput: '',
        is_sentralisasi: inferDefaultSentralisasiForKas(defaultRowKas),
        exclusion_type: inferExclusionForKas(defaultRowKas),
      },
    ]);
  };

  const handleApplyUcapanSyukurTemplate = () => {
    const templateCandidates: Array<{
      kasId: string;
      subDesc: string;
      amount: string;
      isSentralisasi: boolean;
      exType: SentralisasiExclusionType | null;
    }> = [
      { kasId: 'kas-1', subDesc: 'Ke Kas Huria', amount: '200000', isSentralisasi: true, exType: null },
      { kasId: 'kas-7', subDesc: 'Ke Kas Pembangunan', amount: '100000', isSentralisasi: false, exType: 'pembangunan_lokal' },
      { kasId: 'kas-2', subDesc: 'Ke Kas Diakonia Sosial', amount: '100000', isSentralisasi: false, exType: 'sosial_duka' },
      { kasId: 'kas-8', subDesc: 'Ke Pendeta', amount: '100000', isSentralisasi: false, exType: 'transitoris' },
      { kasId: 'kas-8', subDesc: 'Ke Lingkungan', amount: '100000', isSentralisasi: false, exType: 'transitoris' },
    ];

    const availableRows: AllocationDraftRow[] = templateCandidates
      .filter((t) => canInputKas(t.kasId) && kasList.some((k) => k.id === t.kasId && k.is_active))
      .map((t, idx) => ({
        rowId: `tpl-${Date.now()}-${idx}`,
        kas_id: t.kasId,
        sub_description: t.subDesc,
        amountInput: t.amount,
        is_sentralisasi: t.isSentralisasi,
        exclusion_type: t.exType,
      }));

    if (availableRows.length > 0) {
      setAllocations(availableRows);
      const syukurCat =
        categories.find((c) => c.id === 'cat-in-syukur-keluarga' && c.is_active) ||
        categories.find((c) => c.id === 'cat-in-syukur-altar' && c.is_active);
      if (syukurCat) setCategoryId(syukurCat.id);
      if (!description.trim()) {
        setDescription('Ucapan Syukur Keluarga');
      }
    }
  };

  const handleSave = async (submitDirectly: boolean) => {
    setError('');

    if (!description.trim()) {
      setError('Uraian transaksi wajib diisi.');
      return;
    }

    if (!storageAccountId) {
      setError('Pilih tempat penyimpanan.');
      return;
    }

    if (type === 'income' && incomeMode === 'multi') {
      if (allocations.length === 0) {
        setError('Tambahkan minimal 1 baris rincian kas.');
        return;
      }

      for (let i = 0; i < allocations.length; i++) {
        const row = allocations[i];
        const amt = parseNum(row.amountInput);
        if (!row.kas_id) {
          setError(`Baris ke-${i + 1} belum memilih Kas Tujuan.`);
          return;
        }
        if (amt <= 0) {
          setError(`Nominal baris ke-${i + 1} harus lebih dari Rp 0.`);
          return;
        }
      }

      setIsSubmitting(true);
      const res = await addCompoundIncomeTransactions({
        tanggal,
        storage_account_id: storageAccountId,
        category_id: categoryId || null,
        description: description.trim(),
        receipt_no: receiptNo.trim() || undefined,
        attachment_url: attachmentUrl,
        status: submitDirectly ? 'submitted' : 'draft',
        allocations: allocations.map((r) => ({
          kas_id: r.kas_id,
          amount: parseNum(r.amountInput),
          is_sentralisasi: r.is_sentralisasi,
          sub_description: r.sub_description.trim() || undefined,
          exclusion_type: r.is_sentralisasi ? null : r.exclusion_type || inferExclusionForKas(r.kas_id),
        })),
      });
      setIsSubmitting(false);

      if (!res.success) {
        setError(res.error || 'Gagal menyimpan rincian penerimaan.');
      } else {
        onClose();
      }
      return;
    }

    if (rawAmount <= 0) {
      setError('Nominal harus lebih besar dari Rp 0.');
      return;
    }

    if (!kasId) {
      setError('Pilih Kas tujuan.');
      return;
    }

    if (isReceiptMandatory && !attachmentUrl) {
      setError(
        `Pengeluaran >= ${formatRupiah(settings.receipt_required_threshold)} wajib melampirkan foto nota.`
      );
      return;
    }

    const d = new Date(tanggal);
    if (isPeriodClosed(d.getFullYear(), d.getMonth() + 1, kasId)) {
      setError(`Periode ${d.getMonth() + 1}/${d.getFullYear()} untuk kas ini sudah ditutup.`);
      return;
    }

    setIsSubmitting(true);

    const useSentralisasi = type === 'income' ? isSentralisasi : false;
    const { bpskAmount, huriaAmount } = splitSentralisasiAmount(rawAmount, useSentralisasi);

    const result = await addTransaction({
      tanggal,
      kas_id: kasId,
      storage_account_id: storageAccountId,
      category_id: categoryId || null,
      type,
      amount: rawAmount,
      description: description.trim(),
      receipt_no: receiptNo.trim() || undefined,
      attachment_url: attachmentUrl,
      status: submitDirectly ? 'submitted' : 'draft',
      is_sentralisasi: type === 'income' ? useSentralisasi : false,
      bpsk_rate: type === 'income' ? (useSentralisasi ? 0.55 : 0) : undefined,
      huria_rate: type === 'income' ? (useSentralisasi ? 0.45 : 1.0) : undefined,
      bpsk_amount: type === 'income' ? bpskAmount : undefined,
      huria_amount: type === 'income' ? huriaAmount : undefined,
      sentralisasi_exclusion_type:
        type === 'income' && !useSentralisasi
          ? exclusionType || inferExclusionForKas(kasId)
          : null,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Gagal menyimpan transaksi.');
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className={`bg-white sm:rounded-2xl rounded-t-2xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 ${
          type === 'income' && incomeMode === 'multi' ? 'sm:max-w-2xl' : 'sm:max-w-lg'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-sm sm:text-base text-slate-900">Catat Transaksi</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setType('income')}
              className={`h-9 text-xs font-semibold rounded-lg transition-all ${
                type === 'income'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              + Pemasukan
            </button>
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`h-9 text-xs font-semibold rounded-lg transition-all ${
                type === 'expense'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              - Pengeluaran
            </button>
          </div>

          {/* Income Mode Switch */}
          {type === 'income' && (
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100/80 rounded-xl">
              <button
                type="button"
                onClick={() => setIncomeMode('single')}
                className={`h-9 px-2 rounded-lg text-xs font-semibold transition-all ${
                  incomeMode === 'single'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1 Pos Kas
              </button>
              <button
                type="button"
                onClick={() => setIncomeMode('multi')}
                className={`h-9 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  incomeMode === 'multi'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Multi Pos / Ucapan Syukur</span>
              </button>
            </div>
          )}

          {/* Nominal (Single mode) */}
          {(type === 'expense' || incomeMode === 'single') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nominal (Rp) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amountInput ? Number(amountInput.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : ''}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="0"
                  className="w-full h-11 pl-10 pr-3.5 text-base font-bold text-slate-900 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-mono tabular-nums"
                  autoFocus
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full h-10 text-xs px-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                No. Bukti (Opsional)
              </label>
              <input
                type="text"
                value={receiptNo}
                onChange={(e) => setReceiptNo(e.target.value)}
                placeholder="BKM-01 / KW-10"
                className="w-full h-10 text-xs px-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>

          {/* Kas Tujuan (Single mode) */}
          {(type === 'expense' || incomeMode === 'single') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {type === 'income' ? 'Kas Tujuan' : 'Kas Sumber'} <span className="text-rose-500">*</span>
              </label>
              <select
                value={kasId}
                onChange={(e) => handleKasChange(e.target.value)}
                className="w-full h-10 text-xs px-3 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                required
              >
                {selectableKas.length === 0 ? (
                  <option value="">Tidak ada akses kas</option>
                ) : (
                  selectableKas.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama} ({k.kode})
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tempat Simpan <span className="text-rose-500">*</span>
              </label>
              <select
                value={storageAccountId}
                onChange={(e) => setStorageAccountId(e.target.value)}
                className="w-full h-10 text-xs px-3 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                required
              >
                {storageAccounts
                  .filter((s) => s.is_active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama} ({s.tipe === 'cash' ? 'Tunai' : 'Bank'})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kategori <span className="text-rose-500">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full h-10 text-xs px-3 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                required
              >
                {categories
                  .filter((c) => c.tipe === type && c.is_active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nama}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* SENTRALISASI DETERMINATION AT TRANSACTION ENTRY (SINGLE INCOME) */}
          {type === 'income' && incomeMode === 'single' && (
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Status Sentralisasi Transaksi</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsSentralisasi(true)}
                  className={`py-2 px-3 rounded-lg border text-left transition-all ${
                    isSentralisasi
                      ? 'bg-white border-blue-600 text-blue-950 ring-1 ring-blue-600/30 font-semibold'
                      : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className="text-xs font-bold">Sentralisasi (45/55)</div>
                  <div className="text-[10px] text-slate-500">45% Kas · 55% BPSK</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSentralisasi(false);
                    setExclusionType(inferExclusionForKas(kasId));
                  }}
                  className={`py-2 px-3 rounded-lg border text-left transition-all ${
                    !isSentralisasi
                      ? 'bg-white border-emerald-600 text-emerald-950 ring-1 ring-emerald-600/30 font-semibold'
                      : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className="text-xs font-bold">Non-Sentralisasi (100%)</div>
                  <div className="text-[10px] text-slate-500">100% ke {selectedKas?.nama || 'Kas'}</div>
                </button>
              </div>

              {isSentralisasi ? (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-slate-200 text-[11px] tabular-nums">
                  <span className="text-slate-600">
                    {selectedKas?.nama || 'Kas'} (45%): <strong className="text-slate-900 font-mono">{formatRupiah(singleSplit.huriaAmount)}</strong>
                  </span>
                  <span className="text-blue-700">
                    Sentralisasi (55%): <strong className="font-mono">{formatRupiah(singleSplit.bpskAmount)}</strong>
                  </span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0.5">
                  <select
                    value={exclusionType}
                    onChange={(e) => setExclusionType(e.target.value as SentralisasiExclusionType)}
                    className="flex-1 h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px]"
                  >
                    <option value="pembangunan_lokal">Pembangunan Lokal</option>
                    <option value="sosial_duka">Diakonia Sosial / Duka</option>
                    <option value="transitoris">Transitoris / Titipan</option>
                    <option value="beasiswa">Beasiswa</option>
                    <option value="lainnya">Non-Sentralisasi Lainnya</option>
                  </select>
                  <span className="font-mono font-bold text-emerald-700 text-xs tabular-nums shrink-0">
                    100%: {formatRupiah(rawAmount)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* MULTI-POS INCOME (UCAPAN SYUKUR / RINCIAN) */}
          {type === 'income' && incomeMode === 'multi' && (
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800">Rincian Alokasi Kas</span>
                <button
                  type="button"
                  onClick={handleApplyUcapanSyukurTemplate}
                  className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-semibold flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Contoh Ucapan Syukur</span>
                </button>
              </div>

              <div className="space-y-2">
                {allocations.map((row, idx) => {
                  const rowAmt = parseNum(row.amountInput);
                  const rowSplit = splitSentralisasiAmount(rowAmt, row.is_sentralisasi);
                  const rowKasName = kasList.find((k) => k.id === row.kas_id)?.nama || 'Kas';

                  return (
                    <div
                      key={row.rowId}
                      className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-500">#{idx + 1}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setAllocations((prev) =>
                                prev.map((r) =>
                                  r.rowId === row.rowId ? { ...r, is_sentralisasi: !r.is_sentralisasi } : r
                                )
                              )
                            }
                            className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-colors ${
                              row.is_sentralisasi
                                ? 'bg-blue-50 border-blue-300 text-blue-800'
                                : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            }`}
                          >
                            {row.is_sentralisasi ? 'Sentralisasi (45/55)' : 'Non-Sentralisasi (100%)'}
                          </button>

                          {allocations.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setAllocations((prev) => prev.filter((r) => r.rowId !== row.rowId))
                              }
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded-md"
                              aria-label="Hapus baris"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <input
                          type="text"
                          value={row.sub_description}
                          onChange={(e) =>
                            setAllocations((prev) =>
                              prev.map((r) =>
                                r.rowId === row.rowId ? { ...r, sub_description: e.target.value } : r
                              )
                            )
                          }
                          placeholder="- Ke Kas Huria / Pendeta"
                          className="sm:col-span-4 h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
                        />

                        <select
                          value={row.kas_id}
                          onChange={(e) => {
                            const nextKas = e.target.value;
                            setAllocations((prev) =>
                              prev.map((r) =>
                                r.rowId === row.rowId
                                  ? {
                                      ...r,
                                      kas_id: nextKas,
                                      is_sentralisasi: inferDefaultSentralisasiForKas(nextKas),
                                      exclusion_type: inferExclusionForKas(nextKas),
                                    }
                                  : r
                              )
                            );
                          }}
                          className="sm:col-span-4 h-9 px-2 rounded-lg border border-slate-200 bg-white text-xs"
                        >
                          {selectableKas.map((k) => (
                            <option key={k.id} value={k.id}>
                              {k.nama}
                            </option>
                          ))}
                        </select>

                        <input
                          type="text"
                          inputMode="numeric"
                          value={
                            row.amountInput
                              ? Number(row.amountInput.replace(/[^0-9]/g, '')).toLocaleString('id-ID')
                              : ''
                          }
                          onChange={(e) =>
                            setAllocations((prev) =>
                              prev.map((r) =>
                                r.rowId === row.rowId ? { ...r, amountInput: e.target.value } : r
                              )
                            )
                          }
                          placeholder="Nominal"
                          className="sm:col-span-4 h-9 px-2.5 rounded-lg border border-slate-200 font-mono font-bold text-right text-xs tabular-nums"
                        />
                      </div>

                      {rowAmt > 0 && (
                        <div className="text-[10px] text-slate-600 flex items-center gap-1 tabular-nums">
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                          {row.is_sentralisasi && sentralisasiKas && row.kas_id !== sentralisasiKas.id ? (
                            <span>
                              {rowKasName}: <strong className="font-mono">{formatRupiah(rowSplit.huriaAmount)}</strong> · Sentralisasi:{' '}
                              <strong className="font-mono text-blue-700">{formatRupiah(rowSplit.bpskAmount)}</strong>
                            </span>
                          ) : (
                            <span>
                              {rowKasName} (100%): <strong className="font-mono text-emerald-700">{formatRupiah(rowAmt)}</strong>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleAddAllocationRow}
                className="w-full h-9 border border-dashed border-slate-300 text-slate-700 hover:bg-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Baris</span>
              </button>

              <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs tabular-nums">
                <span className="font-semibold text-slate-600">Total Penerimaan</span>
                <span className="font-mono font-bold text-sm text-slate-900">
                  {formatRupiah(multiSummary.totalGross)}
                </span>
              </div>
            </div>
          )}

          {/* Expense Procurement Compact Hint */}
          {type === 'expense' && rawAmount > settings.receipt_required_threshold && (
            (() => {
              const rule = getPpkuProcurementRule(rawAmount);
              return (
                <div className={`px-3 py-2 rounded-xl border text-[11px] font-medium ${rule.badgeClass}`}>
                  {rule.label} · {rule.pasalRef}
                </div>
              );
            })()
          )}

          {/* Uraian */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {type === 'income' && incomeMode === 'multi' ? 'Uraian Utama (mis. Ucapan Syukur Kel. ...)' : 'Uraian'}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={
                type === 'income' && incomeMode === 'multi'
                  ? 'Ucapan Syukur dari Kel. ...'
                  : 'Contoh: Pelean Ibadah IA / Pembayaran listrik gereja'
              }
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              required
            />
          </div>

          {/* Upload Nota */}
          <div className="p-2.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-slate-700">
              <Camera className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="font-medium">Foto Nota</span>
              {isReceiptMandatory && (
                <span className="text-[10px] text-rose-700 font-semibold">(Wajib)</span>
              )}
            </div>

            {attachmentUrl ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Terlampir
                </span>
                <button
                  type="button"
                  onClick={() => setAttachmentUrl(null)}
                  className="text-[11px] text-rose-600 hover:underline font-medium"
                >
                  Hapus
                </button>
              </div>
            ) : (
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50">
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>{uploading ? 'Mengunggah...' : 'Unggah'}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            )}
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-3.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Batal
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave(false)}
              className="h-10 px-3.5 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-xl transition-colors"
            >
              Simpan Draft
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave(true)}
              className="h-10 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
            >
              Ajukan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
