# API_SPEC.md — Phygital-Trace REST API

**Base URL:** `https://api.phygitaltrace.app/api/v1`  
**Auth:** Bearer JWT (except `/verify` and `/health` — public)

---

## Authentication

### `POST /auth/register`
Register a new device (first launch).

**Request:**
```json
{
  "deviceId": "device_abc123",
  "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
  "deviceModel": "iPhone 15 Pro",
  "osVersion": "iOS 17.4"
}
```

**Response `201`:**
```json
{
  "userId": "clxxx123",
  "token": "eyJhbG..."
}
```

---

### `POST /auth/login`
Login with device signature challenge.

**Step 1 — Get challenge:**
```
GET /auth/challenge?deviceId=device_abc123
→ { "challenge": "random_nonce_abc" }
```

**Step 2 — Submit signed challenge:**
```json
{
  "deviceId": "device_abc123",
  "challenge": "random_nonce_abc",
  "signature": "base64_sig"
}
```

**Response `200`:**
```json
{
  "token": "eyJhbG...",
  "expiresAt": "2026-04-28T00:00:00Z"
}
```

---

## Captures

### `POST /captures`
Submit a new verified capture.

**Auth:** Required  
**Content-Type:** `multipart/form-data`

**Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image` | File | Yes | JPEG/PNG, max 20MB |
| `payload` | JSON string | Yes | See below |

**`payload` JSON structure:**
```json
{
  "imageHash": "sha256_hex_of_image_bytes",
  "fingerprintHash": "sha256_hex_of_fingerprint_json",
  "payloadHash": "sha256_hex_of_(imageHash+fingerprintHash+timestampMs)",
  "deviceSignature": "base64_encoded_ES256_signature",
  "capturedAt": "2026-03-28T14:23:45.123Z",
  "fingerprint": {
    "timestampUtc": "2026-03-28T14:23:45.123Z",
    "timestampUnixMs": 1743170625123,
    "gps": {
      "latitude": 22.5726,
      "longitude": 88.3639,
      "altitude": 15.2,
      "accuracy": 3.5,
      "speed": null,
      "heading": null
    },
    "accelerometer": { "x": 0.12, "y": 9.78, "z": 0.34, "magnitude": 9.79 },
    "gyroscope": { "x": 0.001, "y": -0.002, "z": 0.0 },
    "light": { "lux": 1250.5 },
    "barometer": { "pressure_hpa": 1013.2 },
    "network": {
      "wifiRssi": -65,
      "cellularSignal": null,
      "connectionType": "wifi"
    },
    "device": {
      "model": "iPhone 15 Pro",
      "osVersion": "iOS 17.4",
      "batteryLevel": 0.82,
      "isCharging": false
    }
  }
}
```

**Response `202` (Accepted — processing async):**
```json
{
  "captureId": "cap_xyz789",
  "shortCode": "abc12345",
  "verificationUrl": "https://phygitaltrace.app/verify/abc12345",
  "status": "pending_chain",
  "ipfsCid": "QmXxx...",
  "estimatedConfirmationMs": 2000
}
```

**Error Responses:**
```json
// 400 — Hash mismatch
{ "code": "IMAGE_HASH_MISMATCH", "message": "Uploaded image hash does not match declared hash" }

// 401 — Invalid signature
{ "code": "INVALID_SIGNATURE", "message": "Device signature verification failed" }

// 422 — Anomaly detected
{ "code": "ANOMALY_DETECTED", "message": "Sensor data flagged as suspicious", "flags": ["FLAT_ACCELEROMETER"] }

// 429 — Rate limited
{ "code": "RATE_LIMIT_EXCEEDED", "message": "10 captures per hour limit reached" }
```

---

### `GET /captures`
List user's captures (authenticated).

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | string | — | Cursor for pagination |
| `limit` | number | 20 | Max 100 |
| `status` | string | — | Filter by CaptureStatus |

**Response `200`:**
```json
{
  "data": [
    {
      "captureId": "cap_xyz789",
      "shortCode": "abc12345",
      "status": "attested",
      "capturedAt": "2026-03-28T14:23:45.123Z",
      "txHash": "0xabc...",
      "blockNumber": 12345678,
      "anomalyStatus": "clean",
      "thumbnailUrl": "https://gateway.pinata.cloud/ipfs/QmThumb..."
    }
  ],
  "nextCursor": "cap_prev123",
  "hasMore": true
}
```

---

### `GET /captures/:captureId`
Get a single capture's full details (authenticated, must be owner).

**Response `200`:**
```json
{
  "captureId": "cap_xyz789",
  "shortCode": "abc12345",
  "status": "attested",
  "payloadHash": "abc123...",
  "imageHash": "def456...",
  "fingerprintHash": "ghi789...",
  "ipfsCid": "QmXxx...",
  "txHash": "0xabc...",
  "blockNumber": 12345678,
  "attestedAt": "2026-03-28T14:23:47.000Z",
  "capturedAt": "2026-03-28T14:23:45.123Z",
  "anomalyStatus": "clean",
  "anomalyScore": 0.04,
  "fingerprint": { ... },
  "verificationUrl": "https://phygitaltrace.app/verify/abc12345"
}
```

---

## Verification (Public — No Auth)

### `GET /verify/:shortCode`
Public verification endpoint. Used by verification page.

**Response `200`:**
```json
{
  "captureId": "cap_xyz789",
  "status": "attested",
  "capturedAt": "2026-03-28T14:23:45.123Z",
  "attestedAt": "2026-03-28T14:23:47.000Z",

  "hashes": {
    "payloadHash": "abc123...",
    "imageHash": "def456...",
    "fingerprintHash": "ghi789..."
  },

  "blockchain": {
    "chain": "Base L2",
    "chainId": 8453,
    "txHash": "0xabc...",
    "blockNumber": 12345678,
    "contractAddress": "0xContract...",
    "explorerUrl": "https://basescan.org/tx/0xabc..."
  },

  "ipfs": {
    "cid": "QmXxx...",
    "gatewayUrl": "https://gateway.pinata.cloud/ipfs/QmXxx...",
    "thumbnailUrl": "https://gateway.pinata.cloud/ipfs/QmThumb..."
  },

  "fingerprint": {
    "timestamp": "2026-03-28T14:23:45.123Z",
    "location": {
      "latitude": 22.5726,
      "longitude": 88.3639,
      "accuracy": "3.5m"
    },
    "sensors": {
      "accelerometer": "9.79 m/s²",
      "light": "1250 lux",
      "pressure": "1013.2 hPa"
    },
    "device": "iPhone 15 Pro / iOS 17.4"
  },

  "anomaly": {
    "status": "clean",
    "score": 0.04,
    "flags": []
  },

  "verificationBadge": "VERIFIED"
}
```

**`verificationBadge` values:**
| Value | Meaning |
|-------|---------|
| `VERIFIED` | On-chain attested, hashes match, no anomalies |
| `PENDING` | Awaiting blockchain confirmation |
| `SUSPICIOUS` | Anomaly flags raised — treat with caution |
| `TAMPERED` | Hashes don't match IPFS data |
| `REVOKED` | Legally revoked |
| `NOT_FOUND` | Invalid shortCode |

---

### `POST /verify/batch`
Verify multiple shortCodes at once (for integrators).

**Request:**
```json
{ "shortCodes": ["abc123", "def456", "ghi789"] }
```

**Response `200`:**
```json
{
  "results": [
    { "shortCode": "abc123", "badge": "VERIFIED" },
    { "shortCode": "def456", "badge": "PENDING" },
    { "shortCode": "ghi789", "badge": "NOT_FOUND" }
  ]
}
```

---

## WebSocket Events

Connect: `wss://api.phygitaltrace.app/ws`  
Auth: Pass JWT as query param `?token=xxx`

**Events from server:**
```typescript
// When attestation confirmed
{ event: "attestation_confirmed", captureId: "cap_xyz", txHash: "0x..." }

// When AI analysis complete
{ event: "anomaly_result", captureId: "cap_xyz", status: "clean", score: 0.04 }

// When IPFS upload done
{ event: "ipfs_ready", captureId: "cap_xyz", cid: "QmXxx..." }
```

---

## Health

### `GET /health`
```json
{ "status": "ok", "timestamp": "2026-03-28T14:23:45Z" }
```

### `GET /health/deep`
```json
{
  "status": "ok",
  "services": {
    "database": "ok",
    "redis": "ok",
    "ipfs": "ok",
    "blockchain": "ok",
    "aiService": "ok"
  }
}
```
