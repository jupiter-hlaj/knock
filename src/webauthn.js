const crypto = require('crypto');

const {
  generateRegistrationOptions: swGenerateRegistrationOptions,
  generateAuthenticationOptions: swGenerateAuthOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

class KnockError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
    this.name = 'KnockError';
  }
}

async function generateRegistrationOptions(config, storage, db, { userId, userName }) {
  const challengeId = crypto.randomUUID();

  const options = await swGenerateRegistrationOptions({
    rpID: config.rpId,
    rpName: config.rpName,
    userID: Buffer.from(userId),
    userName: userName,
    attestationType: 'none',
    authenticatorSelection: { userVerification: 'required', residentKey: 'required' },
    supportedAlgorithmIDs: [-7],
  });

  await storage.saveChallenge(db, {
    challengeId,
    userId,
    type: 'registration',
    challenge: options.challenge,
    expiresAt: Math.floor(Date.now() / 1000) + 120,
  });

  return { challengeId, options };
}

async function verifyRegistration(config, storage, db, { challengeId, userId, credential }) {
  await storage.deleteExpiredChallenges(db);

  const storedChallenge = await storage.getChallenge(db, challengeId);
  if (!storedChallenge) throw new KnockError('CHALLENGE_EXPIRED');

  if (storedChallenge.type !== 'registration') throw new KnockError('INVALID_REQUEST');
  if (storedChallenge.user_id !== userId) throw new KnockError('INVALID_REQUEST');

  // CRITICAL: Delete BEFORE verification (Rule 1 — prevents replay attacks)
  await storage.deleteChallenge(db, challengeId);

  const verification = await verifyRegistrationResponse({
    response: credential,
    expectedChallenge: storedChallenge.challenge,
    expectedOrigin: config.origin,
    expectedRPID: config.rpId,
    requireUserVerification: true,
  });

  if (!verification.verified) throw new KnockError('VERIFICATION_FAILED');

  // v13 API: use registrationInfo.credential, not credentialID
  const { credential: cred } = verification.registrationInfo;

  await storage.saveCredential(db, {
    credentialId: cred.id,
    userId,
    publicKey: Buffer.from(cred.publicKey).toString('base64url'),
    signCount: cred.counter,
    transports: JSON.stringify(cred.transports || []),
    name: `Credential registered ${new Date().toLocaleDateString()}`,
  });

  return { registered: true, credentialId: cred.id };
}

async function generateAuthenticationOptions(config, storage, db, { userId }) {
  const credentials = await storage.getCredentialsByUser(db, userId);
  if (credentials.length === 0) throw new KnockError('NO_CREDENTIALS');

  const challengeId = crypto.randomUUID();

  const options = await swGenerateAuthOptions({
    rpID: config.rpId,
    userVerification: 'required',
    timeout: 60000,
    allowCredentials: credentials.map(c => ({
      id: c.credential_id,
      transports: JSON.parse(c.transports || '[]'),
    })),
  });

  await storage.saveChallenge(db, {
    challengeId,
    userId,
    type: 'authentication',
    challenge: options.challenge,
    expiresAt: Math.floor(Date.now() / 1000) + 60,
  });

  return { challengeId, options };
}

async function verifyAuthentication(config, storage, db, { challengeId, userId, credential }) {
  await storage.deleteExpiredChallenges(db);

  const storedChallenge = await storage.getChallenge(db, challengeId);
  if (!storedChallenge) throw new KnockError('CHALLENGE_EXPIRED');

  if (storedChallenge.type !== 'authentication') throw new KnockError('INVALID_REQUEST');
  if (storedChallenge.user_id !== userId) throw new KnockError('INVALID_REQUEST');

  const storedCredential = await storage.getCredentialById(db, credential.id, userId);
  if (!storedCredential) throw new KnockError('CREDENTIAL_NOT_FOUND');

  // CRITICAL: Delete BEFORE verification (Rule 1)
  await storage.deleteChallenge(db, challengeId);

  const verification = await verifyAuthenticationResponse({
    response: credential,
    expectedChallenge: storedChallenge.challenge,
    expectedOrigin: config.origin,
    expectedRPID: config.rpId,
    requireUserVerification: true,
    credential: {
      id: storedCredential.credential_id,
      publicKey: Buffer.from(storedCredential.public_key, 'base64url'),
      counter: storedCredential.sign_count,
      transports: JSON.parse(storedCredential.transports || '[]'),
    },
  });

  if (!verification.verified) throw new KnockError('VERIFICATION_FAILED');

  await storage.updateSignCount(db, storedCredential.credential_id, verification.authenticationInfo.newCounter);

  return { verified: true, userId, credentialId: storedCredential.credential_id };
}

module.exports = {
  KnockError,
  generateRegistrationOptions,
  verifyRegistration,
  generateAuthenticationOptions,
  verifyAuthentication,
};
