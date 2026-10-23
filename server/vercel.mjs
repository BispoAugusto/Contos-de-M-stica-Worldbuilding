import { configuredProvider, createHandler } from './index.mjs';
import { createAuth } from './auth.mjs';

export function hostedHandler(env = process.env) {
  const origin = new URL(env.APP_ORIGIN || '');
  if (origin.protocol !== 'https:' || origin.origin !== env.APP_ORIGIN || origin.username || origin.password || env.WORLD_PROVIDER !== 'github') throw new Error('Configure APP_ORIGIN HTTPS e WORLD_PROVIDER=github.');
  const authenticate = createAuth({ accessKeyHash: env.APP_ACCESS_KEY_SHA256, sessionSecret: env.APP_SESSION_SECRET });
  return createHandler(configuredProvider(env), { origin: origin.origin, authenticate });
}

let handler;
export default async function vercelHandler(req, res) {
  try { handler ||= hostedHandler(); }
  catch {
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify({ error: 'A publicação aguarda configuração privada no servidor. Consulte docs/VERCEL.md.' }));
    return;
  }
  return handler(req, res);
}
