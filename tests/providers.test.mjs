import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LocalProvider, GitHubProvider, validPath } from '../server/providers.mjs';

test('path validation rejects traversal, drive names, reserved names and encoding', () => {
  for (const value of ['../secret.md', '/secret.md', 'C:/secret.md', 'a\\b.md', 'a/../../b.md', '.git/config.md', 'a//b.md', 'CON.md', 'a./b.md', '%2e%2e/b.md', 'a.exe', 'a.md\0']) assert.throws(() => validPath(value), /inválido/);
  assert.equal(validPath('geografia/ação.md'), 'geografia/ação.md');
});
test('local provider saves unicode, creates folders and rejects stale or concurrent saves', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'worldbuilding-test-')); t.after(async () => { assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir())); assert.ok(path.basename(root).startsWith('worldbuilding-test-')); await rm(root, { recursive: true, force: true }); });
  const provider = new LocalProvider(root);
  const first = await provider.save('pasta/ação.md', '# Olá', null);
  assert.equal((await provider.read(first.path)).content, '# Olá'); assert.deepEqual(await provider.list(), [first.path]);
  await assert.rejects(provider.save(first.path, 'overwrite', null), error => error.status === 409);
  const updates = await Promise.allSettled([provider.save(first.path, '# A', first.sha), provider.save(first.path, '# B', first.sha)]);
  assert.equal(updates.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(updates.filter(r => r.status === 'rejected')[0].reason.status, 409);
  assert.equal(await readFile(path.join(root, first.path), 'utf8'), '# A');
});
test('GitHub adapter contains token server-side and restricts branch and paths', async () => {
  assert.throws(() => new GitHubProvider({ repository: 'owner/repo', branch: 'main', root: 'world', token: 'fake' }));
  const calls = [];
  const provider = new GitHubProvider({ repository: 'owner/repo', branch: 'codex/worldbuilding-test', root: 'world', token: 'test-secret', fetcher: async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => options.method === 'PUT' ? { content: { sha: 'next' } } : { type: 'file', encoding: 'base64', size: 5, sha: 'old', content: Buffer.from('Olá').toString('base64') } };
  } });
  assert.equal((await provider.read('nota.md')).content, 'Olá');
  const result = await provider.save('nota.md', 'Novo', 'old');
  assert.equal(result.sha, 'next'); assert.ok(!JSON.stringify(result).includes('test-secret'));
  const write = calls[1]; assert.equal(write.options.headers.Authorization, 'Bearer test-secret');
  const body = JSON.parse(write.options.body); assert.equal(body.sha, 'old'); assert.equal(body.branch, 'codex/worldbuilding-test');
  assert.equal(write.url, 'https://api.github.com/repos/owner/repo/contents/world/nota.md');
  await assert.rejects(provider.read('../secret.md'));
});
test('GitHub rejects truncated trees, conflicts and rate limits without echoing secrets', async () => {
  const config = { repository: 'o/r', branch: 'codex/worldbuilding-test', root: 'world', token: 'test-secret' };
  const truncated = new GitHubProvider({ ...config, fetcher: async () => ({ ok: true, json: async () => ({ truncated: true }) }) });
  await assert.rejects(truncated.list(), e => e.status === 413);
  for (const status of [409, 422, 403, 404]) {
    const provider = new GitHubProvider({ ...config, fetcher: async () => ({ ok: false, status }) });
    await assert.rejects(provider.save('a.md', 'A', 'old'), e => e.status === status && !e.message.includes('test-secret'));
  }
});
