import { isSupabaseConfigured, supabase } from './supabase';

// Token sesi untuk endpoint /api/* disimpan hanya di memori JS (tidak di localStorage/sessionStorage)
let inMemoryApiToken: string | null = null;

export function setInMemoryReceiptToken(token: string | null): void {
  inMemoryApiToken = token ? token.trim() : null;
}

export function clearInMemoryReceiptToken(): void {
  inMemoryApiToken = null;
}

export async function getActiveReceiptAuthToken(): Promise<string | null> {
  if (inMemoryApiToken) {
    return inMemoryApiToken;
  }
  if (isSupabaseConfigured && supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data?.session?.access_token;
      if (accessToken) return accessToken;
    } catch {
      // Abaikan jika sesi Supabase Auth kosong
    }
  }
  return null;
}
