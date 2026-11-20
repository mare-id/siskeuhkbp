/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Plus,
  ArrowRightLeft,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  Send,
  Download,
  FileSpreadsheet,
  FileText,
  Copy,
  Calendar,
  Layers,
  Info,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  FileUp,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ConfirmActionModal } from '../components/common/ConfirmActionModal';
import {
  Budget,
  BudgetItem,
  BudgetStatus,
  CategoryType,
  BudgetRealizationRow,
} from '../types/database';
import { formatRupiah, formatDateIndo, getTodayYmd } from '../lib/formatters';
import { exportToExcel, generateAnggaranRealisasiPDF } from '../lib/exportUtils';
import { generateMonthlyDistribution } from '../lib/demoData';

export default function BudgetPage() {
  const { toast } = useToast();
  const { currentUser, userKasAccess, canInputKas, canApproveKas, isAdmin, isLeader, isPendeta, isSekretaris } = useAuth();
  const {
    kasList,
    categories,
    settings,
    budgets,
    budgetItems,
    budgetReallocations,
    openingBalances,
    saveBudget,
    deleteBudget,
    saveBudgetItem,
    deleteBudgetItem,
    changeBudgetStatus,
    createBudgetRevision,
    reallocateBudget,
    copyBudgetFromPreviousYear,
    fiscalYears,
    getBudgetRealization,
    getConsolidatedBudgetRealization,
  } = useData();

  const activeYear = settings.active_year || 2026;

  // Active Tab
  const [activeTab, setActiveTab] = useState<'apbg' | 'pergeseran' | 'realisasi'>('apbg');

  const isSeksiUser = !isLeader && !isAdmin && currentUser?.role === 'pengurus_kas';
  const myAssignedKasIds = useMemo(() => userKasAccess.map((a) => a.kas_id), [userKasAccess]);
  const viewableKas = useMemo(
    () => (isSeksiUser ? kasList.filter((k) => myAssignedKasIds.includes(k.id)) : kasList),
    [isSeksiUser, kasList, myAssignedKasIds]
  );

  // Filter States
  const [selectedKasId, setSelectedKasId] = useState<string>(
    viewableKas[0]?.id || kasList[0]?.id || '11111111-1111-1111-1111-111111111101'
  );
  const [selectedTahun, setSelectedTahun] = useState<number>(activeYear || 2026);
  const [selectedVersion, setSelectedVersion] = useState<number>(1);

  // Realisasi Filter States
  const [realisasiKasId, setRealisasiKasId] = useState<string>(isSeksiUser ? viewableKas[0]?.id || 'all' : 'all'); // 'all' or specific kas_id
  const [realisasiMonth, setRealisasiMonth] = useState<number>(new Date().getMonth() + 1);

  React.useEffect(() => {
    if (viewableKas.length > 0 && !viewableKas.some((k) => k.id === selectedKasId)) {
      setSelectedKasId(viewableKas[0].id);
      setSelectedVersion(1);
    }
    if (isSeksiUser && viewableKas.length > 0 && (realisasiKasId === 'all' || !viewableKas.some((k) => k.id === realisasiKasId))) {
      setRealisasiKasId(viewableKas[0].id);
    }
  }, [viewableKas, selectedKasId, isSeksiUser, realisasiKasId]);

  // Modals & Popovers
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [showStatusModal, setShowStatusModal] = useState<{
    type: 'review' | 'submit_rapat' | 'approve' | 'return';
    budget: Budget;
  } | null>(null);
  const [showReallocationModal, setShowReallocationModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showMonthlyBreakdown, setShowMonthlyBreakdown] = useState<BudgetItem | null>(null);
  const [confirmModal, setConfirmModal] = useState<
    | { type: 'revision' }
    | { type: 'delete_item'; itemId: string; itemLabel: string }
    | null
  >(null);

  // Form States for Item Modal
  const [itemType, setItemType] = useState<CategoryType>('expense');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemAnnualAmount, setItemAnnualAmount] = useState<number>(0);
  const [itemMonthly, setItemMonthly] = useState<number[]>(new Array(12).fill(0));
  const [autoDistribute, setAutoDistribute] = useState(true);

  // Form States for Status Modal
  const [statusReturnNote, setStatusReturnNote] = useState('');
  const [rapatDate, setRapatDate] = useState(getTodayYmd());
  const [rapatBeritaAcaraNo, setRapatBeritaAcaraNo] = useState(`BA-RH/HKBP-HTR/I/${activeYear || 2026}`);
  const [rapatDocName, setRapatDocName] = useState('');

  // Form States for Reallocation Modal
  const [reallocFromId, setReallocFromId] = useState('');
  const [reallocToId, setReallocToId] = useState('');
  const [reallocAmount, setReallocAmount] = useState<number>(0);
  const [reallocReason, setReallocReason] = useState('');

  // Filter versions for current Kas & Year
  const availableBudgetsForKasAndYear = useMemo(() => {
    return budgets
      .filter((b) => b.kas_id === selectedKasId && b.tahun === selectedTahun)
      .sort((a, b) => b.version - a.version);
  }, [budgets, selectedKasId, selectedTahun]);

  // Active selected Budget
  const currentBudget = useMemo(() => {
    const match = availableBudgetsForKasAndYear.find((b) => b.version === selectedVersion);
    return match || availableBudgetsForKasAndYear[0] || null;
  }, [availableBudgetsForKasAndYear, selectedVersion]);

  // Keep selectedVersion & default Berita Acara year in sync
  React.useEffect(() => {
    if (currentBudget && currentBudget.version !== selectedVersion) {
      setSelectedVersion(currentBudget.version);
    }
  }, [currentBudget]);

  React.useEffect(() => {
    setRapatBeritaAcaraNo((prev) =>
      /^BA-RH\/HKBP-HTR\/I\/\d{4}$/.test(prev) ? `BA-RH/HKBP-HTR/I/${selectedTahun}` : prev
    );
  }, [selectedTahun]);

  // Items for the current budget
  const currentItems = useMemo(() => {
    if (!currentBudget) return [];
    return budgetItems.filter((item) => item.budget_id === currentBudget.id);
  }, [budgetItems, currentBudget]);

  // Selected Kas object
  const selectedKas = useMemo(() => {
    return kasList.find((k) => k.id === selectedKasId);
  }, [kasList, selectedKasId]);

  // Summary Calculations for Current Budget
  const incomeItems = useMemo(() => currentItems.filter((i) => i.type === 'income'), [currentItems]);
  const expenseItems = useMemo(() => currentItems.filter((i) => i.type === 'expense'), [currentItems]);

  const totalIncomeBudget = useMemo(() => {
    return incomeItems.reduce((sum, i) => sum + i.annual_amount, 0);
  }, [incomeItems]);

  const totalExpenseBudget = useMemo(() => {
    return expenseItems.reduce((sum, i) => sum + i.annual_amount, 0);
  }, [expenseItems]);

  // Opening balance: from opening_balances or estimated
  const openingBalanceForKas = useMemo(() => {
    const records = openingBalances.filter(
      (ob) => ob.kas_id === selectedKasId && ob.tahun === selectedTahun
    );
    if (records.length > 0) {
      return records.reduce((sum, ob) => sum + ob.amount, 0);
    }
    return currentBudget ? currentBudget.estimated_opening_balance : 0;
  }, [openingBalances, selectedKasId, selectedTahun, currentBudget]);

  const isOpeningBalanceLocked = useMemo(() => {
    // If opening_balances exist for this kas, consider locked
    return openingBalances.some((ob) => ob.kas_id === selectedKasId && ob.tahun === selectedTahun);
  }, [openingBalances, selectedKasId, selectedTahun]);

  const netSurplusDeficit = useMemo(() => {
    return totalIncomeBudget - totalExpenseBudget;
  }, [totalIncomeBudget, totalExpenseBudget]);

  const availableLiquidity = useMemo(() => {
    return openingBalanceForKas + totalIncomeBudget;
  }, [openingBalanceForKas, totalIncomeBudget]);

  const hasLiquidityDeficit = totalExpenseBudget > availableLiquidity;
  const liquidityDeficitAmount = totalExpenseBudget - availableLiquidity;

  // Check user permissions on current Kas
  const isKasBendahara = useMemo(() => {
    return canInputKas(selectedKasId) || isAdmin;
  }, [canInputKas, selectedKasId, isAdmin]);

  const isKasKetua = useMemo(() => {
    return canApproveKas(selectedKasId) || isAdmin;
  }, [canApproveKas, selectedKasId, isAdmin]);

  const isSekretarisOrPendeta = useMemo(() => {
    return isAdmin || isSekretaris || isPendeta;
  }, [isAdmin, isSekretaris, isPendeta]);

  // Is Creator
  const isBudgetCreator = useMemo(() => {
    return currentBudget?.created_by === currentUser?.id;
  }, [currentBudget, currentUser]);

  // Helper status color & badge
  const getStatusBadge = (status: BudgetStatus) => {
    switch (status) {
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
            <Clock className="w-3.5 h-3.5 text-gray-500" />
            Draf Anggaran
          </span>
        );
      case 'reviewed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
            Ditinjau Ketua
          </span>
        );
      case 'submitted_rapat':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Send className="w-3.5 h-3.5 text-amber-500" />
            Diajukan ke Rapat Huria
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Disahkan (Terkunci)
          </span>
        );
      case 'returned':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
            Dikembalikan
          </span>
        );
    }
  };

  // Open Item Modal
  const handleOpenAddItem = (type: CategoryType) => {
    setItemType(type);
    setEditingItem(null);
    const catList = categories.filter((c) => c.tipe === type && c.is_active);
    setItemCategoryId(catList[0]?.id || '');
    setItemDescription('');
    setItemAnnualAmount(0);
    setItemMonthly(new Array(12).fill(0));
    setAutoDistribute(true);
    setShowItemModal(true);
  };

  const handleOpenEditItem = (item: BudgetItem) => {
    setEditingItem(item);
    setItemType(item.type);
    setItemCategoryId(item.category_id);
    setItemDescription(item.description || '');
    setItemAnnualAmount(item.annual_amount);
    setItemMonthly([...item.monthly_distribution]);
    setAutoDistribute(false);
    setShowItemModal(true);
  };

  const handleAnnualAmountChange = (val: number) => {
    setItemAnnualAmount(val);
    if (autoDistribute) {
      setItemMonthly(generateMonthlyDistribution(val));
    }
  };

  const handleSaveItem = async () => {
    if (!currentBudget) return;
    if (!itemCategoryId) {
      toast.error('Silakan pilih kategori pos anggaran.');
      return;
    }
    if (itemAnnualAmount <= 0) {
      toast.error('Nominal setahun harus lebih besar dari 0.');
      return;
    }

    const sumMonthly = itemMonthly.reduce((a, b) => a + b, 0);
    if (Math.abs(sumMonthly - itemAnnualAmount) > 1) {
      toast.error(
        `Total sebaran 12 bulan (${formatRupiah(sumMonthly)}) harus sama dengan nominal setahun (${formatRupiah(itemAnnualAmount)}).`
      );
      return;
    }

    const res = await saveBudgetItem({
      id: editingItem ? editingItem.id : undefined,
      budget_id: currentBudget.id,
      category_id: itemCategoryId,
      type: itemType,
      description: itemDescription,
      annual_amount: itemAnnualAmount,
      monthly_distribution: itemMonthly,
    });

    if (!res.success) {
      toast.error(res.error || 'Gagal menyimpan pos anggaran.');
      return;
    }

    toast.success(editingItem ? 'Pos anggaran diperbarui.' : 'Pos anggaran ditambahkan.');
    setShowItemModal(false);
  };

  // Create Initial Budget Draft if none exists
  const handleCreateInitialBudget = async () => {
    if (!selectedKas) return;
    const res = await saveBudget({
      kas_id: selectedKasId,
      tahun: selectedTahun,
      version: 1,
      title: `APBG ${selectedKas.nama} Tahun ${selectedTahun}`,
      status: 'draft',
      estimated_opening_balance: openingBalanceForKas,
      is_opening_balance_locked: isOpeningBalanceLocked,
      is_current_active: false,
      notes: `Draf awal APBG disusun oleh ${currentUser?.full_name || 'Bendahara'}`,
    });
    if (!res.success) {
      toast.error(res.error || 'Gagal membuat draf APBG awal.');
      return;
    }
    toast.success('Draf APBG awal berhasil dibuat.');
  };

  // Handle Workflow Status Changes
  const handleConfirmStatusChange = async () => {
    if (!showStatusModal) return;
    const { type, budget } = showStatusModal;

    let targetStatus: BudgetStatus = 'draft';
    if (type === 'review') targetStatus = 'reviewed';
    if (type === 'submit_rapat') targetStatus = 'submitted_rapat';
    if (type === 'approve') targetStatus = 'approved';
    if (type === 'return') targetStatus = 'returned';

    if (type === 'return' && !statusReturnNote.trim()) {
      toast.error('Catatan perbaikan wajib diisi saat mengembalikan anggaran.');
      return;
    }

    try {
      const res = await changeBudgetStatus(budget.id, targetStatus, {
        returnNote: type === 'return' ? statusReturnNote : undefined,
        rapatDate: type === 'approve' ? rapatDate : undefined,
        rapatBeritaAcaraNo: type === 'approve' ? rapatBeritaAcaraNo : undefined,
        rapatDocUrl: type === 'approve' && rapatDocName ? rapatDocName : undefined,
      });
      if (!res.success) {
        toast.error(res.error || 'Gagal mengubah status anggaran.');
        return;
      }
      toast.success('Status anggaran berhasil diperbarui.');
      setShowStatusModal(null);
      setStatusReturnNote('');
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah status anggaran.');
    }
  };

  // Handle APBG-P Revision
  const handleCreateRevision = () => {
    if (!currentBudget) return;
    if (currentBudget.status !== 'approved') {
      toast.error('Hanya anggaran yang sudah Disahkan yang dapat dibuat revisi APBG-P.');
      return;
    }
    setConfirmModal({ type: 'revision' });
  };

  // Handle Reallocation
  const handleExecuteReallocation = async () => {
    if (!currentBudget) return;
    if (!reallocFromId || !reallocToId) {
      toast.error('Pilih pos anggaran asal dan pos anggaran tujuan.');
      return;
    }
    if (reallocFromId === reallocToId) {
      toast.error('Pos asal dan tujuan tidak boleh sama.');
      return;
    }
    if (reallocAmount <= 0) {
      toast.error('Nominal pergeseran harus lebih besar dari 0.');
      return;
    }
    if (!reallocReason.trim()) {
      toast.error('Alasan pergeseran pos wajib dicatat.');
      return;
    }

    try {
      const res = await reallocateBudget({
        budgetId: currentBudget.id,
        fromItemId: reallocFromId,
        toItemId: reallocToId,
        amount: reallocAmount,
        reason: reallocReason,
      });
      if (!res.success) {
        toast.error(res.error || 'Gagal melakukan pergeseran anggaran.');
        return;
      }
      toast.success('Pergeseran pos anggaran berhasil disimpan.');
      setShowReallocationModal(false);
      setReallocFromId('');
      setReallocToId('');
      setReallocAmount(0);
      setReallocReason('');
    } catch (err: any) {
      toast.error(err.message || 'Gagal melakukan pergeseran anggaran.');
    }
  };

  // Realisasi vs Anggaran Data
  const realizationRows: BudgetRealizationRow[] = useMemo(() => {
    if (realisasiKasId === 'all') {
      const res = getConsolidatedBudgetRealization(selectedTahun, realisasiMonth);
      return res.rows;
    } else {
      return getBudgetRealization(realisasiKasId, selectedTahun, realisasiMonth);
    }
  }, [realisasiKasId, selectedTahun, realisasiMonth, getConsolidatedBudgetRealization, getBudgetRealization]);

  const realisasiIncomeRows = useMemo(
    () => realizationRows.filter((r) => r.type === 'income'),
    [realizationRows]
  );
  const realisasiExpenseRows = useMemo(
    () => realizationRows.filter((r) => r.type === 'expense'),
    [realizationRows]
  );

  const realisasiTotalIncomeBudget = useMemo(
    () => realisasiIncomeRows.reduce((sum, r) => sum + r.budget_annual, 0),
    [realisasiIncomeRows]
  );
  const realisasiTotalIncomeActual = useMemo(
    () => realisasiIncomeRows.reduce((sum, r) => sum + r.actual_ytd, 0),
    [realisasiIncomeRows]
  );
  const realisasiTotalExpenseBudget = useMemo(
    () => realisasiExpenseRows.reduce((sum, r) => sum + r.budget_annual, 0),
    [realisasiExpenseRows]
  );
  const realisasiTotalExpenseActual = useMemo(
    () => realisasiExpenseRows.reduce((sum, r) => sum + r.actual_ytd, 0),
    [realisasiExpenseRows]
  );

  // Month Names in Indonesian
  const monthNames = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];

  // Reallocation History for selected Kas & Year
  const relevantReallocations = useMemo(() => {
    return budgetReallocations
      .filter((r) => r.kas_id === selectedKasId && r.tahun === selectedTahun)
      .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
  }, [budgetReallocations, selectedKasId, selectedTahun]);

  // Export Realization to Excel
  const handleExportRealisasiExcel = () => {
    const exportData = realizationRows.map((r, i) => ({
      No: i + 1,
      Jenis: r.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      Kategori: r.category_name,
      Kode: r.category_code || '-',
      'Anggaran Setahun': r.budget_annual,
      'Target s.d. Bulan Ini': r.budget_ytd,
      'Realisasi s.d. Bulan Ini': r.actual_ytd,
      'Deviasi (Selisih)': r.variance,
      '% Capaian': `${r.percentage.toFixed(1)}%`,
    }));
    const title =
      realisasiKasId === 'all'
        ? `Realisasi_APBG_Konsolidasi_${selectedTahun}_Bulan_${realisasiMonth}`
        : `Realisasi_APBG_${selectedKas?.kode || 'Kas'}_${selectedTahun}_Bulan_${realisasiMonth}`;
    exportToExcel(exportData, title, 'Realisasi Anggaran');
  };

  // Export Realization to PDF
  const handleExportRealisasiPDF = () => {
    const isConsolidated = realisasiKasId === 'all';
    const kasNama = isConsolidated
      ? 'Konsolidasian Seluruh Kas Huria & Seksi'
      : selectedKas?.nama || 'Kas Seksi';

    generateAnggaranRealisasiPDF({
      title: 'Laporan Realisasi Anggaran Pendapatan & Belanja Gereja (APBG)',
      kasNama,
      tahun: selectedTahun,
      versionText: `s.d. Bulan ${monthNames[realisasiMonth - 1]} ${selectedTahun}`,
      rows: realizationRows,
      totalIncomeBudget: realisasiTotalIncomeBudget,
      totalIncomeActual: realisasiTotalIncomeActual,
      totalExpenseBudget: realisasiTotalExpenseBudget,
      totalExpenseActual: realisasiTotalExpenseActual,
      settings,
      isConsolidated,
      namaBendahara: currentUser?.full_name,
      namaKetua: settings.pendeta_name,
      rapatDate: currentBudget?.rapat_date,
      rapatNo: currentBudget?.rapat_berita_acara_no,
    });
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto min-w-0 overflow-hidden">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Anggaran Tahunan (APBG)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Penyusunan anggaran kas, pergeseran pos, dan realisasi
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 overflow-x-auto scrollbar-none gap-1 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('apbg')}
            className={`flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-lg text-xs transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'apbg'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <FileText className="w-4 h-4 text-blue-600" />
            Penyusunan APBG
          </button>
          <button
            onClick={() => setActiveTab('pergeseran')}
            className={`flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-lg text-xs transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'pergeseran'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
            Pergeseran Pos
          </button>
          <button
            onClick={() => setActiveTab('realisasi')}
            className={`flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-lg text-xs transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'realisasi'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            Realisasi vs Anggaran
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PENYUSUNAN ANGGARAN (APBG)                                         */}
      {/* ========================================================================= */}
      {activeTab === 'apbg' && (
        <div className="space-y-6">
          {/* Controls Bar: Kas, Tahun, Versi Picker */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:flex lg:flex-wrap items-center gap-3 w-full lg:w-auto">
              {/* Kas Selector */}
              <div className="w-full sm:w-auto">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Kas / Seksi</label>
                <select
                  value={selectedKasId}
                  onChange={(e) => {
                    setSelectedKasId(e.target.value);
                    setSelectedVersion(1);
                  }}
                  className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                >
                  {viewableKas.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama} ({k.kode})
                    </option>
                  ))}
                </select>
              </div>

              {/* Tahun Selector */}
              <div className="w-full sm:w-auto">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Tahun Anggaran</label>
                <select
                  value={selectedTahun}
                  onChange={(e) => {
                    setSelectedTahun(Number(e.target.value));
                    setSelectedVersion(1);
                  }}
                  className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                >
                  {fiscalYears && fiscalYears.length > 0 ? (
                    fiscalYears.map((fy) => (
                      <option key={fy.id} value={fy.year}>
                        {fy.year} {fy.year === activeYear ? '(Aktif)' : ''}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value={2025}>2025</option>
                      <option value={2026}>2026</option>
                      <option value={2027}>2027</option>
                    </>
                  )}
                </select>
              </div>

              {/* Versi Selector (If multiple versions exist) */}
              {availableBudgetsForKasAndYear.length > 0 && (
                <div className="w-full sm:w-auto">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Versi Anggaran</label>
                  <select
                    value={selectedVersion}
                    onChange={(e) => setSelectedVersion(Number(e.target.value))}
                    className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  >
                    {availableBudgetsForKasAndYear.map((b) => (
                      <option key={b.id} value={b.version}>
                        Versi {b.version} {b.version === 1 ? '(Awal)' : '(Perubahan APBG-P)'}{' '}
                        {b.is_current_active ? '★ Berlaku' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Quick Action: New Revision APBG-P or Copy */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              {currentBudget && currentBudget.status === 'approved' && isKasBendahara && (
                <button
                  onClick={handleCreateRevision}
                  className="w-full sm:w-auto min-h-[44px] sm:min-h-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 transition-colors"
                  title="Buat versi baru (APBG-P) yang akan dibahas di Rapat Huria"
                >
                  <Copy className="w-4 h-4" />
                  Buat Perubahan (APBG-P)
                </button>
              )}

              {currentBudget && currentBudget.status === 'draft' && isKasBendahara && (
                <button
                  onClick={() => setShowCopyModal(true)}
                  className="w-full sm:w-auto min-h-[44px] sm:min-h-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-gray-500" />
                  Salin Tahun Lalu
                </button>
              )}
            </div>
          </div>

          {/* Budget Header Card & Workflow Banner */}
          {currentBudget ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: selectedKas?.warna || '#2563EB' }}
                    />
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">{currentBudget.title}</h2>
                    {getStatusBadge(currentBudget.status)}
                    {currentBudget.is_current_active && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        Versi Resmi Berlaku
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Kas {selectedKas?.nama} · Tahun {currentBudget.tahun} · Versi {currentBudget.version} ·
                    Disusun: {currentBudget.created_at ? formatDateIndo(currentBudget.created_at) : '-'}
                  </p>
                </div>

                {/* Workflow Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  {/* Draft State: Bendahara submits to Ketua */}
                  {currentBudget.status === 'draft' && (
                    <>
                      {isKasBendahara && (
                        <button
                          onClick={() => setShowStatusModal({ type: 'review', budget: currentBudget })}
                          className="w-full sm:w-auto min-h-[44px] sm:min-h-0 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs"
                        >
                          <Send className="w-4 h-4" />
                          Ajukan ke Ketua Kas
                        </button>
                      )}
                    </>
                  )}

                  {/* Reviewed State: Ketua forwards or returns */}
                  {currentBudget.status === 'reviewed' && (
                    <>
                      {isKasKetua && (
                        <>
                          <button
                            onClick={() => setShowStatusModal({ type: 'return', budget: currentBudget })}
                            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 min-h-[44px] sm:min-h-0 rounded-xl text-sm font-semibold border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Kembalikan (Perbaikan)
                          </button>
                          <button
                            onClick={() =>
                              setShowStatusModal({ type: 'submit_rapat', budget: currentBudget })
                            }
                            disabled={isBudgetCreator && currentUser?.role !== 'admin'}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] sm:min-h-0 rounded-xl text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors shadow-xs disabled:opacity-50"
                            title={
                              isBudgetCreator && currentUser?.role !== 'admin'
                                ? 'Penyusun draf tidak boleh meneruskan anggarannya sendiri'
                                : 'Teruskan ke Rapat Huria'
                            }
                          >
                            <Send className="w-4 h-4" />
                            Teruskan ke Rapat Huria
                          </button>
                        </>
                      )}
                    </>
                  )}

                  {/* Submitted to Rapat Huria: Sekretaris/Pendeta ratifies or returns */}
                  {currentBudget.status === 'submitted_rapat' && (
                    <>
                      {isSekretarisOrPendeta && (
                        <>
                          <button
                            onClick={() => setShowStatusModal({ type: 'return', budget: currentBudget })}
                            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 min-h-[44px] sm:min-h-0 rounded-xl text-sm font-semibold border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Kembalikan ke Seksi
                          </button>
                          <button
                            onClick={() => setShowStatusModal({ type: 'approve', budget: currentBudget })}
                            disabled={isBudgetCreator && currentUser?.role !== 'admin'}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] sm:min-h-0 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                            title="Catat hasil pengesahan Rapat Huria"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Sahkan di Rapat Huria
                          </button>
                        </>
                      )}
                    </>
                  )}

                  {/* Returned state: Bendahara can re-submit after fixing */}
                  {currentBudget.status === 'returned' && isKasBendahara && (
                    <button
                      onClick={() => setShowStatusModal({ type: 'review', budget: currentBudget })}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] sm:min-h-0 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs"
                    >
                      <Send className="w-4 h-4" />
                      Ajukan Ulang ke Ketua
                    </button>
                  )}
                </div>
              </div>

              {/* Return Note Alert (if returned) */}
              {currentBudget.status === 'returned' && currentBudget.return_note && (
                <div className="p-4 bg-rose-50 border-b border-rose-100 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wide">
                      Catatan Pengembalian / Perbaikan:
                    </h4>
                    <p className="text-sm text-rose-800 mt-0.5">{currentBudget.return_note}</p>
                  </div>
                </div>
              )}

              {/* Ratification Info Banner (if approved) */}
              {currentBudget.status === 'approved' && currentBudget.rapat_berita_acara_no && (
                <div className="p-4 bg-emerald-50/70 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-900">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-emerald-700" />
                    <span>
                      Disahkan pada Rapat Huria:{' '}
                      <strong>
                        {currentBudget.rapat_date ? formatDateIndo(currentBudget.rapat_date) : '-'}
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      No. Berita Acara: <strong>{currentBudget.rapat_berita_acara_no}</strong>
                    </span>
                  </div>
                  {currentBudget.rapat_document_url && (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                      <FileText className="w-3.5 h-3.5" />
                      Lampiran: {currentBudget.rapat_document_url}
                    </span>
                  )}
                </div>
              )}

              {/* 4 Summary Cards */}
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 bg-slate-50/50 border-b border-slate-100">
                {/* Saldo Awal */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/90">
                  <div className="flex items-center justify-between mb-1 text-xs">
                    <span className="font-semibold text-slate-500">Saldo Awal Tahun</span>
                    <span className={`font-semibold ${isOpeningBalanceLocked ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {isOpeningBalanceLocked ? 'Terkunci' : 'Taksiran'}
                    </span>
                  </div>
                  <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                    {formatRupiah(openingBalanceForKas)}
                  </div>
                </div>

                {/* Total Rencana Penerimaan */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/90">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-500">Rencana Pemasukan</span>
                    <TrendingUp className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div className="text-lg font-bold font-mono text-emerald-700 tabular-nums">
                    {formatRupiah(totalIncomeBudget)}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{incomeItems.length} pos anggaran</p>
                </div>

                {/* Total Rencana Pengeluaran */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/90">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-500">Rencana Pengeluaran</span>
                    <TrendingDown className="w-4 h-4 text-rose-700" />
                  </div>
                  <div className="text-lg font-bold font-mono text-rose-700 tabular-nums">
                    {formatRupiah(totalExpenseBudget)}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{expenseItems.length} pos belanja</p>
                </div>

                {/* Surplus / Defisit Rencana */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/90">
                  <div className="flex items-center justify-between mb-1 text-xs">
                    <span className="font-semibold text-slate-500">Surplus / (Defisit)</span>
                    <span className={`font-semibold ${netSurplusDeficit >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                      {netSurplusDeficit >= 0 ? 'Surplus' : 'Defisit'}
                    </span>
                  </div>
                  <div
                    className={`text-lg font-bold font-mono tabular-nums ${
                      netSurplusDeficit >= 0 ? 'text-slate-900' : 'text-rose-700'
                    }`}
                  >
                    {formatRupiah(netSurplusDeficit)}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 font-medium">Penerimaan dikurangi pengeluaran</p>
                </div>
              </div>

              {/* Deficit Alert if Expense > Available Liquidity */}
              {hasLiquidityDeficit && (
                <div className="m-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-rose-900 space-y-1">
                    <strong className="block text-sm text-rose-800">
                      Peringatan Defisit Anggaran!
                    </strong>
                    <p>
                      Total rencana belanja (<strong>{formatRupiah(totalExpenseBudget)}</strong>) melebihi
                      jumlah penerimaan ditambah saldo awal (<strong>{formatRupiah(availableLiquidity)}</strong>
                      ). Terdapat defisit likuiditas sebesar{' '}
                      <strong>{formatRupiah(liquidityDeficitAmount)}</strong> yang membutuhkan penyesuaian pos
                      atau sumber pendanaan tambahan sebelum diajukan ke Rapat Huria.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Empty State: No Budget Draft Yet */
            <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
                <Calculator className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-lg font-bold text-gray-900">
                  Belum Ada Anggaran untuk {selectedKas?.nama} ({selectedTahun})
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Mulai susun draf APBG tahunan untuk seksi ini. Anda dapat menyusun draf baru dari nol atau
                  menyalin data dari tahun anggaran sebelumnya.
                </p>
              </div>
              {isKasBendahara && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2">
                  <button
                    onClick={handleCreateInitialBudget}
                    className="min-h-[44px] sm:min-h-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    Buat Draf APBG Baru
                  </button>
                  <button
                    onClick={() => {
                      handleCreateInitialBudget();
                      setShowCopyModal(true);
                    }}
                    className="min-h-[44px] sm:min-h-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Copy className="w-4 h-4 text-gray-500" />
                    Salin dari Tahun Lalu
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Budget Lines Table */}
          {currentBudget && (
            <div className="space-y-6">
              {/* Pemasukan Section */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">Rencana Pos Penerimaan</h3>
                      <p className="text-xs text-gray-500">
                        Total Penerimaan: <strong>{formatRupiah(totalIncomeBudget)}</strong> ({incomeItems.length}{' '}
                        pos)
                      </p>
                    </div>
                  </div>

                  {currentBudget.status === 'draft' && isKasBendahara && (
                    <button
                      onClick={() => handleOpenAddItem('income')}
                      className="w-full sm:w-auto min-h-[44px] sm:min-h-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Pos Penerimaan
                    </button>
                  )}
                </div>

                {/* Mobile Cards: Pemasukan */}
                <div className="md:hidden divide-y divide-gray-100">
                  {incomeItems.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-400">
                      Belum ada pos penerimaan. Klik &quot;Tambah Pos Penerimaan&quot; di atas.
                    </div>
                  ) : (
                    incomeItems.map((item) => (
                      <div key={item.id} className="p-4 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-semibold text-sm text-gray-900 block">
                              {item.category?.nama || 'Penerimaan'}
                              {item.category?.kode && (
                                <span className="ml-1.5 text-xs font-normal text-gray-400">({item.category.kode})</span>
                              )}
                            </span>
                            {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                          </div>
                          <span className="font-bold font-mono text-sm text-emerald-700 tabular-nums shrink-0">
                            {formatRupiah(item.annual_amount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <button
                            onClick={() => setShowMonthlyBreakdown(item)}
                            className="min-h-[40px] px-3 py-1.5 rounded-lg bg-blue-50 text-xs text-blue-700 font-semibold inline-flex items-center gap-1.5"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            Lihat Sebaran
                          </button>
                          {currentBudget.status === 'draft' && isKasBendahara && (
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => handleOpenEditItem(item)}
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100"
                                aria-label="Edit Pos"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  setConfirmModal({
                                    type: 'delete_item',
                                    itemId: item.id,
                                    itemLabel: item.category?.nama || 'Pos Penerimaan',
                                  })
                                }
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-rose-500 hover:bg-rose-50"
                                aria-label="Hapus Pos"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50/75 text-gray-600 text-xs font-semibold uppercase tracking-wider border-b border-gray-100">
                      <tr>
                        <th className="py-3 px-4">Kategori Pos</th>
                        <th className="py-3 px-4">Uraian / Rincian</th>
                        <th className="py-3 px-4 text-right">Rencana Setahun</th>
                        <th className="py-3 px-4 text-center">Sebaran Bulanan</th>
                        <th className="py-3 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {incomeItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-xs text-gray-400">
                            Belum ada pos penerimaan. Klik &quot;Tambah Pos Penerimaan&quot; di atas.
                          </td>
                        </tr>
                      ) : (
                        incomeItems.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-3 px-4 font-semibold text-gray-900">
                              {item.category?.nama || 'Penerimaan'}
                              {item.category?.kode && (
                                <span className="ml-2 text-xs font-normal text-gray-400">
                                  ({item.category.kode})
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-xs text-gray-600">
                              {item.description || '-'}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-700 tabular-nums">
                              {formatRupiah(item.annual_amount)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => setShowMonthlyBreakdown(item)}
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                Lihat Sebaran
                              </button>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {currentBudget.status === 'draft' && isKasBendahara ? (
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    onClick={() => handleOpenEditItem(item)}
                                    className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                                    title="Edit Pos"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      setConfirmModal({
                                        type: 'delete_item',
                                        itemId: item.id,
                                        itemLabel: item.category?.nama || 'Pos Penerimaan',
                                      })
                                    }
                                    className="p-1 rounded-md text-gray-400 hover:text-rose-600 hover:bg-rose-50"
                                    title="Hapus Pos"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pengeluaran Section */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                      <TrendingDown className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">Rencana Pos Pengeluaran / Belanja</h3>
                      <p className="text-xs text-gray-500">
                        Total Pengeluaran: <strong>{formatRupiah(totalExpenseBudget)}</strong> (
                        {expenseItems.length} pos)
                      </p>
                    </div>
                  </div>

                  {currentBudget.status === 'draft' && isKasBendahara && (
                    <button
                      onClick={() => handleOpenAddItem('expense')}
                      className="w-full sm:w-auto min-h-[44px] sm:min-h-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Pos Pengeluaran
                    </button>
                  )}
                </div>

                {/* Mobile Cards: Pengeluaran */}
                <div className="md:hidden divide-y divide-gray-100">
                  {expenseItems.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-400">
                      Belum ada pos pengeluaran. Klik &quot;Tambah Pos Pengeluaran&quot; di atas.
                    </div>
                  ) : (
                    expenseItems.map((item) => (
                      <div key={item.id} className="p-4 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-semibold text-sm text-gray-900 block">
                              {item.category?.nama || 'Pengeluaran'}
                              {item.category?.kode && (
                                <span className="ml-1.5 text-xs font-normal text-gray-400">({item.category.kode})</span>
                              )}
                            </span>
                            {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                          </div>
                          <span className="font-bold font-mono text-sm text-rose-700 tabular-nums shrink-0">
                            {formatRupiah(item.annual_amount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <button
                            onClick={() => setShowMonthlyBreakdown(item)}
                            className="min-h-[40px] px-3 py-1.5 rounded-lg bg-blue-50 text-xs text-blue-700 font-semibold inline-flex items-center gap-1.5"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            Lihat Sebaran
                          </button>
                          {currentBudget.status === 'draft' && isKasBendahara && (
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => handleOpenEditItem(item)}
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100"
                                aria-label="Edit Pos"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  setConfirmModal({
                                    type: 'delete_item',
                                    itemId: item.id,
                                    itemLabel: item.category?.nama || 'Pos Pengeluaran',
                                  })
                                }
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-rose-500 hover:bg-rose-50"
                                aria-label="Hapus Pos"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50/75 text-gray-600 text-xs font-semibold uppercase tracking-wider border-b border-gray-100">
                      <tr>
                        <th className="py-3 px-4">Kategori Pos</th>
                        <th className="py-3 px-4">Uraian / Rincian</th>
                        <th className="py-3 px-4 text-right">Rencana Setahun</th>
                        <th className="py-3 px-4 text-center">Sebaran Bulanan</th>
                        <th className="py-3 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {expenseItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-xs text-gray-400">
                            Belum ada pos pengeluaran. Klik &quot;Tambah Pos Pengeluaran&quot; di atas.
                          </td>
                        </tr>
                      ) : (
                        expenseItems.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-3 px-4 font-semibold text-gray-900">
                              {item.category?.nama || 'Pengeluaran'}
                              {item.category?.kode && (
                                <span className="ml-2 text-xs font-normal text-gray-400">
                                  ({item.category.kode})
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-xs text-gray-600">
                              {item.description || '-'}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-rose-700 tabular-nums">
                              {formatRupiah(item.annual_amount)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => setShowMonthlyBreakdown(item)}
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                Lihat Sebaran
                              </button>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {currentBudget.status === 'draft' && isKasBendahara ? (
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    onClick={() => handleOpenEditItem(item)}
                                    className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                                    title="Edit Pos"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      setConfirmModal({
                                        type: 'delete_item',
                                        itemId: item.id,
                                        itemLabel: item.category?.nama || 'Pos Pengeluaran',
                                      })
                                    }
                                    className="p-1 rounded-md text-gray-400 hover:text-rose-600 hover:bg-rose-50"
                                    title="Hapus Pos"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PERGESERAN ANGGARAN (REALLOCATION)                                  */}
      {/* ========================================================================= */}
      {activeTab === 'pergeseran' && (
        <div className="space-y-6">
          {/* Explanation Banner */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-5 flex items-start gap-4">
            <ArrowRightLeft className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900">
                Aturan Pergeseran Anggaran Antar Pos
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Pergeseran pos anggaran hanya diperbolehkan antar pos dalam <strong>KAS YANG SAMA</strong>{' '}
                dengan <strong>TOTAL ANGGARAN TETAP</strong> (zero-sum). Toleransi maksimal pergeseran diatur
                pada Sistem sebesar{' '}
                <strong>{settings.budget_reallocation_max_pct || 15}%</strong> dari nominal pos asal.
                Jika perubahan pos melebihi batas ini atau mengubah total kas, huria wajib mengajukan{' '}
                <strong>Perubahan Anggaran (APBG-P)</strong> melalui Rapat Huria.
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex items-center gap-3 w-full sm:w-auto">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Kas Terpilih</label>
                <select
                  value={selectedKasId}
                  onChange={(e) => setSelectedKasId(e.target.value)}
                  className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                >
                  {viewableKas.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Tahun Anggaran</label>
                <select
                  value={selectedTahun}
                  onChange={(e) => setSelectedTahun(Number(e.target.value))}
                  className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                >
                  {fiscalYears && fiscalYears.length > 0 ? (
                    fiscalYears.map((fy) => (
                      <option key={fy.id} value={fy.year}>
                        {fy.year} {fy.year === activeYear ? '(Aktif)' : ''}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value={2025}>2025</option>
                      <option value={2026}>2026</option>
                      <option value={2027}>2027</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {isKasBendahara && (
              <div className="w-full sm:w-auto">
                <button
                  onClick={() => {
                    if (!currentBudget || currentBudget.status !== 'approved') {
                      toast.error('Pergeseran pos hanya dapat dilakukan pada anggaran yang telah Disahkan.');
                      return;
                    }
                    setShowReallocationModal(true);
                  }}
                  disabled={!currentBudget || currentBudget.status !== 'approved'}
                  className="w-full sm:w-auto min-h-[44px] sm:min-h-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs disabled:opacity-50"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  Ajukan Pergeseran Pos
                </button>
              </div>
            )}
          </div>

          {/* Reallocation Log Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Riwayat Pergeseran Pos Anggaran ({relevantReallocations.length})
              </h3>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {relevantReallocations.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  Belum ada riwayat pergeseran anggaran pada kas ini.
                </div>
              ) : (
                relevantReallocations.map((realloc) => {
                  const fromItem = budgetItems.find((i) => i.id === realloc.from_item_id);
                  const toItem = budgetItems.find((i) => i.id === realloc.to_item_id);
                  return (
                    <div key={realloc.id} className="p-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-500">
                          {realloc.created_at ? formatDateIndo(realloc.created_at) : '-'}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Disetujui
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-semibold text-rose-700 block truncate">
                            Dari: {fromItem?.category?.nama || 'Pos Asal'}
                          </span>
                          <span className="font-semibold text-emerald-700 block truncate">
                            Ke: {toItem?.category?.nama || 'Pos Tujuan'}
                          </span>
                        </div>
                        <span className="font-bold font-mono text-sm text-gray-900 tabular-nums shrink-0">
                          {formatRupiah(realloc.amount)}
                        </span>
                      </div>
                      {realloc.reason && <p className="text-gray-600">{realloc.reason}</p>}
                    </div>
                  );
                })
              )}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/75 text-gray-600 text-xs font-semibold uppercase tracking-wider border-b border-gray-100">
                  <tr>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Dari Pos (Sumber)</th>
                    <th className="py-3 px-4">Ke Pos (Tujuan)</th>
                    <th className="py-3 px-4 text-right">Nominal Digeser</th>
                    <th className="py-3 px-4">Alasan Pergeseran</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {relevantReallocations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-gray-400">
                        Belum ada riwayat pergeseran anggaran pada kas ini.
                      </td>
                    </tr>
                  ) : (
                    relevantReallocations.map((realloc) => {
                      const fromItem = budgetItems.find((i) => i.id === realloc.from_item_id);
                      const toItem = budgetItems.find((i) => i.id === realloc.to_item_id);
                      return (
                        <tr key={realloc.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
                            {realloc.created_at ? formatDateIndo(realloc.created_at) : '-'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-rose-700">
                              {fromItem?.category?.nama || 'Pos Asal'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-emerald-700">
                              {toItem?.category?.nama || 'Pos Tujuan'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-gray-900 tabular-nums">
                            {formatRupiah(realloc.amount)}
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-600 max-w-xs">{realloc.reason}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Disetujui
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: REALISASI VS ANGGARAN                                              */}
      {/* ========================================================================= */}
      {activeTab === 'realisasi' && (
        <div className="space-y-6">
          {/* Realisasi Controls Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:flex lg:flex-wrap items-center gap-3 w-full lg:w-auto">
              {/* Kas Filter */}
              <div className="w-full sm:w-auto">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Cakupan Kas</label>
                <select
                  value={realisasiKasId}
                  onChange={(e) => setRealisasiKasId(e.target.value)}
                  className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                >
                  {!isSeksiUser && <option value="all">Semua Kas (Konsolidasian Huria & Seksi)</option>}
                  {viewableKas.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bulan s.d. */}
              <div className="w-full sm:w-auto">
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Periode Realisasi s.d.
                </label>
                <select
                  value={realisasiMonth}
                  onChange={(e) => setRealisasiMonth(Number(e.target.value))}
                  className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                >
                  {monthNames.map((name, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      Bulan {idx + 1} - {name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tahun */}
              <div className="w-full sm:w-auto">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Tahun Anggaran</label>
                <select
                  value={selectedTahun}
                  onChange={(e) => setSelectedTahun(Number(e.target.value))}
                  className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                >
                  {fiscalYears && fiscalYears.length > 0 ? (
                    fiscalYears.map((fy) => (
                      <option key={fy.id} value={fy.year}>
                        {fy.year} {fy.year === activeYear ? '(Aktif)' : ''}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value={2025}>2025</option>
                      <option value={2026}>2026</option>
                      <option value={2027}>2027</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <button
                onClick={handleExportRealisasiExcel}
                className="flex-1 sm:flex-none min-h-[44px] sm:min-h-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-emerald-200 text-emerald-800 bg-emerald-50/50 hover:bg-emerald-100 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Ekspor Excel
              </button>
              <button
                onClick={handleExportRealisasiPDF}
                className="flex-1 sm:flex-none min-h-[44px] sm:min-h-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs"
              >
                <Download className="w-4 h-4" />
                Cetak PDF Resmi
              </button>
            </div>
          </div>

          {/* Realisasi KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm">
              <span className="text-xs font-medium text-gray-500">Target Penerimaan Setahun</span>
              <div className="text-lg font-bold text-gray-900 mt-1 tabular-nums">
                {formatRupiah(realisasiTotalIncomeBudget)}
              </div>
              <div className="mt-2 text-xs text-emerald-700 flex items-center justify-between">
                <span>Realisasi s.d. Bln {realisasiMonth}:</span>
                <strong className="tabular-nums">{formatRupiah(realisasiTotalIncomeActual)}</strong>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm">
              <span className="text-xs font-medium text-gray-500">Plafon Belanja Setahun</span>
              <div className="text-lg font-bold text-gray-900 mt-1 tabular-nums">
                {formatRupiah(realisasiTotalExpenseBudget)}
              </div>
              <div className="mt-2 text-xs text-rose-700 flex items-center justify-between">
                <span>Realisasi s.d. Bln {realisasiMonth}:</span>
                <strong className="tabular-nums">{formatRupiah(realisasiTotalExpenseActual)}</strong>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm">
              <span className="text-xs font-medium text-gray-500">% Capaian Penerimaan</span>
              <div className="text-lg font-bold text-emerald-700 mt-1 tabular-nums">
                {realisasiTotalIncomeBudget > 0
                  ? ((realisasiTotalIncomeActual / realisasiTotalIncomeBudget) * 100).toFixed(1)
                  : 0}
                %
              </div>
              <p className="text-[11px] text-gray-400 mt-2">Terhadap target setahun penuh</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm">
              <span className="text-xs font-medium text-gray-500">% Serapan Belanja</span>
              <div className="text-lg font-bold text-rose-700 mt-1 tabular-nums">
                {realisasiTotalExpenseBudget > 0
                  ? ((realisasiTotalExpenseActual / realisasiTotalExpenseBudget) * 100).toFixed(1)
                  : 0}
                %
              </div>
              <p className="text-[11px] text-gray-400 mt-2">Terhadap plafon belanja setahun</p>
            </div>
          </div>

          {/* Realisasi Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Daftar Realisasi vs Anggaran ({realizationRows.length} Kategori)
                </h3>
                <p className="text-xs text-gray-500">
                  Realisasi dihitung dari transaksi sah berstatus disetujui (Approved), mutasi transfer
                  dikecualikan.
                </p>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {realizationRows.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  Belum ada data anggaran atau transaksi disetujui untuk kriteria ini.
                </div>
              ) : (
                realizationRows.map((row) => {
                  const isIncome = row.type === 'income';
                  const pct = Math.min(row.percentage, 100);
                  const isOverBudget = !isIncome && row.actual_ytd > row.budget_annual && row.budget_annual > 0;
                  return (
                    <div key={row.category_id} className="p-4 space-y-2.5 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mb-1 ${
                              isIncome ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isIncome ? 'Penerimaan' : 'Belanja'}
                          </span>
                          <div className="font-semibold text-sm text-gray-900">
                            {row.category_name}
                            {row.category_code && (
                              <span className="ml-1 text-xs font-normal text-gray-400">({row.category_code})</span>
                            )}
                          </div>
                        </div>
                        <span
                          className={`font-bold text-sm tabular-nums shrink-0 ${
                            isOverBudget ? 'text-rose-600' : 'text-gray-800'
                          }`}
                        >
                          {row.percentage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isOverBudget ? 'bg-rose-600' : isIncome ? 'bg-emerald-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-[10px] text-gray-400 block">Anggaran Setahun</span>
                          <span className="font-mono font-semibold text-gray-800 tabular-nums">
                            {formatRupiah(row.budget_annual)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 block">Realisasi Aktual</span>
                          <span
                            className={`font-mono font-bold tabular-nums ${
                              isIncome ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {formatRupiah(row.actual_ytd)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/75 text-gray-600 text-xs font-semibold uppercase tracking-wider border-b border-gray-100">
                  <tr>
                    <th className="py-3 px-4">Jenis</th>
                    <th className="py-3 px-4">Kategori Pos</th>
                    <th className="py-3 px-4 text-right">Rencana Setahun</th>
                    <th className="py-3 px-4 text-right">Target s.d. Bln {realisasiMonth}</th>
                    <th className="py-3 px-4 text-right">Realisasi Aktual</th>
                    <th className="py-3 px-4 text-right">Selisih (Deviasi)</th>
                    <th className="py-3 px-4 text-center">Progres & %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {realizationRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-gray-400">
                        Belum ada data anggaran atau transaksi disetujui untuk kriteria ini.
                      </td>
                    </tr>
                  ) : (
                    realizationRows.map((row) => {
                      const isIncome = row.type === 'income';
                      const pct = Math.min(row.percentage, 100);
                      const isOverBudget = !isIncome && row.actual_ytd > row.budget_annual && row.budget_annual > 0;

                      return (
                        <tr key={row.category_id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                isIncome ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isIncome ? 'Penerimaan' : 'Belanja'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-gray-900">
                            {row.category_name}
                            {row.category_code && (
                              <span className="ml-1.5 text-xs font-normal text-gray-400">
                                ({row.category_code})
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-gray-700 tabular-nums">
                            {formatRupiah(row.budget_annual)}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-500 tabular-nums">
                            {formatRupiah(row.budget_ytd)}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-bold tabular-nums ${
                              isIncome ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {formatRupiah(row.actual_ytd)}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-medium tabular-nums ${
                              row.variance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {formatRupiah(row.variance)}
                          </td>
                          <td className="py-3 px-4 min-w-36">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    isOverBudget
                                      ? 'bg-rose-600'
                                      : isIncome
                                      ? 'bg-emerald-500'
                                      : 'bg-blue-600'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span
                                className={`text-xs font-bold tabular-nums shrink-0 ${
                                  isOverBudget ? 'text-rose-600' : 'text-gray-700'
                                }`}
                              >
                                {row.percentage.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH / EDIT POS ANGGARAN                                         */}
      {/* ========================================================================= */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 shadow-xl border border-gray-100 space-y-4 max-h-[92dvh] overflow-y-auto mobile-sheet-enter">
            <div className="sm:hidden w-12 h-1.5 bg-gray-200 rounded-full mx-auto -mt-0.5 mb-1" />
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">
                {editingItem ? 'Edit Pos Anggaran' : 'Tambah Pos Anggaran'} (
                {itemType === 'income' ? 'Penerimaan' : 'Pengeluaran'})
              </h3>
              <button
                onClick={() => setShowItemModal(false)}
                className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center p-1.5 rounded-lg text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Kategori */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Kategori Master *
                </label>
                <select
                  value={itemCategoryId}
                  onChange={(e) => setItemCategoryId(e.target.value)}
                  className="w-full px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                >
                  {categories
                    .filter((c) => c.tipe === itemType && c.is_active)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nama} {cat.kode ? `(${cat.kode})` : ''}
                      </option>
                    ))}
                </select>
              </div>

              {/* Uraian Rincian */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Uraian / Rincian Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Misal: Perayaan Paskah Sekolah Minggu, Honor Pelayan"
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  className="w-full px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>

              {/* Nominal Setahun */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Nominal Rencana Setahun (Rp) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={itemAnnualAmount || ''}
                  onChange={(e) => handleAnnualAmountChange(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 rounded-xl border border-slate-200 text-sm font-semibold tabular-nums focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
                {itemAnnualAmount > 0 && (
                  <p className="text-xs text-gray-500 mt-1 font-medium">
                    Terbilang: {formatRupiah(itemAnnualAmount)}
                  </p>
                )}
              </div>

              {/* Sebaran Bulanan Option */}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-700">Sebaran 12 Bulan</label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoDistribute}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAutoDistribute(checked);
                        if (checked) {
                          setItemMonthly(generateMonthlyDistribution(itemAnnualAmount));
                        }
                      }}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                    <span>Bagi rata 12 bulan otomatis</span>
                  </label>
                </div>

                {/* 12-Month Grid Inputs */}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-xs">
                  {monthNames.map((m, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-gray-50 border border-gray-200">
                      <span className="block text-[10px] text-gray-500 font-medium">
                        Bln {idx + 1} ({m.slice(0, 3)})
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={itemMonthly[idx] || 0}
                        disabled={autoDistribute}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const newArr = [...itemMonthly];
                          newArr[idx] = val;
                          setItemMonthly(newArr);
                        }}
                        className="w-full mt-1 bg-transparent border-none p-0 text-xs font-semibold tabular-nums focus:ring-0 text-gray-800 disabled:opacity-75"
                      />
                    </div>
                  ))}
                </div>

                {/* Check total months */}
                <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-gray-100">
                  <span className="text-gray-500">Total Sebaran Bulanan:</span>
                  <span
                    className={`font-bold tabular-nums ${
                      Math.abs(itemMonthly.reduce((a, b) => a + b, 0) - itemAnnualAmount) <= 1
                        ? 'text-emerald-700'
                        : 'text-rose-600'
                    }`}
                  >
                    {formatRupiah(itemMonthly.reduce((a, b) => a + b, 0))}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowItemModal(false)}
                className="px-4 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleSaveItem}
                className="px-5 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-xs"
              >
                Simpan Pos Anggaran
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SEBARAN BULANAN PREVIEW                                            */}
      {/* ========================================================================= */}
      {showMonthlyBreakdown && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 shadow-xl border border-gray-100 space-y-4 max-h-[92dvh] overflow-y-auto mobile-sheet-enter">
            <div className="sm:hidden w-12 h-1.5 bg-gray-200 rounded-full mx-auto -mt-0.5 mb-1" />
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">Sebaran Bulanan</h3>
                <p className="text-xs text-gray-500">{showMonthlyBreakdown.category?.nama}</p>
              </div>
              <button
                onClick={() => setShowMonthlyBreakdown(null)}
                className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center p-1.5 rounded-lg text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              {monthNames.map((m, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="block text-[11px] text-gray-500 font-medium">
                    Bulan {idx + 1} ({m})
                  </span>
                  <span className="block text-sm font-bold text-gray-900 mt-0.5 tabular-nums">
                    {formatRupiah(showMonthlyBreakdown.monthly_distribution[idx] || 0)}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Total Setahun:</span>
              <span className="font-bold text-blue-700 text-sm tabular-nums">
                {formatRupiah(showMonthlyBreakdown.annual_amount)}
              </span>
            </div>

            <button
              onClick={() => setShowMonthlyBreakdown(null)}
              className="w-full py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: WORKFLOW STATUS (REVIEW / FORWARD / APPROVE / RETURN)               */}
      {/* ========================================================================= */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 shadow-xl border border-gray-100 space-y-4 max-h-[92dvh] overflow-y-auto mobile-sheet-enter">
            <div className="sm:hidden w-12 h-1.5 bg-gray-200 rounded-full mx-auto -mt-0.5 mb-1" />
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">
                {showStatusModal.type === 'review' && 'Ajukan Draf ke Ketua Kas'}
                {showStatusModal.type === 'submit_rapat' && 'Teruskan ke Rapat Huria'}
                {showStatusModal.type === 'approve' && 'Pengesahan di Rapat Huria'}
                {showStatusModal.type === 'return' && 'Kembalikan Draf Anggaran'}
              </h3>
              <button
                onClick={() => setShowStatusModal(null)}
                className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center p-1.5 rounded-lg text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content per Type */}
            {showStatusModal.type === 'review' && (
              <p className="text-sm text-gray-600">
                Draf APBG ini akan diajukan kepada Ketua Kas (atau Pendeta Ressort untuk Kas Umum) untuk
                ditinjau dan diperiksa sebelum diteruskan ke Rapat Huria. Lanjutkan?
              </p>
            )}

            {showStatusModal.type === 'submit_rapat' && (
              <p className="text-sm text-gray-600">
                Sebagai Ketua Kas, Anda menyatakan draf ini telah ditinjau dan siap dibahas serta disahkan
                pada Rapat Huria Ressort. Lanjutkan?
              </p>
            )}

            {showStatusModal.type === 'return' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Tuliskan alasan pengembalian dan bagian pos anggaran yang perlu diperbaiki oleh bendahara
                  seksi:
                </p>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Catatan Perbaikan *
                  </label>
                  <textarea
                    rows={4}
                    value={statusReturnNote}
                    onChange={(e) => setStatusReturnNote(e.target.value)}
                    placeholder="Contoh: Pos honor pelayan perlu disesuaikan dengan pedoman distrik; Rencana pengeluaran masih defisit."
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>
            )}

            {showStatusModal.type === 'approve' && (
              <div className="space-y-4 text-sm">
                <p className="text-gray-600">
                  Sekretaris Huria atau Pendeta Ressort mencatat pengesahan APBG hasil keputusan Rapat
                  Huria. Setelah disahkan, anggaran ini akan <strong>TERKUNCI</strong> dan menjadi versi
                  resmi yang berlaku.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Tanggal Sidang Rapat Huria *
                    </label>
                    <input
                      type="date"
                      value={rapatDate}
                      onChange={(e) => setRapatDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Nomor Berita Acara / Referensi Surat *
                    </label>
                    <input
                      type="text"
                      value={rapatBeritaAcaraNo}
                      onChange={(e) => setRapatBeritaAcaraNo(e.target.value)}
                      placeholder="BA-RH/HKBP-HTR/I/2026"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Unggah Notulen / Berita Acara (PDF/Gambar)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Contoh: Berita_Acara_Rapat_Huria_2026.pdf"
                        value={rapatDocName}
                        onChange={(e) => setRapatDocName(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm"
                      />
                      <label className="px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 flex items-center gap-1.5">
                        <FileUp className="w-3.5 h-3.5" />
                        Pilih
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setRapatDocName(e.target.files[0].name);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowStatusModal(null)}
                className="px-4 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmStatusChange}
                className={`px-5 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 rounded-xl text-xs font-semibold text-white shadow-sm transition-colors ${
                  showStatusModal.type === 'return'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : showStatusModal.type === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: AJUKAN PERGESERAN ANGGARAN                                         */}
      {/* ========================================================================= */}
      {showReallocationModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 shadow-xl border border-gray-100 space-y-4 max-h-[92dvh] overflow-y-auto mobile-sheet-enter">
            <div className="sm:hidden w-12 h-1.5 bg-gray-200 rounded-full mx-auto -mt-0.5 mb-1" />
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">Ajukan Pergeseran Pos Anggaran</h3>
              <button
                onClick={() => setShowReallocationModal(false)}
                className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center p-1.5 rounded-lg text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {/* Pos Asal */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Pos Asal (Dikurangi) *
                </label>
                <select
                  value={reallocFromId}
                  onChange={(e) => setReallocFromId(e.target.value)}
                  className="w-full px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                >
                  <option value="">-- Pilih Pos Asal --</option>
                  {currentItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      [{item.type === 'income' ? 'Penerimaan' : 'Belanja'}] {item.category?.nama} (Sisa:{' '}
                      {formatRupiah(item.annual_amount)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Pos Tujuan */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Pos Tujuan (Ditambahkan) *
                </label>
                <select
                  value={reallocToId}
                  onChange={(e) => setReallocToId(e.target.value)}
                  className="w-full px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                >
                  <option value="">-- Pilih Pos Tujuan --</option>
                  {currentItems
                    .filter((i) => i.id !== reallocFromId)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        [{item.type === 'income' ? 'Penerimaan' : 'Belanja'}] {item.category?.nama} (Saat ini:{' '}
                        {formatRupiah(item.annual_amount)})
                      </option>
                    ))}
                </select>
              </div>

              {/* Nominal */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Nominal yang Digeser (Rp) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="50000"
                  value={reallocAmount || ''}
                  onChange={(e) => setReallocAmount(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 rounded-xl border border-slate-200 text-sm font-semibold tabular-nums focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
                {reallocFromId && (
                  <p className="text-xs text-gray-500 mt-1">
                    Batas toleransi maksimal (
                    {settings.budget_reallocation_max_pct || 15}%):{' '}
                    <strong>
                      {formatRupiah(
                        ((currentItems.find((i) => i.id === reallocFromId)?.annual_amount || 0) *
                          (settings.budget_reallocation_max_pct || 15)) /
                          100
                      )}
                    </strong>
                  </p>
                )}
              </div>

              {/* Alasan */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Alasan Pergeseran *
                </label>
                <textarea
                  rows={3}
                  value={reallocReason}
                  onChange={(e) => setReallocReason(e.target.value)}
                  placeholder="Contoh: Kebutuhan konsumsi jemaat meningkat mendesak dialihkan dari pos ATK"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowReallocationModal(false)}
                className="px-4 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleExecuteReallocation}
                className="px-5 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-xs"
              >
                Simpan Pergeseran
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SALIN DARI TAHUN LALU                                              */}
      {/* ========================================================================= */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 shadow-xl border border-gray-100 space-y-4 max-h-[92dvh] overflow-y-auto mobile-sheet-enter">
            <div className="sm:hidden w-12 h-1.5 bg-gray-200 rounded-full mx-auto -mt-0.5 mb-1" />
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Salin Data dari Tahun Lalu</h3>
              <button
                onClick={() => setShowCopyModal(false)}
                className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center p-1.5 rounded-lg text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600">
              Fitur ini akan menyalin seluruh pos anggaran atau realisasi dari tahun{' '}
              <strong>{selectedTahun - 1}</strong> ke dalam draf anggaran tahun{' '}
              <strong>{selectedTahun}</strong>.
            </p>

            <div className="space-y-3 pt-2">
              <button
                onClick={async () => {
                  if (!currentBudget) return;
                  try {
                    const res = await copyBudgetFromPreviousYear(selectedKasId, selectedTahun);
                    if (!res.success) {
                      toast.error(res.error || 'Gagal menyalin anggaran.');
                      return;
                    }
                    setShowCopyModal(false);
                    toast.success(`Pos anggaran dari tahun ${selectedTahun - 1} (${res.count || 0} pos) berhasil disalin ke draf.`);
                  } catch (err: any) {
                    toast.error(err.message || 'Gagal menyalin anggaran.');
                  }
                }}
                className="w-full p-3.5 sm:p-3 min-h-[44px] sm:min-h-0 rounded-xl border border-gray-200 text-left hover:bg-gray-50 transition-colors flex items-center justify-between gap-2"
              >
                <div>
                  <strong className="block text-sm text-gray-900">
                    Salin dari Anggaran Disahkan {selectedTahun - 1}
                  </strong>
                  <span className="text-xs text-gray-500">
                    Menyalin seluruh pos kegiatan dan nominal rencana dari APBG tahun sebelumnya
                  </span>
                </div>
                <Copy className="w-4 h-4 text-gray-400 shrink-0" />
              </button>
            </div>

            <button
              onClick={() => setShowCopyModal(false)}
              className="w-full py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 mt-2"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      <ConfirmActionModal
        isOpen={Boolean(confirmModal)}
        onClose={() => setConfirmModal(null)}
        title={
          confirmModal?.type === 'revision'
            ? `Buat Revisi APBG-P (${selectedTahun})`
            : 'Hapus Pos Anggaran?'
        }
        message={
          confirmModal?.type === 'revision'
            ? `Membuat APBG Perubahan (APBG-P) untuk ${selectedKas?.nama || 'Kas'} Tahun ${selectedTahun} akan menyalin semua pos dari versi yang sudah disahkan ke versi draf baru.`
            : `Pos anggaran "${confirmModal?.type === 'delete_item' ? confirmModal.itemLabel : ''}" akan dihapus dari draf APBG ini.`
        }
        variant={confirmModal?.type === 'delete_item' ? 'danger' : 'primary'}
        confirmLabel={confirmModal?.type === 'revision' ? 'Ya, Buat Revisi' : 'Ya, Hapus Pos'}
        onConfirm={async () => {
          if (!confirmModal) return;
          if (confirmModal.type === 'revision' && currentBudget) {
            const res = await createBudgetRevision(currentBudget.id);
            if (!res.success) {
              toast.error(res.error || 'Gagal membuat revisi APBG-P.');
              return;
            }
            setSelectedVersion(currentBudget.version + 1);
            toast.success(`Revisi APBG-P Versi ${currentBudget.version + 1} berhasil dibuat.`);
          } else if (confirmModal.type === 'delete_item') {
            deleteBudgetItem(confirmModal.itemId);
            toast.success('Pos anggaran dihapus.');
          }
          setConfirmModal(null);
        }}
      />
    </div>
  );
}
