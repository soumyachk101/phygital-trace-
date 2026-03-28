# MOBILE_APP.md — Phygital-Trace React Native App

## Tech Stack
- **React Native** with **Expo SDK 52**
- **TypeScript**
- **NativeWind** (Tailwind for RN) for styling
- **Zustand** for state management
- **React Query (TanStack)** for API calls + caching
- **React Navigation v7** for routing

---

## Folder Structure

```
apps/mobile/
├── app/                         # Expo Router (file-based routing)
│   ├── (auth)/
│   │   └── onboarding.tsx       # First launch device registration
│   ├── (tabs)/
│   │   ├── camera.tsx           # 📷 Main capture screen
│   │   ├── history.tsx          # 📋 My certificates
│   │   └── profile.tsx          # 👤 Settings
│   └── verify/
│       └── [shortCode].tsx      # 🔍 Verification page (deep link)
│
├── components/
│   ├── camera/
│   │   ├── CaptureButton.tsx    # The main shutter button
│   │   ├── SensorOverlay.tsx    # Shows live sensor values during capture
│   │   └── VerifiedBadge.tsx    # ✅ badge animation post-capture
│   ├── certificate/
│   │   ├── TruthCard.tsx        # Certificate display card
│   │   ├── BlockchainProof.tsx  # Chain details + explorer link
│   │   └── FingerprintMap.tsx   # GPS map view
│   └── shared/
│       ├── StatusBadge.tsx      # VERIFIED / PENDING / SUSPICIOUS
│       └── QRShare.tsx          # QR code modal
│
├── hooks/
│   ├── useCapture.ts            # Core capture flow hook
│   ├── useSensors.ts            # Sensor subscription + sampling
│   ├── useSecureEnclave.ts      # Key generation + signing
│   ├── useOfflineQueue.ts       # Local queue management
│   └── useVerification.ts      # Verification page data fetch
│
├── services/
│   ├── api.ts                   # Axios instance + interceptors
│   ├── crypto.ts                # SHA-256, hash computation
│   ├── keystore.ts              # Secure Enclave key ops
│   └── queue.ts                 # MMKV-backed offline queue
│
├── store/
│   ├── authStore.ts             # Zustand: user, token, deviceId
│   └── captureStore.ts          # Zustand: pending captures
│
├── types/
│   └── index.ts                 # Shared TypeScript types
│
└── constants/
    └── config.ts                # API_URL, chain config
```

---

## Core Flow: `useCapture.ts`

```typescript
export function useCapture() {
  const { signPayload } = useSecureEnclave();
  const { enqueue } = useOfflineQueue();
  const api = useApi();

  const capture = async (cameraRef: CameraRef): Promise<CaptureResult> => {
    // 1. Trigger simultaneous capture
    const [photo, sensors] = await Promise.all([
      cameraRef.takePictureAsync({ quality: 0.9, exif: false }),
      sampleAllSensors(),  // single tick, all sensors
    ]);

    // 2. Compute hashes on-device
    const imageBytes = await readFileAsBytes(photo.uri);
    const imageHash = await sha256(imageBytes);
    const fingerprintHash = await sha256(JSON.stringify(sensors));
    const payloadHash = await sha256(
      imageHash + fingerprintHash + sensors.timestampUnixMs.toString()
    );

    // 3. Sign with Secure Enclave
    const signature = await signPayload(payloadHash);

    // 4. Bundle TruthCertificate
    const certificate: TruthCertificate = {
      imageHash,
      fingerprintHash,
      payloadHash,
      deviceSignature: signature,
      capturedAt: sensors.timestampUtc,
      fingerprint: sensors,
    };

    // 5. Try upload — queue if offline
    try {
      const result = await api.submitCapture(photo.uri, certificate);
      return { status: 'submitted', ...result };
    } catch (e) {
      if (isOfflineError(e)) {
        enqueue({ uri: photo.uri, certificate });
        return { status: 'queued_offline' };
      }
      throw e;
    }
  };

  return { capture };
}
```

---

## Secure Enclave Key Management (`useSecureEnclave.ts`)

```typescript
// On first launch:
// 1. Generate P-256 keypair in Secure Enclave
// 2. Store private key in Secure Enclave (never extracted)
// 3. Store public key in SecureStore + register with API

// On capture:
// 1. Prompt biometric auth (FaceID / fingerprint)
// 2. Sign payloadHash with private key
// 3. Return base64 signature

import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

export async function signPayload(payloadHash: string): Promise<string> {
  // Biometric gate
  const auth = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to sign capture',
  });
  if (!auth.success) throw new Error('BIOMETRIC_FAILED');

  // Retrieve and use private key (platform TEE handles actual signing)
  // On iOS: uses SecureEnclave P-256
  // On Android: uses Android Keystore
  const signature = await nativeSign(payloadHash);
  return signature;
}
```

---

## Offline Queue (`services/queue.ts`)

```typescript
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'offline-queue' });

export interface QueuedCapture {
  id: string;
  uri: string;         // local file path
  certificate: TruthCertificate;
  queuedAt: string;
  attempts: number;
}

export const queue = {
  enqueue(item: Omit<QueuedCapture, 'id' | 'queuedAt' | 'attempts'>) {
    const id = uuid();
    const entry: QueuedCapture = { id, ...item, queuedAt: new Date().toISOString(), attempts: 0 };
    const existing = this.getAll();
    storage.set('queue', JSON.stringify([...existing, entry]));
    return id;
  },

  getAll(): QueuedCapture[] {
    const raw = storage.getString('queue');
    return raw ? JSON.parse(raw) : [];
  },

  remove(id: string) {
    const updated = this.getAll().filter(item => item.id !== id);
    storage.set('queue', JSON.stringify(updated));
  },
};

// Background sync — call on app foreground + network reconnect
export async function drainQueue(api: ApiClient) {
  const items = queue.getAll();
  for (const item of items) {
    try {
      await api.submitCapture(item.uri, item.certificate);
      queue.remove(item.id);
    } catch (e) {
      // Exponential backoff handled by caller
    }
  }
}
```

---

## Key Screens

### Camera Screen (`app/(tabs)/camera.tsx`)
- Full-screen camera view
- Live sensor overlay (GPS accuracy, accelerometer, light level)
- Large shutter button with haptic feedback
- Post-capture: animated ✅ badge + "Certificate being anchored..."
- Status: pending → attested (WebSocket update)

### Certificate History (`app/(tabs)/history.tsx`)
- FlatList of all captures
- Status chips: VERIFIED / PENDING / QUEUED (offline)
- Tap → full certificate view

### Verification Page (`app/verify/[shortCode].tsx`)
- Accessible via deep link: `phygitaltrace://verify/abc123`
- Also accessible on web: `https://phygitaltrace.app/verify/abc123`
- Shows: TruthCard, blockchain proof, map, sensor data, anomaly status

---

## Deep Links

```json
// app.json
{
  "expo": {
    "scheme": "phygitaltrace",
    "intentFilters": [
      {
        "action": "VIEW",
        "data": { "scheme": "https", "host": "phygitaltrace.app", "pathPrefix": "/verify" }
      }
    ]
  }
}
```

---

## Required Permissions

| Permission | Platform | Reason |
|-----------|---------|--------|
| Camera | iOS + Android | Photo/video capture |
| Location (precise) | iOS + Android | GPS fingerprint |
| Motion & Fitness | iOS | Accelerometer/gyro |
| FaceID | iOS | Secure Enclave auth prompt |
| Biometric | Android | Keystore auth prompt |
| Internet | Android | API + blockchain |
