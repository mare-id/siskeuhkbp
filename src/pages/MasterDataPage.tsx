/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Database,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  ShieldAlert,
  Wallet,
  Landmark,
  Tags,
  Users,
  Coins,
  X,
  UserCheck,
  UserPlus,
  Shield,
  ShieldCheck,
  Mail,
  Phone,
  Building,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  AlertCircle,
  Search,
  Lock,
  Unlock,
  ChevronRight,
  Sparkles,
  Sliders,
  Save,
  Calendar,
  CalendarCheck,
  CalendarRange,
  RotateCw,
  ArrowRight,
  KeyRound,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Upload,
  Download,
  Home,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import {
  Kas,
  StorageAccount,
  Category,
  OpeningBalance,
  UserKasAccess,
  KasAccessLevel,
  Profile,
  TohonanType,
  EcclesiasticalRole,
  HuriaLevel,
  UserRole,
  FiscalYear,
  ChurchLingkungan,
  CongregationFamily,
} from '../types/database';
import { formatRupiah } from '../lib/formatters';
import { HKBP_ROLES, HKBP_ROLE_CATEGORIES, TOHONAN_LIST } from '../lib/hkbpRoles';

const PASTEL_PALETTE = ['#7C9CF5', '#A8E6CF', '#FFB4A2', '#FFE8A3', '#CDB4FF', '#B8C0FF', '#FFD166'];

export const MasterDataPage: React.FC = () => {
  const {
    kasList,
    storageAccounts,
    categories,
    openingBalances,
    userKasAccessList,
    profiles,
    saveKas,
    deleteKas,
    saveStorageAccount,
    deleteStorageAccount,
    saveCategory,
    saveOpeningBalance,
    saveUserKasAccess,
    removeUserKasAccess,
    saveProfile,
    deleteProfile,
    toggleProfileActive,
    transactions,
    openingEntries,
    openingAdjustments,
    reconciliations,
    cashCounts,
    fixedAssets,
    advances,
    budgets,
    receivablesPayables,
    settings,
    updateSettings,
    fiscalYears,
    saveFiscalYear,
    deleteFiscalYear,
    setActiveFiscalYear,
    toggleFiscalYearBudgetLock,
    rollForwardBalancesToYear,
    lingkunganList,
    families,
    saveLingkungan,
    deleteLingkungan,
    saveFamily,
    bulkImportFamilies,
    deleteFamily,
  } = useData();

  const { isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<'kas' | 'years' | 'families' | 'storage' | 'categories' | 'balances' | 'access' | 'users' | 'policy'>('kas');

  // Fiscal Year Modal States
  const [editingFiscalYear, setEditingFiscalYear] = useState<Partial<FiscalYear> | null>(null);
  const [deletingFiscalYear, setDeletingFiscalYear] = useState<FiscalYear | null>(null);
  const [showRollForwardModal, setShowRollForwardModal] = useState<boolean>(false);
  const [rollForwardFromYear, setRollForwardFromYear] = useState<number>((settings?.active_year || 2026) - 1);
  const [rollForwardToYear, setRollForwardToYear] = useState<number>(settings?.active_year || 2026);
  const [isRollingForward, setIsRollingForward] = useState<boolean>(false);

  // Policy Form state
  const [policyForm, setPolicyForm] = useState({
    receipt_required_threshold: settings?.receipt_required_threshold ?? 500000,
    active_year: settings?.active_year ?? new Date().getFullYear(),
    block_negative_balance: settings?.block_negative_balance !== false,
  });

  useEffect(() => {
    if (settings) {
      setPolicyForm({
        receipt_required_threshold: settings.receipt_required_threshold ?? 500000,
        active_year: settings.active_year ?? new Date().getFullYear(),
        block_negative_balance: settings.block_negative_balance !== false,
      });
      setRollForwardFromYear((settings.active_year || 2026) - 1);
      setRollForwardToYear(settings.active_year || 2026);
    }
  }, [settings]);

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings(policyForm);
    showToast('Kebijakan nota & batasan saldo berhasil disimpan!');
  };

  // Fiscal Year Handlers
  const handleSaveFiscalYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFiscalYear?.year) return;
    const res = await saveFiscalYear(editingFiscalYear);
    if (res.success) {
      showToast(`Tahun Anggaran ${editingFiscalYear.year} berhasil disimpan!`);
      setEditingFiscalYear(null);
    } else {
      showToast(res.error || 'Gagal menyimpan Tahun Anggaran', 'error');
    }
  };

  const handleExecuteDeleteFiscalYear = async () => {
    if (!deletingFiscalYear) return;
    const res = await deleteFiscalYear(deletingFiscalYear.id);
    if (res.success) {
      showToast(`Tahun Anggaran ${deletingFiscalYear.year} berhasil dihapus.`);
      setDeletingFiscalYear(null);
    } else {
      showToast(res.error || 'Gagal menghapus Tahun Anggaran', 'error');
    }
  };

  const handleSwitchActiveYear = async (year: number) => {
    const res = await setActiveFiscalYear(year);
    if (res.success) {
      showToast(`Tahun Anggaran Aktif sistem dialihkan ke ${year}!`);
    } else {
      showToast(res.error || 'Gagal mengalihkan Tahun Anggaran', 'error');
    }
  };

  const handleToggleLock = async (year: number) => {
    const res = await toggleFiscalYearBudgetLock(year);
    if (res.success) {
      showToast(`Status kunci RAPB Tahun ${year} berhasil diperbarui.`);
    }
  };

  const handleExecuteRollForward = async () => {
    setIsRollingForward(true);
    const res = await rollForwardBalancesToYear(rollForwardFromYear, rollForwardToYear);
    setIsRollingForward(false);
    if (res.success) {
      showToast(`Roll-forward berhasil! ${res.count} saldo awal kas tahun ${rollForwardToYear} diperbarui.`);
      setShowRollForwardModal(false);
    } else {
      showToast(res.error || 'Gagal melakukan roll-forward saldo', 'error');
    }
  };

  // Modal states for Kas
  const [editingKas, setEditingKas] = useState<Partial<Kas> | null>(null);
  const [deletingKas, setDeletingKas] = useState<Kas | null>(null);
  const [confirmForceDeleteKas, setConfirmForceDeleteKas] = useState(false);
  const [deleteKasReason, setDeleteKasReason] = useState('');
  const [isDeletingKasLoading, setIsDeletingKasLoading] = useState(false);

  // Modal states for Storage & Category & Balances
  const [editingStorage, setEditingStorage] = useState<Partial<StorageAccount> | null>(null);
  const [deletingStorage, setDeletingStorage] = useState<StorageAccount | null>(null);
  const [confirmForceDeleteStorage, setConfirmForceDeleteStorage] = useState(false);
  const [deleteStorageReason, setDeleteStorageReason] = useState('');
  const [isDeletingStorageLoading, setIsDeletingStorageLoading] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [editingBalance, setEditingBalance] = useState<Partial<OpeningBalance> | null>(null);
  const [newAccessUserId, setNewAccessUserId] = useState<string>('');
  const [newAccessKasId, setNewAccessKasId] = useState<string>('');
  const [newAccessLevel, setNewAccessLevel] = useState<KasAccessLevel>('bendahara');

  // User Management state
  const [editingProfile, setEditingProfile] = useState<Partial<Profile> | null>(null);
  const [profilePassword, setProfilePassword] = useState<string>('');
  const [profileConfirmPassword, setProfileConfirmPassword] = useState<string>('');
  const [showProfilePassword, setShowProfilePassword] = useState<boolean>(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<Profile | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState<string>('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState<string>('');
  const [showResetPassword, setShowResetPassword] = useState<boolean>(false);
  const [deletingProfile, setDeletingProfile] = useState<Profile | null>(null);
  const [userCategoryFilter, setUserCategoryFilter] = useState<string>('all');
  const [userSearch, setUserSearch] = useState<string>('');

  // Keluarga & Lingkungan (Pelean Taon) states
  const [familySearch, setFamilySearch] = useState('');
  const [familyLingkunganFilter, setFamilyLingkunganFilter] = useState<string>('all');
  const [editingLingkungan, setEditingLingkungan] = useState<Partial<ChurchLingkungan> | null>(null);
  const [editingFamily, setEditingFamily] = useState<Partial<CongregationFamily> | null>(null);
  const [deletingFamily, setDeletingFamily] = useState<CongregationFamily | null>(null);
  const familyFileInputRef = useRef<HTMLInputElement | null>(null);
  const [familyImportPreview, setFamilyImportPreview] = useState<{
    fileName: string;
    sheetsDetected: string[];
    rows: Array<{
      nama_keluarga: string;
      lingkungan: string;
      kepala_keluarga?: string | null;
      notes?: string | null;
      status: 'new' | 'exists_same' | 'exists_diff_ling';
    }>;
  } | null>(null);
  const [updateExistingLingkungan, setUpdateExistingLingkungan] = useState<boolean>(true);
  const [isImportingFamilies, setIsImportingFamilies] = useState<boolean>(false);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Filtered Families for Master Data tab
  const filteredFamilies = useMemo(() => {
    const q = familySearch.trim().toLowerCase();
    return [...families]
      .filter((f) => {
        if (familyLingkunganFilter !== 'all' && f.lingkungan.toLowerCase() !== familyLingkunganFilter.toLowerCase()) {
          return false;
        }
        if (q) {
          return (
            f.nama_keluarga.toLowerCase().includes(q) ||
            f.lingkungan.toLowerCase().includes(q) ||
            (f.kepala_keluarga || '').toLowerCase().includes(q) ||
            (f.notes || '').toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => a.lingkungan.localeCompare(b.lingkungan) || a.nama_keluarga.localeCompare(b.nama_keluarga));
  }, [families, familySearch, familyLingkunganFilter]);

  const handleSaveLingkunganForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLingkungan?.nama?.trim()) return;
    const res = await saveLingkungan(editingLingkungan);
    if (res.success) {
      showToast(`Lingkungan "${editingLingkungan.nama.trim()}" berhasil disimpan.`);
      setEditingLingkungan(null);
    } else {
      showToast(res.error || 'Gagal menyimpan Lingkungan.', 'error');
    }
  };

  const handleDeleteLingkunganItem = async (ling: ChurchLingkungan) => {
    const res = await deleteLingkungan(ling.id);
    if (res.success) {
      showToast(`Lingkungan "${ling.nama}" berhasil dihapus.`);
    } else {
      showToast(res.error || 'Gagal menghapus Lingkungan.', 'error');
    }
  };

  const handleSaveFamilyForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFamily?.nama_keluarga?.trim() || !editingFamily?.lingkungan?.trim()) {
      showToast('Nama keluarga dan lingkungan wajib diisi.', 'error');
      return;
    }
    const res = await saveFamily(editingFamily);
    if (res.success) {
      showToast(`Data keluarga "${editingFamily.nama_keluarga.trim()}" berhasil disimpan.`);
      setEditingFamily(null);
    } else {
      showToast(res.error || 'Gagal menyimpan data keluarga.', 'error');
    }
  };

  const handleExecuteDeleteFamily = async () => {
    if (!deletingFamily) return;
    const res = await deleteFamily(deletingFamily.id);
    if (res.success) {
      showToast(`Data keluarga "${deletingFamily.nama_keluarga}" berhasil dihapus.`);
      setDeletingFamily(null);
    } else {
      showToast(res.error || 'Gagal menghapus data keluarga.', 'error');
    }
  };

  const handleDownloadFamilyTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Format 1 Sheet Gabungan
    const sheet1Rows = [
      ['TEMPLATE MASTER DATA KELUARGA JEMAAT — HKBP HUTARAJA'],
      ['Isi daftar keluarga di bawah ini lalu unggah kembali di menu Data Master -> Keluarga & Lingkungan.'],
      [''],
      ['NO', 'NAMA KELUARGA', 'LINGKUNGAN', 'KEPALA KELUARGA (OPSIONAL)', 'CATATAN (OPSIONAL)'],
      [1, 'Kel. St. R. Sinaga / Br. Sitepu', 'Efesus', 'St. R. Sinaga', ''],
      [2, 'Kel. Pirngadi Siahaan / Br. Tamba', 'Efesus', 'Pirngadi Siahaan', ''],
      [3, 'Kel. Am. Berlian Hutagalung / Br. Manullang', 'Efesus', '', ''],
      [4, 'Kel. B. Simanjuntak / Br. Sitorus', 'Letare', '', ''],
      [5, 'Kel. T. Sihombing / Br. Pasaribu', 'Exaudi', '', ''],
      [6, 'Kel. M. Lumban Gaol / Br. Tampubolon', 'Judika', '', ''],
      [7, 'Kel. J. Siregar / Br. Purba', 'Galatia', '', ''],
      [8, 'Kel. H. Siburian / Br. Tobing', 'Jeremia', '', ''],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
    ws1['!cols'] = [{ wch: 6 }, { wch: 42 }, { wch: 18 }, { wch: 28 }, { wch: 26 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Template_Data_Keluarga');

    // Sheet 2: Contoh Multi-Sheet (sesuai format laporan Pelean Taon per tab Lingkungan)
    const wsEfesusRows = [
      ['DAFTAR PEMBAYARAN PERSEMBAHAN TAHUNAN (PELEAN TAON) HKBP HUTARAJA'],
      [`TAHUN : ${settings?.active_year || new Date().getFullYear()}`],
      [''],
      ['NO', 'NAMA KELUARGA', 'LINGKUNGAN', 'JUMLAH', 'TGL BAYAR', 'TGL WARTA'],
      [1, 'Kel. St. R. Sinaga / Br. Sitepu', 'Efesus', '', '', ''],
      [2, 'Kel. Ama Immanuel Sitio / Br. Sihombing', 'Efesus', '', '', ''],
    ];
    const wsEfesus = XLSX.utils.aoa_to_sheet(wsEfesusRows);
    wsEfesus['!cols'] = [{ wch: 6 }, { wch: 42 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsEfesus, 'EFESUS');

    // Sheet 3: Petunjuk
    const wsGuide = XLSX.utils.aoa_to_sheet([
      ['PETUNJUK PENGISIAN TEMPLATE DATA KELUARGA HKBP HUTARAJA'],
      ['1. Anda dapat mengisi seluruh keluarga pada 1 sheet "Template_Data_Keluarga" dengan kolom NAMA KELUARGA dan LINGKUNGAN.'],
      ['2. Sistem juga mendukung file Excel Multi-Sheet (satu tab per Lingkungan, misalnya EFESUS, LETARE, EXAUDI, JUDIKA, GALATIA, JEREMIA) seperti file daftar Pelean Taon gereja.'],
      ['3. Baris judul di atas tabel (NO, NAMA KELUARGA, LINGKUNGAN) akan dideteksi otomatis hingga baris ke-20.'],
      ['4. Jika nama Lingkungan belum ada di database, sistem akan otomatis menambahkannya saat impor disimpan.'],
      ['5. Duplikasi nama keluarga yang sama diabaikan otomatis agar data jemaat tetap bersih.'],
    ]);
    wsGuide['!cols'] = [{ wch: 95 }];
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Petunjuk');

    XLSX.writeFile(wb, `Template_Data_Keluarga_HKBP_Hutaraja.xlsx`);
    showToast('Template Excel Data Keluarga berhasil diunduh.');
  };

  const toCanonicalLingkungan = (raw: string): string => {
    const cleaned = raw.replace(/\s*\(\d+\)\s*$/, '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';
    const existing = lingkunganList.find((l) => l.nama.toLowerCase() === cleaned.toLowerCase());
    if (existing) return existing.nama;
    return cleaned
      .toLowerCase()
      .split(' ')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
      .join(' ');
  };

  const handleFamilyExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      const normalizeKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
      const existingMap = new Map(families.map((f) => [normalizeKey(f.nama_keluarga), f]));
      const seenInFile = new Set<string>();
      const parsedRows: Array<{
        nama_keluarga: string;
        lingkungan: string;
        kepala_keluarga?: string | null;
        notes?: string | null;
        status: 'new' | 'exists_same' | 'exists_diff_ling';
      }> = [];
      const sheetsDetected: string[] = [];

      wb.SheetNames.forEach((sheetName) => {
        if (/^(petunjuk|panduan|instruksi|instructions)$/i.test(sheetName.trim())) return;

        const sheet = wb.Sheets[sheetName];
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
        if (!matrix || matrix.length === 0) return;

        let headerRowIdx = -1;
        let nameColIdx = -1;
        let lingColIdx = -1;
        let kepalaColIdx = -1;
        let notesColIdx = -1;

        for (let r = 0; r < Math.min(20, matrix.length); r++) {
          const row = matrix[r] || [];
          const foundNameIdx = row.findIndex((cell) =>
            /^nama\s*keluarga$/i.test(String(cell ?? '').trim()) ||
            /nama.*keluarga/i.test(String(cell ?? '').trim())
          );
          if (foundNameIdx !== -1) {
            headerRowIdx = r;
            nameColIdx = foundNameIdx;
            lingColIdx = row.findIndex((cell) => /^lingkungan|wijk|sektor$/i.test(String(cell ?? '').trim()));
            kepalaColIdx = row.findIndex((cell) => /kepala\s*keluarga/i.test(String(cell ?? '').trim()));
            notesColIdx = row.findIndex((cell) => /catatan|keterangan|notes/i.test(String(cell ?? '').trim()));
            break;
          }
        }

        if (headerRowIdx === -1 || nameColIdx === -1) return;
        sheetsDetected.push(sheetName);

        const isGenericSheet = /^(sheet\d+|template.*|data.*keluarga)$/i.test(sheetName.trim());
        const fallbackLing = isGenericSheet ? '' : toCanonicalLingkungan(sheetName);

        for (let r = headerRowIdx + 1; r < matrix.length; r++) {
          const row = matrix[r] || [];
          const rawName = String(row[nameColIdx] ?? '').replace(/\s+/g, ' ').trim();
          if (!rawName || /^(jumlah|total|no)$/i.test(rawName)) continue;

          const rawLing = lingColIdx !== -1 ? String(row[lingColIdx] ?? '').trim() : '';
          const finalLing = rawLing ? toCanonicalLingkungan(rawLing) : fallbackLing;
          if (!finalLing) continue;

          const key = normalizeKey(rawName);
          if (seenInFile.has(key)) continue;
          seenInFile.add(key);

          const kepalaVal = kepalaColIdx !== -1 ? String(row[kepalaColIdx] ?? '').trim() : '';
          const notesVal = notesColIdx !== -1 ? String(row[notesColIdx] ?? '').trim() : '';
          const existingFam = existingMap.get(key);

          let status: 'new' | 'exists_same' | 'exists_diff_ling' = 'new';
          if (existingFam) {
            status =
              existingFam.lingkungan.trim().toLowerCase() === finalLing.toLowerCase()
                ? 'exists_same'
                : 'exists_diff_ling';
          }

          parsedRows.push({
            nama_keluarga: rawName,
            lingkungan: finalLing,
            kepala_keluarga: kepalaVal || null,
            notes: notesVal || null,
            status,
          });
        }
      });

      if (parsedRows.length === 0) {
        showToast(
          'Tidak ditemukan data keluarga pada file Excel. Pastikan ada kolom header "NAMA KELUARGA" dan "LINGKUNGAN" (atau nama sheet sesuai Lingkungan).',
          'error'
        );
      } else {
        setFamilyImportPreview({
          fileName: file.name,
          sheetsDetected,
          rows: parsedRows,
        });
      }
    } catch (err) {
      console.error('Excel parse error:', err);
      showToast('Gagal membaca file Excel. Pastikan format file .xlsx / .xls / .csv valid.', 'error');
    } finally {
      if (familyFileInputRef.current) {
        familyFileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmFamilyImport = async () => {
    if (!familyImportPreview) return;
    setIsImportingFamilies(true);
    const res = await bulkImportFamilies(
      familyImportPreview.rows.map((r) => ({
        nama_keluarga: r.nama_keluarga,
        lingkungan: r.lingkungan,
        kepala_keluarga: r.kepala_keluarga,
        notes: r.notes,
      })),
      { updateExistingLingkungan }
    );
    setIsImportingFamilies(false);
    if (res.success) {
      showToast(
        `Impor selesai: ${res.added} keluarga baru ditambahkan${
          res.updated > 0 ? `, ${res.updated} diperbarui` : ''
        }${res.createdLingkungan > 0 ? `, ${res.createdLingkungan} lingkungan baru` : ''}.`
      );
      setFamilyImportPreview(null);
    } else {
      showToast(res.error || 'Gagal mengimpor data keluarga.', 'error');
    }
  };

  // Handlers for Kas
  const handleSaveKas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKas?.nama || !editingKas.kode) return;
    await saveKas(editingKas);
    showToast(editingKas.id ? `Kas ${editingKas.nama} berhasil diperbarui` : `Kas ${editingKas.nama} berhasil ditambahkan`);
    setEditingKas(null);
  };

  const handleExecuteDeleteKas = async () => {
    if (!deletingKas) return;
    if (deletingKasMetrics.hasLinkedData && !confirmForceDeleteKas) {
      showToast('Centang persetujuan penghapusan data terkait terlebih dahulu.', 'error');
      return;
    }
    setIsDeletingKasLoading(true);
    const res = await deleteKas(deletingKas.id, {
      force: true,
      reason: deleteKasReason.trim() || undefined,
    });
    setIsDeletingKasLoading(false);
    if (res.success) {
      showToast(`Kas "${deletingKas.nama}" berhasil dihapus secara permanen dari sistem & Supabase.`);
      setDeletingKas(null);
      setConfirmForceDeleteKas(false);
      setDeleteKasReason('');
    } else {
      showToast(res.error || 'Gagal menghapus kas', 'error');
    }
  };

  const handleDeactivateKas = async () => {
    if (!deletingKas) return;
    await saveKas({ ...deletingKas, is_active: false });
    showToast(`Kas "${deletingKas.nama}" telah dinonaktifkan`);
    setDeletingKas(null);
    setConfirmForceDeleteKas(false);
    setDeleteKasReason('');
  };

  // Handlers for Storage
  const handleSaveStorage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStorage?.nama) return;
    await saveStorageAccount(editingStorage);
    showToast('Tempat penyimpanan berhasil disimpan');
    setEditingStorage(null);
  };

  const handleExecuteDeleteStorage = async () => {
    if (!deletingStorage) return;
    if (deletingStorageMetrics.hasLinkedData && !confirmForceDeleteStorage) {
      showToast('Centang persetujuan penghapusan data terkait terlebih dahulu.', 'error');
      return;
    }
    setIsDeletingStorageLoading(true);
    const res = await deleteStorageAccount(deletingStorage.id, {
      force: true,
      reason: deleteStorageReason.trim() || undefined,
    });
    setIsDeletingStorageLoading(false);
    if (res.success) {
      showToast(`Rekening "${deletingStorage.nama}" berhasil dihapus secara permanen.`);
      setDeletingStorage(null);
      setConfirmForceDeleteStorage(false);
      setDeleteStorageReason('');
    } else {
      showToast(res.error || 'Gagal menghapus rekening', 'error');
    }
  };

  const handleDeactivateStorage = async () => {
    if (!deletingStorage) return;
    await saveStorageAccount({ ...deletingStorage, is_active: false });
    showToast(`Rekening "${deletingStorage.nama}" telah dinonaktifkan`);
    setDeletingStorage(null);
    setConfirmForceDeleteStorage(false);
    setDeleteStorageReason('');
  };

  // Handlers for Category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory?.nama || !editingCategory.tipe) return;
    await saveCategory(editingCategory);
    showToast('Kategori berhasil disimpan');
    setEditingCategory(null);
  };

  // Handlers for Opening Balance
  const handleSaveOpeningBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBalance?.kas_id || !editingBalance.storage_account_id) return;
    await saveOpeningBalance(editingBalance);
    showToast('Saldo awal berhasil disimpan');
    setEditingBalance(null);
  };

  // Handlers for User Kas Access
  const handleAddAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccessUserId || !newAccessKasId) return;
    const res = await saveUserKasAccess({
      user_id: newAccessUserId,
      kas_id: newAccessKasId,
      access_level: newAccessLevel,
    });
    if (res && !res.success) {
      showToast(res.error || 'Gagal menambahkan penugasan kas', 'error');
      return;
    }
    showToast('Penugasan kas berhasil ditambahkan');
    setNewAccessUserId('');
    setNewAccessKasId('');
  };

  // Handlers for Profile (User Management)
  const openProfileModal = (profile: Partial<Profile>) => {
    setEditingProfile(profile);
    setProfilePassword('');
    setProfileConfirmPassword('');
    setShowProfilePassword(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile?.full_name || !editingProfile?.email) {
      showToast('Nama dan email wajib diisi', 'error');
      return;
    }

    const isNewUser = !editingProfile.id;
    if (isNewUser && (!profilePassword || profilePassword.length < 6)) {
      showToast('Kata sandi awal pengguna baru minimal 6 karakter', 'error');
      return;
    }
    if (profilePassword) {
      if (profilePassword.length < 6) {
        showToast('Kata sandi baru minimal 6 karakter', 'error');
        return;
      }
      if (profilePassword !== profileConfirmPassword) {
        showToast('Konfirmasi kata sandi tidak cocok', 'error');
        return;
      }
    }

    // Determine system role automatically from ecclesiastical role if set
    let sysRole: UserRole = editingProfile.role || 'pengurus_kas';
    if (editingProfile.ecclesiastical_role) {
      const match = HKBP_ROLES.find((r) => r.key === editingProfile.ecclesiastical_role);
      if (match) sysRole = match.systemRole;
    }

    const payload: Partial<Profile> & { password?: string } = {
      ...editingProfile,
      role: sysRole,
      ...(profilePassword ? { password: profilePassword } : {}),
    };

    const res = await saveProfile(payload);
    if (res.success) {
      showToast(editingProfile.id ? 'Profil & kata sandi pengguna berhasil diperbarui' : 'Pengguna baru berhasil didaftarkan');
      setEditingProfile(null);
      setProfilePassword('');
      setProfileConfirmPassword('');
    } else {
      showToast(res.error || 'Gagal menyimpan data pengguna', 'error');
    }
  };

  const handleExecuteResetUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;
    if (!resetNewPassword || resetNewPassword.length < 6) {
      showToast('Kata sandi baru minimal 6 karakter', 'error');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      showToast('Konfirmasi kata sandi tidak cocok', 'error');
      return;
    }

    const res = await saveProfile({
      ...resetPasswordUser,
      password: resetNewPassword,
    });
    if (res.success) {
      showToast(`Kata sandi untuk ${resetPasswordUser.full_name} berhasil diatur`);
      setResetPasswordUser(null);
      setResetNewPassword('');
      setResetConfirmPassword('');
      setShowResetPassword(false);
    } else {
      showToast(res.error || 'Gagal memperbarui kata sandi pengguna', 'error');
    }
  };

  const handleExecuteDeleteProfile = async () => {
    if (!deletingProfile) return;
    const res = await deleteProfile(deletingProfile.id);
    if (res.success) {
      showToast(`Pengguna ${deletingProfile.full_name} berhasil dihapus`);
      setDeletingProfile(null);
    } else {
      showToast(res.error || 'Gagal menghapus pengguna', 'error');
    }
  };

  const handleToggleUserStatus = async (user: Profile) => {
    const res = await toggleProfileActive(user.id);
    if (res.success) {
      showToast(`Status pengguna ${user.full_name} diubah menjadi ${!user.is_active ? 'Aktif' : 'Non-Aktif'}`);
    }
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return profiles.filter((u) => {
      // Category filter
      if (userCategoryFilter !== 'all') {
        const roleDef = HKBP_ROLES.find((r) => r.key === u.ecclesiastical_role);
        if (userCategoryFilter === 'pelayan_tahbisan') {
          if (u.tohonan === 'non_tahbisan' || (!u.tohonan && !['pendeta_ressort', 'majelis'].includes(u.role))) return false;
        } else if (roleDef && roleDef.category !== userCategoryFilter) {
          return false;
        }
      }

      // Search query
      if (userSearch.trim()) {
        const q = userSearch.toLowerCase();
        const nameMatch = u.full_name.toLowerCase().includes(q);
        const emailMatch = u.email.toLowerCase().includes(q);
        const phoneMatch = u.phone?.toLowerCase().includes(q) || false;
        const wijkMatch = u.wijk?.toLowerCase().includes(q) || false;
        const seksiMatch = u.seksi_name?.toLowerCase().includes(q) || false;
        return nameMatch || emailMatch || phoneMatch || wijkMatch || seksiMatch;
      }
      return true;
    });
  }, [profiles, userCategoryFilter, userSearch]);

  // Kas delete integrity metrics
  const deletingKasMetrics = useMemo(() => {
    if (!deletingKas) {
      return {
        txCount: 0,
        obCount: 0,
        budgetCount: 0,
        assetCount: 0,
        advCount: 0,
        rpCount: 0,
        accessCount: 0,
        hasLinkedData: false,
      };
    }
    const txCount = transactions.filter((t) => t.kas_id === deletingKas.id).length;
    const obCount = openingBalances.filter((b) => b.kas_id === deletingKas.id).length;
    const budgetCount = budgets.filter((b) => b.kas_id === deletingKas.id).length;
    const assetCount = fixedAssets.filter((a) => a.kas_id === deletingKas.id).length;
    const advCount = advances.filter((ad) => ad.kas_id === deletingKas.id).length;
    const rpCount = receivablesPayables.filter((rp) => rp.kas_id === deletingKas.id).length;
    const accessCount = userKasAccessList.filter((u) => u.kas_id === deletingKas.id).length;
    const hasLinkedData =
      txCount > 0 || obCount > 0 || budgetCount > 0 || assetCount > 0 || advCount > 0 || rpCount > 0;
    return { txCount, obCount, budgetCount, assetCount, advCount, rpCount, accessCount, hasLinkedData };
  }, [deletingKas, transactions, openingBalances, budgets, fixedAssets, advances, receivablesPayables, userKasAccessList]);

  // Storage delete integrity metrics
  const deletingStorageMetrics = useMemo(() => {
    if (!deletingStorage) {
      return {
        txCount: 0,
        obCount: 0,
        recCount: 0,
        ccCount: 0,
        advCount: 0,
        hasLinkedData: false,
      };
    }
    const id = deletingStorage.id;
    const txCount = transactions.filter(
      (t) => t.storage_account_id === id || t.transfer_target_storage_id === id
    ).length;
    const obCount =
      openingBalances.filter((b) => b.storage_account_id === id).length +
      openingEntries.filter((e) => e.storage_account_id === id).length +
      openingAdjustments.filter((a) => a.storage_account_id === id).length;
    const recCount = reconciliations.filter((r) => r.storage_account_id === id).length;
    const ccCount = cashCounts.filter((c) => c.storage_account_id === id).length;
    const advCount = advances.filter((a) => a.storage_account_id === id).length;
    const hasLinkedData = txCount > 0 || obCount > 0 || recCount > 0 || ccCount > 0 || advCount > 0;
    return { txCount, obCount, recCount, ccCount, advCount, hasLinkedData };
  }, [deletingStorage, transactions, openingBalances, openingEntries, openingAdjustments, reconciliations, cashCounts, advances]);

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto min-w-0 overflow-hidden">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl text-xs font-semibold text-white animate-in slide-in-from-bottom duration-200 ${
            toastMsg.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
          }`}
        >
          {toastMsg.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Data Master
          </h2>
          <p className="text-xs text-slate-500">
            Kelola kas, tahun anggaran, pengguna, rekening, kategori, saldo awal, dan kebijakan
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto text-xs font-semibold scrollbar-none">
        <button
          onClick={() => setActiveTab('kas')}
          className={`pb-3 px-3 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'kas' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Daftar Kas ({kasList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('years')}
          className={`pb-3 px-3 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'years' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Tahun Anggaran ({fiscalYears.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('families')}
          className={`pb-3 px-3 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'families' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Keluarga &amp; Lingkungan ({families.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 px-3 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'users' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Pengguna & Pelayan Huria ({profiles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('storage')}
          className={`pb-3 px-3 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'storage' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>Rekening & Brankas ({storageAccounts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`pb-3 px-3 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'categories' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Tags className="w-4 h-4" />
          <span>Kategori Anggaran ({categories.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('balances')}
          className={`pb-3 px-3 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'balances' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Saldo Awal Tahun ({settings.active_year})</span>
        </button>

        <button
          onClick={() => setActiveTab('access')}
          className={`pb-3 px-3 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'access' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Penugasan Pengurus Kas</span>
        </button>

        <button
          onClick={() => setActiveTab('policy')}
          className={`pb-3 px-3 transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'policy' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Kebijakan Nota & Saldo</span>
        </button>
      </div>

      {/* ---------------- TAB 1: KAS ---------------- */}
      {activeTab === 'kas' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Daftar Kas dan Entitas Dana Gereja</h3>
              <p className="text-xs text-slate-500">
                Setiap kas mewakili pos dana otonom huria/seksi dengan klasifikasi dana tidak terikat atau terikat (ISAK 35)
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() =>
                  setEditingKas({
                    nama: '',
                    kode: 'KAS-',
                    warna: '#7C9CF5',
                    fund_type: 'unrestricted',
                    is_active: true,
                  })
                }
                className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>+ Tambah Kas Baru</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {kasList.map((k) => (
              <div
                key={k.id}
                className="card-hover bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-3 transition-all hover:shadow-md"
                style={{ borderTopColor: k.warna, borderTopWidth: '5px' }}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{k.nama}</h4>
                      <span className="font-mono text-[10px] text-slate-500 px-1.5 py-0.5 bg-slate-100 rounded-md">
                        {k.kode}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        k.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {k.is_active ? 'Aktif' : 'Non-Aktif'}
                    </span>
                  </div>

                  {/* Fund Classification Badge */}
                  <div className="mb-2">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md ${
                        k.fund_type === 'restricted'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200/60'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                      }`}
                    >
                      <span>{k.fund_type === 'restricted' ? 'Dana Terikat' : 'Dana Tidak Terikat'}</span>
                    </span>
                    {k.restricted_purpose && (
                      <p className="text-[11px] text-amber-700 italic mt-1 line-clamp-1">
                        Tujuan: {k.restricted_purpose}
                      </p>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {k.deskripsi || 'Tidak ada uraian deskripsi kas'}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="w-3.5 h-3.5 rounded-full shadow-xs" style={{ backgroundColor: k.warna }} />
                    <span className="text-slate-400 font-mono text-[11px]">{k.warna}</span>
                  </div>

                  {/* Action Buttons: Edit and Delete for Admin */}
                  {isAdmin && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setEditingKas(k)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition-colors"
                        title="Edit data kas"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => {
                          setConfirmForceDeleteKas(false);
                          setDeleteKasReason('');
                          setDeletingKas(k);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg flex items-center gap-1 transition-colors"
                        title="Hapus kas permanen"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- TAB: TAHUN ANGGARAN (FISCAL YEARS) ---------------- */}
      {activeTab === 'years' && (
        <div className="space-y-5">
          {/* Top Actions & Subheader */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span>Pengaturan Tahun Anggaran & Periode Buku (Fiscal Years)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Kelola tahun anggaran operasional, orientasi pelayanan HKBP, kunci RAPB, dan roll-forward saldo awal
              </p>
            </div>
            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRollForwardModal(true)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors border border-slate-200"
                  title="Salin saldo akhir tahun sebelumnya menjadi saldo awal tahun baru"
                >
                  <RotateCw className="w-3.5 h-3.5 text-primary" />
                  <span>Roll-Forward Saldo</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setEditingFiscalYear({
                      year: (settings?.active_year || 2026) + 1,
                      theme: '',
                      start_date: `${(settings?.active_year || 2026) + 1}-01-01`,
                      end_date: `${(settings?.active_year || 2026) + 1}-12-31`,
                      status: 'planning',
                      is_budget_locked: false,
                      notes: '',
                    })
                  }
                  className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Tambah Tahun Anggaran</span>
                </button>
              </div>
            )}
          </div>

          {/* Current Active Year Executive Spotlight Card */}
          {(() => {
            const currentActiveFY = fiscalYears.find((fy) => fy.year === settings.active_year) || {
              year: settings.active_year,
              theme: 'Tahun Transformasi & Oikoumene Inklusif HKBP',
              status: 'active' as const,
              is_budget_locked: true,
              start_date: `${settings.active_year}-01-01`,
              end_date: `${settings.active_year}-12-31`,
            };
            return (
              <div className="bg-gradient-to-br from-[#0B132B] to-[#1C2541] rounded-2xl p-6 text-white shadow-md border border-slate-700/60 relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <span className="font-semibold text-emerald-300">
                        Tahun Anggaran Aktif
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-400">
                        01 Jan {currentActiveFY.year} — 31 Des {currentActiveFY.year}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-3">
                      <h2 className="text-3xl font-extrabold font-mono tracking-tight text-white">
                        T.A. {currentActiveFY.year}
                      </h2>
                      <span className="text-sm font-medium text-amber-300/90 italic">
                        "{currentActiveFY.theme || 'Orientasi Pelayanan Huria'}"
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                      Seluruh pencatatan transaksi kas, realisasi anggaran belanja (APBG), persembahan sentralisasi 55/45, dan laporan keuangan resmi beroperasi pada periode tahun anggaran ini.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs space-y-1">
                      <div className="text-slate-400 text-[10px] uppercase font-semibold">Status Pengesahan RAPB</div>
                      <div className="flex items-center gap-2">
                        {currentActiveFY.is_budget_locked ? (
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5" /> Terkunci (Rapat Huria)
                          </span>
                        ) : (
                          <span className="text-amber-300 font-bold flex items-center gap-1">
                            <Unlock className="w-3.5 h-3.5" /> Terbuka (Draf/Revisi)
                          </span>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleToggleLock(currentActiveFY.year)}
                            className="text-[10px] text-blue-300 hover:text-white underline ml-1 cursor-pointer"
                          >
                            Ubah
                          </button>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('balances')}
                      className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border border-white/10 cursor-pointer"
                    >
                      <Coins className="w-4 h-4 text-amber-300" />
                      <span>Saldo Awal T.A. {currentActiveFY.year}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Fiscal Years List Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-slate-900">Daftar Periode Tahun Anggaran Huria</h4>
                <p className="text-xs text-slate-500">
                  Arsip dan rencana tahun anggaran yang terdaftar pada sistem SISKEU HKBP
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/60">
                Total: {fiscalYears.length} Tahun
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="p-3.5">Tahun</th>
                    <th className="p-3.5">Tema Orientasi Pelayanan HKBP</th>
                    <th className="p-3.5">Periode Kalender</th>
                    <th className="p-3.5">Status Buku</th>
                    <th className="p-3.5">Status RAPB</th>
                    <th className="p-3.5">Catatan</th>
                    {isAdmin && <th className="p-3.5 text-center">Tindakan</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fiscalYears.map((fy) => {
                    const isActive = fy.year === settings.active_year || fy.status === 'active';
                    return (
                      <tr
                        key={fy.id}
                        className={`hover:bg-slate-50/60 transition-colors ${
                          isActive ? 'bg-primary/5 font-medium' : ''
                        }`}
                      >
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-slate-900">
                              {fy.year}
                            </span>
                            {isActive && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Aktif
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 text-slate-800 font-medium max-w-xs truncate" title={fy.theme}>
                          {fy.theme || '-'}
                        </td>
                        <td className="p-3.5 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                          {fy.start_date} s/d {fy.end_date}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] inline-flex items-center gap-1 ${
                              fy.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                : fy.status === 'closed'
                                ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                            }`}
                          >
                            {fy.status === 'active'
                              ? 'Aktif (Berjalan)'
                              : fy.status === 'closed'
                              ? 'Ditutup (Arsip)'
                              : 'Perencanaan RAPB'}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <button
                            type="button"
                            disabled={!isAdmin}
                            onClick={() => handleToggleLock(fy.year)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 transition-colors ${
                              fy.is_budget_locked
                                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}
                            title={isAdmin ? 'Klik untuk mengubah kunci RAPB' : undefined}
                          >
                            {fy.is_budget_locked ? (
                              <>
                                <Lock className="w-3 h-3 text-slate-500" />
                                <span>Terkunci</span>
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3 h-3 text-blue-500" />
                                <span>Terbuka</span>
                              </>
                            )}
                          </button>
                        </td>
                        <td className="p-3.5 text-slate-500 text-[11px] max-w-xs truncate" title={fy.notes || ''}>
                          {fy.notes || '-'}
                        </td>
                        {isAdmin && (
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {!isActive && (
                                <button
                                  type="button"
                                  onClick={() => handleSwitchActiveYear(fy.year)}
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors border border-emerald-200/60 cursor-pointer"
                                  title="Jadikan tahun anggaran aktif sistem"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  <span>Jadikan Aktif</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setEditingFiscalYear(fy)}
                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Ubah Data Tahun Anggaran"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {!isActive && (
                                <button
                                  type="button"
                                  onClick={() => setDeletingFiscalYear(fy)}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Hapus Tahun Anggaran"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* HKBP Governance Callout Box */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs text-xs space-y-2">
            <div className="font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>Pedoman Tata Kelola Tahun Anggaran Huria (PPKU HKBP)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-600 text-[11px] leading-relaxed pt-1">
              <div className="space-y-1">
                <strong className="text-slate-800 block">1. Periode Kalender 1 Jan — 31 Des</strong>
                <p>Tahun anggaran huria mengikuti kalender Masehi. Seluruh transaksi wajib dibukukan sesuai tanggal transaksi fisik dalam periode tahun berjalan.</p>
              </div>
              <div className="space-y-1">
                <strong className="text-slate-800 block">2. Pengesahan RAPB Parrapotan Huria</strong>
                <p>Rancangan Anggaran Pendapatan dan Belanja (RAPB) yang disahkan Rapat Huria harus dikunci agar tidak dapat diubah tanpa mekanisme APBG-Perubahan.</p>
              </div>
              <div className="space-y-1">
                <strong className="text-slate-800 block">3. Roll-Forward Saldo Awal Otomatis</strong>
                <p>Saldo akhir per 31 Desember otomatis menjadi saldo awal per 1 Januari tahun berikutnya melalui fitur Roll-Forward Saldo tanpa selisih pembukuan.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB: KELUARGA & LINGKUNGAN (MASTER JEMAAT PELEAN TAON) ---------------- */}
      {activeTab === 'families' && (
        <div className="space-y-5">
          {/* Header + Excel Template & Upload Actions */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Home className="w-4 h-4 text-primary" />
                  <span>Master Data Keluarga &amp; Lingkungan (Pelean Taon)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kelola daftar lingkungan dan keluarga wajib Pelean Taon. Mendukung unduh template Excel dan unggah massal (1 sheet maupun multi-sheet per Lingkungan).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadFamilyTemplate}
                  className="min-h-[44px] sm:min-h-[38px] px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Template Excel</span>
                </button>

                {isAdmin && (
                  <>
                    <input
                      ref={familyFileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFamilyExcelFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => familyFileInputRef.current?.click()}
                      className="min-h-[44px] sm:min-h-[38px] px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Upload Excel (.xlsx)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setEditingFamily({
                          nama_keluarga: '',
                          lingkungan:
                            familyLingkunganFilter !== 'all'
                              ? familyLingkunganFilter
                              : lingkunganList[0]?.nama || '',
                          kepala_keluarga: '',
                          notes: '',
                          is_active: true,
                        })
                      }
                      className="min-h-[44px] sm:min-h-[38px] px-3.5 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah Keluarga</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Lingkungan Quick Chips + Management */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Daftar Lingkungan ({lingkunganList.length})
                </span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() =>
                      setEditingLingkungan({
                        nama: '',
                        kode: '',
                        urutan: lingkunganList.length + 1,
                        is_active: true,
                      })
                    }
                    className="min-h-[38px] sm:min-h-0 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Lingkungan</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFamilyLingkunganFilter('all')}
                  className={`min-h-[40px] sm:min-h-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    familyLingkunganFilter === 'all'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Semua ({families.length})
                </button>
                {lingkunganList.map((ling) => {
                  const count = families.filter(
                    (f) => f.lingkungan.trim().toLowerCase() === ling.nama.trim().toLowerCase()
                  ).length;
                  const active = familyLingkunganFilter.toLowerCase() === ling.nama.toLowerCase();
                  return (
                    <div key={ling.id} className="inline-flex items-center">
                      <button
                        type="button"
                        onClick={() => setFamilyLingkunganFilter(active ? 'all' : ling.nama)}
                        className={`min-h-[40px] sm:min-h-0 px-3 py-1.5 text-xs font-semibold border transition-colors ${
                          isAdmin ? 'rounded-l-xl' : 'rounded-xl'
                        } ${
                          active
                            ? 'bg-blue-700 text-white border-blue-700'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {ling.nama} ({count})
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteLingkunganItem(ling)}
                          title={`Hapus Lingkungan ${ling.nama}`}
                          className="min-h-[40px] sm:min-h-0 px-2 py-1.5 rounded-r-xl border border-l-0 border-slate-200 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Search & List */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={familySearch}
                  onChange={(e) => setFamilySearch(e.target.value)}
                  placeholder="Cari nama keluarga, lingkungan, kepala keluarga..."
                  className="w-full min-h-[44px] sm:min-h-0 pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs"
                />
              </div>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                Menampilkan {filteredFamilies.length} dari {families.length} keluarga
              </span>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Nama Keluarga</th>
                    <th className="py-3 px-4">Lingkungan</th>
                    <th className="py-3 px-4">Kepala Keluarga</th>
                    <th className="py-3 px-4">Catatan</th>
                    {isAdmin && <th className="py-3 px-4 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFamilies.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 6 : 5} className="py-12 text-center text-slate-400">
                        Belum ada data keluarga yang sesuai. Gunakan tombol "Tambah Keluarga" atau "Upload Excel (.xlsx)".
                      </td>
                    </tr>
                  ) : (
                    filteredFamilies.map((fam, idx) => (
                      <tr key={fam.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 text-center font-mono text-slate-500 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{fam.nama_keluarga}</td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-semibold text-[11px] border border-blue-100">
                            {fam.lingkungan}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">{fam.kepala_keluarga || '-'}</td>
                        <td className="py-2.5 px-4 text-slate-500">{fam.notes || '-'}</td>
                        {isAdmin && (
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingFamily(fam)}
                                className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Ubah data keluarga"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingFamily(fam)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Hapus data keluarga"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-slate-100 px-4">
              {filteredFamilies.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  Belum ada data keluarga yang sesuai.
                </div>
              ) : (
                filteredFamilies.map((fam, idx) => (
                  <div key={fam.id} className="py-3.5 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-mono text-slate-400 mr-1.5">#{idx + 1}</span>
                        <span className="font-bold text-slate-900 text-sm">{fam.nama_keluarga}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-semibold text-[11px] border border-blue-100 shrink-0">
                        {fam.lingkungan}
                      </span>
                    </div>
                    {(fam.kepala_keluarga || fam.notes) && (
                      <p className="text-[11px] text-slate-500">
                        {fam.kepala_keluarga ? `KK: ${fam.kepala_keluarga}` : ''}
                        {fam.kepala_keluarga && fam.notes ? ' · ' : ''}
                        {fam.notes || ''}
                      </p>
                    )}
                    {isAdmin && (
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingFamily(fam)}
                          className="min-h-[44px] px-3.5 rounded-xl bg-slate-100 text-slate-700 font-semibold inline-flex items-center gap-1.5"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingFamily(fam)}
                          className="min-h-[44px] px-3.5 rounded-xl bg-rose-50 text-rose-700 font-semibold inline-flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB 2: PENGGUNA & PELAYAN HURIA (USER MANAGEMENT) ---------------- */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Top Controls */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-primary" />
                  <span>Manajemen Pengguna & Pelayan Gereja HKBP Hutaraja</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Pembagian peran pelayan gerejawi tingkat Ressort / Huria / Jemaat sesuai Aturan & Peraturan HKBP 2002 Amandemen Keempat
                </p>
              </div>

              {isAdmin && (
                <button
                  onClick={() =>
                    openProfileModal({
                      full_name: '',
                      email: '',
                      phone: '',
                      tohonan: 'sintua',
                      ecclesiastical_role: 'sintua',
                      tingkat: 'huria',
                      is_active: true,
                    })
                  }
                  className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors whitespace-nowrap"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Tambah Pengguna Baru</span>
                </button>
              )}
            </div>

            {/* Filters and Search */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2 border-t border-slate-100">
              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
                <button
                  onClick={() => setUserCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors ${
                    userCategoryFilter === 'all'
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Semua Peran ({profiles.length})
                </button>
                {HKBP_ROLE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setUserCategoryFilter(cat.id)}
                    className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors ${
                      userCategoryFilter === cat.id
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Cari nama, email, wijk..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          {/* Struktur Pengurus Resmi HKBP Ressort Hutaraja */}
          <div className="bg-gradient-to-br from-slate-900 to-[#0B132B] text-white p-5 rounded-2xl border border-slate-800 shadow-xs text-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 font-bold text-sm text-white">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Susunan Pimpinan, Parartaon, Dewan, Pengurus Sopo Godang & Badan Audit</span>
              </div>
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-md bg-slate-800 text-amber-300 border border-slate-700">
                Sekretaris Huria & Bendahara Huria = Bagian dari Parartaon
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-[11px]">
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 space-y-1">
                <span className="text-amber-300 font-bold uppercase text-[10px]">Pimpinan & Keuangan Pusat</span>
                <p><span className="text-slate-400">Pendeta Ressort:</span> <strong>Pdt. Santa Lucia Manurung, S.Th</strong></p>
                <p><span className="text-slate-400">Sekretaris Ressort:</span> <strong>St. Sardi Simanullang</strong></p>
                <p><span className="text-slate-400">Bendahara Umum:</span> <strong>St. Manaek Lumban Gaol</strong> <span className="text-slate-400">(Kas Umum Huria, Pembangunan, Sosial Huria, Transitoris, Sentralisasi)</span></p>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 space-y-1">
                <span className="text-amber-300 font-bold uppercase text-[10px]">Majelis Perbendaharaan (Parartaon)</span>
                <p><span className="text-slate-400">Ketua:</span> <strong>St. Harbet Simanjuntak</strong></p>
                <p><span className="text-slate-400">Anggota:</span> <strong>St. Oloan Silaban</strong>, <strong>St. Tohap Sihombing</strong></p>
                <p className="text-slate-400 italic">Termasuk Sekretaris Huria & Bendahara Huria</p>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 space-y-1">
                <span className="text-amber-300 font-bold uppercase text-[10px]">Ketua Dewan & Sopo Godang</span>
                <p><span className="text-slate-400">Dewan Koinonia:</span> <strong>St. Sondang Samosir</strong></p>
                <p><span className="text-slate-400">Dewan Diakonia:</span> <strong>St. Juangga Sihite</strong></p>
                <p><span className="text-slate-400">Dewan Marturia:</span> <strong>St. Parulian Simaremare</strong></p>
                <p className="pt-0.5"><span className="text-slate-400">Pengurus Sopo Godang (Kas Sopo Godang):</span> Ketua <strong>Dedi Tumanggor</strong>, Sekr. <strong>Usuawan Simanullang</strong>, Bend. <strong>Ria Mega Panjaitan</strong></p>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 space-y-1">
                <span className="text-amber-300 font-bold uppercase text-[10px]">Badan Audit Huria</span>
                <p><span className="text-slate-400">Ketua merangkap Anggota:</span> <strong>Sabar Sianturi, S.E</strong></p>
                <p><span className="text-slate-400">Anggota:</span> <strong>Hendra Supreddi Simaremare, S.I.P</strong></p>
                <p><span className="text-slate-400">Anggota:</span> <strong>Zico Andrianus Simanjuntak</strong></p>
              </div>
            </div>
          </div>

          {/* User Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((u) => {
              const roleMeta = HKBP_ROLES.find((r) => r.key === u.ecclesiastical_role);
              const tohonanObj = TOHONAN_LIST.find((t) => t.id === u.tohonan);

              return (
                <div
                  key={u.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-all"
                >
                  <div>
                    {/* Top Row: Avatar & Status */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm shadow-xs">
                          {u.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 leading-snug">{u.full_name}</h4>
                          <p className="text-[11px] text-slate-400">{u.email}</p>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {u.is_active ? 'Aktif' : 'Non-Aktif'}
                      </span>
                    </div>

                    {/* Role Badges */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        {tohonanObj && tohonanObj.id !== 'non_tahbisan' && (
                          <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-semibold text-[10px] border border-purple-100">
                            {tohonanObj.label}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold text-[10px] border border-blue-100">
                          {roleMeta?.label || u.role}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] uppercase font-mono">
                          {u.tingkat === 'ressort' ? 'Tingkat Ressort' : 'Tingkat Huria'}
                        </span>
                      </div>

                      {/* Additional Details: Wijk or Seksi */}
                      {(u.wijk || u.seksi_name) && (
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          {u.wijk && (
                            <span className="flex items-center gap-1">
                              <Building className="w-3 h-3 text-slate-400" />
                              <span>{u.wijk}</span>
                            </span>
                          )}
                          {u.seksi_name && (
                            <span className="flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-500" />
                              <span>{u.seksi_name}</span>
                            </span>
                          )}
                        </div>
                      )}

                      {u.phone && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 pt-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{u.phone}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 pt-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                            u.password_hash
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          <KeyRound className="w-3 h-3" />
                          <span>{u.password_hash ? 'Password Terpasang' : 'Password Belum Diatur'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for Admin */}
                  {isAdmin && (
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                      <button
                        onClick={() => handleToggleUserStatus(u)}
                        className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors ${
                          u.is_active
                            ? 'text-amber-700 hover:bg-amber-50'
                            : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {u.is_active ? (
                          <>
                            <ToggleRight className="w-4 h-4 text-emerald-600" />
                            <span>Nonaktifkan</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-4 h-4 text-slate-400" />
                            <span>Aktifkan</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setResetPasswordUser(u);
                            setResetNewPassword('');
                            setResetConfirmPassword('');
                            setShowResetPassword(false);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1 transition-colors"
                          title="Atur atau ubah password akun ini"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Password</span>
                        </button>
                        <button
                          onClick={() => openProfileModal(u)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                          <span>Edit</span>
                        </button>
                        {u.id !== 'user-admin' && (
                          <button
                            onClick={() => setDeletingProfile(u)}
                            className="px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg flex items-center gap-1 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------- TAB 3: TEMPAT PENYIMPANAN ---------------- */}
      {activeTab === 'storage' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Rekening Bank & Brankas Tunai</h3>
              <p className="text-xs text-slate-500">
                Tempat fisik penyimpanan dana operasional, kas sentral, dan tabungan pembangunan gereja
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setEditingStorage({ nama: '', tipe: 'bank', nomor_rekening: '', atas_nama: '' })}
                className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Rekening</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {storageAccounts.map((s) => (
              <div key={s.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <span className="font-bold text-sm text-slate-900 block">{s.nama}</span>
                      {s.is_active === false && (
                        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          Non-Aktif
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                      {s.tipe === 'cash' ? 'Tunai / Brankas' : 'Rekening Bank'}
                    </span>
                  </div>
                  {s.nomor_rekening && (
                    <p className="text-xs font-mono text-slate-600">No. Rek: {s.nomor_rekening}</p>
                  )}
                  {s.atas_nama && (
                    <p className="text-xs text-slate-500">a.n: {s.atas_nama}</p>
                  )}
                </div>
                {isAdmin && (
                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => setEditingStorage(s)}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition-colors"
                      title="Ubah data rekening"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Ubah</span>
                    </button>
                    <button
                      onClick={() => {
                        setConfirmForceDeleteStorage(false);
                        setDeleteStorageReason('');
                        setDeletingStorage(s);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg flex items-center gap-1 transition-colors"
                      title="Hapus rekening"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Hapus</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- TAB 4: KATEGORI ---------------- */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Kategori Penerimaan &amp; Pengeluaran</h3>
              <p className="text-xs text-slate-500">
                Penentuan sentralisasi dilakukan langsung saat pencatatan transaksi.
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() =>
                  setEditingCategory({
                    nama: '',
                    tipe: 'income',
                    kode: '',
                    is_active: true,
                    default_kas_id: null,
                  })
                }
                className="px-3.5 py-2 bg-primary text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs shrink-0 self-start sm:self-center"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Kategori</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Income Categories */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="font-bold text-xs text-emerald-700">
                  Kategori Penerimaan ({categories.filter((c) => c.tipe === 'income').length})
                </h4>
              </div>
              <div className="space-y-2">
                {categories
                  .filter((c) => c.tipe === 'income')
                  .map((c) => {
                    const defaultKas = c.default_kas_id ? kasList.find((k) => k.id === c.default_kas_id) : null;

                    return (
                      <div
                        key={c.id}
                        className="p-3 bg-slate-50/70 rounded-xl flex items-center justify-between text-xs gap-2 border border-slate-100 hover:border-slate-200 transition-colors"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="font-semibold text-slate-800">{c.nama}</div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            {c.kode && <span className="font-mono text-slate-400">{c.kode}</span>}
                            {defaultKas && (
                              <span>Kas default: {defaultKas.nama}</span>
                            )}
                          </div>
                        </div>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setEditingCategory(c)}
                            title="Ubah Kategori"
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-white rounded-lg transition-colors shrink-0"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Expense Categories */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <h4 className="font-bold text-xs text-rose-700 flex items-center gap-1.5 border-b pb-2">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Kategori Pengeluaran</span>
              </h4>
              <div className="space-y-2">
                {categories
                  .filter((c) => c.tipe === 'expense')
                  .map((c) => (
                    <div
                      key={c.id}
                      className="p-3 bg-slate-50/70 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-800">{c.nama}</div>
                        {c.kode && <div className="text-[10px] font-mono text-slate-400">{c.kode}</div>}
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => setEditingCategory(c)}
                          className="p-1 text-slate-400 hover:text-slate-700"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB 5: SALDO AWAL ---------------- */}
      {activeTab === 'balances' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Saldo Awal Tahun Anggaran {settings.active_year}
              </h3>
              <p className="text-xs text-slate-500">
                Saldo awal per kas dan tempat simpan yang menjadi dasar buku kas umum
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() =>
                  setEditingBalance({
                    tahun: settings.active_year,
                    amount: 0,
                    kas_id: kasList[0]?.id,
                    storage_account_id: storageAccounts[0]?.id,
                  })
                }
                className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Atur Saldo Awal</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="p-3.5">Kas (Seksi/Entitas)</th>
                    <th className="p-3.5">Tempat Simpan</th>
                    <th className="p-3.5 text-right">Nominal Saldo Awal</th>
                    <th className="p-3.5">Catatan</th>
                    {isAdmin && <th className="p-3.5 text-center">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {openingBalances.map((ob) => {
                    const kas = kasList.find((k) => k.id === ob.kas_id);
                    const stor = storageAccounts.find((s) => s.id === ob.storage_account_id);
                    return (
                      <tr key={ob.id} className="hover:bg-slate-50/50">
                        <td className="p-3.5 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: kas?.warna }} />
                            <span>{kas?.nama || ob.kas_id}</span>
                          </div>
                        </td>
                        <td className="p-3.5 text-slate-600">{stor?.nama || ob.storage_account_id}</td>
                        <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                          {formatRupiah(ob.amount)}
                        </td>
                        <td className="p-3.5 text-slate-500">{ob.notes || '-'}</td>
                        {isAdmin && (
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => setEditingBalance(ob)}
                              className="p-1 text-slate-400 hover:text-slate-700"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB 6: PENUGASAN PENGURUS KAS ---------------- */}
      {activeTab === 'access' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Penugasan Pengurus Kas Seksi</h3>
            <p className="text-xs text-slate-500">
              Bendahara Seksi berwenang mengajukan transaksi; Ketua Seksi berwenang menyetujui transaksi seksi sebelum dibukukan
            </p>

            {isAdmin && (
              <form onSubmit={handleAddAccess} className="flex flex-wrap items-center gap-3 pt-2 border-t text-xs">
                <select
                  value={newAccessUserId}
                  onChange={(e) => setNewAccessUserId(e.target.value)}
                  className="p-2 rounded-xl border border-slate-200 bg-white"
                  required
                >
                  <option value="">Pilih Pengguna...</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.role})
                    </option>
                  ))}
                </select>

                <select
                  value={newAccessKasId}
                  onChange={(e) => setNewAccessKasId(e.target.value)}
                  className="p-2 rounded-xl border border-slate-200 bg-white"
                  required
                >
                  <option value="">Pilih Kas...</option>
                  {kasList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama}
                    </option>
                  ))}
                </select>

                <select
                  value={newAccessLevel}
                  onChange={(e) => setNewAccessLevel(e.target.value as KasAccessLevel)}
                  className="p-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="bendahara">Tingkat Akses: Bendahara / Pencatat Transaksi (Pengaju)</option>
                  <option value="ketua">Tingkat Akses: Ketua (Penyetuju)</option>
                </select>

                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white font-semibold rounded-xl flex items-center gap-1 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambahkan Akses</span>
                </button>
              </form>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="p-3.5">Nama Pengurus</th>
                    <th className="p-3.5">Kas Yang Ditugaskan</th>
                    <th className="p-3.5">Peran / Otoritas</th>
                    {isAdmin && <th className="p-3.5 text-center">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {userKasAccessList.map((a) => {
                    const u = profiles.find((p) => p.id === a.user_id);
                    const k = kasList.find((kas) => kas.id === a.kas_id);
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/50">
                        <td className="p-3.5 font-bold text-slate-900">{u?.full_name || a.user_id}</td>
                        <td className="p-3.5 text-slate-600">{k?.nama || a.kas_id}</td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              a.access_level === 'ketua'
                                ? 'bg-purple-50 text-purple-700'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {a.access_level === 'ketua' ? 'Ketua (Penyetuju)' : 'Bendahara (Pengaju)'}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => removeUserKasAccess(a.id)}
                              className="p-1 text-rose-500 hover:text-rose-700"
                              title="Hapus Penugasan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB 7: KEBIJAKAN NOTA & BATASAN SALDO ---------------- */}
      {activeTab === 'policy' && (
        <div className="space-y-4 max-w-4xl">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-sm border-b border-slate-100 pb-3">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              <span>Kebijakan Nota & Batasan Saldo</span>
            </div>

            <form onSubmit={handleSavePolicy} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-xs">
                    Batas Nominal Pengeluaran Wajib Lampiran Nota (Rp)
                  </label>
                  <input
                    type="number"
                    value={policyForm.receipt_required_threshold}
                    onChange={(e) =>
                      setPolicyForm({ ...policyForm, receipt_required_threshold: Number(e.target.value) })
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                    required
                    min={0}
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Saat ini: {formatRupiah(policyForm.receipt_required_threshold)}
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-xs">
                    Tahun Anggaran Aktif
                  </label>
                  <input
                    type="number"
                    value={policyForm.active_year}
                    onChange={(e) =>
                      setPolicyForm({ ...policyForm, active_year: Number(e.target.value) })
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                    required
                    min={2000}
                    max={2100}
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                    <span>Tahun operasional: {policyForm.active_year}</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('years')}
                      className="text-primary hover:underline font-semibold cursor-pointer"
                    >
                      Buka Kelola Tahun Anggaran &rarr;
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2 pt-2">
                  <label className="flex items-start sm:items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={policyForm.block_negative_balance}
                      onChange={(e) =>
                        setPolicyForm({ ...policyForm, block_negative_balance: e.target.checked })
                      }
                      className="w-4 h-4 text-primary rounded-md focus:ring-primary/40 mt-0.5 sm:mt-0"
                    />
                    <div>
                      <span className="font-semibold text-slate-800 block text-xs sm:text-sm">
                        Blokir Transaksi yang Menyebabkan Saldo Kas Negatif
                      </span>
                      <span className="text-slate-500 text-[11px] block">
                        Mencegah pencatatan pengeluaran jika saldo resmi kas tidak mencukupi
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 text-[11px] text-slate-600 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  <span>Kepatuhan PPKU Sentralisasi & Tertib Keuangan</span>
                </div>
                <p>
                  Parameter ini mengendalikan verifikasi nota pada seluruh transaksi pengeluaran kas huria dan seksi, serta mencegah defisit kas tidak sah pada pembukuan.
                </p>
              </div>

              {isAdmin && (
                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-2 text-xs"
                  >
                    <Save className="w-4 h-4" />
                    <span>Simpan Kebijakan Nota & Saldo</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODALS ---------------- */}

      {/* Modal Edit/Add Fiscal Year */}
      {editingFiscalYear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span>{editingFiscalYear.id ? 'Ubah Tahun Anggaran' : 'Tambah Periode Tahun Anggaran Baru'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingFiscalYear(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFiscalYear} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tahun Anggaran</label>
                  <input
                    type="number"
                    value={editingFiscalYear.year || ''}
                    onChange={(e) =>
                      setEditingFiscalYear({ ...editingFiscalYear, year: Number(e.target.value) })
                    }
                    placeholder="Contoh: 2027"
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold text-sm"
                    required
                    min={2000}
                    max={2100}
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status Periode Buku</label>
                  <select
                    value={editingFiscalYear.status || 'planning'}
                    onChange={(e) =>
                      setEditingFiscalYear({ ...editingFiscalYear, status: e.target.value as any })
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="active">Aktif (Tahun Berjalan)</option>
                    <option value="planning">Perencanaan RAPB (Mendatang)</option>
                    <option value="closed">Ditutup / Final (Arsip)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tema Orientasi Pelayanan HKBP
                </label>
                <input
                  type="text"
                  value={editingFiscalYear.theme || ''}
                  onChange={(e) =>
                    setEditingFiscalYear({ ...editingFiscalYear, theme: e.target.value })
                  }
                  placeholder="Contoh: Tahun Kesehatian Pelayanan & Misi HKBP"
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Mulai Periode</label>
                  <input
                    type="date"
                    value={editingFiscalYear.start_date || `${editingFiscalYear.year || 2026}-01-01`}
                    onChange={(e) =>
                      setEditingFiscalYear({ ...editingFiscalYear, start_date: e.target.value })
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Akhir Periode</label>
                  <input
                    type="date"
                    value={editingFiscalYear.end_date || `${editingFiscalYear.year || 2026}-12-31`}
                    onChange={(e) =>
                      setEditingFiscalYear({ ...editingFiscalYear, end_date: e.target.value })
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2.5 cursor-pointer p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    checked={editingFiscalYear.is_budget_locked || false}
                    onChange={(e) =>
                      setEditingFiscalYear({ ...editingFiscalYear, is_budget_locked: e.target.checked })
                    }
                    className="w-4 h-4 text-primary rounded-md focus:ring-primary/40"
                  />
                  <div>
                    <span className="font-semibold text-slate-800 block">Kunci Anggaran (RAPB Terkunci)</span>
                    <span className="text-slate-500 text-[11px]">Tandai jika anggaran telah disahkan Parrapotan Huria dan tidak boleh diubah langsung</span>
                  </div>
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan Tambahan (Opsional)</label>
                <textarea
                  value={editingFiscalYear.notes || ''}
                  onChange={(e) =>
                    setEditingFiscalYear({ ...editingFiscalYear, notes: e.target.value })
                  }
                  rows={2}
                  placeholder="Catatan sidang Huria, nomor SK, atau disposisi pimpinan..."
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingFiscalYear(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 rounded-xl font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl shadow-xs"
                >
                  Simpan Tahun Anggaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirm Delete Fiscal Year */}
      {deletingFiscalYear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Hapus Tahun Anggaran</h3>
                <p className="text-xs text-slate-500">T.A. {deletingFiscalYear.year}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus data Tahun Anggaran <strong>{deletingFiscalYear.year}</strong> ({deletingFiscalYear.theme})?
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingFiscalYear(null)}
                className="px-4 py-2 text-slate-600 text-xs font-semibold rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteDeleteFiscalYear}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Roll-Forward Saldo Awal */}
      {showRollForwardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-primary flex items-center justify-center">
                  <RotateCw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Roll-Forward Saldo Kas Akhir Tahun</h3>
                  <p className="text-[11px] text-slate-500">Pindahan buku saldo kas akhir tahun ke tahun anggaran baru</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRollForwardModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Fitur ini secara otomatis menghitung <strong>saldo akhir bersih</strong> seluruh kas dan tempat penyimpanan per 31 Desember tahun sumber, dan menyalinnya sebagai <strong>saldo awal resmi</strong> pada tahun anggaran tujuan.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Dari Tahun Buku</label>
                  <select
                    value={rollForwardFromYear}
                    onChange={(e) => setRollForwardFromYear(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-mono font-bold"
                  >
                    {fiscalYears.map((fy) => (
                      <option key={fy.id} value={fy.year}>
                        T.A. {fy.year} ({fy.status === 'closed' ? 'Arsip' : fy.year})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ke Tahun Tujuan</label>
                  <select
                    value={rollForwardToYear}
                    onChange={(e) => setRollForwardToYear(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-mono font-bold"
                  >
                    {fiscalYears.map((fy) => (
                      <option key={fy.id} value={fy.year}>
                        T.A. {fy.year} {fy.year === settings.active_year ? '(Aktif)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-amber-900 text-[11px] space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Catatan Prosedural Bendahara</span>
                </div>
                <p>
                  Saldo awal lama untuk tahun {rollForwardToYear} akan disesuaikan dengan nilai saldo kas penutupan tahun {rollForwardFromYear}.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowRollForwardModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 rounded-xl font-semibold"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isRollingForward || rollForwardFromYear === rollForwardToYear}
                  onClick={handleExecuteRollForward}
                  className="px-5 py-2 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isRollingForward ? 'animate-spin' : ''}`} />
                  <span>{isRollingForward ? 'Memproses...' : 'Jalankan Roll-Forward'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit/Add Kas */}
      {editingKas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                {editingKas.id ? 'Ubah Data Kas' : 'Tambah Kas Baru'}
              </h3>
              <button onClick={() => setEditingKas(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveKas} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Kas</label>
                <input
                  type="text"
                  value={editingKas.nama || ''}
                  onChange={(e) => setEditingKas({ ...editingKas, nama: e.target.value })}
                  placeholder="Contoh: Kas Kaum Lansia"
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kode Unik</label>
                <input
                  type="text"
                  value={editingKas.kode || ''}
                  onChange={(e) => setEditingKas({ ...editingKas, kode: e.target.value.toUpperCase() })}
                  placeholder="Contoh: KAS-LANSIA"
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-mono"
                  required
                />
              </div>

              {/* Fund Classification (ISAK 35) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Klasifikasi Dana (ISAK 35)</label>
                <select
                  value={editingKas.fund_type || 'unrestricted'}
                  onChange={(e) =>
                    setEditingKas({
                      ...editingKas,
                      fund_type: e.target.value as 'unrestricted' | 'restricted',
                    })
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="unrestricted">Dana Tidak Terikat (Operasional Bebas Huria)</option>
                  <option value="restricted">Dana Terikat (Diakonia, Pembangunan, Amanah Donatur)</option>
                </select>
              </div>

              {editingKas.fund_type === 'restricted' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tujuan Pembatasan Dana</label>
                  <input
                    type="text"
                    value={editingKas.restricted_purpose || ''}
                    onChange={(e) => setEditingKas({ ...editingKas, restricted_purpose: e.target.value })}
                    placeholder="Contoh: Renovasi Pastori dan Bantuan Duka"
                    className="w-full p-2 rounded-xl border border-slate-200"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Warna Pengenal Pastel</label>
                <div className="flex items-center gap-2">
                  {PASTEL_PALETTE.map((hex) => (
                    <button
                      type="button"
                      key={hex}
                      onClick={() => setEditingKas({ ...editingKas, warna: hex })}
                      className={`w-6 h-6 rounded-full border-2 ${
                        editingKas.warna === hex ? 'border-slate-800 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deskripsi</label>
                <textarea
                  value={editingKas.deskripsi || ''}
                  onChange={(e) => setEditingKas({ ...editingKas, deskripsi: e.target.value })}
                  rows={2}
                  className="w-full p-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="kas_active"
                  checked={editingKas.is_active !== false}
                  onChange={(e) => setEditingKas({ ...editingKas, is_active: e.target.checked })}
                  className="rounded text-primary focus:ring-primary w-4 h-4"
                />
                <label htmlFor="kas_active" className="text-xs text-slate-700 font-medium">
                  Kas Aktif (dapat digunakan untuk transaksi baru)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingKas(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 rounded-xl font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl shadow-xs"
                >
                  Simpan Data Kas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Hapus Kas (Admin Permanen / Nonaktifkan) */}
      {deletingKas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-3 text-rose-600">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Konfirmasi Hapus Data Kas</h3>
                  <p className="text-xs text-slate-500">
                    {deletingKas.nama} ({deletingKas.kode})
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isDeletingKasLoading}
                onClick={() => {
                  setDeletingKas(null);
                  setConfirmForceDeleteKas(false);
                  setDeleteKasReason('');
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!deletingKasMetrics.hasLinkedData ? (
              <div className="space-y-3 text-xs">
                <p className="text-slate-600 leading-relaxed">
                  Kas ini belum memiliki catatan transaksi, saldo awal, anggaran, maupun aset terkait. Apakah Anda yakin ingin menghapus Kas{' '}
                  <strong>{deletingKas.nama}</strong> secara permanen dari sistem dan database Supabase?
                </p>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-[11px]">
                  Pemeriksaan integritas lolos: aman dihapus permanen.
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-950 space-y-2">
                  <p className="font-bold flex items-center gap-1.5 text-rose-800">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Peringatan Penghapusan Kas Beserta Data Terkait</span>
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    Kas ini memiliki rekam data terkait di dalam sistem:
                  </p>
                  <ul className="list-disc list-inside text-[11px] space-y-0.5 font-medium">
                    {deletingKasMetrics.txCount > 0 && <li>{deletingKasMetrics.txCount} Catatan Transaksi Kas</li>}
                    {deletingKasMetrics.obCount > 0 && <li>{deletingKasMetrics.obCount} Data Saldo Awal Tahun</li>}
                    {deletingKasMetrics.budgetCount > 0 && <li>{deletingKasMetrics.budgetCount} Dokumen Anggaran (APBG)</li>}
                    {deletingKasMetrics.assetCount > 0 && <li>{deletingKasMetrics.assetCount} Aset Inventaris Huria (akan dilepas keterkaitannya)</li>}
                    {deletingKasMetrics.advCount > 0 && <li>{deletingKasMetrics.advCount} Data Panjar Kegiatan</li>}
                    {deletingKasMetrics.rpCount > 0 && <li>{deletingKasMetrics.rpCount} Data Piutang / Utang</li>}
                    {deletingKasMetrics.accessCount > 0 && <li>{deletingKasMetrics.accessCount} Penugasan Hak Akses Pengurus</li>}
                  </ul>
                  <p className="text-[11px] pt-1 text-rose-900">
                    Jika memilih <strong>Hapus Permanen</strong>, seluruh transaksi, saldo awal, dan anggaran milik kas ini ikut terhapus dari Supabase. Jika hanya ingin menyembunyikannya dari transaksi baru tanpa menghapus riwayat, pilih <strong>Nonaktifkan Saja</strong>.
                  </p>
                </div>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-rose-200 bg-rose-50/40 cursor-pointer text-[11px] text-slate-800">
                  <input
                    type="checkbox"
                    checked={confirmForceDeleteKas}
                    onChange={(e) => setConfirmForceDeleteKas(e.target.checked)}
                    className="mt-0.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span>
                    Saya yakin sebagai <strong>Admin</strong> untuk menghapus Kas <strong>{deletingKas.nama}</strong> secara permanen beserta data terikat di atas.
                  </span>
                </label>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Alasan Penghapusan (Audit Trail, Opsional)
              </label>
              <input
                type="text"
                value={deleteKasReason}
                onChange={(e) => setDeleteKasReason(e.target.value)}
                placeholder="Contoh: Duplikat kas atau restrukturisasi pos kas..."
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-rose-300"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                disabled={isDeletingKasLoading}
                onClick={() => {
                  setDeletingKas(null);
                  setConfirmForceDeleteKas(false);
                  setDeleteKasReason('');
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-semibold text-xs rounded-xl border border-slate-200 disabled:opacity-50"
              >
                Batal
              </button>

              {deletingKas.is_active !== false && (
                <button
                  type="button"
                  disabled={isDeletingKasLoading}
                  onClick={handleDeactivateKas}
                  className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold text-xs rounded-xl flex items-center gap-1 disabled:opacity-50"
                >
                  <ToggleLeft className="w-4 h-4" />
                  <span>Nonaktifkan Saja</span>
                </button>
              )}

              <button
                type="button"
                disabled={
                  isDeletingKasLoading ||
                  (deletingKasMetrics.hasLinkedData && !confirmForceDeleteKas)
                }
                onClick={handleExecuteDeleteKas}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingKasLoading ? 'Menghapus...' : 'Hapus Permanen'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Pengguna (User Management) */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl p-6 space-y-4 my-8">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-primary" />
                  <span>{editingProfile.id ? 'Ubah Data Pengguna / Pelayan' : 'Tambah Pengguna Baru HKBP'}</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Tingkat Ressort / Huria / Jemaat sesuai Aturan & Peraturan HKBP 2002 Amandemen IV
                </p>
              </div>
              <button onClick={() => setEditingProfile(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Lengkap & Gelar Gerejawi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingProfile.full_name || ''}
                  onChange={(e) => setEditingProfile({ ...editingProfile, full_name: e.target.value })}
                  placeholder="Contoh: St. B. Hutapea / Ny. M. Boru Tampubolon"
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Alamat Email (Login) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={editingProfile.email || ''}
                    onChange={(e) => setEditingProfile({ ...editingProfile, email: e.target.value })}
                    placeholder="nama@hkbp-hutaraja.org"
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nomor Telepon / WhatsApp</label>
                  <input
                    type="tel"
                    value={editingProfile.phone || ''}
                    onChange={(e) => setEditingProfile({ ...editingProfile, phone: e.target.value })}
                    placeholder="0812-xxxx-xxxx"
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              {/* Tohonan & Tingkat */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tohonan Tahbisan HKBP</label>
                  <select
                    value={editingProfile.tohonan || 'sintua'}
                    onChange={(e) => setEditingProfile({ ...editingProfile, tohonan: e.target.value as TohonanType })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                  >
                    {TOHONAN_LIST.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label} {t.prefix ? `(${t.prefix})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tingkat Wilayah Pelayanan</label>
                  <select
                    value={editingProfile.tingkat || 'huria'}
                    onChange={(e) => setEditingProfile({ ...editingProfile, tingkat: e.target.value as HuriaLevel })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="huria">Tingkat Huria (Jemaat Lokal)</option>
                    <option value="ressort">Tingkat Ressort</option>
                  </select>
                </div>
              </div>

              {/* Peran Struktural HKBP */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Peran Struktural HKBP (Pasal 1, 4, 5, 6, 7 & 44)
                </label>
                <select
                  value={editingProfile.ecclesiastical_role || 'sintua'}
                  onChange={(e) => {
                    const chosen = e.target.value as EcclesiasticalRole;
                    const match = HKBP_ROLES.find((r) => r.key === chosen);
                    setEditingProfile({
                      ...editingProfile,
                      ecclesiastical_role: chosen,
                      tohonan: match?.defaultTohonan || editingProfile.tohonan,
                      tingkat: match?.tingkat || editingProfile.tingkat,
                      role: match?.systemRole || 'pengurus_kas',
                    });
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                >
                  {HKBP_ROLE_CATEGORIES.map((cat) => (
                    <optgroup key={cat.id} label={cat.name}>
                      {HKBP_ROLES.filter((r) => r.category === cat.id).map((r) => (
                        <option key={r.key} value={r.key}>
                          {r.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Optional Section name or Wijk */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Seksi / Panitia (Opsional)</label>
                  <input
                    type="text"
                    value={editingProfile.seksi_name || ''}
                    onChange={(e) => setEditingProfile({ ...editingProfile, seksi_name: e.target.value })}
                    placeholder="Contoh: Seksi Sekolah Minggu"
                    className="w-full p-2 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Wijk / Sektor Lingkungan (Opsional)</label>
                  <input
                    type="text"
                    value={editingProfile.wijk || ''}
                    onChange={(e) => setEditingProfile({ ...editingProfile, wijk: e.target.value })}
                    placeholder="Contoh: Wijk II / Sektor 3"
                    className="w-full p-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              {/* Advisory note for Badan Audit */}
              {['ketua_badan_audit', 'anggota_badan_audit'].includes(editingProfile.ecclesiastical_role || '') && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-800">
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    <span>Prinsip Independensi Badan Audit Huria (Pasal 7 & 44)</span>
                  </div>
                  <p>
                    Anggota Badan Audit tidak boleh merangkap jabatan Bendahara Huria, Pendeta Ressort, Sekretaris Huria, atau pengurus pada kas mana pun.
                  </p>
                </div>
              )}

              {/* Password Section inside Add/Edit User Modal */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <KeyRound className="w-3.5 h-3.5 text-primary" />
                    <span>
                      {editingProfile.id
                        ? 'Atur / Ubah Kata Sandi Akun (Opsional)'
                        : 'Kata Sandi Login Akun Baru'}
                    </span>
                    {!editingProfile.id && <span className="text-rose-500">*</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowProfilePassword((prev) => !prev)}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    {showProfilePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showProfilePassword ? 'Sembunyikan' : 'Tampilkan'}</span>
                  </button>
                </div>

                {editingProfile.id && (
                  <p className="text-[11px] text-slate-500">
                    Kosongkan kolom di bawah jika tidak ingin mengubah kata sandi pengguna saat ini.
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {editingProfile.id ? 'Kata Sandi Baru' : 'Kata Sandi'}
                    </label>
                    <input
                      type={showProfilePassword ? 'text' : 'password'}
                      value={profilePassword}
                      onChange={(e) => setProfilePassword(e.target.value)}
                      placeholder={editingProfile.id ? 'Kosongkan jika tetap' : 'Minimal 6 karakter'}
                      autoComplete="new-password"
                      className="w-full p-2 rounded-xl border border-slate-200 bg-white"
                      required={!editingProfile.id}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Konfirmasi Kata Sandi
                    </label>
                    <input
                      type={showProfilePassword ? 'text' : 'password'}
                      value={profileConfirmPassword}
                      onChange={(e) => setProfileConfirmPassword(e.target.value)}
                      placeholder="Ulangi kata sandi"
                      autoComplete="new-password"
                      className="w-full p-2 rounded-xl border border-slate-200 bg-white"
                      required={!editingProfile.id || profilePassword.length > 0}
                    />
                  </div>
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="user_active"
                  checked={editingProfile.is_active !== false}
                  onChange={(e) => setEditingProfile({ ...editingProfile, is_active: e.target.checked })}
                  className="rounded text-primary focus:ring-primary w-4 h-4"
                />
                <label htmlFor="user_active" className="text-xs text-slate-700 font-medium">
                  Pengguna Aktif (dapat masuk dan menjalankan wewenang sistem)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingProfile(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 rounded-xl font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl shadow-xs"
                >
                  Simpan Data Pengguna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Atur / Reset Password Khusus Pengguna */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-primary" />
                  <span>Atur Kata Sandi Akun</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {resetPasswordUser.full_name} ({resetPasswordUser.email})
                </p>
              </div>
              <button
                onClick={() => setResetPasswordUser(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteResetUserPassword} className="space-y-3 text-xs">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowResetPassword((prev) => !prev)}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                >
                  {showResetPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showResetPassword ? 'Sembunyikan' : 'Tampilkan'}</span>
                </button>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kata Sandi Baru <span className="text-rose-500">*</span>
                </label>
                <input
                  type={showResetPassword ? 'text' : 'password'}
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  autoComplete="new-password"
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Konfirmasi Kata Sandi Baru <span className="text-rose-500">*</span>
                </label>
                <input
                  type={showResetPassword ? 'text' : 'password'}
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi baru"
                  autoComplete="new-password"
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setResetPasswordUser(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 rounded-xl font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl shadow-xs"
                >
                  Simpan Kata Sandi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Pengguna */}
      {deletingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 border-b pb-3">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-sm text-slate-900">Hapus Pengguna</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus pengguna <strong>{deletingProfile.full_name}</strong> ({deletingProfile.email})?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingProfile(null)}
                className="px-4 py-2 text-slate-600 text-xs font-semibold rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteDeleteProfile}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl"
              >
                Hapus Pengguna
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit/Add Storage Account */}
      {editingStorage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                {editingStorage.id ? 'Ubah Tempat Simpan' : 'Tambah Rekening / Brankas'}
              </h3>
              <button onClick={() => setEditingStorage(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveStorage} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Tempat Simpan</label>
                <input
                  type="text"
                  value={editingStorage.nama || ''}
                  onChange={(e) => setEditingStorage({ ...editingStorage, nama: e.target.value })}
                  placeholder="Contoh: Bank BNI HKBP Hutaraja"
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipe</label>
                <select
                  value={editingStorage.tipe || 'bank'}
                  onChange={(e) =>
                    setEditingStorage({
                      ...editingStorage,
                      tipe: e.target.value as 'cash' | 'bank',
                    })
                  }
                  className="w-full p-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="bank">Rekening Bank</option>
                  <option value="cash">Tunai / Brankas</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nomor Rekening</label>
                <input
                  type="text"
                  value={editingStorage.nomor_rekening || ''}
                  onChange={(e) => setEditingStorage({ ...editingStorage, nomor_rekening: e.target.value })}
                  placeholder="Contoh: 109-00-1234567-8"
                  className="w-full p-2 rounded-xl border border-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Atas Nama</label>
                <input
                  type="text"
                  value={editingStorage.atas_nama || ''}
                  onChange={(e) => setEditingStorage({ ...editingStorage, atas_nama: e.target.value })}
                  placeholder="Contoh: BPH HKBP Hutaraja"
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="storage_active"
                  checked={editingStorage.is_active !== false}
                  onChange={(e) => setEditingStorage({ ...editingStorage, is_active: e.target.checked })}
                  className="rounded text-primary focus:ring-primary w-4 h-4"
                />
                <label htmlFor="storage_active" className="text-xs text-slate-700 font-medium">
                  Rekening / Brankas Aktif (digunakan pada transaksi &amp; rekonsiliasi)
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStorage(null)}
                  className="px-4 py-2 text-slate-600 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-white font-semibold rounded-xl"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Hapus Rekening / Tempat Penyimpanan (Admin) */}
      {deletingStorage && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-3 text-rose-600">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Konfirmasi Hapus Rekening / Brankas</h3>
                  <p className="text-xs text-slate-500">
                    {deletingStorage.nama} ({deletingStorage.tipe === 'cash' ? 'Tunai / Brankas' : 'Rekening Bank'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isDeletingStorageLoading}
                onClick={() => {
                  setDeletingStorage(null);
                  setConfirmForceDeleteStorage(false);
                  setDeleteStorageReason('');
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!deletingStorageMetrics.hasLinkedData ? (
              <div className="space-y-3 text-xs">
                <p className="text-slate-600 leading-relaxed">
                  Rekening ini belum memiliki transaksi, saldo awal, rekonsiliasi, maupun opname kas terkait. Apakah Anda yakin ingin menghapus{' '}
                  <strong>{deletingStorage.nama}</strong> secara permanen dari sistem dan database?
                </p>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-[11px]">
                  Pemeriksaan integritas lolos: aman dihapus permanen.
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-950 space-y-2">
                  <p className="font-bold flex items-center gap-1.5 text-rose-800">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Peringatan Penghapusan Rekening Beserta Data Terkait</span>
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    Rekening / tempat penyimpanan ini masih terhubung dengan rekam data berikut:
                  </p>
                  <ul className="list-disc list-inside text-[11px] space-y-0.5 font-medium">
                    {deletingStorageMetrics.txCount > 0 && <li>{deletingStorageMetrics.txCount} Catatan Transaksi Kas</li>}
                    {deletingStorageMetrics.obCount > 0 && <li>{deletingStorageMetrics.obCount} Data Saldo Awal / Pembukaan Buku</li>}
                    {deletingStorageMetrics.recCount > 0 && <li>{deletingStorageMetrics.recCount} Berita Acara Rekonsiliasi</li>}
                    {deletingStorageMetrics.ccCount > 0 && <li>{deletingStorageMetrics.ccCount} Catatan Opname Kas Fisik</li>}
                    {deletingStorageMetrics.advCount > 0 && <li>{deletingStorageMetrics.advCount} Data Panjar Kegiatan (keterkaitan rekening akan dilepas)</li>}
                  </ul>
                  <p className="text-[11px] pt-1 text-rose-900">
                    Jika memilih <strong>Hapus Permanen</strong>, seluruh transaksi, saldo awal, rekonsiliasi, dan opname pada rekening ini ikut terhapus. Jika hanya ingin menyembunyikannya dari transaksi baru, pilih <strong>Nonaktifkan Saja</strong>.
                  </p>
                </div>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-rose-200 bg-rose-50/40 cursor-pointer text-[11px] text-slate-800">
                  <input
                    type="checkbox"
                    checked={confirmForceDeleteStorage}
                    onChange={(e) => setConfirmForceDeleteStorage(e.target.checked)}
                    className="mt-0.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span>
                    Saya yakin sebagai <strong>Admin</strong> untuk menghapus Rekening <strong>{deletingStorage.nama}</strong> secara permanen beserta data terkait di atas.
                  </span>
                </label>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Alasan Penghapusan (Audit Trail, Opsional)
              </label>
              <input
                type="text"
                value={deleteStorageReason}
                onChange={(e) => setDeleteStorageReason(e.target.value)}
                placeholder="Contoh: Rekening ditutup atau duplikat data rekening..."
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-rose-300"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                disabled={isDeletingStorageLoading}
                onClick={() => {
                  setDeletingStorage(null);
                  setConfirmForceDeleteStorage(false);
                  setDeleteStorageReason('');
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-semibold text-xs rounded-xl border border-slate-200 disabled:opacity-50"
              >
                Batal
              </button>

              {deletingStorage.is_active !== false && (
                <button
                  type="button"
                  disabled={isDeletingStorageLoading}
                  onClick={handleDeactivateStorage}
                  className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold text-xs rounded-xl flex items-center gap-1 disabled:opacity-50"
                >
                  <ToggleLeft className="w-4 h-4" />
                  <span>Nonaktifkan Saja</span>
                </button>
              )}

              <button
                type="button"
                disabled={
                  isDeletingStorageLoading ||
                  (deletingStorageMetrics.hasLinkedData && !confirmForceDeleteStorage)
                }
                onClick={handleExecuteDeleteStorage}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingStorageLoading ? 'Menghapus...' : 'Hapus Permanen'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit/Add Category */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl p-5 sm:p-6 space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                {editingCategory.id ? 'Ubah Kategori' : 'Tambah Kategori'}
              </h3>
              <button onClick={() => setEditingCategory(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCategory} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Kategori</label>
                <input
                  type="text"
                  value={editingCategory.nama || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, nama: e.target.value })}
                  placeholder="Contoh: Pelean Partangiangan / Ucapan Syukur"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipe</label>
                  <select
                    value={editingCategory.tipe || 'income'}
                    onChange={(e) =>
                      setEditingCategory({
                        ...editingCategory,
                        tipe: e.target.value as 'income' | 'expense',
                      })
                    }
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="income">Pemasukan</option>
                    <option value="expense">Pengeluaran</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode Akun</label>
                  <input
                    type="text"
                    value={editingCategory.kode || ''}
                    onChange={(e) => setEditingCategory({ ...editingCategory, kode: e.target.value.toUpperCase() })}
                    placeholder="IN-15"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
              </div>

              {editingCategory.tipe === 'income' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kas Default (Opsional)
                  </label>
                  <select
                    value={editingCategory.default_kas_id || ''}
                    onChange={(e) =>
                      setEditingCategory({
                        ...editingCategory,
                        default_kas_id: e.target.value || null,
                      })
                    }
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs"
                  >
                    <option value="">Sesuai pilihan saat transaksi</option>
                    {kasList
                      .filter((k) => k.is_active && k.id !== 'kas-9')
                      .map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.nama} ({k.kode})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deskripsi / Catatan</label>
                <textarea
                  value={editingCategory.deskripsi || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, deskripsi: e.target.value })}
                  rows={2}
                  placeholder="Keterangan singkat penggunaan pos kategori ini..."
                  className="w-full p-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 text-slate-600 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-white font-semibold rounded-xl"
                >
                  Simpan Kategori
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit/Add Opening Balance */}
      {editingBalance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">Atur Saldo Awal Tahun</h3>
              <button onClick={() => setEditingBalance(null)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveOpeningBalance} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pilih Kas</label>
                <select
                  value={editingBalance.kas_id || ''}
                  onChange={(e) => setEditingBalance({ ...editingBalance, kas_id: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200 bg-white"
                  required
                >
                  <option value="">Pilih Kas...</option>
                  {kasList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pilih Tempat Simpan</label>
                <select
                  value={editingBalance.storage_account_id || ''}
                  onChange={(e) => setEditingBalance({ ...editingBalance, storage_account_id: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200 bg-white"
                  required
                >
                  <option value="">Pilih Rekening/Brankas...</option>
                  {storageAccounts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nominal Saldo Awal (Rp)</label>
                <input
                  type="number"
                  value={editingBalance.amount || 0}
                  onChange={(e) => setEditingBalance({ ...editingBalance, amount: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan</label>
                <input
                  type="text"
                  value={editingBalance.notes || ''}
                  onChange={(e) => setEditingBalance({ ...editingBalance, notes: e.target.value })}
                  placeholder="Contoh: Pindahan buku manual per 31 Des"
                  className="w-full p-2 rounded-xl border border-slate-200"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBalance(null)}
                  className="min-h-[44px] sm:min-h-0 px-4 py-2 text-slate-600 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] sm:min-h-0 px-5 py-2 bg-primary text-white font-semibold rounded-xl"
                >
                  Simpan Saldo Awal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Lingkungan */}
      {editingLingkungan && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full overflow-hidden shadow-2xl p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 space-y-4 mobile-sheet-enter">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                {editingLingkungan.id ? 'Ubah Lingkungan' : 'Tambah Lingkungan Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingLingkungan(null)}
                className="min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 flex items-center justify-center p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveLingkunganForm} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Lingkungan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingLingkungan.nama || ''}
                  onChange={(e) => setEditingLingkungan({ ...editingLingkungan, nama: e.target.value })}
                  placeholder="Contoh: Efesus, Letare, Galatia..."
                  className="w-full min-h-[44px] sm:min-h-0 p-2.5 rounded-xl border border-slate-200"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kode Singkat (Opsional)</label>
                <input
                  type="text"
                  value={editingLingkungan.kode || ''}
                  onChange={(e) =>
                    setEditingLingkungan({ ...editingLingkungan, kode: e.target.value.toUpperCase() })
                  }
                  placeholder="Contoh: EFE"
                  className="w-full min-h-[44px] sm:min-h-0 p-2.5 rounded-xl border border-slate-200 font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingLingkungan(null)}
                  className="min-h-[44px] sm:min-h-0 px-4 py-2 text-slate-600 rounded-xl font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] sm:min-h-0 px-5 py-2 bg-primary text-white font-semibold rounded-xl"
                >
                  Simpan Lingkungan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Keluarga Jemaat */}
      {editingFamily && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full max-h-[92dvh] overflow-y-auto shadow-2xl p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 space-y-4 mobile-sheet-enter">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                {editingFamily.id ? 'Ubah Data Keluarga Jemaat' : 'Tambah Keluarga Jemaat Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingFamily(null)}
                className="min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 flex items-center justify-center p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveFamilyForm} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Keluarga <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingFamily.nama_keluarga || ''}
                  onChange={(e) => setEditingFamily({ ...editingFamily, nama_keluarga: e.target.value })}
                  placeholder="Contoh: Kel. St. R. Sinaga / Br. Sitepu"
                  className="w-full min-h-[44px] sm:min-h-0 p-2.5 rounded-xl border border-slate-200"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Lingkungan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={editingFamily.lingkungan || ''}
                  onChange={(e) => setEditingFamily({ ...editingFamily, lingkungan: e.target.value })}
                  className="w-full min-h-[44px] sm:min-h-0 p-2.5 rounded-xl border border-slate-200 bg-white"
                  required
                >
                  <option value="">-- Pilih Lingkungan --</option>
                  {lingkunganList.map((l) => (
                    <option key={l.id} value={l.nama}>
                      {l.nama}
                    </option>
                  ))}
                  {editingFamily.lingkungan &&
                    !lingkunganList.some((l) => l.nama === editingFamily.lingkungan) && (
                      <option value={editingFamily.lingkungan}>{editingFamily.lingkungan}</option>
                    )}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kepala Keluarga (Opsional)
                </label>
                <input
                  type="text"
                  value={editingFamily.kepala_keluarga || ''}
                  onChange={(e) =>
                    setEditingFamily({ ...editingFamily, kepala_keluarga: e.target.value })
                  }
                  placeholder="Nama kepala keluarga..."
                  className="w-full min-h-[44px] sm:min-h-0 p-2.5 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan (Opsional)</label>
                <input
                  type="text"
                  value={editingFamily.notes || ''}
                  onChange={(e) => setEditingFamily({ ...editingFamily, notes: e.target.value })}
                  placeholder="Keterangan tambahan..."
                  className="w-full min-h-[44px] sm:min-h-0 p-2.5 rounded-xl border border-slate-200"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingFamily(null)}
                  className="min-h-[44px] sm:min-h-0 px-4 py-2 text-slate-600 rounded-xl font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] sm:min-h-0 px-5 py-2 bg-primary text-white font-semibold rounded-xl"
                >
                  Simpan Keluarga
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Keluarga */}
      {deletingFamily && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-6 space-y-4 mobile-sheet-enter">
            <div className="flex items-center gap-3 text-rose-600 border-b border-slate-100 pb-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-bold text-sm text-slate-900">Hapus Data Keluarga</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus data keluarga{' '}
              <strong>{deletingFamily.nama_keluarga}</strong> ({deletingFamily.lingkungan}) dari
              database master? Riwayat transaksi yang sudah tercatat tidak akan ikut terhapus.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingFamily(null)}
                className="min-h-[44px] sm:min-h-0 px-4 py-2 text-slate-600 text-xs font-semibold rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteDeleteFamily}
                className="min-h-[44px] sm:min-h-0 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview Impor Excel Data Keluarga */}
      {familyImportPreview && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-3xl w-full max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 mobile-sheet-enter">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="truncate">Pratinjau Impor Excel Data Keluarga</span>
                </h3>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  File: {familyImportPreview.fileName} · {familyImportPreview.sheetsDetected.length} sheet terbaca ({familyImportPreview.sheetsDetected.join(', ')})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFamilyImportPreview(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <span className="text-[10px] font-semibold text-emerald-700 block">Baru Ditambah</span>
                  <span className="text-base font-bold font-mono text-emerald-900 tabular-nums">
                    {familyImportPreview.rows.filter((r) => r.status === 'new').length}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-center">
                  <span className="text-[10px] font-semibold text-amber-700 block">Pindah Lingkungan</span>
                  <span className="text-base font-bold font-mono text-amber-900 tabular-nums">
                    {familyImportPreview.rows.filter((r) => r.status === 'exists_diff_ling').length}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <span className="text-[10px] font-semibold text-slate-600 block">Sudah Ada</span>
                  <span className="text-base font-bold font-mono text-slate-800 tabular-nums">
                    {familyImportPreview.rows.filter((r) => r.status === 'exists_same').length}
                  </span>
                </div>
              </div>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateExistingLingkungan}
                  onChange={(e) => setUpdateExistingLingkungan(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span className="text-slate-700 font-medium">
                  Perbarui data Lingkungan jika nama keluarga sudah ada di database dengan Lingkungan berbeda
                </span>
              </label>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2 px-3 w-10 text-center">No</th>
                      <th className="py-2 px-3">Nama Keluarga</th>
                      <th className="py-2 px-3">Lingkungan</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {familyImportPreview.rows.slice(0, 200).map((row, i) => (
                      <tr key={`${row.nama_keluarga}-${i}`}>
                        <td className="py-2 px-3 text-center font-mono text-slate-400">{i + 1}</td>
                        <td className="py-2 px-3 font-medium text-slate-900">{row.nama_keluarga}</td>
                        <td className="py-2 px-3 text-blue-800 font-semibold">{row.lingkungan}</td>
                        <td className="py-2 px-3">
                          {row.status === 'new' ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              Baru
                            </span>
                          ) : row.status === 'exists_diff_ling' ? (
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                              Update Lingkungan
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                              Lewati (Sudah Ada)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {familyImportPreview.rows.length > 200 && (
                  <div className="p-2 text-center text-[11px] text-slate-500 bg-slate-50 border-t border-slate-100">
                    Menampilkan 200 dari {familyImportPreview.rows.length} baris. Seluruh {familyImportPreview.rows.length} baris akan ikut diproses.
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] sm:pb-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                disabled={isImportingFamilies}
                onClick={() => setFamilyImportPreview(null)}
                className="min-h-[44px] sm:min-h-0 px-4 py-2 text-xs font-semibold text-slate-700 rounded-xl border border-slate-200 bg-white"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isImportingFamilies}
                onClick={handleConfirmFamilyImport}
                className="min-h-[44px] sm:min-h-0 px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>
                  {isImportingFamilies
                    ? 'Menyimpan ke Database...'
                    : `Simpan ${familyImportPreview.rows.length} Data ke Database`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
