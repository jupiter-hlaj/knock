const StorageInterface = require('./interface');

class DynamoDBStorage extends StorageInterface {
  constructor(credentialsTableName, challengesTableName) {
    super();
    this.credTableName = credentialsTableName;
    this.challTableName = challengesTableName;
  }

  async saveChallenge(db, { challengeId, userId, type, challenge, expiresAt }) {
    throw new Error('DynamoDB storage not yet implemented');
  }

  async getChallenge(db, challengeId) {
    throw new Error('DynamoDB storage not yet implemented');
  }

  async deleteChallenge(db, challengeId) {
    throw new Error('DynamoDB storage not yet implemented');
  }

  async deleteExpiredChallenges(db) {
    throw new Error('DynamoDB storage not yet implemented');
  }

  async saveCredential(db, { credentialId, userId, publicKey, signCount, transports, name }) {
    throw new Error('DynamoDB storage not yet implemented');
  }

  async getCredentialsByUser(db, userId) {
    throw new Error('DynamoDB storage not yet implemented');
  }

  async getCredentialById(db, credentialId, userId) {
    throw new Error('DynamoDB storage not yet implemented');
  }

  async updateSignCount(db, credentialId, newSignCount) {
    throw new Error('DynamoDB storage not yet implemented');
  }

  async deleteCredential(db, credentialId, userId) {
    throw new Error('DynamoDB storage not yet implemented');
  }

  async listCredentials(db, userId) {
    throw new Error('DynamoDB storage not yet implemented');
  }
}

module.exports = DynamoDBStorage;
