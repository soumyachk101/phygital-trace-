# Phygital-Trace

**Proof-of-Reality for Citizen Journalism**

A camera-to-blockchain verification platform that uses environmental sensor fingerprints and cryptographic signatures to prove that a photo was captured at a real time and place.

## 🌟 Features

- **Secure Enclave Signing** - Hardware-level ECDSA signatures from the device
- **Environmental Fingerprint** - GPS, accelerometer, gyroscope, barometer, light sensor
- **Blockchain Anchoring** - Hashes stored on Base L2 Ethereum
- **Public Verification** - Anyone can verify certificates without an account
- **AI Anomaly Detection** - Flags suspicious patterns like GPS teleportation or flat sensors
- **IPFS Storage** - Immutable, distributed storage of metadata

## 📁 Monorepo Structure

```
phygital-trace/
├── apps/
│   └── web/              # Next.js frontend (landing + verification)
├── packages/
│   ├── api/              # Node.js + Express backend
│   ├── contracts/        # Solidity smart contracts
│   ├── ai-service/       # Python FastAPI anomaly detection
│   └── shared/           # Shared TypeScript types
├── docs/                 # Documentation (PRD, TRD, API spec, etc.)
├── package.json          # Root monorepo config
└── docker-compose.yml    # Local dev environment
```

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** - [Download](https://nodejs.org/)
- **pnpm 9+** - `npm install -g pnpm`
- **Docker Desktop** - For PostgreSQL + Redis
- **Base Sepolia Testnet ETH** - For contract deployment (faucet from [base.org](https://base.org))

### 1. Clone & Install

```bash
# Clone repository (if not already)
# cd phygital-trace

# Install dependencies for all workspaces
pnpm install
```

### 2. Configure Environment

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your credentials:
# - DATABASE_URL (auto-set by docker-compose)
# - REDIS_URL (auto-set by docker-compose)
# - PINATA_API_KEY / PINATA_SECRET_KEY (get from pinata.cloud)
# - BASE_RPC_URL (https://sepolia.base.org)
# - PRIVATE_KEY_SIGNER (wallet private key)
# - AI_SERVICE_URL (optional, defaults to localhost:8000)
```

### 3. Start Infrastructure

```bash
# Start PostgreSQL + Redis
docker-compose up -d

# Check they&apos;re running
docker-compose ps
```

### 4. Deploy Smart Contract

```bash
# Get test ETH from faucet:
# https://sepoliafaucet.com/

# Compile contracts
pnpm --filter contracts compile

# Deploy to Base Sepolia
pnpm --filter contracts deploy:testnet

# Copy the deployed address to your .env:
# ATTESTATION_CONTRACT_ADDRESS=0x...
```

### 5. Set Up Database

```bash
# Generate Prisma client
pnpm --filter api db:generate

# Run migrations
pnpm --filter api db:migrate

# Seed sample data
pnpm --filter api db:seed
```

### 6. Start Services

Open **three terminal windows**:

**Terminal 1 - Backend API:**
```bash
pnpm dev:api
# API runs on http://localhost:3001
# Health: http://localhost:3001/health
```

**Terminal 2 - AI Service:**
```bash
pnpm dev:ai
# Python service on http://localhost:8000
# Health: http://localhost:8000/health
```

**Terminal 3 - Frontend:**
```bash
pnpm dev:web
# Web app on http://localhost:3000
```

### 7. Verify Setup

- Open http://localhost:3000 (landing page)
- Click &quot;Verify&quot; in navbar
- Try demo code: `abc12345`
- You should see a sample certificate

## 📋 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register a new device |
| GET | `/api/v1/auth/challenge?deviceId=xxx` | Get auth challenge |
| POST | `/api/v1/auth/login` | Login with signed challenge |

### Captures

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/captures` | Submit new capture (multipart) |
| GET | `/api/v1/captures` | List user&apos;s captures (auth) |
| GET | `/api/v1/captures/:id` | Get capture details (auth) |

### Verification (Public)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/verify/:shortCode` | Get verification data |
| POST | `/api/v1/verify/batch` | Batch verify multiple codes |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Basic health check |
| GET | `/health/deep` | Deep health (DB, Redis, Blockchain, IPFS) |

Full API spec: [docs/API_SPEC.md](docs/API_SPEC.md)

## 🧪 Testing

### Backend Tests
```bash
cd packages/api
pnpm test
```

### AI Service Tests
```bash
cd packages/ai-service
pytest
```

### Smart Contract Tests
```bash
cd packages/contracts
pnpm test
```

## 📱 Mobile App

The React Native mobile app is located in `apps/mobile/` (if exists). It uses:

- Expo SDK 52
- TypeScript
- NativeWind (Tailwind for RN)
- Zustand state management
- React Query for API
- React Navigation v7

## 🛠️ Development Scripts

```bash
# Run all services in parallel
pnpm dev

# Build all packages
pnpm build

# Run typecheck on all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Run database migrations
pnpm db:migrate

# Open Prisma Studio (DB viewer)
pnpm db:studio
```

## 🐳 Docker Production Build

```bash
# Build API
docker build -t phygital-api packages/api/

# Build frontend
docker build -t phygital-web apps/web/
```

## 🔧 Configuration

Environment variables: [.env.example](.env.example)

Key settings:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | JWT signing secret (min 32 chars) |
| `PINATA_API_KEY` | IPFS upload service (Pinata) |
| `BASE_RPC_URL` | Ethereum L2 RPC endpoint |
| `ATTESTATION_CONTRACT_ADDRESS` | Deployed TruthAttestation contract |
| `PRIVATE_KEY_SIGNER` | Backend wallet private key for blockchain |
| `AI_SERVICE_URL` | Python anomaly detection service |

## 📚 Documentation

See the [docs](docs/) folder:

- [PRD.md](docs/PRD.md) - Product Requirements Document
- [TRD.md](docs/TRD.md) - Technical Requirements Document
- [API_SPEC.md](docs/API_SPEC.md) - Complete API specification
- [BLOCKCHAIN.md](docs/BLOCKCHAIN.md) - Smart contract details
- [DATABASE.md](docs/DATABASE.md) - Database schema
- [BACKEND_STRUCTURE.md](docs/BACKEND_STRUCTURE.md) - Backend architecture
- [MOBILE_APP.md](docs/MOBILE_APP.md) - Mobile app technical spec
- [AI_INSTRUCTIONS.md](docs/AI_INSTRUCTIONS.md) - AI service guidelines

## 🧠 How It Works

1. **Capture** - User takes photo with Phygital-Trace mobile app
2. **Fingerprint** - App records GPS, accelerometer, gyroscope, light, barometer, network
3. **Sign** - Secure Enclave signs the hash of (image + fingerprint + timestamp)
4. **Upload** - Image + metadata sent to backend API
5. **AI Check** - Backend calls anomaly detection service
6. **IPFS** - Metadata stored on IPFS, receives CID
7. **Blockchain** - Backend anchors CID on Base L2 via smart contract
8. **Verify** - Anyone visits `/verify/:shortCode` to check authenticity

## 🎯 Verification Badges

- ✅ **VERIFIED** - On-chain attested, hashes match, no anomalies
- ⏳ **PENDING** - Awaiting blockchain confirmation
- ⚠️ **SUSPICIOUS** - Anomaly flags raised, review carefully
- 🔴 **TAMPERED** - Hashes don&apos;t match IPFS data
- 🚫 **REVOKED** - Legally revoked by owner
- ❌ **NOT FOUND** - Invalid short code

## 🤝 Contributing

This is an open-source project. Contributions welcome!

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🔒 Security

- Private keys never leave the device (Secure Enclave / TEE)
- API uses JWT authentication
- Rate limiting: 10 captures/hour/device, 100 verifies/minute/IP
- All data hashed with SHA-256
- SQL injection prevented via Prisma ORM
- HTTPS enforced in production

For security issues, please email security@phygitaltrace.app (disable on production, use security@).

---

Built with ❤️ for truth in journalism

---

## 🤝 Contributing & Collaboration

I am always open to meaningful collaborations. If you have ideas for improvements, bug fixes, or new features, feel free to:
1. **Fork** the repository.
2. **Create** a new feature branch.
3. **Submit** a pull request.

Let's build something great together!

---

