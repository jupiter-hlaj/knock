# Knock Architecture

## Design Decisions

### Storage Abstraction
Knock abstracts all database operations behind a `StorageInterface`. This allows the same Knock code to run with:
- **SQLite** (local dev, small scale)
- **DynamoDB** (production, high scale)
- **Custom backends** (Postgres, MongoDB, etc.) by implementing the interface

To switch from SQLite to DynamoDB:
1. Set `storageType: 'dynamodb'` when creating the Knock instance
2. Provide DynamoDB table names
3. No endpoint code changes required

### No External Services
Knock does not require:
- Redis (sessions are app-specific)
- Email service (notifications are app-specific)
- API keys or SaaS accounts

Everything happens in the Knock library and the developer's own infrastructure.

### Rate Limiting In-Memory
The rate limiting middleware uses an in-memory Map for tracking. This works fine for a single Lambda instance (due to `ReservedConcurrentExecutions: 1` with SQLite). For multi-instance deployments with DynamoDB, replace with DynamoDB-backed rate limiting.

### WebAuthn Hybrid Transport
Knock uses the Hybrid Transport protocol by default. This means:
- First login: QR code (browser shows dialog, user scans with phone)
- Subsequent logins: Push notification to phone (automatic, no QR needed)

The OS and browser handle this automatically; Knock just verifies the signatures.

## Constraints

### SQLite + Single Lambda
The current default uses SQLite + `ReservedConcurrentExecutions: 1`. This means:
- **Good for:** Demos, internal tools, small SaaS (< 100 concurrent users)
- **Not good for:** High-traffic public apps
- **Limit:** Concurrent request #2 gets HTTP 429 while request #1 is processing

If you need higher concurrency, switch to DynamoDB (no code changes required).

### Cold Start Latency (2-4 seconds)
First request after 15+ minutes idle takes 2-4 seconds due to:
- Lambda VPC attachment overhead (~200ms)
- EFS mount latency (~500ms)
- SQLite file init (~100ms)
- Node.js startup (~1-2 seconds)

Subsequent requests are fast (100-300ms).

### No Credential UI in MVP
The API supports credential listing and revocation, but the dashboard UI is minimal. A production app would:
1. Display better credential names ("iPhone 12 Pro", "YubiKey 5")
2. Show usage history (last login timestamp)
3. Allow users to rename credentials
4. Show authenticator transports (NFC, BLE, USB, etc.)

All of this is possible; the SDK just doesn't include the UI.

## Scaling Strategy

### Phase 1: Development (SQLite)
- Local dev with SQLite
- Single Lambda on AWS (MVP)
- Suitable for < 50 concurrent users
- No performance tuning needed

### Phase 2: Scaling (DynamoDB)
When you hit the SQLite limit:
```javascript
const knock = new Knock({
  // ... config
  storageType: 'dynamodb',
});
```

Then:
- Remove `ReservedConcurrentExecutions: 1` limit from SAM template
- Update rate limiting to use DynamoDB instead of in-memory Map
- Add DynamoDB tables: `knock-credentials`, `knock-challenges`
- Scale to thousands of concurrent users

### Phase 3: Global (CloudFront + Regional Lambda)
For globally distributed users:
- Add CloudFront in front of API Gateway
- Cache `/auth/sdk.js` (static, 1 hour TTL)
- Deploy Lambda to multiple regions
- Use global DynamoDB tables

## Monitoring Strategy

### CloudWatch Logs
All Lambda errors and WebAuthn events are logged to CloudWatch. Set up alerts for:
- `VERIFICATION_FAILED` (suspicious activity)
- `CHALLENGE_EXPIRED` (users timing out)
- `CREDENTIAL_NOT_FOUND` (users deleting credentials mid-login)

### Metrics
Track:
- Auth success rate (% of `/auth/verify` with `verified: true`)
- Registration completion rate (% of users completing registration)
- Rate limit triggers (how often 429 is returned)
- Cold start latency (first request after idle)

## Security Model

### Threat Model
**Attacker goal:** Impersonate a user on the web app

**What WebAuthn prevents:**
- Phishing (user signs with their phone, not a password they type)
- Credential reuse (each site gets a different key pair)
- Man-in-the-middle attacks (signatures verify server identity via rpId)

**What WebAuthn does NOT prevent:**
- Device theft (if attacker has phone + fingerprint, they can authenticate)
  - Mitigation: User revokes credential when phone is lost
- Malware on user's phone
  - Mitigation: OS biometric checks, user verification required

### Challenge Deletion Order
Knock deletes the challenge BEFORE verifying the signature. This prevents replay attacks where an attacker:
1. Captures a signed assertion from the user
2. Replays it against the server

By deleting before verification, the second replay fails (challenge doesn't exist).

### Per-User Credential Scoping
`getCredentialById` requires both the credential ID AND the user ID. This prevents an attacker from:
1. Stealing another user's credential ID from logs
2. Using it to authenticate as that user

The lookup is `credential_id AND user_id`, so the credential only authenticates its owner.

## Performance Benchmarks

Measured with SQLite on EFS, single Lambda instance:

| Operation | Latency | Notes |
|---|---|---|
| Cold start | 2-4 seconds | First request after 15 min idle |
| Warm start (register/options) | 150ms | Generate challenge + save to DB |
| Warm start (auth/verify) | 250ms | Verify signature + update sign count |
| Register + Authenticate | 400ms total | Two round trips from SDK |

With DynamoDB instead of SQLite:
- Warm latency increases to 200-400ms (network calls to DynamoDB)
- Cold start decreases to 1-2 seconds (no EFS mount)
- Scales to thousands of concurrent users

## Future Improvements

1. **Multiple Credential Names** — Let users name credentials ("iPhone 12", "Work YubiKey")
2. **Authenticator Selection** — Prefer phone BLE over hybrid, or resident keys
3. **Backup Codes** — Recovery codes if user loses phone
4. **Attestation** — Verify which authenticator was used (requires Trusted Attestation service)
5. **Passwordless+ hybrid** — Support password + passkey login during transition
