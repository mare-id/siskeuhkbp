/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ReceiptText,
  CheckSquare,
  FileSpreadsheet,
  Lock,
  Database,
  History,
  Settings,
  User,
  LogOut,
  Plus,
  ArrowRightLeft,
  Menu,
  X,
  Shield,
  Calculator,
  BookOpen,
  FolderArchive,
  HelpCircle,
  ShieldCheck,
  Search,
  Landmark,
  FileText,
  FileEdit,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { TransactionModal } from '../transactions/TransactionModal';
import { TransferModal } from '../transactions/TransferModal';

export const AppLayout: React.FC = () => {
  const {
    currentUser,
    logout,
    isAdmin,
    isBendaharaUmum,
    isAuditor,
    isPendeta,
    isSekretaris,
    isMajelis,
    isPengurusKas,
    canRecordTransactions,
    canTransfer,
    canApprove,
    canClosePeriod,
    canManageSettings,
    canManageMasterData,
    canViewBpsk,
    canViewAuditModule,
    canViewAuditTrail,
    canViewWarta,
    canViewConsolidatedLpj,
    canManageBudget,
    canManageOpeningBook,
    canInputKas,
    canApproveKas,
  } = useAuth();
  const { kasList, transactions, settings, auditFindings } = useData();
  const navigate = useNavigate();
  const location = useLocation();

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const showRecordAction =
    isAdmin || (canRecordTransactions && kasList.some((k) => k.is_active && canInputKas(k.id)));
  const showTransferAction =
    isAdmin || (canTransfer && kasList.some((k) => k.is_active && canInputKas(k.id)));
  const showApprovalAction =
    isAdmin || (canApprove && kasList.some((k) => k.is_active && canApproveKas(k.id)));

  const pendingCount = showApprovalAction
    ? transactions.filter((tx) => tx.status === 'submitted' && canApproveKas(tx.kas_id)).length
    : 0;
  const openFindingsCount = auditFindings.filter(
    (f) => f.status === 'terbuka' || f.status === 'ditanggapi'
  ).length;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    {
      to: '/',
      label: 'Dashboard',
      icon: LayoutDashboard,
      exact: true,
      allowed: true,
    },
    {
      to: '/transactions',
      label: isAuditor ? 'Uji Bukti Transaksi' : 'Transaksi Kas',
      icon: ReceiptText,
      allowed: true,
    },
    {
      to: '/budget',
      label: 'Anggaran (APBG)',
      icon: Calculator,
      allowed: canManageBudget,
    },
    {
      to: '/opening-balance',
      label: 'Pembukaan Buku',
      icon: BookOpen,
      allowed: canManageOpeningBook,
    },
    {
      to: '/approvals',
      label: 'Persetujuan',
      icon: CheckSquare,
      badge: pendingCount > 0 ? pendingCount : null,
      allowed: showApprovalAction,
    },
    {
      to: '/reports?tab=warta',
      label: 'Warta Keuangan',
      icon: FileText,
      allowed: canViewWarta,
    },
    {
      to: '/reports?tab=semester',
      label: 'Laporan & LPJ',
      icon: FileSpreadsheet,
      allowed: canViewConsolidatedLpj,
    },
    {
      to: '/reports?tab=bpsk',
      label: 'Sentralisasi (55/45)',
      icon: Landmark,
      allowed: canViewBpsk,
    },
    {
      to: '/lpj-data',
      label: 'Data Pendukung LPJ',
      icon: FolderArchive,
      allowed: isAdmin || isBendaharaUmum || isPengurusKas || isPendeta || isSekretaris || isMajelis || isAuditor,
    },
    {
      to: '/audit',
      label: 'Badan Audit',
      icon: Shield,
      badge: openFindingsCount > 0 ? openFindingsCount : null,
      allowed: canViewAuditModule,
    },
    {
      to: '/closing',
      label: 'Tutup Buku',
      icon: Lock,
      allowed: canClosePeriod,
    },
    {
      to: '/admin/transactions',
      label: 'Edit & Hapus Transaksi',
      icon: FileEdit,
      allowed: isAdmin,
    },
    {
      to: '/master',
      label: 'Data Master',
      icon: Database,
      allowed: canManageMasterData,
    },
    {
      to: '/audit-logs',
      label: 'Audit Trail',
      icon: History,
      allowed: canViewAuditTrail,
    },
    {
      to: '/settings',
      label: 'Pengaturan',
      icon: Settings,
      allowed: canManageSettings,
    },
    {
      to: '/guide',
      label: 'Panduan',
      icon: HelpCircle,
      allowed: true,
    },
  ];

  const activeNavItem =
    navItems.find((item) => {
      if (location.pathname === '/audit') {
        return item.to === '/audit';
      }
      if (location.pathname === '/reports' && location.search.includes('tab=bpsk')) {
        return item.to.includes('tab=bpsk');
      }
      if (
        location.pathname === '/reports' &&
        (location.search.includes('tab=warta') || location.search === '')
      ) {
        return item.to.includes('tab=warta');
      }
      if (location.pathname === '/reports') {
        return item.to.includes('tab=semester');
      }
      if (item.to.includes('?')) return false;
      return item.exact
        ? location.pathname === item.to
        : item.to !== '/' && location.pathname.startsWith(item.to);
    }) || navItems[0];

  const isNavItemActive = (to: string, isActive: boolean) => {
    if (to === '/audit') {
      return location.pathname === '/audit';
    }
    if (to.includes('tab=bpsk')) {
      return location.pathname === '/reports' && location.search.includes('tab=bpsk');
    }
    if (to.includes('tab=warta')) {
      return (
        location.pathname === '/reports' &&
        (location.search.includes('tab=warta') || location.search === '')
      );
    }
    if (to.includes('tab=semester')) {
      return (
        location.pathname === '/reports' &&
        !location.search.includes('tab=bpsk') &&
        !location.search.includes('tab=warta') &&
        location.search !== ''
      );
    }
    return isActive;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col w-full overflow-x-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-[#0B132B] border-r border-slate-800/90 fixed inset-y-0 left-0 z-30">
        {/* Brand */}
        <div className="px-4 py-4 border-b border-slate-800/80 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white p-1 border border-slate-700/40 flex items-center justify-center shrink-0">
            <img
              src="/assets/aistudio/Logo-HKBP_02090ed7.png"
              alt="Logo HKBP"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-white text-xs leading-tight truncate">
              {settings.church_name}
            </h1>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">SISKEU · T.A. {settings.active_year}</p>
          </div>
        </div>

        {/* Primary Role CTA */}
        <div className="p-3 space-y-1.5">
          {showRecordAction ? (
            <>
              <button
                onClick={() => setIsTxModalOpen(true)}
                className="w-full h-9 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Catat Transaksi</span>
              </button>
              {showTransferAction && (
                <button
                  onClick={() => setIsTransferModalOpen(true)}
                  className="w-full h-8 px-3 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 border border-slate-800 transition-colors"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />
                  <span>Transfer Antar Kas</span>
                </button>
              )}
            </>
          ) : isAuditor ? (
            <NavLink
              to="/audit"
              className="w-full h-9 px-3 bg-purple-700 hover:bg-purple-600 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-amber-300" />
              <span>Modul Audit</span>
            </NavLink>
          ) : isPendeta ? (
            <>
              <NavLink
                to="/audit"
                className="w-full h-9 px-3 bg-purple-700 hover:bg-purple-600 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-amber-300" />
                <span>Badan Audit</span>
              </NavLink>
              {showApprovalAction && (
                <NavLink
                  to="/approvals"
                  className="w-full h-8 px-3 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Persetujuan {pendingCount > 0 ? `(${pendingCount})` : ''}</span>
                </NavLink>
              )}
            </>
          ) : showApprovalAction ? (
            <NavLink
              to="/approvals"
              className="w-full h-9 px-3 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <CheckSquare className="w-4 h-4" />
              <span>Persetujuan {pendingCount > 0 ? `(${pendingCount})` : ''}</span>
            </NavLink>
          ) : isSekretaris ? (
            <NavLink
              to="/reports?tab=warta"
              className="w-full h-9 px-3 bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Materi Warta</span>
            </NavLink>
          ) : (
            <NavLink
              to="/reports?tab=semester"
              className="w-full h-9 px-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-400" />
              <span>Laporan Keuangan</span>
            </NavLink>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2.5 py-1 space-y-0.5 overflow-y-auto scrollbar-none">
          {navItems
            .filter((item) => item.allowed)
            .map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  className={({ isActive }) => {
                    const active = isNavItemActive(item.to, isActive);
                    return `flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                      active
                        ? 'bg-blue-600/20 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/70'
                    }`;
                  }}
                >
                  {({ isActive }) => {
                    const active = isNavItemActive(item.to, isActive);
                    return (
                      <>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-400' : ''}`} />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.badge !== undefined && item.badge !== null && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-amber-500 text-white tabular-nums">
                            {item.badge}
                          </span>
                        )}
                      </>
                    );
                  }}
                </NavLink>
              );
            })}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between gap-2">
          <NavLink
            to="/profile"
            className="flex items-center gap-2.5 min-w-0 flex-1 p-1.5 rounded-lg hover:bg-slate-900 transition-colors"
            title="Profil & Kata Sandi"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-800/80 text-blue-200 font-bold text-xs flex items-center justify-center shrink-0">
              {currentUser?.full_name.substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-200 truncate">
                {currentUser?.full_name}
              </div>
              <div className="text-[10px] text-slate-400 capitalize truncate">
                {currentUser?.role.replace('_', ' ')}
              </div>
            </div>
          </NavLink>

          <button
            onClick={handleLogout}
            title="Keluar"
            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="md:pl-60 flex flex-col min-h-screen w-full min-w-0">
        {/* Desktop Top Header */}
        <header className="hidden md:flex items-center justify-between gap-4 px-6 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-20">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-medium text-slate-400">SISKEU HKBP</span>
            <span className="text-slate-300">/</span>
            <h2 className="text-sm font-bold text-slate-900 truncate">
              {activeNavItem.label}
            </h2>
            <span className="text-slate-300 mx-1">·</span>
            <span className="text-xs text-slate-500 font-medium tabular-nums">
              T.A. {settings.active_year}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {showTransferAction && (
              <button
                onClick={() => setIsTransferModalOpen(true)}
                className="h-8 px-3 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors flex items-center gap-1.5"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
                <span>Transfer Kas</span>
              </button>
            )}

            {showRecordAction && (
              <button
                onClick={() => setIsTxModalOpen(true)}
                className="h-8 px-3.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Catat Transaksi</span>
              </button>
            )}

            {(isAuditor || isAdmin || isPendeta) && (
              <NavLink
                to="/audit"
                className="h-8 px-3 rounded-lg text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 transition-colors flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                <span>Audit</span>
              </NavLink>
            )}

            {showApprovalAction && !showRecordAction && (
              <NavLink
                to="/approvals"
                className="h-8 px-3 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-colors flex items-center gap-1.5"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Persetujuan {pendingCount > 0 ? `(${pendingCount})` : ''}</span>
              </NavLink>
            )}

            <div className="h-4 w-px bg-slate-200 mx-1" />

            <NavLink
              to="/profile"
              className="h-8 px-2.5 rounded-lg hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors flex items-center gap-2"
              title="Profil & Kata Sandi"
            >
              <div className="w-6 h-6 rounded-md bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center">
                {currentUser?.full_name.substring(0, 1)}
              </div>
              <span className="max-w-[130px] truncate">{currentUser?.full_name}</span>
            </NavLink>

            <button
              type="button"
              onClick={handleLogout}
              title="Keluar"
              className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Mobile Top Header */}
        <header className="md:hidden bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 px-3.5 h-12 pt-safe flex items-center justify-between w-full">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-white p-0.5 border border-slate-200 flex items-center justify-center shrink-0">
              <img
                src="/assets/aistudio/Logo-HKBP_02090ed7.png"
                alt="Logo HKBP"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-xs text-slate-900 leading-tight truncate">
                {activeNavItem.label}
              </h1>
              <p className="text-[10px] text-slate-500 leading-tight truncate">
                HKBP Hutaraja · T.A. {settings.active_year}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <NavLink
              to="/profile"
              onClick={() => setIsMobileMenuOpen(false)}
              className="min-h-[36px] px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-[11px] font-semibold capitalize flex items-center max-w-[115px] truncate"
            >
              <span className="truncate">{currentUser?.role.replace('_', ' ')}</span>
            </NavLink>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="min-h-[40px] min-w-[40px] text-slate-700 hover:bg-slate-100 rounded-lg flex items-center justify-center active:scale-95 transition-transform"
              aria-label={isMobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Mobile Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-x-0 top-12 bottom-[calc(3.75rem+env(safe-area-inset-bottom,0px))] bg-white z-40 p-4 overflow-y-auto space-y-3 border-b border-slate-200 shadow-xl">
            <div className="grid grid-cols-2 gap-2">
              {showRecordAction ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsTxModalOpen(true);
                    }}
                    className="min-h-[44px] px-3 bg-blue-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Catat Transaksi</span>
                  </button>
                  {showTransferAction && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setIsTransferModalOpen(true);
                      }}
                      className="min-h-[44px] px-3 bg-slate-100 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                    >
                      <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                      <span>Transfer Kas</span>
                    </button>
                  )}
                </>
              ) : isAuditor ? (
                <>
                  <NavLink
                    to="/audit"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="min-h-[44px] px-3 bg-purple-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Modul Audit</span>
                  </NavLink>
                  <NavLink
                    to="/transactions"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="min-h-[44px] px-3 bg-slate-100 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Search className="w-4 h-4" />
                    <span>Uji Bukti</span>
                  </NavLink>
                </>
              ) : isPendeta ? (
                <>
                  <NavLink
                    to="/audit"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="min-h-[44px] px-3 bg-purple-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Badan Audit</span>
                  </NavLink>
                  <NavLink
                    to={showApprovalAction ? '/approvals' : '/reports?tab=semester'}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="min-h-[44px] px-3 bg-slate-100 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    {showApprovalAction ? (
                      <>
                        <CheckSquare className="w-4 h-4 text-amber-600" />
                        <span>Persetujuan {pendingCount > 0 ? `(${pendingCount})` : ''}</span>
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Laporan</span>
                      </>
                    )}
                  </NavLink>
                </>
              ) : showApprovalAction ? (
                <>
                  <NavLink
                    to="/approvals"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="min-h-[44px] px-3 bg-amber-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>Persetujuan {pendingCount > 0 ? `(${pendingCount})` : ''}</span>
                  </NavLink>
                  <NavLink
                    to="/reports?tab=semester"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="min-h-[44px] px-3 bg-slate-100 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Laporan</span>
                  </NavLink>
                </>
              ) : (
                <NavLink
                  to="/reports?tab=semester"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="col-span-2 min-h-[44px] px-3 bg-slate-900 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Laporan Huria</span>
                </NavLink>
              )}
            </div>

            <div className="space-y-1">
              {navItems
                .filter((item) => item.allowed)
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.exact}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={({ isActive }) => {
                        const active = isNavItemActive(item.to, isActive);
                        return `flex items-center justify-between min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs transition-colors ${
                          active ? 'bg-blue-50 text-blue-800 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                        }`;
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-100 text-amber-800 tabular-nums">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <NavLink
                to="/profile"
                onClick={() => setIsMobileMenuOpen(false)}
                className="min-h-[44px] px-3 rounded-xl text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
              >
                <User className="w-4 h-4" />
                <span>Profil Saya</span>
              </NavLink>
              <button
                type="button"
                onClick={handleLogout}
                className="min-h-[44px] px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-xs text-rose-700 flex items-center gap-1.5 font-semibold"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Content Viewport */}
        <main className="flex-1 p-3 sm:p-5 md:p-6 pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:pb-8 w-full max-w-7xl mx-auto min-w-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation (Thumb Zone + Safe Area) */}
      <nav
        aria-label="Navigasi Utama Mobile"
        className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(15,23,42,0.06)] z-30 pb-safe"
      >
        <div className="h-[60px] px-1.5 flex items-center justify-around">
          <NavLink
            to="/"
            end
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center gap-0.5 text-[10px] min-w-[56px] min-h-[48px] px-1 rounded-xl transition-colors active:scale-95 ${
                isActive && !isMobileMenuOpen ? 'text-blue-700 font-semibold' : 'text-slate-500'
              }`
            }
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Beranda</span>
          </NavLink>

          <NavLink
            to="/transactions"
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center gap-0.5 text-[10px] min-w-[56px] min-h-[48px] px-1 rounded-xl transition-colors active:scale-95 ${
                isActive && !isMobileMenuOpen ? 'text-blue-700 font-semibold' : 'text-slate-500'
              }`
            }
          >
            <ReceiptText className="w-5 h-5" />
            <span>Transaksi</span>
          </NavLink>

          {/* Center Role Primary Action */}
          {showRecordAction ? (
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsTxModalOpen(true);
              }}
              className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md shadow-blue-600/25 active:scale-95 transition-transform"
              title="Catat Transaksi"
              aria-label="Catat Transaksi Baru"
            >
              <Plus className="w-5 h-5" />
            </button>
          ) : isAuditor ? (
            <NavLink
              to="/audit"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-12 h-12 rounded-full bg-purple-700 text-white flex items-center justify-center shadow-md active:scale-95 transition-transform"
              title="Modul Audit"
              aria-label="Modul Audit"
            >
              <ShieldCheck className="w-5 h-5" />
            </NavLink>
          ) : showApprovalAction ? (
            <NavLink
              to="/approvals"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-12 h-12 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-md active:scale-95 transition-transform"
              title="Persetujuan"
              aria-label="Antrean Persetujuan"
            >
              <CheckSquare className="w-5 h-5" />
            </NavLink>
          ) : (
            <NavLink
              to={canViewConsolidatedLpj ? '/reports?tab=semester' : '/reports?tab=warta'}
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-12 h-12 rounded-full bg-slate-800 text-white flex items-center justify-center shadow-md active:scale-95 transition-transform"
              title="Laporan"
              aria-label="Buka Laporan"
            >
              <FileSpreadsheet className="w-5 h-5" />
            </NavLink>
          )}

          {isAuditor ? (
            <NavLink
              to="/audit"
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center gap-0.5 text-[10px] min-w-[56px] min-h-[48px] px-1 rounded-xl transition-colors active:scale-95 ${
                  isActive && !isMobileMenuOpen ? 'text-purple-700 font-semibold' : 'text-slate-500'
                }`
              }
            >
              <div className="relative">
                <Shield className="w-5 h-5" />
                {openFindingsCount > 0 && (
                  <span className="absolute -top-1 -right-2 px-1 min-w-[16px] h-4 bg-purple-600 text-white rounded-full text-[9px] flex items-center justify-center font-bold tabular-nums">
                    {openFindingsCount}
                  </span>
                )}
              </div>
              <span>Audit</span>
            </NavLink>
          ) : showApprovalAction ? (
            <NavLink
              to="/approvals"
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center gap-0.5 text-[10px] min-w-[56px] min-h-[48px] px-1 rounded-xl transition-colors active:scale-95 ${
                  isActive && !isMobileMenuOpen ? 'text-blue-700 font-semibold' : 'text-slate-500'
                }`
              }
            >
              <div className="relative">
                <CheckSquare className="w-5 h-5" />
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-2 px-1 min-w-[16px] h-4 bg-amber-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold tabular-nums">
                    {pendingCount}
                  </span>
                )}
              </div>
              <span>Antrean</span>
            </NavLink>
          ) : canViewAuditModule && isPendeta ? (
            <NavLink
              to="/audit"
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center gap-0.5 text-[10px] min-w-[56px] min-h-[48px] px-1 rounded-xl transition-colors active:scale-95 ${
                  isActive && !isMobileMenuOpen ? 'text-purple-700 font-semibold' : 'text-slate-500'
                }`
              }
            >
              <ShieldCheck className="w-5 h-5" />
              <span>Audit</span>
            </NavLink>
          ) : (
            <NavLink
              to={canViewConsolidatedLpj ? '/reports?tab=semester' : canViewWarta ? '/reports?tab=warta' : '/budget'}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center gap-0.5 text-[10px] min-w-[56px] min-h-[48px] px-1 rounded-xl transition-colors active:scale-95 ${
                  isActive && !isMobileMenuOpen ? 'text-blue-700 font-semibold' : 'text-slate-500'
                }`
              }
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span>{canViewConsolidatedLpj ? 'Laporan' : canViewWarta ? 'Warta' : 'APBG'}</span>
            </NavLink>
          )}

          {/* Thumb-reachable Full Menu Drawer Toggle */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className={`relative flex flex-col items-center justify-center gap-0.5 text-[10px] min-w-[56px] min-h-[48px] px-1 rounded-xl transition-colors active:scale-95 ${
              isMobileMenuOpen ? 'text-blue-700 font-semibold' : 'text-slate-500'
            }`}
            aria-label="Semua Menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            <span>Menu</span>
          </button>
        </div>
      </nav>

      {/* Global Modals */}
      <TransactionModal isOpen={isTxModalOpen} onClose={() => setIsTxModalOpen(false)} />
      <TransferModal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} />
    </div>
  );
};
