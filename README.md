# Knock

**Self-hosted passkey authentication for Express.** Drop Knock into your Node.js app and replace passwords with fingerprint login in an afternoon. No third party. No SaaS. Just code.

## Overview

Knock is a battle-tested WebAuthn library that wraps `@simplewebauthn/server` and manages the cryptographic ceremony your app needs to verify fingerprints. First login: user scans a QR code on their phone, presses their thumb, and they're in. Every login after: phone buzzes, thumb press, done. Nothing typed. Nothing remembered.

The protocol is [WebAuthn Hybrid Transport](https://www.w3.org/TR/webauthn-2/#enum-transport) — it works on Chrome, Safari, Edge, and Firefox. Works with Touch ID, Face ID, Windows Hello, passkeys on Android, and any FIDO2 authenticator.

## Core Workflow

1. **Registration** — User provides `userId` and `userName`. Knock generates a registration challenge. Browser/phone creates a keypair. Public key is stored in SQLite. Private key stays on device.
2. **Authentication** — User provides `userId`. Knock generates an auth challenge. Phone signs it with the private key. Knock verifies the signature. Returns `{ verified: true }` or `{ verified: false }`.
3. **Revocation** — User lost their phone? Delete the credential. Next auth attempt returns `CREDENTIAL_NOT_FOUND`.

## Technology Stack

| Component | Technology | Why |
|---|---|---|
| **Runtime** | Node.js 18+ | Widest reach; crypto built-in |
| **Framework** | Express | Universal; no opinions |
| **WebAuthn** | `@simplewebauthn/server` ^13.0.0 | Battle-tested FIDO2 |
| **Database** | `better-sqlite3` ^9.0.0 | Zero infrastructure; one file |
| **Deployment** | AWS SAM + Lambda + EFS | Serverless; HTTPS; pay for what you use |
| **CI/CD** | GitHub Actions + OIDC | No long-lived AWS keys |
| **Tests** | Node built-in (`node:test`) | No test framework dependency |

## Architecture Highlights

**Storage Abstraction** — SQLite for dev, DynamoDB for production. Swap backends with a config change; no code rewrites.

**Rate Limiting** — Per-IP and per-userId limits protect against challenge spam and brute force. Middleware on all endpoints.

**Credential Management** — Users can list their registered devices and revoke lost ones. Two endpoints: `GET /credentials/:userId` and `DELETE /credentials/:credentialId`.

**Observability** — CloudWatch Logs capture all auth failures with context (userId, credentialId, error code). Metrics track success rates, cold starts, and rate limit hits.

**Cold Start** — First request after 15+ minutes idle takes 2-4 seconds (VPC + EFS mount + SQLite init). Warm requests: 100-300ms. Documented in troubleshooting.

## Installation

```bash
npm install @knock-auth/server
```

## Quick Start

**Server** (8 lines):
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

**Login page** (2 meaningful lines):
```javascript
Knock.init({ baseUrl: '/auth' });
const result = await Knock.authenticate({ userId: 'user_8821' });
// result.verified === true → set session, redirect
// result.error === 'NO_CREDENTIALS' → send to registration
```

**Register page** (1 meaningful line):
```javascript
const result = await Knock.register({ userId: 'user_8821', userName: 'jane@acme.com' });
```

## What Knock Does (and Does Not Do)

**Does:**
- ✅ Generate and verify WebAuthn challenges
- ✅ Store credential public keys in SQLite
- ✅ Expose four HTTP endpoints as an Express Router
- ✅ Serve a client-side SDK at `GET /sdk.js`
- ✅ Rate limit all endpoints
- ✅ Let users revoke lost credentials
- ✅ Log all auth events to CloudWatch

**Does NOT:**
- ❌ Manage users (that's your database)
- ❌ Set session cookies (that's your job)
- ❌ Render any UI (that's your login page)
- ❌ Require a third party, API key, or internet connection
- ❌ Require Redis, Postgres, Docker, or external infrastructure

## Deployment (AWS SAM)

```bash
# One-time: AWS credentials + sam/docker installed
aws sts get-caller-identity
sam --version
docker --version

# Deploy
sam build --use-container
sam deploy

# Get the URL
aws cloudformation describe-stacks \
  --stack-name knock-demo \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text
```

SAM template creates:
- Lambda (Node.js 22, x86_64, 512MB)
- EFS (SQLite persistence across invocations)
- API Gateway HTTP API (auto-generated HTTPS URL)
- CloudWatch Logs (all auth events)
- VPC + subnets (required for EFS)
- IAM roles (no long-lived keys needed)

## Scaling

**Phase 1: SQLite (dev/small scale)**
- Good for: local dev, demos, < 50 concurrent users
- Concurrency: ~1 user at a time (prevent SQLite write conflicts)
- Cold start: 2-4 seconds
- Cost: pay-per-invocation (Lambda free tier)

**Phase 2: DynamoDB (production)**
- Good for: production traffic, > 100 concurrent users
- Concurrency: thousands of simultaneous requests
- Same endpoints, same logic, different storage layer
- Cost: on-demand pricing scales with traffic

Switching requires changing one config value in `Knock({ storageType: 'dynamodb' })`. All endpoint code stays the same.

## Troubleshooting

**"Cold start is slow"** — Normal. First request after idle takes 2-4s. Warm requests are 100-300ms. Not a bug; it's Lambda + EFS overhead.

**"Only 1 concurrent user"** — Correct for SQLite. If you need more, switch to DynamoDB (config only, no code changes).

**"No passkeys registered"** — User must complete registration first. Auth endpoint returns `{ error: 'NO_CREDENTIALS' }` in this case.

**"Verification failed"** — Check CloudWatch Logs under `/aws/lambda/knock-demo` for the exact error code (CHALLENGE_EXPIRED, VERIFICATION_FAILED, CREDENTIAL_NOT_FOUND).

## Browser Support

| Browser | macOS | Windows | Linux | Android |
|---|---|---|---|---|
| Chrome 108+ | ✅ Touch ID | ✅ Windows Hello | ✅ FIDO2 | ✅ Passkey |
| Safari 16+ | ✅ Face/Touch ID | — | — | ✅ Passkey |
| Edge 108+ | ✅ Touch ID | ✅ Windows Hello | ✅ FIDO2 | ✅ Passkey |
| Firefox 60+ | ✅ FIDO2 | ✅ FIDO2 | ✅ FIDO2 | ⚠️ Limited |

## Security Model

- **Challenge deletion before verification** — Prevents replay attacks. Challenge is deleted from SQLite before the cryptographic signature is verified.
- **`userVerification: 'required'`** — Hardcoded. Touch ID / Face ID / Windows Hello is always required. Never optional.
- **Per-user credential scoping** — Never returns another user's credential. Each operation scoped by userId.
- **Rate limiting** — Per-IP (100 req/min), per-userId (10 challenges/min), per-IP on failures (20 failed auths/min).
- **No logging of assertions** — Challenge and signed responses are never logged. Only error codes and userIds.

## Observability

**CloudWatch Logs** — Every Lambda invocation logged in JSON format. Auth failures include error code and userId.

**CloudWatch Metrics** — Track:
- Auth success rate
- Registration completion rate
- Rate limit triggers
- Cold start latency
- Credential revocation count

**Alerts to set up:**
- VERIFICATION_FAILED spike (suspicious activity)
- High rate limit trigger rate (attack attempt?)
- High cold start latency (performance regression)

See `ARCHITECTURE.md` for complete monitoring strategy.

## Development

```bash
# Install
npm install

# Run tests
node --test tests/

# Run local demo
node example/server.js
# Visit http://localhost:3000/auth/register.html
```

All tests use in-memory SQLite (`:memory:`). No fixtures, no cleanup needed.

## Documentation

- **CLAUDE.md** — Complete technical spec (database schema, API contracts, rules)
- **ARCHITECTURE.md** — Design decisions, constraints, scaling strategy, threat analysis

## License

MIT

---

**Questions?** Open an issue. PRs welcome.
