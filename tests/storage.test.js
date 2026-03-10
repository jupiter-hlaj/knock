const { test, describe, before } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const SQLiteStorage = require('../src/storage/sqlite');

describe('Storage Interface', () => {
  describe('SQLite Implementation', () => {
    let storage;
    let db;

    before(() => {
      storage = new SQLiteStorage();
      db = storage.initDb(':memory:');
    });

    test('saveChallenge and getChallenge', async () => {
      const challengeId = crypto.randomUUID();
      await storage.saveChallenge(db, {
        challengeId,
        userId: 'test-user',
        type: 'registration',
        challenge: 'base64challenge',
        expiresAt: Math.floor(Date.now() / 1000) + 120,
      });

      const challenge = await storage.getChallenge(db, challengeId);
      assert.strictEqual(challenge.challenge_id, challengeId);
      assert.strictEqual(challenge.type, 'registration');
    });

    test('deleteChallenge removes only targeted row', async () => {
      const id1 = crypto.randomUUID();
      const id2 = crypto.randomUUID();

      await storage.saveChallenge(db, { challengeId: id1, userId: 'u1', type: 'registration', challenge: 'c1', expiresAt: Math.floor(Date.now() / 1000) + 120 });
      await storage.saveChallenge(db, { challengeId: id2, userId: 'u2', type: 'registration', challenge: 'c2', expiresAt: Math.floor(Date.now() / 1000) + 120 });

      await storage.deleteChallenge(db, id1);

      assert.strictEqual(await storage.getChallenge(db, id1), undefined);
      assert.notStrictEqual(await storage.getChallenge(db, id2), undefined);
    });

    test('saveCredential and getCredentialsByUser', async () => {
      await storage.saveCredential(db, {
        credentialId: 'cred-123',
        userId: 'user-1',
        publicKey: 'base64-encoded-public-key',
        signCount: 0,
        transports: JSON.stringify(['hybrid', 'internal']),
        name: 'iPhone Touch ID',
      });

      const creds = await storage.getCredentialsByUser(db, 'user-1');
      assert.strictEqual(creds.length, 1);
      assert.strictEqual(creds[0].credential_id, 'cred-123');
    });

    test('getCredentialById scoped to userId', async () => {
      await storage.saveCredential(db, {
        credentialId: 'cred-scoped',
        userId: 'user-owner',
        publicKey: 'pk',
        signCount: 0,
        transports: '[]',
        name: 'Scoped Key',
      });

      const found = await storage.getCredentialById(db, 'cred-scoped', 'user-owner');
      assert.strictEqual(found.credential_id, 'cred-scoped');

      const notFound = await storage.getCredentialById(db, 'cred-scoped', 'user-other');
      assert.strictEqual(notFound, undefined);
    });

    test('deleteCredential with userId check (security)', async () => {
      await storage.saveCredential(db, {
        credentialId: 'cred-456',
        userId: 'user-1',
        publicKey: 'pk',
        signCount: 0,
        transports: '[]',
        name: 'My Key',
      });

      const result = await storage.deleteCredential(db, 'cred-456', 'user-wrong');
      assert.strictEqual(result.deletedCount, 0);

      const result2 = await storage.deleteCredential(db, 'cred-456', 'user-1');
      assert.strictEqual(result2.deletedCount, 1);
    });

    test('listCredentials returns formatted credential list', async () => {
      await storage.saveCredential(db, {
        credentialId: 'cred-list-1',
        userId: 'user-list',
        publicKey: 'pk',
        signCount: 0,
        transports: JSON.stringify(['hybrid']),
        name: 'Phone',
      });

      const list = await storage.listCredentials(db, 'user-list');
      assert.strictEqual(list.length, 1);
      assert.strictEqual(list[0].credentialId, 'cred-list-1');
      assert.strictEqual(list[0].name, 'Phone');
      assert.deepStrictEqual(list[0].transports, ['hybrid']);
      assert.strictEqual(typeof list[0].registeredAt, 'number');
    });
  });
});
