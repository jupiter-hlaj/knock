const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  generateRegistrationOptions,
  verifyRegistration,
  generateAuthenticationOptions,
  verifyAuthentication,
  KnockError,
} = require('../src/webauthn');
const SQLiteStorage = require('../src/storage/sqlite');

describe('WebAuthn', () => {
  let storage;
  let db;
  const config = {
    rpId: 'localhost',
    rpName: 'Test',
    origin: 'http://localhost:3000',
  };

  test('setup', () => {
    storage = new SQLiteStorage();
    db = storage.initDb(':memory:');
  });

  describe('generateRegistrationOptions', () => {
    test('returns challengeId and options object', async () => {
      const result = await generateRegistrationOptions(config, storage, db, {
        userId: 'user1',
        userName: 'test@example.com',
      });

      assert.strictEqual(typeof result.challengeId, 'string');
      assert.strictEqual(typeof result.options, 'object');
      assert(result.options.challenge);
    });

    test('stores challenge in DB', async () => {
      const { challengeId } = await generateRegistrationOptions(config, storage, db, {
        userId: 'user2',
        userName: 'test2@example.com',
      });

      const stored = await storage.getChallenge(db, challengeId);
      assert.strictEqual(stored.type, 'registration');
      assert.strictEqual(stored.user_id, 'user2');
    });
  });

  describe('generateAuthenticationOptions', () => {
    test('throws NO_CREDENTIALS if user has no passkeys', async () => {
      try {
        await generateAuthenticationOptions(config, storage, db, { userId: 'newuser' });
        assert.fail('Should have thrown');
      } catch (err) {
        assert.strictEqual(err.code, 'NO_CREDENTIALS');
      }
    });

    test('returns options if user has credentials', async () => {
      await storage.saveCredential(db, {
        credentialId: 'cred-123',
        userId: 'user3',
        publicKey: 'base64url-public-key',
        signCount: 0,
        transports: JSON.stringify(['internal']),
        name: 'Test Credential',
      });

      const authOptions = await generateAuthenticationOptions(config, storage, db, { userId: 'user3' });
      assert(authOptions.options);
      assert(authOptions.challengeId);
      assert.strictEqual(authOptions.options.allowCredentials.length, 1);
      assert.strictEqual(authOptions.options.allowCredentials[0].id, 'cred-123');
    });
  });

  describe('verifyRegistration', () => {
    test('throws CHALLENGE_EXPIRED if challenge not found', async () => {
      try {
        await verifyRegistration(config, storage, db, {
          challengeId: 'nonexistent',
          userId: 'user4',
          credential: {},
        });
        assert.fail('Should have thrown');
      } catch (err) {
        assert.strictEqual(err.code, 'CHALLENGE_EXPIRED');
      }
    });

    test('throws INVALID_REQUEST if challenge belongs to different user', async () => {
      const { challengeId } = await generateRegistrationOptions(config, storage, db, {
        userId: 'user5',
        userName: 'user5@example.com',
      });

      try {
        await verifyRegistration(config, storage, db, {
          challengeId,
          userId: 'user-wrong',
          credential: {},
        });
        assert.fail('Should have thrown');
      } catch (err) {
        assert.strictEqual(err.code, 'INVALID_REQUEST');
      }
    });

    test('deletes challenge before verification attempt', async () => {
      const { challengeId } = await generateRegistrationOptions(config, storage, db, {
        userId: 'user6',
        userName: 'user6@example.com',
      });

      try {
        await verifyRegistration(config, storage, db, {
          challengeId,
          userId: 'user6',
          credential: {},
        });
      } catch {
        // Verification will fail with invalid credential, that's expected
      }

      // Challenge should be deleted regardless of verification outcome
      const stored = await storage.getChallenge(db, challengeId);
      assert.strictEqual(stored, undefined);
    });
  });

  describe('verifyAuthentication', () => {
    test('throws CHALLENGE_EXPIRED if challenge not found', async () => {
      try {
        await verifyAuthentication(config, storage, db, {
          challengeId: 'nonexistent',
          userId: 'user7',
          credential: {},
        });
        assert.fail('Should have thrown');
      } catch (err) {
        assert.strictEqual(err.code, 'CHALLENGE_EXPIRED');
      }
    });

    test('throws CREDENTIAL_NOT_FOUND if credential does not exist', async () => {
      const { challengeId } = await generateAuthenticationOptions(config, storage, db, { userId: 'user3' });

      try {
        await verifyAuthentication(config, storage, db, {
          challengeId,
          userId: 'user3',
          credential: { id: 'cred-does-not-exist' },
        });
        assert.fail('Should have thrown');
      } catch (err) {
        assert.strictEqual(err.code, 'CREDENTIAL_NOT_FOUND');
      }
    });

    test('deletes challenge before verification attempt', async () => {
      const { challengeId } = await generateAuthenticationOptions(config, storage, db, { userId: 'user3' });

      try {
        await verifyAuthentication(config, storage, db, {
          challengeId,
          userId: 'user3',
          credential: { id: 'cred-123' },
        });
      } catch {
        // Verification will fail with invalid credential data, expected
      }

      // Challenge should be deleted regardless
      const stored = await storage.getChallenge(db, challengeId);
      assert.strictEqual(stored, undefined);
    });
  });

  describe('KnockError', () => {
    test('has code and name properties', () => {
      const err = new KnockError('TEST_CODE', 'test message');
      assert.strictEqual(err.code, 'TEST_CODE');
      assert.strictEqual(err.name, 'KnockError');
      assert.strictEqual(err.message, 'test message');
    });

    test('uses code as message when message not provided', () => {
      const err = new KnockError('SOME_CODE');
      assert.strictEqual(err.message, 'SOME_CODE');
    });
  });
});
