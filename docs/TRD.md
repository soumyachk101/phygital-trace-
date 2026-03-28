# TRD — Phygital-Trace: Technical Requirements Document

**Version:** 1.0  
**Date:** March 2026

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        MOBILE APP (React Native)                │
│   Camera → SensorCapture → SecureEnclaveSign → LocalQueue       │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTPS (REST)
┌────────────────────▼────────────────────────────────────────────┐
│                    BACKEND API (Node.js / Express)               │
│   /capture  →  Validate  →  IPFS Upload  →  BullMQ Queue        │
│   /verify   →  DB Lookup  →  Chain Read  →  Response            │
└──────┬──────────────────────────────┬───────────────────────────┘
       │                              │
┌──────▼──────┐              ┌────────▼────────┐
│  PostgreSQL  │              │   Redis + Queue  │
│  (Prisma)   │              │   (BullMQ)       │
└─────────────┘              └────────┬─────────┘
                                      │ Worker
                              ┌───────▼────────┐
                              │ Blockchain Svc  │
                              │ (Base L2 write) │
                              └───────┬─────────┘
                                      │
                              ┌───────▼────────┐
                              │  Base L2 Chain  │
                              │  (Attestation   │
                              │   Contract)     │
                              └────────────────┘

┌─────────────────────────────┐
│   AI Service (Python/FastAPI)│
│   Anomaly Detection on      │
│   PhysicalFingerprint data  │
└─────────────────────────────┘
```

---

## 2. Mobile App — Technical Spec

### 2.1 Framework
- **React Native** with **Expo SDK 52+**
- **TypeScript** throughout

### 2.2 Key Native Modules

| Module | Purpose |
|--------|---------|
| `expo-camera` | In-app camera with precise capture timing |
| `expo-sensors` | Accelerometer, gyroscope, barometer |
| `expo-location` | GPS coordinates + accuracy + altitude |
| `expo-secure-store` | Secure Enclave key storage |
| `expo-local-authentication` | Biometric auth before signing |
| `expo-network` | Offline detection |
| `expo-file-system` | Local media cache |
| `react-native-mmkv` | Fast local storage for queue |

### 2.3 PhysicalFingerprint Capture Spec
Captured at **exact millisecond of shutter press**:

```typescript
interface PhysicalFingerprint {
  timestamp_utc: string;        // ISO 8601 with ms precision
  timestamp_unix_ms: number;    // Unix epoch ms
  
  gps: {
    latitude: number;
    longitude: number;
    altitude: number;
    accuracy: number;           // meters
    speed: number | null;
    heading: number | null;
  };
  
  accelerometer: {
    x: number; y: number; z: number;
    magnitude: number;          // computed: sqrt(x²+y²+z²)
  };
  
  gyroscope: {
    x: number; y: number; z: number;
  };
  
  light: {
    lux: number;                // ambient light sensor
  };
  
  barometer: {
    pressure_hpa: number;       // atmospheric pressure
  };
  
  network: {
    wifi_rssi: number | null;   // WiFi signal strength
    cellular_signal: number | null;
    connection_type: 'wifi' | 'cellular' | 'none';
  };
  
  device: {
    model: string;
    os_version: string;
    battery_level: number;
    is_charging: boolean;
  };
}
```

### 2.4 On-Device Signing Flow

```
1. User presses capture button
2. Camera captures image → ImageData (JPEG bytes)
3. Sensors sampled simultaneously (same event loop tick)
4. Compute: imageHash = SHA-256(ImageData)
5. Compute: fingerprintHash = SHA-256(JSON.stringify(PhysicalFingerprint))
6. Compute: payloadHash = SHA-256(imageHash + fingerprintHash + timestamp_unix_ms)
7. Secure Enclave signs payloadHash → signature (ES256 / P-256)
8. Bundle: TruthCertificate = { payloadHash, signature, publicKey, imageHash, fingerprintHash, fingerprint }
9. Store locally (MMKV queue)
10. Attempt upload → if offline, queue for later
```

### 2.5 Offline Support
- All captures stored locally with full `TruthCertificate` bundle
- BG sync triggers on network reconnect
- Local state: `pending_local` → `pending_chain` → `attested`

---

## 3. Backend API — Technical Spec

### 3.1 Stack
- **Node.js 20 LTS** + **Express 5** + **TypeScript**
- **Prisma ORM** with PostgreSQL
- **BullMQ** for async blockchain jobs
- **Redis 7** for queue + rate limiting cache
- **Zod** for all input/output validation

### 3.2 Services Architecture

```
packages/api/src/
├── routes/
│   ├── capture.routes.ts     # POST /captures
│   ├── verify.routes.ts      # GET /verify/:id
│   ├── user.routes.ts        # GET/POST /users
│   └── health.routes.ts      # GET /health
├── services/
│   ├── capture.service.ts    # Core capture logic
│   ├── ipfs.service.ts       # Pinata/IPFS upload
│   ├── blockchain.service.ts # ethers.js Base L2
│   ├── fingerprint.service.ts # Hash verification
│   ├── ai.service.ts         # Call AI microservice
│   └── queue.service.ts      # BullMQ jobs
├── workers/
│   └── attestation.worker.ts # Processes blockchain queue
├── middleware/
│   ├── auth.middleware.ts
│   ├── rateLimit.middleware.ts
│   └── validate.middleware.ts
└── utils/
    ├── errors.ts             # ApiError class
    ├── crypto.ts             # Hash helpers
    └── logger.ts             # Winston logger
```

### 3.3 Capture Processing Pipeline

```
POST /captures
    ↓
1. Validate request (Zod schema)
    ↓
2. Verify device signature (ES256, using publicKey from payload)
    ↓
3. Verify image hash matches uploaded file
    ↓
4. Call AI anomaly service (async, non-blocking)
    ↓
5. Upload to IPFS (image + metadata JSON)
    ↓
6. Save to PostgreSQL (status: pending_chain)
    ↓
7. Enqueue BullMQ job → attestation worker
    ↓
8. Return { captureId, ipfsCid, status: "pending_chain" }

[Background Worker]
    ↓
9. Worker picks job → calls smart contract
    ↓
10. Emit tx hash → update DB (status: attested, txHash, blockNumber)
    ↓
11. Push websocket update to app
```

---

## 4. Smart Contract — Technical Spec

### 4.1 Contract: `TruthAttestation.sol`

```solidity
// SPDX-License-Identifier: MIT
// Deployed on Base L2 (chain ID: 8453)

struct Attestation {
    bytes32 payloadHash;      // SHA-256 of (imageHash + fingerprintHash + timestamp)
    bytes32 ipfsCid;          // IPFS CID as bytes32
    address submitter;        // backend signer address
    uint256 timestamp;        // block.timestamp
    bool isRevoked;           // for legal takedown
}

mapping(bytes32 => Attestation) public attestations;

event AttestationCreated(bytes32 indexed payloadHash, bytes32 ipfsCid, uint256 timestamp);
event AttestationRevoked(bytes32 indexed payloadHash);

function attest(bytes32 payloadHash, bytes32 ipfsCid) external onlyTrustedSubmitter
function revoke(bytes32 payloadHash) external onlyOwner
function verify(bytes32 payloadHash) external view returns (Attestation memory)
```

### 4.2 Gas Estimates (Base L2)
- `attest()` call: ~21,000 gas
- At Base L2 gas prices (~0.001 gwei): ~$0.000021 per attestation
- Bulk batch possible: 100 attestations in one tx

### 4.3 ERC-4337 Paymaster (Gas Abstraction)
- Users pay nothing — backend's paymaster sponsors gas
- Bundler: Alchemy Account Kit on Base

---

## 5. AI Anomaly Service — Technical Spec

### 5.1 Stack
- **Python 3.12** + **FastAPI**
- **scikit-learn** Isolation Forest model
- **NumPy / Pandas** for feature extraction

### 5.2 Anomaly Checks

| Check | Method | Red Flag |
|-------|--------|---------|
| GPS Teleportation | Compare with last known location | >1000 km in <1 hour |
| Flat Accelerometer | Check variance | All axes = 0.0 (emulator) |
| Impossible Timestamp | Cross-reference NTP | >60s drift from server time |
| Sensor Coherence | Correlate light vs GPS time-of-day | Bright lux at midnight |
| Repeated Fingerprint | Hash comparison | Exact duplicate sensor data |
| Pressure Altitude Match | GPS alt vs barometer | >500m discrepancy |

### 5.3 Output Schema

```python
class AnomalyResult(BaseModel):
    is_suspicious: bool
    confidence: float          # 0.0 to 1.0
    flags: list[AnomalyFlag]
    risk_level: Literal["low", "medium", "high"]
```

---

## 6. Security Requirements

| Requirement | Implementation |
|------------|---------------|
| Private key never leaves device | Secure Enclave / TEE |
| Image never stored on server | IPFS only; server stores hash |
| API auth | JWT + device fingerprint |
| Rate limiting | 10 captures/hour per device |
| SQL injection | Prisma parameterized queries |
| DoS protection | Cloudflare WAF + Railway limits |
| Jailbreak detection | Expo's `expo-device` isRooted check |
| HTTPS only | TLS 1.3, HSTS headers |

---

## 7. Performance Requirements

| Metric | Target |
|--------|--------|
| Sensor capture latency | < 50ms after shutter |
| API response (POST /captures) | < 2s (IPFS upload async) |
| API response (GET /verify) | < 300ms (cached) |
| Blockchain confirmation | < 2 seconds (Base L2 avg) |
| App size | < 50MB |
| Offline queue drain | Auto-retry with exp. backoff |
