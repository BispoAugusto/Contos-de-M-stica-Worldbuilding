import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDocument, resolveLink, buildIndex, reviewIndex, linksIn } from '../shared/domain.mjs';

test('missing metadata never implies canon', () => {
  const doc = parseDocument('# Nota\nTexto', 'nota.md');
  assert.equal(doc.title, 'Nota'); assert.equal(doc.meta.status, undefined); assert.deepEqual(doc.errors, []);
});
test('metadata subset preserves explicit status and detects malformed values', () => {
  assert.equal(parseDocument('---\nstatus: proposta\npillars: ["p1"]\n---\n# T').meta.pillars[0], 'p1');
  for (const text of ['---\nstatus: oficial\n---\n', '---\npillars: p1\n---\n', '---\nstatus: proposta\nstatus: canonico\n---\n', '---\ntitle: [bad]\n---\n', '---\ntitle: T', '---\n  nested: valor\n---\n']) assert.ok(parseDocument(text).errors.length, text);
});
test('relative links, aliases, unicode, anchors and ambiguous wiki basenames', () => {
  const paths = ['a/inicio.md', 'pilares/ação.md', 'a/nota.md', 'b/nota.md'];
  assert.equal(resolveLink('../pilares/a%C3%A7%C3%A3o.md#regra', 'a/inicio.md', paths).path, 'pilares/ação.md');
  assert.equal(resolveLink('#secao', 'a/inicio.md', paths).path, 'a/inicio.md');
  assert.equal(resolveLink('nota', 'raiz.md', paths, true).kind, 'ambiguous');
  assert.equal(resolveLink('javascript:alert(1)', 'a/inicio.md', paths).kind, 'blocked');
  assert.equal(resolveLink('//evil.test', 'a/inicio.md', paths).kind, 'blocked');
  assert.equal(resolveLink('%FF', 'a/inicio.md', paths).kind, 'missing');
  assert.equal(resolveLink('https://example.org', 'a/inicio.md', paths).kind, 'external');
});
test('links inside code and images do not generate relationships', () => {
  const links = linksIn('[[nota|apelido]] [P](p.md) `[[code]]`\n```\n[[ignored]]\n```\n![img](mapa.png)');
  assert.equal(links.length, 2); assert.equal(links[0].label, 'apelido');
});
test('backlinks, duplicates and pillar references derive from actual files', () => {
  const files = [{ path: 'a.md', content: '---\nid: igual\npillars: ["ausente"]\n---\n[[b]]' }, { path: 'b.md', content: '---\nid: igual\n---\n# B' }];
  const docs = buildIndex(files);
  assert.deepEqual(docs[1].backlinks, ['a.md']);
  assert.ok(docs[0].errors.some(e => e.includes('Pilar não encontrado')));
  assert.ok(docs.every(d => d.errors.some(e => e.includes('ID duplicado'))));
  assert.ok(reviewIndex(docs).some(f => f.message.includes('não presumir cânone')));
});
