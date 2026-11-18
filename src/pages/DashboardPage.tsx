/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Clock,
  FileText,
  ChevronRight,
  ShieldCheck,
  Calendar,
  Wallet,
  Receipt,
  BookOpen,
  Lock,
  Package,
  CreditCard,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
  Landmark,
  CheckCircle2,
  Layers,
  ClipboardCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatRupiah, formatDateIndo } from '../lib/formatters';
import { evaluateBpskRemittanceCompliance, PPKU_BPSK_DEADLINE_DAYS } from '../lib/ppkuRules';

const CHART_COLORS = ['#1E3A8A', '#0D9488', '#B45309', '#BE123C', '#4F46E5', '#475569', '#0891B2'];

const STATUS_TEXT: Record<string, { label: string; cls: string }> = {
  approved: { label: 'Disetujui', cls: 'text-emerald-700' },
  submitted: { label: 'Diajukan', cls: 'text-blue-700' },
  draft: { label: 'Draf', cls: 'text-amber-700' },
  rejected: { label: 'Ditolak', cls: 'text-rose-700' },
};

export const DashboardPage: React.FC = () => {
  const {
    currentUser,
    isLeader,
    isAdmin,
    isBendaharaUmum,
    isAuditor,
    isPendeta,
    isSekretaris,
    isMajelis,
    userKasAccess,
    canInputKas,
    canApproveKas,
    canRecordTransactions,
    canApprove,
    canViewBpsk,
    canViewAuditModule,
    canAssignAudit,
    canViewWarta,
    canViewConsolidatedLpj,
    canManageOpeningBook,
    canManageLpjData,
  } = useAuth();
  const {
    kasList,
    storageAccounts,
    categories,
    transactions,
    getKasBalances,
    getStorageBalances,
    getSentralisasiSummary,
    settings,
    openingSetup,
    isKasOpeningLocked,
    advances,
    fixedAssets,
    receivablesPayables,
    auditFindings,
    auditFinalOpinions,
    semesterReports,
    isYearLockedByLpj,
  } = useData();

  const todayStr = new Date().toISOString().split('T')[0];

  const myAssignedKasIds = userKasAccess.map((a) => a.kas_id);
  const isSeksiUser = !isLeader && currentUser?.role === 'pengurus_kas';

  const visibleKasList = isSeksiUser
    ? kasList.filter((k) => myAssignedKasIds.includes(k.id))
    : kasList;

  const visibleTransactions = isSeksiUser
    ? transactions.filter((tx) => myAssignedKasIds.includes(tx.kas_id))
    : transactions;

  const visibleAdvances = isSeksiUser
    ? advances.filter((a) => myAssignedKasIds.includes(a.kas_id))
    : advances;

  const visibleFixedAssets = isSeksiUser
    ? fixedAssets.filter((a) => myAssignedKasIds.includes(a.kas_id))
    : fixedAssets;

  const visibleReceivablesPayables = isSeksiUser
    ? receivablesPayables.filter((r) => myAssignedKasIds.includes(r.kas_id))
    : receivablesPayables;

  const activeAdvances = visibleAdvances.filter((a) => a.status === 'active');
  const overdueAdvances = activeAdvances.filter((a) => a.due_date < todayStr);
  const latestFinalOpinion = auditFinalOpinions[0];
  const pendingAuditFindings = auditFindings.filter(
    (f) => f.severity === 'wajib_diperbaiki' && f.status !== 'selesai' && f.status !== 'diterima'
  );
  const currentSemesterRep =
    semesterReports.find((r) => r.tahun === (settings.active_year || 2026)) || semesterReports[0];
  const currentYearLocked = isYearLockedByLpj(settings.active_year || 2026);
  const totalOverdueAdvanceAmount = overdueAdvances.reduce((sum, a) => sum + Number(a.amount), 0);
  const totalActiveAdvanceAmount = activeAdvances.reduce((sum, a) => sum + Number(a.amount), 0);
  const totalFixedAssetsAmount = visibleFixedAssets
    .filter((a) => a.status === 'aktif')
    .reduce((sum, a) => sum + Number(a.nilai_perolehan), 0);
  const totalActiveReceivablesAmount = visibleReceivablesPayables
    .filter((r) => r.type === 'receivable' && r.status !== 'paid')
    .reduce((sum, r) => sum + Number(r.remaining_amount), 0);
  const totalActivePayablesAmount = visibleReceivablesPayables
    .filter((r) => r.type === 'payable' && r.status !== 'paid')
    .reduce((sum, r) => sum + Number(r.remaining_amount), 0);

  const totalKasCount = visibleKasList.length;
  const lockedKasCount = visibleKasList.filter((k) => isKasOpeningLocked(k.id)).length;
  const lockedPercentage = totalKasCount > 0 ? Math.round((lockedKasCount / totalKasCount) * 100) : 0;
  const isOpeningIncomplete = lockedKasCount < totalKasCount;

  const allKasBalances = getKasBalances();
  const kasBalances = isSeksiUser
    ? allKasBalances.filter((kb) => myAssignedKasIds.includes(kb.kas_id))
    : allKasBalances;
  const storageBalances = getStorageBalances();

  const totalSaldoResmi = kasBalances.reduce((sum, k) => sum + k.saldo_resmi, 0);
  const totalSaldoProyeksi = kasBalances.reduce((sum, k) => sum + k.saldo_proyeksi, 0);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const sentralisasiSummary = getSentralisasiSummary(currentYear);
  const bpskCompliance = evaluateBpskRemittanceCompliance(transactions, categories, todayStr);

  const currentMonthTx = visibleTransactions.filter((tx) => {
    const d = new Date(tx.tanggal);
    return d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth && tx.status === 'approved';
  });

  const currentMonthIncomeCount = currentMonthTx.filter((tx) => tx.type === 'income').length;
  const currentMonthExpenseCount = currentMonthTx.filter((tx) => tx.type === 'expense').length;

  const totalBulanIniMasuk = currentMonthTx
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  const totalBulanIniKeluar = currentMonthTx
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + Number(tx.amount), 0);

  const canRecordAnyActiveKas =
    isAdmin || (canRecordTransactions && kasList.some((k) => k.is_active && canInputKas(k.id)));
  const canApproveAnyActiveKas =
    isAdmin || (canApprove && kasList.some((k) => k.is_active && canApproveKas(k.id)));

  const pendingApprovals = transactions.filter((tx) => tx.status === 'submitted');
  const myPendingApprovals = canApproveAnyActiveKas
    ? pendingApprovals.filter((tx) => canApproveKas(tx.kas_id))
    : [];

  const myActionNeeded = visibleTransactions.filter(
    (tx) => tx.created_by === currentUser?.id && (tx.status === 'draft' || tx.status === 'rejected')
  );

  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const trendData = monthNamesShort.map((bulan, idx) => {
    const m = idx + 1;
    const mTx = visibleTransactions.filter((tx) => {
      const d = new Date(tx.tanggal);
      return d.getFullYear() === currentYear && d.getMonth() + 1 === m && tx.status === 'approved';
    });
    const masuk = mTx
      .filter((t) => t.type === 'income' || t.type === 'transfer_in')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const keluar = mTx
      .filter((t) => t.type === 'expense' || t.type === 'transfer_out')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    return { bulan, masuk, keluar };
  });

  const approvedIncomeTx = visibleTransactions.filter(
    (tx) => (tx.type === 'income' || tx.type === 'transfer_in') && tx.status === 'approved'
  );
  const donutData = categories
    .filter((c) => c.tipe === 'income')
    .map((c) => {
      const val = approvedIncomeTx
        .filter((tx) => tx.category_id === c.id)
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      return { name: c.nama, value: val };
    })
    .filter((item) => item.value > 0);

  const recentTransactions = visibleTransactions.slice(0, 8);
  const roleLabel = (currentUser?.role || '').replace('_', ' ');

  return (
    <div className="space-y-5 w-full max-w-7xl mx-auto min-w-0">
      {/* Compact Executive Header Banner */}
      <div className="card-navy rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="text-xs text-slate-300 flex items-center gap-2 flex-wrap">
            <span>{settings.church_name || 'HKBP Ressort Hutaraja'}</span>
            <span aria-hidden="true">·</span>
            <span className="capitalize">{roleLabel}</span>
            {userKasAccess.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>{userKasAccess.length} Kas Seksi</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">T.A. {settings.active_year}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white truncate">
            Horas, {currentUser?.full_name}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {isAdmin && myPendingApprovals.length > 0 && (
            <NavLink
              to="/approvals"
              className="px-3.5 py-2.5 min-h-[40px] bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span>{myPendingApprovals.length} Antrean Persetujuan</span>
            </NavLink>
          )}

          {!isAdmin && canApproveAnyActiveKas && myPendingApprovals.length > 0 && (
            <NavLink
              to="/approvals"
              className="px-3.5 py-2.5 min-h-[40px] bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span>{myPendingApprovals.length} Menunggu Persetujuan</span>
            </NavLink>
          )}

          {isAuditor && pendingAuditFindings.length > 0 && (
            <NavLink
              to="/audit"
              className="px-3.5 py-2.5 min-h-[40px] bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>{pendingAuditFindings.length} Temuan Audit</span>
            </NavLink>
          )}

          {canRecordAnyActiveKas && myActionNeeded.length > 0 && (
            <NavLink
              to="/transactions"
              className="px-3.5 py-2.5 min-h-[40px] bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span>{myActionNeeded.length} Draf/Revisi</span>
            </NavLink>
          )}

          {canRecordAnyActiveKas ? (
            <NavLink
              to="/transactions"
              className="px-4 py-2.5 min-h-[40px] bg-white text-slate-900 hover:bg-slate-100 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Receipt className="w-4 h-4 shrink-0 text-blue-700" />
              <span>Catat &amp; Kelola Transaksi</span>
            </NavLink>
          ) : isAuditor ? (
            <NavLink
              to="/audit"
              className="px-4 py-2.5 min-h-[40px] bg-white text-slate-900 hover:bg-slate-100 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4 shrink-0 text-purple-700" />
              <span>Modul Badan Audit</span>
            </NavLink>
          ) : canApproveAnyActiveKas && !canRecordAnyActiveKas ? (
            <NavLink
              to="/approvals"
              className="px-4 py-2.5 min-h-[40px] bg-white text-slate-900 hover:bg-slate-100 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
              <span>Persetujuan Kas</span>
            </NavLink>
          ) : isSekretaris ? (
            <NavLink
              to="/reports?tab=warta"
              className="px-4 py-2.5 min-h-[40px] bg-white text-slate-900 hover:bg-slate-100 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <FileText className="w-4 h-4 shrink-0 text-blue-700" />
              <span>Warta Mingguan</span>
            </NavLink>
          ) : (
            <NavLink
              to="/reports?tab=semester"
              className="px-4 py-2.5 min-h-[40px] bg-white text-slate-900 hover:bg-slate-100 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <FileText className="w-4 h-4 shrink-0 text-blue-700" />
              <span>Laporan Keuangan</span>
            </NavLink>
          )}

          {isPendeta && (
            <NavLink
              to="/audit?action=penugasan"
              className="px-4 py-2.5 min-h-[40px] bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap shadow-xs"
            >
              <ClipboardCheck className="w-4 h-4 shrink-0 text-amber-300" />
              <span>Buka Penugasan Audit</span>
            </NavLink>
          )}

          <NavLink
            to="/guide"
            className="px-3.5 py-2.5 min-h-[40px] bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span>Panduan</span>
          </NavLink>
        </div>
      </div>

      {/* Compact Opening Book Progress Strip */}
      {isOpeningIncomplete ? (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-amber-950">
                Pembukaan Buku: {lockedKasCount}/{totalKasCount} Kas Dikunci ({lockedPercentage}%)
              </span>
              <span className="text-[11px] text-amber-800 hidden sm:inline">
                Mulai aktif {formatDateIndo(openingSetup.go_live_date)}
              </span>
            </div>
            <div className="w-full bg-amber-200/70 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${lockedPercentage}%` }}
              />
            </div>
          </div>
          {canManageOpeningBook && (
            <NavLink
              to="/opening-balance"
              className="px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 shrink-0 transition-colors whitespace-nowrap"
            >
              <span>Selesaikan Saldo Awal</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </NavLink>
          )}
        </div>
      ) : (
        <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900">
          <span>
            <strong className="font-semibold">Saldo Awal Aktif:</strong> {totalKasCount} kas terkunci per{' '}
            {formatDateIndo(openingSetup.go_live_date)}.
          </span>
          {canManageOpeningBook && (
            <NavLink to="/opening-balance" className="font-semibold text-emerald-800 hover:underline">
              Berita Acara
            </NavLink>
          )}
        </div>
      )}

      {/* Compact PPKU H+3 BPSK Alert */}
      {bpskCompliance.outstandingBpsk > 0 &&
        (bpskCompliance.status === 'terlambat_h3' || bpskCompliance.status === 'batas_hari_ini') &&
        canViewBpsk && (
          <div
            className={`rounded-xl px-4 py-3 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              bpskCompliance.status === 'terlambat_h3'
                ? 'bg-rose-50 border-rose-200 text-rose-950'
                : 'bg-amber-50 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Landmark className="w-4 h-4 shrink-0 text-rose-700" />
              <div className="text-xs min-w-0">
                <span className="font-semibold">
                  {bpskCompliance.status === 'terlambat_h3'
                    ? `Setoran BPSK 55% Lewat H+${PPKU_BPSK_DEADLINE_DAYS}`
                    : `Batas Setoran BPSK 55% Hari Ini (H+${PPKU_BPSK_DEADLINE_DAYS})`}
                </span>
                <span className="mx-1.5 text-slate-400">·</span>
                <span className="font-mono font-bold tabular-nums">
                  Sisa {formatRupiah(bpskCompliance.outstandingBpsk)}
                </span>
              </div>
            </div>
            <NavLink
              to="/reports?tab=bpsk"
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1 shrink-0 whitespace-nowrap"
            >
              <span>Kelola BPSK</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </NavLink>
          </div>
        )}

      {/* 4-Column Executive KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="card-hover bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Kas &amp; Bank</span>
            <Wallet className="w-4 h-4 text-blue-700" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tabular-nums tracking-tight truncate">
              {formatRupiah(totalSaldoResmi)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Proyeksi</span>
              <span className="font-mono font-semibold text-slate-700 tabular-nums">
                {formatRupiah(totalSaldoProyeksi)}
              </span>
            </div>
          </div>
        </div>

        <div className="card-hover bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pemasukan Bulan Ini</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-700" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-700 font-mono tabular-nums tracking-tight truncate">
              +{formatRupiah(totalBulanIniMasuk)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {currentMonthIncomeCount} transaksi disetujui
            </div>
          </div>
        </div>

        <div className="card-hover bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pengeluaran Bulan Ini</span>
            <ArrowDownRight className="w-4 h-4 text-rose-700" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-rose-700 font-mono tabular-nums tracking-tight truncate">
              -{formatRupiah(totalBulanIniKeluar)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {currentMonthExpenseCount} transaksi disetujui
            </div>
          </div>
        </div>

        {isAuditor ? (
          <div className="card-hover bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Temuan Audit</span>
              <ShieldCheck className="w-4 h-4 text-purple-700" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {pendingAuditFindings.length}{' '}
                <span className="text-xs font-sans font-medium text-slate-500">Tertunda</span>
              </div>
              <NavLink to="/audit" className="text-[11px] font-semibold text-blue-700 hover:underline mt-1 inline-block">
                Buka Modul Audit →
              </NavLink>
            </div>
          </div>
        ) : isSekretaris ? (
          <div className="card-hover bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Warta Jemaat</span>
              <FileText className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900">Mingguan Siap</div>
              <NavLink
                to="/reports?tab=warta"
                className="text-[11px] font-semibold text-blue-700 hover:underline mt-1 inline-block"
              >
                Lihat Warta Huria →
              </NavLink>
            </div>
          </div>
        ) : isMajelis ? (
          <div className="card-hover bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Pengawasan Kas</span>
              <Layers className="w-4 h-4 text-teal-700" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {visibleKasList.length}{' '}
                <span className="text-xs font-sans font-medium text-slate-500">Kas Aktif</span>
              </div>
              <NavLink to="/budget" className="text-[11px] font-semibold text-blue-700 hover:underline mt-1 inline-block">
                Realisasi APBG →
              </NavLink>
            </div>
          </div>
        ) : isBendaharaUmum ? (
          <div className="card-hover bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Sisa Setor BPSK (55%)</span>
              <Landmark className="w-4 h-4 text-blue-800" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-blue-900 font-mono tabular-nums truncate">
                {formatRupiah(bpskCompliance.outstandingBpsk)}
              </div>
              <NavLink
                to="/reports?tab=bpsk"
                className="text-[11px] font-semibold text-blue-700 hover:underline mt-1 inline-block"
              >
                Kelola Setoran BPSK →
              </NavLink>
            </div>
          </div>
        ) : canApproveAnyActiveKas ? (
          <div className="card-hover bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Antrean Persetujuan</span>
              <Clock className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {myPendingApprovals.length}{' '}
                <span className="text-xs font-sans font-medium text-slate-500">Menunggu</span>
              </div>
              <NavLink
                to="/approvals"
                className="text-[11px] font-semibold text-blue-700 hover:underline mt-1 inline-block"
              >
                Tinjau Antrean →
              </NavLink>
            </div>
          </div>
        ) : canRecordAnyActiveKas ? (
          <div className="card-hover bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Draf &amp; Revisi Saya</span>
              <Receipt className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {myActionNeeded.length}{' '}
                <span className="text-xs font-sans font-medium text-slate-500">Item</span>
              </div>
              <NavLink
                to="/transactions"
                className="text-[11px] font-semibold text-blue-700 hover:underline mt-1 inline-block"
              >
                Buka Transaksi →
              </NavLink>
            </div>
          </div>
        ) : (
          <div className="card-hover bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Buku Kas Aktif</span>
              <Layers className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {visibleKasList.length}{' '}
                <span className="text-xs font-sans font-medium text-slate-500">Buku Kas</span>
              </div>
              <NavLink
                to="/transactions"
                className="text-[11px] font-semibold text-blue-700 hover:underline mt-1 inline-block"
              >
                Lihat Mutasi Kas →
              </NavLink>
            </div>
          </div>
        )}
      </div>

      {/* Sentralisasi PPKU Summary Strip */}
      {canViewBpsk && (
        <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Sentralisasi PPKU HKBP · {currentYear}
              </h2>
              <p className="text-[11px] text-slate-500">
                55% BPSK Pusat · 45% Huria · Non-Sentralisasi 100%
              </p>
            </div>
            <NavLink
              to="/reports?tab=bpsk"
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1"
            >
              <span>Rekap Setoran BPSK</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </NavLink>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            <div className="p-4 sm:p-5 space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 block">Objek Sentralisasi</span>
              <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                {formatRupiah(sentralisasiSummary.totalObjekSentralisasi)}
              </div>
              <span className="text-[11px] text-slate-400 block">Total dasar pembagian 55/45</span>
            </div>

            <div className="p-4 sm:p-5 space-y-1">
              <span className="text-[11px] font-semibold text-blue-900 block">55% Kas Pusat (BPSK)</span>
              <div className="text-lg font-bold font-mono text-blue-900 tabular-nums">
                {formatRupiah(sentralisasiSummary.totalBpskObligation)}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2">
                <span>Disetor: {formatRupiah(sentralisasiSummary.totalBpskRemitted)}</span>
                <span
                  className={`font-semibold ${
                    sentralisasiSummary.outstandingBpsk > 0 ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  {sentralisasiSummary.outstandingBpsk > 0
                    ? `Sisa ${formatRupiah(sentralisasiSummary.outstandingBpsk)}`
                    : 'Lunas'}
                </span>
              </div>
            </div>

            <div className="p-4 sm:p-5 space-y-1">
              <span className="text-[11px] font-semibold text-slate-700 block">45% Kas Huria (Lokal)</span>
              <div className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                {formatRupiah(sentralisasiSummary.totalHuriaShare)}
              </div>
              <span className="text-[11px] text-slate-400 block">Bagian operasional gereja</span>
            </div>

            <div className="p-4 sm:p-5 space-y-1">
              <span className="text-[11px] font-semibold text-emerald-800 block">
                Non-Sentralisasi (100%)
              </span>
              <div className="text-lg font-bold font-mono text-emerald-800 tabular-nums">
                {formatRupiah(sentralisasiSummary.totalDikecualikan)}
              </div>
              <span className="text-[11px] text-slate-400 block truncate">
                Sosial/Pembangunan/Transitoris
              </span>
            </div>
          </div>
        </div>
      )}

      {/* LPJ & Audit + Supporting Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="card-hover bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Panjar Jatuh Tempo</span>
            <Clock className={`w-4 h-4 ${overdueAdvances.length > 0 ? 'text-rose-600' : 'text-amber-600'}`} />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 tabular-nums">
              {overdueAdvances.length} Panjar{' '}
              <span className="text-xs font-medium text-slate-500">
                ({formatRupiah(totalOverdueAdvanceAmount)})
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1.5 flex items-center justify-between">
              <span>Aktif: {activeAdvances.length} ({formatRupiah(totalActiveAdvanceAmount)})</span>
              <NavLink to="/lpj-data" className="font-semibold text-blue-700 hover:underline">
                Rincian →
              </NavLink>
            </div>
          </div>
        </div>

        <div className="card-hover bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Aset Tetap Gereja</span>
            <Package className="w-4 h-4 text-slate-700" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 tabular-nums">
              {formatRupiah(totalFixedAssetsAmount)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1.5 flex items-center justify-between">
              <span>{visibleFixedAssets.filter((a) => a.status === 'aktif').length} unit aktif</span>
              <NavLink to="/lpj-data" className="font-semibold text-blue-700 hover:underline">
                Daftar Aset →
              </NavLink>
            </div>
          </div>
        </div>

        <div className="card-hover bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Piutang &amp; Utang (ISAK 35)</span>
            <CreditCard className="w-4 h-4 text-slate-700" />
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Piutang</span>
              <span className="font-mono font-bold text-emerald-700 tabular-nums">
                {formatRupiah(totalActiveReceivablesAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Utang</span>
              <span className="font-mono font-bold text-rose-700 tabular-nums">
                {formatRupiah(totalActivePayablesAmount)}
              </span>
            </div>
            <div className="pt-1 flex justify-end">
              <NavLink to="/lpj-data" className="text-[11px] font-semibold text-blue-700 hover:underline">
                {canManageLpjData ? 'Kelola →' : 'Lihat →'}
              </NavLink>
            </div>
          </div>
        </div>
      </div>

      {/* LPJ & Audit Governance Summary (Flat 2-Col) */}
      {(canViewConsolidatedLpj || canViewAuditModule) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {canViewConsolidatedLpj && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 flex items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="text-sm font-bold text-slate-900">Laporan &amp; LPJ ISAK 35</div>
                <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                  <span>
                    Semester I:{' '}
                    <strong className="text-slate-800">
                      {currentSemesterRep?.status === 'announced' ? 'Diwartakan' : 'Penyusunan'}
                    </strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    {currentYearLocked ? <Lock className="w-3 h-3 text-purple-700" /> : null}
                    {currentYearLocked ? 'LPJ Terkunci' : 'LPJ Terbuka'}
                  </span>
                </div>
              </div>
              <NavLink
                to="/reports?tab=semester"
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1 shrink-0 whitespace-nowrap"
              >
                <span>Buka Laporan</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </NavLink>
            </div>
          )}

          {canViewAuditModule && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 flex items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="text-sm font-bold text-slate-900">Badan Audit Huria</div>
                <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                  <span>
                    Opini:{' '}
                    <strong className="text-slate-800">
                      {latestFinalOpinion?.final_opinion === 'sesuai'
                        ? 'Wajar Tanpa Pengecualian'
                        : 'Dengan Catatan'}
                    </strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className={pendingAuditFindings.length > 0 ? 'text-amber-700 font-semibold' : 'text-emerald-700'}>
                    {pendingAuditFindings.length > 0
                      ? `${pendingAuditFindings.length} temuan terbuka`
                      : 'Nihil temuan'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {canAssignAudit && (
                  <NavLink
                    to="/audit?action=penugasan"
                    className="px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-900 text-xs font-semibold rounded-xl inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span>Buka Penugasan Audit</span>
                  </NavLink>
                )}
                <NavLink
                  to="/audit"
                  className="px-3.5 py-2 bg-purple-900 hover:bg-purple-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1 shrink-0 whitespace-nowrap"
                >
                  <span>Modul Audit</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </NavLink>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Buku Kas Seksi Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            {isSeksiUser ? 'Kas Seksi Ditugaskan' : 'Saldo per Buku Kas'}
          </h2>
          <NavLink
            to={canViewConsolidatedLpj ? '/reports?tab=semester' : canViewWarta ? '/reports?tab=warta' : '/transactions'}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1"
          >
            <span>Lihat Rincian</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </NavLink>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {kasBalances.map((kb) => {
            const kas = kasList.find((k) => k.id === kb.kas_id);
            const isRestricted = kas?.fund_type === 'restricted';

            return (
              <div
                key={kb.kas_id}
                className="card-hover bg-white p-4 rounded-2xl border border-slate-200/90 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 truncate">{kb.nama}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                    <span className="font-mono">{kb.kode}</span>
                    <span aria-hidden="true">·</span>
                    <span>{isRestricted ? 'Dana Terikat' : 'Dana Umum'}</span>
                  </div>
                </div>

                <div className="text-lg sm:text-xl font-bold text-slate-900 font-mono tabular-nums">
                  {formatRupiah(kb.saldo_resmi)}
                </div>

                <div className="pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Masuk</span>
                    <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                      +{formatRupiah(kb.total_pemasukan)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block">Keluar</span>
                    <span className="font-mono font-semibold text-rose-700 tabular-nums">
                      -{formatRupiah(kb.total_pengeluaran)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Storage Accounts (Brankas & Rekening Bank) */}
      {!isSeksiUser && (
        <div className="space-y-3">
          <h2 className="text-sm sm:text-base font-bold text-slate-900">Brankas &amp; Rekening Bank</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {storageBalances.map((sb) => {
              const isCash = sb.tipe === 'cash';
              return (
                <div
                  key={sb.storage_account_id}
                  className="bg-[#0B132B] text-white p-4 sm:p-5 rounded-2xl border border-slate-800 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{sb.nama}</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {isCash ? 'Tunai Brankas' : sb.nomor_rekening || 'Rekening Gereja'}
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-amber-300 shrink-0">
                      {isCash ? <Coins className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                    </div>
                  </div>

                  <div className="text-xl sm:text-2xl font-bold font-mono text-white tabular-nums">
                    {formatRupiah(sb.saldo_saat_ini)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 min-w-0">
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/90 space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">Tren Arus Kas {currentYear}</h3>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#1E3A8A]" />
                Pemasukan
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#BE123C]" />
                Pengeluaran
              </span>
            </div>
          </div>

          <div className="h-60 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  tickFormatter={(val) => `${(val / 1000000).toFixed(0)}Jt`}
                />
                <Tooltip
                  formatter={(val: any) => formatRupiah(Number(val))}
                  contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid #E2E8F0' }}
                />
                <Bar dataKey="masuk" fill="#1E3A8A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="keluar" fill="#BE123C" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 flex flex-col justify-between gap-4 min-w-0">
          <h3 className="text-sm font-bold text-slate-900">Komposisi Pemasukan</h3>

          {donutData.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Belum ada pemasukan disetujui.
            </div>
          ) : (
            <>
              <div className="h-44 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={68}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {donutData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => formatRupiah(Number(val))}
                      contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid #E2E8F0' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs">
                {donutData.slice(0, 6).map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-slate-600 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                      />
                      <span className="truncate">{item.name}</span>
                    </span>
                    <span className="font-semibold text-slate-900 font-mono tabular-nums shrink-0">
                      {formatRupiah(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Transaksi Terakhir</h3>
          <NavLink
            to="/transactions"
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1"
          >
            <span>Semua Transaksi</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </NavLink>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="py-3 px-5">Tanggal</th>
                <th className="py-3 px-5">Kas &amp; Simpanan</th>
                <th className="py-3 px-5">Uraian</th>
                <th className="py-3 px-5 text-right">Nominal</th>
                <th className="py-3 px-5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    Belum ada transaksi tercatat.
                  </td>
                </tr>
              ) : (
                recentTransactions.map((tx) => {
                  const kas = kasList.find((k) => k.id === tx.kas_id);
                  const storage = storageAccounts.find((s) => s.id === tx.storage_account_id);
                  const isInc = tx.type === 'income' || tx.type === 'transfer_in';
                  const st = STATUS_TEXT[tx.status] || { label: tx.status, cls: 'text-slate-600' };

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-5 font-mono text-slate-600 whitespace-nowrap tabular-nums">
                        {formatDateIndo(tx.tanggal)}
                      </td>
                      <td className="py-3 px-5 whitespace-nowrap">
                        <span className="font-semibold text-slate-900">{kas?.nama}</span>
                        <span className="text-slate-400 mx-1">·</span>
                        <span className="text-slate-500">{storage?.nama}</span>
                      </td>
                      <td className="py-3 px-5 max-w-sm">
                        <div className="font-medium text-slate-900 truncate">{tx.description}</div>
                      </td>
                      <td
                        className={`py-3 px-5 text-right font-mono font-bold whitespace-nowrap tabular-nums ${
                          isInc ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {isInc ? '+' : '-'}
                        {formatRupiah(tx.amount)}
                      </td>
                      <td className={`py-3 px-5 text-right font-semibold whitespace-nowrap ${st.cls}`}>
                        {st.label}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-slate-100 px-4">
          {recentTransactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">Belum ada transaksi tercatat.</div>
          ) : (
            recentTransactions.map((tx) => {
              const kas = kasList.find((k) => k.id === tx.kas_id);
              const storage = storageAccounts.find((s) => s.id === tx.storage_account_id);
              const isInc = tx.type === 'income' || tx.type === 'transfer_in';
              const st = STATUS_TEXT[tx.status] || { label: tx.status, cls: 'text-slate-600' };

              return (
                <div key={tx.id} className="py-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-slate-500 tabular-nums">{formatDateIndo(tx.tanggal)}</span>
                    <span className={`font-semibold ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="font-semibold text-slate-900 text-xs leading-snug">{tx.description}</div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-[11px] text-slate-500 truncate">
                      {kas?.nama} · {storage?.nama}
                    </span>
                    <span
                      className={`font-mono font-bold tabular-nums shrink-0 ${
                        isInc ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {isInc ? '+' : '-'}
                      {formatRupiah(tx.amount)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
