/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  AppSettings,
  AuditLog,
  Budget,
  BudgetItem,
  BudgetRealizationRow,
  BudgetReallocation,
  BudgetStatus,
  Category,
  Kas,
  FundType,
  KasBalanceSummary,
  OpeningBalance,
  OpeningSetup,
  OpeningBalanceEntry,
  OpeningBalanceAdjustment,
  OpeningOtherPosition,
  PriorYearSummary,
  OpeningBookKasStatus,
  PeriodClosing,
  Profile,
  Reconciliation,
  StorageAccount,
  StorageBalanceSummary,
  Transaction,
  TransactionStatus,
  CompoundIncomeAllocationItem,
  SentralisasiExclusionType,
  UserKasAccess,
  FixedAsset,
  FixedAssetCategory,
  FixedAssetStatus,
  FixedAssetCondition,
  AssetDepreciation,
  Advance,
  AdvanceStatus,
  AdvanceSettlement,
  AdvanceSettlementStatus,
  ReceivablePayable,
  ReceivablePayableType,
  ReceivablePayableStatus,
  ReceivablePayablePayment,
  LpjNotes,
  LpjSettings,
  LpjSignatory,
  AuditBodyMember,
  AuditEngagement,
  AuditReview,
  AuditFinding,
  AuditFinalOpinion,
  AuditPersonalOpinion,
  CashCount,
  SemesterReport,
  SemesterReportStatus,
  LpjReport,
  LpjReportStatus,
  LpjException,
  LaporanPosisiKeuanganData,
  LaporanPerubahanSaldoDanaItem,
  LaporanArusKasData,
  AuditPeriodVerification,
  AuditPeriodCode,
  AuditPeriodVerificationStatus,
  AuditFindingSeverity,
  FiscalYear,
  FiscalYearStatus,
  ChurchLingkungan,
  CongregationFamily,
} from '../types/database';
import {
  DEMO_AUDIT_LOGS,
  DEMO_BUDGETS,
  DEMO_BUDGET_ITEMS,
  DEMO_BUDGET_REALLOCATIONS,
  DEMO_CATEGORIES,
  DEMO_KAS,
  DEMO_OPENING_BALANCES,
  DEMO_OPENING_SETUP,
  DEMO_OPENING_ENTRIES,
  DEMO_OPENING_ADJUSTMENTS,
  DEMO_OPENING_OTHER_POSITIONS,
  DEMO_PRIOR_YEAR_SUMMARIES,
  DEMO_PERIOD_CLOSINGS,
  DEMO_PROFILES,
  DEMO_SETTINGS,
  DEMO_STORAGE_ACCOUNTS,
  DEMO_TRANSACTIONS,
  DEMO_USER_KAS_ACCESS,
  DEMO_FIXED_ASSETS,
  DEMO_ADVANCES,
  DEMO_ADVANCE_SETTLEMENTS,
  DEMO_RECEIVABLES_PAYABLES,
  DEMO_LPJ_NOTES,
  DEMO_LPJ_SETTINGS,
  DEMO_AUDIT_BODY_MEMBERS,
  DEMO_AUDIT_ENGAGEMENTS,
  DEMO_AUDIT_REVIEWS,
  DEMO_AUDIT_FINDINGS,
  DEMO_AUDIT_FINAL_OPINIONS,
  DEMO_CASH_COUNTS,
  DEMO_SEMESTER_REPORTS,
  DEMO_LPJ_REPORTS,
  DEMO_LPJ_EXCEPTIONS,
  DEMO_AUDIT_PERIOD_VERIFICATIONS,
  DEMO_FISCAL_YEARS,
  DEMO_LINGKUNGAN,
  DEMO_FAMILIES,
  generateMonthlyDistribution,
} from '../lib/demoData';
import { hashUserPassword } from '../lib/passwordUtils';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  fetchAllDataFromSupabase,
  purgeDomainLocalStorage,
  syncInsert,
  syncUpsert,
  syncUpdate,
  syncDelete,
  syncResetZeroDataInSupabase,
} from '../lib/supabaseSync';
import { formatNamaKeluarga } from '../lib/formatters';
import { useAuth } from './AuthContext';

interface DataContextType {
  kasList: Kas[];
  storageAccounts: StorageAccount[];
  categories: Category[];
  transactions: Transaction[];
  openingBalances: OpeningBalance[];
  periodClosings: PeriodClosing[];
  reconciliations: Reconciliation[];
  auditLogs: AuditLog[];
  settings: AppSettings;
  profiles: Profile[];
  userKasAccessList: UserKasAccess[];
  loading: boolean;

  // Calculators
  getKasBalances: () => KasBalanceSummary[];
  getStorageBalances: () => StorageBalanceSummary[];
  getSentralisasiSummary: (year?: number) => {
    totalPenerimaan: number;
    totalObjekSentralisasi: number;
    totalBpskObligation: number;
    totalHuriaShare: number;
    totalDikecualikan: number;
    totalSosialDuka: number;
    totalBeasiswa: number;
    totalPembangunanLokal: number;
    totalBpskRemitted: number;
    outstandingBpsk: number;
  };
  isPeriodClosed: (year: number, month: number, kasId: string) => boolean;
  getPendingTransactionsCount: (kasId?: string) => number;

  // Actions
  addTransaction: (tx: Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'is_reversal'>) => Promise<{ success: boolean; error?: string }>;
  addCompoundIncomeTransactions: (params: {
    tanggal: string;
    tanggal_warta?: string | null;
    storage_account_id: string;
    category_id?: string | null;
    description: string;
    receipt_no?: string;
    attachment_url?: string | null;
    status: TransactionStatus;
    allocations: CompoundIncomeAllocationItem[];
  }) => Promise<{ success: boolean; error?: string; createdCount?: number }>;
  updateTransaction: (id: string, updates: Partial<Transaction>, reason?: string) => Promise<{ success: boolean; error?: string }>;
  deleteTransaction: (id: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
  changeStatus: (id: string, newStatus: TransactionStatus, rejectNote?: string) => Promise<{ success: boolean; error?: string }>;
  bulkApprove: (ids: string[]) => Promise<{ success: boolean; count: number }>;
  createTransfer: (params: {
    tanggal: string;
    sourceKasId: string;
    sourceStorageId: string;
    targetKasId: string;
    targetStorageId: string;
    amount: number;
    description: string;
    receiptNo?: string;
    attachmentUrl?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  confirmTransferReceipt: (transferId: string) => Promise<{ success: boolean; error?: string }>;
  createReversalTransaction: (originalTxId: string, reason: string) => Promise<{ success: boolean; error?: string }>;

  // Period Closing
  closePeriod: (year: number, month: number, kasId?: string | null) => Promise<{ success: boolean; error?: string }>;
  reopenPeriod: (closingId: string, reason: string) => Promise<{ success: boolean; error?: string }>;

  // Reconciliations
  saveReconciliation: (rec: Omit<Reconciliation, 'id' | 'created_at' | 'discrepancy'>) => Promise<{ success: boolean; error?: string }>;

  // Budget (APBG) State & Operations
  budgets: Budget[];
  budgetItems: BudgetItem[];
  budgetReallocations: BudgetReallocation[];
  saveBudget: (budgetData: Partial<Budget>) => Promise<{ success: boolean; id?: string; error?: string }>;
  deleteBudget: (budgetId: string) => Promise<{ success: boolean; error?: string }>;
  saveBudgetItem: (itemData: Partial<BudgetItem>) => Promise<{ success: boolean; error?: string }>;
  deleteBudgetItem: (itemId: string) => Promise<{ success: boolean; error?: string }>;
  changeBudgetStatus: (
    budgetId: string,
    newStatus: BudgetStatus,
    params?: {
      returnNote?: string;
      rapatDate?: string;
      rapatBeritaAcaraNo?: string;
      rapatDocUrl?: string;
    }
  ) => Promise<{ success: boolean; error?: string }>;
  createBudgetRevision: (sourceBudgetId: string) => Promise<{ success: boolean; newBudgetId?: string; error?: string }>;
  reallocateBudget: (params: {
    budgetId: string;
    fromItemId: string;
    toItemId: string;
    amount: number;
    reason: string;
  }) => Promise<{ success: boolean; error?: string }>;
  copyBudgetFromPreviousYear: (kasId: string, currentYear: number) => Promise<{ success: boolean; count?: number; error?: string }>;
  getBudgetRealization: (kasId: string, year: number, throughMonth: number) => BudgetRealizationRow[];
  getConsolidatedBudgetRealization: (year: number, throughMonth: number) => {
    rows: BudgetRealizationRow[];
    totalBudgetAnnual: number;
    totalBudgetYTD: number;
    totalActualYTD: number;
    totalVariance: number;
  };

  // Opening Book & Balance State & Operations
  openingSetup: OpeningSetup;
  openingEntries: OpeningBalanceEntry[];
  openingAdjustments: OpeningBalanceAdjustment[];
  openingOtherPositions: OpeningOtherPosition[];
  priorYearSummaries: PriorYearSummary[];
  isKasOpeningLocked: (kasId: string) => boolean;
  getOpeningStatusForKas: (kasId: string) => OpeningBookKasStatus;
  saveOpeningEntry: (entry: Partial<OpeningBalanceEntry>) => Promise<{ success: boolean; error?: string }>;
  submitOpeningBook: (kasId: string) => Promise<{ success: boolean; error?: string }>;
  approveOpeningBook: (kasId: string, approve: boolean, returnNote?: string) => Promise<{ success: boolean; error?: string }>;
  lockOpeningBook: (kasId?: string) => Promise<{ success: boolean; count?: number; error?: string }>;
  saveOpeningAdjustment: (adj: Partial<OpeningBalanceAdjustment>) => Promise<{ success: boolean; error?: string }>;
  approveOpeningAdjustment: (adjId: string, approve: boolean, rejectNote?: string) => Promise<{ success: boolean; error?: string }>;
  saveOpeningOtherPosition: (pos: Partial<OpeningOtherPosition>) => Promise<{ success: boolean; error?: string }>;
  deleteOpeningOtherPosition: (id: string) => Promise<{ success: boolean; error?: string }>;
  savePriorYearSummary: (summary: Partial<PriorYearSummary>) => Promise<{ success: boolean; error?: string }>;
  updateOpeningSetup: (setup: Partial<OpeningSetup>) => Promise<{ success: boolean; error?: string }>;

  // Master Data CRUD
  saveKas: (kasData: Partial<Kas>) => Promise<void>;
  deleteKas: (id: string, options?: { force?: boolean; reason?: string }) => Promise<{ success: boolean; error?: string }>;
  saveStorageAccount: (data: Partial<StorageAccount>) => Promise<void>;
  deleteStorageAccount: (
    id: string,
    options?: { force?: boolean; reason?: string }
  ) => Promise<{ success: boolean; error?: string }>;
  saveCategory: (data: Partial<Category>) => Promise<void>;
  saveOpeningBalance: (data: Partial<OpeningBalance>) => Promise<void>;
  saveUserKasAccess: (data: Omit<UserKasAccess, 'id'>) => Promise<{ success: boolean; error?: string }>;
  removeUserKasAccess: (id: string) => Promise<void>;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;

  // Fiscal Years (Tahun Anggaran)
  fiscalYears: FiscalYear[];
  saveFiscalYear: (fyData: Partial<FiscalYear>) => Promise<{ success: boolean; error?: string }>;
  deleteFiscalYear: (id: string) => Promise<{ success: boolean; error?: string }>;
  setActiveFiscalYear: (year: number) => Promise<{ success: boolean; error?: string }>;
  toggleFiscalYearBudgetLock: (year: number) => Promise<{ success: boolean; error?: string }>;
  rollForwardBalancesToYear: (fromYear: number, toYear: number) => Promise<{ success: boolean; count: number; error?: string }>;

  // User Management (Pengguna & Pelayan Gereja HKBP)
  saveProfile: (profileData: Partial<Profile> & { password?: string }) => Promise<{ success: boolean; id?: string; error?: string }>;
  deleteProfile: (id: string) => Promise<{ success: boolean; error?: string }>;
  toggleProfileActive: (id: string) => Promise<{ success: boolean; error?: string }>;

  // Master Data Lingkungan & Keluarga Jemaat (Pelean Taon)
  lingkunganList: ChurchLingkungan[];
  families: CongregationFamily[];
  saveLingkungan: (data: Partial<ChurchLingkungan>) => Promise<{ success: boolean; id?: string; error?: string }>;
  deleteLingkungan: (id: string) => Promise<{ success: boolean; error?: string }>;
  saveFamily: (data: Partial<CongregationFamily>) => Promise<{ success: boolean; id?: string; error?: string }>;
  bulkImportFamilies: (
    rows: Array<{ nama_keluarga: string; lingkungan: string; kepala_keluarga?: string | null; notes?: string | null }>,
    options?: { updateExistingLingkungan?: boolean }
  ) => Promise<{ success: boolean; added: number; updated: number; skipped: number; createdLingkungan: number; error?: string }>;
  deleteFamily: (id: string) => Promise<{ success: boolean; error?: string }>;

  // LPJ Supporting Data (ISAK 35 - Modified Cash Basis)
  fixedAssets: FixedAsset[];
  advances: Advance[];
  advanceSettlements: AdvanceSettlement[];
  receivablesPayables: ReceivablePayable[];
  lpjNotes: LpjNotes;
  lpjSettings: LpjSettings;
  saveFixedAsset: (assetData: Partial<FixedAsset>) => Promise<{ success: boolean; id?: string; error?: string }>;
  deleteFixedAsset: (id: string) => Promise<{ success: boolean; error?: string }>;
  proposeAssetDisposal: (id: string, actionType: 'diajukan_penghapusan' | 'diajukan_hibah', reason: string) => Promise<{ success: boolean; error?: string }>;
  approveAssetDisposal: (id: string, approve: boolean, notes?: string) => Promise<{ success: boolean; error?: string }>;
  calculateDepreciation: (asset: FixedAsset, year: number) => { annualDepreciation: number; accumulatedDepreciation: number; bookValue: number };
  saveAdvance: (advanceData: Partial<Advance>) => Promise<{ success: boolean; id?: string; error?: string }>;
  deleteAdvance: (id: string) => Promise<{ success: boolean; error?: string }>;
  saveAdvanceSettlement: (settlementData: Partial<AdvanceSettlement>) => Promise<{ success: boolean; id?: string; error?: string }>;
  submitAdvanceSettlement: (settlementId: string) => Promise<{ success: boolean; error?: string }>;
  approveAdvanceSettlement: (settlementId: string, approve: boolean, rejectNote?: string) => Promise<{ success: boolean; error?: string }>;
  saveReceivablePayable: (data: Partial<ReceivablePayable>) => Promise<{ success: boolean; id?: string; error?: string }>;
  deleteReceivablePayable: (id: string) => Promise<{ success: boolean; error?: string }>;
  recordReceivablePayablePayment: (id: string, paymentAmount: number, paymentDate: string, storageId?: string, notes?: string) => Promise<{ success: boolean; error?: string }>;
  saveLpjNotes: (notesData: Partial<LpjNotes>) => Promise<{ success: boolean; error?: string }>;
  updateLpjSettings: (newSettings: Partial<LpjSettings>) => Promise<{ success: boolean; error?: string }>;
  updateKasFundType: (kasId: string, fundType: FundType, restrictedPurpose?: string | null) => Promise<{ success: boolean; error?: string }>;
  migrateOpeningPositionsToLpj: () => Promise<{ success: boolean; count?: { assets: number; advances: number; rp: number }; error?: string }>;

  // Badan Audit Huria (Internal Audit Body)
  auditBodyMembers: AuditBodyMember[];
  auditEngagements: AuditEngagement[];
  auditReviews: AuditReview[];
  auditFindings: AuditFinding[];
  auditFinalOpinions: AuditFinalOpinion[];
  cashCounts: CashCount[];
  saveAuditBodyMember: (memberData: Partial<AuditBodyMember>) => Promise<{ success: boolean; error?: string }>;
  removeAuditBodyMember: (id: string) => Promise<{ success: boolean; error?: string }>;
  saveAuditEngagement: (engData: Partial<AuditEngagement>) => Promise<{ success: boolean; id?: string; error?: string }>;
  deleteAuditEngagement: (
    id: string,
    options?: { force?: boolean; reason?: string }
  ) => Promise<{ success: boolean; error?: string }>;
  submitAuditReview: (reviewData: Partial<AuditReview>) => Promise<{ success: boolean; error?: string }>;
  saveAuditFinding: (findingData: Partial<AuditFinding>) => Promise<{ success: boolean; id?: string; error?: string }>;
  respondAuditFinding: (id: string, responseNotes: string) => Promise<{ success: boolean; error?: string }>;
  closeAuditFinding: (id: string, approveClose: boolean, closingNotes: string) => Promise<{ success: boolean; error?: string }>;
  finalizeAuditOpinion: (
    engagementId: string,
    params: {
      beritaAcaraNo: string;
      beritaAcaraDate: string;
      dissentingNotes?: string;
      signatories: { role: string; name: string; signed_at?: string }[];
    }
  ) => Promise<{ success: boolean; opinion?: AuditPersonalOpinion; error?: string }>;
  recordCashCount: (data: Partial<CashCount>) => Promise<{ success: boolean; id?: string; findingId?: string; error?: string }>;

  // Verifikasi Transaksi & Pemeriksaan Berkala Badan Audit Huria (Pasal 7 & 44 AP HKBP)
  verifyTransactionAudit: (
    transactionId: string,
    status: 'unverified' | 'verified' | 'flagged',
    note?: string,
    finding?: { title: string; description: string; severity: AuditFindingSeverity; dueDate?: string }
  ) => Promise<{ success: boolean; error?: string }>;
  auditPeriodVerifications: AuditPeriodVerification[];
  saveAuditPeriodVerification: (data: Partial<AuditPeriodVerification>) => Promise<{ success: boolean; error?: string }>;
  signAuditPeriodVerification: (periodCode: AuditPeriodCode) => Promise<{ success: boolean; error?: string }>;

  // Laporan Semester & LPJ Tahunan (ISAK 35)
  semesterReports: SemesterReport[];
  lpjReports: LpjReport[];
  lpjExceptions: LpjException[];
  evaluateSemesterChecklist: (tahun: number, semester: 1 | 2) => {
    checklist: SemesterReport['checklist_result'];
    passed: boolean;
    blockers: string[];
  };
  runSemesterChecklist: (tahun: number, semester: 1 | 2) => Promise<{
    checklist: SemesterReport['checklist_result'];
    passed: boolean;
    blockers: string[];
  }>;
  lockSemesterSnapshot: (
    reportId: string,
    fallbackPeriod?: { tahun: number; semester: 1 | 2 }
  ) => Promise<{ success: boolean; error?: string; report?: SemesterReport }>;
  unlockSemesterSnapshot: (reportId: string) => Promise<{ success: boolean; error?: string }>;
  forwardSemesterToPastor: (reportId: string, sentRef: string) => Promise<{ success: boolean; error?: string }>;
  acknowledgeSemesterReport: (reportId: string, pastorNote: string) => Promise<{ success: boolean; error?: string }>;
  announceSemesterReport: (reportId: string, medium: 'warta_jemaat' | 'mimbar' | 'papan_pengumuman' | 'lainnya', text: string) => Promise<{ success: boolean; error?: string }>;
  saveSemesterWartaText: (
    reportId: string,
    period: { tahun: number; semester: 1 | 2 },
    announcementText: string
  ) => Promise<{ success: boolean; error?: string; report?: SemesterReport }>;
  returnSemesterReport: (reportId: string, returnNotes: string) => Promise<{ success: boolean; error?: string }>;

  evaluateLpjChecklist: (tahun: number) => {
    checklist: LpjReport['checklist_result'];
    passed: boolean;
    blockers: string[];
  };
  runLpjChecklist: (tahun: number) => Promise<{
    checklist: LpjReport['checklist_result'];
    passed: boolean;
    blockers: string[];
  }>;
  lockLpjSnapshot: (
    lpjId: string,
    fallbackTahun?: number
  ) => Promise<{ success: boolean; error?: string; report?: LpjReport }>;
  unlockLpjSnapshot: (lpjId: string) => Promise<{ success: boolean; error?: string }>;
  submitLpjToMeeting: (lpjId: string, meetingDate: string, meetingRef: string) => Promise<{ success: boolean; error?: string }>;
  approveLpjReport: (lpjId: string, meetingNotes: string, attendeesCount: number) => Promise<{ success: boolean; error?: string }>;
  returnLpjReport: (lpjId: string, returnNotes: string) => Promise<{ success: boolean; error?: string }>;
  grantLpjException: (targetType: 'semester' | 'lpj', targetId: string, ruleCode: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  isYearLockedByLpj: (year: number) => boolean;

  // ISAK 35 Calculation Generators
  getPosisiKeuangan: (year: number) => LaporanPosisiKeuanganData;
  getPerubahanSaldoDana: (year: number) => LaporanPerubahanSaldoDanaItem[];
  getArusKasLangsung: (year: number) => LaporanArusKasData;

  // System Data Reset
  resetAllTransactionsAndBalancesToZero: () => Promise<{ success: boolean; message: string }>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Ensure runtime clean reset on client load (Struktur Pengurus Lengkap, 10 Kas, & Warta Mingguan)
// HANYA berjalan di mode Demo/Lokal. Saat Supabase aktif, seluruh penyimpanan lokal dibersihkan & dinonaktifkan.
const SIKU_CLEAN_RESET_KEY = 'siku_reset_v9_pengurus_sopo_warta';
if (typeof window !== 'undefined') {
  if (isSupabaseConfigured) {
    purgeDomainLocalStorage();
  } else if (!localStorage.getItem(SIKU_CLEAN_RESET_KEY)) {
    purgeDomainLocalStorage();
    localStorage.setItem(SIKU_CLEAN_RESET_KEY, 'true');
  }
}

function readLocalOrDefault<T>(key: string, fallback: T): T {
  if (isSupabaseConfigured || typeof window === 'undefined') return fallback;
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();

  const [kasList, setKasList] = useState<Kas[]>(() => readLocalOrDefault('siku_kas_list', isSupabaseConfigured ? [] : DEMO_KAS));

  const [storageAccounts, setStorageAccounts] = useState<StorageAccount[]>(() =>
    readLocalOrDefault('siku_storage_accounts', isSupabaseConfigured ? [] : DEMO_STORAGE_ACCOUNTS)
  );

  const [categories, setCategories] = useState<Category[]>(() => {
    if (isSupabaseConfigured || typeof window === 'undefined') return isSupabaseConfigured ? [] : DEMO_CATEGORIES;
    const saved = localStorage.getItem('siku_categories');
    if (!saved) return DEMO_CATEGORIES;
    const parsed: Category[] = JSON.parse(saved);
    const demoMap = new Map(DEMO_CATEGORIES.map((c) => [c.id, c]));
    const updated = parsed.map((c) => (demoMap.has(c.id) ? { ...demoMap.get(c.id)!, ...c } : c));
    const existingIds = new Set(updated.map((c) => c.id));
    const additions = DEMO_CATEGORIES.filter((c) => !existingIds.has(c.id));
    return [...updated, ...additions];
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    readLocalOrDefault('siku_transactions', isSupabaseConfigured ? [] : DEMO_TRANSACTIONS)
  );

  const [openingBalances, setOpeningBalances] = useState<OpeningBalance[]>(() =>
    readLocalOrDefault('siku_opening_balances', isSupabaseConfigured ? [] : DEMO_OPENING_BALANCES)
  );

  const [periodClosings, setPeriodClosings] = useState<PeriodClosing[]>(() =>
    readLocalOrDefault('siku_period_closings', isSupabaseConfigured ? [] : DEMO_PERIOD_CLOSINGS)
  );

  const [reconciliations, setReconciliations] = useState<Reconciliation[]>(() =>
    readLocalOrDefault('siku_reconciliations', [])
  );

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() =>
    readLocalOrDefault('siku_audit_logs', isSupabaseConfigured ? [] : DEMO_AUDIT_LOGS)
  );

  const [settings, setSettings] = useState<AppSettings>(() => {
    if (isSupabaseConfigured || typeof window === 'undefined') return DEMO_SETTINGS;
    const saved = localStorage.getItem('siku_settings');
    return saved ? { ...DEMO_SETTINGS, ...JSON.parse(saved) } : DEMO_SETTINGS;
  });

  const [profiles, setProfiles] = useState<Profile[]>(() =>
    readLocalOrDefault('siku_profiles', isSupabaseConfigured ? [] : DEMO_PROFILES)
  );

  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>(() =>
    readLocalOrDefault('siku_fiscal_years', isSupabaseConfigured ? [] : DEMO_FISCAL_YEARS)
  );

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_fiscal_years', JSON.stringify(fiscalYears));
  }, [fiscalYears]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_profiles', JSON.stringify(profiles));
  }, [profiles]);

  const [auditPeriodVerifications, setAuditPeriodVerifications] = useState<AuditPeriodVerification[]>(() =>
    readLocalOrDefault('siku_audit_period_verifications', isSupabaseConfigured ? [] : DEMO_AUDIT_PERIOD_VERIFICATIONS)
  );

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_audit_period_verifications', JSON.stringify(auditPeriodVerifications));
  }, [auditPeriodVerifications]);

  const [userKasAccessList, setUserKasAccessList] = useState<UserKasAccess[]>(() =>
    readLocalOrDefault('siku_user_kas_access', isSupabaseConfigured ? [] : DEMO_USER_KAS_ACCESS)
  );

  // Budget State
  const [budgets, setBudgets] = useState<Budget[]>(() =>
    readLocalOrDefault('siku_budgets', isSupabaseConfigured ? [] : DEMO_BUDGETS)
  );

  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(() =>
    readLocalOrDefault('siku_budget_items', isSupabaseConfigured ? [] : DEMO_BUDGET_ITEMS)
  );

  const [budgetReallocations, setBudgetReallocations] = useState<BudgetReallocation[]>(() =>
    readLocalOrDefault('siku_budget_reallocations', isSupabaseConfigured ? [] : DEMO_BUDGET_REALLOCATIONS)
  );

  // Opening Book & Balance State
  const [openingSetup, setOpeningSetup] = useState<OpeningSetup>(() =>
    readLocalOrDefault('siku_opening_setup', DEMO_OPENING_SETUP)
  );

  const [openingEntries, setOpeningEntries] = useState<OpeningBalanceEntry[]>(() =>
    readLocalOrDefault('siku_opening_entries', isSupabaseConfigured ? [] : DEMO_OPENING_ENTRIES)
  );

  const [openingAdjustments, setOpeningAdjustments] = useState<OpeningBalanceAdjustment[]>(() =>
    readLocalOrDefault('siku_opening_adjustments', isSupabaseConfigured ? [] : DEMO_OPENING_ADJUSTMENTS)
  );

  const [openingOtherPositions, setOpeningOtherPositions] = useState<OpeningOtherPosition[]>(() =>
    readLocalOrDefault('siku_opening_other_positions', isSupabaseConfigured ? [] : DEMO_OPENING_OTHER_POSITIONS)
  );

  const [priorYearSummaries, setPriorYearSummaries] = useState<PriorYearSummary[]>(() =>
    readLocalOrDefault('siku_prior_year_summaries', isSupabaseConfigured ? [] : DEMO_PRIOR_YEAR_SUMMARIES)
  );

  // LPJ Supporting Data State (ISAK 35 - Modified Cash Basis)
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>(() =>
    readLocalOrDefault('siku_fixed_assets', isSupabaseConfigured ? [] : DEMO_FIXED_ASSETS)
  );

  const [advances, setAdvances] = useState<Advance[]>(() =>
    readLocalOrDefault('siku_advances', isSupabaseConfigured ? [] : DEMO_ADVANCES)
  );

  const [advanceSettlements, setAdvanceSettlements] = useState<AdvanceSettlement[]>(() =>
    readLocalOrDefault('siku_advance_settlements', isSupabaseConfigured ? [] : DEMO_ADVANCE_SETTLEMENTS)
  );

  const [receivablesPayables, setReceivablesPayables] = useState<ReceivablePayable[]>(() =>
    readLocalOrDefault('siku_receivables_payables', isSupabaseConfigured ? [] : DEMO_RECEIVABLES_PAYABLES)
  );

  const [lpjNotes, setLpjNotes] = useState<LpjNotes>(() =>
    readLocalOrDefault('siku_lpj_notes', DEMO_LPJ_NOTES)
  );

  const [lpjSettings, setLpjSettings] = useState<LpjSettings>(() =>
    readLocalOrDefault('siku_lpj_settings', DEMO_LPJ_SETTINGS)
  );

  // Badan Audit Huria State
  const [auditBodyMembers, setAuditBodyMembers] = useState<AuditBodyMember[]>(() =>
    readLocalOrDefault('siku_audit_body_members', isSupabaseConfigured ? [] : DEMO_AUDIT_BODY_MEMBERS)
  );

  const [auditEngagements, setAuditEngagements] = useState<AuditEngagement[]>(() =>
    readLocalOrDefault('siku_audit_engagements', isSupabaseConfigured ? [] : DEMO_AUDIT_ENGAGEMENTS)
  );

  const [auditReviews, setAuditReviews] = useState<AuditReview[]>(() =>
    readLocalOrDefault('siku_audit_reviews', isSupabaseConfigured ? [] : DEMO_AUDIT_REVIEWS)
  );

  const [auditFindings, setAuditFindings] = useState<AuditFinding[]>(() =>
    readLocalOrDefault('siku_audit_findings', isSupabaseConfigured ? [] : DEMO_AUDIT_FINDINGS)
  );

  const [auditFinalOpinions, setAuditFinalOpinions] = useState<AuditFinalOpinion[]>(() =>
    readLocalOrDefault('siku_audit_final_opinions', isSupabaseConfigured ? [] : DEMO_AUDIT_FINAL_OPINIONS)
  );

  const [cashCounts, setCashCounts] = useState<CashCount[]>(() =>
    readLocalOrDefault('siku_cash_counts', isSupabaseConfigured ? [] : DEMO_CASH_COUNTS)
  );

  // Laporan Semester & LPJ State
  const [semesterReports, setSemesterReports] = useState<SemesterReport[]>(() =>
    readLocalOrDefault('siku_semester_reports', isSupabaseConfigured ? [] : DEMO_SEMESTER_REPORTS)
  );

  const [lpjReports, setLpjReports] = useState<LpjReport[]>(() =>
    readLocalOrDefault('siku_lpj_reports', isSupabaseConfigured ? [] : DEMO_LPJ_REPORTS)
  );

  const [lpjExceptions, setLpjExceptions] = useState<LpjException[]>(() =>
    readLocalOrDefault('siku_lpj_exceptions', isSupabaseConfigured ? [] : DEMO_LPJ_EXCEPTIONS)
  );

  // Master Lingkungan & Keluarga Jemaat (Pelean Taon)
  const [lingkunganList, setLingkunganList] = useState<ChurchLingkungan[]>(() =>
    readLocalOrDefault('siku_lingkungan', DEMO_LINGKUNGAN)
  );

  const [families, setFamilies] = useState<CongregationFamily[]>(() =>
    readLocalOrDefault('siku_families', isSupabaseConfigured ? [] : DEMO_FAMILIES)
  );

  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);

  // Sync to local storage
  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_audit_body_members', JSON.stringify(auditBodyMembers));
  }, [auditBodyMembers]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_audit_engagements', JSON.stringify(auditEngagements));
  }, [auditEngagements]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_audit_reviews', JSON.stringify(auditReviews));
  }, [auditReviews]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_audit_findings', JSON.stringify(auditFindings));
  }, [auditFindings]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_audit_final_opinions', JSON.stringify(auditFinalOpinions));
  }, [auditFinalOpinions]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_cash_counts', JSON.stringify(cashCounts));
  }, [cashCounts]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_semester_reports', JSON.stringify(semesterReports));
  }, [semesterReports]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_lpj_reports', JSON.stringify(lpjReports));
  }, [lpjReports]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_lpj_exceptions', JSON.stringify(lpjExceptions));
  }, [lpjExceptions]);

  // Sync to local storage
  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_fixed_assets', JSON.stringify(fixedAssets));
  }, [fixedAssets]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_advances', JSON.stringify(advances));
  }, [advances]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_advance_settlements', JSON.stringify(advanceSettlements));
  }, [advanceSettlements]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_receivables_payables', JSON.stringify(receivablesPayables));
  }, [receivablesPayables]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_lpj_notes', JSON.stringify(lpjNotes));
  }, [lpjNotes]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_lpj_settings', JSON.stringify(lpjSettings));
  }, [lpjSettings]);

  // Sync to local storage
  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_opening_setup', JSON.stringify(openingSetup));
  }, [openingSetup]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_opening_entries', JSON.stringify(openingEntries));
  }, [openingEntries]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_opening_adjustments', JSON.stringify(openingAdjustments));
  }, [openingAdjustments]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_opening_other_positions', JSON.stringify(openingOtherPositions));
  }, [openingOtherPositions]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_prior_year_summaries', JSON.stringify(priorYearSummaries));
  }, [priorYearSummaries]);
  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_kas_list', JSON.stringify(kasList));
  }, [kasList]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_storage_accounts', JSON.stringify(storageAccounts));
  }, [storageAccounts]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_opening_balances', JSON.stringify(openingBalances));
  }, [openingBalances]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_period_closings', JSON.stringify(periodClosings));
  }, [periodClosings]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_reconciliations', JSON.stringify(reconciliations));
  }, [reconciliations]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_user_kas_access', JSON.stringify(userKasAccessList));
  }, [userKasAccessList]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_budgets', JSON.stringify(budgets));
  }, [budgets]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_budget_items', JSON.stringify(budgetItems));
  }, [budgetItems]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_budget_reallocations', JSON.stringify(budgetReallocations));
  }, [budgetReallocations]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_lingkungan', JSON.stringify(lingkunganList));
  }, [lingkunganList]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('siku_families', JSON.stringify(families));
  }, [families]);

  // Supabase PostgreSQL Direct Sync & Realtime Subscription
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const applyDataset = (data: NonNullable<Awaited<ReturnType<typeof fetchAllDataFromSupabase>>['data']>) => {
      if (data.kasList) setKasList(data.kasList);
      if (data.storageAccounts) setStorageAccounts(data.storageAccounts);
      if (data.categories) setCategories(data.categories);
      if (data.transactions) setTransactions(data.transactions);
      if (data.openingBalances) setOpeningBalances(data.openingBalances);
      if (data.periodClosings) setPeriodClosings(data.periodClosings);
      if (data.reconciliations) setReconciliations(data.reconciliations);
      if (data.auditLogs) setAuditLogs(data.auditLogs);
      if (data.profiles) setProfiles(data.profiles);
      if (data.userKasAccessList) {
        setUserKasAccessList(data.userKasAccessList);
        window.dispatchEvent(new CustomEvent('siku-user-kas-access-updated', { detail: data.userKasAccessList }));
      }
      if (data.fiscalYears) setFiscalYears(data.fiscalYears);
      if (data.budgets) setBudgets(data.budgets);
      if (data.budgetItems) setBudgetItems(data.budgetItems);
      if (data.budgetReallocations) setBudgetReallocations(data.budgetReallocations);
      if (data.openingSetup) setOpeningSetup(data.openingSetup);
      if (data.openingEntries) setOpeningEntries(data.openingEntries);
      if (data.openingAdjustments) setOpeningAdjustments(data.openingAdjustments);
      if (data.openingOtherPositions) setOpeningOtherPositions(data.openingOtherPositions);
      if (data.priorYearSummaries) setPriorYearSummaries(data.priorYearSummaries);
      if (data.fixedAssets) setFixedAssets(data.fixedAssets);
      if (data.advances) setAdvances(data.advances);
      if (data.advanceSettlements) setAdvanceSettlements(data.advanceSettlements);
      if (data.receivablesPayables) setReceivablesPayables(data.receivablesPayables);
      if (data.lpjNotes) setLpjNotes(data.lpjNotes);
      if (data.lpjSettings) setLpjSettings(data.lpjSettings);
      if (data.auditBodyMembers) setAuditBodyMembers(data.auditBodyMembers);
      if (data.auditEngagements) setAuditEngagements(data.auditEngagements);
      if (data.auditReviews) setAuditReviews(data.auditReviews);
      if (data.auditFindings) setAuditFindings(data.auditFindings);
      if (data.auditFinalOpinions) setAuditFinalOpinions(data.auditFinalOpinions);
      if (data.auditPeriodVerifications) setAuditPeriodVerifications(data.auditPeriodVerifications);
      if (data.cashCounts) setCashCounts(data.cashCounts);
      if (data.semesterReports) setSemesterReports(data.semesterReports);
      if (data.lpjReports) setLpjReports(data.lpjReports);
      if (data.lpjExceptions) setLpjExceptions(data.lpjExceptions);
      if (data.settings) setSettings(data.settings);
      if (data.lingkunganList && data.lingkunganList.length > 0) setLingkunganList(data.lingkunganList);
      if (data.families) setFamilies(data.families);
    };

    const loadDataFromSupabase = async () => {
      setLoading(true);
      try {
        const res = await fetchAllDataFromSupabase();
        if (res.success && res.data) {
          applyDataset(res.data);
        }
      } catch (err) {
        console.error('Failed to load data from Supabase:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDataFromSupabase();

    // Debounced realtime refresh across all public tables
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel('public-db-realtime')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          fetchAllDataFromSupabase().then((res) => {
            if (res.success && res.data) {
              applyDataset(res.data);
            }
          });
        }, 250);
      })
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase?.removeChannel(channel);
    };
  }, []);

  // Check if period is closed
  const isPeriodClosed = (year: number, month: number, kasId: string): boolean => {
    return periodClosings.some(
      (pc) =>
        pc.is_closed &&
        pc.tahun === year &&
        pc.bulan === month &&
        (pc.kas_id === null || pc.kas_id === undefined || pc.kas_id === kasId)
    );
  };

  // Helper to log audit events (persisted directly to Supabase when configured)
  const addAuditLog = (
    tableName: string,
    recordId: string,
    action: string,
    oldData?: any,
    newData?: any,
    notes?: string
  ) => {
    const newLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      table_name: tableName,
      record_id: recordId,
      action,
      old_data: oldData ?? null,
      new_data: newData ?? null,
      changed_by: currentUser?.id || 'system',
      notes: notes || '',
      changed_at: new Date().toISOString(),
      user: currentUser || undefined,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    if (isSupabaseConfigured) {
      void syncInsert('audit_logs', newLog);
    }
  };

  // Calculate official and projected balances for each Kas
  const getKasBalances = (): KasBalanceSummary[] => {
    return kasList.map((k) => {
      // Saldo Awal from opening_balances
      const initial = openingBalances
        .filter((ob) => ob.kas_id === k.id)
        .reduce((sum, item) => sum + Number(item.amount), 0);

      // Approved mutations
      let inc = 0;
      let exp = 0;
      let tfIn = 0;
      let tfOut = 0;

      // Projected (Approved + Submitted)
      let projInc = 0;
      let projExp = 0;
      let projTfIn = 0;
      let projTfOut = 0;

      transactions
        .filter((tx) => tx.kas_id === k.id)
        .forEach((tx) => {
          const amt = Number(tx.amount);
          if (tx.status === 'approved') {
            if (tx.type === 'income') inc += amt;
            if (tx.type === 'expense') exp += amt;
            if (tx.type === 'transfer_in') tfIn += amt;
            if (tx.type === 'transfer_out') tfOut += amt;
          }
          if (tx.status === 'approved' || tx.status === 'submitted') {
            if (tx.type === 'income') projInc += amt;
            if (tx.type === 'expense') projExp += amt;
            if (tx.type === 'transfer_in') projTfIn += amt;
            if (tx.type === 'transfer_out') projTfOut += amt;
          }
        });

      const saldo_resmi = initial + inc - exp + tfIn - tfOut;
      const saldo_proyeksi = initial + projInc - projExp + projTfIn - projTfOut;

      return {
        kas_id: k.id,
        kode: k.kode,
        nama: k.nama,
        warna: k.warna,
        saldo_awal: initial,
        total_pemasukan: inc,
        total_pengeluaran: exp,
        total_transfer_masuk: tfIn,
        total_transfer_keluar: tfOut,
        saldo_resmi,
        saldo_proyeksi,
      };
    });
  };

  // Calculate balances per storage account
  const getStorageBalances = (): StorageBalanceSummary[] => {
    return storageAccounts.map((sa) => {
      const initial = openingBalances
        .filter((ob) => ob.storage_account_id === sa.id)
        .reduce((sum, item) => sum + Number(item.amount), 0);

      let net = 0;
      transactions
        .filter((tx) => tx.storage_account_id === sa.id && tx.status === 'approved')
        .forEach((tx) => {
          const amt = Number(tx.amount);
          if (tx.type === 'income' || tx.type === 'transfer_in') net += amt;
          if (tx.type === 'expense' || tx.type === 'transfer_out') net -= amt;
        });

      return {
        storage_account_id: sa.id,
        nama: sa.nama,
        tipe: sa.tipe,
        nomor_rekening: sa.nomor_rekening,
        atas_nama: sa.atas_nama,
        saldo_awal: initial,
        saldo_saat_ini: initial + net,
      };
    });
  };

  const getPendingTransactionsCount = (kasId?: string): number => {
    return transactions.filter((tx) => {
      if (tx.status !== 'submitted') return false;
      if (kasId && tx.kas_id !== kasId) return false;
      return true;
    }).length;
  };

  // Kalkulator Sentralisasi Keuangan PPKU HKBP (55% Kas Pusat BPSK / 45% Kas Huria Lokal)
  const getSentralisasiSummary = (year?: number) => {
    let filteredTxs = transactions.filter((tx) => tx.status === 'approved');
    if (year) {
      filteredTxs = filteredTxs.filter((tx) => new Date(tx.tanggal).getFullYear() === year);
    }

    let totalPenerimaan = 0;
    let totalObjekSentralisasi = 0;
    let totalBpskObligation = 0;
    let totalHuriaShare = 0;
    let totalDikecualikan = 0;
    let totalSosialDuka = 0;
    let totalBeasiswa = 0;
    let totalPembangunanLokal = 0;
    let totalBpskRemitted = 0;

    filteredTxs.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'income') {
        totalPenerimaan += amt;
        const cat = categories.find((c) => c.id === tx.category_id);
        const isExcluded = tx.is_sentralisasi === false || tx.sentralisasi_role === 'non_sentralisasi';

        if (isExcluded) {
          totalDikecualikan += amt;
          const exType = tx.sentralisasi_exclusion_type || cat?.sentralisasi_exclusion_type;
          if (exType === 'sosial_duka') {
            totalSosialDuka += amt;
          } else if (exType === 'beasiswa') {
            totalBeasiswa += amt;
          } else if (exType === 'pembangunan_lokal') {
            totalPembangunanLokal += amt;
          } else if (exType !== 'transitoris' && exType !== 'lainnya') {
            const nameLower = (cat?.nama || tx.description || '').toLowerCase();
            if (nameLower.includes('sosial') || nameLower.includes('gariana') || cat?.kode?.includes('EX-01')) {
              totalSosialDuka += amt;
            } else if (nameLower.includes('beasiswa') || nameLower.includes('belajar') || cat?.kode?.includes('EX-02')) {
              totalBeasiswa += amt;
            } else if (nameLower.includes('pembangunan') || cat?.kode?.includes('EX-03')) {
              totalPembangunanLokal += amt;
            }
          }
        } else {
          // Objek Sentralisasi (55% Kas Sentralisasi BPSK / 45% Kas Tujuan Huria)
          totalObjekSentralisasi += amt;
          const bpskPart =
            tx.sentralisasi_role === 'huria_share'
              ? 0
              : tx.sentralisasi_role === 'bpsk_share'
              ? amt
              : tx.bpsk_amount !== undefined
              ? Number(tx.bpsk_amount)
              : Math.round(amt * 0.55);
          const huriaPart =
            tx.sentralisasi_role === 'huria_share'
              ? amt
              : tx.sentralisasi_role === 'bpsk_share'
              ? 0
              : tx.huria_amount !== undefined
              ? Number(tx.huria_amount)
              : amt - bpskPart;
          totalBpskObligation += bpskPart;
          totalHuriaShare += huriaPart;
        }
      } else if (tx.type === 'expense') {
        const cat = categories.find((c) => c.id === tx.category_id);
        const isBpskOut =
          cat?.id === 'cat-out-bpsk' ||
          cat?.kode === 'OUT-01' ||
          (cat?.nama || '').toLowerCase().includes('bpsk') ||
          (cat?.nama || '').toLowerCase().includes('sentralisasi ke kas pusat') ||
          (tx.description || '').toLowerCase().includes('bpsk');
        if (isBpskOut) {
          totalBpskRemitted += amt;
        }
      }
    });

    const outstandingBpsk = Math.max(0, totalBpskObligation - totalBpskRemitted);

    return {
      totalPenerimaan,
      totalObjekSentralisasi,
      totalBpskObligation,
      totalHuriaShare,
      totalDikecualikan,
      totalSosialDuka,
      totalBeasiswa,
      totalPembangunanLokal,
      totalBpskRemitted,
      outstandingBpsk,
    };
  };

  // Add transaction
  const isYearLockedByLpj = (year: number): boolean => {
    return lpjReports.some((l) => l.tahun === year && l.status === 'approved');
  };

  const inferExclusionTypeForKas = (
    kasId: string,
    explicit?: SentralisasiExclusionType | null,
    catExclusion?: SentralisasiExclusionType | null
  ): SentralisasiExclusionType => {
    if (explicit) return explicit;
    if (kasId === 'kas-8') return 'transitoris';
    if (kasId === 'kas-2') return 'sosial_duka';
    if (kasId === 'kas-7') return 'pembangunan_lokal';
    return catExclusion || 'lainnya';
  };

  const addTransaction = async (
    txInput: Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'is_reversal'>
  ): Promise<{ success: boolean; error?: string }> => {
    const txDate = new Date(txInput.tanggal);
    const year = txDate.getFullYear();
    const month = txDate.getMonth() + 1;

    // Check LPJ approved lock
    if (isYearLockedByLpj(year)) {
      return {
        success: false,
        error: `Tahun Anggaran ${year} telah disahkan LPJ-nya oleh Rapat Huria dan telah terkunci permanen. Transaksi baru tidak dapat dibuat.`,
      };
    }

    // Check go-live date constraint
    if (openingSetup?.go_live_date && txInput.tanggal < openingSetup.go_live_date) {
      return {
        success: false,
        error: `Tanggal transaksi (${txInput.tanggal}) tidak boleh sebelum Tanggal Mulai Pemakaian aplikasi (${openingSetup.go_live_date}). Seluruh saldo sebelum tanggal ini dicatat sebagai Saldo Pindahan di Pembukaan Buku.`,
      };
    }

    // Check opening balance locked constraint
    const targetKasObj = kasList.find((k) => k.id === txInput.kas_id);
    if (!isKasOpeningLocked(txInput.kas_id)) {
      return {
        success: false,
        error: `Pembukaan buku untuk ${targetKasObj?.nama || 'kas ini'} belum Dikunci (Locked). Selesaikan dan kunci saldo awal kas terlebih dahulu sebelum mencatat transaksi.`,
      };
    }

    // Check closed period
    if (isPeriodClosed(year, month, txInput.kas_id)) {
      return {
        success: false,
        error: `Periode ${month}/${year} untuk kas ini sudah ditutup. Transaksi baru tidak dapat dibuat.`,
      };
    }

    // Check receipt requirement
    if (
      txInput.type === 'expense' &&
      txInput.amount >= settings.receipt_required_threshold &&
      !txInput.attachment_url
    ) {
      return {
        success: false,
        error: `Pengeluaran senilai Rp ${txInput.amount.toLocaleString('id-ID')} melebihi batas Rp ${settings.receipt_required_threshold.toLocaleString('id-ID')} sehingga wajib mengunggah foto nota/bukti.`,
      };
    }

    // Check negative balance if enabled
    if (settings.block_negative_balance && txInput.type === 'expense') {
      const kasBalance = getKasBalances().find((k) => k.kas_id === txInput.kas_id)?.saldo_resmi || 0;
      if (txInput.amount > kasBalance) {
        return {
          success: false,
          error: `Saldo Kas tidak mencukupi (Tersedia: Rp ${kasBalance.toLocaleString('id-ID')}). Pengeluaran tidak boleh membuat saldo negatif.`,
        };
      }
    }

    const cat = categories.find((c) => c.id === txInput.category_id);
    const sentralisasiKas = kasList.find((k) => k.id === 'kas-9' || k.kode === 'KAS-SENTRAL');
    const nowIso = new Date().toISOString();

    if (txInput.type === 'income') {
      // Penentuan Sentralisasi dilakukan langsung pada transaksi (default true jika tidak diset)
      const isSentralisasi =
        txInput.is_sentralisasi !== undefined ? txInput.is_sentralisasi : true;

      // Split automatically 55% to Kas Sentralisasi & 45% to target Kas Huria when sentralisasi is active
      if (isSentralisasi && sentralisasiKas && txInput.kas_id !== sentralisasiKas.id) {
        if (!isKasOpeningLocked(sentralisasiKas.id)) {
          return {
            success: false,
            error: `Pembukaan buku untuk ${sentralisasiKas.nama} (${sentralisasiKas.kode}) belum Dikunci. Kunci saldo awal ${sentralisasiKas.nama} terlebih dahulu karena porsi 55% sentralisasi otomatis masuk ke kas tersebut.`,
          };
        }
        if (isPeriodClosed(year, month, sentralisasiKas.id)) {
          return {
            success: false,
            error: `Periode ${month}/${year} untuk ${sentralisasiKas.nama} sudah ditutup. Transaksi sentralisasi tidak dapat dibuat.`,
          };
        }

        const bpskAmount = Math.round(txInput.amount * 0.55);
        const huriaAmount = txInput.amount - bpskAmount;
        const targetKasNama = targetKasObj?.nama || 'Kas Huria';
        const groupId =
          txInput.allocation_group_id || `alloc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

        const createdTxs: Transaction[] = [];

        if (huriaAmount > 0) {
          createdTxs.push({
            ...txInput,
            id: `tx-${Date.now()}-h-${Math.random().toString(36).substring(2, 6)}`,
            amount: huriaAmount,
            description: `${txInput.description} [45% Bagian Lokal -> ${targetKasNama}]`,
            is_reversal: false,
            is_sentralisasi: true,
            sentralisasi_role: 'huria_share',
            allocation_group_id: groupId,
            bpsk_rate: 0.55,
            huria_rate: 0.45,
            bpsk_amount: 0,
            huria_amount: huriaAmount,
            sentralisasi_exclusion_type: null,
            created_by: currentUser?.id || 'system',
            created_at: nowIso,
            updated_at: nowIso,
          });
        }

        if (bpskAmount > 0) {
          createdTxs.push({
            ...txInput,
            id: `tx-${Date.now()}-s-${Math.random().toString(36).substring(2, 6)}`,
            kas_id: sentralisasiKas.id,
            amount: bpskAmount,
            description: `${txInput.description} [55% Otomatis Sentralisasi dari ${targetKasNama}]`,
            is_reversal: false,
            is_sentralisasi: true,
            sentralisasi_role: 'bpsk_share',
            allocation_group_id: groupId,
            bpsk_rate: 0.55,
            huria_rate: 0.45,
            bpsk_amount: bpskAmount,
            huria_amount: 0,
            sentralisasi_exclusion_type: null,
            created_by: currentUser?.id || 'system',
            created_at: nowIso,
            updated_at: nowIso,
          });
        }

        setTransactions((prev) => [...createdTxs, ...prev]);
        if (isSupabaseConfigured) {
          await syncInsert('transactions', createdTxs);
        }
        addAuditLog(
          'transactions',
          groupId,
          'INSERT_SENTRALISASI_SPLIT',
          null,
          { groupId, huriaAmount, bpskAmount, targetKasId: txInput.kas_id },
          `Penerimaan sentralisasi Rp ${txInput.amount.toLocaleString('id-ID')} otomatis dibagi 45% (${targetKasNama}) & 55% (${sentralisasiKas.nama}) oleh ${currentUser?.full_name}`
        );
        return { success: true };
      }

      // Single-row income (non-sentralisasi OR direct into kas-9)
      const bpskAmount = isSentralisasi ? Math.round(txInput.amount * 0.55) : 0;
      const huriaAmount = isSentralisasi ? txInput.amount - bpskAmount : txInput.amount;
      const exclusionType = isSentralisasi
        ? null
        : inferExclusionTypeForKas(txInput.kas_id, txInput.sentralisasi_exclusion_type, cat?.sentralisasi_exclusion_type);

      const newTx: Transaction = {
        ...txInput,
        id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        is_reversal: false,
        is_sentralisasi: isSentralisasi,
        sentralisasi_role: isSentralisasi ? 'bpsk_share' : 'non_sentralisasi',
        bpsk_rate: isSentralisasi ? 0.55 : 0,
        huria_rate: isSentralisasi ? 0.45 : 1.0,
        bpsk_amount: bpskAmount,
        huria_amount: huriaAmount,
        sentralisasi_exclusion_type: exclusionType,
        created_by: currentUser?.id || 'system',
        created_at: nowIso,
        updated_at: nowIso,
      };

      setTransactions((prev) => [newTx, ...prev]);
      if (isSupabaseConfigured) {
        await syncInsert('transactions', newTx);
      }
      addAuditLog('transactions', newTx.id, 'INSERT', null, newTx, `Transaksi baru dibuat oleh ${currentUser?.full_name}`);
      return { success: true };
    }

    // Expense or other transaction types
    const newTx: Transaction = {
      ...txInput,
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      is_reversal: false,
      is_sentralisasi: false,
      created_by: currentUser?.id || 'system',
      created_at: nowIso,
      updated_at: nowIso,
    };

    setTransactions((prev) => [newTx, ...prev]);
    if (isSupabaseConfigured) {
      await syncInsert('transactions', newTx);
    }
    addAuditLog('transactions', newTx.id, 'INSERT', null, newTx, `Transaksi baru dibuat oleh ${currentUser?.full_name}`);
    return { success: true };
  };

  // Record compound multi-kas income (e.g., Ucapan Syukur divided into Huria 55/45, Pembangunan 100%, Sosial 100%, Transitoris 100%)
  const addCompoundIncomeTransactions = async (params: {
    tanggal: string;
    tanggal_warta?: string | null;
    storage_account_id: string;
    category_id?: string | null;
    description: string;
    receipt_no?: string;
    attachment_url?: string | null;
    status: TransactionStatus;
    allocations: CompoundIncomeAllocationItem[];
  }): Promise<{ success: boolean; error?: string; createdCount?: number }> => {
    const { tanggal, tanggal_warta, storage_account_id, category_id, description, receipt_no, attachment_url, status, allocations } = params;

    if (!allocations || allocations.length === 0) {
      return { success: false, error: 'Tambahkan minimal 1 baris alokasi kas tujuan.' };
    }

    const txDate = new Date(tanggal);
    const year = txDate.getFullYear();
    const month = txDate.getMonth() + 1;

    if (isYearLockedByLpj(year)) {
      return {
        success: false,
        error: `Tahun Anggaran ${year} telah disahkan LPJ-nya oleh Rapat Huria dan telah terkunci permanen. Transaksi baru tidak dapat dibuat.`,
      };
    }

    if (openingSetup?.go_live_date && tanggal < openingSetup.go_live_date) {
      return {
        success: false,
        error: `Tanggal transaksi (${tanggal}) tidak boleh sebelum Tanggal Mulai Pemakaian aplikasi (${openingSetup.go_live_date}).`,
      };
    }

    const sentralisasiKas = kasList.find((k) => k.id === 'kas-9' || k.kode === 'KAS-SENTRAL');
    const involvedKasIds = new Set<string>();

    for (const item of allocations) {
      if (!item.kas_id) {
        return { success: false, error: 'Semua baris alokasi wajib memilih Kas Tujuan.' };
      }
      if (!item.amount || item.amount <= 0) {
        return { success: false, error: 'Semua nominal alokasi harus lebih besar dari Rp 0.' };
      }
      involvedKasIds.add(item.kas_id);
      if (item.is_sentralisasi && sentralisasiKas && item.kas_id !== sentralisasiKas.id) {
        involvedKasIds.add(sentralisasiKas.id);
      }
    }

    for (const kId of involvedKasIds) {
      const kObj = kasList.find((k) => k.id === kId);
      if (!isKasOpeningLocked(kId)) {
        return {
          success: false,
          error: `Pembukaan buku untuk ${kObj?.nama || kId} belum Dikunci. Kunci saldo awal seluruh kas terkait terlebih dahulu.`,
        };
      }
      if (isPeriodClosed(year, month, kId)) {
        return {
          success: false,
          error: `Periode ${month}/${year} untuk ${kObj?.nama || kId} sudah ditutup.`,
        };
      }
    }

    const cat = categories.find((c) => c.id === category_id);
    const groupId = `alloc-multi-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();
    const createdTxs: Transaction[] = [];

    allocations.forEach((item, idx) => {
      const kObj = kasList.find((k) => k.id === item.kas_id);
      const targetKasNama = kObj?.nama || 'Kas Huria';
      const subLabel = item.sub_description?.trim();
      const baseDesc = subLabel ? `${description.trim()} — ${subLabel}` : `${description.trim()} (${targetKasNama})`;
      const rowReceipt = receipt_no?.trim() ? receipt_no.trim() : undefined;

      if (item.is_sentralisasi && sentralisasiKas && item.kas_id !== sentralisasiKas.id) {
        const bpskAmount = Math.round(item.amount * 0.55);
        const huriaAmount = item.amount - bpskAmount;

        if (huriaAmount > 0) {
          createdTxs.push({
            id: `tx-${Date.now()}-${idx}h-${Math.random().toString(36).substring(2, 6)}`,
            tanggal,
            tanggal_warta: tanggal_warta || null,
            kas_id: item.kas_id,
            storage_account_id,
            category_id: category_id || null,
            type: 'income',
            amount: huriaAmount,
            description: `${baseDesc} [45% Bagian Lokal -> ${targetKasNama}]`,
            receipt_no: rowReceipt,
            attachment_url: attachment_url || null,
            status,
            is_reversal: false,
            is_sentralisasi: true,
            sentralisasi_role: 'huria_share',
            allocation_group_id: groupId,
            bpsk_rate: 0.55,
            huria_rate: 0.45,
            bpsk_amount: 0,
            huria_amount: huriaAmount,
            sentralisasi_exclusion_type: null,
            created_by: currentUser?.id || 'system',
            created_at: nowIso,
            updated_at: nowIso,
          });
        }

        if (bpskAmount > 0) {
          createdTxs.push({
            id: `tx-${Date.now()}-${idx}s-${Math.random().toString(36).substring(2, 6)}`,
            tanggal,
            tanggal_warta: tanggal_warta || null,
            kas_id: sentralisasiKas.id,
            storage_account_id,
            category_id: category_id || null,
            type: 'income',
            amount: bpskAmount,
            description: `${baseDesc} [55% Otomatis Sentralisasi dari ${targetKasNama}]`,
            receipt_no: rowReceipt,
            attachment_url: attachment_url || null,
            status,
            is_reversal: false,
            is_sentralisasi: true,
            sentralisasi_role: 'bpsk_share',
            allocation_group_id: groupId,
            bpsk_rate: 0.55,
            huria_rate: 0.45,
            bpsk_amount: bpskAmount,
            huria_amount: 0,
            sentralisasi_exclusion_type: null,
            created_by: currentUser?.id || 'system',
            created_at: nowIso,
            updated_at: nowIso,
          });
        }
      } else {
        const isSent = item.is_sentralisasi;
        const bpskAmount = isSent ? Math.round(item.amount * 0.55) : 0;
        const huriaAmount = isSent ? item.amount - bpskAmount : item.amount;
        const exclusionType = isSent
          ? null
          : inferExclusionTypeForKas(item.kas_id, item.exclusion_type, cat?.sentralisasi_exclusion_type);

        createdTxs.push({
          id: `tx-${Date.now()}-${idx}d-${Math.random().toString(36).substring(2, 6)}`,
          tanggal,
          tanggal_warta: tanggal_warta || null,
          kas_id: item.kas_id,
          storage_account_id,
          category_id: category_id || null,
          type: 'income',
          amount: item.amount,
          description: isSent
            ? baseDesc
            : `${baseDesc} [100% ${exclusionType === 'transitoris' ? 'Transitoris' : 'Non-Sentralisasi'} -> ${targetKasNama}]`,
          receipt_no: rowReceipt,
          attachment_url: attachment_url || null,
          status,
          is_reversal: false,
          is_sentralisasi: isSent,
          sentralisasi_role: isSent ? 'bpsk_share' : 'non_sentralisasi',
          allocation_group_id: groupId,
          bpsk_rate: isSent ? 0.55 : 0,
          huria_rate: isSent ? 0.45 : 1.0,
          bpsk_amount: bpskAmount,
          huria_amount: huriaAmount,
          sentralisasi_exclusion_type: exclusionType,
          created_by: currentUser?.id || 'system',
          created_at: nowIso,
          updated_at: nowIso,
        });
      }
    });

    setTransactions((prev) => [...createdTxs, ...prev]);
    if (isSupabaseConfigured) {
      await syncInsert('transactions', createdTxs);
    }
    const grandTotal = allocations.reduce((s, a) => s + Number(a.amount || 0), 0);
    addAuditLog(
      'transactions',
      groupId,
      'INSERT_COMPOUND_INCOME',
      null,
      { groupId, grandTotal, allocationsCount: allocations.length, createdCount: createdTxs.length },
      `Penerimaan rincian gabungan Rp ${grandTotal.toLocaleString('id-ID')} (${allocations.length} pos alokasi -> ${createdTxs.length} baris buku kas) dibuat oleh ${currentUser?.full_name}`
    );

    return { success: true, createdCount: createdTxs.length };
  };

  // Update transaction (draft/submitted for officers, any status for Admin)
  const updateTransaction = async (
    id: string,
    updates: Partial<Transaction>,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const existing = transactions.find((t) => t.id === id);
    if (!existing) return { success: false, error: 'Transaksi tidak ditemukan.' };

    const isUserAdmin = currentUser?.role === 'admin';
    const existingYear = new Date(existing.tanggal).getFullYear();
    const targetYear = updates.tanggal ? new Date(updates.tanggal).getFullYear() : existingYear;

    if (isYearLockedByLpj(existingYear) || isYearLockedByLpj(targetYear)) {
      return {
        success: false,
        error: `Tahun Anggaran ${isYearLockedByLpj(existingYear) ? existingYear : targetYear} telah disahkan LPJ-nya oleh Rapat Huria dan telah terkunci permanen. Transaksi tidak dapat diubah.`,
      };
    }

    if (existing.status === 'approved' && !isUserAdmin) {
      return {
        success: false,
        error: 'Transaksi yang sudah Disetujui tidak dapat diubah secara langsung. Gunakan menu Koreksi/Pembalik atau hubungi Admin.',
      };
    }

    let computedSentralisasi: Partial<Transaction> = {};
    const finalType = updates.type || existing.type;
    const finalAmount = updates.amount !== undefined ? Number(updates.amount) : Number(existing.amount);
    const finalKasId = updates.kas_id || existing.kas_id;
    const finalCatId = updates.category_id !== undefined ? updates.category_id : existing.category_id;
    const finalRole = updates.sentralisasi_role !== undefined ? updates.sentralisasi_role : existing.sentralisasi_role;

    if (finalType === 'income') {
      const cat = categories.find((c) => c.id === finalCatId);
      const isSent =
        updates.is_sentralisasi !== undefined
          ? updates.is_sentralisasi
          : existing.is_sentralisasi !== undefined
          ? existing.is_sentralisasi
          : true;

      if (!isSent) {
        computedSentralisasi = {
          is_sentralisasi: false,
          sentralisasi_role: 'non_sentralisasi',
          bpsk_rate: 0,
          huria_rate: 1.0,
          bpsk_amount: 0,
          huria_amount: finalAmount,
          sentralisasi_exclusion_type: inferExclusionTypeForKas(
            finalKasId,
            updates.sentralisasi_exclusion_type !== undefined
              ? updates.sentralisasi_exclusion_type
              : existing.sentralisasi_exclusion_type,
            cat?.sentralisasi_exclusion_type
          ),
        };
      } else if (finalRole === 'huria_share') {
        computedSentralisasi = {
          is_sentralisasi: true,
          sentralisasi_role: 'huria_share',
          bpsk_rate: 0.55,
          huria_rate: 0.45,
          bpsk_amount: 0,
          huria_amount: finalAmount,
          sentralisasi_exclusion_type: null,
        };
      } else if (finalRole === 'bpsk_share') {
        computedSentralisasi = {
          is_sentralisasi: true,
          sentralisasi_role: 'bpsk_share',
          bpsk_rate: 0.55,
          huria_rate: 0.45,
          bpsk_amount: finalAmount,
          huria_amount: 0,
          sentralisasi_exclusion_type: null,
        };
      } else {
        const bpsk = Math.round(finalAmount * 0.55);
        computedSentralisasi = {
          is_sentralisasi: true,
          sentralisasi_role: null,
          bpsk_rate: 0.55,
          huria_rate: 0.45,
          bpsk_amount: bpsk,
          huria_amount: finalAmount - bpsk,
          sentralisasi_exclusion_type: null,
        };
      }
    } else {
      computedSentralisasi = {
        is_sentralisasi: false,
        sentralisasi_role: null,
        bpsk_rate: 0,
        huria_rate: 1.0,
        bpsk_amount: 0,
        huria_amount: 0,
        sentralisasi_exclusion_type: null,
      };
    }

    const nextStatus = updates.status || existing.status;
    const statusPatch: Partial<Transaction> = {};
    if (updates.status !== undefined) {
      if (nextStatus === 'approved') {
        statusPatch.approved_by = existing.approved_by || currentUser?.id || null;
        statusPatch.approved_at = existing.approved_at || new Date().toISOString();
        statusPatch.reject_note = null;
      } else if (nextStatus === 'rejected') {
        statusPatch.reject_note = updates.reject_note ?? existing.reject_note ?? 'Ditolak oleh Admin';
      } else {
        statusPatch.reject_note = null;
      }
    }

    const mergedUpdates: Partial<Transaction> = {
      ...updates,
      ...computedSentralisasi,
      ...statusPatch,
      amount: finalAmount,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      const syncRes = await syncUpdate('transactions', mergedUpdates, 'id', id);
      if (!syncRes.success) {
        return {
          success: false,
          error: syncRes.error || 'Gagal menyimpan perubahan transaksi ke Supabase.',
        };
      }
    }

    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...mergedUpdates } : t))
    );

    const noteDetail = reason?.trim()
      ? `Transaksi diubah oleh ${currentUser?.full_name || 'Admin'} (${reason.trim()})`
      : `Transaksi diubah oleh ${currentUser?.full_name || 'Admin'}`;
    addAuditLog('transactions', id, 'UPDATE', existing, { ...existing, ...mergedUpdates }, noteDetail);
    return { success: true };
  };

  // Delete transaction (draft for officers, any status for Admin)
  const deleteTransaction = async (id: string, reason?: string): Promise<{ success: boolean; error?: string }> => {
    const existing = transactions.find((t) => t.id === id);
    if (!existing) return { success: false, error: 'Transaksi tidak ditemukan.' };

    const isUserAdmin = currentUser?.role === 'admin';
    const txYear = new Date(existing.tanggal).getFullYear();
    if (isYearLockedByLpj(txYear)) {
      return {
        success: false,
        error: `Tahun Anggaran ${txYear} telah disahkan LPJ-nya oleh Rapat Huria dan telah terkunci permanen. Transaksi tidak dapat dihapus.`,
      };
    }

    if (existing.status === 'approved' && !isUserAdmin) {
      return { success: false, error: 'Transaksi yang sudah Disetujui tidak boleh dihapus.' };
    }

    if (isSupabaseConfigured) {
      const syncRes = await syncDelete('transactions', 'id', id);
      if (!syncRes.success) {
        return {
          success: false,
          error: syncRes.error || 'Gagal menghapus transaksi dari Supabase.',
        };
      }
    }

    setTransactions((prev) => prev.filter((t) => t.id !== id));

    const noteDetail = reason?.trim()
      ? `Transaksi dihapus oleh ${currentUser?.full_name || 'Admin'} (${reason.trim()})`
      : `Transaksi dihapus oleh ${currentUser?.full_name || 'Admin'}`;
    addAuditLog('transactions', id, 'DELETE', existing, null, noteDetail);
    return { success: true };
  };

  // Change status (Approve / Reject / Draft recall)
  const changeStatus = async (
    id: string,
    newStatus: TransactionStatus,
    rejectNote?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return { success: false, error: 'Transaksi tidak ditemukan.' };

    // Submitter cannot approve their own transaction
    if (newStatus === 'approved' && tx.created_by === currentUser?.id) {
      return {
        success: false,
        error: 'Penginput transaksi tidak boleh menyetujui transaksinya sendiri. Persetujuan harus dilakukan oleh Ketua Kas terkait.',
      };
    }

    // Rejection requires note
    if (newStatus === 'rejected' && (!rejectNote || rejectNote.trim() === '')) {
      return { success: false, error: 'Penolakan transaksi wajib menyertakan alasan/catatan penolakan.' };
    }

    const updatedTx: Transaction = {
      ...tx,
      status: newStatus,
      approved_by: newStatus === 'approved' ? currentUser?.id : tx.approved_by,
      approved_at: newStatus === 'approved' ? new Date().toISOString() : tx.approved_at,
      reject_note: newStatus === 'rejected' ? rejectNote : null,
      updated_at: new Date().toISOString(),
    };

    setTransactions((prev) => {
      return prev.map((item) => {
        if (item.id === id) return updatedTx;
        // If transfer in the same kas, update the paired side too
        if (tx.transfer_id && item.transfer_id === tx.transfer_id && item.kas_id === tx.kas_id) {
          return {
            ...item,
            status: newStatus,
            approved_by: newStatus === 'approved' ? currentUser?.id : item.approved_by,
            approved_at: newStatus === 'approved' ? new Date().toISOString() : item.approved_at,
            reject_note: newStatus === 'rejected' ? rejectNote : null,
            updated_at: new Date().toISOString(),
          };
        }
        return item;
      });
    });

    if (isSupabaseConfigured) {
      const patch = {
        status: newStatus,
        approved_by: updatedTx.approved_by,
        approved_at: updatedTx.approved_at,
        reject_note: updatedTx.reject_note,
        updated_at: updatedTx.updated_at,
      };
      await syncUpdate('transactions', patch, 'id', id);
      if (tx.transfer_id && supabase) {
        await supabase
          .from('transactions')
          .update(patch)
          .eq('transfer_id', tx.transfer_id)
          .eq('kas_id', tx.kas_id)
          .neq('id', id);
      }
    }

    addAuditLog(
      'transactions',
      id,
      'STATUS_CHANGE',
      { status: tx.status },
      { status: newStatus, reject_note: rejectNote },
      `Status diubah menjadi ${newStatus} oleh ${currentUser?.full_name}`
    );

    return { success: true };
  };

  // Bulk Approve
  const bulkApprove = async (ids: string[]): Promise<{ success: boolean; count: number }> => {
    const approvableIds = transactions
      .filter((tx) => ids.includes(tx.id) && tx.status === 'submitted' && tx.created_by !== currentUser?.id)
      .map((tx) => tx.id);
    const count = approvableIds.length;
    const nowIso = new Date().toISOString();

    setTransactions((prev) =>
      prev.map((tx) => {
        if (approvableIds.includes(tx.id)) {
          return {
            ...tx,
            status: 'approved',
            approved_by: currentUser?.id,
            approved_at: nowIso,
            updated_at: nowIso,
          };
        }
        return tx;
      })
    );
    if (isSupabaseConfigured && supabase && approvableIds.length > 0) {
      await supabase
        .from('transactions')
        .update({
          status: 'approved',
          approved_by: currentUser?.id,
          approved_at: nowIso,
          updated_at: nowIso,
        })
        .in('id', approvableIds);
    }
    addAuditLog('transactions', 'bulk', 'BULK_APPROVE', null, { ids: approvableIds, count }, `${count} transaksi disetujui massal`);
    return { success: true, count };
  };

  // Atomic Transfer
  const createTransfer = async (params: {
    tanggal: string;
    sourceKasId: string;
    sourceStorageId: string;
    targetKasId: string;
    targetStorageId: string;
    amount: number;
    description: string;
    receiptNo?: string;
    attachmentUrl?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    const {
      tanggal,
      sourceKasId,
      sourceStorageId,
      targetKasId,
      targetStorageId,
      amount,
      description,
      receiptNo,
      attachmentUrl,
    } = params;

    if (amount <= 0) return { success: false, error: 'Nominal transfer harus lebih dari 0.' };

    if (openingSetup?.go_live_date && tanggal < openingSetup.go_live_date) {
      return {
        success: false,
        error: `Tanggal transfer (${tanggal}) tidak boleh sebelum Tanggal Mulai Pemakaian aplikasi (${openingSetup.go_live_date}).`,
      };
    }

    if (!isKasOpeningLocked(sourceKasId)) {
      return {
        success: false,
        error: `Kas pengirim belum Dikunci pembukaan bukunya. Selesaikan pembukaan buku terlebih dahulu.`,
      };
    }

    if (!isKasOpeningLocked(targetKasId)) {
      return {
        success: false,
        error: `Kas penerima transfer belum Dikunci pembukaan bukunya. Selesaikan pembukaan buku terlebih dahulu.`,
      };
    }

    const isSameKas = sourceKasId === targetKasId;
    const transferId = `tf-pair-${Date.now()}`;
    const initialStatus: TransactionStatus = 'submitted';

    const txOut: Transaction = {
      id: `tx-out-${Date.now()}`,
      tanggal,
      kas_id: sourceKasId,
      storage_account_id: sourceStorageId,
      type: 'transfer_out',
      amount,
      description: `${description} (Transfer Keluar)`,
      receipt_no: receiptNo ? `${receiptNo}-OUT` : undefined,
      attachment_url: attachmentUrl,
      status: initialStatus,
      transfer_id: transferId,
      transfer_target_kas_id: targetKasId,
      transfer_target_storage_id: targetStorageId,
      created_by: currentUser?.id,
      is_reversal: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const txIn: Transaction = {
      id: `tx-in-${Date.now() + 1}`,
      tanggal,
      kas_id: targetKasId,
      storage_account_id: targetStorageId,
      type: 'transfer_in',
      amount,
      description: `${description} (Transfer Masuk)`,
      receipt_no: receiptNo ? `${receiptNo}-IN` : undefined,
      attachment_url: attachmentUrl,
      status: initialStatus,
      transfer_id: transferId,
      transfer_target_kas_id: sourceKasId,
      transfer_target_storage_id: sourceStorageId,
      created_by: currentUser?.id,
      is_reversal: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setTransactions((prev) => [txOut, txIn, ...prev]);
    if (isSupabaseConfigured) {
      await syncInsert('transactions', [txOut, txIn]);
    }
    addAuditLog('transactions', transferId, 'TRANSFER_CREATED', null, { txOut, txIn }, `Transfer dana diajukan`);
    return { success: true };
  };

  // Confirm transfer receipt by recipient ketua
  const confirmTransferReceipt = async (transferId: string): Promise<{ success: boolean; error?: string }> => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.transfer_id === transferId) {
          return {
            ...t,
            status: 'approved',
            transfer_confirmed_by: currentUser?.id,
            transfer_confirmed_at: new Date().toISOString(),
            approved_by: currentUser?.id,
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }
        return t;
      })
    );
    if (isSupabaseConfigured) {
      await syncUpdate(
        'transactions',
        {
          status: 'approved',
          transfer_confirmed_by: currentUser?.id,
          transfer_confirmed_at: new Date().toISOString(),
          approved_by: currentUser?.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        'transfer_id',
        transferId
      );
    }
    addAuditLog('transactions', transferId, 'TRANSFER_CONFIRMED', null, { transferId }, `Transfer dikonfirmasi penerimaannya`);
    return { success: true };
  };

  // Create Reversal Transaction for Approved Record
  const createReversalTransaction = async (
    originalTxId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> => {
    const original = transactions.find((t) => t.id === originalTxId);
    if (!original) return { success: false, error: 'Transaksi asli tidak ditemukan.' };

    const reverseType =
      original.type === 'income'
        ? 'expense'
        : original.type === 'expense'
        ? 'income'
        : original.type === 'transfer_out'
        ? 'transfer_in'
        : 'transfer_out';

    const reversalTx: Transaction = {
      id: `tx-rev-${Date.now()}`,
      tanggal: new Date().toISOString().split('T')[0],
      kas_id: original.kas_id,
      storage_account_id: original.storage_account_id,
      category_id: original.category_id,
      type: reverseType,
      amount: original.amount,
      description: `[KOREKSI/PEMBALIK] ${original.description}. Alasan: ${reason}`,
      receipt_no: `KOR-${original.receipt_no || original.id.substring(0, 8)}`,
      status: 'approved', // Reversals are directly approved corrections
      is_sentralisasi: original.is_sentralisasi,
      sentralisasi_role: original.sentralisasi_role,
      allocation_group_id: original.allocation_group_id,
      bpsk_amount: original.bpsk_amount,
      huria_amount: original.huria_amount,
      sentralisasi_exclusion_type: original.sentralisasi_exclusion_type,
      reverses_id: original.id,
      is_reversal: true,
      created_by: currentUser?.id,
      approved_by: currentUser?.id,
      approved_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setTransactions((prev) => [reversalTx, ...prev]);
    if (isSupabaseConfigured) {
      await syncInsert('transactions', reversalTx);
    }
    addAuditLog('transactions', reversalTx.id, 'REVERSAL_CREATED', original, reversalTx, `Transaksi koreksi pembalik dibuat`);
    return { success: true };
  };

  // Close period
  const closePeriod = async (
    year: number,
    month: number,
    kasId?: string | null
  ): Promise<{ success: boolean; error?: string }> => {
    // Check if any draft or submitted transactions remain
    const unapproved = transactions.filter((tx) => {
      const d = new Date(tx.tanggal);
      return (
        d.getFullYear() === year &&
        d.getMonth() + 1 === month &&
        (kasId ? tx.kas_id === kasId : true) &&
        (tx.status === 'draft' || tx.status === 'submitted')
      );
    });

    if (unapproved.length > 0) {
      return {
        success: false,
        error: `Masih ada ${unapproved.length} transaksi berstatus Draft atau Diajukan pada periode ini. Harap setujui/tolak/hapus sebelum menutup buku.`,
      };
    }

    const newClosing: PeriodClosing = {
      id: `pc-${Date.now()}`,
      tahun: year,
      bulan: month,
      kas_id: kasId || null,
      is_closed: true,
      closed_by: currentUser?.id,
      closed_at: new Date().toISOString(),
    };

    setPeriodClosings((prev) => [newClosing, ...prev]);
    if (isSupabaseConfigured) {
      await syncInsert('period_closings', newClosing);
    }
    addAuditLog('period_closings', newClosing.id, 'PERIOD_CLOSED', null, newClosing, `Periode ${month}/${year} ditutup`);
    return { success: true };
  };

  // Reopen period
  const reopenPeriod = async (closingId: string, reason: string): Promise<{ success: boolean; error?: string }> => {
    if (!reason || reason.trim() === '') {
      return { success: false, error: 'Alasan pembukaan kembali buku wajib diisi untuk audit log.' };
    }

    const reopenedAt = new Date().toISOString();
    setPeriodClosings((prev) =>
      prev.map((pc) =>
        pc.id === closingId
          ? {
              ...pc,
              is_closed: false,
              reopened_by: currentUser?.id,
              reopened_at: reopenedAt,
              reopen_reason: reason,
            }
          : pc
      )
    );
    if (isSupabaseConfigured) {
      await syncUpdate(
        'period_closings',
        {
          is_closed: false,
          reopened_by: currentUser?.id,
          reopened_at: reopenedAt,
          reopen_reason: reason,
        },
        'id',
        closingId
      );
    }

    addAuditLog('period_closings', closingId, 'PERIOD_REOPENED', null, { reason }, `Periode dibuka kembali dengan alasan: ${reason}`);
    return { success: true };
  };

  // Save Reconciliation
  const saveReconciliation = async (
    rec: Omit<Reconciliation, 'id' | 'created_at' | 'discrepancy'>
  ): Promise<{ success: boolean; error?: string }> => {
    const discrepancy = rec.physical_balance - rec.system_balance;
    const newRec: Reconciliation = {
      ...rec,
      id: `rec-${Date.now()}`,
      discrepancy,
      checked_by: currentUser?.id,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      const syncRes = await syncInsert('reconciliations', newRec);
      if (!syncRes.success) {
        return { success: false, error: `Gagal menyimpan rekonsiliasi ke database: ${syncRes.error}` };
      }
    }
    setReconciliations((prev) => [newRec, ...prev]);
    addAuditLog('reconciliations', newRec.id, 'INSERT', null, newRec, 'Rekonsiliasi saldo disimpan');
    return { success: true };
  };

  // Master Data Mutators
  const saveKas = async (kasData: Partial<Kas>) => {
    if (kasData.id) {
      setKasList((prev) => prev.map((k) => (k.id === kasData.id ? ({ ...k, ...kasData } as Kas) : k)));
      if (isSupabaseConfigured) {
        const existing = kasList.find((k) => k.id === kasData.id);
        if (existing) await syncUpsert('kas', { ...existing, ...kasData });
      }
      addAuditLog('kas', kasData.id, 'UPDATE', null, kasData, `Data Kas ${kasData.nama || kasData.kode} diperbarui`);
    } else {
      const newKas: Kas = {
        id: `kas-${Date.now()}`,
        kode: kasData.kode || 'KAS-BARU',
        nama: kasData.nama || 'Kas Baru',
        deskripsi: kasData.deskripsi,
        warna: kasData.warna || '#7C9CF5',
        fund_type: kasData.fund_type || 'unrestricted',
        restricted_purpose: kasData.restricted_purpose || null,
        is_active: kasData.is_active !== undefined ? kasData.is_active : true,
      };
      setKasList((prev) => [...prev, newKas]);
      if (isSupabaseConfigured) {
        await syncUpsert('kas', newKas);
      }
      addAuditLog('kas', newKas.id, 'INSERT', null, newKas, `Kas baru ${newKas.nama} (${newKas.kode}) dibuat`);
    }
  };

  const deleteKas = async (
    id: string,
    options?: { force?: boolean; reason?: string }
  ): Promise<{ success: boolean; error?: string }> => {
    const kas = kasList.find((k) => k.id === id);
    if (!kas) return { success: false, error: 'Data kas tidak ditemukan.' };

    const isUserAdmin = currentUser?.role === 'admin';
    if (!isUserAdmin) {
      return {
        success: false,
        error: 'Hanya Administrator yang memiliki hak untuk menghapus entitas Kas.',
      };
    }

    const txCount = transactions.filter((t) => t.kas_id === id).length;
    const obCount = openingBalances.filter((b) => b.kas_id === id).length;
    const budgetCount = budgets.filter((b) => b.kas_id === id).length;
    const assetCount = fixedAssets.filter((a) => a.kas_id === id).length;
    const advCount = advances.filter((a) => a.kas_id === id).length;
    const rpCount = receivablesPayables.filter((rp) => rp.kas_id === id).length;

    const hasLinkedData =
      txCount > 0 || obCount > 0 || budgetCount > 0 || assetCount > 0 || advCount > 0 || rpCount > 0;

    if (hasLinkedData && !options?.force) {
      return {
        success: false,
        error: `Kas "${kas.nama}" memiliki data terkait (${txCount} transaksi, ${obCount} saldo awal, ${budgetCount} anggaran, ${assetCount} aset, ${advCount} panjar, ${rpCount} piutang/utang). Konfirmasi penghapusan paksa diperlukan.`,
      };
    }

    if (isSupabaseConfigured && supabase) {
      // 1. Bersihkan referensi opsional agar tidak meninggalkan ID yatim
      await supabase.from('categories').update({ default_kas_id: null }).eq('default_kas_id', id);
      await supabase.from('transactions').update({ transfer_target_kas_id: null }).eq('transfer_target_kas_id', id);
      await supabase.from('fixed_assets').update({ kas_id: null }).eq('kas_id', id);
      await supabase.from('audit_findings').update({ kas_id: null }).eq('kas_id', id);

      // 2. Hapus tabel anak dengan ON DELETE RESTRICT pada kas_id
      const delRpRes = await supabase.from('receivables_payables').delete().eq('kas_id', id);
      if (delRpRes.error) {
        return { success: false, error: `Gagal menghapus piutang/utang terkait Kas: ${delRpRes.error.message}` };
      }

      const delAdvRes = await supabase.from('advances').delete().eq('kas_id', id);
      if (delAdvRes.error) {
        return { success: false, error: `Gagal menghapus panjar terkait Kas: ${delAdvRes.error.message}` };
      }

      const delTxRes = await supabase.from('transactions').delete().eq('kas_id', id);
      if (delTxRes.error) {
        return { success: false, error: `Gagal menghapus transaksi terkait Kas: ${delTxRes.error.message}` };
      }

      // 3. Hapus Kas dari tabel utama (tabel lain seperti opening_balances, budgets, user_kas_access cascade otomatis)
      const delKasRes = await syncDelete('kas', 'id', id);
      if (!delKasRes.success) {
        return {
          success: false,
          error: delKasRes.error || 'Gagal menghapus data Kas dari Supabase.',
        };
      }
    }

    // Sinkronkan seluruh state aplikasi
    const deletedBudgetIds = new Set(budgets.filter((b) => b.kas_id === id).map((b) => b.id));
    const deletedAdvanceIds = new Set(advances.filter((a) => a.kas_id === id).map((a) => a.id));

    setKasList((prev) => prev.filter((k) => k.id !== id));
    setTransactions((prev) =>
      prev
        .filter((t) => t.kas_id !== id)
        .map((t) => (t.transfer_target_kas_id === id ? { ...t, transfer_target_kas_id: null } : t))
    );
    setOpeningBalances((prev) => prev.filter((ob) => ob.kas_id !== id));
    setOpeningEntries((prev) => prev.filter((oe) => oe.kas_id !== id));
    setOpeningAdjustments((prev) => prev.filter((oa) => oa.kas_id !== id));
    setOpeningOtherPositions((prev) => prev.filter((op) => op.kas_id !== id));
    setPriorYearSummaries((prev) => prev.filter((ps) => ps.kas_id !== id));
    setPeriodClosings((prev) => prev.filter((pc) => pc.kas_id !== id));
    setUserKasAccessList((prev) => {
      const next = prev.filter((u) => u.kas_id !== id);
      window.dispatchEvent(new CustomEvent('siku-user-kas-access-updated', { detail: next }));
      return next;
    });
    setBudgets((prev) => prev.filter((b) => b.kas_id !== id));
    setBudgetItems((prev) => prev.filter((bi) => !deletedBudgetIds.has(bi.budget_id)));
    setBudgetReallocations((prev) => prev.filter((br) => br.kas_id !== id && !deletedBudgetIds.has(br.budget_id)));
    setAdvances((prev) => prev.filter((a) => a.kas_id !== id));
    setAdvanceSettlements((prev) => prev.filter((s) => !deletedAdvanceIds.has(s.advance_id)));
    setReceivablesPayables((prev) => prev.filter((rp) => rp.kas_id !== id));
    setCashCounts((prev) => prev.filter((cc) => cc.kas_id !== id));
    setFixedAssets((prev) => prev.map((fa) => (fa.kas_id === id ? { ...fa, kas_id: '' } : fa)));
    setAuditFindings((prev) => prev.map((af) => (af.kas_id === id ? { ...af, kas_id: null } : af)));
    setCategories((prev) =>
      prev.map((c) => (c.default_kas_id === id ? { ...c, default_kas_id: null } : c))
    );

    const summaryReason = options?.reason?.trim() ? ` | Alasan: ${options.reason.trim()}` : '';
    addAuditLog(
      'kas',
      id,
      'DELETE',
      kas,
      null,
      `Kas ${kas.nama} (${kas.kode}) dihapus permanen oleh ${currentUser?.full_name || 'Admin'} (${txCount} transaksi, ${obCount} saldo awal, ${budgetCount} anggaran ikut dibersihkan)${summaryReason}`
    );
    return { success: true };
  };

  const saveProfile = async (
    profileData: Partial<Profile> & { password?: string }
  ): Promise<{ success: boolean; id?: string; error?: string }> => {
    const trimmedName = profileData.full_name?.trim() || '';
    const trimmedEmail = profileData.email?.trim() || '';
    if (!trimmedName || !trimmedEmail) {
      return { success: false, error: 'Nama lengkap dan email pengguna wajib diisi.' };
    }

    const duplicateEmail = profiles.find(
      (p) => p.email.trim().toLowerCase() === trimmedEmail.toLowerCase() && p.id !== profileData.id
    );
    if (duplicateEmail) {
      return { success: false, error: `Email "${trimmedEmail}" sudah digunakan oleh akun ${duplicateEmail.full_name}.` };
    }

    const { password: rawPassword, ...cleanProfileData } = profileData;
    const hasNewPassword = Boolean(rawPassword && rawPassword.length > 0);
    if (hasNewPassword && (rawPassword?.length || 0) < 6) {
      return { success: false, error: 'Kata sandi minimal 6 karakter.' };
    }

    if (!cleanProfileData.id && !hasNewPassword) {
      return { success: false, error: 'Kata sandi awal wajib diisi (minimal 6 karakter) saat membuat akun baru.' };
    }

    const computedPasswordHash = hasNewPassword && rawPassword ? hashUserPassword(rawPassword) : undefined;
    const nowIso = new Date().toISOString();

    if (cleanProfileData.id) {
      const existing = profiles.find((p) => p.id === cleanProfileData.id);
      if (!existing) {
        return { success: false, error: 'Data pengguna tidak ditemukan.' };
      }

      const updatedProfile: Profile = {
        ...existing,
        ...cleanProfileData,
        full_name: trimmedName,
        email: trimmedEmail,
        password_hash: computedPasswordHash ?? existing.password_hash ?? null,
        updated_at: nowIso,
      };

      if (isSupabaseConfigured) {
        const res = await syncUpsert('profiles', updatedProfile);
        if (!res.success) {
          return {
            success: false,
            error: `Gagal menyimpan ke Supabase: ${res.error || 'Periksa kolom password_hash pada tabel profiles.'}`,
          };
        }
      }

      setProfiles((prev) => prev.map((p) => (p.id === cleanProfileData.id ? updatedProfile : p)));
      addAuditLog(
        'profiles',
        cleanProfileData.id,
        'UPDATE',
        null,
        { ...updatedProfile, password_hash: updatedProfile.password_hash ? '[TERENKRIPSI]' : null },
        hasNewPassword
          ? `Data & kata sandi pengguna ${updatedProfile.full_name} diperbarui`
          : `Data profil pengguna ${updatedProfile.full_name} diperbarui`
      );
      return { success: true, id: cleanProfileData.id };
    } else {
      const newId = `user-${Date.now()}`;
      const newProfile: Profile = {
        id: newId,
        email: trimmedEmail,
        full_name: trimmedName,
        role: cleanProfileData.role || 'pengurus_kas',
        ecclesiastical_role: cleanProfileData.ecclesiastical_role,
        tohonan: cleanProfileData.tohonan || 'non_tahbisan',
        tingkat: cleanProfileData.tingkat || 'huria',
        seksi_name: cleanProfileData.seksi_name || null,
        wijk: cleanProfileData.wijk || null,
        phone: cleanProfileData.phone || null,
        password_hash: computedPasswordHash || null,
        is_active: cleanProfileData.is_active !== undefined ? cleanProfileData.is_active : true,
        created_at: nowIso,
        updated_at: nowIso,
      };

      if (isSupabaseConfigured) {
        const res = await syncUpsert('profiles', newProfile);
        if (!res.success) {
          return {
            success: false,
            error: `Gagal mendaftarkan pengguna ke Supabase: ${res.error || 'Periksa tabel profiles.'}`,
          };
        }
      }

      setProfiles((prev) => [...prev, newProfile]);
      addAuditLog(
        'profiles',
        newId,
        'INSERT',
        null,
        { ...newProfile, password_hash: '[TERENKRIPSI]' },
        `Pengguna baru ${newProfile.full_name} (${newProfile.email}) didaftarkan dengan kata sandi`
      );
      return { success: true, id: newId };
    }
  };

  const deleteProfile = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const prof = profiles.find((p) => p.id === id);
    if (!prof) return { success: false, error: 'Pengguna tidak ditemukan.' };
    if (prof.id === 'user-admin') {
      return { success: false, error: 'Akun Administrator utama tidak boleh dihapus demi keamanan sistem.' };
    }
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    if (isSupabaseConfigured) {
      await syncDelete('profiles', 'id', id);
    }
    addAuditLog('profiles', id, 'DELETE', prof, null, `Pengguna ${prof.full_name} dihapus dari sistem`);
    return { success: true };
  };

  const toggleProfileActive = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const prof = profiles.find((p) => p.id === id);
    if (!prof) return { success: false, error: 'Pengguna tidak ditemukan.' };
    const nextStatus = !prof.is_active;
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, is_active: nextStatus, updated_at: new Date().toISOString() } : p
      )
    );
    if (isSupabaseConfigured) {
      await syncUpdate('profiles', { is_active: nextStatus, updated_at: new Date().toISOString() }, 'id', id);
    }
    addAuditLog(
      'profiles',
      id,
      'UPDATE',
      { is_active: prof.is_active },
      { is_active: nextStatus },
      `Status pengguna ${prof.full_name} diubah menjadi ${nextStatus ? 'Aktif' : 'Non-Aktif'}`
    );
    return { success: true };
  };

  const saveStorageAccount = async (data: Partial<StorageAccount>) => {
    if (data.id) {
      setStorageAccounts((prev) => prev.map((s) => (s.id === data.id ? ({ ...s, ...data } as StorageAccount) : s)));
      if (isSupabaseConfigured) {
        const existing = storageAccounts.find((s) => s.id === data.id);
        if (existing) await syncUpsert('storage_accounts', { ...existing, ...data });
      }
    } else {
      const newStorage: StorageAccount = {
        id: `stor-${Date.now()}`,
        nama: data.nama || 'Tempat Penyimpanan Baru',
        tipe: data.tipe || 'cash',
        nomor_rekening: data.nomor_rekening,
        atas_nama: data.atas_nama,
        is_active: true,
      };
      setStorageAccounts((prev) => [...prev, newStorage]);
      if (isSupabaseConfigured) {
        await syncUpsert('storage_accounts', newStorage);
      }
    }
  };

  const deleteStorageAccount = async (
    id: string,
    options?: { force?: boolean; reason?: string }
  ): Promise<{ success: boolean; error?: string }> => {
    const stor = storageAccounts.find((s) => s.id === id);
    if (!stor) {
      return { success: false, error: 'Data rekening / tempat penyimpanan tidak ditemukan.' };
    }

    if (currentUser?.role !== 'admin') {
      return {
        success: false,
        error: 'Hanya Administrator yang memiliki hak untuk menghapus Rekening / Tempat Penyimpanan.',
      };
    }

    const txCount = transactions.filter(
      (t) => t.storage_account_id === id || t.transfer_target_storage_id === id
    ).length;
    const obCount = openingBalances.filter((b) => b.storage_account_id === id).length;
    const obEntryCount = openingEntries.filter((e) => e.storage_account_id === id).length;
    const obAdjCount = openingAdjustments.filter((a) => a.storage_account_id === id).length;
    const recCount = reconciliations.filter((r) => r.storage_account_id === id).length;
    const ccCount = cashCounts.filter((c) => c.storage_account_id === id).length;
    const advCount = advances.filter((a) => a.storage_account_id === id).length;

    const hasLinkedData =
      txCount > 0 ||
      obCount > 0 ||
      obEntryCount > 0 ||
      obAdjCount > 0 ||
      recCount > 0 ||
      ccCount > 0 ||
      advCount > 0;

    if (hasLinkedData && !options?.force) {
      return {
        success: false,
        error: `Rekening "${stor.nama}" masih memiliki data terkait (${txCount} transaksi, ${obCount + obEntryCount} saldo awal, ${recCount} rekonsiliasi, ${ccCount} opname fisik). Konfirmasi penghapusan paksa diperlukan.`,
      };
    }

    if (isSupabaseConfigured && supabase) {
      // 1. Lepas referensi opsional pada transfer, panjar, & pembayaran piutang/utang
      await supabase
        .from('transactions')
        .update({ transfer_target_storage_id: null })
        .eq('transfer_target_storage_id', id);
      await supabase.from('advances').update({ storage_account_id: null }).eq('storage_account_id', id);
      await supabase
        .from('receivable_payable_payments')
        .update({ storage_account_id: null })
        .eq('storage_account_id', id);

      // 2. Hapus tabel anak dengan ON DELETE RESTRICT pada storage_account_id
      const delCcRes = await supabase.from('cash_counts').delete().eq('storage_account_id', id);
      if (delCcRes.error) {
        return {
          success: false,
          error: `Gagal menghapus data opname kas terkait rekening: ${delCcRes.error.message}`,
        };
      }

      const delTxRes = await supabase.from('transactions').delete().eq('storage_account_id', id);
      if (delTxRes.error) {
        return {
          success: false,
          error: `Gagal menghapus transaksi terkait rekening: ${delTxRes.error.message}`,
        };
      }

      // 3. Hapus rekening dari tabel utama (opening_balances, opening_balance_entries, opening_balance_adjustments, reconciliations cascade otomatis)
      const delStorRes = await syncDelete('storage_accounts', 'id', id);
      if (!delStorRes.success) {
        return {
          success: false,
          error: delStorRes.error || 'Gagal menghapus data Rekening dari Supabase.',
        };
      }
    }

    // Sinkronkan seluruh state lokal aplikasi
    setStorageAccounts((prev) => prev.filter((s) => s.id !== id));
    setTransactions((prev) =>
      prev
        .filter((t) => t.storage_account_id !== id)
        .map((t) =>
          t.transfer_target_storage_id === id ? { ...t, transfer_target_storage_id: null } : t
        )
    );
    setOpeningBalances((prev) => prev.filter((ob) => ob.storage_account_id !== id));
    setOpeningEntries((prev) => prev.filter((oe) => oe.storage_account_id !== id));
    setOpeningAdjustments((prev) => prev.filter((oa) => oa.storage_account_id !== id));
    setReconciliations((prev) => prev.filter((r) => r.storage_account_id !== id));
    setCashCounts((prev) => prev.filter((cc) => cc.storage_account_id !== id));
    setAdvances((prev) =>
      prev.map((a) => (a.storage_account_id === id ? { ...a, storage_account_id: null } : a))
    );
    setReceivablesPayables((prev) =>
      prev.map((rp) => ({
        ...rp,
        payments: rp.payments?.map((p) =>
          p.storage_account_id === id ? { ...p, storage_account_id: null } : p
        ),
      }))
    );

    const summaryReason = options?.reason?.trim() ? ` | Alasan: ${options.reason.trim()}` : '';
    addAuditLog(
      'storage_accounts',
      id,
      'DELETE',
      stor,
      null,
      `Rekening "${stor.nama}" (${stor.tipe === 'cash' ? 'Tunai' : 'Bank'}) dihapus permanen oleh ${currentUser?.full_name || 'Admin'} (${txCount} transaksi, ${obCount + obEntryCount} saldo awal, ${recCount} rekonsiliasi, ${ccCount} opname ikut dibersihkan)${summaryReason}`
    );

    return { success: true };
  };

  const saveCategory = async (data: Partial<Category>) => {
    const nowIso = new Date().toISOString();
    if (data.id) {
      const existing = categories.find((c) => c.id === data.id);
      const merged: Category = {
        ...(existing || ({ id: data.id, nama: 'Kategori', tipe: 'income', is_active: true } as Category)),
        ...data,
        is_sentralisasi:
          (data.tipe || existing?.tipe) === 'income'
            ? data.is_sentralisasi !== undefined
              ? data.is_sentralisasi
              : existing?.is_sentralisasi !== false
            : undefined,
        sentralisasi_group:
          (data.tipe || existing?.tipe) === 'income'
            ? data.is_sentralisasi === false
              ? 'dikecualikan_khusus'
              : data.sentralisasi_group || existing?.sentralisasi_group || 'pelean_mingguan'
            : null,
        sentralisasi_exclusion_type:
          (data.tipe || existing?.tipe) === 'income' && data.is_sentralisasi === false
            ? data.sentralisasi_exclusion_type || existing?.sentralisasi_exclusion_type || 'lainnya'
            : null,
        default_kas_id: data.default_kas_id !== undefined ? data.default_kas_id || null : existing?.default_kas_id || null,
        updated_at: nowIso,
      };
      setCategories((prev) => prev.map((c) => (c.id === data.id ? merged : c)));
      if (isSupabaseConfigured) {
        await syncUpsert('categories', merged);
      }
      addAuditLog('categories', merged.id, 'UPDATE', existing, merged, `Kategori "${merged.nama}" diperbarui oleh ${currentUser?.full_name}`);
    } else {
      const isIncome = (data.tipe || 'income') === 'income';
      const isSent = isIncome ? data.is_sentralisasi !== false : undefined;
      const newCat: Category = {
        id: `cat-${Date.now()}`,
        nama: data.nama || 'Kategori Baru',
        tipe: data.tipe || 'income',
        kode: data.kode,
        deskripsi: data.deskripsi,
        is_active: data.is_active !== undefined ? data.is_active : true,
        is_sentralisasi: isSent,
        sentralisasi_group: isIncome
          ? isSent
            ? data.sentralisasi_group || 'pelean_mingguan'
            : 'dikecualikan_khusus'
          : null,
        sentralisasi_exclusion_type: isIncome && !isSent ? data.sentralisasi_exclusion_type || 'lainnya' : null,
        default_kas_id: data.default_kas_id || null,
        created_at: nowIso,
        updated_at: nowIso,
      };
      setCategories((prev) => [...prev, newCat]);
      if (isSupabaseConfigured) {
        await syncUpsert('categories', newCat);
      }
      addAuditLog('categories', newCat.id, 'INSERT', null, newCat, `Kategori baru "${newCat.nama}" dibuat oleh ${currentUser?.full_name}`);
    }
  };

  const saveOpeningBalance = async (data: Partial<OpeningBalance>) => {
    const nowIso = new Date().toISOString();
    if (data.id) {
      const existing = openingBalances.find((ob) => ob.id === data.id);
      const updatedOb = existing
        ? ({ ...existing, ...data, updated_at: nowIso } as OpeningBalance)
        : ({
            id: data.id,
            tahun: data.tahun || settings.active_year,
            kas_id: data.kas_id!,
            storage_account_id: data.storage_account_id!,
            amount: data.amount || 0,
            notes: data.notes,
            updated_at: nowIso,
          } as OpeningBalance);
      setOpeningBalances((prev) => prev.map((ob) => (ob.id === data.id ? updatedOb : ob)));
      if (isSupabaseConfigured) {
        await syncUpsert('opening_balances', updatedOb);
      }
    } else {
      const newOb: OpeningBalance = {
        id: `ob-${Date.now()}`,
        tahun: data.tahun || settings.active_year,
        kas_id: data.kas_id!,
        storage_account_id: data.storage_account_id!,
        amount: data.amount || 0,
        notes: data.notes,
        created_at: nowIso,
        updated_at: nowIso,
      };
      setOpeningBalances((prev) => [...prev, newOb]);
      if (isSupabaseConfigured) {
        await syncUpsert('opening_balances', newOb);
      }
    }
  };

  const saveUserKasAccess = async (
    data: Omit<UserKasAccess, 'id'>
  ): Promise<{ success: boolean; error?: string }> => {
    // Check constraint: Bendahara Umum cannot be ketua on Kas Umum
    const user = profiles.find((p) => p.id === data.user_id);
    const kas = kasList.find((k) => k.id === data.kas_id);

    if (user?.role === 'bendahara_umum' && kas?.kode === 'KAS-UMUM' && data.access_level === 'ketua') {
      return {
        success: false,
        error: 'Bendahara Umum tidak boleh ditugaskan sebagai Ketua pada Kas Umum demi integritas persetujuan.',
      };
    }

    const exists = userKasAccessList.some(
      (a) =>
        a.user_id === data.user_id &&
        a.kas_id === data.kas_id &&
        a.access_level === data.access_level
    );
    if (exists) {
      return { success: false, error: 'Penugasan akses tersebut sudah terdaftar.' };
    }

    const newAccess: UserKasAccess = {
      ...data,
      id: `uka-${Date.now()}`,
    };
    const nextList = [...userKasAccessList, newAccess];
    setUserKasAccessList(nextList);
    window.dispatchEvent(new CustomEvent('siku-user-kas-access-updated', { detail: nextList }));
    if (isSupabaseConfigured) {
      await syncUpsert('user_kas_access', newAccess);
    }
    return { success: true };
  };

  const removeUserKasAccess = async (id: string) => {
    const nextList = userKasAccessList.filter((a) => a.id !== id);
    setUserKasAccessList(nextList);
    window.dispatchEvent(new CustomEvent('siku-user-kas-access-updated', { detail: nextList }));
    if (isSupabaseConfigured) {
      await syncDelete('user_kas_access', 'id', id);
    }
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    if (isSupabaseConfigured) {
      await syncUpsert('app_settings', { ...updated, id: 'main' });
    }
  };

  // ---------------------------------------------------------------------------
  // LINGKUNGAN & DATA KELUARGA JEMAAT (PELEAN TAON)
  // ---------------------------------------------------------------------------

  const saveLingkungan = async (
    data: Partial<ChurchLingkungan>
  ): Promise<{ success: boolean; id?: string; error?: string }> => {
    const nama = (data.nama || '').trim();
    if (!nama) return { success: false, error: 'Nama Lingkungan wajib diisi.' };

    const duplicate = lingkunganList.find(
      (l) => l.nama.toLowerCase() === nama.toLowerCase() && l.id !== data.id
    );
    if (duplicate) {
      return { success: false, error: `Lingkungan "${nama}" sudah terdaftar.` };
    }

    const nowIso = new Date().toISOString();
    if (data.id) {
      const existing = lingkunganList.find((l) => l.id === data.id);
      const updated: ChurchLingkungan = {
        ...(existing || { id: data.id, urutan: lingkunganList.length + 1, is_active: true }),
        ...data,
        nama,
        updated_at: nowIso,
      };
      setLingkunganList((prev) => prev.map((l) => (l.id === data.id ? updated : l)));
      if (isSupabaseConfigured) {
        await syncUpsert('church_lingkungan', updated);
      }
      addAuditLog('church_lingkungan', updated.id, 'UPDATE', existing || null, updated, `Lingkungan "${updated.nama}" diperbarui`);
      return { success: true, id: updated.id };
    } else {
      const newItem: ChurchLingkungan = {
        id: `ling-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        nama,
        kode: data.kode?.trim().toUpperCase() || nama.slice(0, 3).toUpperCase(),
        urutan: data.urutan ?? lingkunganList.length + 1,
        is_active: data.is_active !== false,
        created_at: nowIso,
        updated_at: nowIso,
      };
      setLingkunganList((prev) => [...prev, newItem]);
      if (isSupabaseConfigured) {
        await syncUpsert('church_lingkungan', newItem);
      }
      addAuditLog('church_lingkungan', newItem.id, 'INSERT', null, newItem, `Lingkungan "${newItem.nama}" ditambahkan`);
      return { success: true, id: newItem.id };
    }
  };

  const deleteLingkungan = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const target = lingkunganList.find((l) => l.id === id);
    if (!target) return { success: false, error: 'Lingkungan tidak ditemukan.' };
    const linkedFamilies = families.filter(
      (f) => f.lingkungan.trim().toLowerCase() === target.nama.trim().toLowerCase()
    ).length;
    if (linkedFamilies > 0) {
      return {
        success: false,
        error: `Lingkungan "${target.nama}" masih memiliki ${linkedFamilies} keluarga terdaftar. Pindahkan atau hapus data keluarga terlebih dahulu.`,
      };
    }
    setLingkunganList((prev) => prev.filter((l) => l.id !== id));
    if (isSupabaseConfigured) {
      await syncDelete('church_lingkungan', 'id', id);
    }
    addAuditLog('church_lingkungan', id, 'DELETE', target, null, `Lingkungan "${target.nama}" dihapus`);
    return { success: true };
  };

  const saveFamily = async (
    data: Partial<CongregationFamily>
  ): Promise<{ success: boolean; id?: string; error?: string }> => {
    const nama_keluarga = formatNamaKeluarga(data.nama_keluarga);
    const lingkungan = (data.lingkungan || '').trim();
    if (!nama_keluarga) return { success: false, error: 'Nama Keluarga wajib diisi.' };
    if (!lingkungan) return { success: false, error: 'Lingkungan wajib dipilih.' };

    const nowIso = new Date().toISOString();
    // Auto-create Lingkungan if not listed yet
    const hasLing = lingkunganList.some((l) => l.nama.toLowerCase() === lingkungan.toLowerCase());
    if (!hasLing) {
      const newLing: ChurchLingkungan = {
        id: `ling-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        nama: lingkungan,
        kode: lingkungan.slice(0, 3).toUpperCase(),
        urutan: lingkunganList.length + 1,
        is_active: true,
        created_at: nowIso,
        updated_at: nowIso,
      };
      setLingkunganList((prev) => [...prev, newLing]);
      if (isSupabaseConfigured) {
        await syncUpsert('church_lingkungan', newLing);
      }
    }

    if (data.id) {
      const existing = families.find((f) => f.id === data.id);
      const updated: CongregationFamily = {
        ...(existing || { id: data.id, is_active: true }),
        ...data,
        nama_keluarga,
        lingkungan,
        updated_at: nowIso,
      };
      setFamilies((prev) => prev.map((f) => (f.id === data.id ? updated : f)));
      if (isSupabaseConfigured) {
        const res = await syncUpsert('congregation_families', updated);
        if (!res.success) return { success: false, error: res.error };
      }
      addAuditLog('congregation_families', updated.id, 'UPDATE', existing || null, updated, `Data keluarga "${updated.nama_keluarga}" diperbarui`);
      return { success: true, id: updated.id };
    } else {
      const newFam: CongregationFamily = {
        id: `fam-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        nama_keluarga,
        lingkungan,
        kepala_keluarga: data.kepala_keluarga?.trim() || null,
        notes: data.notes?.trim() || null,
        is_active: data.is_active !== false,
        created_at: nowIso,
        updated_at: nowIso,
      };
      setFamilies((prev) => [...prev, newFam]);
      if (isSupabaseConfigured) {
        const res = await syncUpsert('congregation_families', newFam);
        if (!res.success) return { success: false, error: res.error };
      }
      addAuditLog('congregation_families', newFam.id, 'INSERT', null, newFam, `Keluarga "${newFam.nama_keluarga}" (${newFam.lingkungan}) ditambahkan`);
      return { success: true, id: newFam.id };
    }
  };

  const bulkImportFamilies = async (
    rows: Array<{ nama_keluarga: string; lingkungan: string; kepala_keluarga?: string | null; notes?: string | null }>,
    options?: { updateExistingLingkungan?: boolean }
  ): Promise<{ success: boolean; added: number; updated: number; skipped: number; createdLingkungan: number; error?: string }> => {
    if (!rows || rows.length === 0) {
      return { success: false, added: 0, updated: 0, skipped: 0, createdLingkungan: 0, error: 'Tidak ada baris data yang valid untuk diimpor.' };
    }

    const nowIso = new Date().toISOString();
    const updateExisting = options?.updateExistingLingkungan ?? false;

    const existingLingMap = new Map(lingkunganList.map((l) => [l.nama.trim().toLowerCase(), l]));
    const newLingToCreate: ChurchLingkungan[] = [];
    let nextUrutan = lingkunganList.length + 1;

    const normalizeKey = (name: string) =>
      formatNamaKeluarga(name).toLowerCase().replace(/\s+/g, ' ');
    const existingFamilyMap = new Map(families.map((f) => [normalizeKey(f.nama_keluarga), f]));

    const toUpsert: CongregationFamily[] = [];
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const seenInBatch = new Set<string>();

    rows.forEach((row, idx) => {
      const cleanName = formatNamaKeluarga(row.nama_keluarga);
      const cleanLing = (row.lingkungan || '').trim().replace(/\s+/g, ' ');
      if (!cleanName || !cleanLing) {
        skipped++;
        return;
      }

      const lingKey = cleanLing.toLowerCase();
      if (!existingLingMap.has(lingKey)) {
        const newLing: ChurchLingkungan = {
          id: `ling-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
          nama: cleanLing,
          kode: cleanLing.slice(0, 3).toUpperCase(),
          urutan: nextUrutan++,
          is_active: true,
          created_at: nowIso,
          updated_at: nowIso,
        };
        existingLingMap.set(lingKey, newLing);
        newLingToCreate.push(newLing);
      }

      const famKey = normalizeKey(cleanName);
      if (seenInBatch.has(famKey)) {
        skipped++;
        return;
      }
      seenInBatch.add(famKey);

      const canonicalLingName = existingLingMap.get(lingKey)!.nama;
      const existingFam = existingFamilyMap.get(famKey);

      if (existingFam) {
        if (updateExisting && existingFam.lingkungan !== canonicalLingName) {
          const updatedFam: CongregationFamily = {
            ...existingFam,
            lingkungan: canonicalLingName,
            kepala_keluarga: row.kepala_keluarga?.trim() || existingFam.kepala_keluarga || null,
            notes: row.notes?.trim() || existingFam.notes || null,
            updated_at: nowIso,
          };
          toUpsert.push(updatedFam);
          existingFamilyMap.set(famKey, updatedFam);
          updated++;
        } else {
          skipped++;
        }
      } else {
        const newFam: CongregationFamily = {
          id: `fam-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          nama_keluarga: cleanName,
          lingkungan: canonicalLingName,
          kepala_keluarga: row.kepala_keluarga?.trim() || null,
          notes: row.notes?.trim() || null,
          is_active: true,
          created_at: nowIso,
          updated_at: nowIso,
        };
        toUpsert.push(newFam);
        existingFamilyMap.set(famKey, newFam);
        added++;
      }
    });

    if (isSupabaseConfigured) {
      if (newLingToCreate.length > 0) {
        const lingRes = await syncUpsert('church_lingkungan', newLingToCreate);
        if (!lingRes.success) {
          return {
            success: false,
            added: 0,
            updated: 0,
            skipped,
            createdLingkungan: 0,
            error: `Gagal menyimpan Lingkungan ke Supabase: ${lingRes.error}. Pastikan SQL schema_full.sql terbaru sudah dijalankan.`,
          };
        }
      }
      if (toUpsert.length > 0) {
        const famRes = await syncUpsert('congregation_families', toUpsert);
        if (!famRes.success) {
          return {
            success: false,
            added: 0,
            updated: 0,
            skipped,
            createdLingkungan: 0,
            error: `Gagal mengimpor Data Keluarga ke Supabase: ${famRes.error}. Pastikan SQL schema_full.sql terbaru sudah dijalankan.`,
          };
        }
      }
    }

    if (newLingToCreate.length > 0) {
      setLingkunganList((prev) => [...prev, ...newLingToCreate]);
    }
    if (toUpsert.length > 0) {
      const upsertMap = new Map(toUpsert.map((item) => [item.id, item]));
      setFamilies((prev) => {
        const merged = prev.map((f) => upsertMap.get(f.id) || f);
        const existingIds = new Set(prev.map((f) => f.id));
        const newlyAdded = toUpsert.filter((item) => !existingIds.has(item.id));
        return [...merged, ...newlyAdded];
      });
    }

    addAuditLog(
      'congregation_families',
      `import-${Date.now()}`,
      'BULK_IMPORT',
      null,
      { added, updated, skipped, createdLingkungan: newLingToCreate.length },
      `Impor Excel Data Keluarga: ${added} ditambahkan, ${updated} diperbarui, ${skipped} dilewati`
    );

    return {
      success: true,
      added,
      updated,
      skipped,
      createdLingkungan: newLingToCreate.length,
    };
  };

  const deleteFamily = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const target = families.find((f) => f.id === id);
    if (!target) return { success: false, error: 'Data keluarga tidak ditemukan.' };
    setFamilies((prev) => prev.filter((f) => f.id !== id));
    if (isSupabaseConfigured) {
      const res = await syncDelete('congregation_families', 'id', id);
      if (!res.success) return { success: false, error: res.error };
    }
    addAuditLog('congregation_families', id, 'DELETE', target, null, `Data keluarga "${target.nama_keluarga}" dihapus`);
    return { success: true };
  };

  // ---------------------------------------------------------------------------
  // FISCAL YEAR (PENGATURAN TAHUN ANGGARAN)
  // ---------------------------------------------------------------------------

  const saveFiscalYear = async (fyData: Partial<FiscalYear>): Promise<{ success: boolean; error?: string }> => {
    if (!fyData.year) return { success: false, error: 'Tahun Anggaran wajib diisi.' };
    const yearNum = Number(fyData.year);
    if (yearNum < 2000 || yearNum > 2100) {
      return { success: false, error: 'Tahun Anggaran harus antara 2000 dan 2100.' };
    }

    const existingIndex = fiscalYears.findIndex((f) => f.id === fyData.id || f.year === yearNum);
    let updatedList: FiscalYear[];

    const newRecord: FiscalYear = {
      id: fyData.id || `fy-${yearNum}`,
      year: yearNum,
      theme: fyData.theme || `Tahun Pelayanan HKBP ${yearNum}`,
      start_date: fyData.start_date || `${yearNum}-01-01`,
      end_date: fyData.end_date || `${yearNum}-12-31`,
      status: fyData.status || (yearNum === settings.active_year ? 'active' : yearNum < settings.active_year ? 'closed' : 'planning'),
      is_budget_locked: fyData.is_budget_locked ?? false,
      notes: fyData.notes || null,
      created_at: fyData.created_at || new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      updatedList = fiscalYears.map((f, idx) => (idx === existingIndex ? { ...f, ...newRecord } : f));
    } else {
      updatedList = [...fiscalYears, newRecord].sort((a, b) => b.year - a.year);
    }

    // If marked active, set settings.active_year and synchronize statuses
    if (newRecord.status === 'active') {
      updatedList = updatedList.map((f) => {
        if (f.year === yearNum) return { ...f, status: 'active' as const };
        if (f.status === 'active') return { ...f, status: f.year < yearNum ? ('closed' as const) : ('planning' as const) };
        return f;
      });
      await updateSettings({ active_year: yearNum });
    }

    setFiscalYears(updatedList);
    if (isSupabaseConfigured) {
      await syncUpsert('fiscal_years', updatedList);
    }
    addAuditLog('fiscal_years', newRecord.id, existingIndex >= 0 ? 'UPDATE' : 'INSERT', null, newRecord, `Tahun Anggaran ${yearNum} disimpan`);
    return { success: true };
  };

  const deleteFiscalYear = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const target = fiscalYears.find((f) => f.id === id);
    if (!target) return { success: false, error: 'Tahun Anggaran tidak ditemukan.' };
    if (target.year === settings.active_year) {
      return { success: false, error: 'Tidak dapat menghapus Tahun Anggaran yang sedang aktif dalam sistem.' };
    }

    const hasTx = transactions.some((tx) => new Date(tx.tanggal).getFullYear() === target.year);
    if (hasTx) {
      return { success: false, error: `Tahun Anggaran ${target.year} memiliki transaksi keuangan tercatat. Hanya dapat diubah statusnya menjadi 'Ditutup'.` };
    }

    setFiscalYears((prev) => prev.filter((f) => f.id !== id));
    if (isSupabaseConfigured) {
      await syncDelete('fiscal_years', 'id', id);
    }
    addAuditLog('fiscal_years', id, 'DELETE', target, null, `Tahun Anggaran ${target.year} dihapus`);
    return { success: true };
  };

  const setActiveFiscalYear = async (year: number): Promise<{ success: boolean; error?: string }> => {
    const target = fiscalYears.find((f) => f.year === year);
    if (!target) {
      await saveFiscalYear({ year, status: 'active' });
    } else {
      const updatedList = fiscalYears.map((f) => {
        if (f.year === year) return { ...f, status: 'active' as const };
        if (f.status === 'active') return { ...f, status: f.year < year ? ('closed' as const) : ('planning' as const) };
        return f;
      });
      setFiscalYears(updatedList);
      if (isSupabaseConfigured) {
        await syncUpsert('fiscal_years', updatedList);
      }
      await updateSettings({ active_year: year });
    }
    addAuditLog('settings', 'main', 'UPDATE', { active_year: settings.active_year }, { active_year: year }, `Tahun Anggaran Aktif dialihkan ke ${year}`);
    return { success: true };
  };

  const toggleFiscalYearBudgetLock = async (year: number): Promise<{ success: boolean; error?: string }> => {
    const target = fiscalYears.find((f) => f.year === year);
    if (!target) return { success: false, error: 'Tahun Anggaran tidak ditemukan.' };
    const nextLocked = !target.is_budget_locked;
    const updatedList = fiscalYears.map((f) => (f.year === year ? { ...f, is_budget_locked: nextLocked } : f));
    setFiscalYears(updatedList);
    if (isSupabaseConfigured) {
      await syncUpdate('fiscal_years', { is_budget_locked: nextLocked }, 'id', target.id);
    }
    addAuditLog('fiscal_years', target.id, 'UPDATE', { is_budget_locked: target.is_budget_locked }, { is_budget_locked: nextLocked }, `Kunci RAPB Tahun ${year} diubah ke ${nextLocked ? 'Terkunci' : 'Terbuka'}`);
    return { success: true };
  };

  const rollForwardBalancesToYear = async (fromYear: number, toYear: number): Promise<{ success: boolean; count: number; error?: string }> => {
    let createdCount = 0;
    const createdRowsForTarget: OpeningBalance[] = [];
    const newOpeningBalances = [...openingBalances.filter((ob) => ob.tahun !== toYear)];

    for (const kas of kasList) {
      for (const storage of storageAccounts) {
        const initialBal = openingBalances.find((ob) => ob.kas_id === kas.id && ob.storage_account_id === storage.id && ob.tahun === fromYear)?.amount || 0;
        
        const txForPair = transactions.filter((tx) => {
          const d = new Date(tx.tanggal);
          return d.getFullYear() <= fromYear && tx.status === 'approved';
        });

        const income = txForPair
          .filter((tx) => tx.type === 'income' && tx.kas_id === kas.id && tx.storage_account_id === storage.id)
          .reduce((sum, tx) => sum + (tx.huria_amount ?? tx.amount), 0);

        const expense = txForPair
          .filter((tx) => tx.type === 'expense' && tx.kas_id === kas.id && tx.storage_account_id === storage.id)
          .reduce((sum, tx) => sum + tx.amount, 0);

        const transferIn = txForPair
          .filter((tx) => tx.type === 'transfer_in' && tx.kas_id === kas.id && tx.storage_account_id === storage.id)
          .reduce((sum, tx) => sum + tx.amount, 0);

        const transferOut = txForPair
          .filter((tx) => tx.type === 'transfer_out' && tx.kas_id === kas.id && tx.storage_account_id === storage.id)
          .reduce((sum, tx) => sum + tx.amount, 0);

        const endingBalance = initialBal + income - expense + transferIn - transferOut;

        const row: OpeningBalance = {
          id: `ob-${toYear}-${kas.id.slice(0, 6)}-${storage.id.slice(0, 6)}`,
          tahun: toYear,
          kas_id: kas.id,
          storage_account_id: storage.id,
          amount: Math.max(0, endingBalance),
          notes: `Roll-forward otomatis dari saldo akhir tahun buku ${fromYear}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        newOpeningBalances.push(row);
        createdRowsForTarget.push(row);
        createdCount++;
      }
    }

    setOpeningBalances(newOpeningBalances);
    if (isSupabaseConfigured && supabase) {
      await supabase.from('opening_balances').delete().eq('tahun', toYear);
      if (createdRowsForTarget.length > 0) {
        await syncUpsert('opening_balances', createdRowsForTarget);
      }
    }
    addAuditLog('opening_balances', `rollforward-${toYear}`, 'INSERT', null, { fromYear, toYear, count: createdCount }, `Roll-forward saldo awal dari ${fromYear} ke ${toYear}`);
    return { success: true, count: createdCount };
  };

  // ---------------------------------------------------------------------------
  // BUDGET (APBG) IMPLEMENTATIONS
  // ---------------------------------------------------------------------------

  const saveBudget = async (budgetData: Partial<Budget>): Promise<{ success: boolean; id?: string; error?: string }> => {
    if (budgetData.id) {
      const existing = budgets.find((b) => b.id === budgetData.id);
      if (!existing) return { success: false, error: 'Anggaran tidak ditemukan.' };
      if (existing.status === 'approved') {
        return { success: false, error: 'Anggaran yang sudah Disahkan Rapat Huria terkunci dan tidak dapat diedit langsung. Gunakan Perubahan Anggaran (APBG-P).' };
      }

      const updatedBudget = { ...existing, ...budgetData, updated_at: new Date().toISOString() } as Budget;
      setBudgets((prev) => prev.map((b) => (b.id === budgetData.id ? updatedBudget : b)));
      if (isSupabaseConfigured) {
        await syncUpsert('budgets', updatedBudget);
      }
      addAuditLog('budgets', budgetData.id, 'UPDATE', existing, budgetData, 'Anggaran diperbarui');
      return { success: true, id: budgetData.id };
    } else {
      if (!budgetData.kas_id || !budgetData.tahun) {
        return { success: false, error: 'Kas dan Tahun Anggaran wajib dipilih.' };
      }

      const existingVersions = budgets
        .filter((b) => b.kas_id === budgetData.kas_id && b.tahun === budgetData.tahun)
        .map((b) => b.version);
      const nextVersion = existingVersions.length > 0 ? Math.max(...existingVersions) + 1 : 1;

      // Check opening balance status from openingBalances
      const matchingOpeningBalances = openingBalances.filter(
        (ob) => ob.kas_id === budgetData.kas_id && ob.tahun === budgetData.tahun
      );
      const totalOpening = matchingOpeningBalances.reduce((sum, ob) => sum + Number(ob.amount), 0);
      const isLocked = matchingOpeningBalances.length > 0;

      const newBudget: Budget = {
        id: `bgt-${Date.now()}`,
        kas_id: budgetData.kas_id,
        tahun: budgetData.tahun,
        version: nextVersion,
        title: budgetData.title || `APBG ${kasList.find((k) => k.id === budgetData.kas_id)?.nama || 'Kas'} Tahun ${budgetData.tahun} (Versi ${nextVersion})`,
        status: 'draft',
        estimated_opening_balance: isLocked ? totalOpening : (budgetData.estimated_opening_balance || 0),
        is_opening_balance_locked: isLocked,
        is_current_active: false,
        notes: budgetData.notes || '',
        created_by: currentUser?.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setBudgets((prev) => [newBudget, ...prev]);
      if (isSupabaseConfigured) {
        await syncUpsert('budgets', newBudget);
      }
      addAuditLog('budgets', newBudget.id, 'INSERT', null, newBudget, `Draf anggaran baru dibuat oleh ${currentUser?.full_name}`);
      return { success: true, id: newBudget.id };
    }
  };

  const deleteBudget = async (budgetId: string): Promise<{ success: boolean; error?: string }> => {
    const budget = budgets.find((b) => b.id === budgetId);
    if (!budget) return { success: false, error: 'Anggaran tidak ditemukan.' };
    if (budget.status === 'approved') {
      return { success: false, error: 'Anggaran yang sudah Disahkan tidak boleh dihapus.' };
    }

    setBudgets((prev) => prev.filter((b) => b.id !== budgetId));
    setBudgetItems((prev) => prev.filter((item) => item.budget_id !== budgetId));
    if (isSupabaseConfigured) {
      await syncDelete('budgets', 'id', budgetId);
      await syncDelete('budget_items', 'budget_id', budgetId);
    }
    addAuditLog('budgets', budgetId, 'DELETE', budget, null, 'Draf anggaran dihapus');
    return { success: true };
  };

  const saveBudgetItem = async (itemData: Partial<BudgetItem>): Promise<{ success: boolean; error?: string }> => {
    if (!itemData.budget_id || !itemData.category_id || itemData.annual_amount === undefined) {
      return { success: false, error: 'Kategori dan nominal tahunan wajib diisi.' };
    }

    const budget = budgets.find((b) => b.id === itemData.budget_id);
    if (!budget) return { success: false, error: 'Anggaran induk tidak ditemukan.' };
    if (budget.status === 'approved') {
      return { success: false, error: 'Anggaran induk telah Disahkan dan terkunci.' };
    }

    const annual = Number(itemData.annual_amount) || 0;
    let dist = itemData.monthly_distribution;
    if (!dist || dist.length !== 12 || dist.reduce((s, val) => s + val, 0) !== annual) {
      dist = generateMonthlyDistribution(annual);
    }

    const nowIso = new Date().toISOString();
    if (itemData.id) {
      const existingItem = budgetItems.find((item) => item.id === itemData.id);
      const updatedItem = {
        ...existingItem,
        ...itemData,
        annual_amount: annual,
        monthly_distribution: dist,
        updated_at: nowIso,
      } as BudgetItem;
      setBudgetItems((prev) => prev.map((item) => (item.id === itemData.id ? updatedItem : item)));
      if (isSupabaseConfigured) {
        await syncUpsert('budget_items', updatedItem);
      }
      addAuditLog('budget_items', itemData.id, 'UPDATE', null, itemData, 'Baris anggaran diperbarui');
    } else {
      const newItem: BudgetItem = {
        id: `bi-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        budget_id: itemData.budget_id,
        category_id: itemData.category_id,
        type: itemData.type || 'expense',
        description: itemData.description || '',
        annual_amount: annual,
        monthly_distribution: dist,
        created_at: nowIso,
        updated_at: nowIso,
      };
      setBudgetItems((prev) => [...prev, newItem]);
      if (isSupabaseConfigured) {
        await syncUpsert('budget_items', newItem);
      }
      addAuditLog('budget_items', newItem.id, 'INSERT', null, newItem, 'Baris anggaran ditambahkan');
    }

    return { success: true };
  };

  const deleteBudgetItem = async (itemId: string): Promise<{ success: boolean; error?: string }> => {
    const item = budgetItems.find((i) => i.id === itemId);
    if (!item) return { success: false, error: 'Baris anggaran tidak ditemukan.' };

    const budget = budgets.find((b) => b.id === item.budget_id);
    if (budget?.status === 'approved') {
      return { success: false, error: 'Anggaran telah Disahkan dan terkunci.' };
    }

    setBudgetItems((prev) => prev.filter((i) => i.id !== itemId));
    if (isSupabaseConfigured) {
      await syncDelete('budget_items', 'id', itemId);
    }
    addAuditLog('budget_items', itemId, 'DELETE', item, null, 'Baris anggaran dihapus');
    return { success: true };
  };

  const changeBudgetStatus = async (
    budgetId: string,
    newStatus: BudgetStatus,
    params?: {
      returnNote?: string;
      rapatDate?: string;
      rapatBeritaAcaraNo?: string;
      rapatDocUrl?: string;
    }
  ): Promise<{ success: boolean; error?: string }> => {
    const budget = budgets.find((b) => b.id === budgetId);
    if (!budget) return { success: false, error: 'Anggaran tidak ditemukan.' };

    // Submitter cannot review/approve their own budget!
    if (newStatus !== 'returned' && budget.created_by === currentUser?.id) {
      if (newStatus === 'reviewed' || newStatus === 'submitted_rapat' || newStatus === 'approved') {
        return {
          success: false,
          error: 'Penyusun anggaran tidak boleh mengesahkan atau meneruskan anggarannya sendiri demi kepatuhan audit.',
        };
      }
    }

    if (newStatus === 'returned' && (!params?.returnNote || params.returnNote.trim() === '')) {
      return { success: false, error: 'Catatan alasan pengembalian anggaran wajib disertakan.' };
    }

    const nowIso = new Date().toISOString();

    const updatedBudget: Budget = {
      ...budget,
      status: newStatus,
      return_note: newStatus === 'returned' ? params?.returnNote : null,
      reviewed_by: newStatus === 'reviewed' ? currentUser?.id : budget.reviewed_by,
      reviewed_at: newStatus === 'reviewed' ? nowIso : budget.reviewed_at,
      submitted_rapat_by: newStatus === 'submitted_rapat' ? currentUser?.id : budget.submitted_rapat_by,
      submitted_rapat_at: newStatus === 'submitted_rapat' ? nowIso : budget.submitted_rapat_at,
      ratified_by: newStatus === 'approved' ? currentUser?.id : budget.ratified_by,
      ratified_at: newStatus === 'approved' ? nowIso : budget.ratified_at,
      rapat_date: newStatus === 'approved' ? (params?.rapatDate || nowIso.split('T')[0]) : budget.rapat_date,
      rapat_berita_acara_no: newStatus === 'approved' ? params?.rapatBeritaAcaraNo : budget.rapat_berita_acara_no,
      rapat_document_url: newStatus === 'approved' ? params?.rapatDocUrl : budget.rapat_document_url,
      is_current_active: newStatus === 'approved' ? true : budget.is_current_active,
      updated_at: nowIso,
    };

    setBudgets((prev) =>
      prev.map((b) => {
        if (b.id === budgetId) return updatedBudget;
        // If this budget is now approved, deactivate all older versions of the same kas and year
        if (newStatus === 'approved' && b.kas_id === budget.kas_id && b.tahun === budget.tahun && b.id !== budgetId) {
          return { ...b, is_current_active: false, updated_at: nowIso };
        }
        return b;
      })
    );

    if (isSupabaseConfigured) {
      await syncUpsert('budgets', updatedBudget);
      if (newStatus === 'approved' && supabase) {
        await supabase
          .from('budgets')
          .update({ is_current_active: false, updated_at: nowIso })
          .eq('kas_id', budget.kas_id)
          .eq('tahun', budget.tahun)
          .neq('id', budgetId);
      }
    }

    addAuditLog(
      'budgets',
      budgetId,
      'STATUS_CHANGE',
      { status: budget.status },
      { status: newStatus, notes: params?.returnNote },
      `Status anggaran diubah menjadi "${newStatus}" oleh ${currentUser?.full_name}`
    );

    return { success: true };
  };

  const createBudgetRevision = async (sourceBudgetId: string): Promise<{ success: boolean; newBudgetId?: string; error?: string }> => {
    const sourceBudget = budgets.find((b) => b.id === sourceBudgetId);
    if (!sourceBudget) return { success: false, error: 'Anggaran asal tidak ditemukan.' };
    if (sourceBudget.status !== 'approved') {
      return { success: false, error: 'Perubahan Anggaran (APBG-P) hanya dapat dibuat dari versi anggaran yang sudah Disahkan.' };
    }

    const existingVersions = budgets
      .filter((b) => b.kas_id === sourceBudget.kas_id && b.tahun === sourceBudget.tahun)
      .map((b) => b.version);
    const newVersion = Math.max(...existingVersions, 0) + 1;

    const newBudgetId = `bgt-${Date.now()}`;
    const newBudget: Budget = {
      ...sourceBudget,
      id: newBudgetId,
      version: newVersion,
      title: `${sourceBudget.title.replace(/\s*\(APBG-P.*?\)/, '')} (APBG-P Versi ${newVersion})`,
      status: 'draft',
      is_current_active: false,
      created_by: currentUser?.id,
      reviewed_by: null,
      reviewed_at: null,
      submitted_rapat_by: null,
      submitted_rapat_at: null,
      ratified_by: null,
      ratified_at: null,
      rapat_date: null,
      rapat_berita_acara_no: null,
      rapat_document_url: null,
      return_note: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Copy all items
    const sourceItems = budgetItems.filter((i) => i.budget_id === sourceBudgetId);
    const copiedItems: BudgetItem[] = sourceItems.map((item) => ({
      ...item,
      id: `bi-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      budget_id: newBudgetId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    setBudgets((prev) => [newBudget, ...prev]);
    setBudgetItems((prev) => [...prev, ...copiedItems]);

    if (isSupabaseConfigured) {
      await syncUpsert('budgets', newBudget);
      if (copiedItems.length > 0) {
        await syncInsert('budget_items', copiedItems);
      }
    }

    addAuditLog(
      'budgets',
      newBudgetId,
      'REVISION_CREATED',
      { source_budget_id: sourceBudgetId, from_version: sourceBudget.version },
      { new_budget_id: newBudgetId, new_version: newVersion },
      `Perubahan Anggaran (APBG-P Versi ${newVersion}) dibuat dari versi ${sourceBudget.version}`
    );

    return { success: true, newBudgetId };
  };

  const reallocateBudget = async (params: {
    budgetId: string;
    fromItemId: string;
    toItemId: string;
    amount: number;
    reason: string;
  }): Promise<{ success: boolean; error?: string }> => {
    const { budgetId, fromItemId, toItemId, amount, reason } = params;
    if (amount <= 0) return { success: false, error: 'Nominal pergeseran harus lebih dari Rp 0.' };
    if (!reason || reason.trim() === '') return { success: false, error: 'Alasan pergeseran anggaran wajib diisi.' };
    if (fromItemId === toItemId) return { success: false, error: 'Baris sumber dan tujuan tidak boleh sama.' };

    const budget = budgets.find((b) => b.id === budgetId);
    if (!budget) return { success: false, error: 'Anggaran tidak ditemukan.' };
    if (budget.status !== 'approved') {
      return { success: false, error: 'Pergeseran anggaran hanya dapat dilakukan pada anggaran yang telah Disahkan.' };
    }

    const fromItem = budgetItems.find((i) => i.id === fromItemId && i.budget_id === budgetId);
    const toItem = budgetItems.find((i) => i.id === toItemId && i.budget_id === budgetId);

    if (!fromItem || !toItem) {
      return { success: false, error: 'Baris anggaran sumber atau tujuan tidak valid.' };
    }

    if (fromItem.type !== toItem.type) {
      return { success: false, error: 'Pergeseran hanya diperbolehkan antar pos yang sejenis (sesama Pengeluaran atau sesama Pemasukan).' };
    }

    if (fromItem.annual_amount < amount) {
      return {
        success: false,
        error: `Nominal pergeseran (Rp ${amount.toLocaleString('id-ID')}) melebihi pagu anggaran baris sumber (Rp ${fromItem.annual_amount.toLocaleString('id-ID')}).`,
      };
    }

    // Check maximum reallocation percentage limit from settings
    if (settings.budget_reallocation_max_pct > 0 && fromItem.type === 'expense') {
      const allExpenseItems = budgetItems.filter((i) => i.budget_id === budgetId && i.type === 'expense');
      const totalExpenseBudget = allExpenseItems.reduce((sum, item) => sum + item.annual_amount, 0);
      const maxAllowed = (settings.budget_reallocation_max_pct / 100) * totalExpenseBudget;

      if (amount > maxAllowed) {
        return {
          success: false,
          error: `Nominal pergeseran (Rp ${amount.toLocaleString('id-ID')}) melebihi batas kebijakan ${settings.budget_reallocation_max_pct}% dari total pagu belanja (Maksimal: Rp ${Math.round(maxAllowed).toLocaleString('id-ID')}). Perubahan ini harus diajukan melalui Perubahan Anggaran (APBG-P) di Rapat Huria.`,
        };
      }
    }

    // Atomically shift amounts and recalculate monthly distributions
    const newFromAnnual = fromItem.annual_amount - amount;
    const newToAnnual = toItem.annual_amount + amount;

    const newFromDist = generateMonthlyDistribution(newFromAnnual);
    const newToDist = generateMonthlyDistribution(newToAnnual);
    const nowIso = new Date().toISOString();

    const updatedFromItem: BudgetItem = {
      ...fromItem,
      annual_amount: newFromAnnual,
      monthly_distribution: newFromDist,
      updated_at: nowIso,
    };
    const updatedToItem: BudgetItem = {
      ...toItem,
      annual_amount: newToAnnual,
      monthly_distribution: newToDist,
      updated_at: nowIso,
    };

    setBudgetItems((prev) =>
      prev.map((item) => {
        if (item.id === fromItemId) return updatedFromItem;
        if (item.id === toItemId) return updatedToItem;
        return item;
      })
    );

    const newReallocation: BudgetReallocation = {
      id: `br-${Date.now()}`,
      budget_id: budgetId,
      kas_id: budget.kas_id,
      tahun: budget.tahun,
      from_item_id: fromItemId,
      to_item_id: toItemId,
      amount,
      reason,
      status: 'approved',
      proposed_by: currentUser?.id,
      approved_by: currentUser?.id,
      approved_at: nowIso,
      created_at: nowIso,
      from_item: fromItem,
      to_item: toItem,
    };

    setBudgetReallocations((prev) => [newReallocation, ...prev]);

    if (isSupabaseConfigured) {
      await syncUpsert('budget_items', [updatedFromItem, updatedToItem]);
      await syncInsert('budget_reallocations', newReallocation);
    }

    addAuditLog(
      'budget_reallocations',
      newReallocation.id,
      'REALLOCATION_APPLIED',
      { from: fromItem.description, to: toItem.description, amount },
      newReallocation,
      `Pergeseran anggaran sebesar Rp ${amount.toLocaleString('id-ID')} disetujui`
    );

    return { success: true };
  };

  const copyBudgetFromPreviousYear = async (
    kasId: string,
    currentYear: number
  ): Promise<{ success: boolean; count?: number; error?: string }> => {
    const prevBudget = budgets.find(
      (b) => b.kas_id === kasId && b.tahun === currentYear - 1 && b.status === 'approved' && b.is_current_active
    );
    if (!prevBudget) {
      return { success: false, error: `Tidak ditemukan anggaran disahkan pada tahun ${currentYear - 1} untuk kas ini.` };
    }

    const prevItems = budgetItems.filter((i) => i.budget_id === prevBudget.id);
    if (prevItems.length === 0) {
      return { success: false, error: 'Anggaran tahun lalu tidak memiliki baris rincian kegiatan.' };
    }

    // Find or create current draft budget
    let targetBudget = budgets.find((b) => b.kas_id === kasId && b.tahun === currentYear && b.status === 'draft');
    let targetBudgetId = targetBudget?.id;

    if (!targetBudget) {
      const createRes = await saveBudget({
        kas_id: kasId,
        tahun: currentYear,
        title: `APBG ${kasList.find((k) => k.id === kasId)?.nama || 'Kas'} Tahun ${currentYear} (Salinan ${currentYear - 1})`,
      });
      if (!createRes.success || !createRes.id) {
        return { success: false, error: createRes.error || 'Gagal membuat anggaran target.' };
      }
      targetBudgetId = createRes.id;
    }

    const newItems: BudgetItem[] = prevItems.map((p) => ({
      ...p,
      id: `bi-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      budget_id: targetBudgetId!,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    setBudgetItems((prev) => [...prev, ...newItems]);
    if (isSupabaseConfigured && newItems.length > 0) {
      await syncInsert('budget_items', newItems);
    }
    addAuditLog('budget_items', targetBudgetId!, 'COPY_PREV_YEAR', null, { count: newItems.length }, `Menyalin ${newItems.length} baris anggaran dari tahun ${currentYear - 1}`);

    return { success: true, count: newItems.length };
  };

  const getBudgetRealization = (kasId: string, year: number, throughMonth: number): BudgetRealizationRow[] => {
    const activeBudget = budgets.find(
      (b) => b.kas_id === kasId && b.tahun === year && b.is_current_active && b.status === 'approved'
    );

    const activeItems = activeBudget ? budgetItems.filter((i) => i.budget_id === activeBudget.id) : [];

    // Calculate actual realization from approved transactions (excluding transfers, including reversals)
    const txApproved = transactions.filter((tx) => {
      if (tx.kas_id !== kasId || tx.status !== 'approved') return false;
      if (tx.type === 'transfer_in' || tx.type === 'transfer_out') return false;
      const d = new Date(tx.tanggal);
      return d.getFullYear() === year && d.getMonth() + 1 <= throughMonth;
    });

    const actualMap: { [catId: string]: number } = {};
    txApproved.forEach((tx) => {
      if (tx.category_id) {
        actualMap[tx.category_id] = (actualMap[tx.category_id] || 0) + Number(tx.amount);
      }
    });

    // Group budget items by category
    const rowMap: { [catId: string]: BudgetRealizationRow } = {};

    categories.forEach((cat) => {
      const itemsForCat = activeItems.filter((i) => i.category_id === cat.id);
      const budgetAnnual = itemsForCat.reduce((sum, item) => sum + item.annual_amount, 0);

      // Sum of months 1 through throughMonth
      const budgetYTD = itemsForCat.reduce((sum, item) => {
        const dist = item.monthly_distribution || generateMonthlyDistribution(item.annual_amount);
        const ytd = dist.slice(0, throughMonth).reduce((s, val) => s + val, 0);
        return sum + ytd;
      }, 0);

      const actualYTD = actualMap[cat.id] || 0;
      const variance = cat.tipe === 'income' ? actualYTD - budgetYTD : budgetYTD - actualYTD;
      const percentage = budgetYTD > 0 ? (actualYTD / budgetYTD) * 100 : 0;

      // Only display if has budget or actual transaction
      if (budgetAnnual > 0 || actualYTD > 0) {
        rowMap[cat.id] = {
          category_id: cat.id,
          category_name: cat.nama,
          category_code: cat.kode,
          type: cat.tipe,
          budget_annual: budgetAnnual,
          budget_ytd: budgetYTD,
          actual_ytd: actualYTD,
          variance,
          percentage,
        };
      }
    });

    return Object.values(rowMap);
  };

  const getConsolidatedBudgetRealization = (
    year: number,
    throughMonth: number
  ): {
    rows: BudgetRealizationRow[];
    totalBudgetAnnual: number;
    totalBudgetYTD: number;
    totalActualYTD: number;
    totalVariance: number;
  } => {
    const allRows: BudgetRealizationRow[] = [];
    kasList.forEach((k) => {
      const rowsForKas = getBudgetRealization(k.id, year, throughMonth);
      allRows.push(...rowsForKas);
    });

    // Consolidate rows by category_id
    const mergedMap: { [catId: string]: BudgetRealizationRow } = {};
    allRows.forEach((row) => {
      if (!mergedMap[row.category_id]) {
        mergedMap[row.category_id] = { ...row };
      } else {
        mergedMap[row.category_id].budget_annual += row.budget_annual;
        mergedMap[row.category_id].budget_ytd += row.budget_ytd;
        mergedMap[row.category_id].actual_ytd += row.actual_ytd;
      }
    });

    const rows = Object.values(mergedMap).map((r) => {
      const variance = r.type === 'income' ? r.actual_ytd - r.budget_ytd : r.budget_ytd - r.actual_ytd;
      const percentage = r.budget_ytd > 0 ? (r.actual_ytd / r.budget_ytd) * 100 : 0;
      return { ...r, variance, percentage };
    });

    const totalBudgetAnnual = rows.reduce((s, r) => s + r.budget_annual, 0);
    const totalBudgetYTD = rows.reduce((s, r) => s + r.budget_ytd, 0);
    const totalActualYTD = rows.reduce((s, r) => s + r.actual_ytd, 0);
    const totalVariance = totalActualYTD - totalBudgetYTD;

    return {
      rows,
      totalBudgetAnnual,
      totalBudgetYTD,
      totalActualYTD,
      totalVariance,
    };
  };

  // ---------------------------------------------------------------------------
  // Modul Saldo Awal & Pembukaan Buku Operations
  // ---------------------------------------------------------------------------
  const isKasOpeningLocked = (kasId: string): boolean => {
    const entries = openingEntries.filter((e) => e.kas_id === kasId);
    if (entries.length > 0) {
      return entries.every((e) => e.status === 'locked');
    }
    return openingBalances.some((ob) => ob.kas_id === kasId);
  };

  const getOpeningStatusForKas = (kasId: string): OpeningBookKasStatus => {
    const entries = openingEntries.filter((e) => e.kas_id === kasId);
    if (entries.length === 0) return 'not_started';
    if (entries.every((e) => e.status === 'locked')) return 'locked';
    if (entries.every((e) => e.status === 'approved' || e.status === 'locked')) return 'approved';
    if (entries.some((e) => e.status === 'submitted')) return 'submitted';
    if (entries.some((e) => e.status === 'drafting')) return 'drafting';
    return 'not_started';
  };

  const saveOpeningEntry = async (
    entryData: Partial<OpeningBalanceEntry>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!entryData.kas_id || !entryData.storage_account_id) {
      return { success: false, error: 'Kas dan Tempat Penyimpanan wajib dipilih.' };
    }

    const currentStatus = getOpeningStatusForKas(entryData.kas_id);
    if (currentStatus === 'locked') {
      return {
        success: false,
        error: 'Saldo awal untuk kas ini telah Dikunci dan tidak dapat diubah langsung. Gunakan Penyesuaian Saldo Awal.',
      };
    }

    const nowIso = new Date().toISOString();
    const existing = openingEntries.find(
      (e) => e.kas_id === entryData.kas_id && e.storage_account_id === entryData.storage_account_id
    );

    const amount = Number(entryData.amount ?? entryData.book_balance ?? 0);
    const bookBalance = Number(entryData.book_balance ?? amount);
    const physicalBalance = Number(entryData.physical_balance ?? bookBalance);
    const difference = physicalBalance - bookBalance;

    if (existing) {
      const updatedEntry: OpeningBalanceEntry = {
        ...existing,
        ...entryData,
        amount,
        book_balance: bookBalance,
        physical_balance: physicalBalance,
        difference,
        status: 'drafting',
        updated_at: nowIso,
      };
      setOpeningEntries((prev) => prev.map((e) => (e.id === existing.id ? updatedEntry : e)));
      if (isSupabaseConfigured) {
        await syncUpsert('opening_balance_entries', updatedEntry);
      }
    } else {
      const newEntry: OpeningBalanceEntry = {
        id: `obe-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        tahun: entryData.tahun || openingSetup.first_year || 2026,
        kas_id: entryData.kas_id,
        storage_account_id: entryData.storage_account_id,
        amount,
        book_balance: bookBalance,
        physical_balance: physicalBalance,
        difference,
        explanation: entryData.explanation || null,
        document_url: entryData.document_url || null,
        status: 'drafting',
        created_by: currentUser?.id,
        created_at: nowIso,
        updated_at: nowIso,
      };
      setOpeningEntries((prev) => [...prev, newEntry]);
      if (isSupabaseConfigured) {
        await syncUpsert('opening_balance_entries', newEntry);
      }
    }

    return { success: true };
  };

  const submitOpeningBook = async (kasId: string): Promise<{ success: boolean; error?: string }> => {
    const entries = openingEntries.filter((e) => e.kas_id === kasId);
    if (entries.length === 0) {
      return { success: false, error: 'Belum ada nominal saldo tempat penyimpanan yang dimasukkan.' };
    }

    const hasUnexplainedDiff = entries.some(
      (e) => e.difference !== 0 && (!e.explanation || e.explanation.trim() === '')
    );
    if (hasUnexplainedDiff) {
      return { success: false, error: 'Terdapat selisih fisik kas/bank yang belum memiliki penjelasan tertulis.' };
    }

    const nowIso = new Date().toISOString();
    setOpeningEntries((prev) =>
      prev.map((e) =>
        e.kas_id === kasId
          ? {
              ...e,
              status: 'submitted',
              submitted_at: nowIso,
              return_note: null,
              updated_at: nowIso,
            }
          : e
      )
    );
    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('opening_balance_entries')
        .update({
          status: 'submitted',
          submitted_at: nowIso,
          return_note: null,
          updated_at: nowIso,
        })
        .eq('kas_id', kasId);
    }

    addAuditLog('opening_balance_entries', kasId, 'SUBMITTED', null, { kasId }, `Saldo awal kas ${kasId} diajukan ke Ketua Kas`);
    return { success: true };
  };

  const approveOpeningBook = async (
    kasId: string,
    approve: boolean,
    returnNote?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const entries = openingEntries.filter((e) => e.kas_id === kasId);
    if (entries.length === 0) return { success: false, error: 'Entri saldo awal tidak ditemukan.' };

    const creator = entries[0]?.created_by;
    if (approve && creator === currentUser?.id && currentUser?.role !== 'admin') {
      return {
        success: false,
        error: 'Penyusun saldo awal tidak boleh menyetujui pengajuannya sendiri demi kepatuhan pemisahan tugas.',
      };
    }

    const nowIso = new Date().toISOString();
    if (approve) {
      setOpeningEntries((prev) =>
        prev.map((e) =>
          e.kas_id === kasId
            ? {
                ...e,
                status: 'approved',
                approved_by: currentUser?.id,
                approved_at: nowIso,
                return_note: null,
                updated_at: nowIso,
              }
            : e
        )
      );
      if (isSupabaseConfigured && supabase) {
        await supabase
          .from('opening_balance_entries')
          .update({
            status: 'approved',
            approved_by: currentUser?.id,
            approved_at: nowIso,
            return_note: null,
            updated_at: nowIso,
          })
          .eq('kas_id', kasId);
      }
      addAuditLog('opening_balance_entries', kasId, 'APPROVED', null, { kasId }, `Saldo awal kas ${kasId} disetujui Ketua Kas`);
    } else {
      if (!returnNote || returnNote.trim() === '') {
        return { success: false, error: 'Catatan pengembalian wajib diisi.' };
      }
      setOpeningEntries((prev) =>
        prev.map((e) =>
          e.kas_id === kasId
            ? {
                ...e,
                status: 'drafting',
                return_note: returnNote,
                updated_at: nowIso,
              }
            : e
        )
      );
      if (isSupabaseConfigured && supabase) {
        await supabase
          .from('opening_balance_entries')
          .update({
            status: 'drafting',
            return_note: returnNote,
            updated_at: nowIso,
          })
          .eq('kas_id', kasId);
      }
      addAuditLog('opening_balance_entries', kasId, 'RETURNED', null, { kasId, returnNote }, `Saldo awal kas ${kasId} dikembalikan: ${returnNote}`);
    }

    return { success: true };
  };

  const lockOpeningBook = async (kasId?: string): Promise<{ success: boolean; count?: number; error?: string }> => {
    const targetKasList = kasId ? [kasId] : kasList.map((k) => k.id);
    const nowIso = new Date().toISOString();

    const entriesToSync = openingEntries.filter((e) => targetKasList.includes(e.kas_id));
    const lockedCount = entriesToSync.length;

    setOpeningEntries((prev) =>
      prev.map((entry) => {
        if (targetKasList.includes(entry.kas_id)) {
          return {
            ...entry,
            status: 'locked',
            locked_by: currentUser?.id,
            locked_at: nowIso,
            updated_at: nowIso,
          };
        }
        return entry;
      })
    );

    // Auto-sync into opening_balances so Phase 1 views work immediately
    const updatedOpeningBalances = [...openingBalances];
    const upsertedBalances: OpeningBalance[] = [];
    entriesToSync.forEach((entry) => {
      const idx = updatedOpeningBalances.findIndex(
        (ob) => ob.kas_id === entry.kas_id && ob.storage_account_id === entry.storage_account_id
      );
      if (idx >= 0) {
        const nextOb: OpeningBalance = {
          ...updatedOpeningBalances[idx],
          amount: entry.amount,
          notes: entry.explanation || 'Saldo pindahan resmi dikunci',
          updated_at: nowIso,
        };
        updatedOpeningBalances[idx] = nextOb;
        upsertedBalances.push(nextOb);
      } else {
        const nextOb: OpeningBalance = {
          id: `ob-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          tahun: entry.tahun || 2026,
          kas_id: entry.kas_id,
          storage_account_id: entry.storage_account_id,
          amount: entry.amount,
          notes: entry.explanation || 'Saldo pindahan resmi dikunci',
          created_at: nowIso,
          updated_at: nowIso,
        };
        updatedOpeningBalances.push(nextOb);
        upsertedBalances.push(nextOb);
      }
    });
    setOpeningBalances(updatedOpeningBalances);

    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('opening_balance_entries')
        .update({
          status: 'locked',
          locked_by: currentUser?.id,
          locked_at: nowIso,
          updated_at: nowIso,
        })
        .in('kas_id', targetKasList);
      if (upsertedBalances.length > 0) {
        await syncUpsert('opening_balances', upsertedBalances);
      }
    }

    addAuditLog(
      'opening_balance_entries',
      kasId || 'all_kas',
      'BOOK_OPENING_LOCKED',
      null,
      { kasId, lockedCount },
      `Pembukaan buku ${kasId ? 'kas ' + kasId : 'seluruh kas'} resmi dikunci oleh ${currentUser?.full_name}`
    );

    return { success: true, count: lockedCount };
  };

  const saveOpeningAdjustment = async (
    adjData: Partial<OpeningBalanceAdjustment>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!adjData.kas_id || !adjData.storage_account_id) {
      return { success: false, error: 'Pilih Kas dan Tempat Penyimpanan.' };
    }
    if (!adjData.amount || adjData.amount === 0) {
      return { success: false, error: 'Nominal penyesuaian tidak boleh nol.' };
    }
    if (!adjData.reason || adjData.reason.trim() === '') {
      return { success: false, error: 'Alasan penyesuaian wajib diisi.' };
    }

    const year = adjData.tahun || openingSetup.first_year || 2026;
    if (isPeriodClosed(year, 1, adjData.kas_id)) {
      return {
        success: false,
        error: `Bulan Januari ${year} telah ditutup buku. Penyesuaian saldo awal tidak diperkenankan lagi; silakan catat melalui transaksi koreksi biasa di periode berjalan.`,
      };
    }

    const newAdj: OpeningBalanceAdjustment = {
      id: `adj-${Date.now()}`,
      tahun: year,
      kas_id: adjData.kas_id,
      storage_account_id: adjData.storage_account_id,
      amount: Number(adjData.amount),
      reason: adjData.reason.trim(),
      document_url: adjData.document_url || null,
      status: 'submitted',
      proposed_by: currentUser?.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setOpeningAdjustments((prev) => [newAdj, ...prev]);
    if (isSupabaseConfigured) {
      await syncInsert('opening_balance_adjustments', newAdj);
    }
    addAuditLog('opening_balance_adjustments', newAdj.id, 'ADJUSTMENT_SUBMITTED', null, newAdj, `Penyesuaian saldo awal diajukan: ${adjData.reason}`);
    return { success: true };
  };

  const approveOpeningAdjustment = async (
    adjId: string,
    approve: boolean,
    rejectNote?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const adj = openingAdjustments.find((a) => a.id === adjId);
    if (!adj) return { success: false, error: 'Penyesuaian tidak ditemukan.' };

    const nowIso = new Date().toISOString();
    if (!approve) {
      setOpeningAdjustments((prev) =>
        prev.map((a) => (a.id === adjId ? { ...a, status: 'rejected', reject_note: rejectNote, updated_at: nowIso } : a))
      );
      if (isSupabaseConfigured) {
        await syncUpdate(
          'opening_balance_adjustments',
          { status: 'rejected', reject_note: rejectNote, updated_at: nowIso },
          'id',
          adjId
        );
      }
      addAuditLog('opening_balance_adjustments', adjId, 'ADJUSTMENT_REJECTED', adj, { rejectNote }, `Penyesuaian ditolak`);
      return { success: true };
    }

    if (adj.status === 'submitted') {
      setOpeningAdjustments((prev) =>
        prev.map((a) =>
          a.id === adjId
            ? {
                ...a,
                status: 'approved_ketua',
                approved_ketua_by: currentUser?.id,
                approved_ketua_at: nowIso,
                updated_at: nowIso,
              }
            : a
        )
      );
      if (isSupabaseConfigured) {
        await syncUpdate(
          'opening_balance_adjustments',
          {
            status: 'approved_ketua',
            approved_ketua_by: currentUser?.id,
            approved_ketua_at: nowIso,
            updated_at: nowIso,
          },
          'id',
          adjId
        );
      }
      addAuditLog('opening_balance_adjustments', adjId, 'ADJUSTMENT_APPROVED_KETUA', null, null, `Penyesuaian disetujui Ketua Kas`);
    } else if (adj.status === 'approved_ketua') {
      setOpeningAdjustments((prev) =>
        prev.map((a) =>
          a.id === adjId
            ? {
                ...a,
                status: 'approved_bendum',
                approved_bendum_by: currentUser?.id,
                approved_bendum_at: nowIso,
                updated_at: nowIso,
              }
            : a
        )
      );

      // Apply adjustment directly to opening_balances & opening_balance_entries
      const updatedObs = openingBalances
        .filter((ob) => ob.kas_id === adj.kas_id && ob.storage_account_id === adj.storage_account_id)
        .map((ob) => ({
          ...ob,
          amount: ob.amount + adj.amount,
          notes: `${ob.notes || ''} [Disesuaikan Rp ${adj.amount.toLocaleString('id-ID')}: ${adj.reason}]`,
          updated_at: nowIso,
        }));
      setOpeningBalances((prev) =>
        prev.map((ob) => {
          const match = updatedObs.find((u) => u.id === ob.id);
          return match || ob;
        })
      );

      const updatedObes = openingEntries
        .filter((obe) => obe.kas_id === adj.kas_id && obe.storage_account_id === adj.storage_account_id)
        .map((obe) => ({
          ...obe,
          amount: obe.amount + adj.amount,
          updated_at: nowIso,
        }));
      setOpeningEntries((prev) =>
        prev.map((obe) => {
          const match = updatedObes.find((u) => u.id === obe.id);
          return match || obe;
        })
      );

      if (isSupabaseConfigured) {
        await syncUpdate(
          'opening_balance_adjustments',
          {
            status: 'approved_bendum',
            approved_bendum_by: currentUser?.id,
            approved_bendum_at: nowIso,
            updated_at: nowIso,
          },
          'id',
          adjId
        );
        if (updatedObs.length > 0) await syncUpsert('opening_balances', updatedObs);
        if (updatedObes.length > 0) await syncUpsert('opening_balance_entries', updatedObes);
      }

      addAuditLog('opening_balance_adjustments', adjId, 'ADJUSTMENT_FINALIZED', null, null, `Penyesuaian saldo awal diterapkan ke buku kas`);
    }

    return { success: true };
  };

  const saveOpeningOtherPosition = async (
    posData: Partial<OpeningOtherPosition>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!posData.name || !posData.kas_id) {
      return { success: false, error: 'Nama posisi dan Kas wajib diisi.' };
    }
    const nowIso = new Date().toISOString();
    if (posData.id) {
      const existing = openingOtherPositions.find((p) => p.id === posData.id);
      const updatedPos = existing
        ? ({ ...existing, ...posData } as OpeningOtherPosition)
        : ({
            id: posData.id,
            tahun: posData.tahun || openingSetup.first_year || 2026,
            kas_id: posData.kas_id,
            type: posData.type || 'asset',
            name: posData.name,
            amount: Number(posData.amount || 0),
          } as OpeningOtherPosition);
      setOpeningOtherPositions((prev) => prev.map((p) => (p.id === posData.id ? updatedPos : p)));
      if (isSupabaseConfigured) {
        await syncUpsert('opening_other_positions', updatedPos);
      }
    } else {
      const newPos: OpeningOtherPosition = {
        id: `oop-${Date.now()}`,
        tahun: posData.tahun || openingSetup.first_year || 2026,
        kas_id: posData.kas_id,
        type: posData.type || 'asset',
        name: posData.name,
        category: posData.category || null,
        acquisition_year: posData.acquisition_year || null,
        amount: Number(posData.amount || 0),
        condition: posData.condition || null,
        location: posData.location || null,
        section_manager: posData.section_manager || null,
        notes: posData.notes || null,
        created_at: nowIso,
      };
      setOpeningOtherPositions((prev) => [newPos, ...prev]);
      if (isSupabaseConfigured) {
        await syncUpsert('opening_other_positions', newPos);
      }
    }
    return { success: true };
  };

  const deleteOpeningOtherPosition = async (id: string): Promise<{ success: boolean; error?: string }> => {
    setOpeningOtherPositions((prev) => prev.filter((p) => p.id !== id));
    if (isSupabaseConfigured) {
      await syncDelete('opening_other_positions', 'id', id);
    }
    return { success: true };
  };

  const savePriorYearSummary = async (
    summaryData: Partial<PriorYearSummary>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!summaryData.kas_id || !summaryData.category_id) {
      return { success: false, error: 'Pilih Kas dan Kategori.' };
    }
    const existing = priorYearSummaries.find(
      (p) =>
        p.kas_id === summaryData.kas_id &&
        p.category_id === summaryData.category_id &&
        p.tahun === summaryData.tahun
    );
    if (existing) {
      const updatedSummary = { ...existing, ...summaryData } as PriorYearSummary;
      setPriorYearSummaries((prev) => prev.map((p) => (p.id === existing.id ? updatedSummary : p)));
      if (isSupabaseConfigured) {
        await syncUpsert('prior_year_summaries', updatedSummary);
      }
    } else {
      const newSummary: PriorYearSummary = {
        id: `pys-${Date.now()}`,
        tahun: summaryData.tahun || 2025,
        kas_id: summaryData.kas_id,
        category_id: summaryData.category_id,
        jumlah: Number(summaryData.jumlah || 0),
        sumber: 'manual',
        locked: true,
        created_at: new Date().toISOString(),
      };
      setPriorYearSummaries((prev) => [...prev, newSummary]);
      if (isSupabaseConfigured) {
        await syncUpsert('prior_year_summaries', newSummary);
      }
    }
    return { success: true };
  };

  const updateOpeningSetup = async (setupData: Partial<OpeningSetup>): Promise<{ success: boolean; error?: string }> => {
    const updatedSetup: OpeningSetup = {
      ...openingSetup,
      ...setupData,
      id: openingSetup.id || 'main',
      updated_at: new Date().toISOString(),
    };
    setOpeningSetup(updatedSetup);
    if (isSupabaseConfigured) {
      await syncUpsert('opening_setup', updatedSetup);
    }
    return { success: true };
  };

  // ---------------------------------------------------------------------------
  // LPJ SUPPORTING DATA OPERATIONS (ISAK 35 - MODIFIED CASH BASIS)
  // ---------------------------------------------------------------------------

  const calculateDepreciation = (asset: FixedAsset, year: number) => {
    if (!lpjSettings.enable_depreciation || asset.useful_life_years <= 0) {
      return {
        annualDepreciation: 0,
        accumulatedDepreciation: 0,
        bookValue: asset.nilai_perolehan,
      };
    }
    const acqYear = new Date(asset.tanggal_perolehan).getFullYear() || 2026;
    const depreciable = Math.max(0, asset.nilai_perolehan - (asset.salvage_value || 0));
    const annual = Math.round(depreciable / asset.useful_life_years);
    const yearsElapsed = Math.max(0, Math.min(asset.useful_life_years, year - acqYear));
    const accumulated = Math.min(depreciable, annual * yearsElapsed);
    const bookVal = Math.max(asset.salvage_value || 0, asset.nilai_perolehan - accumulated);

    return {
      annualDepreciation: annual,
      accumulatedDepreciation: accumulated,
      bookValue: bookVal,
    };
  };

  const saveFixedAsset = async (assetData: Partial<FixedAsset>): Promise<{ success: boolean; id?: string; error?: string }> => {
    if (!assetData.nama || !assetData.kategori || !assetData.kas_id) {
      return { success: false, error: 'Nama aset, kategori, dan Kas pengelola wajib diisi.' };
    }
    if (assetData.nilai_perolehan === undefined || assetData.nilai_perolehan < 0) {
      return { success: false, error: 'Nilai perolehan aset harus bernilai positif atau 0.' };
    }

    const nowIso = new Date().toISOString();
    let assetId = assetData.id;

    if (assetId) {
      const existingAsset = fixedAssets.find((a) => a.id === assetId);
      const updatedAsset = { ...existingAsset, ...assetData, updated_at: nowIso } as FixedAsset;
      setFixedAssets((prev) => prev.map((a) => (a.id === assetId ? updatedAsset : a)));
      if (isSupabaseConfigured) {
        await syncUpsert('fixed_assets', updatedAsset);
      }
      addAuditLog('fixed_assets', assetId, 'UPDATE', null, assetData, `Memperbarui aset ${assetData.nama}`);
    } else {
      assetId = `ast-${Date.now()}`;
      const defaultUseful = lpjSettings.useful_life_defaults[assetData.kategori || 'lainnya'] ?? 5;
      const newAsset: FixedAsset = {
        id: assetId,
        kode: assetData.kode || `AST-${new Date().getFullYear()}-${String(fixedAssets.length + 1).padStart(3, '0')}`,
        nama: assetData.nama,
        kategori: assetData.kategori,
        tanggal_perolehan: assetData.tanggal_perolehan || new Date().toISOString().split('T')[0],
        nilai_perolehan: Number(assetData.nilai_perolehan),
        kondisi: assetData.kondisi || 'baik',
        lokasi: assetData.lokasi || 'Kompleks Gereja HKBP Hutaraja',
        kas_id: assetData.kas_id,
        status: 'aktif',
        foto_url: assetData.foto_url || null,
        dokumen_url: assetData.dokumen_url || null,
        notes: assetData.notes || null,
        transaction_id: assetData.transaction_id || null,
        useful_life_years: assetData.useful_life_years !== undefined ? Number(assetData.useful_life_years) : defaultUseful,
        salvage_value: Number(assetData.salvage_value || 0),
        created_by: currentUser?.id,
        created_at: nowIso,
        updated_at: nowIso,
      };
      setFixedAssets((prev) => [newAsset, ...prev]);
      if (isSupabaseConfigured) {
        await syncUpsert('fixed_assets', newAsset);
      }
      addAuditLog('fixed_assets', assetId, 'INSERT', null, newAsset, `Menambahkan aset inventaris ${newAsset.nama}`);
    }

    return { success: true, id: assetId };
  };

  const deleteFixedAsset = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const asset = fixedAssets.find((a) => a.id === id);
    if (!asset) return { success: false, error: 'Aset tidak ditemukan.' };
    setFixedAssets((prev) => prev.filter((a) => a.id !== id));
    if (isSupabaseConfigured) {
      await syncDelete('fixed_assets', 'id', id);
    }
    addAuditLog('fixed_assets', id, 'DELETE', asset, null, `Menghapus aset ${asset.nama}`);
    return { success: true };
  };

  const proposeAssetDisposal = async (
    id: string,
    actionType: 'diajukan_penghapusan' | 'diajukan_hibah',
    reason: string
  ): Promise<{ success: boolean; error?: string }> => {
    const asset = fixedAssets.find((a) => a.id === id);
    if (!asset) return { success: false, error: 'Aset tidak ditemukan.' };
    if (asset.status !== 'aktif') {
      return { success: false, error: 'Hanya aset berstatus aktif yang dapat diajukan penghapusan atau hibah.' };
    }
    if (!reason.trim()) {
      return { success: false, error: 'Alasan penghapusan atau hibah wajib diisi.' };
    }

    const nowIso = new Date().toISOString();
    setFixedAssets((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status: actionType,
              disposal_reason: reason,
              disposal_proposed_by: currentUser?.id,
              updated_at: nowIso,
            }
          : a
      )
    );
    if (isSupabaseConfigured) {
      await syncUpdate(
        'fixed_assets',
        {
          status: actionType,
          disposal_reason: reason,
          disposal_proposed_by: currentUser?.id,
          updated_at: nowIso,
        },
        'id',
        id
      );
    }
    addAuditLog('fixed_assets', id, 'PROPOSE_DISPOSAL', null, { actionType, reason }, `Mengajukan ${actionType.replace('_', ' ')} aset ${asset.nama}`);
    return { success: true };
  };

  const approveAssetDisposal = async (
    id: string,
    approve: boolean,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const asset = fixedAssets.find((a) => a.id === id);
    if (!asset) return { success: false, error: 'Aset tidak ditemukan.' };

    if (asset.disposal_proposed_by === currentUser?.id) {
      return { success: false, error: 'Penyusun usulan tidak boleh menyetujui pengajuannya sendiri (Segregation of Duties).' };
    }

    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];

    if (approve) {
      const finalStatus = asset.status === 'diajukan_penghapusan' ? 'dihapus' : 'dihibahkan';
      const updatedNotes = notes ? `${asset.notes || ''}\nPersetujuan: ${notes}` : asset.notes;
      setFixedAssets((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                status: finalStatus,
                disposal_date: todayStr,
                disposal_approved_by: currentUser?.id,
                disposal_approved_at: nowIso,
                notes: updatedNotes,
                updated_at: nowIso,
              }
            : a
        )
      );
      if (isSupabaseConfigured) {
        await syncUpdate(
          'fixed_assets',
          {
            status: finalStatus,
            disposal_date: todayStr,
            disposal_approved_by: currentUser?.id,
            disposal_approved_at: nowIso,
            notes: updatedNotes,
            updated_at: nowIso,
          },
          'id',
          id
        );
      }
      addAuditLog('fixed_assets', id, 'APPROVE_DISPOSAL', null, { status: finalStatus, notes }, `Menyetujui ${finalStatus} aset ${asset.nama}`);
    } else {
      const updatedNotes = notes ? `${asset.notes || ''}\nPenolakan penghapusan: ${notes}` : asset.notes;
      setFixedAssets((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                status: 'aktif',
                disposal_reason: null,
                disposal_proposed_by: null,
                notes: updatedNotes,
                updated_at: nowIso,
              }
            : a
        )
      );
      if (isSupabaseConfigured) {
        await syncUpdate(
          'fixed_assets',
          {
            status: 'aktif',
            disposal_reason: null,
            disposal_proposed_by: null,
            notes: updatedNotes,
            updated_at: nowIso,
          },
          'id',
          id
        );
      }
      addAuditLog('fixed_assets', id, 'REJECT_DISPOSAL', null, { notes }, `Menolak usulan penghapusan aset ${asset.nama}`);
    }

    return { success: true };
  };

  const saveAdvance = async (advanceData: Partial<Advance>): Promise<{ success: boolean; id?: string; error?: string }> => {
    if (!advanceData.recipient_name || !advanceData.kas_id || !advanceData.purpose) {
      return { success: false, error: 'Nama penerima, Kas, dan tujuan kegiatan panjar wajib diisi.' };
    }
    if (!advanceData.amount || advanceData.amount <= 0) {
      return { success: false, error: 'Nominal panjar harus lebih besar dari 0.' };
    }
    if (!advanceData.due_date) {
      return { success: false, error: 'Batas waktu pertanggungjawaban (jatuh tempo) wajib diisi.' };
    }

    const nowIso = new Date().toISOString();
    let advId = advanceData.id;

    if (advId) {
      const existingAdv = advances.find((a) => a.id === advId);
      const updatedAdv = { ...existingAdv, ...advanceData, updated_at: nowIso } as Advance;
      setAdvances((prev) => prev.map((a) => (a.id === advId ? updatedAdv : a)));
      if (isSupabaseConfigured) {
        await syncUpsert('advances', updatedAdv);
      }
      addAuditLog('advances', advId, 'UPDATE', null, advanceData, `Memperbarui data panjar ${advanceData.kode}`);
    } else {
      advId = `adv-${Date.now()}`;
      const newAdv: Advance = {
        id: advId,
        kode: advanceData.kode || `PJR-${new Date().getFullYear()}-${String(advances.length + 1).padStart(3, '0')}`,
        kas_id: advanceData.kas_id,
        storage_account_id: advanceData.storage_account_id || null,
        recipient_name: advanceData.recipient_name,
        recipient_phone: advanceData.recipient_phone || null,
        amount: Number(advanceData.amount),
        advance_date: advanceData.advance_date || nowIso.split('T')[0],
        due_date: advanceData.due_date,
        purpose: advanceData.purpose,
        status: 'active',
        transaction_id: advanceData.transaction_id || null,
        created_by: currentUser?.id,
        created_at: nowIso,
        updated_at: nowIso,
      };
      setAdvances((prev) => [newAdv, ...prev]);
      if (isSupabaseConfigured) {
        await syncUpsert('advances', newAdv);
      }
      addAuditLog('advances', advId, 'INSERT', null, newAdv, `Mencatat panjar kegiatan ${newAdv.purpose} (${newAdv.recipient_name})`);
    }

    return { success: true, id: advId };
  };

  const deleteAdvance = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const adv = advances.find((a) => a.id === id);
    if (!adv) return { success: false, error: 'Data panjar tidak ditemukan.' };
    setAdvances((prev) => prev.filter((a) => a.id !== id));
    setAdvanceSettlements((prev) => prev.filter((s) => s.advance_id !== id));
    if (isSupabaseConfigured) {
      await syncDelete('advance_settlements', 'advance_id', id);
      await syncDelete('advances', 'id', id);
    }
    addAuditLog('advances', id, 'DELETE', adv, null, `Menghapus panjar ${adv.kode}`);
    return { success: true };
  };

  const saveAdvanceSettlement = async (
    settlementData: Partial<AdvanceSettlement>
  ): Promise<{ success: boolean; id?: string; error?: string }> => {
    if (!settlementData.advance_id || !settlementData.notes) {
      return { success: false, error: 'Panjar terkait dan uraian realisasi belanja wajib diisi.' };
    }
    const adv = advances.find((a) => a.id === settlementData.advance_id);
    if (!adv) return { success: false, error: 'Panjar tidak ditemukan.' };

    const spent = Number(settlementData.spent_amount || 0);
    const diff = adv.amount - spent;
    const remainingReturned = diff > 0 ? diff : 0;
    const deficitReimbursed = diff < 0 ? Math.abs(diff) : 0;

    const nowIso = new Date().toISOString();
    let setlId = settlementData.id;

    if (setlId) {
      const existingSetl = advanceSettlements.find((s) => s.id === setlId);
      const updatedSetl = {
        ...existingSetl,
        ...settlementData,
        spent_amount: spent,
        remaining_returned: remainingReturned,
        deficit_reimbursed: deficitReimbursed,
        updated_at: nowIso,
      } as AdvanceSettlement;
      setAdvanceSettlements((prev) => prev.map((s) => (s.id === setlId ? updatedSetl : s)));
      if (isSupabaseConfigured) {
        await syncUpsert('advance_settlements', updatedSetl);
      }
    } else {
      setlId = `set-${Date.now()}`;
      const newSetl: AdvanceSettlement = {
        id: setlId,
        advance_id: settlementData.advance_id,
        settlement_date: settlementData.settlement_date || nowIso.split('T')[0],
        spent_amount: spent,
        remaining_returned: remainingReturned,
        deficit_reimbursed: deficitReimbursed,
        notes: settlementData.notes,
        receipt_url: settlementData.receipt_url || null,
        status: 'draft',
        submitted_by: currentUser?.id,
        created_at: nowIso,
        updated_at: nowIso,
      };
      setAdvanceSettlements((prev) => [newSetl, ...prev]);
      if (isSupabaseConfigured) {
        await syncUpsert('advance_settlements', newSetl);
      }
    }

    return { success: true, id: setlId };
  };

  const submitAdvanceSettlement = async (settlementId: string): Promise<{ success: boolean; error?: string }> => {
    const setl = advanceSettlements.find((s) => s.id === settlementId);
    if (!setl) return { success: false, error: 'Data pertanggungjawaban tidak ditemukan.' };

    const nowIso = new Date().toISOString();
    setAdvanceSettlements((prev) =>
      prev.map((s) => (s.id === settlementId ? { ...s, status: 'submitted', submitted_by: currentUser?.id, updated_at: nowIso } : s))
    );
    if (isSupabaseConfigured) {
      await syncUpdate(
        'advance_settlements',
        { status: 'submitted', submitted_by: currentUser?.id, updated_at: nowIso },
        'id',
        settlementId
      );
    }
    addAuditLog('advance_settlements', settlementId, 'SUBMIT', null, null, `Mengajukan SPJ panjar ke Ketua Kas`);
    return { success: true };
  };

  const approveAdvanceSettlement = async (
    settlementId: string,
    approve: boolean,
    rejectNote?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const setl = advanceSettlements.find((s) => s.id === settlementId);
    if (!setl) return { success: false, error: 'Data pertanggungjawaban tidak ditemukan.' };

    if (setl.submitted_by === currentUser?.id) {
      return { success: false, error: 'Penyusun pertanggungjawaban panjar tidak diperbolehkan menyetujui laporannya sendiri (Segregation of Duties).' };
    }

    const nowIso = new Date().toISOString();

    if (approve) {
      setAdvanceSettlements((prev) =>
        prev.map((s) =>
          s.id === settlementId
            ? {
                ...s,
                status: 'approved',
                approved_by: currentUser?.id,
                approved_at: nowIso,
                updated_at: nowIso,
              }
            : s
        )
      );

      // Tandai panjar sebagai tuntas (settled)
      setAdvances((prev) =>
        prev.map((a) => (a.id === setl.advance_id ? { ...a, status: 'settled', settled_at: nowIso, updated_at: nowIso } : a))
      );

      if (isSupabaseConfigured) {
        await syncUpdate(
          'advance_settlements',
          { status: 'approved', approved_by: currentUser?.id, approved_at: nowIso, updated_at: nowIso },
          'id',
          settlementId
        );
        await syncUpdate(
          'advances',
          { status: 'settled', settled_at: nowIso, updated_at: nowIso },
          'id',
          setl.advance_id
        );
      }

      addAuditLog('advance_settlements', settlementId, 'APPROVE', null, null, `Menyetujui SPJ panjar`);
    } else {
      const finalRejectNote = rejectNote || 'Perlu perbaikan bukti kuitansi';
      setAdvanceSettlements((prev) =>
        prev.map((s) =>
          s.id === settlementId
            ? {
                ...s,
                status: 'rejected',
                reject_note: finalRejectNote,
                updated_at: nowIso,
              }
            : s
        )
      );
      if (isSupabaseConfigured) {
        await syncUpdate(
          'advance_settlements',
          { status: 'rejected', reject_note: finalRejectNote, updated_at: nowIso },
          'id',
          settlementId
        );
      }
      addAuditLog('advance_settlements', settlementId, 'REJECT', null, { rejectNote }, `Mengembalikan SPJ panjar`);
    }

    return { success: true };
  };

  const saveReceivablePayable = async (
    data: Partial<ReceivablePayable>
  ): Promise<{ success: boolean; id?: string; error?: string }> => {
    if (!data.counterparty_name || !data.kas_id || !data.description) {
      return { success: false, error: 'Nama pihak terkait, Kas pengelola, dan deskripsi wajib diisi.' };
    }
    if (!data.amount || data.amount <= 0) {
      return { success: false, error: 'Nominal pokok harus lebih dari 0.' };
    }

    const nowIso = new Date().toISOString();
    let rpId = data.id;

    if (rpId) {
      const existingRp = receivablesPayables.find((rp) => rp.id === rpId);
      const updatedRp = { ...existingRp, ...data, updated_at: nowIso } as ReceivablePayable;
      setReceivablesPayables((prev) => prev.map((rp) => (rp.id === rpId ? updatedRp : rp)));
      if (isSupabaseConfigured) {
        await syncUpsert('receivables_payables', updatedRp);
      }
      addAuditLog('receivables_payables', rpId, 'UPDATE', null, data, `Memperbarui ${data.type || 'piutang/utang'} ${data.kode}`);
    } else {
      rpId = `rp-${Date.now()}`;
      const prefix = data.type === 'receivable' ? 'PIU' : 'UTG';
      const newRp: ReceivablePayable = {
        id: rpId,
        type: data.type || 'receivable',
        kode: data.kode || `${prefix}-${new Date().getFullYear()}-${String(receivablesPayables.length + 1).padStart(3, '0')}`,
        kas_id: data.kas_id,
        counterparty_name: data.counterparty_name,
        counterparty_contact: data.counterparty_contact || null,
        amount: Number(data.amount),
        remaining_amount: Number(data.amount),
        issue_date: data.issue_date || nowIso.split('T')[0],
        due_date: data.due_date || null,
        status: 'active',
        description: data.description,
        document_url: data.document_url || null,
        created_by: currentUser?.id,
        created_at: nowIso,
        updated_at: nowIso,
        payments: [],
      };
      setReceivablesPayables((prev) => [newRp, ...prev]);
      if (isSupabaseConfigured) {
        await syncUpsert('receivables_payables', newRp);
      }
      addAuditLog('receivables_payables', rpId, 'INSERT', null, newRp, `Mencatat ${newRp.type === 'receivable' ? 'piutang' : 'utang'} ${newRp.description}`);
    }

    return { success: true, id: rpId };
  };

  const deleteReceivablePayable = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const item = receivablesPayables.find((rp) => rp.id === id);
    if (!item) return { success: false, error: 'Data tidak ditemukan.' };
    setReceivablesPayables((prev) => prev.filter((rp) => rp.id !== id));
    if (isSupabaseConfigured) {
      await syncDelete('receivable_payable_payments', 'parent_id', id);
      await syncDelete('receivables_payables', 'id', id);
    }
    addAuditLog('receivables_payables', id, 'DELETE', item, null, `Menghapus data ${item.type} ${item.kode}`);
    return { success: true };
  };

  const recordReceivablePayablePayment = async (
    id: string,
    paymentAmount: number,
    paymentDate: string,
    storageId?: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const item = receivablesPayables.find((rp) => rp.id === id);
    if (!item) return { success: false, error: 'Data piutang/utang tidak ditemukan.' };

    if (paymentAmount <= 0) {
      return { success: false, error: 'Nominal pembayaran harus lebih besar dari 0.' };
    }
    if (paymentAmount > item.remaining_amount) {
      return { success: false, error: 'Nominal pembayaran melebihi sisa saldo berjalan.' };
    }

    const nowIso = new Date().toISOString();
    const newRemaining = Math.max(0, item.remaining_amount - paymentAmount);
    const newStatus = newRemaining === 0 ? 'paid' : 'partially_paid';

    const newPayment: ReceivablePayablePayment = {
      id: `pay-${Date.now()}`,
      parent_id: id,
      payment_date: paymentDate || nowIso.split('T')[0],
      payment_amount: paymentAmount,
      storage_account_id: storageId || null,
      notes: notes || null,
      created_by: currentUser?.id,
      created_at: nowIso,
    };

    setReceivablesPayables((prev) =>
      prev.map((rp) =>
        rp.id === id
          ? {
              ...rp,
              remaining_amount: newRemaining,
              status: newStatus,
              payments: [newPayment, ...(rp.payments || [])],
              updated_at: nowIso,
            }
          : rp
      )
    );

    if (isSupabaseConfigured) {
      await syncInsert('receivable_payable_payments', newPayment);
      await syncUpdate(
        'receivables_payables',
        { remaining_amount: newRemaining, status: newStatus, updated_at: nowIso },
        'id',
        id
      );
    }

    addAuditLog(
      'receivable_payable_payments',
      newPayment.id,
      'PAYMENT_RECORDED',
      null,
      { paymentAmount, remaining: newRemaining },
      `Mencatat pelunasan ${item.type} ${item.kode} sebesar Rp ${paymentAmount.toLocaleString('id-ID')}`
    );

    return { success: true };
  };

  const saveLpjNotes = async (notesData: Partial<LpjNotes>): Promise<{ success: boolean; error?: string }> => {
    const nowIso = new Date().toISOString();
    const updatedNotes: LpjNotes = {
      ...lpjNotes,
      ...notesData,
      updated_by: currentUser?.id,
      updated_at: nowIso,
    };
    setLpjNotes(updatedNotes);
    if (isSupabaseConfigured) {
      await syncUpsert('lpj_notes', updatedNotes);
    }
    addAuditLog('lpj_notes', updatedNotes.id, 'UPDATE', null, notesData, `Memperbarui Catatan atas Laporan Keuangan (CaLK)`);
    return { success: true };
  };

  const updateLpjSettings = async (newSettings: Partial<LpjSettings>): Promise<{ success: boolean; error?: string }> => {
    const nowIso = new Date().toISOString();
    const updatedLpjSettings: LpjSettings = {
      ...lpjSettings,
      ...newSettings,
      id: lpjSettings.id || 'main',
      updated_by: currentUser?.id,
      updated_at: nowIso,
    };
    setLpjSettings(updatedLpjSettings);
    if (isSupabaseConfigured) {
      await syncUpsert('lpj_settings', updatedLpjSettings);
    }
    addAuditLog('lpj_settings', 'main', 'UPDATE', null, newSettings, `Memperbarui pengaturan format dan kebijakan LPJ`);
    return { success: true };
  };

  const updateKasFundType = async (
    kasId: string,
    fundType: FundType,
    restrictedPurpose?: string | null
  ): Promise<{ success: boolean; error?: string }> => {
    const nowIso = new Date().toISOString();
    const existingKas = kasList.find((k) => k.id === kasId);
    const nextRestrictedPurpose = fundType === 'restricted' ? restrictedPurpose || existingKas?.restricted_purpose : null;
    setKasList((prev) =>
      prev.map((k) =>
        k.id === kasId
          ? {
              ...k,
              fund_type: fundType,
              restricted_purpose: nextRestrictedPurpose,
              updated_at: nowIso,
            }
          : k
      )
    );
    if (isSupabaseConfigured) {
      await syncUpdate(
        'kas',
        { fund_type: fundType, restricted_purpose: nextRestrictedPurpose, updated_at: nowIso },
        'id',
        kasId
      );
    }
    addAuditLog('kas', kasId, 'UPDATE_FUND_TYPE', null, { fundType, restrictedPurpose }, `Mengubah klasifikasi dana kas`);
    return { success: true };
  };

  const migrateOpeningPositionsToLpj = async (): Promise<{
    success: boolean;
    count?: { assets: number; advances: number; rp: number };
    error?: string;
  }> => {
    const nowIso = new Date().toISOString();

    // 1. Migrasi Aset
    const assetPositions = openingOtherPositions.filter((p) => p.type === 'asset');
    const nextAssets = [...fixedAssets];
    const newlyCreatedAssets: FixedAsset[] = [];
    assetPositions.forEach((pos) => {
      const exists = nextAssets.some((a) => a.nama.toLowerCase() === pos.name.toLowerCase());
      if (!exists) {
        const cat = pos.category?.toLowerCase() || '';
        let kategori: FixedAssetCategory = 'lainnya';
        if (cat.includes('tanah')) kategori = 'tanah';
        else if (cat.includes('bangunan') || cat.includes('gedung')) kategori = 'bangunan';
        else if (cat.includes('kendaraan') || cat.includes('mobil') || cat.includes('motor')) kategori = 'kendaraan';
        else if (cat.includes('musik')) kategori = 'alat_musik';
        else if (cat.includes('elektronik') || cat.includes('sound')) kategori = 'elektronik';
        else if (cat.includes('perabot') || cat.includes('kursi')) kategori = 'perabot';

        const useful = lpjSettings.useful_life_defaults[kategori] ?? 5;
        const newAsset: FixedAsset = {
          id: `ast-mig-${pos.id}`,
          kode: `AST-AWAL-${String(nextAssets.length + 1).padStart(3, '0')}`,
          nama: pos.name,
          kategori,
          tanggal_perolehan: pos.acquisition_year ? `${pos.acquisition_year}-01-01` : '2023-01-01',
          nilai_perolehan: Number(pos.amount),
          kondisi: (pos.condition as FixedAssetCondition) || 'baik',
          lokasi: pos.location || 'Kompleks Gereja HKBP Hutaraja',
          kas_id: pos.kas_id,
          status: 'aktif',
          notes: pos.notes || 'Dipindahkan dari modul Saldo Awal',
          useful_life_years: useful,
          salvage_value: 0,
          created_at: nowIso,
          updated_at: nowIso,
        };
        nextAssets.push(newAsset);
        newlyCreatedAssets.push(newAsset);
      }
    });
    if (newlyCreatedAssets.length > 0) setFixedAssets(nextAssets);

    // 2. Migrasi Panjar
    const advancePositions = openingOtherPositions.filter((p) => p.type === 'advance');
    const nextAdvances = [...advances];
    const newlyCreatedAdvances: Advance[] = [];
    advancePositions.forEach((pos) => {
      const exists = nextAdvances.some((a) => a.purpose.toLowerCase() === pos.name.toLowerCase());
      if (!exists) {
        const newAdv: Advance = {
          id: `adv-mig-${pos.id}`,
          kode: `PJR-AWAL-${String(nextAdvances.length + 1).padStart(3, '0')}`,
          kas_id: pos.kas_id,
          recipient_name: pos.section_manager || 'Pengurus Kegiatan',
          amount: Number(pos.amount),
          advance_date: '2026-01-01',
          due_date: '2026-01-20',
          purpose: pos.name,
          status: 'active',
          created_at: nowIso,
          updated_at: nowIso,
        };
        nextAdvances.push(newAdv);
        newlyCreatedAdvances.push(newAdv);
      }
    });
    if (newlyCreatedAdvances.length > 0) setAdvances(nextAdvances);

    // 3. Migrasi Piutang & Utang
    const rpPositions = openingOtherPositions.filter((p) => p.type === 'receivable' || p.type === 'payable');
    const nextRps = [...receivablesPayables];
    const newlyCreatedRps: ReceivablePayable[] = [];
    rpPositions.forEach((pos) => {
      const exists = nextRps.some((r) => r.description.toLowerCase() === pos.name.toLowerCase());
      if (!exists) {
        const type = pos.type as ReceivablePayableType;
        const newRp: ReceivablePayable = {
          id: `rp-mig-${pos.id}`,
          type,
          kode: `${type === 'receivable' ? 'PIU' : 'UTG'}-AWAL-${String(nextRps.length + 1).padStart(3, '0')}`,
          kas_id: pos.kas_id,
          counterparty_name: pos.section_manager || 'Pihak Ketiga',
          amount: Number(pos.amount),
          remaining_amount: Number(pos.amount),
          issue_date: '2026-01-01',
          status: 'active',
          description: pos.name,
          created_at: nowIso,
          updated_at: nowIso,
          payments: [],
        };
        nextRps.push(newRp);
        newlyCreatedRps.push(newRp);
      }
    });
    if (newlyCreatedRps.length > 0) setReceivablesPayables(nextRps);

    // 4. Update fund_type untuk kas yang memiliki posisi restricted_fund
    const restrictedKasIds = openingOtherPositions.filter((p) => p.type === 'restricted_fund').map((p) => p.kas_id);
    const updatedRestrictedKas = kasList
      .filter((k) => restrictedKasIds.includes(k.id))
      .map((k) => ({ ...k, fund_type: 'restricted' as FundType, restricted_purpose: k.restricted_purpose || 'Dana Terikat per Saldo Awal', updated_at: nowIso }));
    if (updatedRestrictedKas.length > 0) {
      setKasList((prevKas) => prevKas.map((k) => updatedRestrictedKas.find((u) => u.id === k.id) || k));
    }

    if (isSupabaseConfigured) {
      if (newlyCreatedAssets.length > 0) await syncUpsert('fixed_assets', newlyCreatedAssets);
      if (newlyCreatedAdvances.length > 0) await syncUpsert('advances', newlyCreatedAdvances);
      if (newlyCreatedRps.length > 0) await syncUpsert('receivables_payables', newlyCreatedRps);
      if (updatedRestrictedKas.length > 0) await syncUpsert('kas', updatedRestrictedKas);
    }

    const addedAssets = newlyCreatedAssets.length;
    const addedAdvances = newlyCreatedAdvances.length;
    const addedRp = newlyCreatedRps.length;

    addAuditLog(
      'data_lpj_migration',
      'batch-migration',
      'MIGRATION_EXECUTED',
      null,
      { addedAssets, addedAdvances, addedRp },
      `Migrasi data posisi lain saldo awal ke tabel Aset (${addedAssets}), Panjar (${addedAdvances}), Piutang/Utang (${addedRp})`
    );

    return {
      success: true,
      count: {
        assets: addedAssets,
        advances: addedAdvances,
        rp: addedRp,
      },
    };
  };

  // ===========================================================================
  // BADAN AUDIT HURIA (INTERNAL AUDIT BODY) OPERATIONS
  // ===========================================================================

  const saveAuditBodyMember = async (
    memberData: Partial<AuditBodyMember>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!memberData.user_id || !memberData.jabatan) {
      return { success: false, error: 'User dan jabatan anggota audit wajib diisi.' };
    }

    const targetUser = profiles.find((p) => p.id === memberData.user_id);
    if (!targetUser) return { success: false, error: 'User tidak ditemukan.' };

    // Strict Independence Check:
    // Dilarang merangkap Bendum, Pendeta, Sekretaris, atau Bendahara/Ketua kas mana pun!
    if (['bendahara_umum', 'pendeta_ressort', 'sekretaris'].includes(targetUser.role)) {
      return {
        success: false,
        error: `Pelanggaran Independensi: ${targetUser.full_name} menjabat sebagai pimpinan/bendahara gereja dan TIDAK DAPAT menjadi anggota Badan Audit Huria.`,
      };
    }

    const hasKasAccess = userKasAccessList.some((a) => a.user_id === memberData.user_id);
    if (hasKasAccess) {
      return {
        success: false,
        error: `Pelanggaran Independensi: ${targetUser.full_name} memiliki hak akses sebagai bendahara/ketua seksi pada kas gereja dan TIDAK DAPAT menjadi auditor.`,
      };
    }

    const activeMembers = auditBodyMembers.filter((m) => m.aktif && m.id !== memberData.id);
    if (memberData.aktif !== false) {
      if (activeMembers.length >= 3) {
        return { success: false, error: 'Badan Audit Huria tepat terdiri dari 3 anggota aktif (1 Ketua dan 2 Anggota).' };
      }
      if (memberData.jabatan === 'ketua' && activeMembers.some((m) => m.jabatan === 'ketua')) {
        return { success: false, error: 'Sudah ada 1 Ketua aktif. Hanya boleh ada 1 Ketua Badan Audit.' };
      }
    }

    const nowIso = new Date().toISOString();
    let memberId = memberData.id;

    if (memberId) {
      const existingMember = auditBodyMembers.find((m) => m.id === memberId);
      const updatedMember = { ...existingMember, ...memberData, updated_at: nowIso } as AuditBodyMember;
      setAuditBodyMembers((prev) => prev.map((m) => (m.id === memberId ? updatedMember : m)));
      if (isSupabaseConfigured) {
        await syncUpsert('audit_body_members', updatedMember);
      }
      addAuditLog('audit_body_members', memberId, 'UPDATE', null, memberData, `Memperbarui keanggotaan audit: ${targetUser.full_name}`);
    } else {
      memberId = `abm-${Date.now()}`;
      const newMember: AuditBodyMember = {
        id: memberId,
        user_id: memberData.user_id,
        jabatan: memberData.jabatan,
        periode_mulai: memberData.periode_mulai || nowIso.split('T')[0],
        periode_selesai: memberData.periode_selesai || `${new Date().getFullYear() + 2}-01-01`,
        aktif: memberData.aktif !== undefined ? memberData.aktif : true,
        created_at: nowIso,
        updated_at: nowIso,
      };
      setAuditBodyMembers((prev) => [...prev, newMember]);
      if (isSupabaseConfigured) {
        await syncUpsert('audit_body_members', newMember);
      }
      addAuditLog('audit_body_members', memberId, 'INSERT', null, newMember, `Menetapkan anggota audit: ${targetUser.full_name} (${newMember.jabatan})`);
    }

    return { success: true };
  };

  const removeAuditBodyMember = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const existing = auditBodyMembers.find((m) => m.id === id);
    if (!existing) return { success: false, error: 'Data anggota audit tidak ditemukan.' };

    const updatedAt = new Date().toISOString();
    setAuditBodyMembers((prev) => prev.map((m) => (m.id === id ? { ...m, aktif: false, updated_at: updatedAt } : m)));
    if (isSupabaseConfigured) {
      await syncUpdate('audit_body_members', { aktif: false, updated_at: updatedAt }, 'id', id);
    }
    addAuditLog('audit_body_members', id, 'DEACTIVATE', existing, null, 'Menonaktifkan masa jabatan anggota audit');
    return { success: true };
  };

  const saveAuditEngagement = async (
    engData: Partial<AuditEngagement>
  ): Promise<{ success: boolean; id?: string; error?: string }> => {
    if (currentUser && currentUser.role !== 'pendeta_ressort' && currentUser.role !== 'admin') {
      return {
        success: false,
        error: 'Hanya Pendeta Ressort yang berwenang membuka penugasan audit.',
      };
    }
    if (!engData.tahun || !engData.jenis || !engData.judul || !engData.batas_waktu) {
      return { success: false, error: 'Tahun, jenis, judul, dan batas waktu pemeriksaan wajib diisi.' };
    }

    const duplicate = auditEngagements.find(
      (e) => e.tahun === engData.tahun && e.jenis === engData.jenis && e.id !== engData.id
    );
    if (duplicate) {
      return { success: false, error: `Sudah ada penugasan audit untuk ${engData.jenis} tahun ${engData.tahun}.` };
    }

    const nowIso = new Date().toISOString();
    let engId = engData.id;

    if (engId) {
      const existingEng = auditEngagements.find((e) => e.id === engId);
      const updatedEng: AuditEngagement = {
        ...existingEng,
        ...engData,
        combined_with_lpj:
          engData.combined_with_lpj !== undefined
            ? engData.combined_with_lpj
            : engData.jenis === 'tahunan' || existingEng?.combined_with_lpj || false,
        updated_at: nowIso,
      } as AuditEngagement;

      if (isSupabaseConfigured) {
        const syncRes = await syncUpsert('audit_engagements', updatedEng);
        if (!syncRes.success) {
          return {
            success: false,
            error: syncRes.error || 'Gagal menyimpan perubahan penugasan audit ke database.',
          };
        }
      }
      setAuditEngagements((prev) => prev.map((e) => (e.id === engId ? updatedEng : e)));
      addAuditLog(
        'audit_engagements',
        engId,
        'UPDATE',
        existingEng || null,
        updatedEng,
        `Memperbarui penugasan audit "${updatedEng.judul}" (${updatedEng.tahun})`
      );
    } else {
      engId = `eng-${Date.now()}`;
      const newEng: AuditEngagement = {
        id: engId,
        tahun: engData.tahun,
        jenis: engData.jenis,
        judul: engData.judul,
        deskripsi: engData.deskripsi || null,
        semester_report_id: engData.semester_report_id || null,
        lpj_id: engData.lpj_id || null,
        status: engData.status || 'in_progress',
        dibuka_pada: engData.dibuka_pada || nowIso.split('T')[0],
        batas_waktu: engData.batas_waktu,
        combined_with_lpj: engData.combined_with_lpj || engData.jenis === 'tahunan',
        created_by: currentUser?.id,
        created_at: nowIso,
        updated_at: nowIso,
      };
      if (isSupabaseConfigured) {
        const syncRes = await syncUpsert('audit_engagements', newEng);
        if (!syncRes.success) {
          return {
            success: false,
            error: syncRes.error || 'Gagal menyimpan penugasan audit baru ke database.',
          };
        }
      }
      setAuditEngagements((prev) => [newEng, ...prev]);
      addAuditLog('audit_engagements', engId, 'INSERT', null, newEng, `Membuka penugasan audit baru: ${newEng.judul}`);
    }

    return { success: true, id: engId };
  };

  const deleteAuditEngagement = async (
    id: string,
    options?: { force?: boolean; reason?: string }
  ): Promise<{ success: boolean; error?: string }> => {
    const eng = auditEngagements.find((e) => e.id === id);
    if (!eng) {
      return { success: false, error: 'Data penugasan audit tidak ditemukan.' };
    }

    if (currentUser && currentUser.role !== 'pendeta_ressort' && currentUser.role !== 'admin') {
      return {
        success: false,
        error: 'Hanya Pendeta Ressort (atau Admin) yang berwenang menghapus penugasan audit.',
      };
    }

    const reviewCount = auditReviews.filter((r) => r.engagement_id === id).length;
    const findingCount = auditFindings.filter((f) => f.engagement_id === id).length;
    const opinionCount = auditFinalOpinions.filter((o) => o.engagement_id === id).length;
    const hasLinkedData = reviewCount > 0 || findingCount > 0 || opinionCount > 0;

    if (hasLinkedData && !options?.force) {
      return {
        success: false,
        error: `Penugasan "${eng.judul}" sudah memiliki data terkait (${reviewCount} lembar kerja auditor, ${findingCount} temuan, ${opinionCount} opini final). Konfirmasi penghapusan paksa diperlukan.`,
      };
    }

    if (isSupabaseConfigured && supabase) {
      const delFindRes = await supabase.from('audit_findings').delete().eq('engagement_id', id);
      if (delFindRes.error) {
        return { success: false, error: `Gagal menghapus temuan terkait: ${delFindRes.error.message}` };
      }

      const delEngRes = await syncDelete('audit_engagements', 'id', id);
      if (!delEngRes.success) {
        return { success: false, error: delEngRes.error || 'Gagal menghapus penugasan audit dari Supabase.' };
      }
    }

    setAuditEngagements((prev) => prev.filter((e) => e.id !== id));
    setAuditReviews((prev) => prev.filter((r) => r.engagement_id !== id));
    setAuditFindings((prev) => prev.filter((f) => f.engagement_id !== id));
    setAuditFinalOpinions((prev) => prev.filter((o) => o.engagement_id !== id));

    const summaryReason = options?.reason?.trim() ? ` | Alasan: ${options.reason.trim()}` : '';
    addAuditLog(
      'audit_engagements',
      id,
      'DELETE',
      eng,
      null,
      `Penugasan audit "${eng.judul}" (${eng.tahun}) dihapus oleh ${currentUser?.full_name || 'Pendeta Ressort'} (${reviewCount} lembar kerja, ${findingCount} temuan, ${opinionCount} opini ikut dibersihkan)${summaryReason}`
    );

    return { success: true };
  };

  const submitAuditReview = async (
    reviewData: Partial<AuditReview>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!reviewData.engagement_id || !reviewData.member_id || !reviewData.personal_opinion) {
      return { success: false, error: 'Data penugasan, auditor, dan opini pribadi wajib diisi.' };
    }

    // Verify member is an active audit body member
    const isMember = auditBodyMembers.some((m) => m.user_id === reviewData.member_id && m.aktif);
    if (!isMember) {
      return { success: false, error: 'Hanya anggota Badan Audit Huria aktif yang dapat mengisi lembar kerja audit.' };
    }

    const nowIso = new Date().toISOString();
    const existing = auditReviews.find(
      (r) => r.engagement_id === reviewData.engagement_id && r.member_id === reviewData.member_id
    );

    if (existing) {
      const updatedRev: AuditReview = {
        ...existing,
        ...reviewData,
        notes_per_section: reviewData.notes_per_section || existing.notes_per_section,
        general_notes: reviewData.general_notes !== undefined ? reviewData.general_notes : existing.general_notes,
        personal_opinion: reviewData.personal_opinion!,
        submitted_at: nowIso,
        updated_at: nowIso,
      };
      setAuditReviews((prev) => prev.map((r) => (r.id === existing.id ? updatedRev : r)));
      if (isSupabaseConfigured) {
        await syncUpsert('audit_reviews', updatedRev);
      }
      addAuditLog('audit_reviews', existing.id, 'UPDATE', existing, reviewData, 'Memperbarui lembar kerja audit pribadi');
    } else {
      const newRev: AuditReview = {
        id: `rev-${Date.now()}`,
        engagement_id: reviewData.engagement_id,
        member_id: reviewData.member_id,
        notes_per_section: reviewData.notes_per_section || {},
        general_notes: reviewData.general_notes || null,
        personal_opinion: reviewData.personal_opinion,
        submitted_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      };
      setAuditReviews((prev) => [newRev, ...prev]);
      if (isSupabaseConfigured) {
        await syncUpsert('audit_reviews', newRev);
      }
      addAuditLog('audit_reviews', newRev.id, 'INSERT', null, newRev, 'Mengirim lembar kerja audit pribadi');
    }

    return { success: true };
  };

  const saveAuditFinding = async (
    findingData: Partial<AuditFinding>
  ): Promise<{ success: boolean; id?: string; error?: string }> => {
    if (!findingData.engagement_id || !findingData.title || !findingData.description) {
      return { success: false, error: 'Penugasan audit, judul, dan uraian temuan wajib diisi.' };
    }

    const nowIso = new Date().toISOString();
    let findId = findingData.id;

    if (findId) {
      const existingFind = auditFindings.find((f) => f.id === findId);
      const updatedFind = { ...existingFind, ...findingData, updated_at: nowIso } as AuditFinding;
      setAuditFindings((prev) => prev.map((f) => (f.id === findId ? updatedFind : f)));
      if (isSupabaseConfigured) {
        await syncUpsert('audit_findings', updatedFind);
      }
      addAuditLog('audit_findings', findId, 'UPDATE', null, findingData, `Memperbarui temuan audit ${findingData.kode}`);
    } else {
      findId = `find-${Date.now()}`;
      const newFind: AuditFinding = {
        id: findId,
        engagement_id: findingData.engagement_id,
        kas_id: findingData.kas_id || null,
        kode: findingData.kode || `AUD-${new Date().getFullYear()}-${String(auditFindings.length + 1).padStart(3, '0')}`,
        title: findingData.title,
        description: findingData.description,
        severity: findingData.severity || 'informasi',
        status: 'terbuka',
        carried_from_finding_id: findingData.carried_from_finding_id || null,
        due_date: findingData.due_date || null,
        created_by: currentUser?.id,
        created_at: nowIso,
        updated_at: nowIso,
      };
      setAuditFindings((prev) => [newFind, ...prev]);
      if (isSupabaseConfigured) {
        await syncUpsert('audit_findings', newFind);
      }
      addAuditLog('audit_findings', findId, 'INSERT', null, newFind, `Mencatat temuan audit baru: ${newFind.title} (${newFind.severity})`);
    }

    return { success: true, id: findId };
  };

  const respondAuditFinding = async (
    id: string,
    responseNotes: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!responseNotes.trim()) {
      return { success: false, error: 'Tanggapan dan tindak lanjut temuan wajib diisi.' };
    }

    const nowIso = new Date().toISOString();
    setAuditFindings((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              response_notes: responseNotes,
              response_by: currentUser?.id,
              responded_at: nowIso,
              status: 'ditanggapi',
              updated_at: nowIso,
            }
          : f
      )
    );
    if (isSupabaseConfigured) {
      await syncUpdate(
        'audit_findings',
        {
          response_notes: responseNotes,
          response_by: currentUser?.id,
          responded_at: nowIso,
          status: 'ditanggapi',
          updated_at: nowIso,
        },
        'id',
        id
      );
    }
    addAuditLog('audit_findings', id, 'RESPOND', null, { responseNotes }, 'Memberikan tanggapan tindak lanjut temuan audit');
    return { success: true };
  };

  const closeAuditFinding = async (
    id: string,
    approveClose: boolean,
    closingNotes: string
  ): Promise<{ success: boolean; error?: string }> => {
    // Only audit members can close
    const isAuditor = auditBodyMembers.some((m) => m.user_id === currentUser?.id && m.aktif) || currentUser?.role === 'admin';
    if (!isAuditor) {
      return { success: false, error: 'Hanya auditor Badan Audit Huria yang berwenang menutup/mengesahkan penyelesaian temuan.' };
    }

    const nowIso = new Date().toISOString();
    const newStatus = approveClose ? 'selesai' : 'diterima';

    setAuditFindings((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              status: newStatus,
              closed_by: currentUser?.id,
              closed_at: nowIso,
              closing_notes: closingNotes,
              updated_at: nowIso,
            }
          : f
      )
    );
    if (isSupabaseConfigured) {
      await syncUpdate(
        'audit_findings',
        {
          status: newStatus,
          closed_by: currentUser?.id,
          closed_at: nowIso,
          closing_notes: closingNotes,
          updated_at: nowIso,
        },
        'id',
        id
      );
    }
    addAuditLog('audit_findings', id, 'CLOSE', null, { status: newStatus, closingNotes }, `Menutup temuan audit dengan status ${newStatus}`);
    return { success: true };
  };

  const finalizeAuditOpinion = async (
    engagementId: string,
    params: {
      beritaAcaraNo: string;
      beritaAcaraDate: string;
      dissentingNotes?: string;
      signatories: { role: string; name: string; signed_at?: string }[];
    }
  ): Promise<{ success: boolean; opinion?: AuditPersonalOpinion; error?: string }> => {
    const activeMembers = auditBodyMembers.filter((m) => m.aktif);
    if (activeMembers.length !== 3) {
      return { success: false, error: 'Pemeriksaan membutuhkan tepat 3 anggota Badan Audit aktif.' };
    }

    const reviews = auditReviews.filter((r) => r.engagement_id === engagementId);
    if (reviews.length < 3) {
      return {
        success: false,
        error: `Opini final hanya dapat ditetapkan setelah SEMUA 3 anggota Badan Audit menginput lembar kerja audit (Baru ${reviews.length} dari 3 anggota menginput).`,
      };
    }

    // Tally votes
    const votesCount: Record<AuditPersonalOpinion, number> = {
      sesuai: 0,
      sesuai_dengan_catatan: 0,
      perlu_perbaikan: 0,
    };
    const voteDetails: { member_id: string; member_name: string; opinion: AuditPersonalOpinion }[] = [];

    reviews.forEach((r) => {
      votesCount[r.personal_opinion] = (votesCount[r.personal_opinion] || 0) + 1;
      const memProfile = profiles.find((p) => p.id === r.member_id);
      voteDetails.push({
        member_id: r.member_id,
        member_name: memProfile?.full_name || 'Auditor',
        opinion: r.personal_opinion,
      });
    });

    // Majority rule (>= 2 votes)
    let finalOp: AuditPersonalOpinion = 'sesuai';
    if (votesCount.perlu_perbaikan >= 2) {
      finalOp = 'perlu_perbaikan';
    } else if (votesCount.sesuai_dengan_catatan >= 2) {
      finalOp = 'sesuai_dengan_catatan';
    } else if (votesCount.sesuai >= 2) {
      finalOp = 'sesuai';
    } else {
      // 1-1-1 split: conservatism priority -> perlu_perbaikan / sesuai_dengan_catatan
      finalOp = 'sesuai_dengan_catatan';
    }

    const hasDissenting = Object.values(votesCount).some((c) => c === 1);
    const nowIso = new Date().toISOString();

    const finalOpObj: AuditFinalOpinion = {
      id: `op-${engagementId}`,
      engagement_id: engagementId,
      final_opinion: finalOp,
      vote_breakdown: {
        sesuai: votesCount.sesuai,
        sesuai_dengan_catatan: votesCount.sesuai_dengan_catatan,
        perlu_perbaikan: votesCount.perlu_perbaikan,
        votes: voteDetails,
      },
      has_dissenting_opinion: hasDissenting,
      dissenting_opinion_notes: params.dissentingNotes || null,
      berita_acara_no: params.beritaAcaraNo,
      berita_acara_date: params.beritaAcaraDate,
      signatories: params.signatories,
      finalized_by: currentUser?.id,
      finalized_at: nowIso,
    };

    setAuditFinalOpinions((prev) => [finalOpObj, ...prev.filter((o) => o.engagement_id !== engagementId)]);
    setAuditEngagements((prev) =>
      prev.map((e) => (e.id === engagementId ? { ...e, status: 'completed', updated_at: nowIso } : e))
    );

    if (isSupabaseConfigured) {
      await syncUpsert('audit_final_opinions', finalOpObj);
      await syncUpdate('audit_engagements', { status: 'completed', updated_at: nowIso }, 'id', engagementId);
    }

    addAuditLog(
      'audit_final_opinions',
      finalOpObj.id,
      'FINALIZE',
      null,
      finalOpObj,
      `Menetapkan Opini Final Audit: ${finalOp.toUpperCase()} (BA: ${params.beritaAcaraNo})`
    );

    return { success: true, opinion: finalOp };
  };

  const recordCashCount = async (
    data: Partial<CashCount>
  ): Promise<{ success: boolean; id?: string; findingId?: string; error?: string }> => {
    if (!data.kas_id || !data.storage_account_id || data.physical_balance === undefined || data.book_balance === undefined) {
      return { success: false, error: 'Kas, tempat penyimpanan, saldo buku, dan saldo fisik wajib diisi.' };
    }

    const diff = Number(data.physical_balance) - Number(data.book_balance);
    const nowIso = new Date().toISOString();
    const ccId = `cc-${Date.now()}`;

    const newCC: CashCount = {
      id: ccId,
      tanggal: data.tanggal || nowIso.split('T')[0],
      kas_id: data.kas_id,
      storage_account_id: data.storage_account_id,
      book_balance: Number(data.book_balance),
      physical_balance: Number(data.physical_balance),
      difference: diff,
      cash_breakdown: data.cash_breakdown || {},
      explanation: data.explanation || null,
      photo_url: data.photo_url || null,
      auditor_id: currentUser?.id || 'auditor',
      witness_name: data.witness_name || null,
      created_at: nowIso,
    };

    setCashCounts((prev) => [newCC, ...prev]);
    if (isSupabaseConfigured) {
      await syncInsert('cash_counts', newCC);
    }
    let createdFindingId: string | undefined;

    // Automatic Draft Audit Finding Creation if discrepancy exists!
    if (diff !== 0) {
      const activeEng = auditEngagements.find((e) => e.status === 'in_progress') || auditEngagements[0];
      const kasObj = kasList.find((k) => k.id === data.kas_id);
      const storObj = storageAccounts.find((s) => s.id === data.storage_account_id);

      const findingRes = await saveAuditFinding({
        engagement_id: activeEng ? activeEng.id : 'eng-general',
        kas_id: data.kas_id,
        kode: `AUD-CC-${new Date().getFullYear()}-${String(auditFindings.length + 1).padStart(3, '0')}`,
        title: `Selisih Opname Kas Fisik: ${kasObj?.nama || 'Kas'} (${storObj?.nama || 'Brankas'})`,
        description: `Ditemukan selisih fisik kas sebesar Rp ${Math.abs(diff).toLocaleString('id-ID')} (${diff > 0 ? 'Kelebihan Fisik' : 'Kekurangan Fisik'}) saat opname kas tanggal ${newCC.tanggal}. Saldo Buku: Rp ${newCC.book_balance.toLocaleString('id-ID')}, Saldo Fisik: Rp ${newCC.physical_balance.toLocaleString('id-ID')}. Keterangan: ${newCC.explanation || 'Belum ada penjelasan'}.`,
        severity: 'wajib_diperbaiki',
      });
      createdFindingId = findingRes.id;
    }

    addAuditLog('cash_counts', ccId, 'INSERT', null, newCC, `Mencatat hasil opname fisik kas (Selisih: Rp ${diff})`);
    return { success: true, id: ccId, findingId: createdFindingId };
  };

  // ===========================================================================
  // VERIFIKASI TRANSAKSI & PEMERIKSAAN BERKALA BADAN AUDIT (PASAL 7 & 44 AP HKBP)
  // ===========================================================================

  const verifyTransactionAudit = async (
    transactionId: string,
    status: 'unverified' | 'verified' | 'flagged',
    note?: string,
    finding?: { title: string; description: string; severity: AuditFindingSeverity; dueDate?: string }
  ): Promise<{ success: boolean; error?: string }> => {
    const tx = transactions.find((t) => t.id === transactionId);
    if (!tx) return { success: false, error: 'Transaksi tidak ditemukan.' };

    const nowIso = new Date().toISOString();
    const auditedAt = status === 'unverified' ? null : nowIso;
    const auditedBy = status === 'unverified' ? null : (currentUser?.id || 'user-audit-ketua');
    const finalAuditNote = note || (status === 'verified' ? 'Telah diverifikasi dan dokumen fisik valid.' : null);

    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id === transactionId) {
          return {
            ...t,
            audit_status: status,
            audited_by: auditedBy,
            audited_at: auditedAt,
            audit_note: finalAuditNote,
            updated_at: nowIso,
          };
        }
        return t;
      })
    );

    if (isSupabaseConfigured) {
      await syncUpdate(
        'transactions',
        {
          audit_status: status,
          audited_by: auditedBy,
          audited_at: auditedAt,
          audit_note: finalAuditNote,
          updated_at: nowIso,
        },
        'id',
        transactionId
      );
    }

    // If marked as flagged and finding details provided, automatically create an audit finding
    if (status === 'flagged' && finding) {
      const activeEng = auditEngagements.find((e) => e.status === 'in_progress') || auditEngagements[0];
      await saveAuditFinding({
        engagement_id: activeEng ? activeEng.id : 'eng-2026-sem2',
        kas_id: tx.kas_id,
        kode: `TEM-TX-${Date.now().toString().slice(-4)}`,
        title: finding.title || `Temuan Audit Transaksi ${tx.receipt_no || tx.id}`,
        description: finding.description || note || `Transaksi sebesar Rp ${tx.amount.toLocaleString('id-ID')} pada tanggal ${tx.tanggal} (${tx.description}) memiliki catatan pemeriksaan audit.`,
        severity: finding.severity || 'wajib_diperbaiki',
        status: 'terbuka',
        due_date: finding.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      });
    }

    addAuditLog(
      'transactions',
      transactionId,
      'AUDIT_VERIFY',
      { previous_status: tx.audit_status },
      { audit_status: status, note },
      `Verifikasi audit transaksi ${tx.receipt_no || tx.id}: ${status === 'verified' ? 'Lolos Audit' : status === 'flagged' ? 'Ada Temuan' : 'Dibatalkan'}`
    );
    return { success: true };
  };

  const saveAuditPeriodVerification = async (
    data: Partial<AuditPeriodVerification>
  ): Promise<{ success: boolean; error?: string }> => {
    const periodCode = data.period_code;
    if (!periodCode) return { success: false, error: 'Kode periode audit wajib diisi.' };

    const nowIso = new Date().toISOString();
    const targetYear = data.tahun || settings.active_year;
    const existing = auditPeriodVerifications.find(
      (p) => p.period_code === periodCode && p.tahun === targetYear
    );

    const savedApv: AuditPeriodVerification = existing
      ? ({
          ...existing,
          ...data,
          updated_at: nowIso,
        } as AuditPeriodVerification)
      : {
          id: `apv-${Date.now()}`,
          tahun: targetYear,
          period_type: data.period_type || 'triwulan',
          period_code: periodCode,
          period_title: data.period_title || 'Pemeriksaan Berkala',
          date_range: data.date_range || '',
          status: data.status || 'sedang_diverifikasi',
          verified_by: data.verified_by || (currentUser ? [currentUser.id] : []),
          verified_signatures: data.verified_signatures || [],
          verified_at: data.status === 'diverifikasi' ? nowIso : null,
          general_notes: data.general_notes || '',
          checklist: data.checklist || {
            cash_physical_match: true,
            evidence_valid: true,
            budget_adherence: true,
            advance_settled: true,
            remittance_compliant: true,
            prior_findings_cleared: true,
          },
          total_transactions_count: data.total_transactions_count,
          verified_transactions_count: data.verified_transactions_count,
          flagged_transactions_count: data.flagged_transactions_count,
          berita_acara_no:
            data.berita_acara_no || `BA-AUDIT/${periodCode.toUpperCase()}/${settings.active_year}`,
          created_at: nowIso,
          updated_at: nowIso,
        };

    setAuditPeriodVerifications((prev) =>
      existing ? prev.map((p) => (p.id === existing.id ? savedApv : p)) : [savedApv, ...prev]
    );

    if (isSupabaseConfigured) {
      await syncUpsert('audit_period_verifications', savedApv);
    }

    addAuditLog('audit_period_verifications', periodCode, 'UPSERT', null, data, `Pemeriksaan berkala ${periodCode} disimpan`);
    return { success: true };
  };

  const signAuditPeriodVerification = async (
    periodCode: AuditPeriodCode
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'Pengguna tidak terautentikasi.' };

    const nowIso = new Date().toISOString();
    const updatedRecords: AuditPeriodVerification[] = [];

    setAuditPeriodVerifications((prev) =>
      prev.map((p) => {
        if (p.period_code === periodCode) {
          const alreadySigned = p.verified_signatures?.some((s) => s.member_id === currentUser.id);
          const memberObj = auditBodyMembers.find((m) => m.user_id === currentUser.id);
          const roleLabel = memberObj?.jabatan === 'ketua' ? 'Ketua Badan Audit' : 'Anggota Badan Audit';

          const newSig = {
            member_id: currentUser.id,
            member_name: currentUser.full_name,
            jabatan: roleLabel,
            signed_at: nowIso,
          };
          const updatedSignatures = alreadySigned
            ? p.verified_signatures
            : [...(p.verified_signatures || []), newSig];
          const updatedVerifiedBy = p.verified_by.includes(currentUser.id)
            ? p.verified_by
            : [...p.verified_by, currentUser.id];

          const isVerified = (updatedSignatures?.length || 0) >= 2;

          return {
            ...p,
            verified_by: updatedVerifiedBy,
            verified_signatures: updatedSignatures,
            status: isVerified ? 'diverifikasi' : p.status,
            verified_at: isVerified ? nowIso : p.verified_at,
            updated_at: nowIso,
          };
        }
        return p;
      })
    );

    auditPeriodVerifications.forEach((p) => {
      if (p.period_code === periodCode) {
        const alreadySigned = p.verified_signatures?.some((s) => s.member_id === currentUser.id);
        const memberObj = auditBodyMembers.find((m) => m.user_id === currentUser.id);
        const roleLabel = memberObj?.jabatan === 'ketua' ? 'Ketua Badan Audit' : 'Anggota Badan Audit';
        const newSig = {
          member_id: currentUser.id,
          member_name: currentUser.full_name,
          jabatan: roleLabel,
          signed_at: nowIso,
        };
        const updatedSignatures = alreadySigned
          ? p.verified_signatures
          : [...(p.verified_signatures || []), newSig];
        const updatedVerifiedBy = p.verified_by.includes(currentUser.id)
          ? p.verified_by
          : [...p.verified_by, currentUser.id];
        const isVerified = (updatedSignatures?.length || 0) >= 2;
        updatedRecords.push({
          ...p,
          verified_by: updatedVerifiedBy,
          verified_signatures: updatedSignatures,
          status: isVerified ? 'diverifikasi' : p.status,
          verified_at: isVerified ? nowIso : p.verified_at,
          updated_at: nowIso,
        });
      }
    });

    if (isSupabaseConfigured && updatedRecords.length > 0) {
      await syncUpsert('audit_period_verifications', updatedRecords);
    }

    addAuditLog(
      'audit_period_verifications',
      periodCode,
      'SIGN',
      null,
      { signed_by: currentUser.full_name },
      `Tanda tangan verifikasi berkala ${periodCode} oleh ${currentUser.full_name}`
    );
    return { success: true };
  };

  // ===========================================================================
  // LAPORAN SEMESTER & LPJ TAHUNAN (ISAK 35) OPERATIONS
  // ===========================================================================

  const evaluateSemesterChecklist = (
    tahun: number,
    semester: 1 | 2
  ): {
    checklist: SemesterReport['checklist_result'];
    passed: boolean;
    blockers: string[];
  } => {
    const startMonth = semester === 1 ? 1 : 7;
    const endMonth = semester === 1 ? 6 : 12;

    // 1. Months closed
    const requiredMonths = [startMonth, startMonth + 1, startMonth + 2, startMonth + 3, startMonth + 4, endMonth];
    const closedMonths = periodClosings.filter((pc) => pc.tahun === tahun && pc.is_closed).map((pc) => pc.bulan);
    const missingMonths = requiredMonths.filter((m) => !closedMonths.includes(m));
    const monthsClosed = missingMonths.length === 0;

    // 2. No draft or submitted transactions in that semester
    const semTxs = transactions.filter((t) => {
      const d = new Date(t.tanggal);
      const m = d.getMonth() + 1;
      return d.getFullYear() === tahun && m >= startMonth && m <= endMonth;
    });
    const pendingTxCount = semTxs.filter((t) => t.status === 'draft' || t.status === 'submitted').length;
    const hasPendingTx = pendingTxCount > 0;

    // 3. Storage reconciliations (every active storage account must be reconciled in this semester)
    const semRecs = reconciliations.filter((r) => {
      const d = new Date(r.tanggal);
      const m = d.getMonth() + 1;
      return d.getFullYear() === tahun && m >= startMonth && m <= endMonth;
    });
    const activeStorages = storageAccounts.filter((s) => s.is_active);
    const missingStorages = activeStorages.filter((sa) => !semRecs.some((r) => r.storage_account_id === sa.id));
    const storagesReconciled = activeStorages.length === 0 || missingStorages.length === 0;

    // 4. Overdue advances reviewed
    const unaddressedAdvancesCount = advances.filter((a) => {
      const isOverdue = a.status === 'overdue' || (a.status === 'active' && new Date(a.due_date) < new Date());
      const hasSettlement = advanceSettlements.some((s) => s.advance_id === a.id);
      return isOverdue && !hasSettlement;
    }).length;
    const unaddressedOverdueAdvances = unaddressedAdvancesCount > 0;

    // 5. Budget variance explained (threshold default 10%)
    const budgetVarianceExplained = true;

    // 6. Prior mandatory findings resolved
    const unresolvedFindingsCount = auditFindings.filter(
      (f) => f.severity === 'wajib_diperbaiki' && f.status !== 'selesai' && f.status !== 'diterima'
    ).length;
    const unresolvedFindings = unresolvedFindingsCount > 0;

    // Check exceptions (match either report DB id or deterministic fallback id)
    const semReport = semesterReports.find((r) => r.tahun === tahun && r.semester === semester);
    const deterministicId = `sem-rep-${tahun}-${semester}`;
    const grantedExceptions = lpjExceptions.filter(
      (e) => e.target_type === 'semester' && (e.target_id === semReport?.id || e.target_id === deterministicId)
    );

    const isRuleExempted = (ruleCode: string) => grantedExceptions.some((e) => e.rule_code === ruleCode);

    const checklist: SemesterReport['checklist_result'] = {
      months_closed: monthsClosed || isRuleExempted('months_closed'),
      no_draft_transactions: !hasPendingTx || isRuleExempted('no_draft_transactions'),
      storages_reconciled: storagesReconciled || isRuleExempted('storages_reconciled'),
      advances_reviewed: !unaddressedOverdueAdvances || isRuleExempted('advances_reviewed'),
      budget_variance_explained: budgetVarianceExplained || isRuleExempted('budget_variance_explained'),
      prior_findings_resolved: !unresolvedFindings || isRuleExempted('prior_findings_resolved'),
      details: {
        missing_months: missingMonths,
        pending_tx_count: pendingTxCount,
        missing_storages: missingStorages.map((s) => s.nama),
        overdue_advances_count: unaddressedAdvancesCount,
        unresolved_findings_count: unresolvedFindingsCount,
      },
    };

    const blockers: string[] = [];
    if (!checklist.months_closed) blockers.push(`Seluruh 6 bulan pada Semester ${semester} belum ditutup buku secara resmi.`);
    if (!checklist.no_draft_transactions) blockers.push(`Masih ada ${pendingTxCount} transaksi dalam status Draf atau Diajukan pada periode semester ini.`);
    if (!checklist.storages_reconciled) {
      blockers.push(
        missingStorages.length > 0
          ? `Belum direkonsiliasi pada Semester ${semester}: ${missingStorages.map((s) => s.nama).join(', ')}.`
          : 'Belum semua tempat penyimpanan kas fisik / bank memiliki rekonsiliasi akhir semester.'
      );
    }
    if (!checklist.advances_reviewed) blockers.push('Terdapat panjar kegiatan yang melewati batas waktu tanpa pertanggungjawaban.');
    if (!checklist.prior_findings_resolved) blockers.push('Masih ada temuan audit dengan tingkat Wajib Diperbaiki yang belum ditutup.');

    return {
      checklist,
      passed: blockers.length === 0,
      blockers,
    };
  };

  const runSemesterChecklist = async (
    tahun: number,
    semester: 1 | 2
  ): Promise<{
    checklist: SemesterReport['checklist_result'];
    passed: boolean;
    blockers: string[];
  }> => {
    return evaluateSemesterChecklist(tahun, semester);
  };

  const lockSemesterSnapshot = async (
    reportId: string,
    fallbackPeriod?: { tahun: number; semester: 1 | 2 }
  ): Promise<{ success: boolean; error?: string; report?: SemesterReport }> => {
    let report =
      semesterReports.find((r) => r.id === reportId) ||
      (fallbackPeriod
        ? semesterReports.find((r) => r.tahun === fallbackPeriod.tahun && r.semester === fallbackPeriod.semester)
        : undefined);

    if (!report && fallbackPeriod) {
      const nowInit = new Date().toISOString();
      report = {
        id: reportId || `sem-rep-${fallbackPeriod.tahun}-${fallbackPeriod.semester}`,
        tahun: fallbackPeriod.tahun,
        semester: fallbackPeriod.semester,
        status: 'preparation',
        version: 1,
        checklist_result: evaluateSemesterChecklist(fallbackPeriod.tahun, fallbackPeriod.semester).checklist,
        created_by: currentUser?.id || 'user-admin',
        created_at: nowInit,
        updated_at: nowInit,
      };
    }

    if (!report) return { success: false, error: 'Laporan Semester tidak ditemukan.' };

    const check = evaluateSemesterChecklist(report.tahun, report.semester);
    if (!check.passed) {
      return {
        success: false,
        error: `Checklist persiapan belum terpenuhi: ${check.blockers.join('; ')}`,
      };
    }

    const startMonth = report.semester === 1 ? 1 : 7;
    const endMonth = report.semester === 1 ? 6 : 12;
    let totalPenerimaan = 0;
    let totalPengeluaran = 0;
    let totalTransferMasuk = 0;
    let totalTransferKeluar = 0;

    transactions
      .filter((tx) => {
        if (tx.status !== 'approved') return false;
        const d = new Date(tx.tanggal);
        const m = d.getMonth() + 1;
        return d.getFullYear() === report!.tahun && m >= startMonth && m <= endMonth;
      })
      .forEach((tx) => {
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'income') totalPenerimaan += amt;
        else if (tx.type === 'expense') totalPengeluaran += amt;
        else if (tx.type === 'transfer_in') totalTransferMasuk += amt;
        else if (tx.type === 'transfer_out') totalTransferKeluar += amt;
      });

    const kasBalances = getKasBalances();
    const totalKasDanBank = kasBalances.reduce((sum, k) => sum + k.saldo_resmi, 0);
    const storageBalances = getStorageBalances();
    const budgetSummary = getConsolidatedBudgetRealization(report.tahun, endMonth);

    const snapshot = {
      locked_at: new Date().toISOString(),
      locked_by: currentUser?.id,
      semesterSummary: {
        totalPenerimaan,
        totalPengeluaran,
        surplus: totalPenerimaan - totalPengeluaran,
        totalTransferMasuk,
        totalTransferKeluar,
        totalKas: totalKasDanBank,
      },
      kasBalances,
      storageBalances,
      budgetSummary,
      activeAdvances: advances.filter((a) => a.status !== 'settled'),
      receivablesPayables: receivablesPayables.filter((r) => r.status !== 'paid'),
    };

    const nowIso = new Date().toISOString();
    const updatedReport: SemesterReport = {
      ...report,
      status: 'drafted',
      snapshot_data: snapshot,
      checklist_result: check.checklist,
      updated_at: nowIso,
    };

    if (isSupabaseConfigured) {
      const syncRes = await syncUpsert('semester_reports', updatedReport);
      if (!syncRes.success) {
        return {
          success: false,
          error: `Gagal menyimpan snapshot ke database: ${syncRes.error || 'Terjadi kesalahan sinkronisasi.'}`,
        };
      }
    }

    setSemesterReports((prev) => {
      const exists = prev.some((r) => r.id === updatedReport.id);
      if (exists) {
        return prev.map((r) => (r.id === updatedReport.id ? updatedReport : r));
      }
      return [...prev, updatedReport];
    });

    addAuditLog(
      'semester_reports',
      updatedReport.id,
      'LOCK_SNAPSHOT',
      null,
      snapshot,
      `Mengunci snapshot angka Laporan Semester ${updatedReport.semester} Tahun ${updatedReport.tahun}`
    );
    return { success: true, report: updatedReport };
  };

  const unlockSemesterSnapshot = async (reportId: string): Promise<{ success: boolean; error?: string }> => {
    const report = semesterReports.find((r) => r.id === reportId);
    if (!report) return { success: false, error: 'Laporan Semester tidak ditemukan.' };
    if (report.status === 'announced') {
      return { success: false, error: 'Laporan yang sudah diwartakan ke jemaat tidak dapat dibuka kembali.' };
    }

    const nowIso = new Date().toISOString();
    if (isSupabaseConfigured) {
      const syncRes = await syncUpdate(
        'semester_reports',
        { status: 'preparation', snapshot_data: null, updated_at: nowIso },
        'id',
        reportId
      );
      if (!syncRes.success) {
        return { success: false, error: `Gagal membuka kunci snapshot di database: ${syncRes.error}` };
      }
    }

    setSemesterReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, status: 'preparation', snapshot_data: null, updated_at: nowIso } : r))
    );
    addAuditLog(
      'semester_reports',
      reportId,
      'UNLOCK_SNAPSHOT',
      null,
      { status: 'preparation' },
      `Membuka kembali kunci snapshot Laporan Semester ${report.semester} Tahun ${report.tahun} untuk pembaruan data`
    );
    return { success: true };
  };

  const forwardSemesterToPastor = async (
    reportId: string,
    sentRef: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (currentUser?.role === 'pendeta_ressort') {
      return { success: false, error: 'Pendeta Ressort adalah penerima laporan dan tidak dapat mengajukan laporan kepada dirinya sendiri.' };
    }

    const nowIso = new Date().toISOString();
    const sentDate = nowIso.split('T')[0];
    if (isSupabaseConfigured) {
      const syncRes = await syncUpdate(
        'semester_reports',
        { status: 'sent_to_pastor', sent_ref: sentRef, sent_to_pastor_date: sentDate, updated_at: nowIso },
        'id',
        reportId
      );
      if (!syncRes.success) {
        return { success: false, error: `Gagal meneruskan ke Pendeta: ${syncRes.error}` };
      }
    }
    setSemesterReports((prev) =>
      prev.map((r) =>
        r.id === reportId
          ? {
              ...r,
              status: 'sent_to_pastor',
              sent_ref: sentRef,
              sent_to_pastor_date: sentDate,
              updated_at: nowIso,
            }
          : r
      )
    );
    addAuditLog('semester_reports', reportId, 'FORWARD_TO_PASTOR', null, { sentRef }, 'Meneruskan Laporan Semester ke Pendeta Ressort');
    return { success: true };
  };

  const acknowledgeSemesterReport = async (
    reportId: string,
    pastorNote: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (currentUser?.role !== 'pendeta_ressort' && currentUser?.role !== 'admin') {
      return { success: false, error: 'Hanya Pendeta Ressort yang berwenang menerima dan memeriksa Laporan Semester.' };
    }

    const nowIso = new Date().toISOString();
    if (isSupabaseConfigured) {
      const syncRes = await syncUpdate(
        'semester_reports',
        { pastor_ack_by: currentUser?.id, pastor_ack_at: nowIso, pastor_note: pastorNote, updated_at: nowIso },
        'id',
        reportId
      );
      if (!syncRes.success) {
        return { success: false, error: `Gagal menyimpan verifikasi Pendeta: ${syncRes.error}` };
      }
    }
    setSemesterReports((prev) =>
      prev.map((r) =>
        r.id === reportId
          ? {
              ...r,
              pastor_ack_by: currentUser?.id,
              pastor_ack_at: nowIso,
              pastor_note: pastorNote,
              updated_at: nowIso,
            }
          : r
      )
    );
    addAuditLog('semester_reports', reportId, 'PASTOR_ACKNOWLEDGE', null, { pastorNote }, 'Pendeta Ressort menerima dan memeriksa Laporan Semester');
    return { success: true };
  };

  const announceSemesterReport = async (
    reportId: string,
    medium: 'warta_jemaat' | 'mimbar' | 'papan_pengumuman' | 'lainnya',
    text: string
  ): Promise<{ success: boolean; error?: string }> => {
    const nowIso = new Date().toISOString();
    const announcedDate = nowIso.split('T')[0];
    if (isSupabaseConfigured) {
      const syncRes = await syncUpdate(
        'semester_reports',
        { status: 'announced', announced_date: announcedDate, announcement_medium: medium, announcement_text: text, updated_at: nowIso },
        'id',
        reportId
      );
      if (!syncRes.success) {
        return { success: false, error: `Gagal menyimpan status pewartaan: ${syncRes.error}` };
      }
    }
    setSemesterReports((prev) =>
      prev.map((r) =>
        r.id === reportId
          ? {
              ...r,
              status: 'announced',
              announced_date: announcedDate,
              announcement_medium: medium,
              announcement_text: text,
              updated_at: nowIso,
            }
          : r
      )
    );
    addAuditLog('semester_reports', reportId, 'ANNOUNCE', null, { medium, text }, 'Mencatat pewartaan laporan keuangan kepada jemaat');
    return { success: true };
  };

  const saveSemesterWartaText = async (
    reportId: string,
    period: { tahun: number; semester: 1 | 2 },
    announcementText: string
  ): Promise<{ success: boolean; error?: string; report?: SemesterReport }> => {
    const nowIso = new Date().toISOString();
    const existing =
      semesterReports.find((r) => r.id === reportId) ||
      semesterReports.find((r) => r.tahun === period.tahun && r.semester === period.semester);

    if (existing) {
      if (isSupabaseConfigured) {
        const syncRes = await syncUpdate(
          'semester_reports',
          { announcement_text: announcementText, updated_at: nowIso },
          'id',
          existing.id
        );
        if (!syncRes.success) {
          return { success: false, error: `Gagal menyimpan teks Warta Jemaat: ${syncRes.error}` };
        }
      }
      const updatedReport: SemesterReport = {
        ...existing,
        announcement_text: announcementText,
        updated_at: nowIso,
      };
      setSemesterReports((prev) => prev.map((r) => (r.id === existing.id ? updatedReport : r)));
      addAuditLog(
        'semester_reports',
        existing.id,
        'UPDATE_WARTA_TEXT',
        null,
        { tahun: period.tahun, semester: period.semester },
        `Memperbarui isi teks Warta Jemaat Semester ${period.semester} Tahun ${period.tahun}`
      );
      return { success: true, report: updatedReport };
    }

    const newReport: SemesterReport = {
      id: reportId || `sem-rep-${period.tahun}-${period.semester}`,
      tahun: period.tahun,
      semester: period.semester,
      status: 'preparation',
      version: 1,
      checklist_result: evaluateSemesterChecklist(period.tahun, period.semester).checklist,
      announcement_text: announcementText,
      created_by: currentUser?.id || 'user-admin',
      created_at: nowIso,
      updated_at: nowIso,
    };

    if (isSupabaseConfigured) {
      const syncRes = await syncUpsert('semester_reports', newReport);
      if (!syncRes.success) {
        return { success: false, error: `Gagal menyimpan draf Warta Jemaat: ${syncRes.error}` };
      }
    }

    setSemesterReports((prev) => [...prev, newReport]);
    addAuditLog(
      'semester_reports',
      newReport.id,
      'UPDATE_WARTA_TEXT',
      null,
      { tahun: period.tahun, semester: period.semester },
      `Menyimpan isi teks Warta Jemaat Semester ${period.semester} Tahun ${period.tahun}`
    );
    return { success: true, report: newReport };
  };

  const returnSemesterReport = async (
    reportId: string,
    returnNotes: string
  ): Promise<{ success: boolean; error?: string }> => {
    const nowIso = new Date().toISOString();
    if (isSupabaseConfigured) {
      const syncRes = await syncUpdate(
        'semester_reports',
        { status: 'returned', return_notes: returnNotes, updated_at: nowIso },
        'id',
        reportId
      );
      if (!syncRes.success) {
        return { success: false, error: `Gagal mengembalikan laporan semester: ${syncRes.error}` };
      }
    }
    setSemesterReports((prev) =>
      prev.map((r) =>
        r.id === reportId
          ? {
              ...r,
              status: 'returned',
              return_notes: returnNotes,
              updated_at: nowIso,
            }
          : r
      )
    );
    addAuditLog('semester_reports', reportId, 'RETURN', null, { returnNotes }, 'Mengembalikan Laporan Semester dengan catatan perbaikan');
    return { success: true };
  };

  const evaluateLpjChecklist = (
    tahun: number
  ): {
    checklist: LpjReport['checklist_result'];
    passed: boolean;
    blockers: string[];
  } => {
    // 1. All 12 months closed
    const closedMonths = periodClosings.filter((pc) => pc.tahun === tahun && pc.is_closed).map((pc) => pc.bulan);
    const missingMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter((m) => !closedMonths.includes(m));
    const allMonthsClosed = missingMonths.length === 0;

    // 2. No pending transactions
    const yearTxs = transactions.filter((t) => new Date(t.tanggal).getFullYear() === tahun);
    const pendingTxCount = yearTxs.filter((t) => t.status === 'draft' || t.status === 'submitted').length;
    const hasPendingTx = pendingTxCount > 0;

    // 3. All reconciliations completed
    const activeStorages = storageAccounts.filter((s) => s.is_active);
    const missingStorages = activeStorages.filter(
      (sa) => !reconciliations.some((r) => r.storage_account_id === sa.id && new Date(r.tanggal).getFullYear() === tahun)
    );
    const storagesReconciled = activeStorages.length === 0 || missingStorages.length === 0;

    // 4. Overdue advances cleared or reserved
    const unaddressedAdvancesCount = advances.filter((a) => {
      const isOverdue = a.status === 'overdue' || (a.status === 'active' && new Date(a.due_date) < new Date());
      const hasSettlement = advanceSettlements.some((s) => s.advance_id === a.id);
      return isOverdue && !hasSettlement;
    }).length;
    const unaddressedOverdueAdvances = unaddressedAdvancesCount > 0;

    // 5. Budget deviations clarified
    const budgetDeviationsClarified = true;

    // 6. Audit findings settled
    const unresolvedFindingsCount = auditFindings.filter(
      (f) => f.severity === 'wajib_diperbaiki' && f.status !== 'selesai' && f.status !== 'diterima'
    ).length;
    const unresolvedFindings = unresolvedFindingsCount > 0;

    // 7. Inventory physical checked
    const inventoryChecked = fixedAssets.length > 0;

    const lpj = lpjReports.find((l) => l.tahun === tahun);
    const deterministicId = `lpj-rep-${tahun}`;
    const grantedExceptions = lpjExceptions.filter(
      (e) => e.target_type === 'lpj' && (e.target_id === lpj?.id || e.target_id === deterministicId)
    );

    const isExempt = (code: string) => grantedExceptions.some((e) => e.rule_code === code);

    const checklist: LpjReport['checklist_result'] = {
      all_months_closed: allMonthsClosed || isExempt('all_months_closed'),
      no_pending_transactions: !hasPendingTx || isExempt('no_pending_transactions'),
      all_reconciliations_completed: storagesReconciled || isExempt('all_reconciliations_completed'),
      overdue_advances_cleared_or_reserved: !unaddressedOverdueAdvances || isExempt('overdue_advances_cleared_or_reserved'),
      budget_deviations_clarified: budgetDeviationsClarified || isExempt('budget_deviations_clarified'),
      audit_findings_settled: !unresolvedFindings || isExempt('audit_findings_settled'),
      inventory_physical_checked: inventoryChecked || isExempt('inventory_physical_checked'),
      details: {
        missing_months: missingMonths,
        pending_tx_count: pendingTxCount,
        missing_storages: missingStorages.map((s) => s.nama),
        overdue_advances_count: unaddressedAdvancesCount,
        unresolved_findings_count: unresolvedFindingsCount,
        assets_count: fixedAssets.length,
      },
    };

    const blockers: string[] = [];
    if (!checklist.all_months_closed) blockers.push(`Seluruh 12 bulan pada Tahun ${tahun} belum ditutup buku.`);
    if (!checklist.no_pending_transactions) blockers.push(`Masih ada ${pendingTxCount} transaksi dalam status Draf atau Diajukan pada tahun berjalan.`);
    if (!checklist.all_reconciliations_completed) {
      blockers.push(
        missingStorages.length > 0
          ? `Rekening/kas belum direkonsiliasi tahun ${tahun}: ${missingStorages.map((s) => s.nama).join(', ')}.`
          : 'Belum semua rekening bank/kas fisik selesai direkonsiliasi akhir tahun.'
      );
    }
    if (!checklist.overdue_advances_cleared_or_reserved) blockers.push('Terdapat panjar kegiatan belum diselesaikan.');
    if (!checklist.audit_findings_settled) blockers.push('Terdapat temuan wajib periksa dari Badan Audit yang belum tuntas ditindaklanjuti.');
    if (!checklist.inventory_physical_checked) blockers.push('Cek fisik inventaris gereja belum dilakukan (atau belum ada data aset tetap).');

    return {
      checklist,
      passed: blockers.length === 0,
      blockers,
    };
  };

  const runLpjChecklist = async (
    tahun: number
  ): Promise<{
    checklist: LpjReport['checklist_result'];
    passed: boolean;
    blockers: string[];
  }> => {
    return evaluateLpjChecklist(tahun);
  };

  const lockLpjSnapshot = async (
    lpjId: string,
    fallbackTahun?: number
  ): Promise<{ success: boolean; error?: string; report?: LpjReport }> => {
    let lpj =
      lpjReports.find((l) => l.id === lpjId) ||
      (fallbackTahun ? lpjReports.find((l) => l.tahun === fallbackTahun) : undefined);

    if (!lpj && fallbackTahun) {
      const nowInit = new Date().toISOString();
      lpj = {
        id: lpjId || `lpj-rep-${fallbackTahun}`,
        tahun: fallbackTahun,
        nomor_dokumen: `HKBP-HTR/LPJ/${fallbackTahun}/001`,
        status: 'preparation',
        version: 1,
        checklist_result: evaluateLpjChecklist(fallbackTahun).checklist,
        created_by: currentUser?.id || 'user-admin',
        created_at: nowInit,
        updated_at: nowInit,
      };
    }

    if (!lpj) return { success: false, error: 'LPJ tidak ditemukan.' };

    const check = evaluateLpjChecklist(lpj.tahun);
    if (!check.passed) {
      return { success: false, error: `Checklist LPJ belum terpenuhi: ${check.blockers.join('; ')}` };
    }

    let penerimaanMurni = 0;
    let pengeluaranMurni = 0;
    let transferMasuk = 0;
    let transferKeluar = 0;

    transactions
      .filter((tx) => tx.status === 'approved' && new Date(tx.tanggal).getFullYear() === lpj!.tahun)
      .forEach((tx) => {
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'income') penerimaanMurni += amt;
        else if (tx.type === 'expense') pengeluaranMurni += amt;
        else if (tx.type === 'transfer_in') transferMasuk += amt;
        else if (tx.type === 'transfer_out') transferKeluar += amt;
      });

    const posisiKeuangan = getPosisiKeuangan(lpj.tahun);
    const perubahanSaldoDana = getPerubahanSaldoDana(lpj.tahun);
    const arusKas = getArusKasLangsung(lpj.tahun);
    const budgetRealization = getConsolidatedBudgetRealization(lpj.tahun, 12);

    const snapshot = {
      locked_at: new Date().toISOString(),
      locked_by: currentUser?.id,
      annualSummary: {
        penerimaanMurni,
        pengeluaranMurni,
        transferMasuk,
        transferKeluar,
      },
      posisiKeuangan,
      perubahanSaldoDana,
      arusKas,
      budgetRealization,
      fixedAssets,
      advances: advances.filter((a) => a.status !== 'settled'),
      receivablesPayables: receivablesPayables.filter((r) => r.status !== 'paid'),
      lpjNotes,
      lpjSettings,
    };

    const nowIso = new Date().toISOString();
    const updatedLpj: LpjReport = {
      ...lpj,
      status: 'drafted',
      snapshot_data: snapshot,
      checklist_result: check.checklist,
      updated_at: nowIso,
    };

    if (isSupabaseConfigured) {
      const syncRes = await syncUpsert('lpj_reports', updatedLpj);
      if (!syncRes.success) {
        return {
          success: false,
          error: `Gagal menyimpan snapshot LPJ ke database: ${syncRes.error || 'Terjadi kesalahan sinkronisasi.'}`,
        };
      }
    }

    setLpjReports((prev) => {
      const exists = prev.some((l) => l.id === updatedLpj.id);
      if (exists) {
        return prev.map((l) => (l.id === updatedLpj.id ? updatedLpj : l));
      }
      return [...prev, updatedLpj];
    });

    addAuditLog('lpj_reports', updatedLpj.id, 'LOCK_SNAPSHOT', null, snapshot, `Mengunci snapshot angka LPJ ISAK 35 Tahun ${updatedLpj.tahun}`);
    return { success: true, report: updatedLpj };
  };

  const unlockLpjSnapshot = async (lpjId: string): Promise<{ success: boolean; error?: string }> => {
    const lpj = lpjReports.find((l) => l.id === lpjId);
    if (!lpj) return { success: false, error: 'LPJ tidak ditemukan.' };
    if (lpj.status === 'approved') {
      return { success: false, error: 'LPJ yang telah disahkan Rapat Huria terkunci permanen.' };
    }

    const nowIso = new Date().toISOString();
    if (isSupabaseConfigured) {
      const syncRes = await syncUpdate(
        'lpj_reports',
        { status: 'preparation', snapshot_data: null, updated_at: nowIso },
        'id',
        lpjId
      );
      if (!syncRes.success) {
        return { success: false, error: `Gagal membuka kunci snapshot LPJ: ${syncRes.error}` };
      }
    }

    setLpjReports((prev) =>
      prev.map((l) => (l.id === lpjId ? { ...l, status: 'preparation', snapshot_data: null, updated_at: nowIso } : l))
    );
    addAuditLog('lpj_reports', lpjId, 'UNLOCK_SNAPSHOT', null, { status: 'preparation' }, `Membuka kunci snapshot LPJ Tahun ${lpj.tahun}`);
    return { success: true };
  };

  const submitLpjToMeeting = async (
    lpjId: string,
    meetingDate: string,
    meetingRef: string
  ): Promise<{ success: boolean; error?: string }> => {
    const nowIso = new Date().toISOString();
    if (isSupabaseConfigured) {
      const syncRes = await syncUpdate(
        'lpj_reports',
        { status: 'submitted_to_meeting', meeting_date: meetingDate, meeting_ref: meetingRef, updated_at: nowIso },
        'id',
        lpjId
      );
      if (!syncRes.success) return { success: false, error: `Gagal mengajukan LPJ: ${syncRes.error}` };
    }
    setLpjReports((prev) =>
      prev.map((l) =>
        l.id === lpjId
          ? {
              ...l,
              status: 'submitted_to_meeting',
              meeting_date: meetingDate,
              meeting_ref: meetingRef,
              updated_at: nowIso,
            }
          : l
      )
    );
    addAuditLog('lpj_reports', lpjId, 'SUBMIT_TO_MEETING', null, { meetingDate, meetingRef }, 'Mengajukan LPJ ke Rapat Huria');
    return { success: true };
  };

  const approveLpjReport = async (
    lpjId: string,
    meetingNotes: string,
    attendeesCount: number
  ): Promise<{ success: boolean; error?: string }> => {
    const lpj = lpjReports.find((l) => l.id === lpjId);
    if (!lpj) return { success: false, error: 'LPJ tidak ditemukan.' };

    const nowIso = new Date().toISOString();
    if (isSupabaseConfigured) {
      const syncRes = await syncUpdate(
        'lpj_reports',
        {
          status: 'approved',
          meeting_notes: meetingNotes,
          meeting_attendees_count: attendeesCount,
          approved_by: currentUser?.id,
          approved_at: nowIso,
          updated_at: nowIso,
        },
        'id',
        lpjId
      );
      if (!syncRes.success) return { success: false, error: `Gagal mengesahkan LPJ: ${syncRes.error}` };
    }
    setLpjReports((prev) =>
      prev.map((l) =>
        l.id === lpjId
          ? {
              ...l,
              status: 'approved',
              meeting_notes: meetingNotes,
              meeting_attendees_count: attendeesCount,
              approved_by: currentUser?.id,
              approved_at: nowIso,
              updated_at: nowIso,
            }
          : l
      )
    );

    addAuditLog(
      'lpj_reports',
      lpjId,
      'APPROVE_LPJ',
      null,
      { meetingNotes, attendeesCount },
      `Rapat Huria MENGESAHKAN LPJ Tahun ${lpj.tahun}. Seluruh transaksi Tahun ${lpj.tahun} TERKUNCI PERMANEN!`
    );

    return { success: true };
  };

  const returnLpjReport = async (
    lpjId: string,
    returnNotes: string
  ): Promise<{ success: boolean; error?: string }> => {
    const nowIso = new Date().toISOString();
    if (isSupabaseConfigured) {
      const syncRes = await syncUpdate(
        'lpj_reports',
        { status: 'returned', return_notes: returnNotes, updated_at: nowIso },
        'id',
        lpjId
      );
      if (!syncRes.success) return { success: false, error: `Gagal mengembalikan LPJ: ${syncRes.error}` };
    }
    setLpjReports((prev) =>
      prev.map((l) =>
        l.id === lpjId
          ? {
              ...l,
              status: 'returned',
              return_notes: returnNotes,
              updated_at: nowIso,
            }
          : l
      )
    );
    addAuditLog('lpj_reports', lpjId, 'RETURN_LPJ', null, { returnNotes }, 'Mengembalikan LPJ dengan catatan perbaikan Rapat Huria');
    return { success: true };
  };

  const grantLpjException = async (
    targetType: 'semester' | 'lpj',
    targetId: string,
    ruleCode: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!reason.trim()) {
      return { success: false, error: 'Alasan pemberian dispensasi checklist wajib diisi.' };
    }

    const nowIso = new Date().toISOString();
    const newExc: LpjException = {
      id: `exc-${Date.now()}`,
      target_type: targetType,
      target_id: targetId,
      rule_code: ruleCode,
      reason: reason.trim(),
      granted_by: currentUser?.id || 'admin',
      granted_at: nowIso,
    };

    if (isSupabaseConfigured) {
      const syncRes = await syncInsert('lpj_exceptions', newExc);
      if (!syncRes.success) {
        return { success: false, error: `Gagal menyimpan dispensasi ke database: ${syncRes.error}` };
      }
    }
    setLpjExceptions((prev) => [...prev, newExc]);
    addAuditLog('lpj_exceptions', newExc.id, 'INSERT', null, newExc, `Memberikan dispensasi aturan ${ruleCode}: ${reason}`);
    return { success: true };
  };

  // ===========================================================================
  // ISAK 35 FINANCIAL STATEMENTS GENERATORS
  // ===========================================================================

  const getPosisiKeuangan = (_year: number): LaporanPosisiKeuanganData => {
    // 1. Kas dan Setara Kas (total saldo akhir seluruh kas)
    const kasBalances = getKasBalances();
    const total_kas_dan_bank = kasBalances.reduce((sum, k) => sum + k.saldo_resmi, 0);

    const saldo_dana_tidak_terikat = kasBalances
      .filter((k) => {
        const kasObj = kasList.find((item) => item.id === k.kas_id);
        return kasObj?.fund_type !== 'restricted';
      })
      .reduce((sum, k) => sum + k.saldo_resmi, 0);

    const saldo_dana_terikat = kasBalances
      .filter((k) => {
        const kasObj = kasList.find((item) => item.id === k.kas_id);
        return kasObj?.fund_type === 'restricted';
      })
      .reduce((sum, k) => sum + k.saldo_resmi, 0);

    // 2. Piutang dan Panjar
    const total_piutang_pihak_ketiga = receivablesPayables
      .filter((rp) => rp.type === 'receivable' && rp.status !== 'paid')
      .reduce((sum, rp) => sum + rp.remaining_amount, 0);

    const total_panjar_berjalan = advances
      .filter((a) => a.status !== 'settled')
      .reduce((sum, a) => sum + a.amount, 0);

    const total_piutang = total_piutang_pihak_ketiga + total_panjar_berjalan;

    // 3. Aset Tetap
    const activeAssets = fixedAssets.filter((a) => a.status === 'aktif');
    const total_aset_tetap_bruto = activeAssets.reduce((sum, a) => sum + a.nilai_perolehan, 0);
    const total_akumulasi_penyusutan = lpjSettings.enable_depreciation
      ? activeAssets.reduce((sum, a) => sum + calculateDepreciation(a, _year).accumulatedDepreciation, 0)
      : 0;

    const nilai_buku_aset_tetap = total_aset_tetap_bruto - total_akumulasi_penyusutan;

    // Total Aset = Kas + Piutang + Panjar + Nilai Buku Aset Tetap
    const total_aset = total_kas_dan_bank + total_piutang + nilai_buku_aset_tetap;

    // 4. Kewajiban (Utang)
    const total_kewajiban = receivablesPayables
      .filter((rp) => rp.type === 'payable' && rp.status !== 'paid')
      .reduce((sum, rp) => sum + rp.remaining_amount, 0);

    // 5. Saldo Dana Bersih (Net Assets = Aset - Kewajiban)
    const total_saldo_dana_bersih = total_aset - total_kewajiban;

    // Total Kewajiban + Saldo Dana (Selalu Berimbang = total_aset)
    const total_kewajiban_dan_saldo_dana = total_kewajiban + total_saldo_dana_bersih;
    const selisih_neraca = total_aset - total_kewajiban_dan_saldo_dana;

    return {
      total_kas_dan_bank,
      total_piutang,
      total_piutang_pihak_ketiga,
      total_panjar_berjalan,
      total_aset_tetap_bruto,
      total_akumulasi_penyusutan,
      total_aset,
      total_kewajiban,
      saldo_dana_tidak_terikat,
      saldo_dana_terikat,
      total_saldo_dana_bersih,
      total_kewajiban_dan_saldo_dana,
      selisih_neraca,
    };
  };

  const getPerubahanSaldoDana = (_year: number): LaporanPerubahanSaldoDanaItem[] => {
    return kasList.map((k) => {
      const initial = openingBalances
        .filter((ob) => ob.kas_id === k.id && ob.tahun === _year)
        .reduce((sum, item) => sum + Number(item.amount), 0);

      let penerimaan_murni = 0;
      let pengeluaran_murni = 0;
      let transfer_antar_dana_masuk = 0;
      let transfer_antar_dana_keluar = 0;

      transactions
        .filter((tx) => tx.kas_id === k.id && tx.status === 'approved' && new Date(tx.tanggal).getFullYear() === _year)
        .forEach((tx) => {
          const amt = Number(tx.amount);
          if (tx.type === 'income') penerimaan_murni += amt;
          if (tx.type === 'expense') pengeluaran_murni += amt;
          if (tx.type === 'transfer_in') transfer_antar_dana_masuk += amt;
          if (tx.type === 'transfer_out') transfer_antar_dana_keluar += amt;
        });

      const surplus_defisit = penerimaan_murni - pengeluaran_murni;
      const saldo_akhir =
        initial + penerimaan_murni - pengeluaran_murni + transfer_antar_dana_masuk - transfer_antar_dana_keluar;

      return {
        kas_id: k.id,
        nama_kas: k.nama,
        kode_kas: k.kode,
        fund_type: k.fund_type || 'unrestricted',
        saldo_awal: initial,
        penerimaan_murni,
        pengeluaran_murni,
        surplus_defisit,
        transfer_antar_dana_masuk,
        transfer_antar_dana_keluar,
        saldo_akhir,
      };
    });
  };

  const getArusKasLangsung = (year: number): LaporanArusKasData => {
    const yearTxs = transactions.filter(
      (tx) => tx.status === 'approved' && new Date(tx.tanggal).getFullYear() === year
    );

    let kas_masuk_operasi = 0;
    let kas_keluar_operasi = 0;
    let kas_keluar_investasi = 0;
    let kas_masuk_pendanaan = 0;
    let kas_keluar_pendanaan = 0;

    yearTxs.forEach((tx) => {
      const cat = categories.find((c) => c.id === tx.category_id);
      const catName = (cat?.nama || '').toLowerCase();
      const amt = Number(tx.amount);

      if (tx.type === 'income') {
        if (catName.includes('pembangunan') || catName.includes('donasi terikat')) {
          kas_masuk_pendanaan += amt;
        } else {
          kas_masuk_operasi += amt;
        }
      } else if (tx.type === 'expense') {
        if (catName.includes('pengadaan aset') || catName.includes('inventaris') || catName.includes('alat')) {
          kas_keluar_investasi += amt;
        } else if (catName.includes('pembangunan')) {
          kas_keluar_pendanaan += amt;
        } else {
          kas_keluar_operasi += amt;
        }
      }
    });

    const arus_kas_bersih_operasi = kas_masuk_operasi - kas_keluar_operasi;
    const arus_kas_bersih_investasi = -kas_keluar_investasi;
    const arus_kas_bersih_pendanaan = kas_masuk_pendanaan - kas_keluar_pendanaan;
    const kenaikan_penurunan_kas_bersih =
      arus_kas_bersih_operasi + arus_kas_bersih_investasi + arus_kas_bersih_pendanaan;

    const saldo_kas_awal = openingBalances.reduce((sum, ob) => sum + Number(ob.amount), 0);
    const saldo_kas_akhir = saldo_kas_awal + kenaikan_penurunan_kas_bersih;

    return {
      tahun: year,
      kas_masuk_operasi,
      kas_keluar_operasi,
      arus_kas_bersih_operasi,
      kas_keluar_investasi,
      arus_kas_bersih_investasi,
      kas_masuk_pendanaan,
      kas_keluar_pendanaan,
      arus_kas_bersih_pendanaan,
      kenaikan_penurunan_kas_bersih,
      saldo_kas_awal,
      saldo_kas_akhir,
    };
  };

  const resetAllTransactionsAndBalancesToZero = async (): Promise<{ success: boolean; message: string }> => {
    // 1. Reset state
    setTransactions([]);
    setBudgets([]);
    setBudgetItems([]);
    setBudgetReallocations([]);
    setOpeningBalances(DEMO_OPENING_BALANCES);
    setOpeningEntries(DEMO_OPENING_ENTRIES);
    setOpeningAdjustments([]);
    setOpeningOtherPositions([]);
    setFixedAssets([]);
    setPriorYearSummaries([]);
    setOpeningSetup(DEMO_OPENING_SETUP);
    setPeriodClosings([]);
    setReconciliations([]);
    setAdvances([]);
    setAdvanceSettlements([]);
    setReceivablesPayables([]);
    setCashCounts([]);
    setAuditPeriodVerifications([]);
    setAuditReviews([]);
    setAuditFindings([]);
    setAuditFinalOpinions([]);
    setSemesterReports((prev) =>
      (prev.length > 0 ? prev : DEMO_SEMESTER_REPORTS).map((r) => ({
        ...r,
        status: 'preparation',
        snapshot_data: null,
      }))
    );
    setLpjReports((prev) =>
      (prev.length > 0 ? prev : DEMO_LPJ_REPORTS).map((l) => ({
        ...l,
        status: 'preparation',
        snapshot_data: null,
      }))
    );

    const resetLog: AuditLog = {
      id: `audit-${Date.now()}`,
      table_name: 'system',
      record_id: 'reset',
      action: 'SYSTEM_RESET',
      new_data: { note: 'Seluruh aset tetap, transaksi keuangan, anggaran (APBG), dan saldo awal direset bersih ke nol.' },
      old_data: null,
      changed_by: currentUser?.id || 'user-admin',
      notes: 'Sistem direset bersih untuk memulai penggunaan aplikasi perdana.',
      changed_at: new Date().toISOString(),
    };
    setAuditLogs([resetLog]);

    if (isSupabaseConfigured) {
      await syncResetZeroDataInSupabase();
    } else {
      // 2. Clear localStorage (hanya jika mode demo/penyimpanan lokal aktif)
      localStorage.removeItem('siku_transactions');
      localStorage.removeItem('siku_budgets');
      localStorage.removeItem('siku_budget_items');
      localStorage.removeItem('siku_budget_reallocations');
      localStorage.setItem('siku_opening_balances', JSON.stringify(DEMO_OPENING_BALANCES));
      localStorage.setItem('siku_opening_entries', JSON.stringify(DEMO_OPENING_ENTRIES));
      localStorage.removeItem('siku_opening_adjustments');
      localStorage.removeItem('siku_opening_other_positions');
      localStorage.setItem('siku_opening_setup', JSON.stringify(DEMO_OPENING_SETUP));
      localStorage.removeItem('siku_period_closings');
      localStorage.removeItem('siku_reconciliations');
      localStorage.removeItem('siku_advances');
      localStorage.removeItem('siku_advance_settlements');
      localStorage.removeItem('siku_receivables_payables');
      localStorage.removeItem('siku_fixed_assets');
      localStorage.removeItem('siku_prior_year_summaries');
      localStorage.removeItem('siku_cash_counts');
      localStorage.removeItem('siku_audit_period_verifications');
      localStorage.removeItem('siku_audit_reviews');
      localStorage.removeItem('siku_audit_findings');
      localStorage.removeItem('siku_audit_final_opinions');
      localStorage.setItem('siku_semester_reports', JSON.stringify(DEMO_SEMESTER_REPORTS));
      localStorage.setItem('siku_lpj_reports', JSON.stringify(DEMO_LPJ_REPORTS));
      localStorage.setItem('siku_audit_logs', JSON.stringify([resetLog]));
    }

    return { success: true, message: 'Seluruh aset tetap, transaksi keuangan, anggaran (APBG), dan saldo awal berhasil direset ke nol.' };
  };

  return (
    <DataContext.Provider
      value={{
        kasList,
        storageAccounts,
        categories,
        transactions,
        openingBalances,
        periodClosings,
        reconciliations,
        auditLogs,
        settings,
        profiles,
        userKasAccessList,
        budgets,
        budgetItems,
        budgetReallocations,
        openingSetup,
        openingEntries,
        openingAdjustments,
        openingOtherPositions,
        priorYearSummaries,
        isKasOpeningLocked,
        getOpeningStatusForKas,
        saveOpeningEntry,
        submitOpeningBook,
        approveOpeningBook,
        lockOpeningBook,
        saveOpeningAdjustment,
        approveOpeningAdjustment,
        saveOpeningOtherPosition,
        deleteOpeningOtherPosition,
        savePriorYearSummary,
        updateOpeningSetup,
        loading,
        getKasBalances,
        getStorageBalances,
        getSentralisasiSummary,
        isPeriodClosed,
        getPendingTransactionsCount,
        addTransaction,
        addCompoundIncomeTransactions,
        updateTransaction,
        deleteTransaction,
        changeStatus,
        bulkApprove,
        createTransfer,
        confirmTransferReceipt,
        createReversalTransaction,
        closePeriod,
        reopenPeriod,
        saveReconciliation,
        saveKas,
        deleteKas,
        saveProfile,
        deleteProfile,
        toggleProfileActive,
        saveStorageAccount,
        deleteStorageAccount,
        saveCategory,
        saveOpeningBalance,
        saveUserKasAccess,
        removeUserKasAccess,
        updateSettings,
        lingkunganList,
        families,
        saveLingkungan,
        deleteLingkungan,
        saveFamily,
        bulkImportFamilies,
        deleteFamily,
        fiscalYears,
        saveFiscalYear,
        deleteFiscalYear,
        setActiveFiscalYear,
        toggleFiscalYearBudgetLock,
        rollForwardBalancesToYear,
        saveBudget,
        deleteBudget,
        saveBudgetItem,
        deleteBudgetItem,
        changeBudgetStatus,
        createBudgetRevision,
        reallocateBudget,
        copyBudgetFromPreviousYear,
        getBudgetRealization,
        getConsolidatedBudgetRealization,
        // LPJ Supporting Data
        fixedAssets,
        advances,
        advanceSettlements,
        receivablesPayables,
        lpjNotes,
        lpjSettings,
        saveFixedAsset,
        deleteFixedAsset,
        proposeAssetDisposal,
        approveAssetDisposal,
        calculateDepreciation,
        saveAdvance,
        deleteAdvance,
        saveAdvanceSettlement,
        submitAdvanceSettlement,
        approveAdvanceSettlement,
        saveReceivablePayable,
        deleteReceivablePayable,
        recordReceivablePayablePayment,
        saveLpjNotes,
        updateLpjSettings,
        updateKasFundType,
        migrateOpeningPositionsToLpj,
        // Badan Audit Huria
        auditBodyMembers,
        auditEngagements,
        auditReviews,
        auditFindings,
        auditFinalOpinions,
        cashCounts,
        saveAuditBodyMember,
        removeAuditBodyMember,
        saveAuditEngagement,
        deleteAuditEngagement,
        submitAuditReview,
        saveAuditFinding,
        respondAuditFinding,
        closeAuditFinding,
        finalizeAuditOpinion,
        recordCashCount,
        // Verifikasi Audit Transaksi & Pemeriksaan Berkala
        verifyTransactionAudit,
        auditPeriodVerifications,
        saveAuditPeriodVerification,
        signAuditPeriodVerification,
        // Laporan Semester & LPJ Tahunan
        semesterReports,
        lpjReports,
        lpjExceptions,
        evaluateSemesterChecklist,
        runSemesterChecklist,
        lockSemesterSnapshot,
        unlockSemesterSnapshot,
        forwardSemesterToPastor,
        acknowledgeSemesterReport,
        announceSemesterReport,
        saveSemesterWartaText,
        returnSemesterReport,
        evaluateLpjChecklist,
        runLpjChecklist,
        lockLpjSnapshot,
        unlockLpjSnapshot,
        submitLpjToMeeting,
        approveLpjReport,
        returnLpjReport,
        grantLpjException,
        isYearLockedByLpj,
        // ISAK 35 Generators
        getPosisiKeuangan,
        getPerubahanSaldoDana,
        getArusKasLangsung,
        // System Data Reset
        resetAllTransactionsAndBalancesToZero,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider');
  return context;
};
