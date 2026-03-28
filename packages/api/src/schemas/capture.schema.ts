import { z } from 'zod';

// Nested fingerprint schema from the physical data
const gpsSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  altitude: z.number(),
  accuracy: z.number(),
  speed: z.number().null().optional(),
  heading: z.number().null().optional()
});

const accelerometerSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  magnitude: z.number()
});

const gyroscopeSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number()
});

const lightSchema = z.object({
  lux: z.number()
});

const barometerSchema = z.object({
  pressure_hpa: z.number()
});

const networkSchema = z.object({
  wifiRssi: z.number().null().optional(),
  cellularSignal: z.number().null().optional(),
  connectionType: z.enum(['wifi', 'cellular', 'none'])
});

const deviceSchema = z.object({
  model: z.string(),
  osVersion: z.string(),
  batteryLevel: z.number().min(0).max(1),
  isCharging: z.boolean()
});

export const fingerprintSchema = z.object({
  timestampUtc: z.string().datetime(),
  timestampUnixMs: z.number(),
  gps: gpsSchema,
  accelerometer: accelerometerSchema,
  gyroscope: gyroscopeSchema,
  light: lightSchema,
  barometer: barometerSchema,
  network: networkSchema,
  device: deviceSchema
});

// TruthCertificate (what mobile app sends minus the image file)
export const truthCertificateSchema = z.object({
  imageHash: z.string().regex(/^[a-fA-F0-9]{64}$/),
  fingerprintHash: z.string().regex(/^[a-fA-F0-9]{64}$/),
  payloadHash: z.string().regex(/^[a-fA-F0-9]{64}$/),
  deviceSignature: z.string().min(1),
  capturedAt: z.string().datetime(),
  fingerprint: fingerprintSchema
});

// Capture submission (multipart: image file + payload JSON)
export const captureSubmissionSchema = z.object({
  image: z.instanceof(File),
  payload: z.string().transform((str) => JSON.parse(str))
});

export const captureResponseSchema = z.object({
  captureId: z.string(),
  shortCode: z.string(),
  status: z.enum([
    'PENDING_LOCAL',
    'PENDING_IPFS',
    'PENDING_CHAIN',
    'ATTESTED',
    'FAILED',
    'REVOKED'
  ]),
  verificationUrl: z.string().url(),
  ipfsCid: z.string().optional(),
  estimatedConfirmationMs: z.number().optional()
});

export const captureListResponseSchema = z.object({
  data: z.array(z.object({
    captureId: z.string(),
    shortCode: z.string(),
    status: z.string(),
    capturedAt: z.string().datetime(),
    txHash: z.string().optional(),
    blockNumber: z.number().optional(),
    anomalyStatus: z.string(),
    thumbnailUrl: z.string().url().optional()
  })),
  nextCursor: z.string().optional(),
  hasMore: z.boolean()
});
