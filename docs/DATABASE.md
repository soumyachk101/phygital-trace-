# DATABASE.md — Phygital-Trace Database Schema

**ORM:** Prisma  
**Database:** PostgreSQL 16  

---

## Prisma Schema (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────
model User {
  id            String    @id @default(cuid())
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Auth
  walletAddress String?   @unique  // optional — for SIWE login
  email         String?   @unique
  passwordHash  String?

  // Device identity
  deviceId      String    @unique  // derived from Secure Enclave public key
  publicKey     String              // EC P-256 public key (PEM)

  // Profile
  username      String?   @unique
  role          UserRole  @default(JOURNALIST)

  // Relations
  captures      Capture[]
  
  @@index([walletAddress])
  @@index([deviceId])
}

enum UserRole {
  JOURNALIST
  ADMIN
}

// ─────────────────────────────────────────────
// CAPTURES
// ─────────────────────────────────────────────
model Capture {
  id              String        @id @default(cuid())
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  // Identity
  userId          String
  user            User          @relation(fields: [userId], references: [id])

  // Hashes
  imageHash       String        // SHA-256 of raw image bytes
  fingerprintHash String        // SHA-256 of serialized PhysicalFingerprint
  payloadHash     String        @unique  // SHA-256(imageHash + fingerprintHash + timestampMs)
  deviceSignature String        // ES256 signature from Secure Enclave

  // IPFS
  ipfsCid         String?       // Content ID on IPFS (full metadata JSON)
  ipfsThumbnailCid String?      // Smaller preview image CID
  
  // Blockchain
  status          CaptureStatus @default(PENDING_LOCAL)
  txHash          String?       // On-chain tx hash
  blockNumber     BigInt?       // Block number of attestation
  attestedAt      DateTime?     // When confirmed on-chain

  // AI Analysis
  anomalyStatus   AnomalyStatus @default(PENDING)
  anomalyScore    Float?        // 0.0 (clean) to 1.0 (very suspicious)
  anomalyFlags    String[]      // List of triggered flag names

  // Fingerprint data (denormalized for fast querying)
  capturedAt      DateTime      // From fingerprint timestamp (trusted)
  latitude        Float?        // Null if user opted out of location reveal
  longitude       Float?
  accuracy        Float?        // GPS accuracy in meters

  // Media metadata
  mediaType       MediaType     @default(PHOTO)
  fileSizeBytes   Int?

  // Verification short URL
  shortCode       String        @unique @default(cuid())  // used in /verify/:shortCode

  // Relations
  fingerprint     Fingerprint?
  verificationViews VerificationView[]

  @@index([userId])
  @@index([payloadHash])
  @@index([shortCode])
  @@index([capturedAt])
  @@index([status])
}

enum CaptureStatus {
  PENDING_LOCAL    // Captured on device, not yet uploaded
  PENDING_IPFS     // Uploading to IPFS
  PENDING_CHAIN    // IPFS done, waiting for blockchain
  ATTESTED         // On-chain confirmed
  FAILED           // Permanent failure
  REVOKED          // Legally revoked
}

enum AnomalyStatus {
  PENDING
  CLEAN
  SUSPICIOUS
  HIGH_RISK
}

enum MediaType {
  PHOTO
  VIDEO
}

// ─────────────────────────────────────────────
// PHYSICAL FINGERPRINT
// ─────────────────────────────────────────────
model Fingerprint {
  id          String   @id @default(cuid())
  captureId   String   @unique
  capture     Capture  @relation(fields: [captureId], references: [id])

  // Timing
  timestampUtc    String    // ISO 8601 with ms
  timestampUnixMs BigInt    // Unix epoch in ms

  // GPS
  gpsLatitude     Float?
  gpsLongitude    Float?
  gpsAltitude     Float?
  gpsAccuracy     Float?
  gpsSpeed        Float?
  gpsHeading      Float?

  // Motion
  accelX          Float?
  accelY          Float?
  accelZ          Float?
  accelMagnitude  Float?
  gyroX           Float?
  gyroY           Float?
  gyroZ           Float?

  // Environment
  lightLux        Float?
  pressureHpa     Float?

  // Network
  wifiRssi        Int?
  cellularSignal  Int?
  connectionType  String?   // 'wifi' | 'cellular' | 'none'

  // Device
  deviceModel     String?
  osVersion       String?
  batteryLevel    Float?
  isCharging      Boolean?

  @@index([captureId])
}

// ─────────────────────────────────────────────
// VERIFICATION VIEWS (Analytics)
// ─────────────────────────────────────────────
model VerificationView {
  id          String   @id @default(cuid())
  captureId   String
  capture     Capture  @relation(fields: [captureId], references: [id])
  viewedAt    DateTime @default(now())
  ipAddress   String?
  userAgent   String?
  referrer    String?

  @@index([captureId])
}

// ─────────────────────────────────────────────
// ATTESTATION QUEUE LOG
// ─────────────────────────────────────────────
model AttestationJob {
  id            String   @id @default(cuid())
  captureId     String
  payloadHash   String
  ipfsCid       String
  attempts      Int      @default(0)
  lastError     String?
  status        JobStatus @default(QUEUED)
  createdAt     DateTime @default(now())
  processedAt   DateTime?

  @@index([captureId])
  @@index([status])
}

enum JobStatus {
  QUEUED
  PROCESSING
  SUCCESS
  FAILED
}
```

---

## Indexes Summary

| Table | Index | Reason |
|-------|-------|--------|
| `Capture` | `payloadHash` | Unique lookup for verification |
| `Capture` | `shortCode` | Public verification URL |
| `Capture` | `capturedAt` | Timeline queries |
| `Capture` | `status` | Worker queue filtering |
| `User` | `deviceId` | Device-based auth |
| `Fingerprint` | `captureId` | FK join |

---

## Prisma Migrations

```bash
# Create new migration
pnpm --filter api exec prisma migrate dev --name init

# Apply in production
pnpm --filter api exec prisma migrate deploy

# Reset dev DB
pnpm --filter api exec prisma migrate reset

# Open Prisma Studio
pnpm --filter api exec prisma studio
```

---

## Seed Data (`prisma/seed.ts`)

Creates:
- 1 admin user
- 1 journalist user with device keypair
- 3 sample captures (one in each status: attested, pending, revoked)
- Sample fingerprints

```bash
pnpm --filter api exec prisma db seed
```

---

## Redis Key Patterns

| Key Pattern | TTL | Purpose |
|-------------|-----|---------|
| `rate:capture:{deviceId}` | 1 hour | Capture rate limit counter |
| `rate:verify:{ip}` | 1 min | Verify rate limit counter |
| `cache:verify:{shortCode}` | 5 min | Cached verification response |
| `cache:user:{userId}` | 15 min | Cached user profile |
| `bull:attestation` | — | BullMQ queue |
| `bull:ipfs-pin` | — | BullMQ retry queue |
