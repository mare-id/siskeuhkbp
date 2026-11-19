/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Camera,
  Upload,
  X,
  AlertCircle,
  CheckCircle,
  Plus,
  Trash2,
  Layers,
  Sparkles,
  ArrowRight,
  Calendar,
  Users,
  Search,
  UserPlus,
  Landmark,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { uploadReceiptFile } from '../../lib/supabase';
import { formatRupiah } from '../../lib/formatters';
import { getPpkuProcurementRule, splitSentralisasiAmount } from '../../lib/ppkuRules';
import { SentralisasiExclusionType } from '../../types/database';

export interface PeleanTaonPrefill {
  familyId?: string;
  familyName?: string;
  lingkungan?: string;
  year?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultKasId?: string;
  defaultPeleanTaon?: PeleanTaonPrefill | null;
}

interface AllocationDraftRow {
  rowId: string;
  kas_id: string;
  sub_description: string;
  amountInput: string;
  is_sentralisasi: boolean;
  exclusion_type?: SentralisasiExclusionType | null;
}

const isPeleanBulananTahunanCategory = (cat?: { id: string; nama: string } | null): boolean => {
  if (!cat) return false;
  if (cat.id === 'cat-in-namarboho') return true;
  return /pelean.*(bulanan|tahunan)/i.test(cat.nama);
};

const getNextSunday = (baseDateStr: string): string => {
  const d = baseDateStr ? new Date(`${baseDateStr}T00:00:00`) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
};

export const TransactionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  defaultKasId,
  defaultPeleanTaon,
}) => {
  const {
    kasList,
    storageAccounts,
    categories,
    fiscalYears,
    lingkunganList,
    families,
    settings,
    addTransaction,
    addCompoundIncomeTransactions,
    saveFamily,
    isPeriodClosed,
  } = useData();
  const { canInputKas } = useAuth();

  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [incomeMode, setIncomeMode] = useState<'single' | 'multi'>('single');

  const [tanggal, setTanggal] = useState<string>(new Date().toISOString().split('T')[0]);
  const [tanggalWarta, setTanggalWarta] = useState<string>('');
  const [kasId, setKasId] = useState<string>('');
  const [storageAccountId, setStorageAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [receiptNo, setReceiptNo] = useState<string>('');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Per-transaction Sentralisasi status (decided during transaction recording)
  const [isSentralisasi, setIsSentralisasi] = useState<boolean>(true);
  const [exclusionType, setExclusionType] = useState<SentralisasiExclusionType>('lainnya');

  // Pelean Taon (Persembahan Tahunan Keluarga) dedicated states
  const [isPeleanTaonMode, setIsPeleanTaonMode] = useState<boolean>(false);
  const [peleanYear, setPeleanYear] = useState<number>(settings.active_year || new Date().getFullYear());
  const [peleanLingkungan, setPeleanLingkungan] = useState<string>('');
  const [peleanFamilyId, setPeleanFamilyId] = useState<string>('');
  const [peleanFamilySearch, setPeleanFamilySearch] = useState<string>('');
  const [peleanUseManualFamily, setPeleanUseManualFamily] = useState<boolean>(false);
  const [peleanManualFamilyName, setPeleanManualFamilyName] = useState<string>('');
  const [peleanSaveManualToMaster, setPeleanSaveManualToMaster] = useState<boolean>(true);
  const [descriptionManuallyEdited, setDescriptionManuallyEdited] = useState<boolean>(false);

  // Multi-pos income rows (e.g., Ucapan Syukur)
  const [allocations, setAllocations] = useState<AllocationDraftRow[]>([]);

  const selectableKas = useMemo(
    () => kasList.filter((k) => k.is_active && canInputKas(k.id)),
    [kasList, canInputKas]
  );

  const kasUmumHuria = useMemo(
    () => kasList.find((k) => k.id === 'kas-1' || k.kode === 'KAS-UMUM'),
    [kasList]
  );

  const sentralisasiKas = useMemo(
    () => kasList.find((k) => k.id === 'kas-9' || k.kode === 'KAS-SENTRAL'),
    [kasList]
  );

  const selectedCategoryObj = useMemo(
    () => categories.find((c) => c.id === categoryId) || null,
    [categories, categoryId]
  );

  const isPeleanCategorySelected = useMemo(
    () => type === 'income' && incomeMode === 'single' && isPeleanBulananTahunanCategory(selectedCategoryObj),
    [type, incomeMode, selectedCategoryObj]
  );

  const availableLingkunganNames = useMemo(() => {
    const map = new Map<string, string>();
    lingkunganList
      .filter((l) => l.is_active !== false)
      .sort((a, b) => (a.urutan ?? 99) - (b.urutan ?? 99))
      .forEach((l) => {
        const clean = l.nama.trim();
        if (clean && !map.has(clean.toLowerCase())) map.set(clean.toLowerCase(), clean);
      });
    families.forEach((f) => {
      const clean = (f.lingkungan || '').trim();
      if (clean && !map.has(clean.toLowerCase())) map.set(clean.toLowerCase(), clean);
    });
    return Array.from(map.values());
  }, [lingkunganList, families]);

  const availableYears = useMemo(() => {
    const yrs = new Set<number>(fiscalYears.map((fy) => fy.year));
    yrs.add(settings.active_year || new Date().getFullYear());
    return Array.from(yrs).sort((a, b) => b - a);
  }, [fiscalYears, settings.active_year]);

  const filteredFamiliesForDropdown = useMemo(() => {
    const q = peleanFamilySearch.trim().toLowerCase();
    return families
      .filter((f) => f.is_active !== false)
      .filter((f) => {
        if (peleanLingkungan && f.lingkungan.trim().toLowerCase() !== peleanLingkungan.trim().toLowerCase()) {
          return false;
        }
        if (q) {
          return (
            f.nama_keluarga.toLowerCase().includes(q) ||
            f.lingkungan.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => a.nama_keluarga.localeCompare(b.nama_keluarga, 'id'));
  }, [families, peleanLingkungan, peleanFamilySearch]);

  const inferExclusionForKas = (kId: string): SentralisasiExclusionType => {
    if (kId === 'kas-8') return 'transitoris';
    if (kId === 'kas-2') return 'sosial_duka';
    if (kId === 'kas-7') return 'pembangunan_lokal';
    return 'lainnya';
  };

  const inferDefaultSentralisasiForKas = (kId: string): boolean => {
    if (kId === 'kas-2' || kId === 'kas-8' || kId === 'kas-9') return false;
    return true;
  };

  useEffect(() => {
    if (isOpen) {
      const todayStr = new Date().toISOString().split('T')[0];
      setError('');
      setAmountInput('');
      setReceiptNo('');
      setAttachmentUrl(null);
      setTanggal(todayStr);
      setDescriptionManuallyEdited(false);
      setPeleanFamilySearch('');

      if (storageAccounts.length > 0) {
        const activeStor = storageAccounts.filter((s) => s.is_active);
        setStorageAccountId((activeStor[0] || storageAccounts[0]).id);
      }

      if (defaultPeleanTaon) {
        setType('income');
        setIncomeMode('single');
        const peleanCat =
          categories.find((c) => c.tipe === 'income' && c.is_active && isPeleanBulananTahunanCategory(c)) ||
          categories.find((c) => c.tipe === 'income' && c.is_active);
        if (peleanCat) setCategoryId(peleanCat.id);
        setIsPeleanTaonMode(true);
        const yr = defaultPeleanTaon.year || settings.active_year || new Date().getFullYear();
        setPeleanYear(yr);
        const ling = defaultPeleanTaon.lingkungan || availableLingkunganNames[0] || '';
        setPeleanLingkungan(ling);
        if (defaultPeleanTaon.familyId) {
          setPeleanUseManualFamily(false);
          setPeleanFamilyId(defaultPeleanTaon.familyId);
          setPeleanManualFamilyName('');
        } else if (defaultPeleanTaon.familyName) {
          setPeleanUseManualFamily(true);
          setPeleanFamilyId('');
          setPeleanManualFamilyName(defaultPeleanTaon.familyName);
        } else {
          setPeleanUseManualFamily(false);
          setPeleanFamilyId('');
          setPeleanManualFamilyName('');
        }
        setPeleanSaveManualToMaster(true);
        setTanggalWarta(getNextSunday(todayStr));
        const targetHuria = kasUmumHuria?.id || 'kas-1';
        setKasId(targetHuria);
        setIsSentralisasi(true);
        setExclusionType('lainnya');
        const famLabel =
          defaultPeleanTaon.familyName ||
          families.find((f) => f.id === defaultPeleanTaon.familyId)?.nama_keluarga ||
          '';
        setDescription(
          famLabel
            ? `Pelean Taon ${yr} - ${famLabel}${ling ? ` (Lingkungan ${ling})` : ''}`
            : ''
        );
      } else {
        setType('expense');
        setIncomeMode('single');
        setTanggalWarta('');
        setDescription('');
        setIsPeleanTaonMode(false);
        setPeleanYear(settings.active_year || new Date().getFullYear());
        setPeleanLingkungan(availableLingkunganNames[0] || '');
        setPeleanFamilyId('');
        setPeleanUseManualFamily(false);
        setPeleanManualFamilyName('');
        setPeleanSaveManualToMaster(true);

        let initialKas = '';
        if (defaultKasId && canInputKas(defaultKasId)) {
          initialKas = defaultKasId;
        } else if (selectableKas.length > 0) {
          const nonSentral = selectableKas.find((k) => k.id !== 'kas-9');
          initialKas = (nonSentral || selectableKas[0]).id;
        }
        setKasId(initialKas);
        setIsSentralisasi(inferDefaultSentralisasiForKas(initialKas));
        setExclusionType(inferExclusionForKas(initialKas));

        setAllocations([
          {
            rowId: `row-${Date.now()}-1`,
            kas_id: initialKas,
            sub_description: 'Ke Kas Huria',
            amountInput: '',
            is_sentralisasi: inferDefaultSentralisasiForKas(initialKas),
            exclusion_type: inferExclusionForKas(initialKas),
          },
        ]);
      }
    }
  }, [isOpen, defaultKasId, defaultPeleanTaon]);

  useEffect(() => {
    if (!isOpen) return;
    if (defaultPeleanTaon && type === 'income') {
      const peleanCat = categories.find(
        (c) => c.tipe === 'income' && c.is_active && isPeleanBulananTahunanCategory(c)
      );
      if (peleanCat) {
        setCategoryId(peleanCat.id);
        return;
      }
    }
    const validCategories = categories.filter((c) => c.tipe === type && c.is_active);
    if (validCategories.length > 0) {
      setCategoryId((prev) =>
        validCategories.some((c) => c.id === prev) ? prev : validCategories[0].id
      );
    } else {
      setCategoryId('');
    }
  }, [type, categories, isOpen, defaultPeleanTaon]);

  // Auto-enforce Kas Huria + Sentralisasi 55% whenever Pelean Taon mode is active
  useEffect(() => {
    if (isPeleanCategorySelected && isPeleanTaonMode) {
      if (kasUmumHuria && kasId !== kasUmumHuria.id) {
        setKasId(kasUmumHuria.id);
      }
      if (!isSentralisasi) {
        setIsSentralisasi(true);
      }
      if (!tanggalWarta) {
        setTanggalWarta(getNextSunday(tanggal));
      }
    }
  }, [isPeleanCategorySelected, isPeleanTaonMode, kasUmumHuria]);

  // Auto-generate description for Pelean Taon unless edited manually
  useEffect(() => {
    if (!isPeleanCategorySelected || !isPeleanTaonMode || descriptionManuallyEdited) return;
    const selectedFamObj = families.find((f) => f.id === peleanFamilyId);
    const resolvedFam = peleanUseManualFamily
      ? peleanManualFamilyName.trim()
      : selectedFamObj?.nama_keluarga || '';
    const resolvedLing = peleanLingkungan || selectedFamObj?.lingkungan || '';
    if (resolvedFam) {
      setDescription(
        `Pelean Taon ${peleanYear} - ${resolvedFam}${resolvedLing ? ` (Lingkungan ${resolvedLing})` : ''}`
      );
    }
  }, [
    isPeleanCategorySelected,
    isPeleanTaonMode,
    peleanYear,
    peleanFamilyId,
    peleanUseManualFamily,
    peleanManualFamilyName,
    peleanLingkungan,
    families,
    descriptionManuallyEdited,
  ]);

  const handleCategoryChange = (newCatId: string) => {
    setCategoryId(newCatId);
    const cat = categories.find((c) => c.id === newCatId);
    if (type === 'income' && isPeleanBulananTahunanCategory(cat)) {
      setIsPeleanTaonMode(true);
      if (kasUmumHuria) setKasId(kasUmumHuria.id);
      setIsSentralisasi(true);
      if (!peleanLingkungan && availableLingkunganNames.length > 0) {
        setPeleanLingkungan(availableLingkunganNames[0]);
      }
      if (!tanggalWarta) {
        setTanggalWarta(getNextSunday(tanggal));
      }
      return;
    }
    setIsPeleanTaonMode(false);
    if (!defaultKasId && cat?.default_kas_id && canInputKas(cat.default_kas_id)) {
      setKasId(cat.default_kas_id);
      setExclusionType(inferExclusionForKas(cat.default_kas_id));
    }
  };

  const handleKasChange = (newKasId: string) => {
    setKasId(newKasId);
    setExclusionType(inferExclusionForKas(newKasId));
    if (newKasId === 'kas-2' || newKasId === 'kas-8') {
      setIsSentralisasi(false);
    }
  };

  const parseNum = (val: string) => parseFloat(val.replace(/[^0-9]/g, '')) || 0;

  const multiSummary = useMemo(() => {
    let totalGross = 0;
    let totalSentralisasiPool = 0;
    const inflowsByKas: Record<string, { kasName: string; amount: number }> = {};

    const addInflow = (kId: string, amt: number) => {
      if (amt <= 0 || !kId) return;
      const kName = kasList.find((k) => k.id === kId)?.nama || kId;
      if (!inflowsByKas[kId]) {
        inflowsByKas[kId] = { kasName: kName, amount: 0 };
      }
      inflowsByKas[kId].amount += amt;
    };

    allocations.forEach((row) => {
      const amt = parseNum(row.amountInput);
      totalGross += amt;
      if (amt <= 0 || !row.kas_id) return;

      if (row.is_sentralisasi && sentralisasiKas && row.kas_id !== sentralisasiKas.id) {
        const { bpskAmount, huriaAmount } = splitSentralisasiAmount(amt, true);
        totalSentralisasiPool += bpskAmount;
        addInflow(row.kas_id, huriaAmount);
        addInflow(sentralisasiKas.id, bpskAmount);
      } else {
        addInflow(row.kas_id, amt);
      }
    });

    return {
      totalGross,
      totalSentralisasiPool,
      inflows: Object.entries(inflowsByKas).map(([id, data]) => ({ kasId: id, ...data })),
    };
  }, [allocations, kasList, sentralisasiKas]);

  if (!isOpen) return null;

  const rawAmount = parseNum(amountInput);
  const isReceiptMandatory = type === 'expense' && rawAmount >= settings.receipt_required_threshold;
  const selectedKas = kasList.find((k) => k.id === kasId);
  const singleSplit = splitSentralisasiAmount(rawAmount, type === 'income' ? isSentralisasi : false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    const res = await uploadReceiptFile(file);
    if (res.error) {
      setError(`Gagal mengunggah nota: ${res.error.message}`);
    } else if (res.url) {
      setAttachmentUrl(res.url);
    }
    setUploading(false);
  };

  const handleAddAllocationRow = () => {
    const defaultRowKas = (selectableKas.find((k) => k.id !== 'kas-9') || selectableKas[0])?.id || '';
    setAllocations((prev) => [
      ...prev,
      {
        rowId: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kas_id: defaultRowKas,
        sub_description: '',
        amountInput: '',
        is_sentralisasi: inferDefaultSentralisasiForKas(defaultRowKas),
        exclusion_type: inferExclusionForKas(defaultRowKas),
      },
    ]);
  };

  const handleApplyUcapanSyukurTemplate = () => {
    const templateCandidates: Array<{
      kasId: string;
      subDesc: string;
      amount: string;
      isSentralisasi: boolean;
      exType: SentralisasiExclusionType | null;
    }> = [
      { kasId: 'kas-1', subDesc: 'Ke Kas Huria', amount: '200000', isSentralisasi: true, exType: null },
      { kasId: 'kas-7', subDesc: 'Ke Kas Pembangunan', amount: '100000', isSentralisasi: false, exType: 'pembangunan_lokal' },
      { kasId: 'kas-2', subDesc: 'Ke Kas Diakonia Sosial', amount: '100000', isSentralisasi: false, exType: 'sosial_duka' },
      { kasId: 'kas-8', subDesc: 'Ke Pendeta', amount: '100000', isSentralisasi: false, exType: 'transitoris' },
      { kasId: 'kas-8', subDesc: 'Ke Lingkungan', amount: '100000', isSentralisasi: false, exType: 'transitoris' },
    ];

    const availableRows: AllocationDraftRow[] = templateCandidates
      .filter((t) => canInputKas(t.kasId) && kasList.some((k) => k.id === t.kasId && k.is_active))
      .map((t, idx) => ({
        rowId: `tpl-${Date.now()}-${idx}`,
        kas_id: t.kasId,
        sub_description: t.subDesc,
        amountInput: t.amount,
        is_sentralisasi: t.isSentralisasi,
        exclusion_type: t.exType,
      }));

    if (availableRows.length > 0) {
      setAllocations(availableRows);
      const syukurCat =
        categories.find((c) => c.id === 'cat-in-syukur-keluarga' && c.is_active) ||
        categories.find((c) => c.id === 'cat-in-syukur-altar' && c.is_active);
      if (syukurCat) setCategoryId(syukurCat.id);
      if (!description.trim()) {
        setDescription('Ucapan Syukur Keluarga');
      }
    }
  };

  const handleSave = async (submitDirectly: boolean) => {
    setError('');

    if (!description.trim()) {
      setError('Uraian transaksi wajib diisi.');
      return;
    }

    if (!storageAccountId) {
      setError('Pilih tempat penyimpanan.');
      return;
    }

    if (type === 'income' && incomeMode === 'multi') {
      if (allocations.length === 0) {
        setError('Tambahkan minimal 1 baris rincian kas.');
        return;
      }

      for (let i = 0; i < allocations.length; i++) {
        const row = allocations[i];
        const amt = parseNum(row.amountInput);
        if (!row.kas_id) {
          setError(`Baris ke-${i + 1} belum memilih Kas Tujuan.`);
          return;
        }
        if (amt <= 0) {
          setError(`Nominal baris ke-${i + 1} harus lebih dari Rp 0.`);
          return;
        }
      }

      setIsSubmitting(true);
      const res = await addCompoundIncomeTransactions({
        tanggal,
        tanggal_warta: tanggalWarta || null,
        storage_account_id: storageAccountId,
        category_id: categoryId || null,
        description: description.trim(),
        receipt_no: receiptNo.trim() || undefined,
        attachment_url: attachmentUrl,
        status: submitDirectly ? 'submitted' : 'draft',
        allocations: allocations.map((r) => ({
          kas_id: r.kas_id,
          amount: parseNum(r.amountInput),
          is_sentralisasi: r.is_sentralisasi,
          sub_description: r.sub_description.trim() || undefined,
          exclusion_type: r.is_sentralisasi ? null : r.exclusion_type || inferExclusionForKas(r.kas_id),
        })),
      });
      setIsSubmitting(false);

      if (!res.success) {
        setError(res.error || 'Gagal menyimpan rincian penerimaan.');
      } else {
        onClose();
      }
      return;
    }

    if (rawAmount <= 0) {
      setError('Nominal harus lebih besar dari Rp 0.');
      return;
    }

    const activePeleanMode = isPeleanCategorySelected && isPeleanTaonMode;
    let resolvedKasId = kasId;
    let resolvedFamilyId: string | null = null;
    let resolvedFamilyName: string | null = null;
    let resolvedLingkungan: string | null = null;
    let resolvedPeleanYear: number | null = null;

    if (activePeleanMode) {
      const targetHuriaKas = kasUmumHuria?.id || 'kas-1';
      if (!canInputKas(targetHuriaKas)) {
        setError('Anda tidak memiliki hak akses input pada Kas Umum Huria (Pelean Taon wajib masuk ke Kas Huria).');
        return;
      }
      resolvedKasId = targetHuriaKas;
      resolvedPeleanYear = peleanYear;

      if (!peleanLingkungan.trim()) {
        setError('Pilih Lingkungan jemaat terlebih dahulu.');
        return;
      }
      resolvedLingkungan = peleanLingkungan.trim();

      if (peleanUseManualFamily) {
        if (!peleanManualFamilyName.trim()) {
          setError('Masukkan Nama Keluarga secara manual.');
          return;
        }
        resolvedFamilyName = peleanManualFamilyName.trim();
      } else {
        const famObj = families.find((f) => f.id === peleanFamilyId);
        if (!famObj) {
          setError('Pilih Nama Keluarga dari daftar atau gunakan opsi Input Manual.');
          return;
        }
        resolvedFamilyId = famObj.id;
        resolvedFamilyName = famObj.nama_keluarga;
        if (!resolvedLingkungan) resolvedLingkungan = famObj.lingkungan;
      }

      if (!tanggalWarta) {
        setError('Pilih Tanggal Warta (kalender) untuk pencatatan Pelean Taon.');
        return;
      }
    }

    if (!resolvedKasId) {
      setError('Pilih Kas tujuan.');
      return;
    }

    if (isReceiptMandatory && !attachmentUrl) {
      setError(
        `Pengeluaran >= ${formatRupiah(settings.receipt_required_threshold)} wajib melampirkan foto nota.`
      );
      return;
    }

    const d = new Date(tanggal);
    if (isPeriodClosed(d.getFullYear(), d.getMonth() + 1, resolvedKasId)) {
      setError(`Periode ${d.getMonth() + 1}/${d.getFullYear()} untuk kas ini sudah ditutup.`);
      return;
    }

    setIsSubmitting(true);

    // If manual family requested to save to master data, persist it first
    if (activePeleanMode && peleanUseManualFamily && peleanSaveManualToMaster && resolvedFamilyName && resolvedLingkungan) {
      const famSave = await saveFamily({
        nama_keluarga: resolvedFamilyName,
        lingkungan: resolvedLingkungan,
        is_active: true,
      });
      if (famSave.success && famSave.id) {
        resolvedFamilyId = famSave.id;
      }
    }

    const useSentralisasi = type === 'income' ? (activePeleanMode ? true : isSentralisasi) : false;
    const { bpskAmount, huriaAmount } = splitSentralisasiAmount(rawAmount, useSentralisasi);

    const result = await addTransaction({
      tanggal,
      tanggal_warta: tanggalWarta || null,
      kas_id: resolvedKasId,
      storage_account_id: storageAccountId,
      category_id: categoryId || null,
      type,
      amount: rawAmount,
      description: description.trim(),
      receipt_no: receiptNo.trim() || undefined,
      attachment_url: attachmentUrl,
      status: submitDirectly ? 'submitted' : 'draft',
      is_sentralisasi: type === 'income' ? useSentralisasi : false,
      bpsk_rate: type === 'income' ? (useSentralisasi ? 0.55 : 0) : undefined,
      huria_rate: type === 'income' ? (useSentralisasi ? 0.45 : 1.0) : undefined,
      bpsk_amount: type === 'income' ? bpskAmount : undefined,
      huria_amount: type === 'income' ? huriaAmount : undefined,
      sentralisasi_exclusion_type:
        type === 'income' && !useSentralisasi
          ? exclusionType || inferExclusionForKas(resolvedKasId)
          : null,
      pelean_taon_year: resolvedPeleanYear,
      family_id: resolvedFamilyId,
      family_name: resolvedFamilyName,
      lingkungan: resolvedLingkungan,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Gagal menyimpan transaksi.');
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className={`bg-white sm:rounded-2xl rounded-t-3xl w-full max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 mobile-sheet-enter ${
          type === 'income' && incomeMode === 'multi' ? 'sm:max-w-2xl' : 'sm:max-w-lg'
        }`}
      >
        {/* Mobile Drag Handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-sm sm:text-base text-slate-900">Catat Transaksi</h3>
          <button
            onClick={onClose}
            className="p-2 sm:p-1.5 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setType('income')}
              className={`h-9 text-xs font-semibold rounded-lg transition-all ${
                type === 'income'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              + Pemasukan
            </button>
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`h-9 text-xs font-semibold rounded-lg transition-all ${
                type === 'expense'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              - Pengeluaran
            </button>
          </div>

          {/* Income Mode Switch */}
          {type === 'income' && (
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100/80 rounded-xl">
              <button
                type="button"
                onClick={() => setIncomeMode('single')}
                className={`h-9 px-2 rounded-lg text-xs font-semibold transition-all ${
                  incomeMode === 'single'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1 Pos Kas
              </button>
              <button
                type="button"
                onClick={() => setIncomeMode('multi')}
                className={`h-9 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  incomeMode === 'multi'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Multi Pos / Ucapan Syukur</span>
              </button>
            </div>
          )}

          {/* Nominal (Single mode) */}
          {(type === 'expense' || incomeMode === 'single') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nominal (Rp) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amountInput ? Number(amountInput.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : ''}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="0"
                  className="w-full h-11 pl-10 pr-3.5 text-base font-bold text-slate-900 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-mono tabular-nums"
                  autoFocus
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isPeleanCategorySelected && isPeleanTaonMode ? 'Tanggal Penerimaan' : 'Tanggal Transaksi'}{' '}
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full h-11 sm:h-10 text-xs px-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Tanggal Warta {isPeleanCategorySelected && isPeleanTaonMode ? <span className="text-rose-500">*</span> : '(Opsional)'}
                </label>
                <button
                  type="button"
                  onClick={() => setTanggalWarta(getNextSunday(tanggal))}
                  className="text-[10px] font-semibold text-blue-700 hover:underline"
                  title="Isi otomatis hari Minggu terdekat"
                >
                  Minggu Berikutnya
                </button>
              </div>
              <input
                type="date"
                value={tanggalWarta}
                onChange={(e) => setTanggalWarta(e.target.value)}
                className="w-full h-11 sm:h-10 text-xs px-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                No. Bukti (Opsional)
              </label>
              <input
                type="text"
                value={receiptNo}
                onChange={(e) => setReceiptNo(e.target.value)}
                placeholder="BKM-01 / KW-10"
                className="w-full h-11 sm:h-10 text-xs px-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>

          {/* Kas Tujuan (Single mode - locked to Kas Huria if Pelean Taon mode) */}
          {(type === 'expense' || incomeMode === 'single') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {type === 'income' ? 'Kas Tujuan' : 'Kas Sumber'} <span className="text-rose-500">*</span>
              </label>
              {isPeleanCategorySelected && isPeleanTaonMode ? (
                <div className="h-11 sm:h-10 px-3 rounded-xl border border-blue-200 bg-blue-50/70 flex items-center justify-between text-xs text-blue-950 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-blue-700" />
                    {kasUmumHuria?.nama || 'Kas Umum Huria'} ({kasUmumHuria?.kode || 'KAS-UMUM'})
                  </span>
                  <span className="text-[10px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded-md border border-blue-200">
                    Otomatis Pelean Taon
                  </span>
                </div>
              ) : (
                <select
                  value={kasId}
                  onChange={(e) => handleKasChange(e.target.value)}
                  className="w-full h-11 sm:h-10 text-xs px-3 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  required
                >
                  {selectableKas.length === 0 ? (
                    <option value="">Tidak ada akses kas</option>
                  ) : (
                    selectableKas.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.nama} ({k.kode})
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tempat Simpan <span className="text-rose-500">*</span>
              </label>
              <select
                value={storageAccountId}
                onChange={(e) => setStorageAccountId(e.target.value)}
                className="w-full h-11 sm:h-10 text-xs px-3 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                required
              >
                {storageAccounts
                  .filter((s) => s.is_active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama} ({s.tipe === 'cash' ? 'Tunai' : 'Bank'})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kategori <span className="text-rose-500">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full h-11 sm:h-10 text-xs px-3 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                required
              >
                {categories
                  .filter((c) => c.tipe === type && c.is_active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nama}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* FITUR KHUSUS PELEAN TAON (PERSEMBAHAN TAHUNAN KELUARGA) */}
          {isPeleanCategorySelected && (
            <div className="p-3.5 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/90 to-indigo-50/50 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">Persembahan Tahunan (Pelean Taon)</div>
                    <div className="text-[11px] text-slate-600">
                      Pencatatan kewajiban tahunan keluarga per lingkungan
                    </div>
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer bg-white px-2.5 py-1.5 rounded-xl border border-blue-200 font-semibold text-[11px] text-blue-900">
                  <input
                    type="checkbox"
                    checked={isPeleanTaonMode}
                    onChange={(e) => setIsPeleanTaonMode(e.target.checked)}
                    className="rounded border-blue-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <span>Mode Pelean Taon</span>
                </label>
              </div>

              {isPeleanTaonMode && (
                <div className="space-y-3 pt-1 border-t border-blue-200/70">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tahun Anggaran <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={peleanYear}
                        onChange={(e) => setPeleanYear(Number(e.target.value))}
                        className="w-full h-11 sm:h-10 px-3 rounded-xl border border-blue-200 bg-white text-xs font-semibold text-slate-900"
                      >
                        {availableYears.map((yr) => (
                          <option key={yr} value={yr}>
                            Tahun Anggaran {yr}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Lingkungan <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={peleanLingkungan}
                        onChange={(e) => {
                          setPeleanLingkungan(e.target.value);
                          setPeleanFamilyId('');
                        }}
                        className="w-full h-11 sm:h-10 px-3 rounded-xl border border-blue-200 bg-white text-xs font-semibold text-slate-900"
                      >
                        <option value="">-- Pilih Lingkungan --</option>
                        {availableLingkunganNames.map((ling) => (
                          <option key={ling} value={ling}>
                            Lingkungan {ling}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Family Selector vs Manual Entry Toggle */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-slate-700">
                        Nama Keluarga Jemaat <span className="text-rose-500">*</span>
                      </label>
                      <div className="inline-flex p-0.5 rounded-lg bg-white border border-blue-200">
                        <button
                          type="button"
                          onClick={() => setPeleanUseManualFamily(false)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                            !peleanUseManualFamily
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Pilih Database ({filteredFamiliesForDropdown.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setPeleanUseManualFamily(true)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 transition-colors ${
                            peleanUseManualFamily
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>Input Manual</span>
                        </button>
                      </div>
                    </div>

                    {!peleanUseManualFamily ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={peleanFamilySearch}
                            onChange={(e) => setPeleanFamilySearch(e.target.value)}
                            placeholder="Cari cepat nama keluarga..."
                            className="w-full h-10 pl-8 pr-3 rounded-xl border border-blue-200 bg-white text-xs"
                          />
                        </div>
                        <select
                          value={peleanFamilyId}
                          onChange={(e) => {
                            const fId = e.target.value;
                            setPeleanFamilyId(fId);
                            const fam = families.find((f) => f.id === fId);
                            if (fam?.lingkungan) setPeleanLingkungan(fam.lingkungan);
                          }}
                          className="w-full h-11 sm:h-10 px-3 rounded-xl border border-blue-200 bg-white text-xs font-medium text-slate-900"
                        >
                          <option value="">
                            {filteredFamiliesForDropdown.length === 0
                              ? '-- Belum ada keluarga cocok (gunakan Input Manual) --'
                              : `-- Pilih Nama Keluarga (${filteredFamiliesForDropdown.length} tersedia) --`}
                          </option>
                          {filteredFamiliesForDropdown.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.nama_keluarga} {!peleanLingkungan ? `(${f.lingkungan})` : ''}
                            </option>
                          ))}
                        </select>
                        {filteredFamiliesForDropdown.length === 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setPeleanUseManualFamily(true);
                              if (peleanFamilySearch.trim()) {
                                setPeleanManualFamilyName(peleanFamilySearch.trim());
                              }
                            }}
                            className="text-[11px] font-semibold text-blue-700 hover:underline inline-flex items-center gap-1"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Keluarga belum terdaftar? Klik untuk input manual</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={peleanManualFamilyName}
                          onChange={(e) => setPeleanManualFamilyName(e.target.value)}
                          placeholder="Contoh: Kel. St. R. Sinaga / br Sitepu"
                          className="w-full h-11 sm:h-10 px-3 rounded-xl border border-blue-200 bg-white text-xs font-medium text-slate-900"
                        />
                        <label className="inline-flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={peleanSaveManualToMaster}
                            onChange={(e) => setPeleanSaveManualToMaster(e.target.checked)}
                            className="rounded border-blue-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                          />
                          <span>Sekaligus simpan keluarga baru ini ke Master Data Jemaat</span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Auto-Sentralisasi Info Box */}
                  <div className="p-2.5 rounded-xl bg-white border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-600 font-medium">
                      Aturan Huria: Masuk Kas Umum Huria &amp; kena Sentralisasi 55%
                    </span>
                    <div className="flex items-center gap-3 font-mono tabular-nums">
                      <span className="text-emerald-700">
                        45% Huria: <strong>{formatRupiah(splitSentralisasiAmount(rawAmount, true).huriaAmount)}</strong>
                      </span>
                      <span className="text-blue-700">
                        55% BPSK: <strong>{formatRupiah(splitSentralisasiAmount(rawAmount, true).bpskAmount)}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SENTRALISASI DETERMINATION AT TRANSACTION ENTRY (SINGLE INCOME - hidden when Pelean Taon enforces 55/45) */}
          {type === 'income' && incomeMode === 'single' && !(isPeleanCategorySelected && isPeleanTaonMode) && (
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Status Sentralisasi Transaksi</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsSentralisasi(true)}
                  className={`py-2 px-3 rounded-lg border text-left transition-all ${
                    isSentralisasi
                      ? 'bg-white border-blue-600 text-blue-950 ring-1 ring-blue-600/30 font-semibold'
                      : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className="text-xs font-bold">Sentralisasi (45/55)</div>
                  <div className="text-[10px] text-slate-500">45% Kas · 55% BPSK</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSentralisasi(false);
                    setExclusionType(inferExclusionForKas(kasId));
                  }}
                  className={`py-2 px-3 rounded-lg border text-left transition-all ${
                    !isSentralisasi
                      ? 'bg-white border-emerald-600 text-emerald-950 ring-1 ring-emerald-600/30 font-semibold'
                      : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  <div className="text-xs font-bold">Non-Sentralisasi (100%)</div>
                  <div className="text-[10px] text-slate-500">100% ke {selectedKas?.nama || 'Kas'}</div>
                </button>
              </div>

              {isSentralisasi ? (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-slate-200 text-[11px] tabular-nums">
                  <span className="text-slate-600">
                    {selectedKas?.nama || 'Kas'} (45%): <strong className="text-slate-900 font-mono">{formatRupiah(singleSplit.huriaAmount)}</strong>
                  </span>
                  <span className="text-blue-700">
                    Sentralisasi (55%): <strong className="font-mono">{formatRupiah(singleSplit.bpskAmount)}</strong>
                  </span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0.5">
                  <select
                    value={exclusionType}
                    onChange={(e) => setExclusionType(e.target.value as SentralisasiExclusionType)}
                    className="flex-1 h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px]"
                  >
                    <option value="pembangunan_lokal">Pembangunan Lokal</option>
                    <option value="sosial_duka">Diakonia Sosial / Duka</option>
                    <option value="transitoris">Transitoris / Titipan</option>
                    <option value="beasiswa">Beasiswa</option>
                    <option value="lainnya">Non-Sentralisasi Lainnya</option>
                  </select>
                  <span className="font-mono font-bold text-emerald-700 text-xs tabular-nums shrink-0">
                    100%: {formatRupiah(rawAmount)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* MULTI-POS INCOME (UCAPAN SYUKUR / RINCIAN) */}
          {type === 'income' && incomeMode === 'multi' && (
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5 overflow-x-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800">Rincian Alokasi Kas</span>
                <button
                  type="button"
                  onClick={handleApplyUcapanSyukurTemplate}
                  className="px-3.5 py-2 min-h-[44px] sm:min-h-[36px] bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white border border-emerald-700/20 rounded-lg text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>Contoh Ucapan Syukur</span>
                </button>
              </div>

              <div className="space-y-2">
                {allocations.map((row, idx) => {
                  const rowAmt = parseNum(row.amountInput);
                  const rowSplit = splitSentralisasiAmount(rowAmt, row.is_sentralisasi);
                  const rowKasName = kasList.find((k) => k.id === row.kas_id)?.nama || 'Kas';

                  return (
                    <div
                      key={row.rowId}
                      className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-2 text-xs min-w-0"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-500">#{idx + 1}</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div
                            role="group"
                            aria-label={`Status sentralisasi baris ${idx + 1}`}
                            className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-300/90"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setAllocations((prev) =>
                                  prev.map((r) =>
                                    r.rowId === row.rowId ? { ...r, is_sentralisasi: true } : r
                                  )
                                )
                              }
                              className={`px-2.5 py-1.5 min-h-[30px] rounded-md text-[11px] font-semibold cursor-pointer transition-all whitespace-nowrap ${
                                row.is_sentralisasi
                                  ? 'bg-blue-600 text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                              }`}
                            >
                              Sentralisasi (45/55)
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setAllocations((prev) =>
                                  prev.map((r) =>
                                    r.rowId === row.rowId
                                      ? {
                                          ...r,
                                          is_sentralisasi: false,
                                          exclusion_type: r.exclusion_type || inferExclusionForKas(r.kas_id),
                                        }
                                      : r
                                  )
                                )
                              }
                              className={`px-2.5 py-1.5 min-h-[30px] rounded-md text-[11px] font-semibold cursor-pointer transition-all whitespace-nowrap ${
                                !row.is_sentralisasi
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                              }`}
                            >
                              Non-Sentralisasi (100%)
                            </button>
                          </div>

                          {allocations.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setAllocations((prev) => prev.filter((r) => r.rowId !== row.rowId))
                              }
                              className="p-1.5 min-h-[34px] min-w-[34px] text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg inline-flex items-center justify-center cursor-pointer transition-colors"
                              aria-label="Hapus baris"
                              title="Hapus baris"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <input
                          type="text"
                          value={row.sub_description}
                          onChange={(e) =>
                            setAllocations((prev) =>
                              prev.map((r) =>
                                r.rowId === row.rowId ? { ...r, sub_description: e.target.value } : r
                              )
                            )
                          }
                          placeholder="- Ke Kas Huria / Pendeta"
                          className="sm:col-span-4 h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
                        />

                        <select
                          value={row.kas_id}
                          onChange={(e) => {
                            const nextKas = e.target.value;
                            setAllocations((prev) =>
                              prev.map((r) =>
                                r.rowId === row.rowId
                                  ? {
                                      ...r,
                                      kas_id: nextKas,
                                      is_sentralisasi: inferDefaultSentralisasiForKas(nextKas),
                                      exclusion_type: inferExclusionForKas(nextKas),
                                    }
                                  : r
                              )
                            );
                          }}
                          className="sm:col-span-4 h-9 px-2 rounded-lg border border-slate-200 bg-white text-xs"
                        >
                          {selectableKas.map((k) => (
                            <option key={k.id} value={k.id}>
                              {k.nama}
                            </option>
                          ))}
                        </select>

                        <input
                          type="text"
                          inputMode="numeric"
                          value={
                            row.amountInput
                              ? Number(row.amountInput.replace(/[^0-9]/g, '')).toLocaleString('id-ID')
                              : ''
                          }
                          onChange={(e) =>
                            setAllocations((prev) =>
                              prev.map((r) =>
                                r.rowId === row.rowId ? { ...r, amountInput: e.target.value } : r
                              )
                            )
                          }
                          placeholder="Nominal"
                          className="sm:col-span-4 h-9 px-2.5 rounded-lg border border-slate-200 font-mono font-bold text-right text-xs tabular-nums"
                        />
                      </div>

                      {rowAmt > 0 && (
                        <div className="text-[10px] text-slate-600 flex items-center gap-1 tabular-nums">
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                          {row.is_sentralisasi && sentralisasiKas && row.kas_id !== sentralisasiKas.id ? (
                            <span>
                              {rowKasName}: <strong className="font-mono">{formatRupiah(rowSplit.huriaAmount)}</strong> · Sentralisasi:{' '}
                              <strong className="font-mono text-blue-700">{formatRupiah(rowSplit.bpskAmount)}</strong>
                            </span>
                          ) : (
                            <span>
                              {rowKasName} (100%): <strong className="font-mono text-emerald-700">{formatRupiah(rowAmt)}</strong>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleAddAllocationRow}
                className="w-full h-9 border border-dashed border-slate-300 text-slate-700 hover:bg-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Baris</span>
              </button>

              <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs tabular-nums">
                <span className="font-semibold text-slate-600">Total Penerimaan</span>
                <span className="font-mono font-bold text-sm text-slate-900">
                  {formatRupiah(multiSummary.totalGross)}
                </span>
              </div>
            </div>
          )}

          {/* Expense Procurement Compact Hint */}
          {type === 'expense' && rawAmount > settings.receipt_required_threshold && (
            (() => {
              const rule = getPpkuProcurementRule(rawAmount);
              return (
                <div className={`px-3 py-2 rounded-xl border text-[11px] font-medium ${rule.badgeClass}`}>
                  {rule.label} · {rule.pasalRef}
                </div>
              );
            })()
          )}

          {/* Uraian */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {type === 'income' && incomeMode === 'multi' ? 'Uraian Utama (mis. Ucapan Syukur Kel. ...)' : 'Uraian'}{' '}
              <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setDescriptionManuallyEdited(true);
              }}
              rows={2}
              placeholder={
                type === 'income' && incomeMode === 'multi'
                  ? 'Ucapan Syukur dari Kel. ...'
                  : 'Contoh: Pelean Ibadah IA / Pembayaran listrik gereja'
              }
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              required
            />
          </div>

          {/* Upload Nota */}
          <div className="p-2.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-slate-700">
              <Camera className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="font-medium">Foto Nota</span>
              {isReceiptMandatory && (
                <span className="text-[10px] text-rose-700 font-semibold">(Wajib)</span>
              )}
            </div>

            {attachmentUrl ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Terlampir
                </span>
                <button
                  type="button"
                  onClick={() => setAttachmentUrl(null)}
                  className="text-[11px] text-rose-600 hover:underline font-medium"
                >
                  Hapus
                </button>
              </div>
            ) : (
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50">
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>{uploading ? 'Mengunggah...' : 'Unggah'}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            )}
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="px-4 sm:px-5 pt-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] sm:pb-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] sm:min-h-0 sm:h-10 px-3.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Batal
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave(false)}
              className="min-h-[44px] sm:min-h-0 sm:h-10 px-3.5 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-xl transition-colors"
            >
              Simpan Draft
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave(true)}
              className="min-h-[44px] sm:min-h-0 sm:h-10 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
            >
              Ajukan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
