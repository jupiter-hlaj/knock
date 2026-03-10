const Database = require('better-sqlite3');
const StorageInterface = require('./interface');

class SQLiteStorage extends StorageInterface {
  initDb(dbPath) {
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS challenges (
        challenge_id     TEXT PRIMARY KEY,
        user_id          TEXT NOT NULL,
        type             TEXT NOT NULL,
        challenge        TEXT NOT NULL,
        expires_at       INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS credentials (
        credential_id    TEXT PRIMARY KEY,
        user_id          TEXT NOT NULL,
        public_key       TEXT NOT NULL,
        sign_count       INTEGER NOT NULL DEFAULT 0,
        transports       TEXT,
        name             TEXT DEFAULT 'My Credential',
        registered_at    INTEGER NOT NULL,
        last_used_at     INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_credentials_user ON credentials(user_id);
    `);
    return db;
  }

  async saveChallenge(db, { challengeId, userId, type, challenge, expiresAt }) {
    return Promise.resolve(db.prepare(
      'INSERT INTO challenges (challenge_id, user_id, type, challenge, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run(challengeId, userId, type, challenge, expiresAt));
  }

  async getChallenge(db, challengeId) {
    return Promise.resolve(db.prepare('SELECT * FROM challenges WHERE challenge_id = ?').get(challengeId));
  }

  async deleteChallenge(db, challengeId) {
    return Promise.resolve(db.prepare('DELETE FROM challenges WHERE challenge_id = ?').run(challengeId));
  }

  async deleteExpiredChallenges(db) {
    const now = Math.floor(Date.now() / 1000);
    return Promise.resolve(db.prepare('DELETE FROM challenges WHERE expires_at < ?').run(now));
  }

  async saveCredential(db, { credentialId, userId, publicKey, signCount, transports, name }) {
    const registeredAt = Math.floor(Date.now() / 1000);
    return Promise.resolve(db.prepare(
      'INSERT INTO credentials (credential_id, user_id, public_key, sign_count, transports, name, registered_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(credentialId, userId, publicKey, signCount, transports, name || 'My Credential', registeredAt));
  }

  async getCredentialsByUser(db, userId) {
    return Promise.resolve(db.prepare('SELECT * FROM credentials WHERE user_id = ?').all(userId));
  }

  async getCredentialById(db, credentialId, userId) {
    return Promise.resolve(db.prepare('SELECT * FROM credentials WHERE credential_id = ? AND user_id = ?').get(credentialId, userId));
  }

  async updateSignCount(db, credentialId, newSignCount) {
    const now = Math.floor(Date.now() / 1000);
    return Promise.resolve(db.prepare('UPDATE credentials SET sign_count = ?, last_used_at = ? WHERE credential_id = ?').run(newSignCount, now, credentialId));
  }

  async deleteCredential(db, credentialId, userId) {
    let result;
    if (userId) {
      result = db.prepare('DELETE FROM credentials WHERE credential_id = ? AND user_id = ?').run(credentialId, userId);
    } else {
      result = db.prepare('DELETE FROM credentials WHERE credential_id = ?').run(credentialId);
    }
    return Promise.resolve({ deletedCount: result.changes });
  }

  async listCredentials(db, userId) {
    const creds = db.prepare('SELECT credential_id, user_id, sign_count, name, registered_at, last_used_at, transports FROM credentials WHERE user_id = ?').all(userId);
    return Promise.resolve(creds.map(c => ({
      credentialId: c.credential_id,
      userId: c.user_id,
      registeredAt: c.registered_at,
      lastUsedAt: c.last_used_at,
      signCount: c.sign_count,
      name: c.name,
      transports: JSON.parse(c.transports || '[]'),
    })));
  }
}

module.exports = SQLiteStorage;
