function createCredentialsRevokeHandler(config, storage, db) {
  return async (req, res) => {
    res.status(501).json({ error: 'Not implemented' });
  };
}

module.exports = createCredentialsRevokeHandler;
