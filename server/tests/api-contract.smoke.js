const assert = require('node:assert/strict');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_value_with_minimum_length_1234567890';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

const app = require('../index');
const { signAuthToken } = require('../utils/token');

const PLAN_USER_IDS = {
  free: '11111111-1111-4111-8111-111111111111',
  premium: '22222222-2222-4222-8222-222222222222',
  enterprise: '33333333-3333-4333-8333-333333333333',
};

const createToken = (plan = 'free') => signAuthToken({
  id: PLAN_USER_IDS[plan] || PLAN_USER_IDS.free,
  email: `${plan}@contract.local`,
  plan,
});

const tests = [];
const register = (name, fn) => tests.push({ name, fn });

register('GET /health returns operational payload', async ({ request }) => {
  const { status, body } = await request('/health');
  assert.equal(status, 200);
  assert.equal(body.status, 'operational');
  assert.ok(typeof body.timestamp === 'string' && body.timestamp.length > 0);
});

register('GET /health/ready route exists', async ({ request }) => {
  const { status, body } = await request('/health/ready');
  assert.ok([200, 503].includes(status));
  assert.ok(['ready', 'not_ready'].includes(String(body.status)));
});

register('POST /api/auth/register validates body contract', async ({ request }) => {
  const { status, body } = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(status, 400);
  assert.equal(body?.error?.code, 'BAD_REQUEST');
});

register('POST /api/auth/login validates body contract', async ({ request }) => {
  const { status, body } = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email', password: '' }),
  });
  assert.equal(status, 400);
  assert.equal(body?.error?.code, 'BAD_REQUEST');
});

register('Unknown routes return NOT_FOUND contract', async ({ request }) => {
  const { status, body } = await request('/api/this-route-does-not-exist');
  assert.equal(status, 404);
  assert.equal(body?.error?.code, 'NOT_FOUND');
});

register('Enterprise routes reject missing bearer token', async ({ request }) => {
  const endpoints = [
    '/api/platform/summary',
    '/api/compliance/consent',
    '/api/ops/status',
  ];

  for (const endpoint of endpoints) {
    const { status, body } = await request(endpoint);
    assert.equal(status, 401, `expected 401 for ${endpoint}`);
    assert.equal(body?.error?.code, 'UNAUTHORIZED', `expected UNAUTHORIZED for ${endpoint}`);
  }
});

register('All critical protected routes exist and enforce bearer auth', async ({ request }) => {
  const endpoints = [
    '/api/biometrics/latest',
    '/api/biometrics/recent?limit=5',
    '/api/contraindications',
    '/api/wearables/connections',
    '/api/outcomes/summary',
    '/api/billing/entitlements',
    '/api/coach/sessions/11111111-1111-4111-8111-111111111111/messages',
    '/api/platform/summary',
    '/api/clinician/notes?limit=5',
    '/api/compliance/consent',
    '/api/ops/status',
  ];

  for (const endpoint of endpoints) {
    const { status, body } = await request(endpoint);
    assert.equal(status, 401, `expected 401 for ${endpoint}`);
    assert.equal(body?.error?.code, 'UNAUTHORIZED', `expected UNAUTHORIZED for ${endpoint}`);
  }
});

register('Enterprise routes enforce plan gate for free users', async ({ request }) => {
  const token = createToken('free');
  const endpoints = [
    '/api/platform/summary',
    '/api/compliance/consent',
    '/api/ops/status',
  ];

  for (const endpoint of endpoints) {
    const { status, body } = await request(endpoint, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(status, 403, `expected 403 for ${endpoint}`);
    assert.equal(body?.error?.code, 'FORBIDDEN', `expected FORBIDDEN for ${endpoint}`);
  }
});

register('Free-plan token can access non-premium critical routes', async ({ request }) => {
  const token = createToken('free');
  const endpoints = [
    '/api/biometrics/latest',
    '/api/biometrics/recent?limit=5',
    '/api/contraindications',
    '/api/wearables/connections',
    '/api/outcomes/summary',
    '/api/coach/sessions/11111111-1111-4111-8111-111111111111/messages',
  ];

  for (const endpoint of endpoints) {
    const { status } = await request(endpoint, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.notEqual(status, 404, `unexpected 404 for ${endpoint}`);
    assert.notEqual(status, 500, `unexpected 500 for ${endpoint}`);
  }
});

register('Premium token reaches enterprise handlers (not 404)', async ({ request }) => {
  const token = createToken('premium');
  const endpoints = [
    '/api/platform/summary',
    '/api/compliance/consent',
    '/api/ops/status',
  ];

  for (const endpoint of endpoints) {
    const { status, body } = await request(endpoint, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.notEqual(status, 404, `unexpected 404 for ${endpoint}`);
    if (endpoint === '/api/ops/status' && status === 200) {
      assert.ok(body?.data?.telemetry?.http, 'ops status should include telemetry.http');
      assert.ok(body?.data?.deploymentReadiness?.slo24h, 'ops status should include deploymentReadiness.slo24h');
    }
  }
});

const run = async () => {
  const server = app.listen(0);
  const address = await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('listening', () => resolve(server.address()));
  });
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const request = async (path, options = {}) => {
    const response = await fetch(`${baseUrl}${path}`, options);
    const text = await response.text();
    let body = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = {};
      }
    }
    return {
      status: response.status,
      body,
    };
  };

  let passed = 0;
  try {
    for (const { name, fn } of tests) {
      await fn({ request });
      passed += 1;
      console.log(`[contract] pass: ${name}`);
    }
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  console.log(`[contract] completed: ${passed}/${tests.length} passed`);
};

run().catch((error) => {
  console.error(`[contract] failed: ${error.message}`);
  process.exitCode = 1;
});
