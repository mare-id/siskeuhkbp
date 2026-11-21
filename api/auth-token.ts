import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  buildSessionCookieHeader,
  createServerSupabaseAdminClient,
  createServerSupabaseAnonClient,
  isSameOriginRequest,
  readJsonBody,
  sendJson,
  signSessionToken,
  verifyPasswordAppFormat,
} from './_lib/session';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Metode tidak diizinkan.' });
  }

  if (!isSameOriginRequest(req)) {
    return sendJson(res, 403, { ok: false, error: 'Permintaan lintas origin ditolak.' });
  }

  const adminClient = createServerSupabaseAdminClient();
  if (!adminClient) {
    return sendJson(res, 500, {
      ok: false,
      error: 'Konfigurasi Supabase di server belum lengkap.',
    });
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await readJsonBody<{ email?: unknown; password?: unknown }>(req);
  } catch (err: unknown) {
    return sendJson(res, 400, {
      ok: false,
      error: err instanceof Error ? err.message : 'Permintaan tidak valid.',
    });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return sendJson(res, 400, { ok: false, error: 'Email dan kata sandi wajib diisi.' });
  }

  try {
    const { data: profile, error: profErr } = await adminClient
      .from('profiles')
      .select('id, email, full_name, role, password_hash, is_active')
      .ilike('email', email)
      .maybeSingle();

    if (profErr) {
      return sendJson(res, 500, {
        ok: false,
        error: 'Gagal memeriksa profil pengguna di database.',
      });
    }

    let verifiedUserId: string | null = null;

    if (profile) {
      if (profile.is_active === false) {
        return sendJson(res, 403, {
          ok: false,
          error: 'Akun Anda berstatus non-aktif. Hubungi Administrator.',
        });
      }

      if (profile.password_hash) {
        if (verifyPasswordAppFormat(password, profile.password_hash)) {
          verifiedUserId = profile.id;
        } else {
          return sendJson(res, 401, { ok: false, error: 'Email atau kata sandi salah.' });
        }
      }
    }

    // Fallback ke Supabase Auth jika akun memakai Supabase Auth
    if (!verifiedUserId) {
      const anonClient = createServerSupabaseAnonClient() || adminClient;
      const { data: authData, error: authErr } = await anonClient.auth.signInWithPassword({
        email,
        password,
      });

      if (!authErr && authData?.user) {
        const { data: matched } = await adminClient
          .from('profiles')
          .select('id, is_active')
          .or(`id.eq.${authData.user.id},email.ilike.${email}`)
          .maybeSingle();

        if (matched && matched.is_active !== false) {
          verifiedUserId = matched.id;
        }
      }
    }

    if (!verifiedUserId) {
      return sendJson(res, 401, { ok: false, error: 'Email atau kata sandi salah.' });
    }

    const token = signSessionToken(verifiedUserId);
    res.setHeader('Set-Cookie', buildSessionCookieHeader(req, token));
    return sendJson(res, 200, { ok: true, token });
  } catch {
    return sendJson(res, 500, {
      ok: false,
      error: 'Terjadi kesalahan saat memverifikasi sesi login.',
    });
  }
}
