const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const SQLiteStorage = require('../src/storage/sqlite');

describe('SQLite Storage Integration', () => {
  let storage;
  let db;

  before(() => {
    storage = new SQLiteStorage();
    db = storage.initDb(':memory:');
  });

  test('initDb creates tables on first run', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map(t => t.name);
    assert(tableNames.includes('credentials'));
    assert(tableNames.includes('challenges'));
  });

  test('credentials table has all columns', () => {
    const columns = db.prepare("PRAGMA table_info(credentials)").all();
    const columnNames = columns.map(c => c.name);
    assert(columnNames.includes('credential_id'));
    assert(columnNames.includes('user_id'));
    assert(columnNames.includes('public_key'));
    assert(columnNames.includes('sign_count'));
    assert(columnNames.includes('transports'));
    assert(columnNames.includes('name'));
    assert(columnNames.includes('registered_at'));
    assert(columnNames.includes('last_used_at'));
  });

  test('deleteExpiredChallenges removes only expired rows', async () => {
    const now = Math.floor(Date.now() / 1000);
    const chal1 = crypto.randomUUID();
    const chal2 = crypto.randomUUID();

    await storage.saveChallenge(db, { challengeId: chal1, userId: 'u1', type: 'registration', challenge: 'c1', expiresAt: now - 100 });
    await storage.saveChallenge(db, { challengeId: chal2, userId: 'u2', type: 'registration', challenge: 'c2', expiresAt: now + 120 });

    await storage.deleteExpiredChallenges(db);

    assert.strictEqual(await storage.getChallenge(db, chal1), undefined);
    assert.notStrictEqual(await storage.getChallenge(db, chal2), undefined);
  });

  test('updateSignCount updates counter and last_used_at', async () => {
    await storage.saveCredential(db, {
      credentialId: 'cred-sig',
      userId: 'user-sig',
      publicKey: 'pk',
      signCount: 5,
      transports: '[]',
      name: 'Test',
    });

    const beforeUpdate = Math.floor(Date.now() / 1000);
    await storage.updateSignCount(db, 'cred-sig', 6);

    const cred = await storage.getCredentialById(db, 'cred-sig', 'user-sig');
    assert.strictEqual(cred.sign_count, 6);
    assert.ok(cred.last_used_at >= beforeUpdate, 'last_used_at should be set to current time');
  });
});
