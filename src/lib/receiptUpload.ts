import { getActiveReceiptAuthToken } from './receiptSession';

export const MAX_RECEIPT_FILE_BYTES = 4 * 1024 * 1024; // 4 MB
const MAX_IMAGE_WIDTH_PX = 1600;
const IMAGE_JPEG_QUALITY = 0.8;

export interface UploadReceiptResult {
  success: boolean;
  driveFileId?: string;
  fileName?: string;
  mimeType?: string;
  previewObjectUrl?: string;
  isPdf?: boolean;
  error?: string;
  preparedFile?: File;
}

type AllowedType = 'image/jpeg' | 'image/png' | 'application/pdf';

async function detectFileMagicType(file: File): Promise<AllowedType | null> {
  const headerSlice = await file.slice(0, 8).arrayBuffer();
  const bytes = new Uint8Array(headerSlice);
  if (bytes.length < 5) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  // PDF: %PDF-
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return 'application/pdf';
  }

  return null;
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Gagal membaca gambar. Pastikan file gambar tidak rusak.'));
    };
    img.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

async function compressImageIfNeeded(file: File, detectedType: 'image/jpeg' | 'image/png'): Promise<File> {
  const img = await loadImageElement(file);
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;

  const needsResize = naturalW > MAX_IMAGE_WIDTH_PX;
  const targetWidth = needsResize ? MAX_IMAGE_WIDTH_PX : naturalW;
  const targetHeight = Math.max(1, Math.round((naturalH * targetWidth) / Math.max(1, naturalW)));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Perangkat tidak mendukung pemrosesan gambar.');
  }

  // Isi latar putih agar transparan PNG tetap rapi bila dikonversi ke JPEG
  if (detectedType === 'image/png') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // Gunakan JPEG kualitas 0.8 untuk foto JPG, atau untuk PNG yang ukurannya besar / di-resize
  const preferPng = detectedType === 'image/png' && !needsResize && file.size <= 1.5 * 1024 * 1024;
  let blob = await canvasToBlob(
    canvas,
    preferPng ? 'image/png' : 'image/jpeg',
    IMAGE_JPEG_QUALITY
  );

  if (preferPng && blob && blob.size > MAX_RECEIPT_FILE_BYTES) {
    blob = await canvasToBlob(canvas, 'image/jpeg', IMAGE_JPEG_QUALITY);
  }

  if (!blob) {
    throw new Error('Gagal mengompres gambar nota.');
  }

  const outputMime = blob.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const ext = outputMime === 'image/png' ? 'png' : 'jpg';
  const baseName = file.name.replace(/\.[^/.]+$/, '') || 'bukti';
  return new File([blob], `${baseName}.${ext}`, { type: outputMime });
}

export function createUploadNonce(): string {
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function prepareAndUploadReceiptToDrive(params: {
  file: File;
  transactionId: string;
  tanggal: string;
  kasId?: string | null;
  previousDriveFileId?: string | null;
  uploadNonce: string;
  isAlreadyPrepared?: boolean;
}): Promise<UploadReceiptResult> {
  const {
    file,
    transactionId,
    tanggal,
    kasId,
    previousDriveFileId,
    uploadNonce,
    isAlreadyPrepared,
  } = params;

  try {
    let finalFile = file;
    let detectedType: AllowedType | null = await detectFileMagicType(file);

    if (!detectedType) {
      return {
        success: false,
        error: 'Format file tidak didukung. Hanya file JPG, PNG, atau PDF asli yang diperbolehkan.',
      };
    }

    if (!isAlreadyPrepared && detectedType !== 'application/pdf') {
      finalFile = await compressImageIfNeeded(file, detectedType);
      detectedType = finalFile.type === 'image/png' ? 'image/png' : 'image/jpeg';
    }

    if (finalFile.size > MAX_RECEIPT_FILE_BYTES) {
      const sizeMb = (finalFile.size / (1024 * 1024)).toFixed(2);
      return {
        success: false,
        preparedFile: finalFile,
        error: `Ukuran file (${sizeMb} MB) melebihi batas maksimal 4 MB. Gunakan file atau foto yang lebih kecil.`,
      };
    }

    const formData = new FormData();
    formData.append('file', finalFile, finalFile.name);
    formData.append('transactionId', transactionId);
    formData.append('tanggal', tanggal);
    if (kasId) formData.append('kasId', kasId);
    if (previousDriveFileId) formData.append('previousDriveFileId', previousDriveFileId);
    formData.append('uploadNonce', uploadNonce);

    const token = await getActiveReceiptAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch('/api/upload-bukti', {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers,
    });

    const contentType = res.headers.get('content-type') || '';
    let json: {
      ok?: boolean;
      error?: string;
      drive_file_id?: string;
      file_name?: string;
      mime_type?: string;
    } | null = null;

    if (contentType.includes('application/json')) {
      json = await res.json();
    }

    if (!res.ok || !json?.ok || !json.drive_file_id) {
      if (res.status === 404) {
        return {
          success: false,
          preparedFile: finalFile,
          error:
            'Endpoint unggah (/api/upload-bukti) tidak ditemukan. Pastikan aplikasi berjalan di Vercel atau server API aktif.',
        };
      }
      if (res.status === 401) {
        return {
          success: false,
          preparedFile: finalFile,
          error:
            json?.error ||
            'Sesi login Anda belum terverifikasi di server. Silakan keluar (Logout) lalu masuk kembali.',
        };
      }
      if (res.status === 413) {
        return {
          success: false,
          preparedFile: finalFile,
          error: json?.error || 'Ukuran file terlalu besar (maksimal 4 MB).',
        };
      }
      return {
        success: false,
        preparedFile: finalFile,
        error: json?.error || `Gagal mengunggah bukti (Kode ${res.status}). Silakan coba lagi.`,
      };
    }

    const isPdf = (json.mime_type || detectedType) === 'application/pdf';
    const previewObjectUrl = isPdf ? undefined : URL.createObjectURL(finalFile);

    return {
      success: true,
      driveFileId: json.drive_file_id,
      fileName: json.file_name || finalFile.name,
      mimeType: json.mime_type || detectedType,
      previewObjectUrl,
      isPdf,
      preparedFile: finalFile,
    };
  } catch (err: unknown) {
    const msg =
      err instanceof Error && err.message
        ? err.message
        : 'Koneksi terputus saat mengunggah bukti. Periksa internet Anda lalu klik Coba lagi.';
    return {
      success: false,
      preparedFile: file,
      error: msg.includes('Failed to fetch')
        ? 'Gagal terhubung ke server (koneksi internet terputus). Klik Coba lagi saat internet kembali normal.'
        : msg,
    };
  }
}
