const { KnockError } = require('./webauthn');
const { buildRouter } = require('./router');
const SQLiteStorage = require('./storage/sqlite');
const DynamoDBStorage = require('./storage/dynamodb');

class Knock {
  constructor(config) {
    const { rpId, rpName, origin, dbPath, storageType } = config || {};

    if (!rpId || !rpName || !origin || !dbPath) {
      throw new Error('Knock config requires rpId, rpName, origin, and dbPath');
    }
    if (rpId.includes('http://') || rpId.includes('https://')) {
      throw new Error('rpId must be a bare hostname (no protocol). Got: ' + rpId);
    }
    if (!origin.startsWith('http://') && !origin.startsWith('https://')) {
      throw new Error('origin must start with http:// or https://. Got: ' + origin);
    }

    this.config = { rpId, rpName, origin, dbPath, storageType: storageType || 'sqlite' };
    this.storage = null;
    this.db = null;
  }

  router() {
    if (this.config.storageType === 'dynamodb') {
      this.storage = new DynamoDBStorage('knock-credentials', 'knock-challenges');
      this.db = null;
    } else {
      this.storage = new SQLiteStorage();
      this.db = this.storage.initDb(this.config.dbPath);
    }

    return buildRouter(this.config, this.storage, this.db);
  }
}

module.exports = { Knock, KnockError };
