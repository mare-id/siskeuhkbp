/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Profile, UserKasAccess } from '../types/database';
import { DEMO_PROFILES, DEMO_USER_KAS_ACCESS } from '../lib/demoData';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

interface AuthContextType {
  currentUser: Profile | null;
  userKasAccess: UserKasAccess[];
  loading: boolean;
  isDemoMode: boolean;
  loginWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
  switchDemoUser: (userId: string) => void;
  availableDemoUsers: Profile[];
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
  canClosePeriod: boolean;
  canManageSettings: boolean;
  canManageMasterData: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_USER_KEY = 'siku_hkbp_active_user_id';
const SESSION_STORAGE_USER_KEY = 'siku_hkbp_cloud_active_user_id';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [profilesList, setProfilesList] = useState<Profile[]>(isSupabaseConfigured ? [] : DEMO_PROFILES);
  const [allKasAccess, setAllKasAccess] = useState<UserKasAccess[]>(isSupabaseConfigured ? [] : DEMO_USER_KAS_ACCESS);
  const [userKasAccess, setUserKasAccess] = useState<UserKasAccess[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(!isSupabaseConfigured);

  useEffect(() => {
    async function initAuth() {
      if (isSupabaseConfigured && supabase) {
        setIsDemoMode(false);
        try {
          const [profRes, accessRes, sessionRes] = await Promise.all([
            supabase.from('profiles').select('*').order('full_name'),
            supabase.from('user_kas_access').select('*'),
            supabase.auth.getSession(),
          ]);

          const dbProfiles: Profile[] =
            profRes.data && profRes.data.length > 0 ? (profRes.data as Profile[]) : DEMO_PROFILES;
          const dbAccess: UserKasAccess[] =
            accessRes.data ? (accessRes.data as UserKasAccess[]) : [];

          setProfilesList(dbProfiles);
          setAllKasAccess(dbAccess);

          const session = sessionRes.data?.session;
          if (session?.user) {
            const matched =
              dbProfiles.find((p) => p.id === session.user.id || p.email.toLowerCase() === (session.user.email || '').toLowerCase());
            if (matched) {
              setCurrentUser(matched);
              setUserKasAccess(dbAccess.filter((a) => a.user_id === matched.id));
              setLoading(false);
              return;
            }
          }

          // Use selected cloud dashboard user from sessionStorage or default to Bendahara Umum
          const savedCloudUserId =
            (typeof window !== 'undefined' ? sessionStorage.getItem(SESSION_STORAGE_USER_KEY) : null) || 'user-bendum';
          const initialUser =
            dbProfiles.find((p) => p.id === savedCloudUserId) ||
            dbProfiles.find((p) => p.role === 'bendahara_umum') ||
            dbProfiles[0] ||
            null;
          setCurrentUser(initialUser);
          setUserKasAccess(initialUser ? dbAccess.filter((a) => a.user_id === initialUser.id) : []);
          setLoading(false);
          return;
        } catch (err) {
          console.warn('Supabase auth init error:', err);
          setLoading(false);
          return;
        }
      }

      // Demo Mode (hanya jika Supabase belum dikonfigurasi)
      const getStoredProfiles = (): Profile[] => {
        const stored = localStorage.getItem('siku_profiles');
        return stored ? JSON.parse(stored) : DEMO_PROFILES;
      };
      const getStoredAccess = (): UserKasAccess[] => {
        const stored = localStorage.getItem('siku_user_kas_access');
        return stored ? JSON.parse(stored) : DEMO_USER_KAS_ACCESS;
      };
      const localProfiles = getStoredProfiles();
      const localAccess = getStoredAccess();
      setProfilesList(localProfiles);
      setAllKasAccess(localAccess);

      const savedUserId = localStorage.getItem(LOCAL_STORAGE_USER_KEY) || 'user-bendum';
      const initialUser = localProfiles.find((p) => p.id === savedUserId) || localProfiles[1] || DEMO_PROFILES[1];
      setCurrentUser(initialUser);
      setUserKasAccess(localAccess.filter((a) => a.user_id === initialUser.id));
      setIsDemoMode(true);
      setLoading(false);
    }

    initAuth();

    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel('auth-profiles-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, async () => {
          const { data } = await supabase!.from('profiles').select('*').order('full_name');
          if (data && data.length > 0) {
            setProfilesList(data as Profile[]);
            setCurrentUser((prev) => {
              if (!prev) return prev;
              return (data as Profile[]).find((p) => p.id === prev.id) || prev;
            });
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_kas_access' }, async () => {
          const { data } = await supabase!.from('user_kas_access').select('*');
          if (data) {
            const list = data as UserKasAccess[];
            setAllKasAccess(list);
            setCurrentUser((prev) => {
              if (prev) setUserKasAccess(list.filter((a) => a.user_id === prev.id));
              return prev;
            });
          }
        })
        .subscribe();

      return () => {
        supabase?.removeChannel(channel);
      };
    }
  }, []);

  const getActiveProfiles = (): Profile[] => {
    if (isSupabaseConfigured) return profilesList;
    const stored = localStorage.getItem('siku_profiles');
    return stored ? JSON.parse(stored) : DEMO_PROFILES;
  };

  const getActiveUserKasAccess = (): UserKasAccess[] => {
    if (isSupabaseConfigured) return allKasAccess;
    const stored = localStorage.getItem('siku_user_kas_access');
    return stored ? JSON.parse(stored) : DEMO_USER_KAS_ACCESS;
  };

  const switchDemoUser = async (userId: string) => {
    if (isSupabaseConfigured && supabase) {
      // Refresh latest profiles & access from Supabase so dashboard reflects live cloud permissions
      const [profRes, accessRes] = await Promise.all([
        supabase.from('profiles').select('*').order('full_name'),
        supabase.from('user_kas_access').select('*'),
      ]);
      const list = profRes.data && profRes.data.length > 0 ? (profRes.data as Profile[]) : profilesList;
      const accessList = accessRes.data ? (accessRes.data as UserKasAccess[]) : allKasAccess;
      if (profRes.data && profRes.data.length > 0) setProfilesList(list);
      if (accessRes.data) setAllKasAccess(accessList);

      const selected = list.find((p) => p.id === userId);
      if (selected) {
        setCurrentUser(selected);
        if (typeof window !== 'undefined') sessionStorage.setItem(SESSION_STORAGE_USER_KEY, userId);
        setUserKasAccess(accessList.filter((a) => a.user_id === selected.id));
      }
      return;
    }

    const list = getActiveProfiles();
    const accessList = getActiveUserKasAccess();
    const selected = list.find((p) => p.id === userId);
    if (selected) {
      setCurrentUser(selected);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, userId);
      setUserKasAccess(accessList.filter((a) => a.user_id === selected.id));
    }
  };

  const loginWithEmail = async (email: string, password: string): Promise<{ error: Error | null }> => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error && data.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();
          if (profile) {
            setCurrentUser(profile as Profile);
            const { data: access } = await supabase.from('user_kas_access').select('*').eq('user_id', profile.id);
            if (access) setUserKasAccess(access as UserKasAccess[]);
            setIsDemoMode(false);
            return { error: null };
          }
        }
        // Fallback: match against cloud profiles table for church dashboard login
        const { data: cloudProfiles } = await supabase.from('profiles').select('*');
        const matched = (cloudProfiles as Profile[] | null)?.find(
          (p) => p.email.toLowerCase() === email.toLowerCase()
        );
        if (matched && !error) {
          await switchDemoUser(matched.id);
          return { error: null };
        }
        return { error: error || new Error('Akun tidak ditemukan.') };
      } catch (err: any) {
        return { error: err };
      }
    } else {
      const matched = getActiveProfiles().find((p) => p.email.toLowerCase() === email.toLowerCase());
      if (matched) {
        switchDemoUser(matched.id);
        return { error: null };
      }
      return { error: new Error('Pengguna tidak ditemukan dalam daftar akun percontohan.') };
    }
  };

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
      if (typeof window !== 'undefined') sessionStorage.removeItem(SESSION_STORAGE_USER_KEY);
      const majelisUser = profilesList.find((p) => p.role === 'majelis') || profilesList[0] || null;
      setCurrentUser(majelisUser);
      setUserKasAccess(majelisUser ? allKasAccess.filter((a) => a.user_id === majelisUser.id) : []);
      return;
    }
    const activeProfiles = getActiveProfiles();
    const majelisUser = activeProfiles.find((p) => p.role === 'majelis') || activeProfiles[0] || DEMO_PROFILES[0];
    setCurrentUser(majelisUser);
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
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

  const canRecordTransactions = Boolean(
    currentUser &&
    (isAdmin || isBendaharaUmum || (isPengurusKas && userKasAccess.some((a) => a.access_level === 'bendahara')))
  );

  const canTransfer = Boolean(
    currentUser &&
    (isAdmin || isBendaharaUmum || (isPengurusKas && userKasAccess.some((a) => a.access_level === 'bendahara')))
  );

  const canApprove = Boolean(
    currentUser &&
    (isAdmin || isPendeta || isSekretaris || userKasAccess.some((a) => a.access_level === 'ketua'))
  );

  const canAudit = Boolean(currentUser && (isAdmin || isAuditor));
  const canClosePeriod = Boolean(currentUser && (isAdmin || isBendaharaUmum));
  const canManageSettings = Boolean(currentUser && isAdmin);
  const canManageMasterData = Boolean(currentUser && (isAdmin || isBendaharaUmum));

  const BENDUM_KAS_IDS = ['kas-1', 'kas-2', 'kas-7', 'kas-8', 'kas-9'];

  const canInputKas = (kasId: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'bendahara_umum') {
      const assigned = userKasAccess.filter((a) => a.access_level === 'bendahara');
      if (assigned.length > 0) {
        return assigned.some((a) => a.kas_id === kasId);
      }
      return BENDUM_KAS_IDS.includes(kasId);
    }
    if (['auditor', 'pendeta_ressort', 'sekretaris', 'majelis'].includes(currentUser.role)) {
      return false;
    }
    return userKasAccess.some((a) => a.kas_id === kasId && a.access_level === 'bendahara');
  };

  const canApproveKas = (kasId: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'auditor') return false;
    if (currentUser.role === 'bendahara_umum') return false;
    if (currentUser.role === 'pendeta_ressort') return true;
    if (currentUser.role === 'sekretaris' && BENDUM_KAS_IDS.includes(kasId)) return true;
    return userKasAccess.some((a) => a.kas_id === kasId && a.access_level === 'ketua');
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userKasAccess,
        loading,
        isDemoMode,
        loginWithEmail,
        logout,
        switchDemoUser,
        availableDemoUsers: getActiveProfiles(),
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
        canClosePeriod,
        canManageSettings,
        canManageMasterData,
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
