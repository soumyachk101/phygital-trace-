# BACKEND_STRUCTURE.md — Phygital-Trace API

## Complete Folder Structure

```
packages/api/
├── src/
│   ├── index.ts                     # Express app entry point
│   ├── app.ts                       # Express setup, middleware registration
│   │
│   ├── config/
│   │   ├── env.ts                   # Zod-validated env vars
│   │   ├── database.ts              # Prisma client singleton
│   │   ├── redis.ts                 # Redis client (ioredis)
│   │   └── blockchain.ts            # ethers.js provider + contract setup
│   │
│   ├── routes/
│   │   ├── index.ts                 # Router aggregator
│   │   ├── capture.routes.ts        # POST /api/v1/captures
│   │   ├── verify.routes.ts         # GET /api/v1/verify/:id
│   │   ├── user.routes.ts           # Auth + user profile
│   │   ├── admin.routes.ts          # Admin: revoke, stats
│   │   └── health.routes.ts         # GET /health, /health/deep
│   │
│   ├── controllers/
│   │   ├── capture.controller.ts
│   │   ├── verify.controller.ts
│   │   ├── user.controller.ts
│   │   └── admin.controller.ts
│   │
│   ├── services/
│   │   ├── capture.service.ts       # Core capture processing
│   │   ├── verify.service.ts        # Certificate lookup + chain check
│   │   ├── ipfs.service.ts          # Pinata upload + fetch
│   │   ├── blockchain.service.ts    # attest(), verify() on contract
│   │   ├── fingerprint.service.ts   # Hash computation + signature verify
│   │   ├── ai.service.ts            # HTTP client for Python AI service
│   │   ├── queue.service.ts         # BullMQ job producer
│   │   ├── storage.service.ts       # S3 fallback storage
│   │   └── notification.service.ts  # WebSocket push to app
│   │
│   ├── workers/
│   │   ├── attestation.worker.ts    # Consumes attestation queue
│   │   ├── ipfs-pin.worker.ts       # Retry failed IPFS pins
│   │   └── cleanup.worker.ts        # Prune old temp files
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts       # JWT verify + attach user
│   │   ├── rateLimit.middleware.ts  # Redis-backed rate limiter
│   │   ├── validate.middleware.ts   # Zod schema validation wrapper
│   │   ├── errorHandler.middleware.ts # Global error handler
│   │   └── requestLogger.middleware.ts # Winston HTTP logging
│   │
│   ├── schemas/                     # Zod schemas for all inputs/outputs
│   │   ├── capture.schema.ts
│   │   ├── verify.schema.ts
│   │   └── user.schema.ts
│   │
│   └── utils/
│       ├── errors.ts                # ApiError class + error codes
│       ├── crypto.ts                # SHA-256, signature verify helpers
│       ├── logger.ts                # Winston logger instance
│       ├── ipfsCid.ts               # CID encoding/decoding utils
│       └── pagination.ts            # Cursor-based pagination helper
│
├── prisma/
│   ├── schema.prisma                # All models (see DATABASE.md)
│   ├── migrations/                  # Auto-generated migration files
│   └── seed.ts                      # Dev seed data
│
├── test/
│   ├── unit/
│   │   ├── fingerprint.service.test.ts
│   │   ├── crypto.utils.test.ts
│   │   └── capture.service.test.ts
│   ├── integration/
│   │   ├── capture.routes.test.ts
│   │   └── verify.routes.test.ts
│   └── fixtures/
│       └── mockCapture.ts
│
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── .env.example
```

---

## Key Files — Annotated

### `src/index.ts`
```typescript
import { createApp } from './app';
import { startWorkers } from './workers';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 3001;

const app = createApp();
app.listen(PORT, () => {
  logger.info(`API running on port ${PORT}`);
  startWorkers();
});
```

### `src/services/capture.service.ts`
Core business logic:
```typescript
// Input: CaptureSubmission (from mobile app)
// Steps:
//   1. verifyDeviceSignature(payload, signature, publicKey)
//   2. verifyImageHash(file, expectedHash)
//   3. callAIService(fingerprint) → anomalyResult
//   4. uploadToIPFS(image, metadata) → ipfsCid
//   5. saveToDB(captureId, ipfsCid, status: 'pending_chain')
//   6. enqueueAttestation(captureId, payloadHash, ipfsCid)
//   7. return { captureId, ipfsCid, verificationUrl }
```

### `src/workers/attestation.worker.ts`
```typescript
// BullMQ consumer
// Input: { captureId, payloadHash, ipfsCid }
// Steps:
//   1. Call TruthAttestation.attest(payloadHash, ipfsCidBytes32)
//   2. Wait for 1 confirmation
//   3. Update DB: status='attested', txHash, blockNumber, attestedAt
//   4. Push WebSocket event to connected client
// Retry: 3 attempts, exponential backoff (2s, 4s, 8s)
```

### `src/utils/errors.ts`
```typescript
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,         // e.g. "INVALID_SIGNATURE"
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

// Error codes:
// INVALID_SIGNATURE       - 401
// SIGNATURE_MISMATCH      - 400
// IMAGE_HASH_MISMATCH     - 400
// IPFS_UPLOAD_FAILED      - 502
// ANOMALY_DETECTED        - 422
// CERTIFICATE_NOT_FOUND   - 404
// RATE_LIMIT_EXCEEDED     - 429
```

---

## Environment Config (`src/config/env.ts`)

```typescript
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  PINATA_API_KEY: z.string(),
  PINATA_SECRET_KEY: z.string(),
  BASE_RPC_URL: z.string().url(),
  ATTESTATION_CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  PRIVATE_KEY_SIGNER: z.string(),
  AI_SERVICE_URL: z.string().url(),
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(process.env);
```

---

## API Rate Limits

| Route | Limit | Window |
|-------|-------|--------|
| `POST /captures` | 10 req | per hour per device |
| `GET /verify/:id` | 100 req | per minute per IP |
| `POST /auth/login` | 5 req | per 15 min per IP |
| `GET /health` | unlimited | — |

---

## Deployment (Railway)

```yaml
# railway.toml
[build]
  builder = "NIXPACKS"
  buildCommand = "pnpm build"

[deploy]
  startCommand = "pnpm start"
  healthcheckPath = "/health"
  healthcheckTimeout = 10

[[services]]
  name = "api"

[[services]]
  name = "worker"
  startCommand = "pnpm start:worker"
```

Services to provision on Railway:
- `api` — Express server
- `worker` — BullMQ attestation worker (separate dyno)
- `postgresql` — Railway managed Postgres
- `redis` — Railway managed Redis
