/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Profile, UserKasAccess } from '../types/database';
import { DEMO_PROFILES, DEMO_USER_KAS_ACCESS } from '../lib/demoData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { hashUserPassword, verifyUserPassword } from '../lib/passwordUtils';

interface AuthContextType {
  currentUser: Profile | null;
  userKasAccess: UserKasAccess[];
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
  updateOwnPassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ success: boolean; error?: string }>;
  canInputKas: (kasId: string) => boolean;
  canApproveKas: (kasId: string) => boolean;
  isLeader: boolean;
  isAdmin: boolean;
  isBendaharaUmum: boolean;
  isAuditor: boolean;
  isPendeta: boolean;
  isSekretaris: boolean;
  isMajelis: boolean;
  isPengurusKas: boolean;
  canRecordTransactions: boolean;
  canTransfer: boolean;
  canApprove: boolean;
  canAudit: boolean;
  canAssignAudit: boolean;
  canClosePeriod: boolean;
  canManageSettings: boolean;
  canManageMasterData: boolean;
  hasBendaharaKasAccess: boolean;
  hasKetuaKasAccess: boolean;
  canViewBpsk: boolean;
  canViewAuditModule: boolean;
  canViewAuditTrail: boolean;
  canViewWarta: boolean;
  canViewConsolidatedLpj: boolean;
  canManageBudget: boolean;
  canManageOpeningBook: boolean;
  canManageLpjData: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_USER_SESSION_KEY = 'siku_hkbp_auth_user_id';
const LEGACY_LOCAL_USER_KEY = 'siku_hkbp_active_user_id';
const LEGACY_CLOUD_USER_KEY = 'siku_hkbp_cloud_active_user_id';

function readAuthenticatedUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(AUTH_USER_SESSION_KEY) || localStorage.getItem(AUTH_USER_SESSION_KEY);
}

function persistAuthenticatedUserId(userId: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(AUTH_USER_SESSION_KEY, userId);
  localStorage.setItem(AUTH_USER_SESSION_KEY, userId);
}

function clearAuthenticatedUserId() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(AUTH_USER_SESSION_KEY);
  localStorage.removeItem(AUTH_USER_SESSION_KEY);
  localStorage.removeItem(LEGACY_LOCAL_USER_KEY);
  sessionStorage.removeItem(LEGACY_CLOUD_USER_KEY);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [userKasAccess, setUserKasAccess] = useState<UserKasAccess[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Clean up legacy auto-login keys from older demo builds
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LEGACY_LOCAL_USER_KEY);
      sessionStorage.removeItem(LEGACY_CLOUD_USER_KEY);
    }

    async function initAuth() {
      if (isSupabaseConfigured && supabase) {
        try {
          const [profRes, accessRes, sessionRes] = await Promise.all([
            supabase.from('profiles').select('*').order('full_name'),
            supabase.from('user_kas_access').select('*'),
            supabase.auth.getSession(),
          ]);

          const dbProfiles: Profile[] =
            profRes.data && profRes.data.length > 0 ? (profRes.data as Profile[]) : [];
          const dbAccess: UserKasAccess[] =
            accessRes.data ? (accessRes.data as UserKasAccess[]) : [];

          const session = sessionRes.data?.session;
          if (session?.user) {
            const matched = dbProfiles.find(
              (p) =>
                p.id === session.user.id ||
                p.email.toLowerCase() === (session.user.email || '').toLowerCase()
            );
            if (matched && matched.is_active !== false) {
              persistAuthenticatedUserId(matched.id);
              setCurrentUser(matched);
              setUserKasAccess(dbAccess.filter((a) => a.user_id === matched.id));
              setLoading(false);
              return;
            }
          }

          const savedAuthUserId = readAuthenticatedUserId();
          if (savedAuthUserId) {
            const matched = dbProfiles.find((p) => p.id === savedAuthUserId && p.is_active !== false);
            if (matched) {
              setCurrentUser(matched);
              setUserKasAccess(dbAccess.filter((a) => a.user_id === matched.id));
              setLoading(false);
              return;
            }
            clearAuthenticatedUserId();
          }

          setCurrentUser(null);
          setUserKasAccess([]);
          setLoading(false);
          return;
        } catch (err) {
          console.warn('Supabase auth init error:', err);
          setCurrentUser(null);
          setUserKasAccess([]);
          setLoading(false);
          return;
        }
      }

      // Offline / Local mode (only when Supabase is not configured)
      const getStoredProfiles = (): Profile[] => {
        const stored = localStorage.getItem('siku_profiles');
        if (!stored) return DEMO_PROFILES;
        const parsed = JSON.parse(stored) as Profile[];
        // Ensure legacy local profiles without password_hash fall back to seeded hash if matching ID
        return parsed.map((p) => {
          if (p.password_hash) return p;
          const seed = DEMO_PROFILES.find((d) => d.id === p.id);
          return seed ? { ...p, password_hash: seed.password_hash } : p;
        });
      };
      const getStoredAccess = (): UserKasAccess[] => {
        const stored = localStorage.getItem('siku_user_kas_access');
        return stored ? JSON.parse(stored) : DEMO_USER_KAS_ACCESS;
      };

      const localProfiles = getStoredProfiles();
      const localAccess = getStoredAccess();
      const savedAuthUserId = readAuthenticatedUserId();

      if (savedAuthUserId) {
        const matched = localProfiles.find((p) => p.id === savedAuthUserId && p.is_active !== false);
        if (matched) {
          setCurrentUser(matched);
          setUserKasAccess(localAccess.filter((a) => a.user_id === matched.id));
          setLoading(false);
          return;
        }
        clearAuthenticatedUserId();
      }

      setCurrentUser(null);
      setUserKasAccess([]);
      setLoading(false);
    }

    initAuth();

    const handleLocalAccessUpdate = (evt: Event) => {
      const customEvt = evt as CustomEvent<UserKasAccess[]>;
      const updatedList = Array.isArray(customEvt.detail) ? customEvt.detail : [];
      setCurrentUser((prev) => {
        if (prev) setUserKasAccess(updatedList.filter((a) => a.user_id === prev.id));
        return prev;
      });
    };

    window.addEventListener('siku-user-kas-access-updated', handleLocalAccessUpdate);

    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel('auth-profiles-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, async () => {
          const { data } = await supabase!.from('profiles').select('*').order('full_name');
          if (data) {
            const list = data as Profile[];
            setCurrentUser((prev) => {
              if (!prev) return prev;
              const updated = list.find((p) => p.id === prev.id);
              if (!updated || updated.is_active === false) {
                clearAuthenticatedUserId();
                setUserKasAccess([]);
                return null;
              }
              return updated;
            });
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_kas_access' }, async () => {
          const { data } = await supabase!.from('user_kas_access').select('*');
          if (data) {
            const list = data as UserKasAccess[];
            setCurrentUser((prev) => {
              if (prev) setUserKasAccess(list.filter((a) => a.user_id === prev.id));
              return prev;
            });
          }
        })
        .subscribe();

      return () => {
        window.removeEventListener('siku-user-kas-access-updated', handleLocalAccessUpdate);
        supabase?.removeChannel(channel);
      };
    }

    return () => {
      window.removeEventListener('siku-user-kas-access-updated', handleLocalAccessUpdate);
    };
  }, []);

  const getLocalProfiles = (): Profile[] => {
    const stored = localStorage.getItem('siku_profiles');
    if (!stored) return DEMO_PROFILES;
    const parsed = JSON.parse(stored) as Profile[];
    return parsed.map((p) => {
      if (p.password_hash) return p;
      const seed = DEMO_PROFILES.find((d) => d.id === p.id);
      return seed ? { ...p, password_hash: seed.password_hash } : p;
    });
  };

  const getLocalUserKasAccess = (): UserKasAccess[] => {
    const stored = localStorage.getItem('siku_user_kas_access');
    return stored ? JSON.parse(stored) : DEMO_USER_KAS_ACCESS;
  };

  const loginWithEmail = async (email: string, password: string): Promise<{ error: Error | null }> => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return { error: new Error('Email dan kata sandi wajib diisi.') };
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const [profRes, accessRes] = await Promise.all([
          supabase.from('profiles').select('*'),
          supabase.from('user_kas_access').select('*'),
        ]);

        if (profRes.error) {
          return { error: new Error(`Gagal menghubungi server database: ${profRes.error.message}`) };
        }

        const cloudProfiles = (profRes.data as Profile[] | null) || [];
        const cloudAccess = (accessRes.data as UserKasAccess[] | null) || [];
        const matched = cloudProfiles.find((p) => p.email.trim().toLowerCase() === normalizedEmail);

        if (matched) {
          if (matched.is_active === false) {
            return {
              error: new Error('Akun Anda berstatus non-aktif. Hubungi Administrator HKBP Hutaraja.'),
            };
          }

          if (matched.password_hash) {
            if (!verifyUserPassword(password, matched.password_hash)) {
              return { error: new Error('Email atau kata sandi salah.') };
            }
            persistAuthenticatedUserId(matched.id);
            setCurrentUser(matched);
            setUserKasAccess(cloudAccess.filter((a) => a.user_id === matched.id));
            return { error: null };
          }

          // Account exists in profiles without password_hash yet -> verify via Supabase Auth if configured
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });
          if (!authError && authData.user) {
            persistAuthenticatedUserId(matched.id);
            setCurrentUser(matched);
            setUserKasAccess(cloudAccess.filter((a) => a.user_id === matched.id));
            return { error: null };
          }

          return {
            error: new Error(
              'Kata sandi untuk akun ini belum diatur atau salah. Hubungi Administrator untuk mengatur kata sandi.'
            ),
          };
        }

        // Try Supabase Auth in case profile is matched by auth user ID
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (!authError && authData.user) {
          const authMatched = cloudProfiles.find(
            (p) => p.id === authData.user?.id || p.email.trim().toLowerCase() === normalizedEmail
          );
          if (authMatched) {
            if (authMatched.is_active === false) {
              return { error: new Error('Akun Anda berstatus non-aktif. Hubungi Administrator.') };
            }
            persistAuthenticatedUserId(authMatched.id);
            setCurrentUser(authMatched);
            setUserKasAccess(cloudAccess.filter((a) => a.user_id === authMatched.id));
            return { error: null };
          }
        }

        return { error: new Error('Email atau kata sandi salah.') };
      } catch (err: any) {
        return { error: new Error(err?.message || 'Terjadi kesalahan saat masuk ke sistem.') };
      }
    }

    // Local fallback when Supabase is not configured
    const localProfiles = getLocalProfiles();
    const matched = localProfiles.find((p) => p.email.trim().toLowerCase() === normalizedEmail);
    if (!matched) {
      return { error: new Error('Email atau kata sandi salah.') };
    }
    if (matched.is_active === false) {
      return { error: new Error('Akun Anda berstatus non-aktif. Hubungi Administrator HKBP Hutaraja.') };
    }
    if (!verifyUserPassword(password, matched.password_hash)) {
      return { error: new Error('Email atau kata sandi salah.') };
    }

    const localAccess = getLocalUserKasAccess();
    persistAuthenticatedUserId(matched.id);
    setCurrentUser(matched);
    setUserKasAccess(localAccess.filter((a) => a.user_id === matched.id));
    return { error: null };
  };

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase signOut error:', err);
      }
    }
    clearAuthenticatedUserId();
    setCurrentUser(null);
    setUserKasAccess([]);
  };

  const updateOwnPassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) {
      return { success: false, error: 'Anda harus masuk terlebih dahulu.' };
    }
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Kata sandi baru minimal 6 karakter.' };
    }
    if (currentUser.password_hash && !verifyUserPassword(currentPassword, currentUser.password_hash)) {
      return { success: false, error: 'Kata sandi saat ini tidak sesuai.' };
    }

    const nextHash = hashUserPassword(newPassword);
    const updatedAt = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('profiles')
        .update({ password_hash: nextHash, updated_at: updatedAt })
        .eq('id', currentUser.id);
      if (error) {
        return {
          success: false,
          error: `Gagal memperbarui kata sandi di Supabase: ${error.message}`,
        };
      }
      setCurrentUser((prev) => (prev ? { ...prev, password_hash: nextHash, updated_at: updatedAt } : prev));
      return { success: true };
    }

    const localProfiles = getLocalProfiles();
    const nextProfiles = localProfiles.map((p) =>
      p.id === currentUser.id ? { ...p, password_hash: nextHash, updated_at: updatedAt } : p
    );
    localStorage.setItem('siku_profiles', JSON.stringify(nextProfiles));
    setCurrentUser((prev) => (prev ? { ...prev, password_hash: nextHash, updated_at: updatedAt } : prev));
    return { success: true };
  };

  // Permission helpers
  const isAdmin = currentUser?.role === 'admin';
  const isBendaharaUmum = currentUser?.role === 'bendahara_umum';
  const isAuditor = currentUser?.role === 'auditor';
  const isPendeta = currentUser?.role === 'pendeta_ressort';
  const isSekretaris = currentUser?.role === 'sekretaris';
  const isMajelis = currentUser?.role === 'majelis';
  const isPengurusKas = currentUser?.role === 'pengurus_kas';
  const isLeader = Boolean(
    currentUser &&
      ['admin', 'bendahara_umum', 'pendeta_ressort', 'sekretaris', 'majelis'].includes(currentUser.role)
  );

  const hasBendaharaKasAccess = userKasAccess.some((a) => a.access_level === 'bendahara');
  const hasKetuaKasAccess = userKasAccess.some((a) => a.access_level === 'ketua');

  // Kecuali admin, pencatat transaksi & penyetuju wajib ditetapkan pada Hak Akses Kas (user_kas_access)
  const canRecordTransactions = Boolean(
    currentUser && (isAdmin || hasBendaharaKasAccess)
  );

  const canTransfer = Boolean(
    currentUser && (isAdmin || hasBendaharaKasAccess)
  );

  const canApprove = Boolean(
    currentUser && (isAdmin || hasKetuaKasAccess)
  );

  const canAudit = Boolean(currentUser && (isAdmin || isAuditor));
  const canAssignAudit = Boolean(currentUser && (isAdmin || isPendeta));
  const canClosePeriod = Boolean(currentUser && (isAdmin || isBendaharaUmum));
  const canManageSettings = Boolean(currentUser && isAdmin);
  const canManageMasterData = Boolean(currentUser && (isAdmin || isBendaharaUmum));

  // Granular module visibility flags (Admin sees everything)
  const canViewBpsk = Boolean(
    currentUser && (isAdmin || isBendaharaUmum || isPendeta || isSekretaris || isMajelis || isAuditor)
  );
  const canViewAuditModule = Boolean(currentUser && (isAdmin || isAuditor || isPendeta));
  const canViewAuditTrail = Boolean(currentUser && (isAdmin || isAuditor));
  const canViewWarta = Boolean(
    currentUser && (isAdmin || isBendaharaUmum || isPendeta || isSekretaris || isMajelis || isPengurusKas)
  );
  const canViewConsolidatedLpj = Boolean(
    currentUser && (isAdmin || isBendaharaUmum || isPendeta || isSekretaris || isMajelis || isAuditor)
  );
  const canManageBudget = Boolean(
    currentUser && (isAdmin || isBendaharaUmum || isPendeta || isSekretaris || isMajelis || isPengurusKas)
  );
  const canManageOpeningBook = Boolean(
    currentUser && (isAdmin || isBendaharaUmum || isPendeta || isSekretaris || isPengurusKas)
  );
  const canManageLpjData = Boolean(
    currentUser && (isAdmin || isBendaharaUmum || hasBendaharaKasAccess)
  );

  const canInputKas = (kasId: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return userKasAccess.some((a) => a.kas_id === kasId && a.access_level === 'bendahara');
  };

  const canApproveKas = (kasId: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return userKasAccess.some((a) => a.kas_id === kasId && a.access_level === 'ketua');
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userKasAccess,
        loading,
        loginWithEmail,
        logout,
        updateOwnPassword,
        canInputKas,
        canApproveKas,
        isLeader,
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
        canAudit,
        canAssignAudit,
        canClosePeriod,
        canManageSettings,
        canManageMasterData,
        hasBendaharaKasAccess,
        hasKetuaKasAccess,
        canViewBpsk,
        canViewAuditModule,
        canViewAuditTrail,
        canViewWarta,
        canViewConsolidatedLpj,
        canManageBudget,
        canManageOpeningBook,
        canManageLpjData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
