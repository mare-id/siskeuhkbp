import type { Profile, Transaction } from '../types/database';

const VIEW_ALL_RECEIPT_ROLES = new Set<string>([
  'admin',
  'pendeta_ressort',
  'auditor',
  'sekretaris',
  'majelis',
  'bendahara_umum',
]);

export function canUserViewTransactionReceipt(
  user: Profile | null | undefined,
  tx: Pick<Transaction, 'created_by'>
): boolean {
  if (!user) return false;
  if (VIEW_ALL_RECEIPT_ROLES.has(user.role)) return true;
  return Boolean(tx.created_by && tx.created_by === user.id);
}

export function hasTransactionReceipt(
  tx: Pick<Transaction, 'drive_file_id' | 'attachment_url'>
): boolean {
  return Boolean(tx.drive_file_id || tx.attachment_url);
}

export function isTransactionReceiptPdf(
  tx: Pick<Transaction, 'drive_mime_type' | 'drive_file_name' | 'attachment_url'>
): boolean {
  if ((tx.drive_mime_type || '').toLowerCase() === 'application/pdf') return true;
  const candidate = (tx.drive_file_name || tx.attachment_url || '').toLowerCase();
  return /\.pdf(\?|$)/i.test(candidate);
}

export function getTransactionReceiptUrl(
  tx: Pick<Transaction, 'id' | 'drive_file_id' | 'attachment_url'>
): string | null {
  if (tx.drive_file_id) {
    return `/api/bukti?id=${encodeURIComponent(tx.id)}`;
  }
  if (tx.attachment_url) {
    return tx.attachment_url;
  }
  return null;
}
