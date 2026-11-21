/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRightLeft,
  X,
  AlertCircle,
  Info,
  Upload,
  CheckCircle,
  FileText,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import {
  createUploadNonce,
  prepareAndUploadReceiptToDrive,
} from '../../lib/receiptUpload';
import { formatRupiah, getTodayYmd, getYmdYear, getYmdMonth } from '../../lib/formatters';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultSourceKasId?: string;
}

export const TransferModal: React.FC<Props> = ({ isOpen, onClose, defaultSourceKasId }) => {
  const { kasList, storageAccounts, createTransfer, isPeriodClosed } = useData();
  const { canInputKas } = useAuth();

  const [tanggal, setTanggal] = useState<string>(getTodayYmd());
  const [sourceKasId, setSourceKasId] = useState<string>('');
  const [sourceStorageId, setSourceStorageId] = useState<string>('');
  const [targetKasId, setTargetKasId] = useState<string>('');
  const [targetStorageId, setTargetStorageId] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [receiptNo, setReceiptNo] = useState<string>('');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [draftTxId, setDraftTxId] = useState<string>('');
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  const [driveFileName, setDriveFileName] = useState<string | null>(null);
  const [driveMimeType, setDriveMimeType] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [receiptIsPdf, setReceiptIsPdf] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>('');
  const [failedUploadState, setFailedUploadState] = useState<{
    file: File;
    nonce: string;
    isPrepared: boolean;
  } | null>(null);
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    previewUrlRef.current = localPreviewUrl;
  }, [localPreviewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const availableSourceKas = kasList.filter((k) => k.is_active && canInputKas(k.id));

  useEffect(() => {
    if (isOpen) {
      setDraftTxId(`tf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);
      setError('');
      setAmountInput('');
      setDescription('');
      setReceiptNo('');
      setAttachmentUrl(null);
      setDriveFileId(null);
      setDriveFileName(null);
      setDriveMimeType(null);
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      setLocalPreviewUrl(null);
      setReceiptIsPdf(false);
      setUploadError('');
      setFailedUploadState(null);
      setTanggal(getTodayYmd());

      if (defaultSourceKasId && canInputKas(defaultSourceKasId)) {
        setSourceKasId(defaultSourceKasId);
        setTargetKasId(defaultSourceKasId);
      } else if (availableSourceKas.length > 0) {
        setSourceKasId(availableSourceKas[0].id);
        setTargetKasId(availableSourceKas[0].id);
      }

      if (storageAccounts.length >= 2) {
        setSourceStorageId(storageAccounts[0].id);
        setTargetStorageId(storageAccounts[1].id);
      } else if (storageAccounts.length === 1) {
        setSourceStorageId(storageAccounts[0].id);
        setTargetStorageId(storageAccounts[0].id);
      }
    }
  }, [isOpen, defaultSourceKasId]);

  if (!isOpen) return null;

  const rawAmount = parseFloat(amountInput.replace(/[^0-9]/g, '')) || 0;
  const isSameKas = sourceKasId === targetKasId;
  const hasAttachedReceipt = Boolean(driveFileId || attachmentUrl);

  const runReceiptUpload = async (file: File, nonce: string, isPrepared = false) => {
    setUploading(true);
    setError('');
    setUploadError('');

    const res = await prepareAndUploadReceiptToDrive({
      file,
      transactionId: draftTxId || `tf-${Date.now()}`,
      tanggal: tanggal || getTodayYmd(),
      kasId: sourceKasId || availableSourceKas[0]?.id,
      previousDriveFileId: driveFileId,
      uploadNonce: nonce,
      isAlreadyPrepared: isPrepared,
    });

    if (!res.success || !res.driveFileId) {
      const errMsg = res.error || 'Gagal mengunggah slip transfer ke Google Drive. Silakan coba lagi.';
      setUploadError(errMsg);
      setFailedUploadState({
        file: res.preparedFile || file,
        nonce,
        isPrepared: Boolean(res.preparedFile),
      });
    } else {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      setDriveFileId(res.driveFileId);
      setDriveFileName(res.fileName || file.name);
      setDriveMimeType(res.mimeType || null);
      setReceiptIsPdf(Boolean(res.isPdf));
      setLocalPreviewUrl(res.previewObjectUrl || null);
      setUploadError('');
      setFailedUploadState(null);
    }
    setUploading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await runReceiptUpload(file, createUploadNonce(), false);
  };

  const handleRetryReceiptUpload = async () => {
    if (!failedUploadState || uploading) return;
    await runReceiptUpload(
      failedUploadState.file,
      failedUploadState.nonce,
      failedUploadState.isPrepared
    );
  };

  const handleRemoveReceipt = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    setAttachmentUrl(null);
    setDriveFileId(null);
    setDriveFileName(null);
    setDriveMimeType(null);
    setLocalPreviewUrl(null);
    setReceiptIsPdf(false);
    setUploadError('');
    setFailedUploadState(null);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (rawAmount <= 0) {
      setError('Nominal transfer harus lebih besar dari Rp 0.');
      return;
    }

    if (!description.trim()) {
      setError('Uraian transfer wajib diisi.');
      return;
    }

    if (isSameKas && sourceStorageId === targetStorageId) {
      setError('Tempat penyimpanan asal dan tujuan tidak boleh sama jika kasnya sama.');
      return;
    }

    const txYr = getYmdYear(tanggal);
    const txMo = getYmdMonth(tanggal);
    if (isPeriodClosed(txYr, txMo, sourceKasId)) {
      setError(`Periode ${txMo}/${txYr} pada kas pengirim sudah ditutup.`);
      return;
    }
    if (!isSameKas && isPeriodClosed(txYr, txMo, targetKasId)) {
      setError(`Periode ${txMo}/${txYr} pada kas penerima sudah ditutup.`);
      return;
    }

    setIsSubmitting(true);

    const result = await createTransfer({
      tanggal,
      sourceKasId,
      sourceStorageId,
      targetKasId,
      targetStorageId,
      amount: rawAmount,
      description: description.trim(),
      receiptNo: receiptNo.trim() || undefined,
      attachmentUrl: attachmentUrl || undefined,
      driveFileId,
      driveFileName,
      driveMimeType,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Gagal mengajukan transfer.');
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-xl w-full max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl border border-slate-100 mobile-sheet-enter">
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0 bg-indigo-50/40">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-indigo-100 bg-indigo-50/40 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ArrowRightLeft className="w-5 h-5 text-indigo-600 shrink-0" />
            <div className="min-w-0">
              <h3 className="font-semibold text-sm sm:text-base text-slate-800 truncate">Transfer Dana Antar Kas / Rekening</h3>
              <span className="text-[11px] sm:text-xs text-slate-500 block truncate">Mutasi atomik saldo (tidak mempengaruhi laporan pendapatan/beban)</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 sm:p-1.5 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors shrink-0"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleTransfer} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Workflow Info Box */}
          <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              {isSameKas ? (
                <p>
                  <strong>Transfer Internal Kas:</strong> Memindahkan dana antar rekening dalam kas yang sama (contoh: setor tunai ke bank).
                  Cukup disetujui oleh Ketua Kas ini.
                </p>
              ) : (
                <p>
                  <strong>Transfer Antar Kas Berbeda:</strong> Memerlukan persetujuan 2 pihak:
                  disetujui oleh Ketua Kas Pengirim, lalu dikonfirmasi penerimaannya oleh Ketua Kas Penerima.
                </p>
              )}
            </div>
          </div>

          {/* Nominal */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nominal Transfer (Rp) <span className="text-rose-500">*</span>
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
                className="w-full pl-11 pr-4 py-3 text-lg font-bold text-slate-800 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-300 font-mono tabular-nums"
                required
              />
            </div>
            {rawAmount > 0 && (
              <span className="text-xs text-slate-500 mt-1 block">
                Terbilang: <span className="font-medium text-slate-700">{formatRupiah(rawAmount)}</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Transfer</label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor Referensi / Slip</label>
              <input
                type="text"
                value={receiptNo}
                onChange={(e) => setReceiptNo(e.target.value)}
                placeholder="Contoh: SLIP-BRI-001"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>

          {/* Source Box */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-700 block">SUMBER DANA (PENGIRIM)</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">Kas Pengirim</label>
                <select
                  value={sourceKasId}
                  onChange={(e) => setSourceKasId(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                  required
                >
                  {availableSourceKas.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">Tempat Penyimpanan Asal</label>
                <select
                  value={sourceStorageId}
                  onChange={(e) => setSourceStorageId(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                  required
                >
                  {storageAccounts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Destination Box */}
          <div className="p-3 rounded-xl bg-indigo-50/30 border border-indigo-200/60 space-y-2">
            <span className="text-xs font-bold text-indigo-900 block">TUJUAN DANA (PENERIMA)</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">Kas Penerima</label>
                <select
                  value={targetKasId}
                  onChange={(e) => setTargetKasId(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                  required
                >
                  {kasList
                    .filter((k) => k.is_active)
                    .map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.nama}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">Tempat Penyimpanan Tujuan</label>
                <select
                  value={targetStorageId}
                  onChange={(e) => setTargetStorageId(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                  required
                >
                  {storageAccounts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Uraian */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Uraian / Tujuan Transfer <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Contoh: Setoran tunai pelean minggu ke rekening Bank BRI, atau Bantuan subsidi dari Kas Umum ke Kas Diakonia..."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-300"
              required
            />
          </div>

          {/* Optional Slip Photo */}
          <div className="p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <span className="text-xs font-semibold text-slate-700 block">Foto Slip Setoran / Bukti Transfer</span>
                <span className="text-[10px] text-slate-500">JPG, PNG, atau PDF · Maks. 4 MB</span>
              </div>
              {hasAttachedReceipt && (
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer text-xs text-blue-600 hover:underline font-semibold">
                    <span>{uploading ? 'Mengunggah...' : 'Ganti'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleRemoveReceipt}
                    disabled={uploading}
                    className="text-xs text-rose-500 hover:text-rose-700 font-semibold"
                  >
                    Hapus
                  </button>
                </div>
              )}
            </div>

            {hasAttachedReceipt ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>
                    {receiptIsPdf
                      ? `Dokumen PDF tersimpan (${driveFileName || 'slip.pdf'})`
                      : 'Foto slip transfer tersimpan privat di Google Drive'}
                  </span>
                </div>
                {receiptIsPdf ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-700">
                    <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="truncate font-medium">{driveFileName || 'Slip_Transfer.pdf'}</span>
                  </div>
                ) : (localPreviewUrl || attachmentUrl) ? (
                  <div className="rounded-lg overflow-hidden border border-slate-200 bg-white max-h-32 flex items-center justify-center">
                    <img
                      src={localPreviewUrl || attachmentUrl || ''}
                      alt="Preview Slip Transfer"
                      className="max-h-32 w-auto object-contain"
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-xl hover:bg-slate-50 shadow-2xs">
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span>{uploading ? 'Mengunggah ke Drive...' : 'Unggah Slip (Foto / PDF)'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            )}

            {uploadError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
                {failedUploadState && (
                  <button
                    type="button"
                    onClick={handleRetryReceiptUpload}
                    disabled={uploading}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 font-semibold text-[11px] shrink-0 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Coba lagi</span>
                  </button>
                )}
              </div>
            )}
          </div>

          </div>
          {/* Sticky Safe-Area Submit buttons */}
          <div className="px-4 sm:px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 min-h-[44px] sm:min-h-0 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || uploading}
              className="px-5 py-2 min-h-[44px] sm:min-h-0 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-xl transition-colors shadow-xs"
            >
              {isSubmitting ? 'Mengajukan...' : 'Ajukan Transfer Dana'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
