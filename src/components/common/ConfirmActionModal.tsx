/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, CheckCircle2, Info, X, Loader2 } from 'lucide-react';

export interface ConfirmSummaryRow {
  label: string;
  oldValue?: string;
  newValue: string;
  highlight?: boolean;
}

interface ConfirmActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void> | void;
  title: string;
  message: string;
  warningText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  confirmLabel?: string;
  cancelLabel?: string;
  summaryRows?: ConfirmSummaryRow[];
  requireReason?: boolean;
  showReasonInput?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  initialReason?: string;
  expectedConfirmText?: string;
  confirmTextLabel?: string;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  warningText,
  variant = 'warning',
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  summaryRows = [],
  requireReason = false,
  showReasonInput = false,
  reasonLabel = 'Catatan / Alasan (Audit Trail)',
  reasonPlaceholder = 'Tuliskan alasan tindakan ini...',
  initialReason = '',
  expectedConfirmText,
  confirmTextLabel,
}) => {
  const [reason, setReason] = useState(initialReason);
  const [typedText, setTypedText] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReason(initialReason);
      setTypedText('');
      setError('');
      setSubmitting(false);
    }
  }, [isOpen, initialReason]);

  if (!isOpen) return null;

  const isDanger = variant === 'danger';
  const isWarning = variant === 'warning';
  const isTypedConfirmMatched = !expectedConfirmText || typedText.trim() === expectedConfirmText;

  const headerBg = isDanger
    ? 'bg-rose-50 border-rose-100 text-rose-900'
    : isWarning
    ? 'bg-amber-50 border-amber-100 text-amber-950'
    : 'bg-blue-50 border-blue-100 text-blue-950';

  const iconWrapper = isDanger
    ? 'bg-rose-100 text-rose-700'
    : isWarning
    ? 'bg-amber-100 text-amber-700'
    : 'bg-blue-100 text-blue-700';

  const confirmBtnClass = isDanger
    ? 'bg-rose-600 hover:bg-rose-700 text-white'
    : isWarning
    ? 'bg-amber-600 hover:bg-amber-700 text-white'
    : 'bg-blue-600 hover:bg-blue-700 text-white';

  const handleConfirmClick = async () => {
    if (expectedConfirmText && typedText.trim() !== expectedConfirmText) {
      setError(`Ketik "${expectedConfirmText}" dengan persis untuk melanjutkan.`);
      return;
    }
    if (requireReason && !reason.trim()) {
      setError('Alasan wajib diisi sebelum melanjutkan.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onConfirm(reason.trim() || undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 mobile-sheet-enter">
        <div className={`sm:hidden flex justify-center pt-2.5 pb-0.5 shrink-0 ${headerBg.split(' ')[0]}`}>
          <div className="w-10 h-1 rounded-full bg-slate-400/40" />
        </div>
        {/* Header */}
        <div className={`flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b shrink-0 ${headerBg}`}>
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconWrapper}`}>
              {isDanger ? (
                <Trash2 className="w-4 h-4" />
              ) : isWarning ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <Info className="w-4 h-4" />
              )}
            </div>
            <h3 className="font-bold text-sm md:text-base leading-tight">{title}</h3>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="p-2 sm:p-1.5 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-white/70 rounded-lg transition-colors disabled:opacity-50 shrink-0"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          <p className="text-xs md:text-sm text-slate-700 leading-relaxed">{message}</p>

          {warningText && (
            <div
              className={`p-3 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
                isDanger
                  ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                  : 'bg-amber-50/80 border-amber-200 text-amber-900'
              }`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{warningText}</span>
            </div>
          )}

          {summaryRows.length > 0 && (
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50/60">
              <div className="divide-y divide-slate-200/80 text-xs">
                {summaryRows.map((row, idx) => (
                  <div
                    key={`${row.label}-${idx}`}
                    className={`px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 ${
                      row.highlight ? 'bg-amber-50/50' : ''
                    }`}
                  >
                    <span className="text-slate-500 font-medium shrink-0">{row.label}</span>
                    <div className="sm:text-right font-semibold text-slate-900 tabular-nums break-words">
                      {row.oldValue !== undefined ? (
                        <div className="flex flex-wrap items-center sm:justify-end gap-1.5">
                          <span className="line-through text-slate-400 font-normal">{row.oldValue}</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-blue-700 font-bold">{row.newValue}</span>
                        </div>
                      ) : (
                        <span>{row.newValue}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(showReasonInput || requireReason) && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {reasonLabel} {requireReason && <span className="text-rose-500">*</span>}
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError('');
                }}
                placeholder={reasonPlaceholder}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white"
              />
            </div>
          )}

          {expectedConfirmText && (
            <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/40 space-y-2">
              <label className="block text-xs font-semibold text-slate-800">
                {confirmTextLabel || 'Ketik teks konfirmasi berikut persis seperti yang tertera:'}{' '}
                <code className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-mono font-bold select-all">
                  {expectedConfirmText}
                </code>
              </label>
              <input
                type="text"
                value={typedText}
                onChange={(e) => {
                  setTypedText(e.target.value);
                  if (error) setError('');
                }}
                placeholder={`Ketik: ${expectedConfirmText}`}
                autoFocus
                className={`w-full text-xs md:text-sm p-2.5 rounded-xl border font-mono font-semibold bg-white focus:outline-hidden focus:ring-2 ${
                  typedText.length > 0 && isTypedConfirmMatched
                    ? 'border-emerald-400 focus:ring-emerald-300 text-emerald-800'
                    : 'border-rose-300 focus:ring-rose-300 text-slate-900'
                }`}
              />
              <p className="text-[11px] text-slate-500">
                {isTypedConfirmMatched
                  ? 'Teks konfirmasi cocok. Tombol konfirmasi sekarang aktif.'
                  : `Harus sama persis (huruf besar/kecil): ${expectedConfirmText}`}
              </p>
            </div>
          )}

          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 pt-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] sm:py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="px-4 py-2 min-h-[44px] sm:min-h-0 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={submitting || !isTypedConfirmMatched}
            onClick={handleConfirmClick}
            className={`px-4 py-2 min-h-[44px] sm:min-h-0 text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed ${confirmBtnClass}`}
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isDanger ? (
              <Trash2 className="w-3.5 h-3.5" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            <span>{submitting ? 'Memproses...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
