import { startRegistration, startAuthentication } from
  'https://cdn.jsdelivr.net/npm/@simplewebauthn/browser@13/esm/index.js';

let _baseUrl = null;

class KnockError extends Error {
  constructor(code) { super(code); this.code = code; }
}

async function _post(path, body) {
  try {
    const response = await fetch(`${_baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) return { error: 'SERVER_ERROR', status: response.status };
    return await response.json();
  } catch {
    return { error: 'NETWORK_ERROR' };
  }
}

const Knock = {
  init({ baseUrl } = {}) {
    if (!baseUrl) throw new Error('Knock.init() requires a baseUrl');
    _baseUrl = baseUrl.replace(/\/$/, '');
  },

  async register({ userId, userName }) {
    try {
      const optionsData = await _post('/register/options', { userId, userName });
      if (optionsData.error) throw new KnockError(optionsData.error);

      let attResp;
      try {
        attResp = await startRegistration({ optionsJSON: optionsData.options });
      } catch {
        return { registered: false, error: 'USER_CANCEL' };
      }

      return await _post('/register/verify', {
        challengeId: optionsData.challengeId,
        userId,
        credential: attResp,
      });
    } catch (err) {
      if (err instanceof KnockError) return { registered: false, error: err.code };
      return { registered: false, error: 'INTERNAL_ERROR' };
    }
  },

  async authenticate({ userId }) {
    try {
      const optionsData = await _post('/auth/options', { userId });
      if (optionsData.error === 'NO_CREDENTIALS') return { verified: false, error: 'NO_CREDENTIALS' };
      if (optionsData.error) return { verified: false, error: optionsData.error };

      let assnResp;
      try {
        assnResp = await startAuthentication({ optionsJSON: optionsData.options });
      } catch {
        return { verified: false, error: 'USER_CANCEL' };
      }

      return await _post('/auth/verify', {
        challengeId: optionsData.challengeId,
        userId,
        credential: assnResp,
      });
    } catch {
      return { verified: false, error: 'INTERNAL_ERROR' };
    }
  },
};

export default Knock;
export { Knock };
