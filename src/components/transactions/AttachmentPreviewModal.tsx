/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, ExternalLink, Download } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string | null;
  title?: string;
}

export const AttachmentPreviewModal: React.FC<Props> = ({
  isOpen,
  onClose,
  imageUrl,
  title = 'Pratinjau Bukti Lampiran Nota',
}) => {
  if (!isOpen || !imageUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[92dvh] mobile-sheet-enter">
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0 bg-slate-50/50">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="truncate pr-2">
            <h3 className="font-semibold text-slate-800 text-sm md:text-base truncate">{title}</h3>
            <span className="text-xs text-slate-500">Bukti pertanggungjawaban fisik / kuitansi</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={imageUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              title="Buka di tab baru"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-2 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Image */}
        <div className="p-4 overflow-auto flex items-center justify-center bg-slate-950/5 min-h-[240px] sm:min-h-[300px] flex-1">
          <img
            src={imageUrl}
            alt="Bukti Lampiran"
            className="max-h-[65dvh] sm:max-h-[70vh] w-auto object-contain rounded-lg shadow-xs"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 min-h-[44px] sm:min-h-0 bg-slate-800 text-white text-xs font-semibold rounded-xl hover:bg-slate-700 transition-colors"
          >
            Tutup Pratinjau
          </button>
        </div>
      </div>
    </div>
  );
};
