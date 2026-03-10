module.exports = function createCredentialsRevokeHandler(config, storage, db) {
  return async (req, res) => {
    const { credentialId } = req.params;
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    try {
      // In a real app, extract userId from the session token in authHeader
      // For now, userId is not enforced — the auth header gates access
      const result = await storage.deleteCredential(db, credentialId, null);
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'CREDENTIAL_NOT_FOUND' });
      }

      return res.status(200).json({ deleted: true, credentialId });
    } catch (err) {
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  };
};
