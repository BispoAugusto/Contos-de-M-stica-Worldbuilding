import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { LocalProvider, GitHubProvider, AppError, validPath } from './providers.mjs';
import { buildIndex, parseDocument, reviewIndex } from '../shared/domain.mjs';
import { readJson } from './http.mjs';

const base = new URL('../', import.meta.url);
export function configuredProvider(env = process.env) {
  if (env.WORLD_PROVIDER && !['local', 'github'].includes(env.WORLD_PROVIDER)) throw new Error('WORLD_PROVIDER inválido.');
  return env.WORLD_PROVIDER === 'github' ? new GitHubProvider({ repository: env.GITHUB_REPOSITORY, branch: env.GITHUB_BRANCH, root: env.GITHUB_CONTENT_ROOT, token: env.GITHUB_TOKEN }) : new LocalProvider(env.WORLD_ROOT || fileURLToPath(new URL('examples/world/', base)));
}
export function createHandler(provider, { demo = false, origin = null, authenticate = null } = {}) {
  if (origin && !authenticate) throw new Error('Acesso hospedado exige autenticação.');
  const localCsrf = randomBytes(32).toString('hex');
  let writes = Promise.resolve();
  const json = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
  const snapshot = async () => {
    const files = [];
    for (const path of await provider.list()) files.push(await provider.read(path));
    return files;
  };
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const expectedOrigin = origin || `http://127.0.0.1:${req.socket.localPort}`;
      const expectedHost = new URL(expectedOrigin).host;
      if (req.headers.host !== expectedHost) throw new AppError(403, 'Host não permitido. Use o endereço configurado do aplicativo.');
      if (req.headers.origin && req.headers.origin !== expectedOrigin) throw new AppError(403, 'Origem não permitida.');
      if (origin && !['GET', 'HEAD'].includes(req.method) && req.headers.origin !== expectedOrigin) throw new AppError(403, 'Origem obrigatória para esta operação.');
      if (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) throw new AppError(403, 'Requisição entre sites bloqueada.');
      const url = new URL(req.url, expectedOrigin);
      const auth = authenticate ? await authenticate(req, res, url, json) : { csrf: localCsrf };
      if (auth.handled) return;
      const csrf = auth.csrf;
      if (req.method === 'GET' && url.pathname === '/api/session') return json(res, 200, { csrf, mode: provider.mode, demo, hosted: Boolean(origin), branch: provider.branch || null, repository: provider.repository || null });
      if (req.method === 'GET' && ['/api/catalog', '/api/index'].includes(url.pathname)) {
        const files = await snapshot();
        const documents = buildIndex(files);
        return json(res, 200, { files, documents, findings: reviewIndex(documents) });
      }
      if (req.method === 'PUT' && url.pathname === '/api/document') {
        const received = Buffer.from(req.headers['x-csrf-token'] || '');
        if (received.length !== csrf.length || !timingSafeEqual(received, Buffer.from(csrf))) throw new AppError(403, 'Sessão inválida. Recarregue a página.');
        const input = await readJson(req);
        if (!input || typeof input !== 'object') throw new AppError(400, 'Documento inválido.');
        validPath(input.path);
        if (typeof input.content !== 'string' || Buffer.byteLength(input.content) > 256000 || !(input.sha === null || typeof input.sha === 'string')) throw new AppError(400, 'Conteúdo ou versão inválida.');
        const operation = writes.then(async () => {
          const files = await snapshot();
          const previous = files.find(f => f.path === input.path);
          if ((previous?.sha ?? null) !== input.sha) throw new AppError(409, 'O arquivo mudou. Baixe seu rascunho e recarregue para comparar.');
          const old = parseDocument(previous?.content || '', input.path);
          const next = parseDocument(input.content, input.path);
          if ([old.meta.status, next.meta.status].includes('canonico') || [old.meta.type, next.meta.type].includes('pilar')) {
            if (input.confirmCanon !== true) throw new AppError(400, 'Confirme explicitamente a alteração de cânone ou pilar.');
          }
          const updated = buildIndex([...files.filter(f => f.path !== input.path), { path: input.path, content: input.content }]);
          const errors = updated.flatMap(doc => doc.errors.map(message => `${doc.path}: ${message}`));
          if (errors.length) throw new AppError(422, errors.join('\n'));
          return provider.save(input.path, input.content, input.sha);
        });
        writes = operation.catch(() => {});
        return json(res, 200, await operation);
      }
      const staticFiles = { '/': ['web/index.html', 'text/html'], '/app.mjs': ['web/app.mjs', 'text/javascript'], '/style.css': ['web/style.css', 'text/css'], '/shared/domain.mjs': ['shared/domain.mjs', 'text/javascript'] };
      if (req.method === 'GET' && Object.hasOwn(staticFiles, url.pathname)) {
        const [file, type] = staticFiles[url.pathname];
        res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` }); res.end(await readFile(new URL(file, base))); return;
      }
      throw new AppError(404, 'Recurso não encontrado.');
    } catch (error) { if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'Falha interna ao acessar o conteúdo.' }); else res.end(); }
  };
}
export function createApp(provider, options) { return http.createServer(createHandler(provider, options)); }
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const provider = configuredProvider();
  const server = createApp(provider, { demo: provider.mode === 'local' && !process.env.WORLD_ROOT });
  server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`Worldbuilding: http://127.0.0.1:${server.address().port}`));
}
