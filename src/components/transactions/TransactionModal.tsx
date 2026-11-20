/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ArrowLeft,
  Users,
  Search,
  UserPlus,
  Landmark,
  Check,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { uploadReceiptFile } from '../../lib/supabase';
import { formatRupiah, formatNamaKeluarga, getTodayYmd, getYmdYear, getYmdMonth } from '../../lib/formatters';
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

const WIZARD_STEPS = [
  { step: 1 as const, shortLabel: 'Jenis & Tgl', title: 'Pilih Jenis & Tanggal' },
  { step: 2 as const, shortLabel: 'Kas & Nominal', title: 'Kategori, Kas & Nominal' },
  { step: 3 as const, shortLabel: 'Rincian', title: 'Rincian & Uraian' },
  { step: 4 as const, shortLabel: 'Konfirmasi', title: 'Bukti & Konfirmasi' },
];

export const isPeleanBulananTahunanCategory = (cat?: { id?: string; nama?: string } | null): boolean => {
  if (!cat) return false;
  const nama = (cat.nama || '').trim();
  if (!nama) return false;
  return (
    /pelean.*(bulanan|tahunan|\btaon\b|namarboho)/i.test(nama) ||
    /bulanan\s*[/&-]\s*tahunan/i.test(nama)
  );
};

const isTransitorisKas = (kas?: { id?: string; kode?: string; nama?: string } | null): boolean => {
  if (!kas) return false;
  if (kas.id === 'kas-8') return true;
  const combined = `${kas.kode || ''} ${kas.nama || ''}`.toLowerCase();
  return combined.includes('transitoris') || combined.includes('titipan');
};

const getMultiPosCategoryPriority = (cat: { nama?: string; sentralisasi_group?: string | null }): number => {
  const nama = (cat.nama || '').trim();
  if (/hamauliateon|ucapan\s*syukur/i.test(nama)) return 0;
  if (cat.sentralisasi_group === 'pelean_syukur' || /\bsyukur\b/i.test(nama)) return 1;
  return 2;
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

  // Mobile (< 640px) renders a 4-step Wizard; Desktop (>= 640px) renders crisp single-view form
  const [isMobileWizard, setIsMobileWizard] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)').matches : false
  );
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobileWizard(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [incomeMode, setIncomeMode] = useState<'single' | 'multi'>('single');

  const [tanggal, setTanggal] = useState<string>(getTodayYmd());
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
  const formBodyRef = useRef<HTMLDivElement>(null);

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

  const displayedCategories = useMemo(() => {
    const active = categories.filter((c) => c.tipe === type && c.is_active);
    if (type === 'income' && incomeMode === 'multi') {
      return [...active].sort(
        (a, b) => getMultiPosCategoryPriority(a) - getMultiPosCategoryPriority(b)
      );
    }
    return active;
  }, [categories, type, incomeMode]);

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
      if (formBodyRef.current) {
        formBodyRef.current.scrollTop = 0;
      }
      const todayStr = getTodayYmd();
      setWizardStep(1);
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
        setIsPeleanTaonMode(Boolean(peleanCat && isPeleanBulananTahunanCategory(peleanCat)));
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
        const rawFamLabel =
          defaultPeleanTaon.familyName ||
          families.find((f) => f.id === defaultPeleanTaon.familyId)?.nama_keluarga ||
          '';
        const famLabel = rawFamLabel ? formatNamaKeluarga(rawFamLabel) : '';
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
            sub_description: '',
            amountInput: '',
            is_sentralisasi: inferDefaultSentralisasiForKas(initialKas),
            exclusion_type: inferExclusionForKas(initialKas),
          },
        ]);
      }
    }
  }, [isOpen, defaultKasId, defaultPeleanTaon]);

  // Reset scroll to top on mobile wizard step change
  useEffect(() => {
    if (formBodyRef.current) {
      formBodyRef.current.scrollTop = 0;
    }
  }, [wizardStep]);

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
    if (displayedCategories.length > 0) {
      setCategoryId((prev) =>
        displayedCategories.some((c) => c.id === prev) ? prev : displayedCategories[0].id
      );
    } else {
      setCategoryId('');
    }
  }, [type, displayedCategories, isOpen, defaultPeleanTaon]);

  const handleSelectIncomeMode = (nextMode: 'single' | 'multi') => {
    setIncomeMode(nextMode);
    if (nextMode === 'multi') {
      const incomeSorted = categories
        .filter((c) => c.tipe === 'income' && c.is_active)
        .sort((a, b) => getMultiPosCategoryPriority(a) - getMultiPosCategoryPriority(b));
      const topSyukur = incomeSorted.find((c) => getMultiPosCategoryPriority(c) < 2) || incomeSorted[0];
      if (topSyukur) {
        setCategoryId(topSyukur.id);
      }
    }
  };

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
      ? formatNamaKeluarga(peleanManualFamilyName)
      : formatNamaKeluarga(selectedFamObj?.nama_keluarga);
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

  // Reset Mode Pelean Taon cleanly whenever selected category/type/mode is not Pelean Bulanan/Tahunan
  useEffect(() => {
    if (!isPeleanCategorySelected && isPeleanTaonMode) {
      setIsPeleanTaonMode(false);
      if (!descriptionManuallyEdited && /^Pelean Taon\s/i.test(description)) {
        setDescription('');
      }
    }
  }, [isPeleanCategorySelected, isPeleanTaonMode, descriptionManuallyEdited, description]);

  const handleCategoryChange = (newCatId: string) => {
    setCategoryId(newCatId);
    const cat = categories.find((c) => c.id === newCatId);
    if (type === 'income' && incomeMode === 'single' && isPeleanBulananTahunanCategory(cat)) {
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
    if (!descriptionManuallyEdited && /^Pelean Taon\s/i.test(description)) {
      setDescription('');
    }
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
  const selectedStorage = storageAccounts.find((s) => s.id === storageAccountId);
  const singleSplit = splitSentralisasiAmount(rawAmount, type === 'income' ? isSentralisasi : false);
  const activePeleanMode = isPeleanCategorySelected && isPeleanTaonMode;

  const resolvedPeleanFamilyDisplay = activePeleanMode
    ? peleanUseManualFamily
      ? formatNamaKeluarga(peleanManualFamilyName)
      : formatNamaKeluarga(families.find((f) => f.id === peleanFamilyId)?.nama_keluarga || '')
    : '';

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
      { kasId: 'kas-1', subDesc: '', amount: '200000', isSentralisasi: true, exType: null },
      { kasId: 'kas-7', subDesc: '', amount: '100000', isSentralisasi: false, exType: 'pembangunan_lokal' },
      { kasId: 'kas-2', subDesc: '', amount: '100000', isSentralisasi: false, exType: 'sosial_duka' },
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
      const activeIncomeCats = categories.filter((c) => c.tipe === 'income' && c.is_active);
      const syukurCat =
        activeIncomeCats.find((c) => getMultiPosCategoryPriority(c) === 0) ||
        activeIncomeCats.find((c) => c.id === 'cat-in-syukur-keluarga') ||
        activeIncomeCats.find((c) => c.id === 'cat-in-syukur-altar') ||
        activeIncomeCats.find((c) => getMultiPosCategoryPriority(c) === 1);
      if (syukurCat) setCategoryId(syukurCat.id);
      if (!description.trim()) {
        setDescription('Ucapan Syukur Keluarga');
      }
    }
  };

  const validateWizardStep = (step: 1 | 2 | 3): string | null => {
    if (step === 1) {
      if (!tanggal) return 'Tanggal transaksi wajib diisi.';
      return null;
    }
    if (step === 2) {
      if (!storageAccountId) return 'Pilih tempat penyimpanan.';
      if (!categoryId) return 'Pilih kategori transaksi.';
      if (type === 'expense' || incomeMode === 'single') {
        if (activePeleanMode) {
          const targetHuriaKas = kasUmumHuria?.id || 'kas-1';
          if (!canInputKas(targetHuriaKas)) {
            return 'Anda tidak memiliki hak akses input pada Kas Umum Huria (Pelean Taon wajib masuk ke Kas Huria).';
          }
          if (!peleanLingkungan.trim()) return 'Pilih Lingkungan jemaat terlebih dahulu.';
          if (peleanUseManualFamily) {
            if (!formatNamaKeluarga(peleanManualFamilyName)) {
              return 'Masukkan Nama Keluarga secara manual.';
            }
          } else if (!families.some((f) => f.id === peleanFamilyId)) {
            return 'Pilih Nama Keluarga dari daftar atau gunakan Input Manual.';
          }
          if (!tanggalWarta) {
            return 'Tanggal Warta wajib diisi untuk pencatatan Pelean Taon (kembali ke Langkah 1).';
          }
        } else if (!kasId) {
          return 'Pilih Kas tujuan/sumber.';
        }
        if (rawAmount <= 0) return 'Nominal harus lebih besar dari Rp 0.';
        const checkKasId = activePeleanMode ? kasUmumHuria?.id || 'kas-1' : kasId;
        const txYr = getYmdYear(tanggal);
        const txMo = getYmdMonth(tanggal);
        if (isPeriodClosed(txYr, txMo, checkKasId)) {
          return `Periode ${txMo}/${txYr} untuk kas ini sudah ditutup.`;
        }
      }
      return null;
    }
    if (step === 3) {
      if (type === 'income' && incomeMode === 'multi') {
        if (allocations.length === 0) return 'Tambahkan minimal 1 baris rincian kas.';
        for (let i = 0; i < allocations.length; i++) {
          const row = allocations[i];
          if (!row.kas_id) return `Baris ke-${i + 1} belum memilih Kas Tujuan.`;
          if (parseNum(row.amountInput) <= 0) return `Nominal baris ke-${i + 1} harus lebih dari Rp 0.`;
        }
      }
      if (!description.trim()) return 'Uraian transaksi wajib diisi.';
      return null;
    }
    return null;
  };

  const handleWizardNext = () => {
    const err = validateWizardStep(wizardStep as 1 | 2 | 3);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setWizardStep((prev) => (prev < 4 ? ((prev + 1) as 1 | 2 | 3 | 4) : prev));
  };

  const handleWizardBack = () => {
    setError('');
    setWizardStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4) : prev));
  };

  const handleStepPillClick = (targetStep: 1 | 2 | 3 | 4) => {
    if (targetStep === wizardStep) return;
    if (targetStep < wizardStep) {
      setError('');
      setWizardStep(targetStep);
      return;
    }
    // Validate intermediate steps before jumping forward
    for (let s = wizardStep; s < targetStep; s++) {
      const err = validateWizardStep(s as 1 | 2 | 3);
      if (err) {
        setError(err);
        return;
      }
    }
    setError('');
    setWizardStep(targetStep);
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

      const txYr = getYmdYear(tanggal);
      const txMo = getYmdMonth(tanggal);
      for (const row of allocations) {
        if (isPeriodClosed(txYr, txMo, row.kas_id)) {
          const closedKas = kasList.find((k) => k.id === row.kas_id)?.nama || 'salah satu kas';
          setError(`Periode ${txMo}/${txYr} untuk ${closedKas} sudah ditutup.`);
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
        allocations: allocations.map((r) => {
          const targetKas = kasList.find((k) => k.id === r.kas_id);
          const cleanSubDesc = isTransitorisKas(targetKas)
            ? r.sub_description.trim() || undefined
            : undefined;
          return {
            kas_id: r.kas_id,
            amount: parseNum(r.amountInput),
            is_sentralisasi: r.is_sentralisasi,
            sub_description: cleanSubDesc,
            exclusion_type: r.is_sentralisasi ? null : r.exclusion_type || inferExclusionForKas(r.kas_id),
          };
        }),
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
        const formattedManual = formatNamaKeluarga(peleanManualFamilyName);
        if (!formattedManual) {
          setError('Masukkan Nama Keluarga secara manual.');
          return;
        }
        resolvedFamilyName = formattedManual;
      } else {
        const famObj = families.find((f) => f.id === peleanFamilyId);
        if (!famObj) {
          setError('Pilih Nama Keluarga dari daftar atau gunakan opsi Input Manual.');
          return;
        }
        resolvedFamilyId = famObj.id;
        resolvedFamilyName = formatNamaKeluarga(famObj.nama_keluarga);
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

    const txYr = getYmdYear(tanggal);
    const txMo = getYmdMonth(tanggal);
    if (isPeriodClosed(txYr, txMo, resolvedKasId)) {
      setError(`Periode ${txMo}/${txYr} untuk kas ini sudah ditutup.`);
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

  // Shared Reusable Sub-blocks
  const renderPeleanTaonSection = () => (
    <div className="p-3.5 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/90 to-slate-50 space-y-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-900">Persembahan Tahunan (Pelean Taon)</div>
            <div className="text-[11px] text-slate-600">
              Pencatatan kewajiban tahunan keluarga per lingkungan
            </div>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer bg-white px-3 py-2 sm:py-1.5 rounded-xl border border-blue-200 font-semibold text-[11px] text-blue-900 min-h-[40px] sm:min-h-0">
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
        <div className="space-y-3 pt-2 border-t border-blue-200/70">
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

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-700">
                Nama Keluarga Jemaat <span className="text-rose-500">*</span>
              </label>
              <div className="inline-flex p-0.5 rounded-lg bg-white border border-blue-200">
                <button
                  type="button"
                  onClick={() => setPeleanUseManualFamily(false)}
                  className={`px-2.5 py-1.5 sm:py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    !peleanUseManualFamily
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Database ({filteredFamiliesForDropdown.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPeleanUseManualFamily(true)}
                  className={`px-2.5 py-1.5 sm:py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ${
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
                    className="w-full h-11 sm:h-10 pl-8 pr-3 rounded-xl border border-blue-200 bg-white text-xs"
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
                      {formatNamaKeluarga(f.nama_keluarga)} {!peleanLingkungan ? `(${f.lingkungan})` : ''}
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
                  onBlur={() => {
                    if (peleanManualFamilyName.trim()) {
                      setPeleanManualFamilyName(formatNamaKeluarga(peleanManualFamilyName));
                    }
                  }}
                  placeholder="Contoh: St. Saruddin Naibaho, BA (+) / Maria Magdalena Siregar, BA"
                  className="w-full h-11 sm:h-10 px-3 rounded-xl border border-blue-200 bg-white text-xs font-medium text-slate-900"
                />
                <p className="text-[11px] text-slate-500">
                  Otomatis diawali <span className="font-semibold text-slate-700">&quot;Kel. &quot;</span> saat disimpan.
                </p>
                <label className="inline-flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer min-h-[36px]">
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

          <div className="p-2.5 rounded-xl bg-white border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
            <span className="text-slate-600 font-medium">
              Aturan Huria: Kas Umum Huria (45%) &amp; Sentralisasi BPSK (55%)
            </span>
            <div className="flex items-center gap-3 font-mono tabular-nums">
              <span className="text-emerald-700">
                45%: <strong>{formatRupiah(splitSentralisasiAmount(rawAmount, true).huriaAmount)}</strong>
              </span>
              <span className="text-blue-700">
                55%: <strong>{formatRupiah(splitSentralisasiAmount(rawAmount, true).bpskAmount)}</strong>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderSentralisasiSelector = () => (
    <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/80 space-y-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-800">Status Sentralisasi Transaksi</span>
        <span className="text-[10px] font-medium text-slate-500">Aturan PPKU HKBP</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => setIsSentralisasi(true)}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-2 min-h-[58px] ${
            isSentralisasi
              ? 'bg-white border-blue-600 text-blue-950 ring-2 ring-blue-600/15 shadow-2xs'
              : 'bg-white/70 border-slate-200 text-slate-600 hover:bg-white'
          }`}
        >
          <div className="min-w-0">
            <div className="text-xs font-bold">Sentralisasi (45/55)</div>
            <div className="text-[11px] text-slate-500 mt-0.5">45% Kas · 55% BPSK</div>
          </div>
          <span
            className={`w-4 h-4 rounded-full border shrink-0 mt-0.5 flex items-center justify-center ${
              isSentralisasi ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
            }`}
          >
            {isSentralisasi && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setIsSentralisasi(false);
            setExclusionType(inferExclusionForKas(kasId));
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-2 min-h-[58px] ${
            !isSentralisasi
              ? 'bg-white border-emerald-600 text-emerald-950 ring-2 ring-emerald-600/15 shadow-2xs'
              : 'bg-white/70 border-slate-200 text-slate-600 hover:bg-white'
          }`}
        >
          <div className="min-w-0">
            <div className="text-xs font-bold">Non-Sentralisasi (100%)</div>
            <div className="text-[11px] text-slate-500 mt-0.5 truncate">
              100% ke {selectedKas?.nama || 'Kas'}
            </div>
          </div>
          <span
            className={`w-4 h-4 rounded-full border shrink-0 mt-0.5 flex items-center justify-center ${
              !isSentralisasi ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white'
            }`}
          >
            {!isSentralisasi && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
          </span>
        </button>
      </div>

      {isSentralisasi ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-[11px] tabular-nums">
          <span className="text-slate-600">
            {selectedKas?.nama || 'Kas'} (45%):{' '}
            <strong className="text-slate-900 font-mono">{formatRupiah(singleSplit.huriaAmount)}</strong>
          </span>
          <span className="text-blue-700">
            Sentralisasi (55%): <strong className="font-mono">{formatRupiah(singleSplit.bpskAmount)}</strong>
          </span>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5">
          <select
            value={exclusionType}
            onChange={(e) => setExclusionType(e.target.value as SentralisasiExclusionType)}
            className="flex-1 h-11 sm:h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs"
          >
            <option value="pembangunan_lokal">Pembangunan Lokal</option>
            <option value="sosial_duka">Diakonia Sosial / Duka</option>
            <option value="transitoris">Transitoris / Titipan</option>
            <option value="beasiswa">Beasiswa</option>
            <option value="lainnya">Non-Sentralisasi Lainnya</option>
          </select>
          <span className="font-mono font-bold text-emerald-700 text-xs tabular-nums shrink-0 px-1">
            100%: {formatRupiah(rawAmount)}
          </span>
        </div>
      )}
    </div>
  );

  const renderMultiPosSection = () => (
    <div className="p-3 sm:p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2.5 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-800">Rincian Alokasi Kas ({allocations.length})</span>
        <button
          type="button"
          onClick={handleApplyUcapanSyukurTemplate}
          className="px-3.5 py-2 min-h-[44px] sm:min-h-[36px] bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl sm:rounded-lg text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap"
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>Contoh Ucapan Syukur</span>
        </button>
      </div>

      <div className="space-y-2.5">
        {allocations.map((row, idx) => {
          const rowAmt = parseNum(row.amountInput);
          const rowSplit = splitSentralisasiAmount(rowAmt, row.is_sentralisasi);
          const selectedRowKas = kasList.find((k) => k.id === row.kas_id);
          const rowKasName = selectedRowKas?.nama || 'Kas';
          const rowIsTransitoris = isTransitorisKas(selectedRowKas);

          return (
            <div
              key={row.rowId}
              className="p-3 bg-white rounded-xl border border-slate-200 space-y-2.5 text-xs min-w-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-500">Baris #{idx + 1}</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div
                    role="group"
                    aria-label={`Status sentralisasi baris ${idx + 1}`}
                    className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200"
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
                      className={`px-2.5 py-1.5 min-h-[34px] sm:min-h-[30px] rounded-md text-[11px] font-semibold cursor-pointer transition-all whitespace-nowrap ${
                        row.is_sentralisasi
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                      }`}
                    >
                      45/55
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
                      className={`px-2.5 py-1.5 min-h-[34px] sm:min-h-[30px] rounded-md text-[11px] font-semibold cursor-pointer transition-all whitespace-nowrap ${
                        !row.is_sentralisasi
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                      }`}
                    >
                      100%
                    </button>
                  </div>

                  {allocations.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setAllocations((prev) => prev.filter((r) => r.rowId !== row.rowId))
                      }
                      className="p-2 sm:p-1.5 min-h-[38px] min-w-[38px] sm:min-h-[34px] sm:min-w-[34px] text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg inline-flex items-center justify-center cursor-pointer transition-colors"
                      aria-label="Hapus baris"
                      title="Hapus baris"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <select
                  value={row.kas_id}
                  onChange={(e) => {
                    const nextKas = e.target.value;
                    const nextKasObj = kasList.find((k) => k.id === nextKas);
                    const nextIsTrans = isTransitorisKas(nextKasObj);
                    setAllocations((prev) =>
                      prev.map((r) =>
                        r.rowId === row.rowId
                          ? {
                              ...r,
                              kas_id: nextKas,
                              sub_description: nextIsTrans ? r.sub_description : '',
                              is_sentralisasi: inferDefaultSentralisasiForKas(nextKas),
                              exclusion_type: inferExclusionForKas(nextKas),
                            }
                          : r
                      )
                    );
                  }}
                  aria-label={`Daftar Kas baris ${idx + 1}`}
                  className={`${
                    rowIsTransitoris ? 'sm:col-span-4' : 'sm:col-span-7'
                  } h-11 sm:h-9 px-2.5 rounded-xl sm:rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-900`}
                >
                  {selectableKas.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama}
                    </option>
                  ))}
                </select>

                {rowIsTransitoris && (
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
                    placeholder="Tujuan titipan (mis. Ke Pendeta / Lingkungan)"
                    aria-label={`Tujuan Transitoris baris ${idx + 1}`}
                    className="sm:col-span-4 h-11 sm:h-9 px-3 rounded-xl sm:rounded-lg border border-blue-200 bg-blue-50/30 text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                )}

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
                  placeholder="Nominal (Rp)"
                  className={`${
                    rowIsTransitoris ? 'sm:col-span-4' : 'sm:col-span-5'
                  } h-11 sm:h-9 px-3 rounded-xl sm:rounded-lg border border-slate-200 font-mono font-bold text-right text-xs tabular-nums`}
                />
              </div>

              {rowAmt > 0 && (
                <div className="text-[11px] text-slate-600 flex items-center gap-1 tabular-nums">
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
        className="w-full h-11 sm:h-9 border border-dashed border-slate-300 text-slate-700 hover:bg-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
      >
        <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        <span>Tambah Baris Alokasi</span>
      </button>

      <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs tabular-nums">
        <span className="font-semibold text-slate-600">Total Penerimaan</span>
        <span className="font-mono font-bold text-base text-slate-900">
          {formatRupiah(multiSummary.totalGross)}
        </span>
      </div>
    </div>
  );

  const renderReceiptUploadBox = () => (
    <div className="p-3.5 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-slate-700">
          <Camera className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="font-semibold">Foto Nota / Bukti Transaksi</span>
          {isReceiptMandatory && (
            <span className="text-[10px] text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md font-bold">
              Wajib (&ge; {formatRupiah(settings.receipt_required_threshold)})
            </span>
          )}
        </div>

        {attachmentUrl ? (
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              Terlampir
            </span>
            <button
              type="button"
              onClick={() => setAttachmentUrl(null)}
              className="text-xs text-rose-600 hover:underline font-semibold cursor-pointer px-2 py-1"
            >
              Hapus
            </button>
          </div>
        ) : (
          <label className="cursor-pointer inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] sm:min-h-[38px] bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-50 shadow-2xs transition-colors">
            <Upload className="w-4 h-4 text-blue-600" />
            <span>{uploading ? 'Mengunggah...' : 'Ambil Foto / Pilih File'}</span>
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

      {attachmentUrl && (
        <div className="rounded-xl overflow-hidden border border-slate-200 bg-white max-h-40 flex items-center justify-center">
          <img
            src={attachmentUrl}
            alt="Preview Nota"
            className="max-h-40 w-auto object-contain"
          />
        </div>
      )}
    </div>
  );

  // =========================================================================
  // MOBILE WIZARD VIEW (< 640px)
  // =========================================================================
  if (isMobileWizard) {
    const activeStepInfo = WIZARD_STEPS.find((s) => s.step === wizardStep)!;
    const totalSummaryAmount =
      type === 'income' && incomeMode === 'multi' ? multiSummary.totalGross : rawAmount;

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/65 backdrop-blur-xs">
        <div className="bg-white rounded-t-3xl w-full h-[94dvh] flex flex-col overflow-hidden shadow-2xl border-t border-slate-200 mobile-sheet-enter">
          {/* Drag Handle & Wizard Header */}
          <div className="shrink-0 bg-white border-b border-slate-100">
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>

            <div className="flex items-center justify-between px-4 py-2.5">
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                  Langkah {wizardStep} dari 4
                </div>
                <h3 className="font-bold text-base text-slate-900 truncate">
                  {activeStepInfo.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 4-Step Progress Pills */}
            <div className="px-4 pb-3">
              <div className="grid grid-cols-4 gap-1.5">
                {WIZARD_STEPS.map((s) => {
                  const isActive = s.step === wizardStep;
                  const isDone = s.step < wizardStep;
                  return (
                    <button
                      key={s.step}
                      type="button"
                      onClick={() => handleStepPillClick(s.step)}
                      className={`py-1.5 px-1 rounded-xl text-center transition-all border cursor-pointer ${
                        isActive
                          ? 'bg-[#0B132B] text-white border-[#0B132B]'
                          : isDone
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 text-[10px] font-bold">
                        {isDone ? <Check className="w-3 h-3 text-emerald-600" /> : <span>{s.step}.</span>}
                        <span className="truncate">{s.shortLabel}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Wizard Body */}
          <div ref={formBodyRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* STEP 1: JENIS, MODE & TANGGAL */}
            {wizardStep === 1 && (
              <div className="space-y-4 wizard-step-enter">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Jenis Transaksi <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setType('income')}
                      className={`p-3.5 min-h-[76px] rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                        type === 'income'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      <TrendingUp className={`w-5 h-5 ${type === 'income' ? 'text-white' : 'text-emerald-600'}`} />
                      <div>
                        <div className="text-sm font-bold">+ Pemasukan</div>
                        <div className={`text-[11px] ${type === 'income' ? 'text-emerald-100' : 'text-slate-500'}`}>
                          Pelean / Ucapan Syukur
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setType('expense')}
                      className={`p-3.5 min-h-[76px] rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                        type === 'expense'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      <TrendingDown className={`w-5 h-5 ${type === 'expense' ? 'text-white' : 'text-rose-600'}`} />
                      <div>
                        <div className="text-sm font-bold">- Pengeluaran</div>
                        <div className={`text-[11px] ${type === 'expense' ? 'text-rose-100' : 'text-slate-500'}`}>
                          Belanja / Operasional
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {type === 'income' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Mode Pembagian Pos Kas
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectIncomeMode('single')}
                        className={`p-3 min-h-[56px] rounded-xl border text-left transition-all cursor-pointer ${
                          incomeMode === 'single'
                            ? 'bg-blue-50 border-blue-600 text-blue-950 ring-2 ring-blue-600/15'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        <div className="text-xs font-bold">1 Pos Kas</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Pelean / Persembahan biasa</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectIncomeMode('multi')}
                        className={`p-3 min-h-[56px] rounded-xl border text-left transition-all cursor-pointer ${
                          incomeMode === 'multi'
                            ? 'bg-emerald-50 border-emerald-600 text-emerald-950 ring-2 ring-emerald-600/15'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        <div className="text-xs font-bold flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span>Multi Pos</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Ucapan Syukur (Huria, Pendeta, dll)</div>
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      {activePeleanMode ? 'Tanggal Penerimaan' : 'Tanggal Transaksi'}{' '}
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={tanggal}
                      onChange={(e) => setTanggal(e.target.value)}
                      className="w-full h-12 text-sm px-3.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label className="text-xs font-semibold text-slate-700">
                        Tanggal Warta{' '}
                        {activePeleanMode ? (
                          <span className="text-rose-500">*</span>
                        ) : (
                          <span className="text-slate-400 font-normal">(Opsional)</span>
                        )}
                      </label>
                      <button
                        type="button"
                        onClick={() => setTanggalWarta(getNextSunday(tanggal))}
                        className="text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        Minggu Berikutnya
                      </button>
                    </div>
                    <input
                      type="date"
                      value={tanggalWarta}
                      onChange={(e) => setTanggalWarta(e.target.value)}
                      className="w-full h-12 text-sm px-3.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: KATEGORI, KAS & NOMINAL */}
            {wizardStep === 2 && (
              <div className="space-y-4 wizard-step-enter">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Kategori <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full h-12 text-sm px-3.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  >
                    {displayedCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nama}
                      </option>
                    ))}
                  </select>
                </div>

                {isPeleanCategorySelected && renderPeleanTaonSection()}

                {(type === 'expense' || incomeMode === 'single') && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      {type === 'income' ? 'Kas Tujuan' : 'Kas Sumber'} <span className="text-rose-500">*</span>
                    </label>
                    {activePeleanMode ? (
                      <div className="h-12 px-3.5 rounded-xl border border-blue-200 bg-blue-50/70 flex items-center justify-between gap-2 text-xs text-blue-950 font-semibold">
                        <span className="flex items-center gap-2 min-w-0 truncate">
                          <Landmark className="w-4 h-4 text-blue-700 shrink-0" />
                          <span className="truncate">{kasUmumHuria?.nama || 'Kas Umum Huria'}</span>
                        </span>
                        <span className="text-[10px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded-md border border-blue-200 shrink-0">
                          Otomatis
                        </span>
                      </div>
                    ) : (
                      <select
                        value={kasId}
                        onChange={(e) => handleKasChange(e.target.value)}
                        className="w-full h-12 text-sm px-3.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
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

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Tempat Simpan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={storageAccountId}
                    onChange={(e) => setStorageAccountId(e.target.value)}
                    className="w-full h-12 text-sm px-3.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
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

                {type === 'expense' || incomeMode === 'single' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Nominal (Rp) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                        Rp
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={amountInput ? Number(amountInput.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : ''}
                        onChange={(e) => setAmountInput(e.target.value)}
                        placeholder="0"
                        className="w-full h-14 pl-11 pr-4 text-2xl font-bold text-slate-900 rounded-2xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-mono tabular-nums"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950">
                    <strong>Mode Multi Pos Aktif:</strong> Nominal akan dihitung otomatis dari setiap pos kas yang Anda isi pada langkah berikutnya (Langkah 3).
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: RINCIAN & URAIAN */}
            {wizardStep === 3 && (
              <div className="space-y-4 wizard-step-enter">
                {type === 'income' && incomeMode === 'single' && !activePeleanMode && renderSentralisasiSelector()}

                {activePeleanMode && (
                  <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 space-y-1.5 text-xs">
                    <div className="font-bold text-blue-950">Pembagian Pelean Taon Otomatis (PPKU)</div>
                    <div className="flex items-center justify-between text-slate-700">
                      <span>45% Kas Umum Huria:</span>
                      <strong className="font-mono text-emerald-700 tabular-nums">
                        {formatRupiah(splitSentralisasiAmount(rawAmount, true).huriaAmount)}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-700">
                      <span>55% Sentralisasi BPSK:</span>
                      <strong className="font-mono text-blue-700 tabular-nums">
                        {formatRupiah(splitSentralisasiAmount(rawAmount, true).bpskAmount)}
                      </strong>
                    </div>
                  </div>
                )}

                {type === 'income' && incomeMode === 'multi' && renderMultiPosSection()}

                {type === 'expense' && rawAmount > settings.receipt_required_threshold && (
                  (() => {
                    const rule = getPpkuProcurementRule(rawAmount);
                    return (
                      <div className={`px-3.5 py-2.5 rounded-xl border text-xs font-medium ${rule.badgeClass}`}>
                        {rule.label} · {rule.pasalRef}
                      </div>
                    );
                  })()
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {type === 'income' && incomeMode === 'multi'
                      ? 'Uraian Utama (mis. Ucapan Syukur Kel. ...)'
                      : 'Uraian Transaksi'}{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setDescriptionManuallyEdited(true);
                    }}
                    rows={3}
                    placeholder={
                      type === 'income' && incomeMode === 'multi'
                        ? 'Ucapan Syukur dari Kel. ...'
                        : 'Contoh: Pelean Ibadah IA / Pembayaran listrik gereja'
                    }
                    className="w-full text-sm p-3.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    No. Bukti <span className="text-slate-400 font-normal">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={receiptNo}
                    onChange={(e) => setReceiptNo(e.target.value)}
                    placeholder="Contoh: BKM-01 / KW-10"
                    className="w-full h-12 text-sm px-3.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                </div>
              </div>
            )}

            {/* STEP 4: BUKTI & KONFIRMASI */}
            {wizardStep === 4 && (
              <div className="space-y-4 wizard-step-enter">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                      Ringkasan Transaksi
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        type === 'income'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {type === 'income'
                        ? incomeMode === 'multi'
                          ? 'Pemasukan Multi Pos'
                          : 'Pemasukan'
                        : 'Pengeluaran'}
                    </span>
                  </div>

                  <div className="text-center py-2">
                    <span className="text-[11px] text-slate-500 block">Total Nominal</span>
                    <span
                      className={`text-2xl font-bold font-mono tabular-nums ${
                        type === 'income' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {type === 'income' ? '+' : '-'}
                      {formatRupiah(totalSummaryAmount)}
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-200">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Tanggal:</span>
                      <span className="font-semibold text-slate-900 font-mono">
                        {tanggal}{tanggalWarta ? ` · Warta ${tanggalWarta}` : ''}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Kategori:</span>
                      <span className="font-semibold text-slate-900 text-right">
                        {selectedCategoryObj?.nama || '-'}
                      </span>
                    </div>
                    {!(type === 'income' && incomeMode === 'multi') && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500">Kas:</span>
                        <span className="font-semibold text-slate-900 text-right">
                          {activePeleanMode ? kasUmumHuria?.nama || 'Kas Umum Huria' : selectedKas?.nama || '-'}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Simpanan:</span>
                      <span className="font-semibold text-slate-900 text-right">
                        {selectedStorage?.nama || '-'}
                      </span>
                    </div>
                    {resolvedPeleanFamilyDisplay && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500">Keluarga:</span>
                        <span className="font-semibold text-blue-800 text-right">
                          {resolvedPeleanFamilyDisplay} ({peleanLingkungan})
                        </span>
                      </div>
                    )}
                    <div className="pt-1">
                      <span className="text-slate-500 block mb-0.5">Uraian:</span>
                      <p className="font-medium text-slate-900 bg-white p-2.5 rounded-xl border border-slate-200">
                        {description || '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {renderReceiptUploadBox()}
              </div>
            )}
          </div>

          {/* Sticky Mobile Wizard Footer */}
          <div className="shrink-0 px-4 pt-3 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
            {wizardStep === 1 ? (
              <button
                type="button"
                onClick={onClose}
                className="min-h-[48px] px-4 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors"
              >
                Batal
              </button>
            ) : (
              <button
                type="button"
                onClick={handleWizardBack}
                className="min-h-[48px] px-4 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali</span>
              </button>
            )}

            {wizardStep < 4 ? (
              <button
                type="button"
                onClick={handleWizardNext}
                className="flex-1 min-h-[48px] px-5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl inline-flex items-center justify-center gap-1.5 shadow-xs"
              >
                <span>Lanjut</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-1 justify-end">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSave(false)}
                  className="min-h-[48px] px-3.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 disabled:opacity-60 rounded-xl transition-colors"
                >
                  Simpan Draft
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSave(true)}
                  className="min-h-[48px] px-5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-xl shadow-xs transition-colors"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Ajukan'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // DESKTOP VIEW (>= 640px) - Spacious & Unclipped
  // =========================================================================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        className={`bg-white rounded-2xl w-full max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 ${
          type === 'income' && incomeMode === 'multi' ? 'max-w-3xl' : 'max-w-2xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 bg-white">
          <div>
            <h3 className="font-bold text-base text-slate-900">Catat Transaksi</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {type === 'income'
                ? 'Pencatatan penerimaan kas jemaat & sentralisasi PPKU'
                : 'Pencatatan pengeluaran operasional kas'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pinned Mode & Type Switcher (Spacious, unclipped height) */}
        <div className="px-6 py-3.5 bg-slate-50/80 border-b border-slate-200/80 space-y-2.5 shrink-0">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200/70 rounded-xl">
            <button
              type="button"
              onClick={() => setType('income')}
              className={`h-10 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                type === 'income'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>+ Pemasukan</span>
            </button>
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`h-10 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                type === 'expense'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>- Pengeluaran</span>
            </button>
          </div>

          {type === 'income' && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200/60 rounded-xl">
              <button
                type="button"
                onClick={() => handleSelectIncomeMode('single')}
                className={`h-9 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  incomeMode === 'single'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1 Pos Kas
              </button>
              <button
                type="button"
                onClick={() => handleSelectIncomeMode('multi')}
                className={`h-9 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  incomeMode === 'multi'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span>Multi Pos / Ucapan Syukur</span>
              </button>
            </div>
          )}
        </div>

        {/* Form Body */}
        <div ref={formBodyRef} className="px-6 py-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Nominal (Single mode) */}
          {(type === 'expense' || incomeMode === 'single') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nominal (Rp) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amountInput ? Number(amountInput.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : ''}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="0"
                  className="w-full h-12 pl-10 pr-4 text-lg font-bold text-slate-900 rounded-xl border border-slate-200 bg-slate-50/40 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 font-mono tabular-nums transition-colors"
                />
              </div>
            </div>
          )}

          {/* Baris Tanggal: 2 Kolom Simetris */}
          <div className="grid grid-cols-2 gap-4 items-end">
            <div>
              <div className="min-h-[24px] flex items-center mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  {activePeleanMode ? 'Tanggal Penerimaan' : 'Tanggal Transaksi'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
              </div>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full h-10 text-xs px-3 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                required
              />
            </div>

            <div>
              <div className="min-h-[24px] flex items-center justify-between gap-2 mb-1.5">
                <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                  Tanggal Warta{' '}
                  {activePeleanMode ? (
                    <span className="text-rose-500">*</span>
                  ) : (
                    <span className="text-slate-400 font-normal">(Opsional)</span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={() => setTanggalWarta(getNextSunday(tanggal))}
                  className="text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                  title="Isi otomatis hari Minggu terdekat"
                >
                  Minggu Berikutnya
                </button>
              </div>
              <input
                type="date"
                value={tanggalWarta}
                onChange={(e) => setTanggalWarta(e.target.value)}
                className="w-full h-10 text-xs px-3 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>
          </div>

          {/* Kas, Tempat Simpan, Kategori, No. Bukti */}
          {type === 'expense' || incomeMode === 'single' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {type === 'income' ? 'Kas Tujuan' : 'Kas Sumber'} <span className="text-rose-500">*</span>
                  </label>
                  {activePeleanMode ? (
                    <div className="h-10 px-3 rounded-xl border border-blue-200 bg-blue-50/70 flex items-center justify-between gap-2 text-xs text-blue-950 font-semibold">
                      <span className="flex items-center gap-1.5 min-w-0 truncate">
                        <Landmark className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                        <span className="truncate">{kasUmumHuria?.nama || 'Kas Umum Huria'}</span>
                      </span>
                      <span className="text-[10px] font-bold text-blue-700 bg-white px-1.5 py-0.5 rounded-md border border-blue-200 shrink-0">
                        Otomatis
                      </span>
                    </div>
                  ) : (
                    <select
                      value={kasId}
                      onChange={(e) => handleKasChange(e.target.value)}
                      className="w-full h-10 text-xs px-3 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
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

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Tempat Simpan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={storageAccountId}
                    onChange={(e) => setStorageAccountId(e.target.value)}
                    className="w-full h-10 text-xs px-3 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Kategori <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full h-10 text-xs px-3 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    required
                  >
                    {displayedCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nama}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    No. Bukti <span className="text-slate-400 font-normal">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={receiptNo}
                    onChange={(e) => setReceiptNo(e.target.value)}
                    placeholder="Contoh: BKM-01 / KW-10"
                    className="w-full h-10 text-xs px-3 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tempat Simpan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={storageAccountId}
                  onChange={(e) => setStorageAccountId(e.target.value)}
                  className="w-full h-10 text-xs px-3 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Kategori <span className="text-rose-500">*</span>
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full h-10 text-xs px-3 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  required
                >
                  {displayedCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  No. Bukti <span className="text-slate-400 font-normal">(Opsional)</span>
                </label>
                <input
                  type="text"
                  value={receiptNo}
                  onChange={(e) => setReceiptNo(e.target.value)}
                  placeholder="BKM-01 / KW-10"
                  className="w-full h-10 text-xs px-3 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
            </div>
          )}

          {isPeleanCategorySelected && renderPeleanTaonSection()}

          {type === 'income' && incomeMode === 'single' && !activePeleanMode && renderSentralisasiSelector()}

          {type === 'income' && incomeMode === 'multi' && renderMultiPosSection()}

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

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
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
              className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              required
            />
          </div>

          {renderReceiptUploadBox()}
        </div>

        {/* Sticky Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
          >
            Batal
          </button>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave(false)}
              className="h-10 px-4 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 disabled:opacity-60 rounded-xl transition-colors cursor-pointer"
            >
              Simpan Draft
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave(true)}
              className="h-10 px-5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Menyimpan...' : 'Ajukan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
