import { AppError } from './providers.mjs';

export async function readJson(req, limit = 400000) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new AppError(415, 'Envie JSON.');
  // Vercel may already have parsed the request body.
  if (req.body !== undefined) {
    const encoded = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(encoded) > limit) throw new AppError(413, 'Requisição muito grande.');
    try { return JSON.parse(encoded); } catch { throw new AppError(400, 'JSON inválido.'); }
  }
  const chunks = []; let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > limit) throw new AppError(413, 'Requisição muito grande.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new AppError(400, 'JSON inválido.'); }
}
