const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const SQLiteStorage = require('../src/storage/sqlite');
const { buildRouter } = require('../src/router');

describe('Endpoints', () => {
  let server;
  let baseUrl;
  let storage;
  let db;
  const config = {
    rpId: 'localhost',
    rpName: 'Test',
    origin: 'http://localhost:3000',
  };

  before(() => {
    storage = new SQLiteStorage();
    db = storage.initDb(':memory:');

    const app = express();
    app.use(buildRouter(config, storage, db));

    server = app.listen(0); // random port
    baseUrl = `http://localhost:${server.address().port}`;
  });

  after(() => {
    server.close();
  });

  describe('POST /register/options', () => {
    test('rejects missing userId', async () => {
      const res = await fetch(`${baseUrl}/register/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: 'test@example.com' }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'INVALID_REQUEST');
    });

    test('rejects missing userName', async () => {
      const res = await fetch(`${baseUrl}/register/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'user1' }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'INVALID_REQUEST');
    });

    test('returns challengeId and options', async () => {
      const res = await fetch(`${baseUrl}/register/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'user1', userName: 'test@example.com' }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert(data.challengeId);
      assert(data.options);
      assert(data.options.challenge);
    });
  });

  describe('POST /register/verify', () => {
    test('rejects missing fields', async () => {
      const res = await fetch(`${baseUrl}/register/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: 'abc' }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'INVALID_REQUEST');
    });

    test('returns CHALLENGE_EXPIRED for nonexistent challenge', async () => {
      const res = await fetch(`${baseUrl}/register/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: 'nonexistent',
          userId: 'user1',
          credential: { id: 'test', response: {} },
        }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.registered, false);
      assert.strictEqual(data.error, 'CHALLENGE_EXPIRED');
    });
  });

  describe('POST /auth/options', () => {
    test('rejects missing userId', async () => {
      const res = await fetch(`${baseUrl}/auth/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'INVALID_REQUEST');
    });

    test('returns 200 with NO_CREDENTIALS if user has no passkeys', async () => {
      const res = await fetch(`${baseUrl}/auth/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'newuser' }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.error, 'NO_CREDENTIALS');
    });

    test('returns options if user has credentials', async () => {
      // Seed a credential
      await storage.saveCredential(db, {
        credentialId: 'cred-endpoint-test',
        userId: 'user-with-cred',
        publicKey: 'base64url-public-key',
        signCount: 0,
        transports: JSON.stringify(['internal']),
        name: 'Test Credential',
      });

      const res = await fetch(`${baseUrl}/auth/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'user-with-cred' }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert(data.challengeId);
      assert(data.options);
      assert(data.options.allowCredentials);
    });
  });

  describe('POST /auth/verify', () => {
    test('returns 200 with verified:false if fields missing', async () => {
      const res = await fetch(`${baseUrl}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.verified, false);
      assert.strictEqual(data.error, 'INVALID_REQUEST');
    });

    test('returns 200 with verified:false if challenge not found', async () => {
      const res = await fetch(`${baseUrl}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: 'nonexistent',
          userId: 'user1',
          credential: { id: 'test' },
        }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.verified, false);
      assert.strictEqual(data.error, 'CHALLENGE_EXPIRED');
    });

    test('never returns 401 or 403', async () => {
      const res = await fetch(`${baseUrl}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: 'bad',
          userId: 'bad',
          credential: { id: 'bad' },
        }),
      });
      assert.notStrictEqual(res.status, 401);
      assert.notStrictEqual(res.status, 403);
      assert.strictEqual(res.status, 200);
    });
  });

  describe('GET /credentials/:userId', () => {
    test('returns 401 if no auth header', async () => {
      const res = await fetch(`${baseUrl}/credentials/user1`);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error, 'UNAUTHORIZED');
    });

    test('returns credentials list if authorized', async () => {
      const res = await fetch(`${baseUrl}/credentials/user-with-cred`, {
        headers: { Authorization: 'Bearer test-token' },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert(Array.isArray(data));
      assert(data.length > 0);
      assert.strictEqual(data[0].credentialId, 'cred-endpoint-test');
      assert.strictEqual(data[0].userId, 'user-with-cred');
      assert(Array.isArray(data[0].transports));
    });

    test('returns empty array for user with no credentials', async () => {
      const res = await fetch(`${baseUrl}/credentials/no-such-user`, {
        headers: { Authorization: 'Bearer test-token' },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert(Array.isArray(data));
      assert.strictEqual(data.length, 0);
    });
  });

  describe('DELETE /credentials/:credentialId', () => {
    test('returns 401 if no auth header', async () => {
      const res = await fetch(`${baseUrl}/credentials/cred-123`, {
        method: 'DELETE',
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error, 'UNAUTHORIZED');
    });

    test('returns 404 if credential not found', async () => {
      const res = await fetch(`${baseUrl}/credentials/nonexistent-cred`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-token' },
      });
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.error, 'CREDENTIAL_NOT_FOUND');
    });

    test('deletes existing credential', async () => {
      // Seed a credential to delete
      await storage.saveCredential(db, {
        credentialId: 'cred-to-delete',
        userId: 'delete-user',
        publicKey: 'base64url-key',
        signCount: 0,
        transports: JSON.stringify(['internal']),
        name: 'Deletable',
      });

      const res = await fetch(`${baseUrl}/credentials/cred-to-delete`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-token' },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.deleted, true);
      assert.strictEqual(data.credentialId, 'cred-to-delete');

      // Verify it's gone
      const cred = await storage.getCredentialById(db, 'cred-to-delete', 'delete-user');
      assert.strictEqual(cred, undefined);
    });
  });

  describe('GET /sdk.js', () => {
    test('returns JavaScript content', async () => {
      const res = await fetch(`${baseUrl}/sdk.js`);
      assert.strictEqual(res.status, 200);
      assert(res.headers.get('content-type').includes('application/javascript'));
      const text = await res.text();
      assert(text.length > 0);
    });
  });
});
