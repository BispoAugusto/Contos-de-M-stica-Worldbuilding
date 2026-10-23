export const TYPES = ['nota', 'pilar', 'local', 'personagem', 'faccao', 'povo', 'evento', 'criatura', 'magia'];
export const STATUSES = ['exemplo', 'proposta', 'canonico'];
export const VISIBILITIES = ['mestre', 'jogadores'];

// Deliberately small YAML subset: scalar strings and inline JSON string arrays.
// Unsupported frontmatter remains visible in the editor and blocks saving.
export function parseDocument(text, path = '') {
  const meta = {}, errors = [];
  let body = text;
  if (/^---\r?\n/.test(text)) {
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) errors.push('Frontmatter sem fechamento --- .');
    else {
      body = text.slice(match[0].length);
      for (const line of match[1].split(/\r?\n/)) {
        if (!line.trim() || line.trim().startsWith('#')) continue;
        const pair = line.match(/^([a-z][a-z0-9_-]*):\s*(.*?)\s*$/i);
        if (!pair) { errors.push(`Metadado não suportado: ${line}`); continue; }
        const [, key, value] = pair;
        if (Object.hasOwn(meta, key)) { errors.push(`Campo repetido: ${key}`); continue; }
        try { meta[key] = value.startsWith('[') || value.startsWith('"') ? JSON.parse(value) : value; }
        catch { errors.push(`Valor inválido: ${key}`); }
      }
    }
  }
  for (const [field, allowed] of [['type', TYPES], ['status', STATUSES], ['visibility', VISIBILITIES]]) {
    if (meta[field] !== undefined && !allowed.includes(meta[field])) errors.push(`${field}: use ${allowed.join(', ')}.`);
  }
  for (const field of ['id', 'title']) if (meta[field] !== undefined && (typeof meta[field] !== 'string' || !meta[field].trim())) errors.push(`${field} precisa ser texto não vazio.`);
  if (meta.pillars !== undefined && (!Array.isArray(meta.pillars) || meta.pillars.some(x => typeof x !== 'string'))) errors.push('pillars deve ser uma lista JSON de IDs.');
  return { path, meta, body, errors, title: typeof meta.title === 'string' ? meta.title : body.match(/^#\s+(.+)$/m)?.[1] || path.split('/').pop()?.replace(/\.md$/i, '') || 'Sem título' };
}

export function linksIn(text) {
  const clean = text.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g, '');
  return [...clean.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|(?<!!)\[([^\]]+)\]\(([^)\s]+)\)/g)].map(m => ({ target: m[1] || m[4], label: m[2] || m[1] || m[3], wiki: Boolean(m[1]) }));
}

export function resolveLink(target, source, paths, wiki = false) {
  if (/^https?:\/\//i.test(target)) return { kind: 'external', target };
  if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith('//')) return { kind: 'blocked', target };
  let decoded;
  try { decoded = decodeURIComponent(target.split('#')[0]); } catch { return { kind: 'missing', target }; }
  if (!decoded) return { kind: 'internal', path: source, fragment: target.split('#')[1] };
  const normalize = value => {
    const parts = [];
    for (const part of value.split('/')) { if (part === '..') parts.pop(); else if (part && part !== '.') parts.push(part); }
    return parts.join('/');
  };
  const base = source.includes('/') ? source.slice(0, source.lastIndexOf('/') + 1) : '';
  const candidate = normalize(decoded.startsWith('/') ? decoded : base + decoded);
  const candidates = [candidate, `${candidate}.md`];
  if (wiki) candidates.push(normalize(decoded), `${normalize(decoded)}.md`);
  const exact = candidates.find(p => paths.includes(p));
  if (exact) return { kind: 'internal', path: exact, fragment: target.split('#')[1] };
  if (wiki && !decoded.includes('/')) {
    const matches = paths.filter(p => p.split('/').pop().replace(/\.md$/i, '') === decoded.replace(/\.md$/i, ''));
    if (matches.length === 1) return { kind: 'internal', path: matches[0] };
    if (matches.length > 1) return { kind: 'ambiguous', target, matches };
  }
  return { kind: 'missing', target };
}

export function buildIndex(files) {
  const paths = files.map(f => f.path);
  const docs = files.map(file => ({ ...parseDocument(file.content, file.path), sha: file.sha }));
  for (const doc of docs) {
    doc.links = linksIn(doc.body).map(link => ({ ...link, ...resolveLink(link.target, doc.path, paths, link.wiki) }));
    doc.backlinks = [];
    if (doc.meta.id && docs.filter(d => d.meta.id === doc.meta.id).length > 1) doc.errors.push(`ID duplicado: ${doc.meta.id}`);
    for (const id of Array.isArray(doc.meta.pillars) ? doc.meta.pillars : []) {
      if (!docs.some(d => d.meta.id === id && d.meta.type === 'pilar')) doc.errors.push(`Pilar não encontrado: ${id}`);
    }
  }
  for (const source of docs) for (const link of source.links.filter(l => l.kind === 'internal')) {
    const target = docs.find(d => d.path === link.path);
    if (target && !target.backlinks.includes(source.path)) target.backlinks.push(source.path);
  }
  return docs;
}

export function reviewIndex(docs) {
  return docs.flatMap(doc => [
    ...doc.errors.map(message => ({ path: doc.path, severity: 'erro', message })),
    ...doc.links.filter(l => ['missing', 'ambiguous', 'blocked'].includes(l.kind)).map(l => ({ path: doc.path, severity: 'aviso', message: `Vínculo ${l.kind}: ${l.target}` })),
    ...(!doc.meta.status ? [{ path: doc.path, severity: 'aviso', message: 'Sem classificação editorial; não presumir cânone.' }] : [])
  ]);
}
