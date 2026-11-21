import type { IncomingMessage, ServerResponse } from 'node:http';
import Busboy from 'busboy';
import {
  authenticateRequest,
  BLOCKED_UPLOAD_ROLES,
  canUserUploadToKas,
  createServerSupabaseAdminClient,
  isSameOriginRequest,
  sendJson,
} from './_lib/session';
import {
  deleteDriveFileSafe,
  findDriveFileByUploadNonce,
  uploadPrivateFileToDrive,
} from './_lib/drive';

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB (aman di bawah batas ~4,5 MB Vercel)

interface DetectedFileType {
  mime: 'image/jpeg' | 'image/png' | 'application/pdf';
  ext: 'jpg' | 'png' | 'pdf';
}

function detectFileTypeByContent(buf: Buffer): DetectedFileType | null {
  if (buf.length < 5) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: 'png' };
  }

  // PDF: %PDF-
  if (buf.subarray(0, 5).toString('ascii') === '%PDF-') {
    return { mime: 'application/pdf', ext: 'pdf' };
  }

  return null;
}

function sanitizeTransactionId(raw: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  return cleaned.slice(0, 80);
}

function sanitizeYmdDate(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface ParsedMultipartResult {
  fields: Record<string, string>;
  fileBuffer: Buffer | null;
  fileTruncated: boolean;
}

function parseMultipartUpload(req: IncomingMessage): Promise<ParsedMultipartResult> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      reject(new Error('Permintaan harus berupa multipart/form-data.'));
      return;
    }

    const fields: Record<string, string> = {};
    const chunks: Buffer[] = [];
    let fileSeen = false;
    let fileTruncated = false;

    const busboy = Busboy({
      headers: req.headers,
      limits: {
        fileSize: MAX_FILE_SIZE_BYTES,
        files: 1,
        fields: 12,
        fieldSize: 4096,
      },
    });

    busboy.on('field', (name, val) => {
      if (typeof name === 'string' && typeof val === 'string') {
        fields[name] = val;
      }
    });

    busboy.on('file', (_fieldname, stream) => {
      if (fileSeen) {
        stream.resume();
        return;
      }
      fileSeen = true;

      stream.on('data', (chunk: Buffer) => {
        if (!fileTruncated) {
          chunks.push(chunk);
        }
      });

      stream.on('limit', () => {
        fileTruncated = true;
        chunks.length = 0;
        stream.resume();
      });
    });

    busboy.on('finish', () => {
      resolve({
        fields,
        fileBuffer: fileSeen && !fileTruncated ? Buffer.concat(chunks) : null,
        fileTruncated,
      });
    });

    busboy.on('error', (err: unknown) => {
      reject(err instanceof Error ? err : new Error('Gagal membaca data unggahan.'));
    });

    req.pipe(busboy);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Metode tidak diizinkan.' });
  }

  const auth = await authenticateRequest(req);
  if (!auth.user) {
    return sendJson(res, 401, {
      ok: false,
      error: auth.error || 'Anda belum masuk. Silakan login terlebih dahulu.',
    });
  }

  if (auth.authMethod === 'cookie' && !isSameOriginRequest(req)) {
    return sendJson(res, 403, {
      ok: false,
      error: 'Permintaan tidak berasal dari domain aplikasi yang sah.',
    });
  }

  if (BLOCKED_UPLOAD_ROLES.has(auth.user.role)) {
    return sendJson(res, 403, {
      ok: false,
      error: 'Role Anda hanya diperbolehkan melihat bukti dan tidak dapat mengunggah atau mengganti bukti.',
    });
  }

  const adminClient = createServerSupabaseAdminClient();
  if (!adminClient) {
    return sendJson(res, 500, {
      ok: false,
      error: 'Konfigurasi Supabase di server belum lengkap.',
    });
  }

  let parsed: ParsedMultipartResult;
  try {
    parsed = await parseMultipartUpload(req);
  } catch (err: unknown) {
    return sendJson(res, 400, {
      ok: false,
      error: err instanceof Error ? err.message : 'Format unggahan tidak valid.',
    });
  }

  if (parsed.fileTruncated) {
    return sendJson(res, 413, {
      ok: false,
      error: 'Ukuran file melebihi batas maksimal 4 MB.',
    });
  }

  if (!parsed.fileBuffer || parsed.fileBuffer.length === 0) {
    return sendJson(res, 400, {
      ok: false,
      error: 'File bukti tidak ditemukan atau kosong.',
    });
  }

  if (parsed.fileBuffer.length > MAX_FILE_SIZE_BYTES) {
    return sendJson(res, 413, {
      ok: false,
      error: 'Ukuran file melebihi batas maksimal 4 MB.',
    });
  }

  const detected = detectFileTypeByContent(parsed.fileBuffer);
  if (!detected) {
    return sendJson(res, 400, {
      ok: false,
      error: 'Isi file tidak valid. Hanya file JPG, PNG, atau PDF asli yang diperbolehkan.',
    });
  }

  const rawTxId = parsed.fields.transactionId || '';
  const transactionId = sanitizeTransactionId(rawTxId) || `tx-${Date.now()}`;
  const tanggal = sanitizeYmdDate(parsed.fields.tanggal || '');
  const kasId = (parsed.fields.kasId || '').trim();
  const uploadNonce = (parsed.fields.uploadNonce || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const previousDriveFileId = (parsed.fields.previousDriveFileId || '').trim();

  try {
    // Periksa hak akses terhadap transaksi / kas tujuan
    const { data: existingTx } = await adminClient
      .from('transactions')
      .select('id, kas_id, created_by, status, drive_file_id')
      .eq('id', transactionId)
      .maybeSingle();

    let oldDriveFileIdToDelete = '';

    if (existingTx) {
      const canKas = await canUserUploadToKas(adminClient, auth.user, existingTx.kas_id);
      const isCreator = Boolean(existingTx.created_by && existingTx.created_by === auth.user.id);

      if (auth.user.role !== 'admin') {
        if (!canKas) {
          return sendJson(res, 403, {
            ok: false,
            error: 'Anda tidak memiliki hak akses untuk mengunggah bukti pada kas transaksi ini.',
          });
        }
        if (existingTx.created_by && !isCreator && existingTx.status !== 'draft') {
          return sendJson(res, 403, {
            ok: false,
            error: 'Anda tidak berhak mengubah bukti transaksi milik pengguna lain.',
          });
        }
      }

      if (existingTx.drive_file_id) {
        oldDriveFileIdToDelete = existingTx.drive_file_id;
      }
    } else {
      const canKas = await canUserUploadToKas(adminClient, auth.user, kasId || null);
      if (!canKas) {
        return sendJson(res, 403, {
          ok: false,
          error: 'Anda tidak memiliki hak akses input pada kas yang dipilih.',
        });
      }
    }

    const fileName = `${transactionId}_${tanggal}.${detected.ext}`;

    // Pencegahan duplikasi saat retry (Coba lagi) dengan nonce yang sama
    if (uploadNonce) {
      const existingByNonce = await findDriveFileByUploadNonce(transactionId, uploadNonce);
      if (existingByNonce) {
        if (existingTx && existingTx.drive_file_id !== existingByNonce.id) {
          await adminClient
            .from('transactions')
            .update({
              drive_file_id: existingByNonce.id,
              drive_file_name: existingByNonce.name || fileName,
              drive_mime_type: existingByNonce.mimeType || detected.mime,
              drive_link: `https://drive.google.com/file/d/${existingByNonce.id}/view`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingTx.id);
        }

        return sendJson(res, 200, {
          ok: true,
          drive_file_id: existingByNonce.id,
          file_name: existingByNonce.name || fileName,
          mime_type: existingByNonce.mimeType || detected.mime,
        });
      }
    }

    // Unggah file baru ke folder privat Google Drive
    const uploaded = await uploadPrivateFileToDrive({
      buffer: parsed.fileBuffer,
      fileName,
      mimeType: detected.mime,
      transactionId,
      uploadNonce: uploadNonce || undefined,
      uploadedBy: auth.user.id,
    });

    // Jika transaksi sudah ada di database, perbarui kolom Drive secara langsung
    if (existingTx) {
      await adminClient
        .from('transactions')
        .update({
          drive_file_id: uploaded.id,
          drive_file_name: uploaded.name,
          drive_mime_type: detected.mime,
          drive_link: `https://drive.google.com/file/d/${uploaded.id}/view`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingTx.id);
    }

    // Hapus file lama di Drive SETELAH file baru sukses terunggah
    if (oldDriveFileIdToDelete && oldDriveFileIdToDelete !== uploaded.id) {
      await deleteDriveFileSafe(oldDriveFileIdToDelete);
    }
    if (
      previousDriveFileId &&
      previousDriveFileId !== uploaded.id &&
      previousDriveFileId !== oldDriveFileIdToDelete
    ) {
      await deleteDriveFileSafe(previousDriveFileId, {
        userId: auth.user.id,
        isAdmin: auth.user.role === 'admin',
      });
    }

    // Balas tanpa membocorkan link Google Drive
    return sendJson(res, 200, {
      ok: true,
      drive_file_id: uploaded.id,
      file_name: uploaded.name,
      mime_type: detected.mime,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal mengunggah bukti ke Google Drive.';
    const status = message.includes('Konfigurasi Google Drive') ? 500 : 502;
    return sendJson(res, status, {
      ok: false,
      error: message,
    });
  }
}
