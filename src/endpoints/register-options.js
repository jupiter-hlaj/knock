const { generateRegistrationOptions } = require('../webauthn');

module.exports = function createRegisterOptionsHandler(config, storage, db) {
  return async (req, res) => {
    const { userId, userName } = req.body || {};
    if (!userId || !userName) {
      return res.status(400).json({ error: 'INVALID_REQUEST', message: 'userId and userName are required' });
    }
    try {
      const result = await generateRegistrationOptions(config, storage, db, { userId, userName });
      return res.status(200).json(result);
    } catch (err) {
      if (err.name === 'KnockError') return res.status(400).json({ error: err.code });
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  };
};
