import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface ServerUserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

export interface AuthResult {
  user: ServerUserProfile | null;
  authMethod: 'bearer' | 'cookie' | null;
  error?: string;
}

export const SESSION_COOKIE_NAME = 'siku_bukti_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 hari
const PASSWORD_HASH_DOMAIN_SALT = 'SISKEU-HKBP-HUTARAJA:';

const EPHEMERAL_FALLBACK_KEY = crypto.randomBytes(32).toString('hex');

export const VIEW_ALL_RECEIPT_ROLES = new Set([
  'admin',
  'pendeta_ressort',
  'auditor',
  'sekretaris',
  'majelis',
  'bendahara_umum',
]);

export const BLOCKED_UPLOAD_ROLES = new Set(['pendeta_ressort', 'auditor']);

function getSigningSecret(): Buffer {
  const explicitSecret = process.env.AUTH_SESSION_SECRET?.trim();
  if (explicitSecret) {
    return crypto.createHash('sha256').update(explicitSecret).digest();
  }
  const combined = [
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    process.env.GOOGLE_CLIENT_SECRET || '',
  ]
    .filter(Boolean)
    .join(':');

  if (combined) {
    return crypto.createHmac('sha256', 'siku-bukti-session-v1').update(combined).digest();
  }
  return crypto.createHash('sha256').update(EPHEMERAL_FALLBACK_KEY).digest();
}

export function getSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { url, anonKey, serviceRoleKey };
}

export function createServerSupabaseAdminClient(): SupabaseClient | null {
  const { url, anonKey, serviceRoleKey } = getSupabaseConfig();
  const key = serviceRoleKey || anonKey;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createServerSupabaseAnonClient(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function hashPasswordAppFormat(plainPassword: string): string {
  return crypto
    .createHash('sha256')
    .update(`${PASSWORD_HASH_DOMAIN_SALT}${plainPassword}`)
    .digest('hex');
}

export function verifyPasswordAppFormat(plainPassword: string, storedHash?: string | null): boolean {
  if (!plainPassword || !storedHash) return false;
  const computed = Buffer.from(hashPasswordAppFormat(plainPassword), 'utf8');
  const expected = Buffer.from(storedHash.trim().toLowerCase(), 'utf8');
  if (computed.length !== expected.length) return false;
  return crypto.timingSafeEqual(computed, expected);
}

interface SessionPayload {
  uid: string;
  exp: number;
}

export function signSessionToken(userId: string): string {
  const payload: SessionPayload = {
    uid: userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(`v1.${payloadB64}`)
    .digest('base64url');
  return `v1.${payloadB64}.${sig}`;
}

export function verifySignedSessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  const [, payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(`v1.${payloadB64}`)
    .digest('base64url');

  const sigBuf = Buffer.from(sigB64, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.uid || typeof parsed.exp !== 'number') return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    try {
      result[k] = decodeURIComponent(v);
    } catch {
      result[k] = v;
    }
  }
  return result;
}

export function isHttpsRequest(req: IncomingMessage): boolean {
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return proto === 'https' || Boolean(process.env.VERCEL);
}

export function buildSessionCookieHeader(req: IncomingMessage, token: string): string {
  const secureParts = isHttpsRequest(req) ? '; Secure; SameSite=None; Partitioned' : '; SameSite=Lax';
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/api; HttpOnly; Max-Age=${SESSION_TTL_SECONDS}${secureParts}`;
}

export function buildClearSessionCookieHeader(req: IncomingMessage): string {
  const secureParts = isHttpsRequest(req) ? '; Secure; SameSite=None; Partitioned' : '; SameSite=Lax';
  return `${SESSION_COOKIE_NAME}=; Path=/api; HttpOnly; Max-Age=0${secureParts}`;
}

export function isSameOriginRequest(req: IncomingMessage): boolean {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  if (!host) return true;

  const originHeader = req.headers.origin;
  if (originHeader) {
    try {
      const originHost = new URL(originHeader).host.toLowerCase();
      return originHost === host;
    } catch {
      return false;
    }
  }

  const refererHeader = req.headers.referer;
  if (refererHeader) {
    try {
      const refHost = new URL(refererHeader).host.toLowerCase();
      return refHost === host;
    } catch {
      return false;
    }
  }
  return true;
}

export async function authenticateRequest(req: IncomingMessage): Promise<AuthResult> {
  const adminClient = createServerSupabaseAdminClient();
  if (!adminClient) {
    return {
      user: null,
      authMethod: null,
      error: 'Konfigurasi Supabase di server belum lengkap.',
    };
  }

  const authHeader = String(req.headers.authorization || '').trim();
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const cookies = parseCookies(req);
  const cookieToken = cookies[SESSION_COOKIE_NAME] || '';

  // 1) Try signed app session token (either in Bearer header or HttpOnly cookie)
  const candidates: Array<{ token: string; method: 'bearer' | 'cookie' }> = [];
  if (bearerToken) candidates.push({ token: bearerToken, method: 'bearer' });
  if (cookieToken) candidates.push({ token: cookieToken, method: 'cookie' });

  for (const item of candidates) {
    const verified = verifySignedSessionToken(item.token);
    if (verified) {
      const { data: profile, error } = await adminClient
        .from('profiles')
        .select('id, email, full_name, role, is_active')
        .eq('id', verified.uid)
        .maybeSingle();

      if (error || !profile) {
        return {
          user: null,
          authMethod: null,
          error: 'Profil pengguna tidak ditemukan di database.',
        };
      }
      if (profile.is_active === false) {
        return {
          user: null,
          authMethod: null,
          error: 'Akun Anda berstatus non-aktif.',
        };
      }
      return {
        user: profile as ServerUserProfile,
        authMethod: item.method,
      };
    }
  }

  // 2) Fallback: verify standard Supabase Auth JWT if Bearer token is a Supabase JWT
  if (bearerToken) {
    const anonClient = createServerSupabaseAnonClient() || adminClient;
    const { data: userData, error: userErr } = await anonClient.auth.getUser(bearerToken);
    if (!userErr && userData?.user) {
      const authUser = userData.user;
      const { data: profById } = await adminClient
        .from('profiles')
        .select('id, email, full_name, role, is_active')
        .eq('id', authUser.id)
        .maybeSingle();

      let profile = profById as ServerUserProfile | null;
      if (!profile && authUser.email) {
        const { data: profByEmail } = await adminClient
          .from('profiles')
          .select('id, email, full_name, role, is_active')
          .ilike('email', authUser.email)
          .maybeSingle();
        profile = (profByEmail as ServerUserProfile | null) || null;
      }

      if (profile && profile.is_active !== false) {
        return { user: profile, authMethod: 'bearer' };
      }
    }
  }

  return {
    user: null,
    authMethod: null,
    error: 'Anda belum masuk atau sesi login telah berakhir. Silakan masuk kembali.',
  };
}

export async function canUserUploadToKas(
  adminClient: SupabaseClient,
  user: ServerUserProfile,
  kasId?: string | null
): Promise<boolean> {
  if (BLOCKED_UPLOAD_ROLES.has(user.role)) {
    return false;
  }
  if (user.role === 'admin') {
    return true;
  }

  let query = adminClient
    .from('user_kas_access')
    .select('id, kas_id, access_level')
    .eq('user_id', user.id)
    .eq('access_level', 'bendahara');

  if (kasId) {
    query = query.eq('kas_id', kasId);
  }

  const { data, error } = await query.limit(1);
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

export function canUserViewReceipt(
  user: ServerUserProfile,
  tx: { created_by?: string | null }
): boolean {
  if (VIEW_ALL_RECEIPT_ROLES.has(user.role)) {
    return true;
  }
  return Boolean(tx.created_by && tx.created_by === user.id);
}

export function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

export async function readJsonBody<T = Record<string, unknown>>(
  req: IncomingMessage,
  maxBytes = 16 * 1024
): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Body permintaan terlalu besar.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve((text ? JSON.parse(text) : {}) as T);
      } catch {
        reject(new Error('Format JSON tidak valid.'));
      }
    });
    req.on('error', (err) => reject(err));
  });
}
