import React from 'react';
import { ExternalLink, FileText, Paperclip } from 'lucide-react';
import {
  canUserViewTransactionReceipt,
  getTransactionReceiptUrl,
  hasTransactionReceipt,
  isTransactionReceiptPdf,
} from '../../lib/receiptAccess';
import type { Profile, Transaction } from '../../types/database';

interface ReceiptViewButtonProps {
  tx: Pick<
    Transaction,
    'id' | 'created_by' | 'drive_file_id' | 'drive_file_name' | 'drive_mime_type' | 'attachment_url'
  >;
  currentUser: Profile | null | undefined;
  onPreviewImage: (url: string) => void;
  label?: string;
  className?: string;
  showPdfExternalIcon?: boolean;
}

export const ReceiptViewButton: React.FC<ReceiptViewButtonProps> = ({
  tx,
  currentUser,
  onPreviewImage,
  label = 'Lihat Bukti',
  className = 'inline-flex items-center gap-1 font-medium text-blue-700 hover:underline cursor-pointer',
  showPdfExternalIcon = false,
}) => {
  if (!hasTransactionReceipt(tx) || !canUserViewTransactionReceipt(currentUser, tx)) {
    return null;
  }

  const receiptUrl = getTransactionReceiptUrl(tx);
  if (!receiptUrl) return null;

  const isPdf = isTransactionReceiptPdf(tx);

  if (isPdf) {
    return (
      <a
        href={receiptUrl}
        target="_blank"
        rel="noreferrer"
        className={className}
      >
        <FileText className="w-3.5 h-3.5 shrink-0" />
        <span>{label === 'Bukti' ? 'PDF' : `${label} (PDF)`}</span>
        {showPdfExternalIcon && <ExternalLink className="w-3 h-3 shrink-0" />}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onPreviewImage(receiptUrl)}
      className={className}
    >
      <Paperclip className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </button>
  );
};
