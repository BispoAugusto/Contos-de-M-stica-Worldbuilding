import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createApp } from '../server/index.mjs';
import { LocalProvider } from '../server/providers.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'worldbuilding-api-'));
  const server = createApp(new LocalProvider(root));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir())); assert.ok(path.basename(root).startsWith('worldbuilding-api-')); await rm(root, { recursive: true, force: true }); });
  const url = `http://127.0.0.1:${server.address().port}`;
  const { csrf } = await (await fetch(url + '/api/session')).json();
  const put = (body, headers = {}) => fetch(url + '/api/document', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, ...headers }, body: JSON.stringify(body) });
  return { url, root, put };
}
test('API rejects foreign origins, missing CSRF, traversal and private file reads', async t => {
  const { url, put } = await fixture(t);
  const body = { path: 'a.md', content: '# A', sha: null };
  assert.equal((await put(body, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await put(body, { 'X-CSRF-Token': '' })).status, 403);
  assert.equal((await put(body, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await put({ ...body, path: '../private.md' })).status, 400);
  for (const file of ['/.env', '/server/index.mjs', '/package.json']) assert.equal((await fetch(url + file)).status, 404);
  const wrongHostStatus = await new Promise((resolve, reject) => { const req = http.get(url + '/api/session', { headers: { Host: 'evil.example' } }, response => { response.resume(); resolve(response.statusCode); }); req.on('error', reject); });
  assert.equal(wrongHostStatus, 403);
  const response = await fetch(url); assert.equal(response.status, 200); assert.ok(response.headers.get('content-security-policy').includes("script-src 'self'"));
});
test('API roundtrip, conflict preservation, and explicit canonical confirmation', async t => {
  const { url, put } = await fixture(t);
  const content = '---\nid: teste\nstatus: proposta\n---\n# Açúcar e ação';
  const created = await put({ path: 'notas/ideia.md', content, sha: null }); assert.equal(created.status, 200);
  const saved = await created.json();
  assert.equal((await put({ path: saved.path, content: 'stale', sha: null })).status, 409);
  const canonical = content.replace('proposta', 'canonico');
  assert.equal((await put({ path: saved.path, content: canonical, sha: saved.sha })).status, 400);
  assert.equal((await put({ path: saved.path, content: canonical, sha: saved.sha, confirmCanon: true })).status, 200);
  const index = await (await fetch(url + '/api/index')).json(); assert.equal(index.documents[0].meta.status, 'canonico'); assert.equal(index.files[0].content, canonical);
  const current = index.files[0];
  assert.equal((await put({ path: current.path, content, sha: current.sha })).status, 400);
});
test('API validates duplicate IDs, pillar references, JSON input and size', async t => {
  const { url, put, root } = await fixture(t);
  await writeFile(path.join(root, 'original.md'), '---\nid: existente\n---\n# Original');
  for (const content of ['---\nid: existente\n---\n# Duplicado', '---\npillars: ["inexistente"]\n---\n# T']) assert.equal((await put({ path: 'nova.md', content, sha: null })).status, 422);
  assert.equal((await put({ path: 'nova.md', content: 'a'.repeat(256001), sha: null })).status, 400);
  assert.equal((await put(null)).status, 400);
  assert.equal((await fetch(url + '/api/document', { method: 'DELETE' })).status, 404);
});
