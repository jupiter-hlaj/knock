const { test, describe } = require('node:test');
const assert = require('node:assert');
const rateLimit = require('../src/middleware/rate-limit');

describe('Rate Limiting', () => {
  test('allows requests under limit', () => {
    const req = { ip: '127.0.0.1', body: { userId: 'u1' } };
    const res = { status: () => ({ json: () => {} }) };
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    rateLimit(req, res, next);
    assert.strictEqual(nextCalled, true);
  });

  test('blocks requests over per-IP limit', () => {
    const ip = '192.168.1.' + Math.floor(Math.random() * 255);
    const req = { ip, body: {} };
    let blocked = false;
    const res = { status: () => ({ json: () => { blocked = true; } }) };
    const next = () => {};

    // Send 100 requests (should all pass)
    for (let i = 0; i < 100; i++) {
      rateLimit(req, res, next);
    }
    assert.strictEqual(blocked, false);

    // 101st should be blocked
    rateLimit(req, res, next);
    assert.strictEqual(blocked, true);
  });

  test('per-userId limits on /auth/options', () => {
    const userId = 'testuser-' + Math.random();
    const ip = '10.0.0.' + Math.floor(Math.random() * 255);
    const req = { ip, path: '/auth/options', body: { userId } };
    let blocked = false;
    const res = { status: () => ({ json: () => { blocked = true; } }) };
    const next = () => {};

    // First 10 should pass
    for (let i = 0; i < 10; i++) {
      rateLimit(req, res, next);
    }
    assert.strictEqual(blocked, false);

    // 11th should be blocked
    rateLimit(req, res, next);
    assert.strictEqual(blocked, true);
  });

  test('per-userId limits on /register/options', () => {
    const userId = 'reguser-' + Math.random();
    const ip = '10.1.0.' + Math.floor(Math.random() * 255);
    const req = { ip, path: '/register/options', body: { userId } };
    let blocked = false;
    const res = { status: () => ({ json: () => { blocked = true; } }) };
    const next = () => {};

    // First 5 should pass
    for (let i = 0; i < 5; i++) {
      rateLimit(req, res, next);
    }
    assert.strictEqual(blocked, false);

    // 6th should be blocked
    rateLimit(req, res, next);
    assert.strictEqual(blocked, true);
  });
});
