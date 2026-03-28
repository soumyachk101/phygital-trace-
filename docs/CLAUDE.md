# CLAUDE.md — Phygital-Trace: Proof-of-Reality for Citizen Journalism

## Project Overview
**Phygital-Trace** is a "Camera-to-Blockchain" verification platform that cryptographically proves a photo/video was captured at a real physical location and time — not AI-generated. It uses the phone's Secure Enclave + environmental sensor fingerprints + L2 blockchain anchoring.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile App | React Native (Expo) |
| Backend API | Node.js + Express (TypeScript) |
| Database | PostgreSQL (primary) + Redis (cache/queue) |
| Blockchain | Base L2 (Ethereum) via ethers.js |
| File Storage | IPFS (via Pinata) + S3 fallback |
| Auth | JWT + Wallet-based Sign-In (SIWE) |
| AI/ML | Python FastAPI microservice |
| Queue | BullMQ (Redis-backed) |
| Deployment | Railway (backend) + Vercel (web dashboard) |

---

## Folder Structure

```
phygital-trace/
├── apps/
│   ├── mobile/          # React Native (Expo) app
│   └── web/             # Next.js dashboard (verifier portal)
├── packages/
│   ├── api/             # Node.js Express backend
│   ├── ai-service/      # Python FastAPI for ML anomaly detection
│   ├── contracts/       # Solidity smart contracts (Hardhat)
│   └── shared/          # Shared types, utils, constants
├── docs/
│   ├── PRD.md
│   ├── TRD.md
│   ├── BACKEND_STRUCTURE.md
│   ├── DATABASE.md
│   ├── BLOCKCHAIN.md
│   ├── API_SPEC.md
│   └── AI_INSTRUCTIONS.md
├── CLAUDE.md            ← you are here
├── .env.example
├── docker-compose.yml
└── package.json         # Root monorepo (pnpm workspaces)
```

---

## Claude Code Instructions

### When generating code, always:
1. Use **TypeScript** in all Node.js/React Native files
2. Use **Zod** for all input validation
3. Use **Prisma ORM** for all database queries — never raw SQL unless explicitly stated
4. Follow **RESTful conventions** for API routes
5. Add **JSDoc comments** on all exported functions
6. Handle errors with a consistent `ApiError` class (see `packages/api/src/utils/errors.ts`)
7. Write tests in **Vitest** for all service-layer functions
8. Secrets come from `process.env` — never hardcode keys

### Key Domain Concepts (always use these terms consistently):
- **Capture** — the act of taking a photo/video with proof
- **TruthCertificate** — the signed metadata bundle (sensor data + image hash + timestamp)
- **PhysicalFingerprint** — the environmental sensor snapshot (GPS, accelerometer, ambient light, radio signal strength)
- **Attestation** — the on-chain transaction that anchors the TruthCertificate
- **VerificationBadge** — the UI indicator showing verified / unverified / tampered

### Environment Variables (always reference these keys):
```env
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
PINATA_API_KEY=
PINATA_SECRET_KEY=
BASE_RPC_URL=
ATTESTATION_CONTRACT_ADDRESS=
PRIVATE_KEY_SIGNER=
AI_SERVICE_URL=
S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

---

## Monorepo Commands

```bash
# Install all deps
pnpm install

# Run all services locally
pnpm dev

# Run only API
pnpm --filter api dev

# Run only mobile
pnpm --filter mobile start

# Run AI service
cd packages/ai-service && uvicorn main:app --reload

# Database migrations
pnpm --filter api db:migrate

# Deploy contracts
pnpm --filter contracts deploy:base
```

---

## Important Implementation Notes

- The **Secure Enclave signing** on mobile uses Expo's `expo-local-authentication` + `expo-secure-store` — private key never leaves device
- The **PhysicalFingerprint** hash must be computed ON-DEVICE before upload — server only verifies, never recomputes
- Blockchain writes are **async** — use BullMQ job queue. The app shows "pending attestation" state
- IPFS CID is stored in DB AND emitted in the on-chain event for redundancy
- The AI anomaly service checks for "sensor spoofing" patterns — GPS teleportation, flat accelerometer, etc.
- All media is stored on IPFS first, THEN hash is submitted to blockchain — never upload raw media to chain
