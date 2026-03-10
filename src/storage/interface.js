class StorageInterface {
  // Challenges
  async saveChallenge(db, { challengeId, userId, type, challenge, expiresAt }) { }
  async getChallenge(db, challengeId) { }
  async deleteChallenge(db, challengeId) { }
  async deleteExpiredChallenges(db) { }

  // Credentials
  async saveCredential(db, { credentialId, userId, publicKey, signCount, transports, name }) { }
  async getCredentialsByUser(db, userId) { }
  async getCredentialById(db, credentialId, userId) { }
  async updateSignCount(db, credentialId, newSignCount) { }

  // Credential management
  async deleteCredential(db, credentialId, userId) { }
  async listCredentials(db, userId) { }
}

module.exports = StorageInterface;
