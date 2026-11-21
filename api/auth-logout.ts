import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildClearSessionCookieHeader, sendJson } from './_lib/session';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Metode tidak diizinkan.' });
  }
  res.setHeader('Set-Cookie', buildClearSessionCookieHeader(req));
  return sendJson(res, 200, { ok: true });
}
