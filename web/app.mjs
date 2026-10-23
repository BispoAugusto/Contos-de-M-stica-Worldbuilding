import { TYPES, parseDocument, resolveLink } from '/shared/domain.mjs';
const $ = id => document.getElementById(id);
const state = { files: [], docs: [], findings: [], current: null, original: '', sha: null, dirty: false, busy: false, session: null };
const el = (tag, text, cls) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node; };
function message(text = '') { $('message').textContent = text; }
async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Erro ${response.status}`);
  return data;
}
function canLeave() { return !state.busy && (!state.dirty || confirm('Descartar as alterações não salvas? Baixe o rascunho antes de sair se quiser preservá-las.')); }
function view(name) {
  for (const section of document.querySelectorAll('.view')) section.hidden = section.id !== name;
  for (const button of document.querySelectorAll('[data-view]')) button.classList.toggle('active', button.dataset.view === name);
}
function setDirty(value) { state.dirty = value; $('dirty').textContent = value ? 'Rascunho não salvo' : 'Salvo'; }
function docButton(path, label) { const button = el('button', label || path); button.onclick = () => openDocument(path); return button; }
function renderFiles() {
  const query = $('search').value.toLocaleLowerCase('pt-BR'), type = $('filter').value;
  const matching = state.docs.filter(doc => (!type || doc.meta.type === type) && `${doc.path} ${doc.title} ${doc.body}`.toLocaleLowerCase('pt-BR').includes(query));
  $('files').replaceChildren();
  let folder;
  for (const doc of matching) {
    const next = doc.path.includes('/') ? doc.path.slice(0, doc.path.lastIndexOf('/')) : 'Raiz';
    if (folder !== next) { $('files').append(el('div', next, 'folder-label')); folder = next; }
    const button = docButton(doc.path, '↳  ' + doc.title); button.classList.toggle('active', state.current === doc.path); button.title = doc.path;
    $('files').append(button);
  }
  if (!matching.length) $('files').append(el('p', 'Nenhum documento encontrado.', 'empty'));
}
function inline(parent, text, source) {
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*|\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|(?<!!)\[([^\]]+)\]\(([^)\s]+)\)/g;
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    parent.append(document.createTextNode(text.slice(end, match.index)));
    if (match[1]) parent.append(el('code', match[1]));
    else if (match[2]) parent.append(el('strong', match[2]));
    else {
      const target = match[3] || match[6], label = match[4] || match[3] || match[5];
      const resolved = resolveLink(target, source, state.files.map(f => f.path), Boolean(match[3]));
      if (resolved.kind === 'internal') {
        const a = el('a', label); a.href = '#document=' + encodeURIComponent(resolved.path);
        a.onclick = event => { event.preventDefault(); if (resolved.path !== state.current) openDocument(resolved.path); if (resolved.fragment) document.getElementById('heading-' + resolved.fragment)?.scrollIntoView(); };
        parent.append(a);
      } else if (resolved.kind === 'external') { const a = el('a', label); a.href = target; a.target = '_blank'; a.rel = 'noopener noreferrer'; parent.append(a); }
      else { const span = el('span', label, 'broken'); span.title = `Vínculo ${resolved.kind}: ${target}`; parent.append(span); }
    }
    end = match.index + match[0].length;
  }
  parent.append(document.createTextNode(text.slice(end)));
}
function renderMarkdown(text, source) {
  const parent = $('reader'); parent.replaceChildren();
  const lines = parseDocument(text, source).body.split(/\r?\n/);
  let paragraph = [], code = null, fence = '', list = null;
  const flush = () => { if (paragraph.length) { const p = el('p'); inline(p, paragraph.join(' '), source); parent.append(p); paragraph = []; } list = null; };
  for (const line of lines) {
    if (/^(```|~~~)/.test(line)) {
      if (code !== null && line.startsWith(fence)) { parent.append(el('pre', code.join('\n'))); code = null; }
      else if (code === null) { flush(); code = []; fence = line.slice(0, 3); }
      else code.push(line);
      continue;
    }
    if (code !== null) { code.push(line); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { flush(); const h = el(`h${heading[1].length}`); h.id = 'heading-' + heading[2].toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-'); inline(h, heading[2], source); parent.append(h); }
    else if (/^[-*]\s+/.test(line)) { if (!list) { flush(); list = el('ul'); parent.append(list); } const item = el('li'); inline(item, line.slice(2), source); list.append(item); }
    else if (line.startsWith('> ')) { flush(); const quote = el('blockquote'); inline(quote, line.slice(2), source); parent.append(quote); }
    else if (!line.trim()) flush();
    else { if (list) list = null; paragraph.push(line); }
  }
  flush(); if (code !== null) parent.append(el('pre', code.join('\n')));
  if (!parent.childNodes.length) parent.append(el('p', 'Documento vazio. Abra Markdown para começar.', 'empty'));
}
function renderContext(doc) {
  $('metadata').replaceChildren(...[doc.meta.type || 'sem tipo', doc.meta.status || 'não classificado', doc.meta.visibility || 'visibilidade não definida'].map(value => el('span', value)));
  $('links').replaceChildren(); $('backlinks').replaceChildren();
  for (const link of doc.links || []) {
    if (link.kind === 'internal') $('links').append(docButton(link.path, '↗ ' + link.label));
    else $('links').append(el('p', `${link.label} · ${link.kind}`, 'muted'));
  }
  for (const path of doc.backlinks || []) $('backlinks').append(docButton(path, state.docs.find(d => d.path === path)?.title));
  if (!$('links').childNodes.length) $('links').append(el('p', 'Ainda sem vínculos.', 'empty'));
  if (!$('backlinks').childNodes.length) $('backlinks').append(el('p', 'Nenhuma referência recebida.', 'empty'));
  $('doc-errors').replaceChildren(...(doc.errors.length ? doc.errors : ['Nenhum erro estrutural nesta página.']).map(value => el('p', value, 'muted')));
}
function openDocument(path, force = false) {
  if (!force && !canLeave()) return;
  const file = state.files.find(f => f.path === path); if (!file) return;
  state.current = path; state.original = file.content; state.sha = file.sha;
  $('editor').value = file.content; $('path').textContent = path;
  const doc = state.docs.find(d => d.path === path);
  $('title').textContent = doc.title; $('confirm-canon').checked = false;
  setDirty(false); renderMarkdown(file.content, path); renderContext(doc); renderFiles(); view('library'); setMode(false);
}
function setMode(edit) { $('reader').hidden = edit; $('editor-label').hidden = !edit; $('read-tab').classList.toggle('selected', !edit); $('edit-tab').classList.toggle('selected', edit); if (!edit) renderMarkdown($('editor').value, state.current || ''); }
function renderGraph() {
  $('graph-canvas').replaceChildren(); $('graph-list').replaceChildren();
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 900 480'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Grafo de vínculos; navegação equivalente na lista abaixo.');
  const nodes = state.docs.slice(0, 40), points = nodes.map((_, i) => ({ x: 450 + 290 * Math.cos(2 * Math.PI * i / Math.max(1, nodes.length)), y: 240 + 165 * Math.sin(2 * Math.PI * i / Math.max(1, nodes.length)) }));
  nodes.forEach((doc, i) => doc.links.filter(l => l.kind === 'internal').forEach(link => { const j = nodes.findIndex(d => d.path === link.path); if (j < 0) return; const line = document.createElementNS(ns, 'line'); for (const [key, value] of Object.entries({ x1: points[i].x, y1: points[i].y, x2: points[j].x, y2: points[j].y })) line.setAttribute(key, value); svg.append(line); }));
  nodes.forEach((doc, i) => { const a = document.createElementNS(ns, 'a'); a.setAttribute('href', '#document=' + encodeURIComponent(doc.path)); a.onclick = event => { event.preventDefault(); openDocument(doc.path); }; const circle = document.createElementNS(ns, 'circle'); circle.setAttribute('cx', points[i].x); circle.setAttribute('cy', points[i].y); circle.setAttribute('r', 10); const label = document.createElementNS(ns, 'text'); label.setAttribute('x', points[i].x); label.setAttribute('y', points[i].y + 28); label.setAttribute('text-anchor', 'middle'); label.textContent = doc.title.slice(0, 30); a.append(circle, label); svg.append(a); });
  $('graph-canvas').append(svg);
  if (state.docs.length > 40) $('graph-canvas').append(el('p', 'Grafo visual limitado a 40 documentos; lista completa abaixo.', 'muted'));
  for (const doc of state.docs) $('graph-list').append(docButton(doc.path, `${doc.title}\n${doc.links.filter(l => l.kind === 'internal').length} vínculos · ${doc.backlinks.length} referências recebidas`));
  if (!state.docs.length) $('graph-list').append(el('p', 'Crie uma página para começar.', 'empty'));
}
async function refresh(preferred = state.current) {
  const data = await api('/api/index');
  state.files = data.files; state.docs = data.documents; state.findings = data.findings;
  $('stats').replaceChildren();
  for (const [count, label] of [[state.docs.length, 'documentos'], [state.docs.reduce((n, d) => n + d.links.filter(l => l.kind === 'internal').length, 0), 'vínculos'], [state.docs.filter(d => d.meta.type === 'pilar').length, 'pilares']]) { const node = el('div'); node.append(el('strong', String(count)), el('small', label)); $('stats').append(node); }
  renderFiles(); renderGraph(); $('findings').replaceChildren();
  for (const finding of state.findings) $('findings').append(docButton(finding.path, `${finding.severity.toUpperCase()} · ${finding.path}\n${finding.message}`));
  if (!state.findings.length) $('findings').append(el('p', 'Nenhuma pendência estrutural. Isso não confirma coerência narrativa nem aprova o cânone.', 'empty'));
  const first = state.files.find(f => f.path === preferred) || state.files[0];
  if (first) openDocument(first.path, true);
}
$('search').oninput = renderFiles; $('filter').onchange = renderFiles;
for (const type of TYPES) { const option = el('option', type); option.value = type; $('filter').append(option); }
document.querySelectorAll('[data-view]').forEach(button => button.onclick = () => view(button.dataset.view));
$('read-tab').onclick = () => setMode(false); $('edit-tab').onclick = () => setMode(true);
$('editor').oninput = () => setDirty($('editor').value !== state.original || state.sha === null);
$('refresh').onclick = async () => {
  if (!canLeave()) return;
  state.busy = true; $('editor').readOnly = true; $('refresh').disabled = true;
  try { await refresh(); message('Acervo atualizado.'); } catch (error) { message(error.message); }
  finally { state.busy = false; $('editor').readOnly = false; $('refresh').disabled = false; }
};
$('save').onclick = async () => {
  if (!state.current || state.busy) return;
  state.busy = true; $('save').disabled = true; $('editor').readOnly = true; message();
  try {
    const result = await api('/api/document', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': state.session.csrf }, body: JSON.stringify({ path: state.current, content: $('editor').value, sha: state.sha, confirmCanon: $('confirm-canon').checked }) });
    state.sha = result.sha; state.original = result.content; setDirty(false); $('confirm-canon').checked = false;
    try { await refresh(result.path); message('Documento salvo' + (state.session.mode === 'github' ? ' na branch de trabalho do GitHub.' : ' no acervo local.')); }
    catch (error) { message('Documento salvo, mas a atualização do índice falhou: ' + error.message); }
  } catch (error) { message(error.message + '\nSeu rascunho continua no editor.'); }
  finally { state.busy = false; $('save').disabled = false; $('editor').readOnly = false; }
};
$('download').onclick = () => { if (!state.current) return; const url = URL.createObjectURL(new Blob([$('editor').value], { type: 'text/markdown;charset=utf-8' })); const a = el('a'); a.href = url; a.download = state.current.split('/').pop(); a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
$('new').onclick = () => { if (canLeave()) $('create-dialog').showModal(); };
$('cancel-create').onclick = () => $('create-dialog').close();
$('create-form').onsubmit = event => {
  event.preventDefault(); const path = new FormData(event.target).get('path').trim();
  if (state.files.some(f => f.path === path)) { message('Esse arquivo já existe.'); $('create-dialog').close(); return; }
  const content = '---\ntype: nota\nstatus: proposta\nvisibility: mestre\n---\n# Nova proposta\n\n';
  state.current = path; state.original = ''; state.sha = null; $('path').textContent = path; $('title').textContent = 'Nova proposta'; $('editor').value = content; $('confirm-canon').checked = false; setDirty(true); renderContext(parseDocument(content, path)); view('library'); setMode(true); $('create-dialog').close(); message('Rascunho criado. O arquivo será gravado ao salvar.');
};
window.addEventListener('beforeunload', event => { if (state.dirty || state.busy) { event.preventDefault(); event.returnValue = ''; } });
try {
  state.session = await api('/api/session');
  $('connection').textContent = state.session.mode === 'github' ? `GitHub · ${state.session.branch}` : '● Acervo local · servidor neste computador';
  $('banner').textContent = state.session.demo ? 'MODO DE EXEMPLOS · Todo o conteúdo abaixo demonstra o aplicativo. Nenhum documento representa o cânone de Contos de Mística.' : 'ACERVO DO AUTOR · Classificação editorial explícita. Somente o autor pode aprovar fatos e pilares do mundo.';
  await refresh();
} catch (error) { message(error.message); $('banner').textContent = 'Não foi possível carregar o acervo. Verifique a configuração do servidor.'; }
