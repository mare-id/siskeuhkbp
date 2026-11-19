/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  X,
  Paperclip,
  FileEdit,
  Trash2,
  Send,
  RotateCcw,
  Calendar,
  Wallet,
  Building2,
  Tag,
  ShieldCheck,
  AlertTriangle,
  ReceiptText,
} from 'lucide-react';
import { Transaction } from '../../types/database';
import { formatDateIndo, formatRupiah } from '../../lib/formatters';

interface Props {
  isOpen: boolean;
  transaction: Transaction | null;
  kasName?: string;
  storageName?: string;
  categoryName?: string;
  onClose: () => void;
  onPreviewAttachment?: (url: string) => void;
  onEdit?: (tx: Transaction) => void;
  onDelete?: (tx: Transaction) => void;
  onSubmitDraft?: (txId: string) => void;
  onRecallDraft?: (tx: Transaction) => void;
  onReversal?: (tx: Transaction) => void;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  approved: { label: 'Disetujui', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  submitted: { label: 'Diajukan', cls: 'bg-blue-50 text-blue-800 border-blue-200' },
  draft: { label: 'Draf', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  rejected: { label: 'Ditolak', cls: 'bg-rose-50 text-rose-800 border-rose-200' },
};

const TYPE_LABEL: Record<string, string> = {
  income: 'Pemasukan',
  expense: 'Pengeluaran',
  transfer_in: 'Transfer Masuk',
  transfer_out: 'Transfer Keluar',
};

export const MobileTransactionDetailModal: React.FC<Props> = ({
  isOpen,
  transaction,
  kasName,
  storageName,
  categoryName,
  onClose,
  onPreviewAttachment,
  onEdit,
  onDelete,
  onSubmitDraft,
  onRecallDraft,
  onReversal,
}) => {
  if (!isOpen || !transaction) return null;

  const isInc = transaction.type === 'income' || transaction.type === 'transfer_in';
  const statusInfo = STATUS_META[transaction.status] || {
    label: transaction.status,
    cls: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const hasActions = Boolean(
    onEdit || onDelete || onSubmitDraft || onRecallDraft || onReversal
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="mobile-sheet-enter bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle (Mobile) */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ReceiptText className="w-4 h-4 text-blue-700 shrink-0" />
            <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate">
              Rincian Transaksi
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            aria-label="Tutup rincian"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Amount Hero */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {TYPE_LABEL[transaction.type] || transaction.type}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${statusInfo.cls}`}>
                {statusInfo.label}
              </span>
            </div>
            <div
              className={`text-2xl font-extrabold font-mono tabular-nums break-words ${
                isInc ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {isInc ? '+' : '-'}
              {formatRupiah(transaction.amount)}
            </div>
            <p className="text-sm font-semibold text-slate-900 leading-snug pt-1">
              {transaction.description}
            </p>
          </div>

          {/* Metadata rows */}
          <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 bg-white">
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-slate-500 inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Tanggal Transaksi
              </span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums text-right">
                {formatDateIndo(transaction.tanggal)}
              </span>
            </div>

            {transaction.tanggal_warta && (
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-slate-500 inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  Tanggal Warta
                </span>
                <span className="font-mono font-semibold text-blue-800 tabular-nums text-right">
                  {formatDateIndo(transaction.tanggal_warta)}
                </span>
              </div>
            )}

            {(transaction.family_name || transaction.lingkungan) && (
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-slate-500">Keluarga / Lingkungan</span>
                <span className="font-semibold text-emerald-800 text-right">
                  {transaction.family_name || '-'}
                  {transaction.lingkungan ? ` (${transaction.lingkungan})` : ''}
                  {transaction.pelean_taon_year ? ` · T.A. ${transaction.pelean_taon_year}` : ''}
                </span>
              </div>
            )}

            {transaction.receipt_no && (
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-slate-500">Nomor Bukti</span>
                <span className="font-mono font-semibold text-slate-900 text-right">
                  {transaction.receipt_no}
                </span>
              </div>
            )}

            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-slate-500 inline-flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-slate-400" />
                Buku Kas
              </span>
              <span className="font-semibold text-slate-900 text-right">
                {kasName || transaction.kas_id}
              </span>
            </div>

            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-slate-500 inline-flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                Tempat Simpan
              </span>
              <span className="font-semibold text-slate-900 text-right">
                {storageName || transaction.storage_account_id}
              </span>
            </div>

            {categoryName && (
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-slate-500 inline-flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  Kategori
                </span>
                <span className="font-semibold text-slate-900 text-right">{categoryName}</span>
              </div>
            )}

            {transaction.type === 'income' && (
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-slate-500">Alokasi PPKU</span>
                <span className="font-semibold text-blue-800 text-right font-mono tabular-nums">
                  {transaction.is_sentralisasi === false || transaction.sentralisasi_role === 'non_sentralisasi'
                    ? '100% Non-Sentralisasi'
                    : transaction.sentralisasi_role === 'bpsk_share'
                    ? '55% Sentralisasi (BPSK)'
                    : transaction.sentralisasi_role === 'huria_share'
                    ? '45% Bagian Lokal'
                    : `BPSK ${formatRupiah(transaction.bpsk_amount ?? Math.round(transaction.amount * 0.55))}`}
                </span>
              </div>
            )}

            {transaction.audit_status && (
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-slate-500 inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  Status Audit
                </span>
                <span
                  className={`font-semibold text-right ${
                    transaction.audit_status === 'verified'
                      ? 'text-emerald-700'
                      : transaction.audit_status === 'flagged'
                      ? 'text-rose-700'
                      : 'text-slate-600'
                  }`}
                >
                  {transaction.audit_status === 'verified'
                    ? 'Lolos Uji Audit'
                    : transaction.audit_status === 'flagged'
                    ? 'Ada Temuan Audit'
                    : 'Belum Diperiksa'}
                </span>
              </div>
            )}
          </div>

          {transaction.reject_note && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Alasan Penolakan:</span>
                <p className="mt-0.5 leading-relaxed">{transaction.reject_note}</p>
              </div>
            </div>
          )}

          {transaction.audit_note && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
              <span className="font-bold block">Catatan Badan Audit:</span>
              <p className="mt-0.5 leading-relaxed">{transaction.audit_note}</p>
            </div>
          )}

          {transaction.attachment_url && onPreviewAttachment && (
            <button
              type="button"
              onClick={() => {
                const url = transaction.attachment_url!;
                onClose();
                onPreviewAttachment(url);
              }}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Paperclip className="w-4 h-4" />
              <span>Lihat Lampiran Nota / Kuitansi</span>
            </button>
          )}
        </div>

        {/* Sticky Footer Actions */}
        <div className="px-5 py-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:pb-3.5 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-end gap-2 shrink-0">
          {hasActions ? (
            <>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDelete(transaction);
                  }}
                  className="min-h-[44px] px-3.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Hapus</span>
                </button>
              )}
              {onRecallDraft && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRecallDraft(transaction);
                  }}
                  className="min-h-[44px] px-3.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Tarik Draf</span>
                </button>
              )}
              {onReversal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onReversal(transaction);
                  }}
                  className="min-h-[44px] px-3.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Koreksi</span>
                </button>
              )}
              {onEdit && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEdit(transaction);
                  }}
                  className="min-h-[44px] px-4 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <FileEdit className="w-4 h-4" />
                  <span>Edit</span>
                </button>
              )}
              {onSubmitDraft && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSubmitDraft(transaction.id);
                  }}
                  className="min-h-[44px] px-4 rounded-xl bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  <span>Ajukan</span>
                </button>
              )}
            </>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl bg-slate-800 text-white text-xs font-semibold ml-auto"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
