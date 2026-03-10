const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const SQLiteStorage = require('../src/storage/sqlite');
const { buildRouter } = require('../src/router');

describe('Full Auth Flow Integration', () => {
  let server;
  let baseUrl;

  before(async () => {
    const storage = new SQLiteStorage();
    const db = storage.initDb(':memory:');
    const config = {
      rpId: 'localhost',
      rpName: 'Test',
      origin: 'http://localhost:3000',
    };

    const app = express();
    app.use(buildRouter(config, storage, db));
    server = app.listen(0);
    baseUrl = `http://localhost:${server.address().port}`;
  });

  after(() => {
    server.close();
  });

  test('Registration options returns challenge and options', async () => {
    const userId = 'test-user-' + Date.now();

    const res = await fetch(`${baseUrl}/register/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userName: `${userId}@example.com` }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(data.challengeId, 'should have challengeId');
    assert(data.options, 'should have options');
    assert(data.options.challenge, 'options should include challenge');
    assert.strictEqual(data.options.rp.id, 'localhost');
  });

  test('Registration options rejects missing fields', async () => {
    const res = await fetch(`${baseUrl}/register/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'test' }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'INVALID_REQUEST');
  });

  test('Auth options returns NO_CREDENTIALS for unregistered user', async () => {
    const userId = 'no-creds-' + Date.now();

    const res = await fetch(`${baseUrl}/auth/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.error, 'NO_CREDENTIALS');
  });

  test('Auth options rejects missing userId', async () => {
    const res = await fetch(`${baseUrl}/auth/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'INVALID_REQUEST');
  });

  test('Register verify rejects invalid challenge', async () => {
    const res = await fetch(`${baseUrl}/register/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: 'nonexistent-challenge',
        userId: 'test-user',
        credential: {},
      }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'CHALLENGE_EXPIRED');
  });

  test('Auth verify rejects invalid challenge', async () => {
    const res = await fetch(`${baseUrl}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: 'nonexistent-challenge',
        userId: 'test-user',
        credential: { id: 'fake-cred' },
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.verified, false);
    assert.strictEqual(data.error, 'CHALLENGE_EXPIRED');
  });

  test('Auth verify rejects missing fields', async () => {
    const res = await fetch(`${baseUrl}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'test' }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.verified, false);
    assert.strictEqual(data.error, 'INVALID_REQUEST');
  });

  test('Register verify rejects wrong challenge type', async () => {
    const userId = 'type-mismatch-' + Date.now();

    // Get an auth challenge (type: 'authentication')
    // First we need credentials, so use register flow to get a registration challenge
    const regRes = await fetch(`${baseUrl}/register/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userName: `${userId}@test.com` }),
    });
    const regData = await regRes.json();

    // Try to use registration challengeId for auth verify — wrong type
    const res = await fetch(`${baseUrl}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: regData.challengeId,
        userId,
        credential: { id: 'fake' },
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.verified, false);
    assert.strictEqual(data.error, 'INVALID_REQUEST');
  });

  test('Register verify rejects wrong userId', async () => {
    const userId = 'wrong-user-' + Date.now();

    const regRes = await fetch(`${baseUrl}/register/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userName: `${userId}@test.com` }),
    });
    const regData = await regRes.json();

    // Try to verify with a different userId
    const res = await fetch(`${baseUrl}/register/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId: regData.challengeId,
        userId: 'wrong-user',
        credential: {},
      }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'INVALID_REQUEST');
  });

  test('Credential list requires authorization', async () => {
    const res = await fetch(`${baseUrl}/credentials/test-user`);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.error, 'UNAUTHORIZED');
  });

  test('Credential list returns empty array for new user', async () => {
    const userId = 'empty-creds-' + Date.now();
    const res = await fetch(`${baseUrl}/credentials/${userId}`, {
      headers: { Authorization: 'Bearer test-token' },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(Array.isArray(data));
    assert.strictEqual(data.length, 0);
  });

  test('Credential revoke requires authorization', async () => {
    const res = await fetch(`${baseUrl}/credentials/fake-cred-id`, {
      method: 'DELETE',
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.error, 'UNAUTHORIZED');
  });

  test('Credential revoke returns 404 for nonexistent credential', async () => {
    const res = await fetch(`${baseUrl}/credentials/nonexistent`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer test-token' },
    });
    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.strictEqual(data.error, 'CREDENTIAL_NOT_FOUND');
  });

  test('SDK endpoint serves JavaScript', async () => {
    const res = await fetch(`${baseUrl}/sdk.js`);
    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get('content-type');
    assert(contentType.includes('javascript'), 'should serve as JavaScript');
    const body = await res.text();
    assert(body.includes('startRegistration'), 'should contain SDK code');
  });

  test('Challenge is consumed after use (no replay)', async () => {
    const userId = 'replay-test-' + Date.now();

    const regRes = await fetch(`${baseUrl}/register/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userName: `${userId}@test.com` }),
    });
    const { challengeId } = await regRes.json();

    // First attempt — challenge exists, will fail on verification but consume challenge
    await fetch(`${baseUrl}/register/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, userId, credential: {} }),
    });

    // Second attempt — challenge already deleted
    const res = await fetch(`${baseUrl}/register/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, userId, credential: {} }),
    });
    const data = await res.json();
    assert.strictEqual(data.error, 'CHALLENGE_EXPIRED', 'replayed challenge should be rejected');
  });

  test('Rate limiting is enforced on auth/options', async () => {
    const userId = 'ratelimit-' + Date.now();
    let blockedCount = 0;

    // Rate limit is 10 /auth/options per min per userId
    for (let i = 0; i < 12; i++) {
      const res = await fetch(`${baseUrl}/auth/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.status === 429) blockedCount++;
    }

    assert(blockedCount >= 1, 'should block at least one request after limit');
  });
});
