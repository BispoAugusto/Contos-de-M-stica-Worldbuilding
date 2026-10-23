import { readdir, readFile, writeFile, rename, mkdir, realpath, lstat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export class AppError extends Error { constructor(status, message) { super(message); this.status = status; } }
export const hash = text => createHash('sha256').update(text).digest('hex');
export function validPath(value) {
  if (typeof value !== 'string' || value.length > 240 || !value.endsWith('.md') || value.startsWith('/') || /[\\\x00-\x1f<>:"|?*%]/.test(value) || value.split('/').some(p => !p || p === '.' || p === '..' || p.startsWith('.') || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) throw new AppError(400, 'Caminho Markdown inválido.');
  return value;
}
export class LocalProvider {
  constructor(root) { this.root = path.resolve(root); this.mode = 'local'; this.queue = Promise.resolve(); }
  async checked(relative) {
    validPath(relative);
    const root = await realpath(this.root);
    let current = root;
    for (const part of relative.split('/')) {
      current = path.join(current, part);
      try { if ((await lstat(current)).isSymbolicLink()) throw new AppError(400, 'Links simbólicos não são permitidos.'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    if (!current.startsWith(root + path.sep)) throw new AppError(400, 'Caminho fora do conteúdo.');
    return current;
  }
  async list() {
    const paths = [];
    const visit = async (dir, prefix = '') => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.isSymbolicLink() || entry.name === 'node_modules') continue;
        const relative = prefix + entry.name;
        if (entry.isDirectory()) await visit(path.join(dir, entry.name), relative + '/');
        else if (entry.isFile() && relative.endsWith('.md')) { validPath(relative); paths.push(relative); }
        if (paths.length > 500) throw new AppError(413, 'MVP limitado a 500 documentos.');
      }
    };
    await visit(this.root);
    return paths.sort();
  }
  async read(relative) {
    const file = await this.checked(relative);
    try {
      if ((await lstat(file)).size > 256000) throw new AppError(413, 'Documento excede 256 KB.');
      const content = await readFile(file, 'utf8');
      return { path: relative, content, sha: hash(content) };
    } catch (error) { if (error.code === 'ENOENT') throw new AppError(404, 'Arquivo não encontrado.'); throw error; }
  }
  save(relative, content, expectedSha) {
    const run = this.queue.then(async () => {
      const file = await this.checked(relative);
      let previous = null;
      try { previous = await this.read(relative); } catch (error) { if (error.status !== 404) throw error; }
      if ((previous?.sha ?? null) !== expectedSha) throw new AppError(409, 'O arquivo mudou. Preserve seu rascunho e recarregue antes de salvar.');
      await mkdir(path.dirname(file), { recursive: true });
      await this.checked(relative);
      const temp = file + '.' + randomUUID() + '.tmp';
      try { await writeFile(temp, content, { flag: 'wx' }); await rename(temp, file); }
      finally { await unlink(temp).catch(() => {}); }
      return { path: relative, content, sha: hash(content) };
    });
    this.queue = run.catch(() => {});
    return run;
  }
}

export class GitHubProvider {
  constructor({ repository, branch, root, token, fetcher = fetch }) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !/^codex\/worldbuilding-[\w-]+$/.test(branch || '') || !root || !token) throw new AppError(500, 'Configure repositório, branch codex/worldbuilding-*, raiz e credencial no servidor.');
    validPath(root + '/check.md');
    this.repository = repository; this.branch = branch; this.root = root; this.token = token; this.fetcher = fetcher; this.mode = 'github';
  }
  async request(route, options = {}) {
    let response;
    try { response = await this.fetcher(`https://api.github.com/repos/${this.repository}/${route}`, { ...options, signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10', 'Content-Type': 'application/json', 'User-Agent': 'worldbuilding-mvp' }, redirect: 'error' }); }
    catch { throw new AppError(502, 'Não foi possível contatar o GitHub.'); }
    if (!response.ok) throw new AppError([401, 403, 404, 409, 422].includes(response.status) ? response.status : 502, response.status === 409 || response.status === 422 ? 'Conflito no GitHub. Preserve o rascunho e recarregue.' : `GitHub retornou ${response.status}. Verifique acesso, branch e raiz no servidor.`);
    return response.json();
  }
  route(relative) { validPath(relative); return `contents/${(this.root + '/' + relative).split('/').map(encodeURIComponent).join('/')}`; }
  async list() {
    const data = await this.request(`git/trees/${encodeURIComponent(this.branch)}?recursive=1`);
    if (data.truncated) throw new AppError(413, 'Árvore incompleta no GitHub. Reduza o escopo antes de continuar.');
    const paths = data.tree.filter(e => e.type === 'blob' && e.mode === '100644' && e.path.startsWith(this.root + '/') && e.path.endsWith('.md')).map(e => e.path.slice(this.root.length + 1));
    paths.forEach(validPath);
    if (paths.length > 500) throw new AppError(413, 'MVP limitado a 500 documentos.');
    return paths.sort();
  }
  async read(relative) {
    const data = await this.request(this.route(relative) + `?ref=${encodeURIComponent(this.branch)}`);
    if (data.type !== 'file' || data.encoding !== 'base64' || data.size > 256000 || data.target) throw new AppError(413, 'Arquivo não suportado ou maior que 256 KB.');
    return { path: relative, content: Buffer.from(data.content, 'base64').toString('utf8'), sha: data.sha };
  }
  async save(relative, content, expectedSha) {
    const result = await this.request(this.route(relative), { method: 'PUT', body: JSON.stringify({ message: `docs(world): editar ${relative}`, branch: this.branch, content: Buffer.from(content).toString('base64'), ...(expectedSha ? { sha: expectedSha } : {}) }) });
    return { path: relative, content, sha: result.content.sha };
  }
}
