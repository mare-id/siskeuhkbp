/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ToastProvider } from './context/ToastContext';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { TransactionsPage } from './pages/TransactionsPage';
import BudgetPage from './pages/BudgetPage';
import OpeningBalancePage from './pages/OpeningBalancePage';
import LpjDataPage from './pages/LpjDataPage';
import { ApprovalQueuePage } from './pages/ApprovalQueuePage';
import { ReportsPage } from './pages/ReportsPage';
import { AuditPage } from './pages/AuditPage';
import { PeriodClosingPage } from './pages/PeriodClosingPage';
import { MasterDataPage } from './pages/MasterDataPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { UserGuidePage } from './pages/UserGuidePage';
import { LoginPage } from './pages/LoginPage';
import { AdminTransactionsPage } from './pages/AdminTransactionsPage';
import { PeleanTaonPage } from './pages/PeleanTaonPage';

type PermissionKey =
  | 'canManageBudget'
  | 'canManageOpeningBook'
  | 'canApprove'
  | 'canViewAuditModule'
  | 'canClosePeriod'
  | 'canManageMasterData'
  | 'canViewAuditTrail'
  | 'canManageSettings'
  | 'isAdmin';

const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const auth = useAuth();
  if (auth.loading) {
    return (
      <div className="min-h-screen bg-[#F7F8FC] flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium text-slate-500">Memverifikasi sesi SISKEU HKBP Hutaraja...</p>
        </div>
      </div>
    );
  }
  if (!auth.currentUser) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const PublicOnlyRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const auth = useAuth();
  if (auth.loading) return null;
  if (auth.currentUser) {
    return <Navigate to="/" replace />;
  }
  return children;
};

const RoleGuard: React.FC<{ allow: PermissionKey; children: React.ReactElement }> = ({ allow, children }) => {
  const auth = useAuth();
  if (auth.loading) return null;
  if (!auth.currentUser) return <Navigate to="/login" replace />;
  if (auth.isAdmin || auth[allow]) return children;
  return <Navigate to="/" replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <DataProvider>
            <Routes>
              <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
              
              <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
                <Route index element={<DashboardPage />} />
                <Route path="transactions" element={<TransactionsPage />} />
                <Route path="pelean-taon" element={<PeleanTaonPage />} />
                <Route path="budget" element={<RoleGuard allow="canManageBudget"><BudgetPage /></RoleGuard>} />
                <Route path="opening-balance" element={<RoleGuard allow="canManageOpeningBook"><OpeningBalancePage /></RoleGuard>} />
                <Route path="approvals" element={<RoleGuard allow="canApprove"><ApprovalQueuePage /></RoleGuard>} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="audit" element={<RoleGuard allow="canViewAuditModule"><AuditPage /></RoleGuard>} />
                <Route path="lpj-data" element={<LpjDataPage />} />
                <Route path="closing" element={<RoleGuard allow="canClosePeriod"><PeriodClosingPage /></RoleGuard>} />
                <Route path="master" element={<RoleGuard allow="canManageMasterData"><MasterDataPage /></RoleGuard>} />
                <Route path="admin/transactions" element={<RoleGuard allow="isAdmin"><AdminTransactionsPage /></RoleGuard>} />
                <Route path="audit-logs" element={<RoleGuard allow="canViewAuditTrail"><AuditLogsPage /></RoleGuard>} />
                <Route path="settings" element={<RoleGuard allow="canManageSettings"><SettingsPage /></RoleGuard>} />
                <Route path="guide" element={<UserGuidePage />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </DataProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
