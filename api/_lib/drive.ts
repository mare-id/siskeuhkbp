import { Readable } from 'node:stream';
import { google, type drive_v3 } from 'googleapis';

function getDriveConfig() {
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const refreshToken = (process.env.GOOGLE_REFRESH_TOKEN || '').trim();
  const folderId = (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();

  if (!clientId || !clientSecret || !refreshToken || !folderId) {
    throw new Error(
      'Konfigurasi Google Drive di server belum lengkap (periksa GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_DRIVE_FOLDER_ID).'
    );
  }

  return { clientId, clientSecret, refreshToken, folderId };
}

function createDriveClient(): { drive: drive_v3.Drive; folderId: string } {
  const { clientId, clientSecret, refreshToken, folderId } = getDriveConfig();
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  return { drive, folderId };
}

function escapeDriveQueryLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function findDriveFileByUploadNonce(
  transactionId: string,
  uploadNonce: string
): Promise<{ id: string; name?: string | null; mimeType?: string | null } | null> {
  if (!uploadNonce) return null;
  const { drive, folderId } = createDriveClient();
  const safeFolder = escapeDriveQueryLiteral(folderId);
  const safeTxId = escapeDriveQueryLiteral(transactionId);
  const safeNonce = escapeDriveQueryLiteral(uploadNonce);

  const res = await drive.files.list({
    q: `'${safeFolder}' in parents and trashed = false and appProperties has { key='transactionId' and value='${safeTxId}' } and appProperties has { key='uploadNonce' and value='${safeNonce}' }`,
    fields: 'files(id, name, mimeType)',
    pageSize: 1,
  });

  const existing = res.data.files?.[0];
  if (!existing?.id) return null;
  return {
    id: existing.id,
    name: existing.name,
    mimeType: existing.mimeType,
  };
}

export async function uploadPrivateFileToDrive(params: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  transactionId: string;
  uploadNonce?: string;
  uploadedBy: string;
}): Promise<{ id: string; name: string; mimeType: string }> {
  const { drive, folderId } = createDriveClient();

  const appProperties: Record<string, string> = {
    transactionId: params.transactionId.slice(0, 100),
    uploadedBy: params.uploadedBy.slice(0, 100),
  };
  if (params.uploadNonce) {
    appProperties.uploadNonce = params.uploadNonce.slice(0, 100);
  }

  const res = await drive.files.create({
    requestBody: {
      name: params.fileName,
      parents: [folderId],
      appProperties,
    },
    media: {
      mimeType: params.mimeType,
      body: Readable.from(params.buffer),
    },
    fields: 'id, name, mimeType',
  });

  if (!res.data.id) {
    throw new Error('Google Drive tidak mengembalikan ID file.');
  }

  return {
    id: res.data.id,
    name: res.data.name || params.fileName,
    mimeType: res.data.mimeType || params.mimeType,
  };
}

export async function deleteDriveFileSafe(
  fileId: string,
  expectedUploader?: { userId: string; isAdmin: boolean }
): Promise<void> {
  if (!fileId || !/^[A-Za-z0-9_-]{10,120}$/.test(fileId)) return;
  try {
    const { drive, folderId } = createDriveClient();
    if (expectedUploader) {
      const meta = await drive.files.get({
        fileId,
        fields: 'id, parents, appProperties',
      });
      const parents = meta.data.parents || [];
      const ownerId = meta.data.appProperties?.uploadedBy;
      if (!parents.includes(folderId)) return;
      if (!expectedUploader.isAdmin && ownerId !== expectedUploader.userId) return;
    }
    await drive.files.delete({ fileId });
  } catch (err: unknown) {
    const status = (err as { code?: number; status?: number })?.code || (err as { status?: number })?.status;
    if (status === 404) return;
    // Jangan gagalkan upload baru bila penghapusan file lama gagal; catat kode saja tanpa rahasia
    console.warn('Gagal menghapus file bukti lama di Drive, kode:', status || 'unknown');
  }
}

export async function getPrivateDriveFileStream(fileId: string): Promise<{
  stream: NodeJS.ReadableStream;
  mimeType: string;
  fileName: string;
  size?: string;
}> {
  const { drive } = createDriveClient();

  const meta = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size, trashed',
  });

  if (meta.data.trashed) {
    const notFoundErr = new Error('File bukti telah dihapus.');
    (notFoundErr as Error & { status?: number }).status = 404;
    throw notFoundErr;
  }

  const mediaRes = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );

  return {
    stream: mediaRes.data as unknown as NodeJS.ReadableStream,
    mimeType: meta.data.mimeType || 'application/octet-stream',
    fileName: meta.data.name || 'bukti-transaksi',
    size: meta.data.size || undefined,
  };
}
