# Knock — Project Context
### Passwordless Auth Library · Node.js · WebAuthn Hybrid Transport

---

## 0. How To Use This File

This is the single source of truth for building Knock. Load this file at the start of every session. No additional docs need to be pasted.

**Run a build step:**
```
/project:step-00   ← git repo + AWS OIDC role + SAM bootstrap + GitHub Actions
/project:step-01   ← scaffold, db layer, stubs + lambda.js + SAM template
/project:step-02   ← WebAuthn core (webauthn.js + KnockError)
/project:step-03   ← all four endpoint handlers
/project:step-04   ← client SDK (knock-sdk.js) + example pages
/project:step-05   ← demo polish, session, README (no deploy triggered — API was fully deployed in step 4)
```

**Rules for every session:**
- Build exactly what the step command specifies. No extra features.
- Follow the Immutable Rules in Section 8. They are non-negotiable.
- All DB operations use better-sqlite3's synchronous API. No async/await in db.js. Ever.
- When a step is complete, update the checkboxes in Section 10 of this file.
- If anything is unclear, ask before building. Do not guess at architecture.

---

## 1. Product Vision

Knock is a self-hosted Node.js library. Developers drop it into their existing Express app in an afternoon. It replaces passwords with a fingerprint scan on the user's phone.

It is not a service. There is no third party in the auth path. The developer's server is the auth server. Knock is just the code that runs on it.

**First login:** No username field. No password field. A QR code dialog appears. The user holds up their phone — camera recognizes it without pressing anything. A notification slides down the phone screen. The user presses their thumb. The desktop transitions to their dashboard. Nothing was typed. Nothing was remembered. Nothing was installed.

**Every login after:** The page loads. The phone buzzes in their pocket. They press their thumb without unlocking the phone. The desktop is already logging them in. No QR. No typing. Just a thumb.

**That is the product. Everything else is implementation detail.**

How: Knock wraps the WebAuthn Hybrid Transport protocol. The browser and OS do the heavy lifting. Knock does two things — generate a cryptographic challenge before auth, verify the signed response after. That's it.

---

## 2. What Knock Does and Does Not Do

**Knock does:**
- Generate WebAuthn registration and authentication options
- Verify WebAuthn registration and authentication responses
- Store credential public keys in SQLite (one file, zero infrastructure)
- Expose four HTTP endpoints as an Express Router
- Serve a client-side JS SDK at `GET /sdk.js`
- Return `{ verified: true, userId }` on success

**Knock does not:**
- Manage users (that's the developer's database)
- Set session cookies (that's the developer's job)
- Render any UI (that's the developer's login page)
- Send emails or SMS
- Require Redis, Postgres, Docker, or any external service
- Require an account, API key, or internet connection to a third party

---

## 3. Developer Integration (the complete picture)

**Install:**
```bash
npm install @knock-auth/server
```

**Server — 8 lines:**
```javascript
const express = require('express');
const { Knock } = require('@knock-auth/server');

const app = express();
app.use(express.json());

const knock = new Knock({
  rpId: 'acme.com',            // bare domain, no protocol
  rpName: 'Acme Corp',         // display name in OS dialog
  origin: 'https://acme.com',  // exact origin of your site
  dbPath: './knock.db',         // SQLite file, auto-created
});

app.use('/auth', knock.router());
app.listen(3000);
```

**Login page — 2 meaningful lines:**
```javascript
Knock.init({ baseUrl: '/auth' });
const result = await Knock.authenticate({ userId: 'user_8821' });
// result.verified === true → set session, redirect
// result.error === 'NO_CREDENTIALS' → send to registration
// result.error === 'USER_CANCEL' → do nothing
```

**Register page — 1 meaningful line:**
```javascript
const result = await Knock.register({ userId: 'user_8821', userName: 'jane@acme.com' });
```

That is the entire integration surface. That simplicity is the product.

---

## 4. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Language | Node.js 18+ | Widest developer reach; crypto built-in |
| Framework | Express | Universal; no opinions on the rest of the stack |
| WebAuthn server | `@simplewebauthn/server` ^13.0.0 | Battle-tested FIDO2; handles CBOR and ECDSA |
| WebAuthn client | `@simplewebauthn/browser` ^13.0.0 | Handles credentials.create/get; base64; browser quirks |
| Database | `better-sqlite3` ^9.0.0 | Zero infrastructure; synchronous API; one file |
| Test runner | Node built-in (`node:test`, `node:assert`) | No test framework dependency |

**Package:** `@knock-auth/server` · **Version:** `0.1.0` · **Main:** `src/index.js`

---

## 5. Project Structure

```
knock/
├── .github/
│   └── workflows/
│       ├── test.yml                # Run unit tests on every PR and push
│       ├── deploy.yml              # sam build + sam deploy on push to main
│       └── integration.yml         # Run full auth flow integration tests
├── src/
│   ├── index.js                    # Knock class + KnockError export (public API)
│   ├── router.js                   # Express Router — mounts all endpoints + GET /sdk.js
│   ├── storage/
│   │   ├── interface.js            # Storage abstraction (defines required methods)
│   │   ├── sqlite.js               # SQLite implementation (for local dev & small scale)
│   │   └── dynamodb.js             # DynamoDB implementation (skeleton; for production scaling)
│   ├── middleware/
│   │   └── rate-limit.js           # Rate limiting (per-IP, per-userId)
│   ├── webauthn.js                 # Wraps @simplewebauthn/server with Knock's opinions
│   ├── endpoints/
│   │   ├── register-options.js     # POST /register/options
│   │   ├── register-verify.js      # POST /register/verify
│   │   ├── auth-options.js         # POST /auth/options
│   │   ├── auth-verify.js          # POST /auth/verify
│   │   ├── credentials-list.js     # GET /credentials/:userId (list user's credentials)
│   │   └── credentials-revoke.js   # DELETE /credentials/:credentialId (revoke)
│   └── sdk/
│       └── knock-sdk.js            # Client-side vanilla JS ES module → served at GET /sdk.js
├── tests/
│   ├── storage.test.js             # Test storage interface with SQLite + DynamoDB impls
│   ├── db.test.js                  # SQLite-specific tests (integration with storage)
│   ├── webauthn.test.js            # WebAuthn verification logic
│   ├── endpoints.test.js           # Individual endpoint handlers
│   ├── rate-limit.test.js          # Rate limiter behavior
│   └── integration.test.js         # Full auth flow: register → auth → revoke
├── example/
│   ├── server.js                   # Local dev demo (localhost only)
│   └── public/
│       ├── login.html
│       ├── register.html
│       └── dashboard.html          # Protected page after auth
├── lambda.js                       # Lambda entry point — wraps Knock with serverless-express
├── template.yaml                   # SAM template — Lambda + EFS + API Gateway + CloudWatch Logs
├── samconfig.toml                  # SAM deploy config
├── package.json
├── .gitignore
├── README.md
└── ARCHITECTURE.md                 # Design decisions, constraints, scaling strategy
```

---

## 6. Database Schema

One SQLite file. Two tables. Auto-created by `initDb()` on first run.

```sql
CREATE TABLE IF NOT EXISTS credentials (
  credential_id    TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  public_key       TEXT NOT NULL,        -- base64url encoded SubjectPublicKeyInfo
  sign_count       INTEGER NOT NULL DEFAULT 0,
  transports       TEXT,                 -- JSON array string e.g. '["hybrid","internal"]'
  registered_at    INTEGER NOT NULL      -- Unix timestamp (seconds)
);

CREATE INDEX IF NOT EXISTS idx_credentials_user ON credentials(user_id);

CREATE TABLE IF NOT EXISTS challenges (
  challenge_id     TEXT PRIMARY KEY,     -- random UUID (crypto.randomUUID())
  user_id          TEXT NOT NULL,
  type             TEXT NOT NULL,        -- 'registration' or 'authentication'
  challenge        TEXT NOT NULL,        -- base64url encoded challenge bytes
  expires_at       INTEGER NOT NULL      -- Unix timestamp (seconds)
);
```

**Query functions exported from `db.js`** (all take `db` as first argument):

| Function | Returns |
|---|---|
| `saveChallenge(db, { challengeId, userId, type, challenge, expiresAt })` | void |
| `getChallenge(db, challengeId)` | row \| undefined |
| `deleteChallenge(db, challengeId)` | void |
| `deleteExpiredChallenges(db)` | void — deletes where `expires_at < Math.floor(Date.now()/1000)` |
| `saveCredential(db, { credentialId, userId, publicKey, signCount, transports })` | void |
| `getCredentialsByUser(db, userId)` | array of rows |
| `getCredentialById(db, credentialId, userId)` | row \| undefined |
| `updateSignCount(db, credentialId, newSignCount)` | void |

---

## 7. API Contract — All Four Endpoints

All endpoints are mounted by `knock.router()` under developer-chosen prefix (e.g. `/auth`).
All accept and return `application/json`.

---

### POST /register/options

**Request:**
```json
{ "userId": "user_8821", "userName": "jane@acme.com" }
```

**Response 200:**
```json
{ "challengeId": "chal_abc123", "options": { ...PublicKeyCredentialCreationOptions... } }
```

**Response 400 (missing fields):**
```json
{ "error": "INVALID_REQUEST", "message": "userId and userName are required" }
```

**Server behavior:**
1. Validate `userId` (string, required) and `userName` (string, required). Return 400 if missing.
2. Call `@simplewebauthn/server` `generateRegistrationOptions`:
   - `rpID`: `config.rpId`
   - `rpName`: `config.rpName`
   - `userID`: `Buffer.from(userId)` as Uint8Array
   - `userName`: `userName`
   - `attestationType`: `'none'`
   - `authenticatorSelection`: `{ userVerification: 'required', residentKey: 'required' }`
   - `supportedAlgorithmIDs`: `[-7]`
3. `saveChallenge(db, { challengeId: crypto.randomUUID(), userId, type: 'registration', challenge: options.challenge, expiresAt: now + 120 })`
4. Return `{ challengeId, options }`

---

### POST /register/verify

**Request:**
```json
{ "challengeId": "chal_abc123", "userId": "user_8821", "credential": { ...PublicKeyCredential... } }
```

**Response 200 (success):**
```json
{ "registered": true, "credentialId": "A4b7f9..." }
```

**Response 400 (any failure):**
```json
{ "registered": false, "error": "CHALLENGE_EXPIRED" | "VERIFICATION_FAILED" | "INVALID_REQUEST" }
```

**Server behavior:**
1. Validate all three fields present. Return 400 `INVALID_REQUEST` if any missing.
2. `deleteExpiredChallenges(db)`
3. `storedChallenge = getChallenge(db, challengeId)` — if not found: return 400 `CHALLENGE_EXPIRED`
4. If `storedChallenge.type !== 'registration'` or `storedChallenge.userId !== userId`: return 400 `INVALID_REQUEST`
5. **`deleteChallenge(db, challengeId)` ← DELETE BEFORE VERIFICATION. This is a security requirement. Do not move this line.**
6. Call `verifyRegistrationResponse({ response: credential, expectedChallenge: storedChallenge.challenge, expectedOrigin: config.origin, expectedRPID: config.rpId, requireUserVerification: true })`
7. If `!verification.verified`: return 400 `VERIFICATION_FAILED`
8. Extract from `verification.registrationInfo.credential` (**v13 API** — NOT `registrationInfo.credentialID`):
   ```javascript
   const { credential: cred } = verification.registrationInfo;
   // cred.id         → Base64URLString (credential ID, already encoded — store as-is)
   // cred.publicKey  → Uint8Array (raw public key bytes — encode to base64url for storage)
   // cred.counter    → number (sign count)
   // cred.transports → string[] (e.g. ['hybrid', 'internal'])
   ```
9. `saveCredential(db, { credentialId: cred.id, userId, publicKey: Buffer.from(cred.publicKey).toString('base64url'), signCount: cred.counter, transports: JSON.stringify(cred.transports || []) })`
10. Return `{ registered: true, credentialId: cred.id }`

---

### POST /auth/options

**Request:**
```json
{ "userId": "user_8821" }
```

**Response 200 (has credentials):**
```json
{ "challengeId": "chal_xyz789", "options": { ...PublicKeyCredentialRequestOptions... } }
```

**Response 200 (no credentials registered):**
```json
{ "error": "NO_CREDENTIALS" }
```

> Note: This is HTTP 200, not 404. `NO_CREDENTIALS` is an expected state the SDK must handle — not an error.

**Server behavior:**
1. Validate `userId` present. Return 400 `INVALID_REQUEST` if missing.
2. `credentials = getCredentialsByUser(db, userId)` — if empty: return 200 `{ error: 'NO_CREDENTIALS' }`
3. Call `generateAuthenticationOptions`:
   - `rpID`: `config.rpId`
   - `userVerification`: `'required'`
   - `timeout`: `60000`
   - `allowCredentials`: `credentials.map(c => ({ id: c.credential_id, transports: JSON.parse(c.transports || '[]') }))`
4. `saveChallenge(db, { challengeId: crypto.randomUUID(), userId, type: 'authentication', challenge: options.challenge, expiresAt: now + 60 })`
5. Return `{ challengeId, options }`

---

### POST /auth/verify

**Request:**
```json
{ "challengeId": "chal_xyz789", "userId": "user_8821", "credential": { ...PublicKeyCredential... } }
```

**Response 200 (success):**
```json
{ "verified": true, "userId": "user_8821", "credentialId": "A4b7f9..." }
```

**Response 200 (any failure):**
```json
{ "verified": false, "error": "CHALLENGE_EXPIRED" | "VERIFICATION_FAILED" | "CREDENTIAL_NOT_FOUND" | "INVALID_REQUEST" }
```

> **Auth failures always return HTTP 200.** Never return 401 or 403 from this endpoint. The HTTP request succeeded — the authentication failed. These are different things. HTTP 4xx from auth-verify causes some browsers and proxies to log, block, or retry the request incorrectly.

**Server behavior:**
1. Validate all three fields present. If missing: return 200 `{ verified: false, error: 'INVALID_REQUEST' }`
2. `deleteExpiredChallenges(db)`
3. `storedChallenge = getChallenge(db, challengeId)` — if not found: return 200 `{ verified: false, error: 'CHALLENGE_EXPIRED' }`
4. If `storedChallenge.type !== 'authentication'` or `storedChallenge.userId !== userId`: return 200 `{ verified: false, error: 'INVALID_REQUEST' }`
5. `storedCredential = getCredentialById(db, credential.id, userId)` — if not found: return 200 `{ verified: false, error: 'CREDENTIAL_NOT_FOUND' }`
6. **`deleteChallenge(db, challengeId)` ← DELETE BEFORE VERIFICATION. Security requirement.**
7. Call `verifyAuthenticationResponse({ response: credential, expectedChallenge: storedChallenge.challenge, expectedOrigin: config.origin, expectedRPID: config.rpId, requireUserVerification: true, credential: { id: storedCredential.credential_id, publicKey: Buffer.from(storedCredential.public_key, 'base64url'), counter: storedCredential.sign_count, transports: JSON.parse(storedCredential.transports || '[]') } })`
8. If `!verification.verified`: return 200 `{ verified: false, error: 'VERIFICATION_FAILED' }`
9. `updateSignCount(db, storedCredential.credential_id, verification.authenticationInfo.newCounter)`
10. Return `{ verified: true, userId, credentialId: storedCredential.credential_id }`

---

## 8. Client SDK API (`src/sdk/knock-sdk.js`)

Served by the router at `GET /sdk.js`. Vanilla JavaScript ES module. No build step. Works in Chrome 108+, Safari 16+, Edge 108+.

**File must start with:**
```javascript
import { startRegistration, startAuthentication } from
  'https://cdn.jsdelivr.net/npm/@simplewebauthn/browser@13/esm/index.js';
```

Do not bundle `@simplewebauthn/browser`. CDN import only.

**Exported API:**

```javascript
Knock.init({ baseUrl })           // stores baseUrl in module state; trims trailing slash; throws if missing
Knock.register({ userId, userName })  // → { registered: true, credentialId } or { registered: false, error }
Knock.authenticate({ userId })    // → { verified: true, userId, credentialId } or { verified: false, error }
```

**Export:**
```javascript
export default Knock;
export { Knock };  // supports both: import Knock from '...' AND import { Knock } from '...'
```

**`register()` internal flow:**
1. `_post('/register/options', { userId, userName })` — if error in response, throw `KnockError`
2. `startRegistration({ optionsJSON: response.options })` — if user cancels (browser throws), catch and return `{ registered: false, error: 'USER_CANCEL' }`
3. `_post('/register/verify', { challengeId: response.challengeId, userId, credential: attResp })`
4. Return the JSON response as-is

**`authenticate()` internal flow:**
1. `_post('/auth/options', { userId })`
2. If `data.error === 'NO_CREDENTIALS'`: return `{ verified: false, error: 'NO_CREDENTIALS' }`
3. `startAuthentication({ optionsJSON: data.options })` — if user cancels, return `{ verified: false, error: 'USER_CANCEL' }`
4. `_post('/auth/verify', { challengeId: data.challengeId, userId, credential: assnResp })`
5. Return the JSON response as-is

**`_post(path, body)` helper:**
- Fetches `${baseUrl}${path}` with method POST, Content-Type: application/json
- On network error: return `{ error: 'NETWORK_ERROR' }`
- On non-2xx: return `{ error: 'SERVER_ERROR', status: response.status }`
- Always returns parsed JSON

**Error contract:**
- `register()` and `authenticate()` never throw — always return a structured object
- Internal `KnockError` class for control flow only — not exported from this file

---

## 9. Immutable Rules

These apply to every build step. Never deviate.

### Security Rules — Non-Negotiable

1. **Challenge deletion order.** Delete the challenge from SQLite BEFORE calling `verifyRegistrationResponse` or `verifyAuthenticationResponse` — never after. This prevents replay attacks. Even if verification fails, the challenge must already be gone.

2. **`userVerification: 'required'`** is hardcoded. Not configurable. Never `'preferred'` or `'discouraged'`.

3. **`supportedAlgorithmIDs: [-7]`** — ES256 only. No RSA (algorithm ID -257) in MVP.

4. **Never log raw request bodies** from auth or registration payloads. They contain credential assertions that could be misused if logged.

5. **Auth verify always returns HTTP 200** even when authentication fails. Never 401 or 403 from the `/auth/verify` endpoint.

### Code Rules

6. **Storage is abstracted.** All DB operations go through the `StorageInterface`. SQLite and DynamoDB implementations must be interchangeable. Never call `better-sqlite3` directly from endpoints; always use the storage layer.

7. **`@simplewebauthn/server` for all WebAuthn operations.** Never implement raw CBOR parsing or ECDSA.

8. **SQLite path from config.** Always `config.dbPath`. Never hardcoded.

9. **Every verify endpoint cleans expired challenges first.** Both `register-verify.js` and `auth-verify.js` call `deleteExpiredChallenges(db)` as step one.

10. **`userId` is always provided by the developer.** Knock never generates or validates user IDs.

11. **No cookies, session state, or response headers beyond Content-Type.** Knock returns JSON and stops.

12. **Rate limiting is included in MVP** (see Rule 18). No structured logging beyond CloudWatch defaults.

13. **`KnockError` is importable from `src/index.js` as a named export.**

14. **The Knock constructor validates config synchronously.** Throws `Error` (not `KnockError`) if:
    - Any of `rpId`, `rpName`, `origin`, `dbPath` is missing
    - `rpId` contains `'http://'` or `'https://'` (must be a bare hostname)
    - `origin` does not start with `'http://'` or `'https://'`

15. **Router must parse JSON bodies.** Add `router.use(express.json())` at the top of `buildRouter()`. Do NOT rely on the developer having called `app.use(express.json())` globally. Knock's router is self-contained.

16. **SimpleWebAuthn naming collision.** Both Knock and SimpleWebAuthn export `generateRegistrationOptions` and `generateAuthenticationOptions`. Import from SimpleWebAuthn with aliases:
    ```javascript
    const {
      generateRegistrationOptions: swGenerateRegistrationOptions,
      generateAuthenticationOptions: swGenerateAuthOptions,
      verifyRegistrationResponse,
      verifyAuthenticationResponse,
    } = require('@simplewebauthn/server');
    ```

17. **Storage is pluggable.** All DB operations use the `StorageInterface`. Never call `better-sqlite3` directly from endpoints or webauthn.js. The storage layer can be swapped (SQLite ↔ DynamoDB) without changing endpoint code.

18. **Rate limiting is mandatory.** Every endpoint is protected by `src/middleware/rate-limit.js`. Limits:
    - 100 req/min per IP (global)
    - 10 `/auth/options` per min per userId (prevent challenge spam)
    - 5 `/register/options` per min per userId (prevent registration spam)
    - 20 `/auth/verify` failures per min per IP (brute force)
    Returns HTTP 429 if exceeded.

19. **Credential management endpoints exist.** In addition to the four auth endpoints:
    - `GET /credentials/:userId` — list user's registered credentials
    - `DELETE /credentials/:credentialId` — revoke a credential
    Both require authorization (app-specific; could be session token or API key).

20. **Monitoring is enabled.** SAM template has CloudWatch Logs enabled. All Lambda errors and authentication events are logged with context (userId, credentialId, error code).

### Test Rules

21. **Node built-in test runner only.** Use CommonJS `require` — the codebase has no `"type": "module"` in `package.json`, so `.js` files are CommonJS. The correct import is:
    ```javascript
    const { test, describe, mock } = require('node:test');
    const assert = require('node:assert');
    ```
    Do NOT use `import { test }` — it will throw `SyntaxError` in a CommonJS `.js` file.

22. **All tests use storage with `:memory:` backend.** Both SQLite and DynamoDB implementations must support in-memory testing. Never write to disk in tests.

23. **Tests cover storage abstraction.** Test files verify that SQLite and DynamoDB implementations both satisfy the StorageInterface contract (same operations, same results).

24. **Integration tests are in GitHub Actions.** Unit tests run on every push (`test.yml`). Integration tests (full auth flow) run before deploy (`integration.yml`). Never rely on manual smoke tests alone.

---

## 10. Storage Abstraction

The library supports pluggable storage backends. Two implementations are included.

**Why abstraction?** SQLite works great for dev/small scale. DynamoDB scales to thousands of concurrent requests. Swapping should be a config change, not a rewrite.

**Storage Interface** (`src/storage/interface.js`):
```javascript
class StorageInterface {
  // Challenges
  async saveChallenge(db, { challengeId, userId, type, challenge, expiresAt }) { }
  async getChallenge(db, challengeId) { }
  async deleteChallenge(db, challengeId) { }
  async deleteExpiredChallenges(db) { }

  // Credentials
  async saveCredential(db, { credentialId, userId, publicKey, signCount, transports }) { }
  async getCredentialsByUser(db, userId) { }
  async getCredentialById(db, credentialId, userId) { }
  async updateSignCount(db, credentialId, newSignCount) { }

  // Credential management
  async deleteCredential(db, credentialId, userId) { } // revoke
  async listCredentials(db, userId) { } // returns array with name, registeredAt, lastUsedAt
}
```

**SQLite Implementation** (`src/storage/sqlite.js`):
- Uses `better-sqlite3` (sync API)
- Stores in a single file
- Good for: local dev, demos, < 50 concurrent users
- Limit: `ReservedConcurrentExecutions: 1` on Lambda (SQLite write lock)

**DynamoDB Implementation** (`src/storage/dynamodb.js`):
- Uses AWS SDK v3
- Two tables: `knock-credentials` and `knock-challenges`
- Good for: production, scales to thousands of concurrent users
- No concurrency limit

**How to use:**
```javascript
// Local dev: use SQLite
const storage = require('./storage/sqlite');
const db = storage.initDb('./knock.db');

// Production: use DynamoDB
const storage = require('./storage/dynamodb');
const db = storage.initDynamoDB('knock-demo');
```

---

## 10.1 Rate Limiting

All endpoints are protected by rate limiting to prevent abuse.

**Middleware** (`src/middleware/rate-limit.js`):
- Per-IP limit: 100 requests/minute (all endpoints)
- Per-userId limit: 10 `/auth/options` calls/minute (prevents challenge spam)
- Per-userId limit: 5 `/register/options` calls/minute (prevents registration spam)
- Per-IP limit: 20 `/auth/verify` failures/minute (brute force protection)

Returns HTTP 429 if limit exceeded.

---

## 10.2 Credential Management Endpoints

New endpoints for managing credentials (in addition to the four auth endpoints).

### GET /credentials/:userId

**Request headers:**
```
Authorization: Bearer <sessionToken>
```
(Or: requires that caller owns the userId being queried)

**Response 200:**
```json
[
  {
    "credentialId": "A4b7f9...",
    "userId": "user_8821",
    "registeredAt": 1710000000,
    "lastUsedAt": 1710086400,
    "signCount": 42,
    "name": "iPhone Touch ID",
    "transports": ["hybrid", "internal"]
  }
]
```

**Response 401 (unauthorized):**
```json
{ "error": "UNAUTHORIZED" }
```

Server behavior:
1. Verify caller owns the userId (or is admin)
2. Return all credentials for that user
3. Include human-readable `name` and `lastUsedAt`

### DELETE /credentials/:credentialId

**Request headers:**
```
Authorization: Bearer <sessionToken>
```

**Response 200:**
```json
{ "deleted": true, "credentialId": "A4b7f9..." }
```

**Response 401:**
```json
{ "error": "UNAUTHORIZED" }
```

Server behavior:
1. Verify caller owns this credential
2. Delete the credential
3. Subsequent auth attempts with this credential return `CREDENTIAL_NOT_FOUND`

---

## 10.3 Monitoring & Observability

**CloudWatch Logs** (enabled in SAM template):
- All Lambda invocations logged
- Errors logged with stack traces
- Authentication failures logged (e.g., "VERIFICATION_FAILED" for userId X)

**Metrics to monitor** (set up in CloudWatch dashboard after deploy):
- `LambdaInvocations` / `Errors` — overall health
- `AuthVerifySuccessRate` — percentage of auth attempts that succeed
- `RegistrationCompletionRate` — % of users who complete registration after starting
- `ColdStartLatency` — time to first response after 15+ min idle
- `RateLimitExceeded429Count` — how often rate limits trigger
- `CredentialRevocationCount` — how often users revoke credentials

**Logs to watch for:**
- `VERIFICATION_FAILED` — signature didn't match (user tampered with credential or old challenge)
- `CHALLENGE_EXPIRED` — took too long to verify (> 2 min)
- `CREDENTIAL_NOT_FOUND` — user deleted their credential, then tried to use it
- `INVALID_REQUEST` — malformed request (check SDK version compatibility)

---

## 10.4 Performance & Constraints

| Metric | Value | Notes |
|---|---|---|
| **Concurrency** | ~1 user at a time* | SQLite with `ReservedConcurrentExecutions: 1` on Lambda. Use DynamoDB for higher concurrency. |
| **Cold start latency** | 2-4 seconds | First request after 15+ min idle. VPC attachment + EFS mount overhead. |
| **Warm request latency** | 100-300ms | Typical auth flow (2 HTTP round trips). |
| **Challenge lifetime** | 2 minutes (auth), 2 minutes (registration) | User must complete flow within this window. |
| **Max concurrent Lambdas** | 1 (default) | Change `ReservedConcurrentExecutions` in `template.yaml` if using DynamoDB. |
| **Database size growth** | ~500 bytes/credential, ~200 bytes/challenge | Delete expired challenges hourly; old credentials can be archived. |
| **Request body size limit** | 1MB | Express default; add validation middleware if needed. |

*With SQLite on EFS. Second concurrent request receives HTTP 429 (TooManyRequests). This is intentional — prevents SQLite write conflicts.

---

## 11. Build Sequence

Execute in order. Each step depends on the previous. Update this list when a step is complete.

- [x] **Step 0** — GitHub repo, AWS OIDC role, `template.yaml` + `samconfig.toml`, GitHub Actions workflows, SAM bootstrap deploy (`/project:step-00`)
- [x] **Step 1** — Project scaffold, storage abstraction, rate limiting middleware, `lambda.js`; commit + push (`/project:step-01`)
- [x] **Step 2** — `webauthn.js` + `KnockError`; commit + push → Actions runs tests (`/project:step-02`)
- [x] **Step 3** — All four endpoint handlers + two credential management endpoints, wired in `router.js`, endpoint tests; commit + push (`/project:step-03`)
- [ ] **Step 4** — `knock-sdk.js`, updated example HTML pages; commit + push (`/project:step-04`)
- [ ] **Step 5** — Integration tests, monitoring docs, `README.md` + `ARCHITECTURE.md`; commit + push → Actions deploys to AWS (`/project:step-05`)

---

## 11. What Is NOT in MVP

These are not in scope. Do not build them.

- Admin registration links — one-time URLs to invite a user to register
- Multiple userId lookup patterns (userId is always provided by the developer)
- Forensic failure logging — structured logs of which verification step failed and why (basic logging exists; detailed forensics don't)
- TypeScript type definitions
- Framework adapters beyond Express (Fastify, Hono, Koa)
- Multi-tenant credential namespacing
- Credential UI for users to manage their own devices (API exists, but no HTML UI)
- Advanced analytics dashboard (basic metrics can be queried from CloudWatch; custom dashboard setup is user's responsibility)
- Email notifications when credentials are added/revoked

**IN MVP (now implemented):**
- ✓ Credential revocation (`DELETE /credentials/:credentialId`)
- ✓ Credential listing (`GET /credentials/:userId`)
- ✓ Rate limiting (per-IP, per-userId)
- ✓ Brute force protection (rate limit on failed attempts)
- ✓ Monitoring & observability (CloudWatch Logs, metrics)

---

## 12. Common WebAuthn Pitfalls (Read Before Every Step)

1. **Deleting challenge after verification instead of before.** Creates a replay attack window. Delete first.

2. **Returning 401/403 from auth-verify.** Browsers and proxies react incorrectly. Always 200 with `{ verified: false }`.

3. **Returning HTTP 404 for NO_CREDENTIALS.** The SDK needs `{ error: 'NO_CREDENTIALS' }` in the JSON body to redirect the user to registration. HTTP error codes break this flow.

4. **`rpId` with protocol included.** `'acme.com'` not `'https://acme.com'`. Validate in constructor.

5. **`userID` passed as string to SimpleWebAuthn.** Must be `Buffer.from(userId)` as Uint8Array.

6. **Not storing transports.** Without them the OS can't decide push-vs-QR. Store what the browser reports.

7. **Async better-sqlite3.** It's synchronous by design. Using `await` on `.get()` returns the Promise, not the row.

8. **The QR-to-push transition is automatic.** The OS handles it. Knock calls identical code for first and subsequent logins.

---

## 13. Debugging Template

When debugging, paste only `CLAUDE.md` (already loaded) then describe the problem:

```
I am debugging an issue with Knock.

The step in the flow where it fails:
[ ] POST /register/options
[ ] POST /register/verify
[ ] POST /auth/options
[ ] POST /auth/verify
[ ] SDK (knock-sdk.js, browser console)
[ ] Demo server (startup or session)

What happened:
[paste error, stack trace, or browser console output]

Browser and device being tested:
[e.g. Chrome 122 on macOS, Android phone nearby]

Do not build anything new. Diagnose the root cause and suggest a fix.
```

---

## 14. If Claude Goes Off-Spec

```
Stop. You are building something not specified in CLAUDE.md.
Reread Section [X] and build only what was asked.
Do not add features, abstractions, or error handling for cases not described.
If something is unclear, ask before building.
```

---

## 15. Git Workflow

**Repository:** Created in Step 0 using `gh repo create`. Default branch: `main`.

**Commit rules:**
- Use `git add <specific files>` — never `git add -A` or `git add .`
- Format: `type: short description` (feat | fix | chore | docs | test)
- Push after every step and at meaningful intermediate points

**Mandatory commits:**

| When | Message |
|---|---|
| After Step 0 | `chore: SAM template, GitHub Actions, OIDC bootstrap` |
| After Step 1 | `chore: project scaffold, db layer, lambda entry point` |
| After Step 2 | `feat: WebAuthn core` |
| After Step 3 | `feat: all four endpoint handlers` |
| After Step 4 | `feat: client SDK` |
| After Step 5 | `feat: demo polish and README` |

**`.gitignore`** (created in Step 1):
```
node_modules/
*.db
*.db-shm
*.db-wal
.env
.aws-sam/
.DS_Store
npm-debug.log*
```

---

## 16. AWS Deployment (SAM + Lambda + EFS)

No servers. No nginx. No SSH. HTTPS comes free from API Gateway. The Lambda self-configures its `rpId` and `origin` from the API Gateway event — no URL configuration needed.

**Stack:**

| Component | Service | Notes |
|---|---|---|
| Compute | Lambda (Node.js 22, x86_64) | Wrapped with `@codegenie/serverless-express` |
| Storage | EFS | SQLite at `/mnt/knock/knock.db` — persists across Lambda invocations |
| API | API Gateway HTTP API | Auto-generated HTTPS URL — no custom domain needed |
| IaC | SAM (`template.yaml`) | Deployed via GitHub Actions |
| CI/CD | GitHub Actions + OIDC | No long-lived AWS keys stored as secrets |
| Concurrency | `ReservedConcurrentExecutions: 1` | Prevents SQLite write conflicts across Lambda instances |

**The URL WebAuthn uses:** `https://{id}.execute-api.{region}.amazonaws.com`
- This IS HTTPS with a valid AWS cert — WebAuthn works with it
- `rpId` = `{id}.execute-api.{region}.amazonaws.com` (hostname only)
- `origin` = `https://{id}.execute-api.{region}.amazonaws.com` (full URL)
- The Lambda reads these from `event.requestContext.domainName` — no manual config

**`lambda.js`** (Lambda entry point, project root):
```javascript
const serverlessExpress = require('@codegenie/serverless-express');
const express = require('express');
const { Knock } = require('./src/index');

let handler = null;  // cached across warm invocations

exports.handler = async (event, context) => {
  if (!handler) {
    // Self-configure from API Gateway event — no manual URL setting needed
    const domain = event.requestContext?.domainName;
    const knock = new Knock({
      rpId:   process.env.KNOCK_RP_ID   || domain,
      rpName: process.env.KNOCK_RP_NAME || 'Knock Demo',
      origin: process.env.KNOCK_ORIGIN  || `https://${domain}`,
      dbPath: process.env.KNOCK_DB_PATH || '/mnt/knock/knock.db',
    });
    const app = express();
    app.use(express.json());
    app.use('/auth', knock.router());
    app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'knock' }));
    handler = serverlessExpress({ app });
  }
  return handler(event, context);
};
```

**GitHub Actions workflows:**
- `test.yml` — runs on every push and PR: `node --test tests/`
- `deploy.yml` — runs on push to `main`: `sam build --use-container && sam deploy`

**Deploy command (also works manually):**
```bash
sam build --use-container
sam deploy
# First time: sam deploy --guided
```

**Get the deployed URL:**
```bash
aws cloudformation describe-stacks \
  --stack-name knock-demo \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text
```

---

## 17. Environment Variables

**Lambda** reads only:

| Variable | Default | Description |
|---|---|---|
| `KNOCK_RP_ID` | auto from event | Set in `template.yaml` or let Lambda self-configure |
| `KNOCK_RP_NAME` | `Knock Demo` | Display name in OS dialog |
| `KNOCK_ORIGIN` | auto from event | Set in `template.yaml` or let Lambda self-configure |
| `KNOCK_DB_PATH` | `/mnt/knock/knock.db` | Set in `template.yaml` |

**Local dev** (`example/server.js`) reads:
```javascript
const PORT        = process.env.PORT        || 3000;
const KNOCK_RP_ID    = process.env.KNOCK_RP_ID    || 'localhost';
const KNOCK_RP_NAME  = process.env.KNOCK_RP_NAME  || 'Knock Demo';
const KNOCK_ORIGIN   = process.env.KNOCK_ORIGIN   || `http://localhost:${PORT}`;
const KNOCK_DB_PATH  = process.env.KNOCK_DB_PATH  || './knock-demo.db';
```

For local dev, just run `node example/server.js` with defaults. No `.env` file needed.

---

## 18. Known Build Gotchas

| Gotcha | Symptom | Fix |
|---|---|---|
| `better-sqlite3` native module | SAM build or `npm install` fails with `node-gyp` errors | Always use `sam build --use-container` — SAM builds in Amazon Linux Docker container matching Lambda runtime |
| Node.js < 18 | `crypto.randomUUID is not a function` or `fetch is not defined` | Lambda runtime is `nodejs22.x` in SAM template — do not downgrade |
| Missing JSON body in router | `req.body` is `undefined`; all endpoints return `INVALID_REQUEST` | `router.use(express.json())` must be first line in `buildRouter()` |
| SimpleWebAuthn v13 `registrationInfo` shape | `credentialID is undefined` | Use `verification.registrationInfo.credential.id` not `.credentialID` — see Section 7 |
| SimpleWebAuthn name collision | `generateRegistrationOptions is not a function` | Import with alias — see Section 9 Rule 16 |
| SQLite file in git | DB corruption on deploy | `.gitignore` must include `*.db` and `.aws-sam/` |
| OIDC role not created | GitHub Actions fails: `Error assuming role` | Run `aws iam create-open-id-connect-provider` in Step 0 — one-time per AWS account |
| Lambda cold start on first WebAuthn test | Long pause on first request | Normal — EFS mount + SQLite init on cold start. Warm requests are fast. |
| Concurrent requests throttled | Second concurrent request returns HTTP 429 | `ReservedConcurrentExecutions: 1` is intentional — prevents SQLite write conflicts. For production traffic, replace SQLite with DynamoDB and remove this limit. |
| `test.yml` fails on step-0 push | `npm ci` error: cannot read package.json | Correct — `test.yml` has a `paths` filter; it only runs when `src/**`, `tests/**`, or `package.json` change. Step 0 push skips it intentionally. |
| HTTP instead of HTTPS | Browser blocks WebAuthn API | API Gateway always serves HTTPS — no action needed |
| `sam deploy` fails with "no deployment bucket" | Missing S3 artifact bucket | Should not happen — `samconfig.toml` has `resolve_s3 = true` which auto-creates the bucket. If it does fail, run `sam deploy --guided` once to bootstrap. |
