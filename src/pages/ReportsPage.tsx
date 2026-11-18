/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Layers,
  Scale,
  CheckCircle,
  AlertCircle,
  FileCheck,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Lock,
  Copy,
  Printer,
  Send,
  Award,
  Clock,
  ShieldCheck,
  Eye,
  AlertTriangle,
  FileText,
  BookmarkCheck,
  Landmark,
  Wallet,
  Unlock,
  X,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatRupiah, formatDateIndo, getIndoMonthName, MONTH_NAMES_INDO } from '../lib/formatters';
import {
  exportToExcel,
  exportMultiSheetExcel,
  generateBukuKasPDF,
  generateLaporanGabunganPDF,
  generateWartaJemaatPDF,
  generateLpjTahunanPDF,
  generateWartaKeuanganMingguanPDF,
  KasWeeklyReportData,
} from '../lib/exportUtils';
import { SemesterReport, LpjReport } from '../types/database';
import {
  evaluateBpskRemittanceCompliance,
  PPKU_BPSK_DEADLINE_DAYS,
  PPKU_DOCUMENT_URL,
  PPKU_SK_NUMBER,
} from '../lib/ppkuRules';

export const ReportsPage: React.FC = () => {
  const {
    kasList,
    storageAccounts,
    categories,
    transactions,
    openingBalances,
    settings,
    reconciliations,
    saveReconciliation,
    getKasBalances,
    getStorageBalances,
    getSentralisasiSummary,
    userKasAccessList,
    profiles,
    // Semester & LPJ Data
    semesterReports,
    lpjReports,
    lpjExceptions,
    evaluateSemesterChecklist,
    lockSemesterSnapshot,
    unlockSemesterSnapshot,
    forwardSemesterToPastor,
    acknowledgeSemesterReport,
    announceSemesterReport,
    returnSemesterReport,
    evaluateLpjChecklist,
    lockLpjSnapshot,
    unlockLpjSnapshot,
    submitLpjToMeeting,
    approveLpjReport,
    returnLpjReport,
    grantLpjException,
    isYearLockedByLpj,
    getPosisiKeuangan,
    getPerubahanSaldoDana,
    getArusKasLangsung,
    getBudgetRealization,
    getConsolidatedBudgetRealization,
    fixedAssets,
    advances,
    receivablesPayables,
    lpjNotes,
    fiscalYears,
  } = useData();

  const {
    currentUser,
    isLeader,
    userKasAccess,
    isAdmin,
    isAuditor,
    canViewWarta,
    canViewConsolidatedLpj,
    canViewBpsk,
  } = useAuth();
  const isPastor = currentUser?.role === 'pendeta_ressort';
  const isSecretary = currentUser?.role === 'sekretaris';
  const isSeksiOnly = !isLeader && !isAuditor && !isAdmin && currentUser?.role === 'pengurus_kas';

  const [searchParams] = useSearchParams();

  // Main Tabs
  const defaultAllowedTab = canViewWarta ? 'warta' : canViewConsolidatedLpj ? 'semester' : 'buku_kas';
  const [activeTab, setActiveTab] = useState<'warta' | 'semester' | 'lpj' | 'pelaporan' | 'buku_kas' | 'gabungan' | 'rekonsiliasi' | 'bpsk'>(defaultAllowedTab);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'bpsk' && canViewBpsk) {
      setActiveTab('bpsk');
    } else if (tabParam === 'warta' && canViewWarta) {
      setActiveTab('warta');
    } else if (tabParam === 'semester' && canViewConsolidatedLpj) {
      setActiveTab('semester');
    } else if (tabParam === 'lpj' && canViewConsolidatedLpj) {
      setActiveTab('lpj');
    } else {
      setActiveTab(defaultAllowedTab);
    }
  }, [searchParams, canViewBpsk, canViewWarta, canViewConsolidatedLpj, defaultAllowedTab]);

  // Sub-navigation for LPJ 12 sections
  const [activeLpjSection, setActiveLpjSection] = useState<number>(3); // Default to Posisi Keuangan (Neraca)

  // Selection states
  const [selectedYear, setSelectedYear] = useState<number>(settings.active_year || 2026);
  const [selectedSemester, setSelectedSemester] = useState<1 | 2>(1);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedKasId, setSelectedKasId] = useState<string>(kasList[0]?.id || '');

  // Reconciliation form states
  const [recStorageId, setRecStorageId] = useState<string>(storageAccounts[0]?.id || '');
  const [recDate, setRecDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [recPhysicalAmount, setRecPhysicalAmount] = useState<string>('');
  const [recNotes, setRecNotes] = useState<string>('');
  const [recSuccess, setRecSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (storageAccounts.length > 0 && !storageAccounts.some((s) => s.id === recStorageId)) {
      setRecStorageId(storageAccounts[0].id);
    }
  }, [storageAccounts, recStorageId]);

  // Workflow Dialog / Action States
  const [forwardRef, setForwardRef] = useState<string>('');
  const [pastorNotesInput, setPastorNotesInput] = useState<string>('');
  const [meetingDateInput, setMeetingDateInput] = useState<string>('2027-01-24');
  const [meetingRefInput, setMeetingRefInput] = useState<string>('BA-RAPAT-HURIA/2027/01');
  const [meetingAttendeesInput, setMeetingAttendeesInput] = useState<number>(85);
  const [meetingNotesInput, setMeetingNotesInput] = useState<string>('Disahkan secara mufakat oleh seluruh perwakilan seksi dan majelis huria.');
  const [copiedWarta, setCopiedWarta] = useState<boolean>(false);

  const globalToast = useToast();

  // Toast feedback (visible globally via ToastContext AND inline banner if scrolled to top)
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    globalToast.showToast(text, type);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Snapshot lock/dispensation UI states
  const [isLockingSemester, setIsLockingSemester] = useState(false);
  const [semesterLockError, setSemesterLockError] = useState<string | null>(null);
  const [isLockingLpj, setIsLockingLpj] = useState(false);
  const [lpjLockError, setLpjLockError] = useState<string | null>(null);
  const [activeDispensationKey, setActiveDispensationKey] = useState<string | null>(null);
  const [dispensationReason, setDispensationReason] = useState<string>('');
  const [isSavingDispensation, setIsSavingDispensation] = useState<boolean>(false);
  const [showApproveLpjModal, setShowApproveLpjModal] = useState<boolean>(false);

  // Find Current Semester Report (exact match for year & semester; no cross-period fallback)
  const currentSemesterReport = useMemo(
    () => semesterReports.find((r) => r.tahun === selectedYear && r.semester === selectedSemester),
    [semesterReports, selectedYear, selectedSemester]
  );
  const effectiveSemesterReportId = currentSemesterReport?.id || `sem-rep-${selectedYear}-${selectedSemester}`;

  // Find Current LPJ Report (exact match for year)
  const currentLpjReport = useMemo(
    () => lpjReports.find((l) => l.tahun === selectedYear),
    [lpjReports, selectedYear]
  );
  const effectiveLpjReportId = currentLpjReport?.id || `lpj-rep-${selectedYear}`;

  // Clear inline errors when switching period
  useEffect(() => {
    setSemesterLockError(null);
    setLpjLockError(null);
    setActiveDispensationKey(null);
    setDispensationReason('');
  }, [selectedYear, selectedSemester, activeTab]);

  // Live Checklist Evaluations (always computed from live transactions/closings/reconciliations + exceptions)
  const liveSemesterChecklist = useMemo(
    () => evaluateSemesterChecklist(selectedYear, selectedSemester),
    [evaluateSemesterChecklist, selectedYear, selectedSemester]
  );
  const liveLpjChecklist = useMemo(
    () => evaluateLpjChecklist(selectedYear),
    [evaluateLpjChecklist, selectedYear]
  );

  // Available kas based on role
  const viewableKas = isSeksiOnly
    ? kasList.filter((k) => userKasAccess.some((a) => a.kas_id === k.id))
    : kasList;

  useEffect(() => {
    if (viewableKas.length > 0 && !viewableKas.some((k) => k.id === selectedKasId)) {
      setSelectedKasId(viewableKas[0].id);
    }
  }, [viewableKas, selectedKasId]);

  const currentKas = viewableKas.find((k) => k.id === selectedKasId) || viewableKas[0] || kasList[0];

  // Calculated Financial Statements (ISAK 35)
  const posisiKeuanganData = useMemo(() => getPosisiKeuangan(selectedYear), [getPosisiKeuangan, selectedYear]);
  const perubahanSaldoDanaData = useMemo(() => getPerubahanSaldoDana(selectedYear), [getPerubahanSaldoDana, selectedYear]);
  const arusKasData = useMemo(() => getArusKasLangsung(selectedYear), [getArusKasLangsung, selectedYear]);
  const budgetConsolidated = useMemo(
    () => getConsolidatedBudgetRealization(selectedYear, selectedSemester === 1 ? 6 : 12),
    [getConsolidatedBudgetRealization, selectedYear, selectedSemester]
  );

  // Live or Locked Snapshot Summary for Semester Tab
  const semesterSummary = useMemo(() => {
    if (
      currentSemesterReport &&
      currentSemesterReport.status !== 'preparation' &&
      currentSemesterReport.snapshot_data?.semesterSummary
    ) {
      return currentSemesterReport.snapshot_data.semesterSummary as {
        totalPenerimaan: number;
        totalPengeluaran: number;
        surplus: number;
        totalTransferMasuk: number;
        totalTransferKeluar: number;
        totalKas: number;
      };
    }

    const startMonth = selectedSemester === 1 ? 1 : 7;
    const endMonth = selectedSemester === 1 ? 6 : 12;
    let totalPenerimaan = 0;
    let totalPengeluaran = 0;
    let totalTransferMasuk = 0;
    let totalTransferKeluar = 0;

    transactions
      .filter((tx) => {
        if (tx.status !== 'approved') return false;
        const d = new Date(tx.tanggal);
        const m = d.getMonth() + 1;
        return d.getFullYear() === selectedYear && m >= startMonth && m <= endMonth;
      })
      .forEach((tx) => {
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'income') totalPenerimaan += amt;
        else if (tx.type === 'expense') totalPengeluaran += amt;
        else if (tx.type === 'transfer_in') totalTransferMasuk += amt;
        else if (tx.type === 'transfer_out') totalTransferKeluar += amt;
      });

    return {
      totalPenerimaan,
      totalPengeluaran,
      surplus: totalPenerimaan - totalPengeluaran,
      totalTransferMasuk,
      totalTransferKeluar,
      totalKas: posisiKeuanganData.total_kas_dan_bank,
    };
  }, [currentSemesterReport, transactions, selectedYear, selectedSemester, posisiKeuanganData.total_kas_dan_bank]);

  // Live or Locked Snapshot Summary for Annual LPJ Section 4
  const lpjAnnualSummary = useMemo(() => {
    if (
      currentLpjReport &&
      currentLpjReport.status !== 'preparation' &&
      currentLpjReport.snapshot_data?.annualSummary
    ) {
      const snap = currentLpjReport.snapshot_data.annualSummary as {
        penerimaanMurni: number;
        pengeluaranMurni: number;
        transferMasuk: number;
        transferKeluar: number;
      };
      return {
        ...snap,
        selisihMutasi: snap.transferMasuk - snap.transferKeluar,
      };
    }

    let penerimaanMurni = 0;
    let pengeluaranMurni = 0;
    let transferMasuk = 0;
    let transferKeluar = 0;

    transactions
      .filter((tx) => tx.status === 'approved' && new Date(tx.tanggal).getFullYear() === selectedYear)
      .forEach((tx) => {
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'income') penerimaanMurni += amt;
        else if (tx.type === 'expense') pengeluaranMurni += amt;
        else if (tx.type === 'transfer_in') transferMasuk += amt;
        else if (tx.type === 'transfer_out') transferKeluar += amt;
      });

    return {
      penerimaanMurni,
      pengeluaranMurni,
      transferMasuk,
      transferKeluar,
      selisihMutasi: transferMasuk - transferKeluar,
    };
  }, [currentLpjReport, transactions, selectedYear]);

  // Initial balance for single kas
  const initialBalance = openingBalances
    .filter((ob) => ob.kas_id === selectedKasId && ob.tahun === selectedYear)
    .reduce((sum, item) => sum + Number(item.amount), 0);

  // Kas Transactions for single kas
  const kasTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        if (tx.kas_id !== selectedKasId || tx.status !== 'approved') return false;
        const d = new Date(tx.tanggal);
        return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
      })
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [transactions, selectedKasId, selectedYear, selectedMonth]);

  // Combined Summaries for All Kas
  const combinedSummaries = useMemo(() => {
    return kasList.map((k) => {
      const init = openingBalances
        .filter((ob) => ob.kas_id === k.id && ob.tahun === selectedYear)
        .reduce((sum, ob) => sum + Number(ob.amount), 0);

      let masuk = 0;
      let keluar = 0;
      let tfIn = 0;
      let tfOut = 0;

      transactions
        .filter((tx) => {
          if (tx.kas_id !== k.id || tx.status !== 'approved') return false;
          const d = new Date(tx.tanggal);
          return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
        })
        .forEach((tx) => {
          const amt = Number(tx.amount);
          if (tx.type === 'income') masuk += amt;
          if (tx.type === 'expense') keluar += amt;
          if (tx.type === 'transfer_in') tfIn += amt;
          if (tx.type === 'transfer_out') tfOut += amt;
        });

      return {
        nama: k.nama,
        kode: k.kode,
        saldoAwal: init,
        pemasukan: masuk,
        pengeluaran: keluar,
        transferMasuk: tfIn,
        transferKeluar: tfOut,
        saldoAkhir: init + masuk - keluar + tfIn - tfOut,
      };
    });
  }, [kasList, openingBalances, transactions, selectedYear, selectedMonth]);

  // Reconciliation calculations
  const targetStorageAccount = storageAccounts.find((s) => s.id === recStorageId) || storageAccounts[0];
  const storageBalances = getStorageBalances();
  const currentSystemBalance =
    storageBalances.find((s) => s.storage_account_id === targetStorageAccount?.id)?.saldo_saat_ini || 0;
  const rawPhysical = parseFloat(recPhysicalAmount.replace(/[^0-9]/g, '')) || 0;
  const currentDiscrepancy = rawPhysical - currentSystemBalance;

  // Single Kas Signatories
  const bendaharaAccess = userKasAccessList.find(
    (a) => a.kas_id === selectedKasId && a.access_level === 'bendahara'
  );
  const ketuaAccess = userKasAccessList.find(
    (a) => a.kas_id === selectedKasId && a.access_level === 'ketua'
  );
  const namaBendahara = profiles.find((p) => p.id === bendaharaAccess?.user_id)?.full_name || 'Bendahara Seksi';
  const namaKetua = profiles.find((p) => p.id === ketuaAccess?.user_id)?.full_name || settings.pendeta_name;

  // Copy Warta Jemaat Text Handler
  const handleCopyWartaText = () => {
    const textToCopy =
      currentSemesterReport?.announcement_text ||
      `Warta Keuangan Semester ${selectedSemester} Tahun ${selectedYear} ${settings.church_name || 'HKBP Ressort Hutaraja'}: Total Penerimaan ${formatRupiah(semesterSummary.totalPenerimaan)}, Total Pengeluaran ${formatRupiah(semesterSummary.totalPengeluaran)}, Surplus/Defisit ${formatRupiah(semesterSummary.surplus)}, Saldo Kas & Bank Akhir Periode ${formatRupiah(semesterSummary.totalKas)}.`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedWarta(true);
    setTimeout(() => setCopiedWarta(false), 3000);
    showToast('Teks Warta Jemaat berhasil disalin ke papan klip.');
  };

  // =========================================================================
  // WARTA KEUANGAN MINGGUAN (MINGGU s.d. SABTU -> DIWARTAKAN HARI MINGGU)
  // =========================================================================
  const formatLocalYMD = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const parseLocalYMD = (ymd: string): Date => {
    const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
    return new Date(y, (m || 1) - 1, d || 1);
  };

  const getSundayOfDateStr = (ymd: string): string => {
    const dt = parseLocalYMD(ymd);
    const dayOfWeek = dt.getDay(); // 0 = Minggu ... 6 = Sabtu
    dt.setDate(dt.getDate() - dayOfWeek);
    return formatLocalYMD(dt);
  };

  const addDaysYMD = (ymd: string, days: number): string => {
    const dt = parseLocalYMD(ymd);
    dt.setDate(dt.getDate() + days);
    return formatLocalYMD(dt);
  };

  const [wartaRefDate, setWartaRefDate] = useState<string>(() => formatLocalYMD(new Date()));
  const [wartaKasFilter, setWartaKasFilter] = useState<string>('all');
  const [copiedWartaWeekly, setCopiedWartaWeekly] = useState<boolean>(false);

  const wartaRange = useMemo(() => {
    const weekStartStr = getSundayOfDateStr(wartaRefDate); // Minggu
    const weekEndStr = addDaysYMD(weekStartStr, 6); // Sabtu
    const announcementSundayStr = addDaysYMD(weekStartStr, 7); // Minggu Pewartaan
    return { weekStartStr, weekEndStr, announcementSundayStr };
  }, [wartaRefDate]);

  const weeklyWartaData = useMemo(() => {
    const { weekStartStr, weekEndStr } = wartaRange;
    const weekYear = parseInt(weekStartStr.slice(0, 4), 10);
    const yearStartStr = `${weekYear}-01-01`;

    const activeKas = (isSeksiOnly ? viewableKas : kasList).filter((k) => k.is_active !== false);

    const reports: KasWeeklyReportData[] = activeKas.map((k) => {
      const openingYearAmount = openingBalances
        .filter((ob) => ob.kas_id === k.id && ob.tahun === weekYear)
        .reduce((sum, ob) => sum + Number(ob.amount || 0), 0);

      // Approved transactions from Jan 1 up to day before weekStartStr
      let priorNet = 0;
      const penerimaanList: typeof transactions = [];
      const pengeluaranList: typeof transactions = [];
      const transfersIn: typeof transactions = [];
      const transfersOut: typeof transactions = [];

      transactions
        .filter((tx) => tx.kas_id === k.id && tx.status === 'approved')
        .forEach((tx) => {
          const amt = Number(tx.amount || 0);
          if (tx.tanggal >= yearStartStr && tx.tanggal < weekStartStr) {
            if (tx.type === 'income' || tx.type === 'transfer_in') priorNet += amt;
            if (tx.type === 'expense' || tx.type === 'transfer_out') priorNet -= amt;
          } else if (tx.tanggal >= weekStartStr && tx.tanggal <= weekEndStr) {
            if (tx.type === 'income') penerimaanList.push(tx);
            else if (tx.type === 'expense') pengeluaranList.push(tx);
            else if (tx.type === 'transfer_in') transfersIn.push(tx);
            else if (tx.type === 'transfer_out') transfersOut.push(tx);
          }
        });

      penerimaanList.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
      pengeluaranList.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
      transfersIn.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
      transfersOut.sort((a, b) => a.tanggal.localeCompare(b.tanggal));

      const totalPenerimaan = penerimaanList.reduce((s, t) => s + Number(t.amount || 0), 0);
      const totalPengeluaran = pengeluaranList.reduce((s, t) => s + Number(t.amount || 0), 0);
      const totalTransferIn = transfersIn.reduce((s, t) => s + Number(t.amount || 0), 0);
      const totalTransferOut = transfersOut.reduce((s, t) => s + Number(t.amount || 0), 0);
      const saldoAwalMinggu = openingYearAmount + priorNet;
      const saldoAkhirMinggu =
        saldoAwalMinggu + totalPenerimaan + totalTransferIn - totalPengeluaran - totalTransferOut;

      return {
        kas: k,
        saldoAwalMinggu,
        penerimaanList,
        pengeluaranList,
        transfersIn,
        transfersOut,
        totalPenerimaan,
        totalPengeluaran,
        totalTransferIn,
        totalTransferOut,
        saldoAkhirMinggu,
      };
    });

    const totals = reports.reduce(
      (acc, r) => ({
        saldoAwal: acc.saldoAwal + r.saldoAwalMinggu,
        penerimaan: acc.penerimaan + r.totalPenerimaan,
        pengeluaran: acc.pengeluaran + r.totalPengeluaran,
        transferIn: acc.transferIn + r.totalTransferIn,
        transferOut: acc.transferOut + r.totalTransferOut,
        saldoAkhir: acc.saldoAkhir + r.saldoAkhirMinggu,
      }),
      { saldoAwal: 0, penerimaan: 0, pengeluaran: 0, transferIn: 0, transferOut: 0, saldoAkhir: 0 }
    );

    const pendingInWeek = transactions.filter(
      (tx) =>
        activeKas.some((k) => k.id === tx.kas_id) &&
        (tx.status === 'draft' || tx.status === 'submitted') &&
        tx.tanggal >= weekStartStr &&
        tx.tanggal <= weekEndStr
    );

    return { reports, totals, pendingInWeek };
  }, [kasList, viewableKas, isSeksiOnly, openingBalances, transactions, wartaRange]);

  const handleCopyWeeklyWartaText = () => {
    const { weekStartStr, weekEndStr, announcementSundayStr } = wartaRange;
    const lines: string[] = [
      `WARTA KEUANGAN MINGGUAN — ${settings.church_name.toUpperCase()}`,
      `Periode Buku: Minggu, ${formatDateIndo(weekStartStr)} s.d. Sabtu, ${formatDateIndo(weekEndStr)}`,
      `Diwartakan pada Ibadah Minggu, ${formatDateIndo(announcementSundayStr)}`,
      ``,
      `I. RINGKASAN POSISI SALDO AKHIR PER KAS (PER SABTU, ${formatDateIndo(weekEndStr)}):`,
    ];

    weeklyWartaData.reports.forEach((r, idx) => {
      lines.push(
        `${idx + 1}. ${r.kas.nama}: Saldo Awal ${formatRupiah(r.saldoAwalMinggu)} | Masuk ${formatRupiah(r.totalPenerimaan + r.totalTransferIn)} | Keluar ${formatRupiah(r.totalPengeluaran + r.totalTransferOut)} | Saldo Akhir ${formatRupiah(r.saldoAkhirMinggu)}`
      );
    });

    lines.push(
      ``,
      `TOTAL SALDO AKHIR KONSOLIDASI: ${formatRupiah(weeklyWartaData.totals.saldoAkhir)}`,
      ``,
      `II. BUKU KAS (CATATAN TRANSAKSI) PER KAS:`
    );

    weeklyWartaData.reports
      .filter((r) => wartaKasFilter === 'all' || r.kas.id === wartaKasFilter)
      .forEach((r, idx) => {
        const allTx = [
          ...r.penerimaanList,
          ...r.transfersIn,
          ...r.pengeluaranList,
          ...r.transfersOut,
        ].sort((a, b) => {
          const d = a.tanggal.localeCompare(b.tanggal);
          return d !== 0 ? d : (a.created_at || a.id).localeCompare(b.created_at || b.id);
        });

        lines.push(`\n${idx + 1}. BUKU KAS: ${r.kas.nama.toUpperCase()} (${r.kas.kode})`);
        lines.push(`   Saldo Awal Minggu (${formatDateIndo(weekStartStr)}): ${formatRupiah(r.saldoAwalMinggu)}`);
        if (allTx.length === 0) {
          lines.push(`   (Tidak ada transaksi mutasi pada minggu ini)`);
        } else {
          let running = r.saldoAwalMinggu;
          allTx.forEach((tx, tIdx) => {
            const isMasuk = tx.type === 'income' || tx.type === 'transfer_in';
            const amt = Number(tx.amount || 0);
            running = isMasuk ? running + amt : running - amt;
            const kind = isMasuk ? `Masuk +${formatRupiah(amt)}` : `Keluar -${formatRupiah(amt)}`;
            lines.push(
              `   ${tIdx + 1}. ${formatDateIndo(tx.tanggal)} | ${tx.receipt_no || '-'} | ${tx.description} | ${kind} | Saldo: ${formatRupiah(running)}`
            );
          });
        }
        lines.push(
          `   Saldo Akhir Sabtu (${formatDateIndo(weekEndStr)}): ${formatRupiah(r.saldoAkhirMinggu)}`
        );
      });

    lines.push(
      ``,
      `Mengetahui / Mengesahkan (PPKU Pasal 26 ayat 1e):`,
      `- Pendeta Ressort : ${settings.pendeta_name}`,
      `- Ketua Parartaon : ${settings.ketua_parartaon_name || 'St. Harbet Simanjuntak'}`,
      `- Sekretaris Ressort : ${settings.sekretaris_name}`,
      `- Bendahara Huria : ${settings.bendahara_umum_name}`
    );

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedWartaWeekly(true);
    setTimeout(() => setCopiedWartaWeekly(false), 3000);
    showToast('Buku Kas & Warta Keuangan Mingguan berhasil disalin ke papan klip.');
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto min-w-0 overflow-hidden">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm shadow-sm transition-all ${
            toastMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            )}
            <p className="font-medium">{toastMessage.text}</p>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-[#0B132B] to-[#0F172A] text-white p-6 md:p-8 shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-900/90 border border-slate-700/80 text-slate-300 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
              <span>Laporan Keuangan & Akuntabilitas Huria</span>
            </span>
            <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
              Standar ISAK 35 (Nonlaba)
            </span>
            {isYearLockedByLpj(selectedYear) && (
              <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-purple-950/60 text-purple-200 border border-purple-800/60 flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-amber-300" />
                <span>Tahun {selectedYear} Terkunci Permanen (LPJ Disahkan)</span>
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Laporan Semester & LPJ Tahunan HKBP Hutaraja
          </h1>
          <p className="text-xs md:text-sm text-slate-300/90 max-w-2xl leading-relaxed">
            Laporan Semester I & II untuk Warta Jemaat, dan Laporan Pertanggungjawaban (LPJ) 12 Pos ISAK 35 dengan Neraca Berimbang, Arus Kas Langsung, dan penguncian permanen tahun buku.
          </p>
        </div>

        {/* Global Year Selector */}
        <div className="flex items-center gap-2.5 bg-slate-900/90 px-4 py-2.5 rounded-xl border border-slate-700/80 shadow-xs shrink-0 w-fit">
          <Calendar className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-slate-300">Tahun Buku:</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value) || 2026)}
            className="text-xs font-bold text-white bg-transparent focus:outline-hidden cursor-pointer"
          >
            {fiscalYears && fiscalYears.length > 0 ? (
              fiscalYears.map((fy) => (
                <option key={fy.id} value={fy.year} className="text-slate-900">
                  {fy.year} {fy.year === settings.active_year ? '(Tahun Berjalan)' : fy.status === 'closed' ? '(Arsip)' : '(Rencana)'}
                </option>
              ))
            ) : (
              <>
                <option value={2026} className="text-slate-900">2026 (Tahun Berjalan)</option>
                <option value={2025} className="text-slate-900">2025 (Arsip)</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Main Tabs Segmented Bar */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/90 rounded-xl border border-slate-200/90 overflow-x-auto scrollbar-none">
        {canViewWarta && (
          <button
            onClick={() => setActiveTab('warta')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'warta'
                ? 'bg-[#0B132B] text-white shadow-2xs border border-slate-800 font-bold'
                : 'text-slate-700 hover:text-slate-900 hover:bg-white/70'
            }`}
          >
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>Warta Keuangan (Minggu–Sabtu)</span>
          </button>
        )}

        {canViewConsolidatedLpj && (
          <>
            <button
              onClick={() => setActiveTab('semester')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'semester'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Laporan Semester</span>
            </button>

            <button
              onClick={() => setActiveTab('lpj')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'lpj'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>LPJ Tahunan (ISAK 35)</span>
            </button>

            <button
              onClick={() => setActiveTab('pelaporan')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'pelaporan'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookmarkCheck className="w-4 h-4" />
              <span>Pelaporan Semester</span>
            </button>
          </>
        )}

        <button
          onClick={() => setActiveTab('buku_kas')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'buku_kas'
              ? 'bg-white text-slate-900 shadow-2xs border border-slate-200 font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Buku Kas Seksi</span>
        </button>

        {canViewConsolidatedLpj && (
          <>
            <button
              onClick={() => setActiveTab('gabungan')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'gabungan'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>Konsolidasi Kas</span>
            </button>

            <button
              onClick={() => setActiveTab('rekonsiliasi')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'rekonsiliasi'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              <span>Rekonsiliasi Bank & Kas</span>
            </button>
          </>
        )}

        {canViewBpsk && (
          <button
            onClick={() => setActiveTab('bpsk')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'bpsk'
                ? 'bg-blue-900 text-white shadow-2xs border border-blue-800 font-bold'
                : 'text-blue-900 hover:bg-blue-50 font-bold'
            }`}
          >
            <Landmark className="w-4 h-4" />
            <span>Sentralisasi BPSK HKBP (55% / 45%)</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 0: WARTA KEUANGAN MINGGUAN (MINGGU s.d. SABTU)                        */}
      {/* ========================================================================= */}
      {activeTab === 'warta' && (
        <div className="space-y-6">
          {/* Week Navigation & Export Controls */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-[#0B132B] text-amber-300 uppercase tracking-wider">
                    Siklus Minggu – Sabtu
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                    Diwartakan Minggu, {formatDateIndo(wartaRange.announcementSundayStr)}
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-base mt-1.5">
                  Warta Keuangan Mingguan Jemaat (Minggu, {formatDateIndo(wartaRange.weekStartStr)} s.d. Sabtu, {formatDateIndo(wartaRange.weekEndStr)})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Berisi rincian penerimaan & pengeluaran setiap kas serta laporan saldo akhir mingguan (Minggu s.d. Sabtu sebelum diwartakan di hari Minggu).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setWartaRefDate(addDaysYMD(wartaRange.weekStartStr, -7))}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                  title="Minggu sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Minggu Lalu</span>
                </button>

                <input
                  type="date"
                  value={wartaRefDate}
                  onChange={(e) => {
                    if (e.target.value) setWartaRefDate(e.target.value);
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                />

                <button
                  type="button"
                  onClick={() => setWartaRefDate(addDaysYMD(wartaRange.weekStartStr, 7))}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                  title="Minggu berikutnya"
                >
                  <span>Minggu Depan</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setWartaRefDate(formatLocalYMD(new Date()))}
                  className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-semibold transition-colors"
                >
                  Minggu Ini
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Tampilkan Rincian Kas:</span>
                <select
                  value={wartaKasFilter}
                  onChange={(e) => setWartaKasFilter(e.target.value)}
                  className="text-xs font-semibold border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50"
                >
                  <option value="all">Semua Kas ({weeklyWartaData.reports.length} Kas)</option>
                  {weeklyWartaData.reports.map((r) => (
                    <option key={r.kas.id} value={r.kas.id}>
                      {r.kas.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyWeeklyWartaText}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedWartaWeekly ? 'Tersalin!' : 'Salin Teks Warta'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const summaryRows: Record<string, any>[] = [];
                    const ledgerRows: Record<string, any>[] = [];

                    weeklyWartaData.reports.forEach((r) => {
                      summaryRows.push({
                        Kas: r.kas.nama,
                        Kode: r.kas.kode,
                        'Saldo Awal Minggu (Rp)': r.saldoAwalMinggu,
                        'Penerimaan (Rp)': r.totalPenerimaan,
                        'Transfer Masuk (Rp)': r.totalTransferIn,
                        'Pengeluaran (Rp)': r.totalPengeluaran,
                        'Transfer Keluar (Rp)': r.totalTransferOut,
                        'Saldo Akhir Sabtu (Rp)': r.saldoAkhirMinggu,
                      });

                      const allTx = [
                        ...r.penerimaanList,
                        ...r.transfersIn,
                        ...r.pengeluaranList,
                        ...r.transfersOut,
                      ].sort((a, b) => {
                        const d = a.tanggal.localeCompare(b.tanggal);
                        return d !== 0 ? d : (a.created_at || a.id).localeCompare(b.created_at || b.id);
                      });

                      let running = r.saldoAwalMinggu;
                      ledgerRows.push({
                        Kas: r.kas.nama,
                        No: '-',
                        Tanggal: wartaRange.weekStartStr,
                        'No. Bukti': 'SALDO-AWAL',
                        'Uraian Transaksi': 'Saldo Awal Minggu',
                        'Masuk (Rp)': 0,
                        'Keluar (Rp)': 0,
                        'Saldo Berjalan (Rp)': running,
                      });

                      if (allTx.length === 0) {
                        ledgerRows.push({
                          Kas: r.kas.nama,
                          No: '-',
                          Tanggal: '-',
                          'No. Bukti': '-',
                          'Uraian Transaksi': 'Tidak ada mutasi transaksi minggu ini (Nihil)',
                          'Masuk (Rp)': 0,
                          'Keluar (Rp)': 0,
                          'Saldo Berjalan (Rp)': running,
                        });
                      } else {
                        allTx.forEach((tx, idx) => {
                          const isMasuk = tx.type === 'income' || tx.type === 'transfer_in';
                          const masuk = isMasuk ? Number(tx.amount || 0) : 0;
                          const keluar = !isMasuk ? Number(tx.amount || 0) : 0;
                          running = running + masuk - keluar;
                          ledgerRows.push({
                            Kas: r.kas.nama,
                            No: idx + 1,
                            Tanggal: tx.tanggal,
                            'No. Bukti': tx.receipt_no || '-',
                            'Uraian Transaksi': tx.description,
                            'Masuk (Rp)': masuk,
                            'Keluar (Rp)': keluar,
                            'Saldo Berjalan (Rp)': running,
                          });
                        });
                      }
                    });

                    summaryRows.push({
                      Kas: 'TOTAL KONSOLIDASI',
                      Kode: '-',
                      'Saldo Awal Minggu (Rp)': weeklyWartaData.totals.saldoAwal,
                      'Penerimaan (Rp)': weeklyWartaData.totals.penerimaan,
                      'Transfer Masuk (Rp)': weeklyWartaData.totals.transferIn,
                      'Pengeluaran (Rp)': weeklyWartaData.totals.pengeluaran,
                      'Transfer Keluar (Rp)': weeklyWartaData.totals.transferOut,
                      'Saldo Akhir Sabtu (Rp)': weeklyWartaData.totals.saldoAkhir,
                    });

                    exportMultiSheetExcel(
                      [
                        { sheetName: 'Saldo Mingguan', data: summaryRows },
                        { sheetName: 'Buku Kas Transaksi', data: ledgerRows },
                      ],
                      `Warta_Keuangan_Mingguan_${wartaRange.weekStartStr}_sd_${wartaRange.weekEndStr}`
                    );
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Ekspor Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const reportsToExport =
                      wartaKasFilter === 'all'
                        ? weeklyWartaData.reports
                        : weeklyWartaData.reports.filter((r) => r.kas.id === wartaKasFilter);
                    generateWartaKeuanganMingguanPDF({
                      weekStartStr: wartaRange.weekStartStr,
                      weekEndStr: wartaRange.weekEndStr,
                      announcementSundayStr: wartaRange.announcementSundayStr,
                      settings,
                      kasWeeklyReports: reportsToExport,
                      categories,
                      totals: weeklyWartaData.totals,
                    });
                  }}
                  className="px-4 py-2 bg-[#0B132B] hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-amber-300" />
                  <span>Unduh Warta Mingguan (PDF)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pending transaction notice */}
          {weeklyWartaData.pendingInWeek.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Catatan Pengawasan:</span> Terdapat{' '}
                <span className="font-bold">{weeklyWartaData.pendingInWeek.length} transaksi</span> pada rentang Minggu–Sabtu ini yang masih berstatus <em>Draf / Menunggu Persetujuan</em> dan belum dimasukkan ke Warta Keuangan resmi sebelum disetujui.
              </div>
            </div>
          )}

          {/* 4 Executive Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Saldo Awal Minggu
              </span>
              <p className="text-xl font-black font-mono text-slate-900 tabular-nums">
                {formatRupiah(weeklyWartaData.totals.saldoAwal)}
              </p>
              <span className="text-[11px] text-slate-400">Posisi Minggu, {formatDateIndo(wartaRange.weekStartStr)}</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-1">
              <span className="text-xs font-semibold text-emerald-700 block">
                Total Penerimaan Minggu Ini
              </span>
              <p className="text-xl font-bold font-mono text-emerald-800 tabular-nums">
                {formatRupiah(weeklyWartaData.totals.penerimaan)}
              </p>
              <span className="text-[11px] text-slate-500">
                {weeklyWartaData.totals.transferIn > 0
                  ? `+ Transfer masuk ${formatRupiah(weeklyWartaData.totals.transferIn)}`
                  : 'Akumulasi penerimaan sah seluruh kas'}
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-1">
              <span className="text-xs font-semibold text-rose-700 block">
                Total Pengeluaran Minggu Ini
              </span>
              <p className="text-xl font-bold font-mono text-rose-800 tabular-nums">
                {formatRupiah(weeklyWartaData.totals.pengeluaran)}
              </p>
              <span className="text-[11px] text-slate-500">
                {weeklyWartaData.totals.transferOut > 0
                  ? `+ Transfer keluar ${formatRupiah(weeklyWartaData.totals.transferOut)}`
                  : 'Akumulasi pengeluaran sah seluruh kas'}
              </span>
            </div>

            <div className="bg-gradient-to-br from-[#0B132B] to-[#1C2541] rounded-2xl border border-slate-800 p-5 shadow-sm text-white space-y-1">
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider block">
                Laporan Saldo Akhir (Sabtu)
              </span>
              <p className="text-xl font-black font-mono text-white tabular-nums">
                {formatRupiah(weeklyWartaData.totals.saldoAkhir)}
              </p>
              <span className="text-[11px] text-slate-300">
                Per Sabtu, {formatDateIndo(wartaRange.weekEndStr)}
              </span>
            </div>
          </div>

          {/* Section 1: Tabel Laporan Saldo Akhir Mingguan Setiap Kas */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-blue-700" />
                  <span>I. Laporan Saldo Akhir Mingguan Setiap Kas (Minggu s.d. Sabtu)</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Posisi saldo awal minggu, total mutasi minggu berjalan, dan saldo akhir per Sabtu untuk diwartakan pada Minggu, {formatDateIndo(wartaRange.announcementSundayStr)}.
                </p>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                {weeklyWartaData.reports.length} Entitas Kas
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">No</th>
                    <th className="py-2.5 px-3">Nama Kas / Bagian</th>
                    <th className="py-2.5 px-3 text-right">Saldo Awal (Minggu)</th>
                    <th className="py-2.5 px-3 text-right text-emerald-700">Penerimaan</th>
                    <th className="py-2.5 px-3 text-right text-rose-700">Pengeluaran</th>
                    <th className="py-2.5 px-3 text-right text-blue-700">Net Transfer</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-900">Saldo Akhir (Sabtu)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {weeklyWartaData.reports.map((item, idx) => {
                    const netTf = item.totalTransferIn - item.totalTransferOut;
                    return (
                      <tr key={item.kas.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.kas.warna }}
                            />
                            <span className="font-semibold text-slate-900">{item.kas.nama}</span>
                            <span className="text-[10px] font-mono text-slate-400">({item.kas.kode})</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {formatRupiah(item.saldoAwalMinggu)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700 font-medium">
                          {item.totalPenerimaan > 0 ? formatRupiah(item.totalPenerimaan) : 'Rp 0'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-rose-700 font-medium">
                          {item.totalPengeluaran > 0 ? formatRupiah(item.totalPengeluaran) : 'Rp 0'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-blue-700">
                          {netTf === 0 ? 'Rp 0' : formatRupiah(netTf)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900 bg-slate-50/50">
                          {formatRupiah(item.saldoAkhirMinggu)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100/80 border-t border-slate-200 font-bold text-slate-900">
                  <tr>
                    <td colSpan={2} className="py-3 px-3 text-right uppercase text-[11px]">
                      Total Konsolidasi Seluruh Kas
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {formatRupiah(weeklyWartaData.totals.saldoAwal)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-800">
                      {formatRupiah(weeklyWartaData.totals.penerimaan)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-rose-800">
                      {formatRupiah(weeklyWartaData.totals.pengeluaran)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-blue-800">
                      {formatRupiah(weeklyWartaData.totals.transferIn - weeklyWartaData.totals.transferOut)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-sm text-[#0B132B]">
                      {formatRupiah(weeklyWartaData.totals.saldoAkhir)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Section 2: Buku Kas (Catatan Transaksi) Setiap Kas */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-700" />
                  <span>II. Buku Kas (Catatan Transaksi) Setiap Kas (Minggu s.d. Sabtu)</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Catatan kronologis transaksi masuk &amp; keluar beserta saldo berjalan untuk masing-masing kas.
                </p>
              </div>
            </div>

            {weeklyWartaData.reports
              .filter((r) => wartaKasFilter === 'all' || r.kas.id === wartaKasFilter)
              .map((item, idx) => {
                const allTx = [
                  ...item.penerimaanList,
                  ...item.transfersIn,
                  ...item.pengeluaranList,
                  ...item.transfersOut,
                ].sort((a, b) => {
                  const dateCmp = a.tanggal.localeCompare(b.tanggal);
                  if (dateCmp !== 0) return dateCmp;
                  return (a.created_at || a.id).localeCompare(b.created_at || b.id);
                });

                const totalMasuk = item.totalPenerimaan + item.totalTransferIn;
                const totalKeluar = item.totalPengeluaran + item.totalTransferOut;
                let runningSaldo = item.saldoAwalMinggu;

                return (
                  <div
                    key={item.kas.id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden"
                    style={{ borderLeftWidth: '5px', borderLeftColor: item.kas.warna }}
                  >
                    {/* Kas Header */}
                    <div className="p-4 bg-slate-50/80 border-b border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold text-slate-400">#{idx + 1}</span>
                          <h5 className="font-bold text-sm text-slate-900">
                            Buku Kas: {item.kas.nama}
                          </h5>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600">
                            {item.kas.kode}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            {allTx.length} Transaksi
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{item.kas.deskripsi}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200">
                          <span className="text-[10px] text-slate-400 block">Saldo Awal</span>
                          <span className="font-mono font-bold text-slate-700">{formatRupiah(item.saldoAwalMinggu)}</span>
                        </div>
                        <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200">
                          <span className="text-[10px] text-emerald-700 block">Total Masuk</span>
                          <span className="font-mono font-bold text-emerald-800">{formatRupiah(totalMasuk)}</span>
                        </div>
                        <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200">
                          <span className="text-[10px] text-rose-700 block">Total Keluar</span>
                          <span className="font-mono font-bold text-rose-800">{formatRupiah(totalKeluar)}</span>
                        </div>
                        <div className="px-3 py-1.5 rounded-xl bg-[#0B132B] text-white">
                          <span className="text-[10px] text-amber-300 block">Saldo Akhir Sabtu</span>
                          <span className="font-mono font-bold">{formatRupiah(item.saldoAkhirMinggu)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Unified Chronological Buku Kas Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-700">
                        <thead className="bg-slate-800 text-slate-100 text-[11px] font-semibold">
                          <tr>
                            <th className="py-2.5 px-3 w-10 text-center">No</th>
                            <th className="py-2.5 px-3 whitespace-nowrap">Tanggal</th>
                            <th className="py-2.5 px-3 whitespace-nowrap">No. Bukti</th>
                            <th className="py-2.5 px-3">Uraian / Catatan Transaksi</th>
                            <th className="py-2.5 px-3 text-right whitespace-nowrap text-emerald-300">Masuk (Rp)</th>
                            <th className="py-2.5 px-3 text-right whitespace-nowrap text-rose-300">Keluar (Rp)</th>
                            <th className="py-2.5 px-3 text-right whitespace-nowrap text-amber-300">Saldo (Rp)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {/* Row 0: Saldo Awal Minggu */}
                          <tr className="bg-slate-50/90 text-slate-600 italic">
                            <td className="py-2 px-3 text-center font-mono">-</td>
                            <td className="py-2 px-3 font-mono whitespace-nowrap">{formatDateIndo(wartaRange.weekStartStr)}</td>
                            <td className="py-2 px-3 font-mono text-[11px]">SALDO-AWAL</td>
                            <td className="py-2 px-3 font-medium">Saldo Awal Minggu (Pindahan s.d. Sabtu lalu)</td>
                            <td className="py-2 px-3 text-right font-mono">-</td>
                            <td className="py-2 px-3 text-right font-mono">-</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                              {formatRupiah(item.saldoAwalMinggu)}
                            </td>
                          </tr>

                          {allTx.length === 0 ? (
                            <tr>
                              <td className="py-3 px-3 text-center font-mono text-slate-400">-</td>
                              <td className="py-3 px-3 font-mono text-slate-400">-</td>
                              <td className="py-3 px-3 font-mono text-slate-400">-</td>
                              <td className="py-3 px-3 text-slate-500 italic">
                                Tidak ada transaksi penerimaan maupun pengeluaran pada minggu ini (Nihil mutasi)
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-slate-400">Rp 0</td>
                              <td className="py-3 px-3 text-right font-mono text-slate-400">Rp 0</td>
                              <td className="py-3 px-3 text-right font-mono font-semibold text-slate-700 whitespace-nowrap">
                                {formatRupiah(item.saldoAwalMinggu)}
                              </td>
                            </tr>
                          ) : (
                            allTx.map((tx, tIdx) => {
                              const isMasuk = tx.type === 'income' || tx.type === 'transfer_in';
                              const masuk = isMasuk ? Number(tx.amount || 0) : 0;
                              const keluar = !isMasuk ? Number(tx.amount || 0) : 0;
                              runningSaldo = runningSaldo + masuk - keluar;
                              const cat = categories.find((c) => c.id === tx.category_id);

                              return (
                                <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                                  <td className="py-2.5 px-3 text-center font-mono text-slate-400">{tIdx + 1}</td>
                                  <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                                    {formatDateIndo(tx.tanggal)}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                    {tx.receipt_no || '-'}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-semibold text-slate-900">{tx.description}</div>
                                    <div className="text-[10px] text-slate-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                                      <span>
                                        {tx.type === 'transfer_in'
                                          ? 'Transfer Masuk'
                                          : tx.type === 'transfer_out'
                                          ? 'Transfer Keluar'
                                          : cat?.nama || (isMasuk ? 'Penerimaan' : 'Pengeluaran')}
                                      </span>
                                      {tx.type === 'income' && tx.is_sentralisasi && (
                                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                                          55% BPSK ({formatRupiah(tx.bpsk_amount || 0)}) · 45% Huria ({formatRupiah(tx.huria_amount || 0)})
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700 whitespace-nowrap">
                                    {masuk > 0 ? formatRupiah(masuk) : '-'}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-rose-700 whitespace-nowrap">
                                    {keluar > 0 ? formatRupiah(keluar) : '-'}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 bg-slate-50/50 whitespace-nowrap">
                                    {formatRupiah(runningSaldo)}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                        <tfoot className="bg-slate-100/90 border-t border-slate-200 font-bold text-slate-900">
                          <tr>
                            <td colSpan={4} className="py-2.5 px-3 text-right uppercase text-[11px]">
                              Jumlah Mutasi &amp; Saldo Akhir Sabtu ({formatDateIndo(wartaRange.weekEndStr)})
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-800 whitespace-nowrap">
                              {formatRupiah(totalMasuk)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-rose-800 whitespace-nowrap">
                              {formatRupiah(totalKeluar)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-[#0B132B] whitespace-nowrap">
                              {formatRupiah(item.saldoAkhirMinggu)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: LAPORAN SEMESTER & WARTA JEMAAT */}
      {/* ========================================================================= */}
      {activeTab === 'semester' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-600">Pilih Semester:</span>
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => setSelectedSemester(1)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedSemester === 1
                      ? 'bg-white text-[#2B4C9B] shadow-xs'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Semester I (Jan - Jun)
                </button>
                <button
                  onClick={() => setSelectedSemester(2)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedSemester === 2
                      ? 'bg-white text-[#2B4C9B] shadow-xs'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Semester II (Jul - Des)
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleCopyWartaText}
                className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-gray-600" />
                {copiedWarta ? 'Tersalin!' : 'Salin Teks Warta'}
              </button>

              <button
                onClick={() => {
                  const reportForPdf: SemesterReport = currentSemesterReport || {
                    id: effectiveSemesterReportId,
                    tahun: selectedYear,
                    semester: selectedSemester,
                    status: 'preparation',
                    version: 1,
                    checklist_result: liveSemesterChecklist.checklist,
                  };
                  generateWartaJemaatPDF({
                    report: reportForPdf,
                    settings,
                    posisiSummary: {
                      totalKas: semesterSummary.totalKas,
                      totalPenerimaan: semesterSummary.totalPenerimaan,
                      totalPengeluaran: semesterSummary.totalPengeluaran,
                      surplus: semesterSummary.surplus,
                    },
                  });
                }}
                className="px-4 py-2 bg-[#7C9CF5] hover:bg-[#6A8BE4] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh Warta Jemaat (PDF)
              </button>
            </div>
          </div>

          {/* Checklist & Workflow Status Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Checklist Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="font-bold text-gray-900 text-sm">Checklist Kesiapan Semester</h3>
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-md border ${
                    currentSemesterReport && currentSemesterReport.status !== 'preparation'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : liveSemesterChecklist.passed
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {currentSemesterReport && currentSemesterReport.status !== 'preparation'
                    ? 'Snapshot Terkunci'
                    : liveSemesterChecklist.passed
                    ? 'Siap Dikunci'
                    : 'Prasyarat Mutlak'}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                {[
                  {
                    code: 'months_closed',
                    label: 'Semua 6 bulan semester telah ditutup buku',
                    passed: liveSemesterChecklist.checklist.months_closed,
                    detail:
                      !liveSemesterChecklist.checklist.months_closed &&
                      liveSemesterChecklist.checklist.details?.missing_months?.length
                        ? `Belum ditutup: ${(liveSemesterChecklist.checklist.details.missing_months as number[])
                            .map((m) => getIndoMonthName(m))
                            .join(', ')}`
                        : null,
                  },
                  {
                    code: 'no_draft_transactions',
                    label: 'Tidak ada transaksi Draf / Diajukan yang tertunda',
                    passed: liveSemesterChecklist.checklist.no_draft_transactions,
                    detail:
                      !liveSemesterChecklist.checklist.no_draft_transactions &&
                      liveSemesterChecklist.checklist.details?.pending_tx_count
                        ? `${liveSemesterChecklist.checklist.details.pending_tx_count} transaksi masih Draf/Diajukan`
                        : null,
                  },
                  {
                    code: 'storages_reconciled',
                    label: 'Rekonsiliasi seluruh tempat penyimpanan selesai',
                    passed: liveSemesterChecklist.checklist.storages_reconciled,
                    detail:
                      !liveSemesterChecklist.checklist.storages_reconciled &&
                      liveSemesterChecklist.checklist.details?.missing_storages?.length
                        ? `Belum direkonsiliasi: ${(liveSemesterChecklist.checklist.details.missing_storages as string[]).join(', ')}`
                        : null,
                  },
                  {
                    code: 'advances_reviewed',
                    label: 'Panjar kegiatan telah ditinjau & dipertanggungjawabkan',
                    passed: liveSemesterChecklist.checklist.advances_reviewed,
                    detail: !liveSemesterChecklist.checklist.advances_reviewed
                      ? 'Ada panjar jatuh tempo yang belum diselesaikan'
                      : null,
                  },
                  {
                    code: 'budget_variance_explained',
                    label: 'Varians anggaran signifikan telah dijelaskan',
                    passed: liveSemesterChecklist.checklist.budget_variance_explained,
                    detail: null,
                  },
                  {
                    code: 'prior_findings_resolved',
                    label: 'Temuan wajib periksa dari audit sebelumnya tuntas',
                    passed: liveSemesterChecklist.checklist.prior_findings_resolved,
                    detail: !liveSemesterChecklist.checklist.prior_findings_resolved
                      ? 'Ada temuan Wajib Diperbaiki yang belum tuntas'
                      : null,
                  },
                ].map((item) => {
                  const dispKey = `sem-${selectedYear}-${selectedSemester}-${item.code}`;
                  const isDispensing = activeDispensationKey === dispKey;
                  const canGrantDispensation = isAdmin || isLeader;
                  const isLocked = Boolean(currentSemesterReport && currentSemesterReport.status !== 'preparation');

                  return (
                    <div key={item.code} className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          {item.passed ? (
                            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                          )}
                          <div>
                            <span className={item.passed ? 'text-gray-700 font-medium' : 'text-rose-700 font-semibold'}>
                              {item.label}
                            </span>
                            {item.detail && !item.passed && (
                              <p className="text-[11px] text-rose-600/90 mt-0.5">{item.detail}</p>
                            )}
                          </div>
                        </div>
                        {!item.passed && !isLocked && canGrantDispensation && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveDispensationKey(isDispensing ? null : dispKey);
                              setDispensationReason('');
                            }}
                            className="shrink-0 px-2 py-1 rounded-md text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-colors"
                          >
                            {isDispensing ? 'Batal' : 'Dispensasi'}
                          </button>
                        )}
                      </div>

                      {isDispensing && (
                        <div className="ml-6 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                          <input
                            type="text"
                            value={dispensationReason}
                            onChange={(e) => setDispensationReason(e.target.value)}
                            placeholder="Alasan dispensasi (mis. periode awal / saldo nol)..."
                            className="w-full px-2.5 py-1.5 text-[11px] rounded-lg border border-amber-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-400"
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={isSavingDispensation}
                              onClick={async () => {
                                setIsSavingDispensation(true);
                                const res = await grantLpjException(
                                  'semester',
                                  effectiveSemesterReportId,
                                  item.code,
                                  dispensationReason
                                );
                                setIsSavingDispensation(false);
                                if (res.success) {
                                  setActiveDispensationKey(null);
                                  setDispensationReason('');
                                  setSemesterLockError(null);
                                  showToast('Dispensasi checklist berhasil dicatat.');
                                } else {
                                  showToast(res.error || 'Gagal menyimpan dispensasi.', 'error');
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold disabled:opacity-50"
                            >
                              {isSavingDispensation ? 'Menyimpan...' : 'Simpan Dispensasi'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {semesterLockError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{semesterLockError}</span>
                </div>
              )}

              {/* Snapshot Locking / Locked Status Controls */}
              {(!currentSemesterReport || currentSemesterReport.status === 'preparation') ? (
                <button
                  type="button"
                  disabled={isLockingSemester}
                  onClick={async () => {
                    setSemesterLockError(null);
                    setIsLockingSemester(true);
                    const res = await lockSemesterSnapshot(effectiveSemesterReportId, {
                      tahun: selectedYear,
                      semester: selectedSemester,
                    });
                    setIsLockingSemester(false);
                    if (res.success) {
                      showToast(`Snapshot angka Laporan Semester ${selectedSemester} Tahun ${selectedYear} berhasil dikunci.`);
                    } else {
                      const errMsg = res.error || 'Gagal mengunci snapshot.';
                      setSemesterLockError(errMsg);
                      showToast(errMsg, 'error');
                    }
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors mt-2"
                >
                  <Lock className="w-3.5 h-3.5" />
                  {isLockingSemester ? 'Mengunci Snapshot...' : 'Kunci Snapshot Angka Semester'}
                </button>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-emerald-700" />
                      Snapshot Semester Terkunci
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700">
                      {currentSemesterReport.snapshot_data?.locked_at
                        ? formatDateIndo(currentSemesterReport.snapshot_data.locked_at)
                        : 'Aktif'}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    Angka laporan telah dibekukan dan siap diteruskan ke Pendeta Ressort / diwartakan.
                  </p>
                  {currentSemesterReport.status !== 'announced' && (isAdmin || isLeader) && (
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await unlockSemesterSnapshot(currentSemesterReport.id);
                        if (res.success) {
                          showToast('Kunci snapshot Semester dibuka kembali untuk pembaruan data.');
                        } else {
                          showToast(res.error || 'Gagal membuka kunci snapshot.', 'error');
                        }
                      }}
                      className="w-full py-1.5 px-3 bg-white hover:bg-emerald-100/60 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Unlock className="w-3 h-3" />
                      Buka Kunci Snapshot (Revisi)
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Warta Jemaat Public Preview Box */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-[#7C9CF5]" />
                  <h3 className="font-bold text-gray-900 text-sm">Pratinjau Ringkasan Warta Jemaat (Ramah Publik)</h3>
                </div>
                <span className="text-xs text-gray-500 font-medium">
                  Status:{' '}
                  {currentSemesterReport?.status === 'announced'
                    ? 'Telah Diwartakan'
                    : currentSemesterReport?.status === 'sent_to_pastor'
                    ? 'Diteruskan ke Pendeta'
                    : currentSemesterReport?.status === 'drafted'
                    ? 'Snapshot Terkunci'
                    : 'Draf Warta'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-gray-50/70 border border-gray-200 text-xs text-gray-700 leading-relaxed space-y-3 font-serif">
                <p className="font-bold text-gray-900 text-center uppercase tracking-wide">
                  LAPORAN KEUANGAN HURIA & SEKSI SEMESTER {selectedSemester} TAHUN {selectedYear}
                </p>

                <p>
                  {currentSemesterReport?.announcement_text ||
                    `Puji syukur kepada Tuhan Yang Maha Esa atas berkat dan penyertaan-Nya bagi peribadahan dan pelayanan di HKBP Ressort Hutaraja. Laporan Keuangan Semester ${selectedSemester} Tahun ${selectedYear} telah diperiksa secara tertib oleh Badan Audit Huria dengan opini Wajar Tanpa Pengecualian dan telah diterima oleh Pendeta Ressort.`}
                </p>

                <div className="bg-white p-3 rounded-lg border border-gray-200 space-y-1.5 font-sans">
                  <div className="flex justify-between font-semibold">
                    <span>1. Total Penerimaan Kas & Pelean:</span>
                    <span className="text-emerald-700 font-mono tabular-nums">
                      {formatRupiah(semesterSummary.totalPenerimaan)}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>2. Total Pengeluaran Pelayanan:</span>
                    <span className="text-rose-700 font-mono tabular-nums">
                      {formatRupiah(semesterSummary.totalPengeluaran)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold pt-1 border-t border-gray-100">
                    <span>3. Surplus / (Defisit) Operasional Semester:</span>
                    <span
                      className={`font-mono tabular-nums ${
                        semesterSummary.surplus >= 0 ? 'text-blue-700' : 'text-rose-700'
                      }`}
                    >
                      {formatRupiah(semesterSummary.surplus)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900 pt-1">
                    <span>4. Saldo Kas & Bank Per Akhir Periode:</span>
                    <span className="font-mono tabular-nums">{formatRupiah(semesterSummary.totalKas)}</span>
                  </div>
                </div>

                <p className="text-[11px] text-gray-500 italic text-center">
                  "Segala kemuliaan bagi Allah Bapa, Anak, dan Roh Kudus. Terima kasih atas partisipasi dan persembahan seluruh warga jemaat."
                </p>
              </div>

              {/* Pastoral Forwarding / Announce button */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <span className="text-xs text-gray-500">
                  {currentSemesterReport?.announced_date
                    ? `Diwartakan pada: ${formatDateIndo(currentSemesterReport.announced_date)} (Melalui ${currentSemesterReport.announcement_medium})`
                    : 'Belum diwartakan di mimbar'}
                </span>

                {currentSemesterReport?.status === 'drafted' && !isPastor && (
                  <button
                    onClick={async () => {
                      const res = await forwardSemesterToPastor(
                        currentSemesterReport.id,
                        `HKBP-HTR/SEM${selectedSemester}/${selectedYear}/01`
                      );
                      if (res.success) showToast('Laporan Semester berhasil diteruskan ke Pendeta Ressort.');
                      else showToast(res.error || 'Gagal meneruskan laporan.', 'error');
                    }}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Teruskan ke Pendeta Ressort
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LPJ TAHUNAN (ISAK 35) LENGKAP */}
      {/* ========================================================================= */}
      {activeTab === 'lpj' && (
        <div className="space-y-6">
          {/* Top LPJ Status & Document Actions Bar */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-gray-500">
                  {currentLpjReport?.nomor_dokumen || `HKBP-HTR/LPJ/${selectedYear}/001`}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                    currentLpjReport?.status === 'approved'
                      ? 'bg-purple-100 text-purple-800'
                      : currentLpjReport?.status === 'submitted_to_meeting'
                      ? 'bg-amber-100 text-amber-800'
                      : currentLpjReport?.status === 'drafted'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {currentLpjReport?.status === 'approved'
                    ? 'DISAHKAN RAPAT HURIA'
                    : currentLpjReport?.status === 'submitted_to_meeting'
                    ? 'DIAJUKAN KE RAPAT HURIA'
                    : currentLpjReport?.status === 'drafted'
                    ? 'SNAPSHOT LPJ TERKUNCI'
                    : 'DRAFT LPJ ISAK 35'}
                </span>
              </div>
              <h3 className="font-bold text-gray-900 text-base mt-1">
                Laporan Pertanggungjawaban Tahunan ISAK 35 — Tahun {selectedYear}
              </h3>
            </div>

            {/* Document Download & Approval Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  const lpjForPdf: LpjReport = currentLpjReport || {
                    id: effectiveLpjReportId,
                    tahun: selectedYear,
                    nomor_dokumen: `HKBP-HTR/LPJ/${selectedYear}/001`,
                    status: 'preparation',
                    version: 1,
                    checklist_result: liveLpjChecklist.checklist,
                  };
                  generateLpjTahunanPDF({
                    lpj: lpjForPdf,
                    settings,
                    posisiKeuangan: posisiKeuanganData,
                    perubahanSaldoDana: perubahanSaldoDanaData,
                    arusKas: arusKasData,
                    budgetRows: budgetConsolidated.rows,
                    notes: lpjNotes,
                  });
                }}
                className="px-4 py-2 bg-[#7C9CF5] hover:bg-[#6A8BE4] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh Dokumen LPJ Lengkap (PDF)
              </button>

              {/* Action Button: Lock Snapshot */}
              {(!currentLpjReport || currentLpjReport.status === 'preparation') && (
                <button
                  type="button"
                  disabled={isLockingLpj}
                  onClick={async () => {
                    setLpjLockError(null);
                    setIsLockingLpj(true);
                    const res = await lockLpjSnapshot(effectiveLpjReportId, selectedYear);
                    setIsLockingLpj(false);
                    if (res.success) {
                      showToast(`Snapshot LPJ ISAK 35 Tahun ${selectedYear} berhasil dikunci.`);
                    } else {
                      const errMsg = res.error || 'Gagal mengunci snapshot LPJ.';
                      setLpjLockError(errMsg);
                      showToast(errMsg, 'error');
                    }
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  {isLockingLpj ? 'Mengunci Snapshot...' : 'Kunci Snapshot LPJ'}
                </button>
              )}

              {/* Action Button: Unlock Snapshot before Rapat Huria approval */}
              {currentLpjReport && currentLpjReport.status === 'drafted' && (isAdmin || isLeader) && (
                <button
                  type="button"
                  onClick={async () => {
                    const res = await unlockLpjSnapshot(currentLpjReport.id);
                    if (res.success) {
                      showToast('Kunci snapshot LPJ dibuka kembali untuk pembaruan data.');
                    } else {
                      showToast(res.error || 'Gagal membuka kunci snapshot LPJ.', 'error');
                    }
                  }}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  Buka Kunci
                </button>
              )}

              {/* Action Button: Submit to Meeting */}
              {currentLpjReport?.status === 'drafted' && (
                <button
                  onClick={async () => {
                    const res = await submitLpjToMeeting(
                      currentLpjReport.id,
                      meetingDateInput,
                      meetingRefInput
                    );
                    if (res.success) showToast('LPJ berhasil diajukan ke Rapat Huria.');
                    else showToast(res.error || 'Gagal mengajukan LPJ.', 'error');
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  Ajukan ke Rapat Huria
                </button>
              )}

              {/* Action Button: Approve by Rapat Huria (Permanent Lock Trigger Effect) */}
              {currentLpjReport?.status === 'submitted_to_meeting' && isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowApproveLpjModal(true)}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Award className="w-3.5 h-3.5" />
                  Sahkan LPJ di Rapat Huria
                </button>
              )}
            </div>
          </div>

          {/* Checklist Kesiapan LPJ Card (visible while in preparation or if error occurred) */}
          {(!currentLpjReport || currentLpjReport.status === 'preparation') && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">Checklist Kesiapan Snapshot LPJ Tahunan ({selectedYear})</h4>
                  <p className="text-[11px] text-gray-500">
                    Seluruh prasyarat ini harus terpenuhi (atau diberi dispensasi resmi) sebelum snapshot LPJ dikunci.
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${
                    liveLpjChecklist.passed
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {liveLpjChecklist.passed ? 'Semua Prasyarat Terpenuhi' : `${liveLpjChecklist.blockers.length} Prasyarat Tertunda`}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {[
                  {
                    code: 'all_months_closed',
                    label: 'Seluruh 12 bulan tahun buku telah ditutup buku',
                    passed: liveLpjChecklist.checklist.all_months_closed,
                    detail:
                      !liveLpjChecklist.checklist.all_months_closed &&
                      liveLpjChecklist.checklist.details?.missing_months?.length
                        ? `${(liveLpjChecklist.checklist.details.missing_months as number[]).length} bulan belum ditutup`
                        : null,
                  },
                  {
                    code: 'no_pending_transactions',
                    label: 'Tidak ada transaksi Draf / Diajukan tertunda',
                    passed: liveLpjChecklist.checklist.no_pending_transactions,
                    detail:
                      !liveLpjChecklist.checklist.no_pending_transactions &&
                      liveLpjChecklist.checklist.details?.pending_tx_count
                        ? `${liveLpjChecklist.checklist.details.pending_tx_count} transaksi tertunda`
                        : null,
                  },
                  {
                    code: 'all_reconciliations_completed',
                    label: 'Rekonsiliasi akhir tahun seluruh kas & bank selesai',
                    passed: liveLpjChecklist.checklist.all_reconciliations_completed,
                    detail:
                      !liveLpjChecklist.checklist.all_reconciliations_completed &&
                      liveLpjChecklist.checklist.details?.missing_storages?.length
                        ? `Belum direkonsiliasi: ${(liveLpjChecklist.checklist.details.missing_storages as string[]).join(', ')}`
                        : null,
                  },
                  {
                    code: 'overdue_advances_cleared_or_reserved',
                    label: 'Panjar kegiatan telah diselesaikan / dicadangkan',
                    passed: liveLpjChecklist.checklist.overdue_advances_cleared_or_reserved,
                    detail: null,
                  },
                  {
                    code: 'audit_findings_settled',
                    label: 'Temuan wajib periksa Badan Audit tuntas',
                    passed: liveLpjChecklist.checklist.audit_findings_settled,
                    detail: null,
                  },
                  {
                    code: 'inventory_physical_checked',
                    label: 'Data aset tetap & cek fisik inventaris tersedia',
                    passed: liveLpjChecklist.checklist.inventory_physical_checked,
                    detail: !liveLpjChecklist.checklist.inventory_physical_checked
                      ? 'Belum ada data aset tetap / cek fisik inventaris'
                      : null,
                  },
                ].map((item) => {
                  const dispKey = `lpj-${selectedYear}-${item.code}`;
                  const isDispensing = activeDispensationKey === dispKey;
                  const canGrantDispensation = isAdmin || isLeader;
                  return (
                    <div key={item.code} className="p-3 rounded-xl bg-gray-50/70 border border-gray-200/80 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          {item.passed ? (
                            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <span className={item.passed ? 'text-gray-800 font-medium' : 'text-rose-700 font-semibold'}>
                              {item.label}
                            </span>
                            {item.detail && !item.passed && (
                              <p className="text-[11px] text-rose-600 mt-0.5">{item.detail}</p>
                            )}
                          </div>
                        </div>
                        {!item.passed && canGrantDispensation && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveDispensationKey(isDispensing ? null : dispKey);
                              setDispensationReason('');
                            }}
                            className="shrink-0 px-2 py-1 rounded-md text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300"
                          >
                            {isDispensing ? 'Batal' : 'Dispensasi'}
                          </button>
                        )}
                      </div>

                      {isDispensing && (
                        <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 space-y-2">
                          <input
                            type="text"
                            value={dispensationReason}
                            onChange={(e) => setDispensationReason(e.target.value)}
                            placeholder="Alasan dispensasi checklist LPJ..."
                            className="w-full px-2.5 py-1.5 text-[11px] rounded-lg border border-amber-300 bg-white focus:outline-hidden"
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              disabled={isSavingDispensation}
                              onClick={async () => {
                                setIsSavingDispensation(true);
                                const res = await grantLpjException(
                                  'lpj',
                                  effectiveLpjReportId,
                                  item.code,
                                  dispensationReason
                                );
                                setIsSavingDispensation(false);
                                if (res.success) {
                                  setActiveDispensationKey(null);
                                  setDispensationReason('');
                                  setLpjLockError(null);
                                  showToast('Dispensasi checklist LPJ berhasil disimpan.');
                                } else {
                                  showToast(res.error || 'Gagal menyimpan dispensasi.', 'error');
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold disabled:opacity-50"
                            >
                              {isSavingDispensation ? 'Menyimpan...' : 'Simpan Dispensasi'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {lpjLockError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{lpjLockError}</span>
                </div>
              )}
            </div>
          )}

          {/* 12-Section Sub-Navigation */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Sub-Navigation Menu */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-1 h-fit">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block px-3 py-1">
                Daftar Isi LPJ ISAK 35
              </span>

              {[
                { id: 1, title: '1. Cover & Pernyataan Tanggung Jawab' },
                { id: 2, title: '2. Ikhtisar Eksekutif (Executive Summary)' },
                { id: 3, title: '3. Laporan Posisi Keuangan (Lampiran 18 PPKU)' },
                { id: 4, title: '4. Laporan Penghasilan Komprehensif / Aktivitas' },
                { id: 5, title: '5. Laporan Perubahan Aset Neto (Saldo Dana)' },
                { id: 6, title: '6. Laporan Arus Kas Metode Langsung' },
                { id: 7, title: '7. Realisasi APBG Tahunan' },
                { id: 8, title: '8. Laporan Kas per Seksi / Sektor' },
                { id: 9, title: '9. Inventaris Aset Tetap & Panjar (Pasal 20)' },
                { id: 10, title: '10. Berita Acara Rekonsiliasi Bank & Kas' },
                { id: 11, title: '11. Catatan atas Laporan Keuangan (CaLK)' },
                { id: 12, title: '12. Berita Acara Hasil Audit & Rapat Huria' },
              ].map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => setActiveLpjSection(sec.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors flex items-center justify-between ${
                    activeLpjSection === sec.id
                      ? 'bg-[#7C9CF5]/15 text-[#2B4C9B] font-bold'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="line-clamp-1">{sec.title}</span>
                  <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                </button>
              ))}
            </div>

            {/* Right Display Area */}
            <div className="lg:col-span-3 space-y-6">
              {/* POS 3: LAPORAN POSISI KEUANGAN (NERACA BERIMBANG) */}
              {activeLpjSection === 3 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div>
                      <h4 className="font-bold text-gray-900 text-base">Laporan Posisi Keuangan (Neraca ISAK 35)</h4>
                      <p className="text-xs text-gray-500">Basis Kas yang Dimodifikasi per 31 Desember {selectedYear}</p>
                    </div>

                    {/* Balance Equation Indicator */}
                    <div
                      className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                        posisiKeuanganData.selisih_neraca === 0
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      <Scale className="w-3.5 h-3.5" />
                      {posisiKeuanganData.selisih_neraca === 0
                        ? 'Neraca Berimbang (Impas 100%)'
                        : `Selisih: ${formatRupiah(posisiKeuanganData.selisih_neraca)}`}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-700">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                          <th className="py-2.5 px-3">Pos Laporan Posisi Keuangan</th>
                          <th className="py-2.5 px-3 text-right">Nominal (Rp)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        <tr className="bg-gray-50/50 font-bold text-gray-900">
                          <td className="py-2 px-3">ASET</td>
                          <td className="py-2 px-3 text-right"></td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 pl-6">Kas dan Setara Kas (Kas Umum & Seksi)</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold">{formatRupiah(posisiKeuanganData.total_kas_dan_bank)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 pl-6">Piutang Pihak Ketiga</td>
                          <td className="py-2 px-3 text-right font-mono">{formatRupiah(posisiKeuanganData.total_piutang_pihak_ketiga)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 pl-6">Panjar Kegiatan Berjalan (Belum Selesai)</td>
                          <td className="py-2 px-3 text-right font-mono">{formatRupiah(posisiKeuanganData.total_panjar_berjalan)}</td>
                        </tr>
                        <tr className="bg-blue-50/30 font-semibold text-blue-900">
                          <td className="py-2 px-3 pl-4">Subtotal Aset Lancar</td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            {formatRupiah(posisiKeuanganData.total_kas_dan_bank + posisiKeuanganData.total_piutang)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 pl-6">Aset Tetap Historis (Tanah, Bangunan, Kendaraan)</td>
                          <td className="py-2 px-3 text-right font-mono">{formatRupiah(posisiKeuanganData.total_aset_tetap_bruto)}</td>
                        </tr>
                        {posisiKeuanganData.total_akumulasi_penyusutan ? (
                          <tr>
                            <td className="py-2 px-3 pl-6 text-rose-700">Akumulasi Penyusutan Aset Tetap</td>
                            <td className="py-2 px-3 text-right font-mono text-rose-700">
                              ({formatRupiah(posisiKeuanganData.total_akumulasi_penyusutan)})
                            </td>
                          </tr>
                        ) : null}
                        <tr className="bg-emerald-50/40 font-bold text-emerald-900 border-t border-emerald-200">
                          <td className="py-2.5 px-3">TOTAL ASET</td>
                          <td className="py-2.5 px-3 text-right font-mono text-sm">{formatRupiah(posisiKeuanganData.total_aset)}</td>
                        </tr>

                        <tr className="bg-gray-50/50 font-bold text-gray-900">
                          <td className="py-2 px-3 pt-4">KEWAJIBAN & SALDO DANA</td>
                          <td className="py-2 px-3 text-right"></td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 pl-6">Kewajiban Jangka Pendek (Utang Pihak Ketiga)</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold">{formatRupiah(posisiKeuanganData.total_kewajiban)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 pl-6">Aset Neto Tanpa Pembatasan (Dana Tidak Terikat)</td>
                          <td className="py-2 px-3 text-right font-mono">{formatRupiah(posisiKeuanganData.saldo_dana_tidak_terikat)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 pl-6">Aset Neto Dengan Pembatasan (Diakonia &amp; Pembangunan)</td>
                          <td className="py-2 px-3 text-right font-mono">{formatRupiah(posisiKeuanganData.saldo_dana_terikat)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 pl-6">Investasi dalam Aset Tetap Bersih</td>
                          <td className="py-2 px-3 text-right font-mono">
                            {formatRupiah(posisiKeuanganData.total_aset_tetap_bruto - (posisiKeuanganData.total_akumulasi_penyusutan || 0))}
                          </td>
                        </tr>
                        <tr className="bg-blue-50/30 font-semibold text-blue-900">
                          <td className="py-2 px-3 pl-4">Total Saldo Dana Bersih (Net Assets)</td>
                          <td className="py-2 px-3 text-right font-mono font-bold">{formatRupiah(posisiKeuanganData.total_saldo_dana_bersih)}</td>
                        </tr>
                        <tr className="bg-emerald-50/40 font-bold text-emerald-900 border-t border-emerald-200">
                          <td className="py-2.5 px-3">TOTAL KEWAJIBAN DAN SALDO DANA</td>
                          <td className="py-2.5 px-3 text-right font-mono text-sm">
                            {formatRupiah(posisiKeuanganData.total_kewajiban_dan_saldo_dana)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* POS 4: PENERIMAAN & PENGELUARAN (TRANSFER KAS DIPISAH) */}
              {activeLpjSection === 4 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
                  <div className="border-b border-gray-100 pb-3">
                    <h4 className="font-bold text-gray-900 text-base">Laporan Penerimaan dan Pengeluaran (Murni vs Transfer)</h4>
                    <p className="text-xs text-gray-500">
                      Sesuai pedoman akuntansi gereja, mutasi transfer antar kas TIDAK dicampur aduk dengan pendapatan atau belanja pelayanan.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/90 space-y-1.5">
                      <span className="text-xs font-semibold text-emerald-700">Penerimaan Pelayanan Murni</span>
                      <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                        {formatRupiah(lpjAnnualSummary.penerimaanMurni)}
                      </p>
                      <p className="text-[11px] text-slate-500">Pelean I-V, Kantong Diakonia, Donasi Terikat, &amp; Persembahan Khusus.</p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200/90 space-y-1.5">
                      <span className="text-xs font-semibold text-rose-700">Pengeluaran Pelayanan Murni</span>
                      <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                        {formatRupiah(lpjAnnualSummary.pengeluaranMurni)}
                      </p>
                      <p className="text-[11px] text-slate-500">Operasional Sekretariat, Listrik, Honor Pelayan, Pelayanan Sosial.</p>
                    </div>
                  </div>

                  {/* Transfer inter-kas separation table */}
                  <div className="pt-2">
                    <span className="text-xs font-bold text-gray-700 block mb-2">Mutasi Transfer Antar Kas (Tersaji di Baris Terpisah):</span>
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-xs text-gray-600 flex flex-wrap justify-between items-center gap-2">
                      <span>
                        Total Transfer Masuk Antar Kas:{' '}
                        <strong className="text-gray-900 font-mono tabular-nums">
                          {formatRupiah(lpjAnnualSummary.transferMasuk)}
                        </strong>
                      </span>
                      <span>
                        Total Transfer Keluar Antar Kas:{' '}
                        <strong className="text-gray-900 font-mono tabular-nums">
                          {formatRupiah(lpjAnnualSummary.transferKeluar)}
                        </strong>
                      </span>
                      <span
                        className={`font-bold font-mono tabular-nums ${
                          lpjAnnualSummary.selisihMutasi === 0 ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        Selisih Mutasi: {formatRupiah(lpjAnnualSummary.selisihMutasi)}{' '}
                        {lpjAnnualSummary.selisihMutasi === 0 ? '(Nihil)' : ''}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* POS 5: LAPORAN PERUBAHAN SALDO DANA */}
              {activeLpjSection === 5 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
                  <div className="border-b border-gray-100 pb-3">
                    <h4 className="font-bold text-gray-900 text-base">Laporan Perubahan Saldo Dana Per Kas</h4>
                    <p className="text-xs text-gray-500">Rekapitulasi mutasi dana per kas dan per jenis dana terikat/tidak terikat.</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-700">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                          <th className="py-2.5 px-3">Nama Kas</th>
                          <th className="py-2.5 px-3 text-center">Tipe Dana</th>
                          <th className="py-2.5 px-3 text-right">Saldo Awal</th>
                          <th className="py-2.5 px-3 text-right">Penerimaan</th>
                          <th className="py-2.5 px-3 text-right">Belanja</th>
                          <th className="py-2.5 px-3 text-right">Surplus/Def</th>
                          <th className="py-2.5 px-3 text-right">Saldo Akhir</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {perubahanSaldoDanaData.map((k) => (
                          <tr key={k.kas_id} className="hover:bg-gray-50/60">
                            <td className="py-2.5 px-3 font-semibold text-gray-900">{k.nama_kas}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  k.fund_type === 'restricted'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {k.fund_type === 'restricted' ? 'Terikat' : 'Tidak Terikat'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">{formatRupiah(k.saldo_awal)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-700">{formatRupiah(k.penerimaan_murni)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-rose-700">{formatRupiah(k.pengeluaran_murni)}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold">{formatRupiah(k.surplus_defisit)}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">{formatRupiah(k.saldo_akhir)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* POS 6: ARUS KAS METODE LANGSUNG */}
              {activeLpjSection === 6 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
                  <div className="border-b border-gray-100 pb-3">
                    <h4 className="font-bold text-gray-900 text-base">Laporan Arus Kas Metode Langsung</h4>
                    <p className="text-xs text-gray-500">Pengelompokan arus kas riil ke dalam aktivitas Operasi, Investasi, dan Pendanaan.</p>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div className="p-4 bg-gray-50/70 rounded-xl border border-gray-100 space-y-2">
                      <h5 className="font-bold text-gray-900 text-sm">1. Arus Kas dari Aktivitas Operasi</h5>
                      <div className="flex justify-between text-gray-600">
                        <span>Penerimaan Pelean dan Sumbangan Operasional:</span>
                        <span className="font-mono font-semibold text-emerald-700">{formatRupiah(arusKasData.kas_masuk_operasi)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Pengeluaran Belanja Pelayanan & Rutin Kantor:</span>
                        <span className="font-mono font-semibold text-rose-700">({formatRupiah(arusKasData.kas_keluar_operasi)})</span>
                      </div>
                      <div className="flex justify-between font-bold text-blue-900 pt-1 border-t border-gray-200">
                        <span>Arus Kas Bersih dari Aktivitas Operasi:</span>
                        <span className="font-mono">{formatRupiah(arusKasData.arus_kas_bersih_operasi)}</span>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50/70 rounded-xl border border-gray-100 space-y-2">
                      <h5 className="font-bold text-gray-900 text-sm">2. Arus Kas dari Aktivitas Investasi</h5>
                      <div className="flex justify-between text-gray-600">
                        <span>Pengadaan Aset Tetap Historis & Inventaris Gereja:</span>
                        <span className="font-mono font-semibold text-rose-700">({formatRupiah(arusKasData.kas_keluar_investasi)})</span>
                      </div>
                      <div className="flex justify-between font-bold text-blue-900 pt-1 border-t border-gray-200">
                        <span>Arus Kas Bersih dari Aktivitas Investasi:</span>
                        <span className="font-mono">{formatRupiah(arusKasData.arus_kas_bersih_investasi)}</span>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50/70 rounded-xl border border-gray-100 space-y-2">
                      <h5 className="font-bold text-gray-900 text-sm">3. Arus Kas dari Aktivitas Pendanaan</h5>
                      <div className="flex justify-between text-gray-600">
                        <span>Penerimaan Dana Terikat Pembangunan & Donasi Khusus:</span>
                        <span className="font-mono font-semibold text-emerald-700">{formatRupiah(arusKasData.kas_masuk_pendanaan)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Pengeluaran Terikat Pembangunan Fisik:</span>
                        <span className="font-mono font-semibold text-rose-700">({formatRupiah(arusKasData.kas_keluar_pendanaan)})</span>
                      </div>
                      <div className="flex justify-between font-bold text-blue-900 pt-1 border-t border-gray-200">
                        <span>Arus Kas Bersih dari Aktivitas Pendanaan:</span>
                        <span className="font-mono">{formatRupiah(arusKasData.arus_kas_bersih_pendanaan)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* POS 11: CATATAN ATAS LAPORAN KEUANGAN (CaLK) */}
              {activeLpjSection === 11 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
                  <div className="border-b border-gray-100 pb-3">
                    <h4 className="font-bold text-gray-900 text-base">Catatan atas Laporan Keuangan (CaLK)</h4>
                    <p className="text-xs text-gray-500">Pengungkapan kebijakan akuntansi, dasar penyusunan, dan peristiwa penting.</p>
                  </div>

                  <div className="space-y-4 text-xs text-gray-700 leading-relaxed">
                    <div className="p-4 bg-gray-50 rounded-xl space-y-1">
                      <h5 className="font-bold text-gray-900">1. Dasar Penyusunan:</h5>
                      <p>{lpjNotes?.accounting_basis}</p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-xl space-y-1">
                      <h5 className="font-bold text-gray-900">2. Kebijakan Akuntansi Kas Terpisah & Klasifikasi Dana:</h5>
                      <p>{lpjNotes?.accounting_policies}</p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-xl space-y-1">
                      <h5 className="font-bold text-gray-900">3. Penjelasan Dana Terikat (Restricted Funds):</h5>
                      <p>{lpjNotes?.restricted_funds_notes}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* OTHER SECTIONS FALLBACK */}
              {![3, 4, 5, 6, 11].includes(activeLpjSection) && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4 text-xs text-gray-600">
                  <h4 className="font-bold text-gray-900 text-sm">Bagian Dokumen #{activeLpjSection}</h4>
                  <p>
                    Bagian ini telah tersusun dalam arsip draf digital dan akan dicetak lengkap dalam dokumen resmi LPJ Tahunan PDF.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PELAPORAN SEMESTER PORTAL (SEKRETARIS & PENDETA) */}
      {/* ========================================================================= */}
      {activeTab === 'pelaporan' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-base">Portal Pelaporan Semester (Sekretaris & Pendeta Ressort)</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Verifikasi tanda terima laporan semester dari Bendahara Umum dan pencatatan pertimbangan gembala sebelum warta jemaat dibacakan.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-900">Laporan Semester {selectedSemester} Tahun {selectedYear}</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                  {currentSemesterReport?.status?.toUpperCase() || 'DRAFT'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Catatan / Arahan Pendeta Ressort</label>
                <textarea
                  rows={3}
                  value={pastorNotesInput}
                  onChange={(e) => setPastorNotesInput(e.target.value)}
                  placeholder="Catatan gembala pendeta sebelum warta diumumkan kepada jemaat..."
                  className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white"
                />
              </div>

              {(isPastor || isAdmin) && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={async () => {
                      if (!currentSemesterReport) return;
                      const res = await acknowledgeSemesterReport(
                        currentSemesterReport.id,
                        pastorNotesInput || 'Laporan telah diperiksa dan disetujui untuk diwartakan.'
                      );
                      if (res.success) {
                        showToast('Pendeta Ressort telah menandai tanda terima dan menyetujui pewartaan laporan.');
                      }
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Terima & Setujui Pewartaan Jemaat
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: BUKU KAS SEKSI (EXISTING FEATURE) */}
      {/* ========================================================================= */}
      {activeTab === 'buku_kas' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Pilih Kas / Seksi</label>
                <select
                  value={selectedKasId}
                  onChange={(e) => setSelectedKasId(e.target.value)}
                  className="text-xs font-semibold border border-gray-200 rounded-xl px-3 py-2 bg-gray-50/50"
                >
                  {viewableKas.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama} ({k.kode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Bulan</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value) || 1)}
                  className="text-xs font-semibold border border-gray-200 rounded-xl px-3 py-2 bg-gray-50/50"
                >
                  {MONTH_NAMES_INDO.map((name, idx) => (
                    <option key={idx} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  let running = initialBalance;
                  const rows = kasTransactions.map((tx, idx) => {
                    const masuk = tx.type === 'income' || tx.type === 'transfer_in' ? Number(tx.amount) : 0;
                    const keluar = tx.type === 'expense' || tx.type === 'transfer_out' ? Number(tx.amount) : 0;
                    running = running + masuk - keluar;

                    return {
                      No: idx + 1,
                      Tanggal: tx.tanggal,
                      'No. Bukti': tx.receipt_no || '-',
                      'Uraian Transaksi': tx.description,
                      'Masuk (Rp)': masuk,
                      'Keluar (Rp)': keluar,
                      'Saldo Berjalan (Rp)': running,
                    };
                  });
                  exportToExcel(rows, `Buku_Kas_${currentKas?.kode}_${getIndoMonthName(selectedMonth)}_${selectedYear}`);
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Ekspor Excel
              </button>

              <button
                onClick={() => {
                  if (!currentKas) return;
                  generateBukuKasPDF({
                    kas: currentKas,
                    periodeText: `${getIndoMonthName(selectedMonth)} ${selectedYear}`,
                    saldoAwal: initialBalance,
                    transactions: kasTransactions,
                    settings,
                    namaBendahara,
                    namaKetua,
                  });
                }}
                className="px-3.5 py-2 bg-[#7C9CF5] hover:bg-[#6A8BE4] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh PDF
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <span className="font-bold text-gray-900 text-sm">
                Buku Kas: {currentKas?.nama} ({getIndoMonthName(selectedMonth)} {selectedYear})
              </span>
              <span className="text-xs font-semibold text-gray-600">Saldo Awal Bulan: {formatRupiah(initialBalance)}</span>
            </div>

            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                <tr>
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3">No. Bukti</th>
                  <th className="py-2.5 px-3">Uraian</th>
                  <th className="py-2.5 px-3 text-right">Penerimaan</th>
                  <th className="py-2.5 px-3 text-right">Pengeluaran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {kasTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">
                      Tidak ada transaksi pada bulan ini.
                    </td>
                  </tr>
                ) : (
                  kasTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50/60">
                      <td className="py-2.5 px-3 font-mono">{formatDateIndo(tx.tanggal)}</td>
                      <td className="py-2.5 px-3 text-gray-500">{tx.receipt_no || '-'}</td>
                      <td className="py-2.5 px-3 font-medium text-gray-900">{tx.description}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                        {tx.type === 'income' || tx.type === 'transfer_in' ? formatRupiah(tx.amount) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-700">
                        {tx.type === 'expense' || tx.type === 'transfer_out' ? formatRupiah(tx.amount) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: KONSOLIDASI SELURUH KAS (EXISTING FEATURE) */}
      {/* ========================================================================= */}
      {activeTab === 'gabungan' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Laporan Konsolidasi Seluruh Kas Huria</h3>
                <p className="text-xs text-gray-500">Rekapitulasi mutasi seluruh {kasList.length} kas persekutuan, pembangunan, &amp; unit huria.</p>
              </div>

              <button
                onClick={() => {
                  generateLaporanGabunganPDF({
                    periodeText: `${getIndoMonthName(selectedMonth)} ${selectedYear}`,
                    kasSummaries: combinedSummaries,
                    settings,
                  });
                }}
                className="px-3.5 py-2 bg-[#7C9CF5] hover:bg-[#6A8BE4] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh Laporan Konsolidasi (PDF)
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-700">
                <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-3">Nama Kas</th>
                    <th className="py-2.5 px-3 text-right">Saldo Awal</th>
                    <th className="py-2.5 px-3 text-right">Pemasukan</th>
                    <th className="py-2.5 px-3 text-right">Pengeluaran</th>
                    <th className="py-2.5 px-3 text-right">Saldo Akhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {combinedSummaries.map((s) => (
                    <tr key={s.kode} className="hover:bg-gray-50/60">
                      <td className="py-2.5 px-3 font-semibold text-gray-900">{s.nama}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatRupiah(s.saldoAwal)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700">{formatRupiah(s.pemasukan)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-700">{formatRupiah(s.pengeluaran)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">{formatRupiah(s.saldoAkhir)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: REKONSILIASI BANK & KAS (EXISTING FEATURE) */}
      {/* ========================================================================= */}
      {activeTab === 'rekonsiliasi' && (() => {
        const activeStorages = storageAccounts.filter((s) => s.is_active);
        const startMonth = selectedSemester === 1 ? 1 : 7;
        const endMonth = selectedSemester === 1 ? 6 : 12;

        const isStorageReconciledInSem = (storageId: string) =>
          reconciliations.some((r) => {
            if (r.storage_account_id !== storageId) return false;
            const d = new Date(r.tanggal);
            const m = d.getMonth() + 1;
            return d.getFullYear() === selectedYear && m >= startMonth && m <= endMonth;
          });

        const completedCount = activeStorages.filter((s) => isStorageReconciledInSem(s.id)).length;

        return (
          <div className="space-y-6">
            {/* Status Kelengkapan Rekonsiliasi Semester */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Status Rekonsiliasi Tempat Penyimpanan — Tahun {selectedYear} Semester {selectedSemester}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Seluruh tempat penyimpanan aktif ({completedCount}/{activeStorages.length} selesai) wajib direkonsiliasi pada rentang bulan{' '}
                    {selectedSemester === 1 ? 'Januari–Juni' : 'Juli–Desember'} {selectedYear}.
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSelectedSemester(1)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold ${
                      selectedSemester === 1 ? 'bg-white text-[#2B4C9B] shadow-2xs' : 'text-gray-500'
                    }`}
                  >
                    Semester I
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSemester(2)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold ${
                      selectedSemester === 2 ? 'bg-white text-[#2B4C9B] shadow-2xs' : 'text-gray-500'
                    }`}
                  >
                    Semester II
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {activeStorages.map((s) => {
                  const done = isStorageReconciledInSem(s.id);
                  const isSelected = targetStorageAccount?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setRecStorageId(s.id)}
                      className={`p-3 rounded-xl border text-left transition-colors flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500/30'
                          : done
                          ? 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/70'
                          : 'border-rose-200 bg-rose-50/40 hover:bg-rose-50/70'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">{s.nama}</p>
                        <p className="text-[11px] text-gray-500">{s.tipe === 'cash' ? 'Uang Tunai' : 'Rekening Bank'}</p>
                      </div>
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          done ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {done ? 'Selesai' : 'Belum'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="font-bold text-gray-900 text-sm">Input Berita Acara Rekonsiliasi</h3>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!targetStorageAccount) return;
                    const res = await saveReconciliation({
                      tanggal: recDate || new Date().toISOString().split('T')[0],
                      storage_account_id: targetStorageAccount.id,
                      system_balance: currentSystemBalance,
                      physical_balance: rawPhysical,
                      notes: recNotes.trim() || undefined,
                    });

                    if (res.success) {
                      setRecSuccess(true);
                      setRecPhysicalAmount('');
                      setRecNotes('');
                      showToast(`Berita Acara Rekonsiliasi ${targetStorageAccount.nama} berhasil disimpan.`);
                      setTimeout(() => setRecSuccess(false), 3000);
                    } else {
                      showToast(res.error || 'Gagal menyimpan rekonsiliasi.', 'error');
                    }
                  }}
                  className="space-y-3 text-xs"
                >
                  <div>
                    <label className="block text-gray-600 font-semibold mb-1">Tanggal Berita Acara</label>
                    <input
                      type="date"
                      value={recDate}
                      onChange={(e) => setRecDate(e.target.value)}
                      required
                      className="w-full p-2 rounded-xl border border-gray-200 font-mono"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setRecDate(`${selectedYear}-06-30`)}
                        className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold"
                      >
                        Akhir Sem I (30 Jun {selectedYear})
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecDate(`${selectedYear}-12-31`)}
                        className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold"
                      >
                        Akhir Sem II (31 Des {selectedYear})
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-600 font-semibold mb-1">Tempat Penyimpanan</label>
                    <select
                      value={recStorageId}
                      onChange={(e) => setRecStorageId(e.target.value)}
                      className="w-full p-2 rounded-xl border border-gray-200"
                    >
                      {storageAccounts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nama} ({s.tipe === 'cash' ? 'Uang Tunai' : 'Bank'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-600 font-semibold mb-1">Saldo Menurut Sistem</label>
                    <input
                      type="text"
                      disabled
                      value={formatRupiah(currentSystemBalance)}
                      className="w-full p-2 rounded-xl bg-gray-50 border border-gray-200 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-600 font-semibold mb-1">Saldo Hasil Cek Fisik / Koran (Rp)</label>
                    <input
                      type="text"
                      value={recPhysicalAmount}
                      onChange={(e) => setRecPhysicalAmount(e.target.value)}
                      placeholder="Contoh: 0 atau sesuai saldo fisik"
                      className="w-full p-2 rounded-xl border border-gray-200 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-600 font-semibold mb-1">Catatan Pemeriksa</label>
                    <textarea
                      value={recNotes}
                      onChange={(e) => setRecNotes(e.target.value)}
                      rows={2}
                      placeholder="Contoh: Saldo klop dan telah diperiksa bersama..."
                      className="w-full p-2 rounded-xl border border-gray-200"
                    />
                  </div>

                  {recSuccess && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Berita acara rekonsiliasi tersimpan.</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#7C9CF5] hover:bg-[#6A8BE4] text-white font-semibold rounded-xl transition-colors shadow-xs"
                  >
                    Simpan Berita Acara Rekonsiliasi
                  </button>
                </form>
              </div>

            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="font-bold text-gray-900 text-sm">Riwayat Berita Acara Rekonsiliasi</h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-700">
                  <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                    <tr>
                      <th className="py-2.5 px-3">Tanggal</th>
                      <th className="py-2.5 px-3">Tempat</th>
                      <th className="py-2.5 px-3 text-right">Saldo Sistem</th>
                      <th className="py-2.5 px-3 text-right">Saldo Fisik</th>
                      <th className="py-2.5 px-3 text-right">Selisih</th>
                      <th className="py-2.5 px-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reconciliations.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-400">
                          Belum ada catatan rekonsiliasi.
                        </td>
                      </tr>
                    ) : (
                      reconciliations.map((r) => {
                        const stor = storageAccounts.find((s) => s.id === r.storage_account_id);
                        return (
                          <tr key={r.id} className="hover:bg-gray-50/60">
                            <td className="py-2.5 px-3 font-mono">{formatDateIndo(r.tanggal)}</td>
                            <td className="py-2.5 px-3 font-medium">{stor?.nama}</td>
                            <td className="py-2.5 px-3 text-right font-mono">{formatRupiah(r.system_balance)}</td>
                            <td className="py-2.5 px-3 text-right font-mono">{formatRupiah(r.physical_balance)}</td>
                            <td
                              className={`py-2.5 px-3 text-right font-mono font-bold ${
                                r.discrepancy === 0 ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {formatRupiah(r.discrepancy)}
                            </td>
                            <td className="py-2.5 px-3 text-gray-500">{r.notes || '-'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* TAB 7: REKAPITULASI SENTRALISASI KEUANGAN BPSK HKBP (PPKU)               */}
      {/* ========================================================================= */}
      {activeTab === 'bpsk' && (() => {
        const bpskSummary = getSentralisasiSummary(selectedYear);

        const yearAllApproved = transactions.filter(
          (tx) => tx.status === 'approved' && new Date(tx.tanggal).getFullYear() === selectedYear
        );
        const bpskCompliance = evaluateBpskRemittanceCompliance(yearAllApproved, categories);

        const yearIncomes = yearAllApproved.filter((tx) => tx.type === 'income');

        const yearBpskRemittances = yearAllApproved.filter((tx) => {
          if (tx.type !== 'expense') return false;
          const cat = categories.find((c) => c.id === tx.category_id);
          return (
            cat?.id === 'cat-out-bpsk' ||
            cat?.kode === 'OUT-01' ||
            (cat?.nama || '').toLowerCase().includes('bpsk') ||
            (tx.description || '').toLowerCase().includes('bpsk')
          );
        });

        // Group 1: Pelean Mingguan & Ibadah Lainnya
        const g1Cats = categories.filter(
          (c) =>
            c.tipe === 'income' &&
            (c.sentralisasi_group === 'pelean_mingguan' ||
              (!c.sentralisasi_group && ['IN-01', 'IN-02', 'IN-02B', 'IN-03', 'IN-04', 'IN-05', 'IN-05B'].includes(c.kode || '')))
        );
        // Group 2: Syukur & Khusus (Hamauliateon)
        const g2Cats = categories.filter(
          (c) =>
            c.tipe === 'income' &&
            (c.sentralisasi_group === 'pelean_syukur' ||
              (!c.sentralisasi_group && ['IN-06', 'IN-07', 'IN-08', 'IN-09', 'IN-10'].includes(c.kode || '')))
        );
        // Group 3: Badan Usaha, Lembaga & Hibah
        const g3Cats = categories.filter(
          (c) =>
            c.tipe === 'income' &&
            (c.sentralisasi_group === 'badan_usaha_lembaga' ||
              (!c.sentralisasi_group && ['IN-11', 'IN-12', 'IN-12B', 'IN-13', 'IN-14'].includes(c.kode || '')))
        );
        // Group 4: Kategori yang memiliki transaksi Non-Sentralisasi (100% Kas Tujuan)
        const nonSentralisasiCatIds = new Set(
          yearIncomes
            .filter((tx) => tx.is_sentralisasi === false || tx.sentralisasi_role === 'non_sentralisasi')
            .map((tx) => tx.category_id)
            .filter(Boolean)
        );
        const g4Cats = categories.filter(
          (c) =>
            c.tipe === 'income' &&
            (nonSentralisasiCatIds.has(c.id) || c.sentralisasi_group === 'dikecualikan_khusus')
        );

        const getCatStats = (catId: string, onlyNonSentralisasi = false) => {
          const catTxs = yearIncomes.filter((tx) => {
            if (tx.category_id !== catId) return false;
            const isExcluded = tx.is_sentralisasi === false || tx.sentralisasi_role === 'non_sentralisasi';
            return onlyNonSentralisasi ? isExcluded : !isExcluded;
          });
          let total = 0;
          let bpsk = 0;
          let huria = 0;

          catTxs.forEach((tx) => {
            const amt = Number(tx.amount) || 0;
            total += amt;
            const isExcluded = tx.is_sentralisasi === false || tx.sentralisasi_role === 'non_sentralisasi';
            if (isExcluded) {
              huria += amt;
            } else if (tx.sentralisasi_role === 'huria_share') {
              huria += amt;
            } else if (tx.sentralisasi_role === 'bpsk_share') {
              bpsk += amt;
            } else {
              const b = tx.bpsk_amount !== undefined ? Number(tx.bpsk_amount) : Math.round(amt * 0.55);
              bpsk += b;
              huria += tx.huria_amount !== undefined ? Number(tx.huria_amount) : amt - b;
            }
          });

          return { total, bpsk, huria };
        };

        const renderGroupTable = (title: string, groupDesc: string, catList: typeof categories, isExcludedGroup = false) => {
          const groupStats = catList.reduce(
            (acc, c) => {
              const s = getCatStats(c.id, isExcludedGroup);
              return {
                total: acc.total + s.total,
                bpsk: acc.bpsk + s.bpsk,
                huria: acc.huria + s.huria,
              };
            },
            { total: 0, bpsk: 0, huria: 0 }
          );
          const groupTotal = groupStats.total;
          const bpskGroupTotal = isExcludedGroup ? 0 : groupStats.bpsk;
          const huriaGroupTotal = isExcludedGroup ? groupTotal : groupStats.huria;

          return (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="p-4 bg-slate-50/80 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <span>{title}</span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        isExcludedGroup
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {isExcludedGroup ? '100% Kas Tujuan (Bebas Sentralisasi)' : 'Objek PPKU (55% BPSK / 45% Huria)'}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">{groupDesc}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-medium">Subtotal Penerimaan</span>
                  <span className="font-mono font-black text-sm text-slate-900">{formatRupiah(groupTotal)}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50/40 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="py-2.5 px-4 w-12 text-center">No</th>
                      <th className="py-2.5 px-4 w-24">Kode</th>
                      <th className="py-2.5 px-4">Nama Pos Penerimaan</th>
                      <th className="py-2.5 px-4 text-right">Total Pelean (100%)</th>
                      {!isExcludedGroup ? (
                        <>
                          <th className="py-2.5 px-4 text-right text-blue-700">55% Kas Sentralisasi (BPSK)</th>
                          <th className="py-2.5 px-4 text-right text-indigo-700">45% Lokal / Kas Tujuan</th>
                        </>
                      ) : (
                        <th className="py-2.5 px-4 text-right text-emerald-700">100% Hak Kas Tujuan</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {catList.length === 0 ? (
                      <tr>
                        <td colSpan={isExcludedGroup ? 5 : 6} className="py-6 text-center text-slate-400 text-xs">
                          Belum ada pos kategori untuk kelompok ini.
                        </td>
                      </tr>
                    ) : (
                      catList.map((cat, idx) => {
                        const { total, bpsk, huria } = getCatStats(cat.id, isExcludedGroup);

                        return (
                          <tr key={cat.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-4 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                            <td className="py-2.5 px-4 font-mono text-[11px] font-semibold text-slate-600">{cat.kode || '-'}</td>
                            <td className="py-2.5 px-4">
                              <div className="font-semibold text-slate-800">{cat.nama}</div>
                              {cat.deskripsi && <div className="text-[10px] text-slate-400 mt-0.5">{cat.deskripsi}</div>}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                              {formatRupiah(total)}
                            </td>
                            {!isExcludedGroup ? (
                              <>
                                <td className="py-2.5 px-4 text-right font-mono font-bold text-blue-700 tabular-nums bg-blue-50/20">
                                  {formatRupiah(bpsk)}
                                </td>
                                <td className="py-2.5 px-4 text-right font-mono font-bold text-indigo-700 tabular-nums bg-indigo-50/20">
                                  {formatRupiah(huria)}
                                </td>
                              </>
                            ) : (
                              <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700 tabular-nums bg-emerald-50/30">
                                {formatRupiah(huria)}
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot className="bg-slate-100/60 font-bold border-t border-slate-200">
                    <tr>
                      <td colSpan={3} className="py-2.5 px-4 text-right uppercase text-[11px] text-slate-700">
                        Subtotal {title}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                        {formatRupiah(groupTotal)}
                      </td>
                      {!isExcludedGroup ? (
                        <>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-blue-900 bg-blue-100/40">
                            {formatRupiah(bpskGroupTotal)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-indigo-900 bg-indigo-100/40">
                            {formatRupiah(huriaGroupTotal)}
                          </td>
                        </>
                      ) : (
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-900 bg-emerald-100/40">
                          {formatRupiah(huriaGroupTotal)}
                        </td>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        };

        return (
          <div className="space-y-6">
            {/* Top Control Bar */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-slate-900 text-base">Rekapitulasi Sentralisasi Keuangan BPSK HKBP</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                    PPKU HKBP Resmi
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Mekanisme 55% disetorkan ke Kas Pusat (BPSK HKBP) dan 45% tinggal di Huria untuk operasional pelayanan lokal.
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500 font-medium">Tahun Buku:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="font-bold bg-transparent text-slate-800 focus:outline-hidden"
                  >
                    {[2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <a
                  href={PPKU_DOCUMENT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-bold rounded-xl shadow-2xs transition-colors flex items-center gap-1.5"
                >
                  <FileText className="w-4 h-4 text-blue-700" />
                  <span>Pedoman PPKU 2023 (PDF)</span>
                </a>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Rekap</span>
                </button>
              </div>
            </div>

            {/* PPKU Pasal 4(2)a & Pasal 10(2)-(5) Compliance Tracker Banner */}
            <div
              className={`p-4 md:p-5 rounded-3xl border shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                bpskCompliance.status === 'terlambat_h3'
                  ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                  : bpskCompliance.status === 'batas_hari_ini'
                  ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                  : bpskCompliance.status === 'dalam_batas_h3'
                  ? 'bg-blue-50/80 border-blue-200 text-blue-950'
                  : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-extrabold uppercase tracking-wider">
                    Kepatuhan Batas Setor H+{PPKU_BPSK_DEADLINE_DAYS} &amp; Rekonsiliasi Warta ({PPKU_SK_NUMBER})
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/90 border border-current/20">
                    {bpskCompliance.status === 'lunas'
                      ? 'LUNAS / PATUH'
                      : bpskCompliance.status === 'dalam_batas_h3'
                      ? `TENGGANG H+${PPKU_BPSK_DEADLINE_DAYS}`
                      : bpskCompliance.status === 'batas_hari_ini'
                      ? `BATAS HARI INI (H+${PPKU_BPSK_DEADLINE_DAYS})`
                      : `LEWAT BATAS H+${PPKU_BPSK_DEADLINE_DAYS}`}
                  </span>
                </div>
                <p className="text-xs leading-relaxed opacity-90">{bpskCompliance.summaryText}</p>
                <p className="text-[11px] opacity-80">
                  <strong>Pasal 10 ayat (2) &amp; (4–5):</strong> Setoran dilakukan melalui Virtual Account BPSK HKBP (
                  <span className="font-mono font-bold">{settings.bpsk_va_number || 'Atur di Pengaturan'}</span>) dan BPSK memantau kesesuaian nominal Warta Jemaat dengan realisasi setoran.
                </p>
              </div>

              <div className="text-left md:text-right shrink-0 bg-white/80 px-4 py-2.5 rounded-2xl border border-current/15">
                <span className="text-[10px] uppercase font-bold opacity-75 block">Sisa Kewajiban Belum Disetor</span>
                <span className="font-mono font-black text-lg tabular-nums">
                  {formatRupiah(bpskCompliance.outstandingBpsk)}
                </span>
              </div>
            </div>

            {/* 4 Executive Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card-executive card-hover p-5 rounded-2xl space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Objek Sentralisasi
                </span>
                <div className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                  {formatRupiah(bpskSummary.totalObjekSentralisasi)}
                </div>
                <p className="text-[11px] text-slate-400">Dasar pembagian 55% / 45%</p>
              </div>

              <div className="card-executive card-hover p-5 rounded-2xl space-y-1">
                <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider block">
                  Kewajiban BPSK (55%)
                </span>
                <div className="text-xl font-bold font-mono text-blue-900 tabular-nums">
                  {formatRupiah(bpskSummary.totalBpskObligation)}
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between pt-0.5 tabular-nums">
                  <span>Disetor: {formatRupiah(bpskSummary.totalBpskRemitted)}</span>
                  <span className={`font-semibold ${bpskSummary.outstandingBpsk > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {bpskSummary.outstandingBpsk > 0 ? `Sisa: ${formatRupiah(bpskSummary.outstandingBpsk)}` : 'Lunas'}
                  </span>
                </div>
              </div>

              <div className="card-executive card-hover p-5 rounded-2xl space-y-1">
                <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider block">
                  Hak Kas Lokal (45%)
                </span>
                <div className="text-xl font-bold font-mono text-indigo-900 tabular-nums">
                  {formatRupiah(bpskSummary.totalHuriaShare)}
                </div>
                <p className="text-[11px] text-slate-400">Operasional gereja lokal</p>
              </div>

              <div className="card-executive card-hover p-5 rounded-2xl space-y-1">
                <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
                  Non-Sentralisasi (100%)
                </span>
                <div className="text-xl font-bold font-mono text-emerald-900 tabular-nums">
                  {formatRupiah(bpskSummary.totalDikecualikan)}
                </div>
                <p className="text-[11px] text-slate-400">
                  Sosial, Pembangunan, Transitoris
                </p>
              </div>
            </div>

            {/* Sub-Tables of PPKU Groups */}
            <div className="space-y-5">
              {renderGroupTable(
                '1. Persembahan Mingguan dan Ibadah',
                'Transaksi sentralisasi dari pos ibadah mingguan & kategorial.',
                g1Cats
              )}

              {renderGroupTable(
                '2. Persembahan Syukur (Hamauliateon)',
                'Transaksi sentralisasi dari pos ucapan syukur.',
                g2Cats
              )}

              {renderGroupTable(
                '3. Badan Usaha, Lembaga & Sumber Resmi Lainnya',
                'Transaksi sentralisasi dari badan usaha, hibah & sumber lainnya.',
                g3Cats
              )}

              {renderGroupTable(
                '4. Penerimaan Non-Sentralisasi (100% Kas Tujuan)',
                'Seluruh transaksi yang ditetapkan bebas sentralisasi saat pencatatan.',
                g4Cats,
                true
              )}
            </div>

            {/* Riwayat Mutasi Penyetoran ke BPSK Kantor Pusat */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden space-y-3 p-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Riwayat Penyetoran ke Kas Pusat (BPSK HKBP)</h4>
                    <p className="text-xs text-slate-500">
                      Catatan pengeluaran kas huria untuk penyetoran kewajiban 55% ke rekening BPSK Kantor Pusat HKBP.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-700">
                  Total Disetor: <span className="font-mono text-blue-900">{formatRupiah(bpskSummary.totalBpskRemitted)}</span>
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="py-2.5 px-3">Tanggal</th>
                      <th className="py-2.5 px-3">No. Bukti / Ref</th>
                      <th className="py-2.5 px-3">Uraian Transaksi</th>
                      <th className="py-2.5 px-3">Sumber Rekening</th>
                      <th className="py-2.5 px-3 text-right">Nominal Setoran</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {yearBpskRemittances.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Belum ada transaksi penyetoran ke BPSK HKBP yang dicatat di Tahun {selectedYear}.
                        </td>
                      </tr>
                    ) : (
                      yearBpskRemittances.map((tx) => {
                        const stor = storageAccounts.find((s) => s.id === tx.storage_account_id);
                        return (
                          <tr key={tx.id} className="hover:bg-slate-50/60">
                            <td className="py-2.5 px-3 font-mono font-medium">{formatDateIndo(tx.tanggal)}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-500">{tx.receipt_no || '-'}</td>
                            <td className="py-2.5 px-3 font-medium text-slate-800">{tx.description}</td>
                            <td className="py-2.5 px-3 text-slate-600">{stor?.nama}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-900">
                              {formatRupiah(tx.amount)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
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

            {/* Panduan Rekening Resmi & Virtual Account Penyetoran BPSK HKBP */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-200/80 text-xs space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                  <Landmark className="w-5 h-5 text-blue-700" />
                  <span>Virtual Account &amp; Rekening Resmi BPSK HKBP (PPKU Pasal 10 ayat 2)</span>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-blue-900 text-white font-mono text-[11px] font-bold">
                  VA Huria: {settings.bpsk_va_number || 'Belum diatur di Pengaturan'}
                </span>
              </div>
              <p className="text-slate-600 text-xs leading-relaxed">
                Sesuai PPKU Pasal 4 ayat (2)a dan Pasal 10 ayat (2), penyetoran 55% kewajiban sentralisasi dilakukan melalui Virtual Account a.n. BPSK HKBP maksimal <strong>3 hari setelah ibadah jemaat</strong>.
                Setelah transfer dilakukan, catat pengeluaran di menu Transaksi pada kategori <strong>&quot;Penyetoran 55% Sentralisasi ke Kas Pusat (BPSK HKBP)&quot;</strong> dengan mengunggah bukti transfer bank.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="bg-white/90 p-3 rounded-2xl border border-blue-100 shadow-2xs">
                  <div className="text-[10px] font-bold text-blue-700 uppercase">Bank Mandiri (VA BPSK)</div>
                  <div className="font-mono font-black text-sm text-slate-900 mt-0.5">107-00-1122334-4</div>
                  <div className="text-[10px] text-slate-500">a.n. BPSK HKBP PUSAT</div>
                </div>
                <div className="bg-white/90 p-3 rounded-2xl border border-blue-100 shadow-2xs">
                  <div className="text-[10px] font-bold text-blue-700 uppercase">Bank BRI (VA BPSK)</div>
                  <div className="font-mono font-black text-sm text-slate-900 mt-0.5">0053-01-000456-30-2</div>
                  <div className="text-[10px] text-slate-500">a.n. SENTRALISASI KEUANGAN HKBP</div>
                </div>
                <div className="bg-white/90 p-3 rounded-2xl border border-blue-100 shadow-2xs">
                  <div className="text-[10px] font-bold text-blue-700 uppercase">Bank BNI (VA BPSK)</div>
                  <div className="font-mono font-black text-sm text-slate-900 mt-0.5">0234-5678-90</div>
                  <div className="text-[10px] text-slate-500">a.n. HKBP PEARJA TARUTUNG (BPSK)</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Konfirmasi Pengesahan LPJ di Rapat Huria */}
      {showApproveLpjModal && currentLpjReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Pengesahan LPJ Tahunan {selectedYear}</h4>
                  <p className="text-[11px] text-slate-500">Penguncian Permanen Buku Kas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowApproveLpjModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
              <strong>PERINGATAN PENTING:</strong> Pengesahan LPJ oleh Rapat Huria akan{' '}
              <strong>MENGUNCI PERMANEN</strong> seluruh transaksi tahun {selectedYear}. Transaksi tidak dapat diubah
              atau dihapus lagi setelah disahkan.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowApproveLpjModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  const res = await approveLpjReport(
                    currentLpjReport.id,
                    meetingNotesInput,
                    meetingAttendeesInput
                  );
                  setShowApproveLpjModal(false);
                  if (res.success) {
                    showToast(
                      `LPJ Tahun ${selectedYear} RESMI DISAHKAN Rapat Huria! Seluruh transaksi tahun ini terkunci permanen.`
                    );
                  } else {
                    showToast(res.error || 'Gagal mengesahkan LPJ.', 'error');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-sm"
              >
                Ya, Sahkan LPJ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
