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
  Info,
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
import { getPpkuProcurementRule, PPKU_BPSK_DEADLINE_DAYS, splitSentralisasiAmount } from '../../lib/ppkuRules';
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

  // Per-transaction Sentralisasi override (Mode: single income)
  const [isSentralisasiOverride, setIsSentralisasiOverride] = useState<boolean>(true);
  const [exclusionTypeOverride, setExclusionTypeOverride] = useState<SentralisasiExclusionType>('lainnya');

  // Compound Multi-Pos Income rows (Mode: multi income / Ucapan Syukur)
  const [allocations, setAllocations] = useState<AllocationDraftRow[]>([]);

  const selectableKas = useMemo(
    () => kasList.filter((k) => k.is_active && canInputKas(k.id)),
    [kasList, canInputKas]
  );

  const sentralisasiKas = useMemo(
    () => kasList.find((k) => k.id === 'kas-9' || k.kode === 'KAS-SENTRAL'),
    [kasList]
  );

  // Suggest default exclusion type based on target kas
  const inferExclusionForKas = (kId: string): SentralisasiExclusionType => {
    if (kId === 'kas-8') return 'transitoris';
    if (kId === 'kas-2') return 'sosial_duka';
    if (kId === 'kas-7') return 'pembangunan_lokal';
    return 'lainnya';
  };

  // Suggest default sentralisasi toggle when picking a kas in Multi-Pos mode
  const inferDefaultSentralisasiForMultiRow = (kId: string): boolean => {
    // Dalam rincian Ucapan Syukur: Kas Umum Huria dikenakan sentralisasi 55/45,
    // sedangkan Pembangunan/Sosial/Transitoris default 100% ke kas tujuan (tetap bisa diubah bendahara)
    if (kId === 'kas-2' || kId === 'kas-7' || kId === 'kas-8') return false;
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

      if (storageAccounts.length > 0) {
        const activeStor = storageAccounts.filter((s) => s.is_active);
        setStorageAccountId((activeStor[0] || storageAccounts[0]).id);
      }

      setAllocations([
        {
          rowId: `row-${Date.now()}-1`,
          kas_id: initialKas,
          sub_description: 'Ke Huria',
          amountInput: '',
          is_sentralisasi: inferDefaultSentralisasiForMultiRow(initialKas),
          exclusion_type: inferExclusionForKas(initialKas),
        },
      ]);
    }
  }, [isOpen, defaultKasId]);

  // Sync default category when type changes
  useEffect(() => {
    const validCategories = categories.filter((c) => c.tipe === type && c.is_active);
    if (validCategories.length > 0) {
      const firstCat = validCategories[0];
      setCategoryId(firstCat.id);
      if (type === 'income') {
        setIsSentralisasiOverride(firstCat.is_sentralisasi !== false);
        setExclusionTypeOverride(firstCat.sentralisasi_exclusion_type || 'lainnya');
      }
    } else {
      setCategoryId('');
    }
  }, [type, categories]);

  // Sync override & optional default_kas_id when user switches category
  const handleCategoryChange = (newCatId: string) => {
    setCategoryId(newCatId);
    const cat = categories.find((c) => c.id === newCatId);
    if (type === 'income' && cat) {
      const nextSent = cat.is_sentralisasi !== false;
      setIsSentralisasiOverride(nextSent);
      setExclusionTypeOverride(cat.sentralisasi_exclusion_type || inferExclusionForKas(cat.default_kas_id || kasId));
      if (!defaultKasId && cat.default_kas_id && canInputKas(cat.default_kas_id)) {
        setKasId(cat.default_kas_id);
      }
    }
  };

  const parseNum = (val: string) => parseFloat(val.replace(/[^0-9]/g, '')) || 0;

  // Computed live summary for multi-pos income mode (must be before early return to obey Rules of Hooks)
  const multiSummary = useMemo(() => {
    let totalGross = 0;
    let totalSentralisasiPool = 0;
    const inflowsByKas: Record<string, { kasName: string; amount: number; tag: string }> = {};

    const addInflow = (kId: string, amt: number, tag: string) => {
      if (amt <= 0 || !kId) return;
      const kName = kasList.find((k) => k.id === kId)?.nama || kId;
      if (!inflowsByKas[kId]) {
        inflowsByKas[kId] = { kasName: kName, amount: 0, tag };
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
        addInflow(row.kas_id, huriaAmount, '45% Lokal');
        addInflow(sentralisasiKas.id, bpskAmount, '55% Sentralisasi');
      } else {
        addInflow(row.kas_id, amt, row.is_sentralisasi ? 'Sentralisasi' : '100% Penuh');
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
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedKas = kasList.find((k) => k.id === kasId);

  const singleSplit = splitSentralisasiAmount(rawAmount, type === 'income' ? isSentralisasiOverride : false);
  const isOverriddenFromCategory =
    type === 'income' &&
    selectedCategory &&
    isSentralisasiOverride !== (selectedCategory.is_sentralisasi !== false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    const res = await uploadReceiptFile(file);
    if (res.error) {
      setError(`Gagal mengunggah foto nota: ${res.error.message}`);
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
        is_sentralisasi: inferDefaultSentralisasiForMultiRow(defaultRowKas),
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
      { kasId: 'kas-1', subDesc: 'Ke Huria (Objek Sentralisasi 55%/45%)', amount: '100000', isSentralisasi: true, exType: null },
      { kasId: 'kas-7', subDesc: 'Ke Pembangunan (Sumbangan Syukur Non-Sentralisasi)', amount: '100000', isSentralisasi: false, exType: 'pembangunan_lokal' },
      { kasId: 'kas-2', subDesc: 'Ke Sosial Huria (Diakonia Sosial)', amount: '100000', isSentralisasi: false, exType: 'sosial_duka' },
      { kasId: 'kas-8', subDesc: 'Ke Pendeta (Penerimaan Transitoris)', amount: '100000', isSentralisasi: false, exType: 'transitoris' },
      { kasId: 'kas-8', subDesc: 'Ke Lingkungan / Wijk (Penerimaan Transitoris)', amount: '100000', isSentralisasi: false, exType: 'transitoris' },
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
      // Select Pelean Hamauliateon / Syukur Keluarga if available
      const syukurCat =
        categories.find((c) => c.id === 'cat-in-syukur-keluarga' && c.is_active) ||
        categories.find((c) => c.id === 'cat-in-syukur-altar' && c.is_active);
      if (syukurCat) setCategoryId(syukurCat.id);
      if (!description.trim()) {
        setDescription('Ucapan Syukur Keluarga Jemaat');
      }
    }
  };

  const handleSave = async (submitDirectly: boolean) => {
    setError('');

    if (!description.trim()) {
      setError('Uraian transaksi wajib diisi secara jelas.');
      return;
    }

    if (!storageAccountId) {
      setError('Pilih Tempat Penyimpanan (Tunai/Bank).');
      return;
    }

    // Compound Multi-Pos Income Mode
    if (type === 'income' && incomeMode === 'multi') {
      if (allocations.length === 0) {
        setError('Tambahkan minimal 1 baris rincian alokasi kas.');
        return;
      }

      for (let i = 0; i < allocations.length; i++) {
        const row = allocations[i];
        const amt = parseNum(row.amountInput);
        if (!row.kas_id) {
          setError(`Baris rincian ke-${i + 1} belum memilih Kas Tujuan.`);
          return;
        }
        if (amt <= 0) {
          setError(`Nominal pada baris rincian ke-${i + 1} harus lebih dari Rp 0.`);
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

    // Standard Single-Pos Mode (Income or Expense)
    if (rawAmount <= 0) {
      setError('Nominal harus lebih besar dari Rp 0.');
      return;
    }

    if (!kasId) {
      setError('Pilih Kas yang dituju.');
      return;
    }

    if (isReceiptMandatory && !attachmentUrl) {
      setError(
        `Pengeluaran sebesar ${formatRupiah(rawAmount)} melebihi batas ${formatRupiah(settings.receipt_required_threshold)}, wajib menyertakan foto nota bukti.`
      );
      return;
    }

    const d = new Date(tanggal);
    if (isPeriodClosed(d.getFullYear(), d.getMonth() + 1, kasId)) {
      setError(`Bulan ${d.getMonth() + 1} tahun ${d.getFullYear()} untuk kas ini sudah ditutup bukunya.`);
      return;
    }

    setIsSubmitting(true);

    const useSentralisasi = type === 'income' ? isSentralisasiOverride : false;
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
          ? exclusionTypeOverride || inferExclusionForKas(kasId)
          : null,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Terjadi kesalahan saat menyimpan transaksi.');
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div
        className={`bg-white rounded-2xl w-full overflow-hidden shadow-2xl border border-slate-100 my-8 transition-all ${
          type === 'income' && incomeMode === 'multi' ? 'max-w-2xl' : 'max-w-xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div>
            <h3 className="font-semibold text-base text-slate-800">Catat Transaksi Keuangan</h3>
            <span className="text-xs text-slate-500">
              Pencatatan kas masuk, kas keluar, dan alokasi dinamis HKBP Ressort Hutaraja
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Type Toggle: Pemasukan / Pengeluaran */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setType('income')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                type === 'income'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              + Pemasukan (Kas Masuk)
            </button>
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                type === 'expense'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              - Pengeluaran (Kas Keluar)
            </button>
          </div>

          {/* Mode Selector for Income: Single Kas vs Multi-Pos / Ucapan Syukur */}
          {type === 'income' && (
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIncomeMode('single')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all text-left border ${
                    incomeMode === 'single'
                      ? 'bg-white border-blue-400 text-blue-950 shadow-2xs ring-1 ring-blue-300'
                      : 'bg-transparent border-transparent text-slate-600 hover:bg-white/60'
                  }`}
                >
                  <span className="block font-bold">1 Pos Kas (Fleksibel 55/45 atau 100%)</span>
                  <span className="text-[10px] text-slate-500 block">
                    Contoh: Pelean Minggu atau Pelean IB ke Pembangunan + Sentralisasi
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIncomeMode('multi')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all text-left border ${
                    incomeMode === 'multi'
                      ? 'bg-white border-emerald-500 text-emerald-950 shadow-2xs ring-1 ring-emerald-300'
                      : 'bg-transparent border-transparent text-slate-600 hover:bg-white/60'
                  }`}
                >
                  <span className="flex items-center gap-1 font-bold">
                    <Layers className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Rincian Banyak Kas / Ucapan Syukur</span>
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Pecah ke Huria, Pembangunan, Sosial, Pendeta/Lingkungan (Transitoris)
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Nominal Input (Single mode only) */}
          {(type === 'expense' || incomeMode === 'single') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nominal Transaksi (Rp) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amountInput ? Number(amountInput.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : ''}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="0"
                  className="w-full pl-11 pr-4 py-3 text-lg font-bold text-slate-800 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary font-mono tabular-nums"
                  autoFocus
                />
              </div>
              {rawAmount > 0 && (
                <span className="text-xs text-slate-500 mt-1 block">
                  Terbilang: <span className="font-medium text-slate-700">{formatRupiah(rawAmount)}</span>
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Tanggal */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal Transaksi <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary"
                required
              />
            </div>

            {/* Nomor Bukti */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nomor Bukti / Kuitansi (Opsional)
              </label>
              <input
                type="text"
                value={receiptNo}
                onChange={(e) => setReceiptNo(e.target.value)}
                placeholder="Contoh: BKM-01 / KW-10"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
            </div>
          </div>

          {/* Kas Selection (Hidden in multi mode because each line picks its Kas) */}
          {(type === 'expense' || incomeMode === 'single') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {type === 'income' ? 'Kas Tujuan Lokal (Penerima Porsi 45% atau 100%)' : 'Kas Sumber Dana'}{' '}
                <span className="text-rose-500">*</span>
              </label>
              <select
                value={kasId}
                onChange={(e) => setKasId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary bg-white"
                required
              >
                {selectableKas.length === 0 ? (
                  <option value="">Anda belum ditugaskan pada kas mana pun</option>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Tempat Penyimpanan */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tempat Penyimpanan (Rekening / Brankas) <span className="text-rose-500">*</span>
              </label>
              <select
                value={storageAccountId}
                onChange={(e) => setStorageAccountId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary bg-white"
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

            {/* Kategori */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {incomeMode === 'multi' && type === 'income' ? 'Kategori Utama Penerimaan' : 'Kategori'}{' '}
                <span className="text-rose-500">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary bg-white"
                required
              >
                {type === 'income' ? (
                  <>
                    <optgroup label="Objek Sentralisasi (Bawaan 55% Kas Sentralisasi / 45% Kas Tujuan)">
                      {categories
                        .filter((c) => c.tipe === 'income' && c.is_active && c.is_sentralisasi !== false)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nama} [55% Sentralisasi : 45% Lokal]
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Non-Sentralisasi (Bawaan 100% Kas Tujuan)">
                      {categories
                        .filter((c) => c.tipe === 'income' && c.is_active && c.is_sentralisasi === false)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nama} [100% Kas Tujuan]
                          </option>
                        ))}
                    </optgroup>
                  </>
                ) : (
                  categories
                    .filter((c) => c.tipe === 'expense' && c.is_active)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nama}
                      </option>
                    ))
                )}
              </select>
            </div>
          </div>

          {/* ================================================================= */}
          {/* MODE SINGLE INCOME: DYNAMIC SENTRALISASI TOGGLE + LIVE LEDGER SPLIT */}
          {/* ================================================================= */}
          {type === 'income' && incomeMode === 'single' && (
            <div
              className={`p-3.5 rounded-2xl border text-xs transition-all space-y-3 ${
                isSentralisasiOverride
                  ? 'bg-gradient-to-br from-indigo-50/90 via-blue-50/50 to-white border-blue-200/90 shadow-2xs'
                  : 'bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-white border-emerald-200/90 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      isSentralisasiOverride
                        ? 'bg-blue-700 text-white'
                        : 'bg-emerald-700 text-white'
                    }`}
                  >
                    {isSentralisasiOverride ? 'Sentralisasi: 55% / 45%' : 'Non-Sentralisasi: 100% Kas Tujuan'}
                  </span>
                  {isOverriddenFromCategory && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                      Disesuaikan pada transaksi ini
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium text-slate-500">
                  Pengaturan Dinamis Bendahara/Admin
                </span>
              </div>

              {/* Dynamic Per-Transaction Toggle Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsSentralisasiOverride(true)}
                  className={`p-2 rounded-xl border text-left transition-all ${
                    isSentralisasiOverride
                      ? 'bg-white border-blue-500 ring-1 ring-blue-400 text-blue-950 shadow-2xs'
                      : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className="font-bold text-[11px]">Kenakan Sentralisasi (55% / 45%)</div>
                  <div className="text-[10px] opacity-80">
                    55% masuk ke {sentralisasiKas?.nama || 'Kas Sentralisasi'}, 45% ke {selectedKas?.nama || 'Kas Tujuan'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSentralisasiOverride(false);
                    setExclusionTypeOverride(inferExclusionForKas(kasId));
                  }}
                  className={`p-2 rounded-xl border text-left transition-all ${
                    !isSentralisasiOverride
                      ? 'bg-white border-emerald-500 ring-1 ring-emerald-400 text-emerald-950 shadow-2xs'
                      : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className="font-bold text-[11px]">Bebas Sentralisasi (100% Utuh)</div>
                  <div className="text-[10px] opacity-80">
                    100% masuk penuh ke {selectedKas?.nama || 'Kas Tujuan'} tanpa potongan 55%
                  </div>
                </button>
              </div>

              {isSentralisasiOverride ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/95 p-2.5 rounded-xl border border-indigo-200 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-indigo-700 uppercase">45% Kas Tujuan Lokal</span>
                      </div>
                      <div className="text-base font-extrabold text-indigo-900 mt-0.5 font-mono">
                        {formatRupiah(singleSplit.huriaAmount)}
                      </div>
                      <div className="text-[10px] text-slate-600 font-medium truncate">
                        Masuk: {selectedKas?.nama || 'Kas Huria'}
                      </div>
                    </div>

                    <div className="bg-white/95 p-2.5 rounded-xl border border-blue-200 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-blue-700 uppercase">55% Kas Sentralisasi</span>
                      </div>
                      <div className="text-base font-extrabold text-blue-900 mt-0.5 font-mono">
                        {formatRupiah(singleSplit.bpskAmount)}
                      </div>
                      <div className="text-[10px] text-slate-600 font-medium truncate">
                        Otomatis ke: {sentralisasiKas?.nama || 'Kas Sentralisasi'}
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-blue-900 bg-blue-100/60 border border-blue-200 rounded-lg px-2.5 py-1.5 leading-relaxed">
                    Saat disimpan, sistem otomatis mencatat pembagian ke <strong>{selectedKas?.nama || 'Kas Tujuan'} (45%)</strong> dan{' '}
                    <strong>{sentralisasiKas?.nama || 'Kas Sentralisasi'} (55%)</strong>. Batas setor BPSK maks. H+{PPKU_BPSK_DEADLINE_DAYS}.
                  </p>
                </div>
              ) : (
                <div className="bg-white/95 p-3 rounded-xl border border-emerald-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-bold text-emerald-800 uppercase">
                        100% Masuk Penuh ke {selectedKas?.nama || 'Kas Tujuan'}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Tanpa pemotongan sentralisasi 55% — sesuai alokasi khusus/transitoris/kebijakan transaksi ini.
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-400 block">Nominal Masuk</span>
                      <span className="text-base font-extrabold text-emerald-900 font-mono">
                        {formatRupiah(rawAmount)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                      Klasifikasi Pos Non-Sentralisasi
                    </label>
                    <select
                      value={exclusionTypeOverride}
                      onChange={(e) => setExclusionTypeOverride(e.target.value as SentralisasiExclusionType)}
                      className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-[11px]"
                    >
                      <option value="pembangunan_lokal">Pembangunan Fisik Lokal (dari Sumbangan / Syukur)</option>
                      <option value="sosial_duka">Diakonia Sosial / Duka (Sosial Huria)</option>
                      <option value="transitoris">Penerimaan Transitoris (Pendeta, Lingkungan/Wijk, dll.)</option>
                      <option value="beasiswa">Beasiswa / Dana Belajar</option>
                      <option value="lainnya">Non-Sentralisasi Lainnya</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* MODE MULTI-POS INCOME: DYNAMIC ALLOCATION BUILDER (UCAPAN SYUKUR) */}
          {/* ================================================================= */}
          {type === 'income' && incomeMode === 'multi' && (
            <div className="p-3.5 rounded-2xl border border-emerald-200/90 bg-emerald-50/30 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Rincian Pembagian Pos Kas (Penerimaan Gabungan / Ucapan Syukur)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Tentukan peruntukan tiap baris beserta Kas Tujuan dan apakah baris tersebut dikenakan Sentralisasi 55%/45% atau 100% langsung.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleApplyUcapanSyukurTemplate}
                  className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 shrink-0 self-start sm:self-center shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Contoh Pola Ucapan Syukur</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {allocations.map((row, idx) => {
                  const rowAmt = parseNum(row.amountInput);
                  const rowSplit = splitSentralisasiAmount(rowAmt, row.is_sentralisasi);
                  const rowKasName = kasList.find((k) => k.id === row.kas_id)?.nama || 'Kas Tujuan';

                  return (
                    <div
                      key={row.rowId}
                      className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Pos Rincian #{idx + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setAllocations((prev) =>
                                prev.map((r) =>
                                  r.rowId === row.rowId ? { ...r, is_sentralisasi: !r.is_sentralisasi } : r
                                )
                              )
                            }
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                              row.is_sentralisasi
                                ? 'bg-blue-50 border-blue-300 text-blue-800'
                                : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            }`}
                          >
                            {row.is_sentralisasi
                              ? 'Objek Sentralisasi (55% Sentralisasi / 45% Lokal)'
                              : 'Non-Sentralisasi (100% Masuk Kas Tujuan)'}
                          </button>

                          {allocations.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setAllocations((prev) => prev.filter((r) => r.rowId !== row.rowId))
                              }
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded-md"
                              title="Hapus Baris"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                            Peruntukan Baris
                          </label>
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
                            placeholder="Misal: Ke Huria / Ke Pendeta / Wijk"
                            className="w-full p-2 rounded-lg border border-slate-200 text-xs"
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                            Kas Tujuan
                          </label>
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
                                        is_sentralisasi: inferDefaultSentralisasiForMultiRow(nextKas),
                                        exclusion_type: inferExclusionForKas(nextKas),
                                      }
                                    : r
                                )
                              );
                            }}
                            className="w-full p-2 rounded-lg border border-slate-200 bg-white text-xs"
                          >
                            {selectableKas.map((k) => (
                              <option key={k.id} value={k.id}>
                                {k.nama}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                            Nominal (Rp)
                          </label>
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
                            placeholder="0"
                            className="w-full p-2 rounded-lg border border-slate-200 font-mono font-bold text-right text-xs"
                          />
                        </div>
                      </div>

                      {rowAmt > 0 && (
                        <div className="text-[10px] text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 flex-wrap">
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                          {row.is_sentralisasi && sentralisasiKas && row.kas_id !== sentralisasiKas.id ? (
                            <span>
                              Otomatis dibagi: <strong className="text-indigo-800">{formatRupiah(rowSplit.huriaAmount)}</strong> ke{' '}
                              <strong>{rowKasName} (45%)</strong> +{' '}
                              <strong className="text-blue-800">{formatRupiah(rowSplit.bpskAmount)}</strong> ke{' '}
                              <strong>{sentralisasiKas.nama} (55%)</strong>
                            </span>
                          ) : (
                            <span>
                              Masuk utuh <strong className="text-emerald-800">{formatRupiah(rowAmt)}</strong> (100%) ke{' '}
                              <strong>{rowKasName}</strong>
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
                className="w-full py-2 border border-dashed border-emerald-400 text-emerald-800 hover:bg-emerald-50 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Baris Pos Kas</span>
              </button>

              {/* Consolidated Preview Box */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-700">Total Seluruh Rincian Penerimaan:</span>
                  <span className="font-mono font-black text-base text-slate-900">
                    {formatRupiah(multiSummary.totalGross)}
                  </span>
                </div>

                {multiSummary.inflows.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Ringkasan Saldo Masuk Otomatis per Kas:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {multiSummary.inflows.map((inf) => (
                        <div
                          key={inf.kasId}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px]"
                        >
                          <span className="font-medium text-slate-700 truncate pr-2">{inf.kasName}</span>
                          <span className="font-mono font-bold text-emerald-700 shrink-0">
                            +{formatRupiah(inf.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Live PPKU Pasal 21 Procurement & Pasal 18(3) Valid Receipt Compliance Card for Expenses */}
          {type === 'expense' && (
            (() => {
              const rule = getPpkuProcurementRule(rawAmount);
              return (
                <div className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${rule.badgeClass}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      <span>Kepatuhan Belanja PPKU 2023: {rule.label}</span>
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white/80 border border-current/20">
                      {rule.pasalRef}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-90">{rule.requirement}</p>
                  <p className="text-[10px] font-semibold opacity-80">
                    Pasal 18 ayat (3): Semua pembayaran wajib didukung kuitansi/nota yang sah dan diunggah pada lampiran bukti.
                  </p>
                </div>
              );
            })()
          )}

          {/* Uraian */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {type === 'income' && incomeMode === 'multi'
                ? 'Uraian Utama / Nama Pemberi Ucapan Syukur'
                : 'Uraian Keterangan Transaksi'}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={
                type === 'income' && incomeMode === 'multi'
                  ? 'Contoh: Ucapan Syukur Keluarga Si A (Total Rp 500.000)'
                  : 'Contoh: Pelean IB Ibadah Minggu atau Pembayaran token listrik gedung gereja...'
              }
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-primary/40 focus:border-primary"
              required
            />
          </div>

          {/* Upload Nota / Camera */}
          <div className="p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-slate-500" />
                Foto Nota / Kuitansi Fisik
                {isReceiptMandatory && (
                  <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-md font-semibold">
                    Wajib (≥ {formatRupiah(settings.receipt_required_threshold)})
                  </span>
                )}
              </span>
              {attachmentUrl && (
                <button
                  type="button"
                  onClick={() => setAttachmentUrl(null)}
                  className="text-xs text-rose-500 hover:text-rose-700"
                >
                  Hapus Foto
                </button>
              )}
            </div>

            {attachmentUrl ? (
              <div className="flex items-center gap-3">
                <img
                  src={attachmentUrl}
                  alt="Nota Preview"
                  className="w-14 h-14 object-cover rounded-lg border border-slate-200 shadow-2xs"
                />
                <div className="text-xs text-emerald-700 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  <span>Foto nota berhasil dilampirkan</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-xl hover:bg-slate-50 shadow-2xs transition-colors">
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span>Pilih Berkas Foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
                <span className="text-[11px] text-slate-400">Format JPG, PNG atau foto kamera langsung</span>
                {uploading && <span className="text-xs text-primary animate-pulse">Mengunggah...</span>}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors"
          >
            Batal
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave(false)}
              className="px-4 py-2 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-xl transition-colors"
            >
              Simpan Draft
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave(true)}
              className="px-5 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-dark rounded-xl transition-colors shadow-xs"
            >
              Ajukan (Submit)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
