# Phygital-Trace Setup Guide

This guide walks you through setting up the complete Phygital-Trace platform locally.

## 📦 Prerequisites

- **Node.js 20+** - https://nodejs.org/
- **pnpm 9+** - `npm install -g pnpm`
- **Docker Desktop** - https://www.docker.com/products/docker-desktop/
- **Base Sepolia Testnet ETH** (for contract deployment) - https://sepoliafaucet.com/

## ⚡ Quick Start (TL;DR)

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure (PostgreSQL + Redis)
docker-compose up -d

# 3. Configure .env files
cp .env.example .env
# Edit .env with your API keys (Pinata, etc.)

# 4. Compile and deploy contract
pnpm --filter contracts compile
pnpm --filter contracts deploy:testnet
# Copy deployed address to .env: ATTESTATION_CONTRACT_ADDRESS=0x...

# 5. Set up database
pnpm --filter api db:generate
pnpm --filter api db:migrate
pnpm --filter api db:seed

# 6. Start all services (3 terminals)
# Terminal 1:
pnpm dev:api

# Terminal 2:
pnpm dev:ai

# Terminal 3:
pnpm dev:web

# Open http://localhost:3000
```

## 📖 Detailed Setup

### Step 1: Install Dependencies

From the root directory:

```bash
pnpm install
```

This installs dependencies for all workspaces (web, api, contracts, ai-service, shared).

### Step 2: Start Database & Redis

```bash
docker-compose up -d
```

Check they&apos;re running:

```bash
docker-compose ps
```

Should show:
- `phygital-postgres` (port 5432)
- `phygital-redis` (port 6379)

### Step 3: Configure Environment Variables

#### Edit root `.env`:

```bash
cp .env.example .env
```

Update these **required** variables:

```env
# Pinata (IPFS) - Get free key at https://app.pinata.cloud/
PINATA_API_KEY=your_key_here
PINATA_SECRET_KEY=your_secret_here

# Blockchain - Base Sepolia
BASE_RPC_URL=https://sepolia.base.org
PRIVATE_KEY_SIGNER=0x...  # Your wallet private key (with test ETH)

# These will be filled after contract deployment:
ATTESTATION_CONTRACT_ADDRESS=0x...
```

**Important:** Keep your `.env` file SECRET. Do not commit it.

#### For Web App (optional):

```bash
cd apps/web
cp .env.local.example .env.local
```

### Step 4: Deploy Smart Contract

#### Get Test ETH:

Visit https://sepoliafaucet.com/ and request ETH to your wallet address (the one whose private key you put in `PRIVATE_KEY_SIGNER`).

#### Compile:

```bash
pnpm --filter contracts compile
```

#### Deploy to Base Sepolia:

```bash
pnpm --filter contracts deploy:testnet
```

Output:

```
✅ TruthAttestation deployed to: 0x1234...
```

Copy that address to your root `.env`:

```env
ATTESTATION_CONTRACT_ADDRESS=0x1234...
```

### Step 5: Database Setup

```bash
# Generate Prisma client
pnpm --filter api db:generate

# Run migrations
pnpm --filter api db:migrate

# Seed sample data
pnpm --filter api db:seed
```

### Step 6: Start Development Services

Start each in separate terminals:

#### Terminal 1: Backend API

```bash
pnpm dev:api
```

Expected output:
```
🚀 Phygital-Trace API running on port 3001
✅ Blockchain initialized on network: base-sepolia
```

Test: http://localhost:3001/health/deep

#### Terminal 2: AI Anomaly Service

```bash
pnpm dev:ai
```

Test: http://localhost:8000/health

#### Terminal 3: Web Frontend

```bash
pnpm dev:web
```

Open: http://localhost:3000

## 🧪 Testing the Flow

### 1. Test API Health

```bash
curl http://localhost:3001/health/deep
```

Should return JSON with status &quot;ok&quot; for all services.

### 2. Test Mobile Simulation (Register a Device)

```bash
# Register
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "test_device_001",
    "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1SU1LfVLPHCozMxH2Mo\n4lgOEePzNm0tRgeLezV6ffAt0gunVTLw7onLRnrq0/IzW7yWR7QkrmBL7jTKEn5u\nqKhYw8fmuqGnpg+2IY8GCQQrKSzTOdH6gfa17A4NfV7g+kA8fmLDM9oAmDHYEyXy\n4ZFo9XjRgCRBJKd9hgc1M25I5yd7Fa8tqpddp3C6IXM8dx5xt3qte4+4y4H/GeCC\nTqMj2s3SqXx2euFE7zQ7KnD0pUviIWR5fEMK+JPDA2G1CJGEJtKKThiuVpGvXLC\nRzKuGjZcgs4qobLe8Gy2udF5nG+qmEA6RT2gMnoFTjMXFy4PJb9+cDfVAgMBAAEC\nQQDDy0tfC02N4BHjW4uexLfabM5UBUxUHIVK9RLDUA5+9xCFvw5owKxQm7E3kMP8\nxRP9Tp+omTKPPIsG6l3RkV4PFiES1\n-----END PUBLIC KEY-----",
    "deviceModel": "Test Device",
    "osVersion": "1.0"
  }'
```

```bash
# Get challenge
curl "http://localhost:3001/api/v1/auth/challenge?deviceId=test_device_001"

# You&apos;ll get a challenge. Skip login for now (need actual signature)
```

### 3. Test Sample Certificate

Your seeded data includes a certificate with short code `abc12345`.

Visit: http://localhost:3000/verify/abc12345

You should see:
- ✅ VERIFIED badge
- Blockchain transaction details
- Sensor data (GPS, accelerometer, etc.)
- Map with location

### 4. Test Capture Submission (Manual)

You need to craft a proper capture request with:
1. An image file (JPEG/PNG)
2. A payload JSON containing:
   - imageHash: SHA-256 of the image
   - fingerprintHash: SHA-256 of the fingerprint JSON
   - payloadHash: SHA-256(imageHash + fingerprintHash + timestamp)
   - deviceSignature: ES256 signature (hard to generate without proper keys)
   - capturedAt: ISO timestamp
   - fingerprint: PhysicalFingerprint object

For quick testing, you can modify the seeded capture directly in the DB to have a different shortCode, or use an integration test.

### 🐛 Troubleshooting

#### Database connection refused

```bash
# Ensure Docker is running
docker-compose ps
# If not:
docker-compose up -d
```

#### Blockchain errors

- Check that `ATTESTATION_CONTRACT_ADDRESS` is set in `.env`
- Verify you have Base Sepolia ETH in your signer wallet
- Check RPC is reachable: `curl $BASE_RPC_URL`

#### IPFS upload fails

- Verify Pinata keys are correct in `.env`
- Check rate limits: free Pinata tier allows 1GB/day

#### AI service not responding

- Ensure it&apos;s running on port 8000
- Check `AI_SERVICE_URL` in `.env` points to it

#### Web app can&apos;t reach API

- API must be running on port 3001
- Check `NEXT_PUBLIC_API_URL` in `apps/web/.env.local`

## 🚀 Production Deployment

### Using Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Link to existing repo
railway link

# Deploy API
railway up

# Add services (PostgreSQL, Redis) via Railway dashboard
```

### Using Docker (Manual)

```bash
# Build
docker build -t phygital-api packages/api
docker build -t phygital-web apps/web

# Run
docker run -p 3001:3001 --env-file .env phygital-api
docker run -p 3000:3000 phygital-web
```

## 🧹 Cleaning Up

```bash
# Stop Docker services
docker-compose down

# Remove volumes (WIPES DATA!)
docker-compose down -v

# Reset database
pnpm --filter api db:drop
pnpm --filter api db:migrate
pnpm --filter api db:seed
```

## 📚 Next Steps

1. Implement the React Native mobile app (see `docs/MOBILE_APP.md`)
2. Add batch attestation optimization
3. Implement S3 fallback storage
4. Add advanced ML anomaly detection
5. Set up monitoring (Sentry, LogRocket)
6. Add wallet connect (SIWE)
7. Deploy contracts to Base Mainnet

---

Need help? Open an issue or see the main [README.md](../README.md).
