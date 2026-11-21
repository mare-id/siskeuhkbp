/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  Layers,
  Users,
  Camera,
  RotateCcw,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  createUploadNonce,
  prepareAndUploadReceiptToDrive,
} from '../../lib/receiptUpload';
import { formatDateIndo, formatNamaKeluarga, formatRupiah } from '../../lib/formatters';
import { splitSentralisasiAmount } from '../../lib/ppkuRules';
import {
  downloadTransactionExcelTemplate,
  parseTransactionExcelFile,
  ParsedExcelImportItem,
  ParseTransactionExcelResult,
} from '../../lib/transactionExcelTemplate';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const TransactionImportModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const {
    kasList,
    storageAccounts,
    categories,
    fiscalYears,
    lingkunganList,
    families,
    settings,
    openingSetup,
    getKasBalances,
    isKasOpeningLocked,
    isPeriodClosed,
    isYearLockedByLpj,
    addTransaction,
    addCompoundIncomeTransactions,
    createTransfer,
    saveFamily,
  } = useData();
  const { isAdmin, canTransfer, canInputKas } = useAuth();
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const [isDownloadingTpl, setIsDownloadingTpl] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [parseResult, setParseResult] = useState<ParseTransactionExcelResult | null>(null);
  const [saveNewFamiliesToMaster, setSaveNewFamiliesToMaster] = useState(true);
  const [importValidOnly, setImportValidOnly] = useState(true);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'error'>('all');
  const [uploadingRowKey, setUploadingRowKey] = useState<string | null>(null);
  const [rowUploadErrors, setRowUploadErrors] = useState<
    Record<string, { message: string; file: File; nonce: string; isPrepared: boolean }>
  >({});
  const [isExecutingImport, setIsExecutingImport] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [globalError, setGlobalError] = useState('');

  const selectableKas = useMemo(
    () => kasList.filter((k) => k.is_active && canInputKas(k.id)),
    [kasList, canInputKas]
  );

  useEffect(() => {
    if (isOpen) {
      setParseResult(null);
      setGlobalError('');
      setPreviewFilter('all');
      setRowUploadErrors({});
      setImportProgress(null);
      setIsExecutingImport(false);
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  const templateStats = useMemo(() => {
    const activeCats = categories.filter((c) => c.is_active).length;
    const activeStorages = storageAccounts.filter((s) => s.is_active).length;
    const activeLing = lingkunganList.filter((l) => l.is_active !== false).length;
    const activeFams = families.filter((f) => f.is_active !== false).length;
    return {
      kasCount: selectableKas.length,
      storageCount: activeStorages,
      categoryCount: activeCats,
      lingkunganCount: activeLing,
      familyCount: activeFams,
    };
  }, [selectableKas, storageAccounts, categories, lingkunganList, families]);

  const isItemInvalid = (item: ParsedExcelImportItem): boolean => {
    const missingReceipt =
      item.kind === 'single' &&
      Boolean(item.requires_receipt_upload) &&
      !item.attachment_url &&
      !item.drive_file_id;
    return item.errors.length > 0 || missingReceipt;
  };

  const liveCounts = useMemo(() => {
    if (!parseResult) {
      return { total: 0, valid: 0, error: 0, income: 0, expense: 0, transfer: 0, bpsk55: 0, newFamilies: 0 };
    }
    let valid = 0;
    let error = 0;
    let income = 0;
    let expense = 0;
    let transfer = 0;
    let bpsk55 = 0;
    const newFamSet = new Set<string>();

    parseResult.items.forEach((item) => {
      const bad = isItemInvalid(item);
      if (bad) error += 1;
      else valid += 1;

      if (item.kind === 'single') {
        if (item.is_new_family && item.family_name) newFamSet.add(item.family_name.toLowerCase());
        if (item.type === 'income') {
          income += item.amount;
          if (item.is_sentralisasi) bpsk55 += splitSentralisasiAmount(item.amount, true).bpskAmount;
        } else {
          expense += item.amount;
        }
      } else if (item.kind === 'multi_pos') {
        income += item.total_amount;
        bpsk55 += item.total_bpsk_55;
      } else {
        transfer += item.amount;
      }
    });

    return {
      total: parseResult.items.length,
      valid,
      error,
      income,
      expense,
      transfer,
      bpsk55,
      newFamilies: newFamSet.size,
    };
  }, [parseResult]);

  const displayedItems = useMemo(() => {
    if (!parseResult) return [];
    if (previewFilter === 'valid') return parseResult.items.filter((i) => !isItemInvalid(i));
    if (previewFilter === 'error') return parseResult.items.filter((i) => isItemInvalid(i));
    return parseResult.items;
  }, [parseResult, previewFilter]);

  if (!isOpen) return null;

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloadingTpl(true);
      setGlobalError('');
      await downloadTransactionExcelTemplate({
        kasList,
        selectableKas,
        storageAccounts,
        categories,
        fiscalYears,
        lingkunganList,
        families,
        settings,
        canTransfer: isAdmin || canTransfer,
      });
      toast.success('Template Excel transaksi dengan dropdown & kunci tanggal berhasil diunduh.');
    } catch (err) {
      console.error('Download template error:', err);
      setGlobalError('Gagal membuat file template Excel. Silakan coba lagi.');
    } finally {
      setIsDownloadingTpl(false);
    }
  };

  const processSelectedFile = async (file: File) => {
    setGlobalError('');
    setIsParsingFile(true);
    try {
      const result = await parseTransactionExcelFile(file, {
        kasList,
        storageAccounts,
        categories,
        lingkunganList,
        families,
        settings,
        openingSetup,
        kasBalances: getKasBalances(),
        canInputKas,
        canTransfer,
        isAdmin,
        isKasOpeningLocked,
        isPeriodClosed,
        isYearLockedByLpj,
      });

      if (result.items.length === 0) {
        setGlobalError(
          'Tidak ada baris data yang ditemukan pada sheet Transaksi_Kas maupun Transfer_Antar_Kas. Pastikan mengisi data mulai baris ke-4.'
        );
        setParseResult(null);
      } else {
        setParseResult(result);
        setPreviewFilter('all');
        if (bodyRef.current) bodyRef.current.scrollTop = 0;
      }
    } catch (err) {
      console.error('Parse transaction excel error:', err);
      setGlobalError('Gagal membaca file Excel. Pastikan menggunakan format .xlsx atau .xls dari template SIKU.');
    } finally {
      setIsParsingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processSelectedFile(file);
  };

  const handleAttachReceiptForRow = async (
    rowKey: string,
    file: File,
    nonce = createUploadNonce(),
    isPrepared = false
  ) => {
    const targetItem = parseResult?.items.find(
      (it): it is Extract<ParsedExcelImportItem, { kind: 'single' }> =>
        it.key === rowKey && it.kind === 'single'
    );
    if (!targetItem) return;

    setUploadingRowKey(rowKey);
    setRowUploadErrors((prev) => {
      if (!prev[rowKey]) return prev;
      const next = { ...prev };
      delete next[rowKey];
      return next;
    });

    const res = await prepareAndUploadReceiptToDrive({
      file,
      transactionId: targetItem.draft_id || `tx-imp-${Date.now()}`,
      tanggal: targetItem.tanggal,
      kasId: targetItem.kas_id,
      previousDriveFileId: targetItem.drive_file_id || null,
      uploadNonce: nonce,
      isAlreadyPrepared: isPrepared,
    });

    setUploadingRowKey(null);

    if (!res.success || !res.driveFileId) {
      const msg = res.error || 'Gagal mengunggah nota ke Google Drive.';
      setRowUploadErrors((prev) => ({
        ...prev,
        [rowKey]: {
          message: msg,
          file: res.preparedFile || file,
          nonce,
          isPrepared: Boolean(res.preparedFile),
        },
      }));
      toast.error(msg);
      return;
    }

    setParseResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) => {
          if (item.key === rowKey && item.kind === 'single') {
            return {
              ...item,
              drive_file_id: res.driveFileId,
              drive_file_name: res.fileName || file.name,
              drive_mime_type: res.mimeType || null,
              requires_receipt_upload: false,
              warnings: item.warnings.filter((w) => !w.includes('wajib melampirkan bukti nota')),
            };
          }
          return item;
        }),
      };
    });
    toast.success('Bukti nota berhasil disimpan privat ke Google Drive.');
  };

  const handleExecuteImport = async () => {
    if (!parseResult) return;

    const targetItems = importValidOnly
      ? parseResult.items.filter((i) => !isItemInvalid(i))
      : parseResult.items;

    if (targetItems.length === 0) {
      setGlobalError('Tidak ada baris valid yang siap diimpor. Perbaiki data terlebih dahulu.');
      return;
    }

    if (!importValidOnly && liveCounts.error > 0) {
      setGlobalError('Terdapat baris dengan error. Perbaiki di Excel atau aktifkan opsi "Impor baris yang valid saja".');
      return;
    }

    setGlobalError('');
    setIsExecutingImport(true);
    setImportProgress({ done: 0, total: targetItems.length });

    const createdFamilyIdMap = new Map<string, string>();
    const batchBalanceDeltas: Record<string, number> = {};
    const addBatchDelta = (kasId: string, delta: number) => {
      if (!kasId || !delta) return;
      batchBalanceDeltas[kasId] = (batchBalanceDeltas[kasId] || 0) + delta;
    };
    const sentralisasiKas = kasList.find((k) => k.id === 'kas-9' || k.kode === 'KAS-SENTRAL');
    let successCount = 0;
    const failedItems: Array<{ item: ParsedExcelImportItem; error: string }> = [];

    for (let i = 0; i < targetItems.length; i++) {
      const item = targetItems[i];
      setImportProgress({ done: i, total: targetItems.length });

      try {
        if (item.kind === 'single') {
          let resolvedFamilyId = item.family_id || null;

          // Persist new Pelean Taon family if opted in and not saved earlier in this batch
          if (
            item.is_pelean_taon &&
            item.is_new_family &&
            saveNewFamiliesToMaster &&
            item.family_name &&
            item.lingkungan
          ) {
            const famKey = formatNamaKeluarga(item.family_name).toLowerCase();
            if (createdFamilyIdMap.has(famKey)) {
              resolvedFamilyId = createdFamilyIdMap.get(famKey)!;
            } else {
              const famSave = await saveFamily({
                nama_keluarga: formatNamaKeluarga(item.family_name),
                lingkungan: item.lingkungan,
                is_active: true,
              });
              if (famSave.success && famSave.id) {
                resolvedFamilyId = famSave.id;
                createdFamilyIdMap.set(famKey, famSave.id);
              }
            }
          }

          const { bpskAmount, huriaAmount } = splitSentralisasiAmount(
            item.amount,
            item.type === 'income' ? item.is_sentralisasi : false
          );

          const res = await addTransaction(
            {
              id: item.draft_id,
              tanggal: item.tanggal,
              tanggal_warta: item.tanggal_warta,
              kas_id: item.kas_id,
              storage_account_id: item.storage_account_id,
              category_id: item.category_id,
              type: item.type,
              amount: item.amount,
              description: item.description,
              receipt_no: item.receipt_no,
              attachment_url: item.attachment_url,
              drive_file_id: item.drive_file_id || null,
              drive_file_name: item.drive_file_name || null,
              drive_mime_type: item.drive_mime_type || null,
              status: item.status,
              is_sentralisasi: item.type === 'income' ? item.is_sentralisasi : false,
              bpsk_rate: item.type === 'income' ? (item.is_sentralisasi ? 0.55 : 0) : undefined,
              huria_rate: item.type === 'income' ? (item.is_sentralisasi ? 0.45 : 1.0) : undefined,
              bpsk_amount: item.type === 'income' ? bpskAmount : undefined,
              huria_amount: item.type === 'income' ? huriaAmount : undefined,
              sentralisasi_exclusion_type:
                item.type === 'income' && !item.is_sentralisasi ? item.sentralisasi_exclusion_type : null,
              pelean_taon_year: item.is_pelean_taon ? item.pelean_taon_year : null,
              family_id: item.is_pelean_taon ? resolvedFamilyId : null,
              family_name: item.is_pelean_taon ? item.family_name : null,
              lingkungan: item.is_pelean_taon ? item.lingkungan : null,
            },
            { batchBalanceDeltas }
          );

          if (!res.success) {
            failedItems.push({ item, error: res.error || 'Gagal menyimpan transaksi.' });
          } else {
            successCount += 1;
            if (item.type === 'income') {
              if (item.is_sentralisasi && sentralisasiKas && item.kas_id !== sentralisasiKas.id) {
                addBatchDelta(item.kas_id, huriaAmount);
                addBatchDelta(sentralisasiKas.id, bpskAmount);
              } else {
                addBatchDelta(item.kas_id, item.amount);
              }
            } else if (item.type === 'expense') {
              addBatchDelta(item.kas_id, -item.amount);
            }
          }
        } else if (item.kind === 'multi_pos') {
          const res = await addCompoundIncomeTransactions({
            tanggal: item.tanggal,
            tanggal_warta: item.tanggal_warta,
            storage_account_id: item.storage_account_id,
            category_id: item.category_id,
            description: item.description,
            receipt_no: item.receipt_no,
            attachment_url: item.attachment_url,
            status: item.status,
            allocations: item.allocations.map((a) => ({
              kas_id: a.kas_id,
              amount: a.amount,
              is_sentralisasi: a.is_sentralisasi,
              sub_description: a.sub_description,
              exclusion_type: a.exclusion_type,
            })),
          });

          if (!res.success) {
            failedItems.push({ item, error: res.error || 'Gagal menyimpan Multi Pos.' });
          } else {
            successCount += 1;
            item.allocations.forEach((a) => {
              if (a.is_sentralisasi && sentralisasiKas && a.kas_id !== sentralisasiKas.id) {
                const { bpskAmount, huriaAmount } = splitSentralisasiAmount(a.amount, true);
                addBatchDelta(a.kas_id, huriaAmount);
                addBatchDelta(sentralisasiKas.id, bpskAmount);
              } else {
                addBatchDelta(a.kas_id, a.amount);
              }
            });
          }
        } else if (item.kind === 'transfer') {
          const res = await createTransfer(
            {
              tanggal: item.tanggal,
              sourceKasId: item.sourceKasId,
              sourceStorageId: item.sourceStorageId,
              targetKasId: item.targetKasId,
              targetStorageId: item.targetStorageId,
              amount: item.amount,
              description: item.description,
              receiptNo: item.receiptNo,
              attachmentUrl: item.attachmentUrl,
            },
            { batchBalanceDeltas }
          );

          if (!res.success) {
            failedItems.push({ item, error: res.error || 'Gagal menyimpan transfer.' });
          } else {
            successCount += 1;
            if (item.sourceKasId !== item.targetKasId) {
              addBatchDelta(item.sourceKasId, -item.amount);
              addBatchDelta(item.targetKasId, item.amount);
            }
          }
        }
      } catch (err) {
        failedItems.push({
          item,
          error: err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan.',
        });
      }
    }

    setImportProgress({ done: targetItems.length, total: targetItems.length });
    setIsExecutingImport(false);

    if (failedItems.length === 0) {
      toast.success(
        `Berhasil mengimpor ${successCount} entri transaksi${
          createdFamilyIdMap.size > 0 ? ` (+${createdFamilyIdMap.size} keluarga baru ke Master)` : ''
        }.`
      );
      onClose();
    } else {
      // Keep only failed items visible in preview for inspection
      setParseResult((prev) =>
        prev
          ? {
              ...prev,
              items: failedItems.map((f) => ({
                ...f.item,
                errors: Array.from(new Set([...f.item.errors, f.error])),
              })),
            }
          : null
      );
      setGlobalError(
        `${successCount} entri berhasil disimpan, namun ${failedItems.length} entri gagal disimpan. Periksa pesan error pada daftar di bawah.`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className={`bg-white sm:rounded-2xl rounded-t-3xl w-full max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 mobile-sheet-enter ${
          parseResult ? 'sm:max-w-5xl' : 'sm:max-w-2xl'
        }`}
      >
        {/* Mobile Drag Handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0 bg-white">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 shrink-0 bg-white">
          <div className="min-w-0">
            <h3 className="font-bold text-base text-slate-900 truncate">
              Impor Transaksi via Excel
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
              {parseResult
                ? `${parseResult.fileName} · ${liveCounts.total} entri terdeteksi`
                : 'Unduh template resmi dengan dropdown aktif & penguncian tanggal YYYY-MM-DD'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isExecutingImport}
            className="p-2 sm:p-1.5 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div ref={bodyRef} className="px-4 sm:px-6 py-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          {globalError && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{globalError}</span>
            </div>
          )}

          {!parseResult ? (
            /* -------------------- STEP 1: TEMPLATE & UPLOAD -------------------- */
            <div className="space-y-4">
              {/* Download Template Panel */}
              <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
                      <h4 className="text-sm font-bold text-slate-900">
                        1. Unduh Template Excel Resmi (.xlsx)
                      </h4>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Template otomatis disiapkan sesuai hak akses &amp; master data gereja Anda saat ini, dilengkapi menu dropdown Excel dan validasi tanggal seragam <span className="font-mono font-semibold text-slate-800">YYYY-MM-DD</span>.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    disabled={isDownloadingTpl}
                    className="min-h-[44px] sm:min-h-[40px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-bold rounded-xl inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
                  >
                    {isDownloadingTpl ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>{isDownloadingTpl ? 'Menyiapkan...' : 'Unduh Template Excel'}</span>
                  </button>
                </div>

                {/* Metadata Specs (unboxed, clean typographic separators) */}
                <div className="pt-2 border-t border-emerald-200/70 text-[11px] text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{templateStats.kasCount} Kas diizinkan</span>
                  <span aria-hidden="true">·</span>
                  <span>{templateStats.storageCount} Tempat Simpan</span>
                  <span aria-hidden="true">·</span>
                  <span>{templateStats.categoryCount} Kategori</span>
                  <span aria-hidden="true">·</span>
                  <span>{templateStats.lingkunganCount} Lingkungan</span>
                  <span aria-hidden="true">·</span>
                  <span>{templateStats.familyCount} Keluarga Pelean Taon</span>
                </div>
              </div>

              {/* Feature Coverage Summary */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
                <h5 className="text-xs font-bold text-slate-800">
                  Cakupan Lengkap Fitur &amp; Dropdown di Template
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-600">
                  <div>
                    <span className="font-semibold text-slate-800 block">Sheet Transaksi_Kas</span>
                    <span>
                      Pemasukan 1 Pos, Pengeluaran, Multi Pos / Ucapan Syukur (ID Grup), serta Pelean Taon lengkap dengan Tanggal Warta &amp; Sentralisasi 45/55.
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800 block">Sheet Transfer_Antar_Kas</span>
                    <span>
                      Transfer antar rekening/tunai internal atau antar kas lengkap dengan kas pengirim, kas penerima, no. slip &amp; kunci tanggal.
                    </span>
                  </div>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`p-6 rounded-2xl border-2 border-dashed transition-colors text-center space-y-3 ${
                  isDragging
                    ? 'border-blue-600 bg-blue-50/60'
                    : 'border-slate-300 bg-white hover:border-slate-400'
                }`}
              >
                <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-700 mx-auto flex items-center justify-center">
                  {isParsingFile ? (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-bold text-slate-900">
                    2. Unggah File Excel yang Sudah Diisi
                  </div>
                  <p className="text-xs text-slate-500">
                    Seret file <span className="font-mono">.xlsx</span> ke area ini atau pilih file dari perangkat Anda
                  </p>
                </div>

                <div>
                  <label className="min-h-[44px] sm:min-h-[40px] px-5 py-2 bg-[#0B132B] hover:bg-slate-800 text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 cursor-pointer transition-colors">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>{isParsingFile ? 'Membaca File...' : 'Pilih File Excel (.xlsx)'}</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileInputChange}
                      className="hidden"
                      disabled={isParsingFile}
                    />
                  </label>
                </div>
              </div>
            </div>
          ) : (
            /* -------------------- STEP 2: PREVIEW & VALIDATION -------------------- */
            <div className="space-y-4">
              {/* Summary Metrics Strip */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                <div className="p-3">
                  <span className="text-[11px] text-slate-500 block">Siap Impor / Error</span>
                  <span className="text-sm font-bold font-mono tabular-nums text-slate-900">
                    <span className="text-emerald-700">{liveCounts.valid} Valid</span>
                    {' · '}
                    <span className={liveCounts.error > 0 ? 'text-rose-700' : 'text-slate-500'}>
                      {liveCounts.error} Error
                    </span>
                  </span>
                </div>
                <div className="p-3">
                  <span className="text-[11px] text-slate-500 block">Total Pemasukan</span>
                  <span className="text-sm font-bold font-mono tabular-nums text-emerald-700">
                    +{formatRupiah(liveCounts.income)}
                  </span>
                </div>
                <div className="p-3">
                  <span className="text-[11px] text-slate-500 block">Total Pengeluaran</span>
                  <span className="text-sm font-bold font-mono tabular-nums text-rose-700">
                    -{formatRupiah(liveCounts.expense)}
                  </span>
                </div>
                <div className="p-3">
                  <span className="text-[11px] text-slate-500 block">Transfer · BPSK 55%</span>
                  <span className="text-xs font-bold font-mono tabular-nums text-blue-800 block mt-0.5">
                    {formatRupiah(liveCounts.transfer)} · {formatRupiah(liveCounts.bpsk55)}
                  </span>
                </div>
              </div>

              {/* Controls Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 self-start">
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      previewFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    Semua ({liveCounts.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('valid')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      previewFilter === 'valid' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    Siap Impor ({liveCounts.valid})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('error')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      previewFilter === 'error' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    Error ({liveCounts.error})
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {liveCounts.newFamilies > 0 && (
                    <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={saveNewFamiliesToMaster}
                        onChange={(e) => setSaveNewFamiliesToMaster(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 w-4 h-4"
                      />
                      <span>
                        Simpan {liveCounts.newFamilies} keluarga baru ke Master
                      </span>
                    </label>
                  )}

                  {liveCounts.error > 0 && liveCounts.valid > 0 && (
                    <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={importValidOnly}
                        onChange={(e) => setImportValidOnly(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 w-4 h-4"
                      />
                      <span>Impor baris yang valid saja</span>
                    </label>
                  )}

                  <button
                    type="button"
                    onClick={() => setParseResult(null)}
                    disabled={isExecutingImport}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Ganti File</span>
                  </button>
                </div>
              </div>

              {/* Desktop Preview Table */}
              <div className="hidden md:block rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto max-h-[44vh]">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 whitespace-nowrap">Baris</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Tanggal &amp; Warta</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Mode / Jenis</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Kas &amp; Simpanan</th>
                        <th className="py-2.5 px-3">Uraian &amp; Rincian</th>
                        <th className="py-2.5 px-3 text-right whitespace-nowrap">Nominal</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Validasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedItems.map((item) => {
                        const bad = isItemInvalid(item);
                        const missingReceipt =
                          item.kind === 'single' &&
                          Boolean(item.requires_receipt_upload) &&
                          !item.attachment_url &&
                          !item.drive_file_id;
                        const rowErr = rowUploadErrors[item.key];

                        return (
                          <tr
                            key={item.key}
                            className={bad ? 'bg-rose-50/40' : 'hover:bg-slate-50/70'}
                          >
                            <td className="py-2.5 px-3 align-top font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {item.kind === 'multi_pos'
                                ? `#${item.rowNumbers.join(',')}`
                                : `#${item.rowNumber}`}
                              <div className="text-[10px] text-slate-400">{item.sheetName}</div>
                            </td>

                            <td className="py-2.5 px-3 align-top font-mono tabular-nums whitespace-nowrap">
                              <div className="font-semibold text-slate-900">
                                {item.tanggal ? formatDateIndo(item.tanggal) : '-'}
                              </div>
                              {item.kind !== 'transfer' && item.tanggal_warta && (
                                <div className="text-[11px] text-blue-700">
                                  Warta: {formatDateIndo(item.tanggal_warta)}
                                </div>
                              )}
                            </td>

                            <td className="py-2.5 px-3 align-top whitespace-nowrap">
                              {item.kind === 'transfer' ? (
                                <div className="font-semibold text-indigo-800 inline-flex items-center gap-1">
                                  <ArrowRightLeft className="w-3.5 h-3.5" />
                                  <span>Transfer</span>
                                </div>
                              ) : item.kind === 'multi_pos' ? (
                                <div>
                                  <div className="font-semibold text-emerald-800 inline-flex items-center gap-1">
                                    <Layers className="w-3.5 h-3.5" />
                                    <span>Multi Pos ({item.allocations.length})</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    Grup: {item.groupId} · {item.status === 'draft' ? 'Draft' : 'Ajukan'}
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div
                                    className={`font-semibold inline-flex items-center gap-1 ${
                                      item.type === 'income' ? 'text-emerald-700' : 'text-rose-700'
                                    }`}
                                  >
                                    {item.is_pelean_taon && <Users className="w-3.5 h-3.5" />}
                                    <span>
                                      {item.is_pelean_taon
                                        ? 'Pelean Taon'
                                        : item.type === 'income'
                                        ? 'Pemasukan'
                                        : 'Pengeluaran'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {item.category_name} · {item.status === 'draft' ? 'Draft' : 'Ajukan'}
                                  </div>
                                </div>
                              )}
                            </td>

                            <td className="py-2.5 px-3 align-top">
                              {item.kind === 'transfer' ? (
                                <div className="text-[11px]">
                                  <div className="font-semibold text-slate-900">
                                    {item.sourceKasName} → {item.targetKasName}
                                  </div>
                                  <div className="text-slate-500">
                                    {item.sourceStorageName} → {item.targetStorageName}
                                  </div>
                                </div>
                              ) : item.kind === 'multi_pos' ? (
                                <div className="text-[11px]">
                                  <div className="font-semibold text-slate-900">{item.storage_name}</div>
                                  <div className="text-slate-500">
                                    {item.allocations.map((a) => a.kas_name).join(', ')}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-[11px]">
                                  <div className="font-semibold text-slate-900">{item.kas_name}</div>
                                  <div className="text-slate-500">{item.storage_name}</div>
                                </div>
                              )}
                            </td>

                            <td className="py-2.5 px-3 align-top max-w-xs">
                              <div className="font-medium text-slate-900 line-clamp-2">{item.description || '-'}</div>
                              {item.kind === 'single' && item.is_pelean_taon && (
                                <div className="text-[11px] text-blue-700 mt-0.5">
                                  {item.pelean_taon_year} · {item.lingkungan} · {item.family_name}
                                </div>
                              )}
                              {item.kind === 'multi_pos' && (
                                <div className="text-[11px] text-slate-500 mt-0.5 space-y-0.5">
                                  {item.allocations.map((a, idx) => (
                                    <div key={idx}>
                                      - {a.sub_description || a.kas_name}:{' '}
                                      <span className="font-mono font-semibold">{formatRupiah(a.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>

                            <td className="py-2.5 px-3 align-top text-right font-mono font-bold tabular-nums whitespace-nowrap">
                              {item.kind === 'transfer' ? (
                                <span className="text-indigo-700">{formatRupiah(item.amount)}</span>
                              ) : item.kind === 'multi_pos' ? (
                                <div>
                                  <span className="text-emerald-700">+{formatRupiah(item.total_amount)}</span>
                                  {item.total_bpsk_55 > 0 && (
                                    <div className="text-[10px] font-normal text-blue-700">
                                      BPSK 55%: {formatRupiah(item.total_bpsk_55)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <span className={item.type === 'income' ? 'text-emerald-700' : 'text-rose-700'}>
                                    {item.type === 'income' ? '+' : '-'}
                                    {formatRupiah(item.amount)}
                                  </span>
                                  {item.type === 'income' && (
                                    <div className="text-[10px] font-normal text-slate-500">
                                      {item.is_sentralisasi ? 'Sentralisasi 45/55' : 'Non-Sentralisasi 100%'}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="py-2.5 px-3 align-top min-w-[180px]">
                              {!bad && item.warnings.length === 0 ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>Siap impor</span>
                                </span>
                              ) : (
                                <div className="space-y-1 text-[11px]">
                                  {item.errors.map((err, i) => (
                                    <div key={i} className="text-rose-700 flex items-start gap-1 font-medium">
                                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                      <span>{err}</span>
                                    </div>
                                  ))}
                                  {item.warnings.map((w, i) => (
                                    <div key={i} className="text-amber-700 flex items-start gap-1">
                                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                      <span>{w}</span>
                                    </div>
                                  ))}
                                  {missingReceipt && (
                                    <div className="space-y-1.5 mt-1">
                                      <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 text-[11px] font-semibold cursor-pointer">
                                        {uploadingRowKey === item.key ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <Camera className="w-3.5 h-3.5" />
                                        )}
                                        <span>
                                          {uploadingRowKey === item.key
                                            ? 'Mengunggah...'
                                            : 'Unggah Nota (Foto/PDF)'}
                                        </span>
                                        <input
                                          type="file"
                                          accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
                                          className="hidden"
                                          disabled={uploadingRowKey === item.key}
                                          onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            e.target.value = '';
                                            if (f) handleAttachReceiptForRow(item.key, f);
                                          }}
                                        />
                                      </label>
                                      {rowErr && (
                                        <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-1.5 space-y-1">
                                          <div>{rowErr.message}</div>
                                          <button
                                            type="button"
                                            disabled={uploadingRowKey === item.key}
                                            onClick={() =>
                                              handleAttachReceiptForRow(
                                                item.key,
                                                rowErr.file,
                                                rowErr.nonce,
                                                rowErr.isPrepared
                                              )
                                            }
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-rose-300 font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer"
                                          >
                                            <RefreshCw className="w-3 h-3" />
                                            <span>Coba lagi</span>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Preview Cards */}
              <div className="md:hidden space-y-2.5">
                {displayedItems.map((item) => {
                  const bad = isItemInvalid(item);
                  const missingReceipt =
                    item.kind === 'single' &&
                    Boolean(item.requires_receipt_upload) &&
                    !item.attachment_url &&
                    !item.drive_file_id;
                  const rowErr = rowUploadErrors[item.key];

                  return (
                    <div
                      key={item.key}
                      className={`p-3.5 rounded-2xl border space-y-2 text-xs ${
                        bad ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 font-mono">
                        <span>
                          {item.sheetName} · Baris{' '}
                          {item.kind === 'multi_pos' ? item.rowNumbers.join(',') : item.rowNumber}
                        </span>
                        <span>{item.tanggal ? formatDateIndo(item.tanggal) : '-'}</span>
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-slate-900">{item.description || '-'}</div>
                        <div className="font-mono font-bold tabular-nums shrink-0 text-right">
                          {item.kind === 'transfer' ? (
                            <span className="text-indigo-700">{formatRupiah(item.amount)}</span>
                          ) : item.kind === 'multi_pos' ? (
                            <span className="text-emerald-700">+{formatRupiah(item.total_amount)}</span>
                          ) : (
                            <span className={item.type === 'income' ? 'text-emerald-700' : 'text-rose-700'}>
                              {item.type === 'income' ? '+' : '-'}
                              {formatRupiah(item.amount)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500">
                        {item.kind === 'transfer'
                          ? `${item.sourceKasName} → ${item.targetKasName}`
                          : item.kind === 'multi_pos'
                          ? `Multi Pos (${item.groupId}) · ${item.allocations.length} pos`
                          : `${item.kas_name} · ${item.storage_name} · ${item.category_name}`}
                      </div>

                      {!bad && item.warnings.length === 0 ? (
                        <div className="text-[11px] font-semibold text-emerald-700 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Siap impor</span>
                        </div>
                      ) : (
                        <div className="space-y-1 text-[11px]">
                          {item.errors.map((err, i) => (
                            <div key={i} className="text-rose-700 font-medium">
                              • {err}
                            </div>
                          ))}
                          {item.warnings.map((w, i) => (
                            <div key={i} className="text-amber-700">
                              • {w}
                            </div>
                          ))}
                          {missingReceipt && (
                            <div className="space-y-1.5 mt-1">
                              <label className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl bg-white border border-rose-300 text-rose-700 text-xs font-semibold cursor-pointer">
                                {uploadingRowKey === item.key ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Camera className="w-3.5 h-3.5" />
                                )}
                                <span>
                                  {uploadingRowKey === item.key
                                    ? 'Mengunggah...'
                                    : 'Unggah Nota (Foto/PDF)'}
                                </span>
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
                                  className="hidden"
                                  disabled={uploadingRowKey === item.key}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    e.target.value = '';
                                    if (f) handleAttachReceiptForRow(item.key, f);
                                  }}
                                />
                              </label>
                              {rowErr && (
                                <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2 space-y-1">
                                  <div>{rowErr.message}</div>
                                  <button
                                    type="button"
                                    disabled={uploadingRowKey === item.key}
                                    onClick={() =>
                                      handleAttachReceiptForRow(
                                        item.key,
                                        rowErr.file,
                                        rowErr.nonce,
                                        rowErr.isPrepared
                                      )
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-rose-300 font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    <span>Coba lagi</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="px-4 sm:px-6 pt-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] sm:pb-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
          <div className="text-xs text-slate-500">
            {importProgress && (
              <span className="font-mono font-semibold text-blue-700">
                Menyimpan {importProgress.done} / {importProgress.total}...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isExecutingImport}
              className="min-h-[44px] sm:min-h-0 sm:h-10 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            {parseResult && (
              <button
                type="button"
                disabled={
                  isExecutingImport ||
                  liveCounts.valid === 0 ||
                  (!importValidOnly && liveCounts.error > 0)
                }
                onClick={handleExecuteImport}
                className="min-h-[44px] sm:min-h-0 sm:h-10 px-5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                {isExecutingImport && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {isExecutingImport
                    ? 'Mengimpor...'
                    : `Impor ${liveCounts.valid} Entri Transaksi`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
