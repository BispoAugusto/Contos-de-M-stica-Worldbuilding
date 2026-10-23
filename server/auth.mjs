import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { AppError } from './providers.mjs';
import { readJson } from './http.mjs';

const COOKIE = '__Host-worldbuilding';
const MAX_AGE = 8 * 60 * 60;
const equal = (a, b) => {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

export function createAuth({ accessKeyHash, sessionSecret, now = () => Math.floor(Date.now() / 1000) }) {
  if (![accessKeyHash, sessionSecret].every(value => /^[a-f0-9]{64}$/.test(value || ''))) throw new Error('Configure hash de acesso e segredo de sessão com 64 caracteres hexadecimais.');
  const sign = value => createHmac('sha256', sessionSecret).update(value).digest('hex');
  const cookie = (token, age) => `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
  const csrfFor = token => sign('csrf:' + token);
  const sessionFrom = req => {
    const token = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
    if (!token || token.length > 512) return null;
    const [payload, signature, extra] = token.split('.');
    if (extra !== undefined || !signature || !equal(sign('session:' + payload), signature)) return null;
    try {
      const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
      if (!Number.isSafeInteger(session.exp) || session.exp <= now() || session.exp > now() + MAX_AGE || !/^[a-f0-9]{64}$/.test(session.nonce || '')) return null;
      return token;
    } catch { return null; }
  };
  return async (req, res, url, json) => {
    if (req.method === 'POST' && url.pathname === '/api/login') {
      const input = await readJson(req, 2048);
      const key = typeof input?.key === 'string' ? input.key : '';
      const digest = createHash('sha256').update(key).digest('hex');
      if (!/^[a-f0-9]{64}$/.test(key) || !equal(digest, accessKeyHash)) throw new AppError(401, 'Chave de acesso inválida.');
      const payload = Buffer.from(JSON.stringify({ exp: now() + MAX_AGE, nonce: randomBytes(32).toString('hex') })).toString('base64url');
      const token = payload + '.' + sign('session:' + payload);
      res.setHeader('Set-Cookie', cookie(token, MAX_AGE));
      json(res, 200, { authenticated: true });
      return { handled: true };
    }
    const token = sessionFrom(req);
    if (!token) throw new AppError(401, 'Entre com sua chave de acesso para abrir o acervo.');
    const csrf = csrfFor(token);
    if (req.method === 'POST' && url.pathname === '/api/logout') {
      if (!equal(req.headers['x-csrf-token'] || '', csrf)) throw new AppError(403, 'Sessão inválida.');
      res.setHeader('Set-Cookie', cookie('', 0));
      json(res, 200, { authenticated: false });
      return { handled: true };
    }
    return { csrf };
  };
}
