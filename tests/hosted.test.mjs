import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createAuth } from '../server/auth.mjs';
import { createHandler } from '../server/index.mjs';
import { hostedHandler } from '../server/vercel.mjs';

const key = 'a'.repeat(64);
const config = { accessKeyHash: createHash('sha256').update(key).digest('hex'), sessionSecret: 'b'.repeat(64) };
const origin = 'https://world.example';
function fixture(time = () => 1000) {
  const files = [];
  const provider = { mode: 'github', list: async () => files.map(f => f.path), read: async path => files.find(f => f.path === path), save: async (path, content, sha) => { const result = { path, content, sha: 'new' }; files.push(result); return result; } };
  const handler = createHandler(provider, { origin, authenticate: createAuth({ ...config, now: time }) });
  const request = async (url, { method = 'GET', body, headers = {} } = {}) => {
    const req = { method, url, body, headers: { host: 'world.example', ...headers }, socket: {} };
    const res = { headers: {}, status: 200, headersSent: false, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, writeHead(status, headers = {}) { this.status = status; this.headersSent = true; for (const [k, v] of Object.entries(headers)) this.setHeader(k, v); }, end(body) { this.body = body; } };
    await handler(req, res);
    return { status: res.status, headers: res.headers, data: JSON.parse(res.body) };
  };
  return request;
}
const login = request => request('/api/login', { method: 'POST', body: { key }, headers: { origin, 'content-type': 'application/json' } });

test('hosted endpoints fail closed before authentication', async () => {
  const request = fixture();
  for (const url of ['/api/index', '/api/session', '/api/document']) {
    const response = await request(url); assert.equal(response.status, 401); assert.ok(!JSON.stringify(response.data).includes('csrf'));
  }
  assert.throws(() => hostedHandler({ WORLD_PROVIDER: 'local', APP_ORIGIN: origin }));
  assert.throws(() => createAuth({ ...config, sessionSecret: 'weak' }));
  assert.throws(() => hostedHandler({ APP_ORIGIN: 'http://world.example', WORLD_PROVIDER: 'github' }));
});
test('login requires correct origin and key; signed cookie is secure and opaque', async () => {
  const request = fixture();
  for (const suppliedOrigin of [undefined, 'https://evil.example']) assert.equal((await request('/api/login', { method: 'POST', body: { key }, headers: { origin: suppliedOrigin, 'content-type': 'application/json' } })).status, 403);
  assert.equal((await request('/api/login', { method: 'POST', body: { key: 'c'.repeat(64) }, headers: { origin, 'content-type': 'application/json' } })).status, 401);
  const response = await login(request); assert.equal(response.status, 200);
  assert.match(response.headers['set-cookie'], /HttpOnly; Secure; SameSite=Strict/);
  assert.ok(!response.headers['set-cookie'].includes(key)); assert.ok(!JSON.stringify(response.data).includes(config.sessionSecret));
});
test('session and CSRF work across serverless instances, forged and expired sessions fail', async () => {
  let now = 1000;
  const first = fixture(() => now), second = fixture(() => now);
  const cookie = (await login(first)).headers['set-cookie'].split(';')[0];
  const session = await second('/api/session', { headers: { cookie } }); assert.equal(session.status, 200);
  const response = await second('/api/document', { method: 'PUT', body: { path: 'test.md', content: '# Teste', sha: null }, headers: { origin, cookie, 'content-type': 'application/json', 'x-csrf-token': session.data.csrf } });
  assert.equal(response.status, 200);
  assert.equal((await second('/api/index', { headers: { cookie: cookie.slice(0, -1) + 'x' } })).status, 401);
  now += 8 * 3600 + 1;
  assert.equal((await second('/api/index', { headers: { cookie } })).status, 401);
});
test('CSRF is bound to session and logout expires the cookie', async () => {
  const request = fixture();
  const cookieA = (await login(request)).headers['set-cookie'].split(';')[0];
  const cookieB = (await login(request)).headers['set-cookie'].split(';')[0];
  const a = await request('/api/session', { headers: { cookie: cookieA } });
  const b = await request('/api/session', { headers: { cookie: cookieB } });
  assert.notEqual(a.data.csrf, b.data.csrf);
  assert.equal((await request('/api/logout', { method: 'POST', headers: { origin, cookie: cookieB, 'x-csrf-token': a.data.csrf } })).status, 403);
  const logout = await request('/api/logout', { method: 'POST', headers: { origin, cookie: cookieB, 'x-csrf-token': b.data.csrf } });
  assert.equal(logout.status, 200); assert.match(logout.headers['set-cookie'], /Max-Age=0/);
});
