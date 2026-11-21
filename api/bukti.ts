import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  authenticateRequest,
  canUserViewReceipt,
  createServerSupabaseAdminClient,
  sendJson,
} from './_lib/session';
import { getPrivateDriveFileStream } from './_lib/drive';

const SAFE_MIME_MAP: Record<string, string> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'application/pdf': 'application/pdf',
};

function sanitizeDownloadFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return cleaned || 'bukti-transaksi';
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Metode tidak diizinkan.' });
  }

  const auth = await authenticateRequest(req);
  if (!auth.user) {
    return sendJson(res, 401, {
      ok: false,
      error: auth.error || 'Anda belum login. Silakan masuk terlebih dahulu untuk melihat bukti.',
    });
  }

  let txId = '';
  try {
    const parsedUrl = new URL(req.url || '/', 'http://localhost');
    txId = (parsedUrl.searchParams.get('id') || '').trim();
  } catch {
    return sendJson(res, 400, { ok: false, error: 'Parameter ID transaksi tidak valid.' });
  }

  if (!txId || txId.length > 100) {
    return sendJson(res, 400, { ok: false, error: 'Parameter id transaksi wajib diisi.' });
  }

  const adminClient = createServerSupabaseAdminClient();
  if (!adminClient) {
    return sendJson(res, 500, {
      ok: false,
      error: 'Konfigurasi Supabase di server belum lengkap.',
    });
  }

  try {
    const { data: tx, error: txErr } = await adminClient
      .from('transactions')
      .select('id, created_by, drive_file_id, drive_file_name, drive_mime_type')
      .eq('id', txId)
      .maybeSingle();

    if (txErr) {
      return sendJson(res, 500, {
        ok: false,
        error: 'Gagal mengambil data transaksi dari database.',
      });
    }

    if (!tx) {
      return sendJson(res, 404, {
        ok: false,
        error: 'Transaksi tidak ditemukan.',
      });
    }

    if (!canUserViewReceipt(auth.user, tx)) {
      return sendJson(res, 403, {
        ok: false,
        error: 'Anda tidak memiliki hak akses untuk melihat bukti transaksi ini.',
      });
    }

    if (!tx.drive_file_id) {
      return sendJson(res, 404, {
        ok: false,
        error: 'Transaksi ini tidak memiliki file bukti di Google Drive.',
      });
    }

    const driveFile = await getPrivateDriveFileStream(tx.drive_file_id);
    const rawMime = (tx.drive_mime_type || driveFile.mimeType || '').toLowerCase();
    const safeMime = SAFE_MIME_MAP[rawMime] || 'application/octet-stream';
    const safeName = sanitizeDownloadFilename(tx.drive_file_name || driveFile.fileName || tx.id);

    res.statusCode = 200;
    res.setHeader('Content-Type', safeMime);
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (driveFile.size && /^\d+$/.test(driveFile.size)) {
      res.setHeader('Content-Length', driveFile.size);
    }

    driveFile.stream.on('error', () => {
      if (!res.headersSent) {
        sendJson(res, 502, {
          ok: false,
          error: 'Gagal mengalirkan file bukti dari Google Drive.',
        });
      } else {
        res.end();
      }
    });

    driveFile.stream.pipe(res);
  } catch (err: unknown) {
    const status = (err as { status?: number; code?: number })?.status || (err as { code?: number })?.code;
    if (status === 404) {
      return sendJson(res, 404, {
        ok: false,
        error: 'File bukti tidak ditemukan di Google Drive.',
      });
    }
    return sendJson(res, 500, {
      ok: false,
      error: 'Terjadi kesalahan saat mengambil bukti dari Google Drive.',
    });
  }
}
