import { createHash } from 'crypto';
import { FingerprintEntity, PhysicalFingerprint } from '@phygital-trace/shared';
import { verifySignature } from '../utils/crypto';
import { ApiError, ERROR_CODES } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Compute SHA-256 hash of the fingerprint object
 * Must be computed exactly the same way on device and server
 */
export async function hashFingerprint(fingerprint: PhysicalFingerprint): Promise<string> {
  const json = JSON.stringify(fingerprint);
  return createHash('sha256').update(json).digest('hex');
}

/**
 * Compute payload hash: SHA-256(imageHash + fingerprintHash + timestampMs)
 */
export function computePayloadHash(
  imageHash: string,
  fingerprintHash: string,
  timestampUnixMs: number
): string {
  const concatenated = imageHash + fingerprintHash + timestampUnixMs.toString();
  return createHash('sha256').update(concatenated).digest('hex');
}

/**
 * Verify that the signature from the device is valid
 */
export async function verifyDeviceSignature(
  publicKeyPem: string,
  payloadHash: string,
  signatureBase64: string
): Promise<boolean> {
  try {
    // The device signs the payloadHash (hex string)
    // In ECDSA, we need to hash the payload again? Actually no, payloadHash is already a hash.
    // The signature is of the payloadHash as bytes. We need to reconstruct the message hash.
    // For ES256 (P-256 with SHA256), the message is the raw bytes of the payload hash.

    const payloadBytes = Buffer.from(payloadHash, 'hex');
    const messageHash = createHash('sha256').update(payloadBytes).digest();

    return verifySignature(publicKeyPem, messageHash.toString('hex'), signatureBase64);
  } catch (error) {
    logger.error('Signature verification error', { error });
    return false;
  }
}

/**
 * Map PhysicalFingerprint to FingerprintEntity for DB storage
 */
export function mapFingerprintToEntity(
  captureId: string,
  fingerprint: PhysicalFingerprint
): FingerprintEntity {
  return {
    id: `fp_${captureId}`,
    captureId,
    timestampUtc: fingerprint.timestampUtc,
    timestampUnixMs: BigInt(fingerprint.timestampUnixMs),
    gpsLatitude: fingerprint.gps.latitude,
    gpsLongitude: fingerprint.gps.longitude,
    gpsAltitude: fingerprint.gps.altitude,
    gpsAccuracy: fingerprint.gps.accuracy,
    gpsSpeed: fingerprint.gps.speed,
    gpsHeading: fingerprint.gps.heading,
    accelX: fingerprint.accelerometer.x,
    accelY: fingerprint.accelerometer.y,
    accelZ: fingerprint.accelerometer.z,
    accelMagnitude: fingerprint.accelerometer.magnitude,
    gyroX: fingerprint.gyroscope.x,
    gyroY: fingerprint.gyroscope.y,
    gyroZ: fingerprint.gyroscope.z,
    lightLux: fingerprint.light.lux,
    pressureHpa: fingerprint.barometer.pressure_hpa,
    wifiRssi: fingerprint.network.wifiRssi,
    cellularSignal: fingerprint.network.cellularSignal,
    connectionType: fingerprint.network.connectionType,
    deviceModel: fingerprint.device.model,
    osVersion: fingerprint.device.osVersion,
    batteryLevel: fingerprint.device.batteryLevel,
    isCharging: fingerprint.device.isCharging
  };
}

/**
 * Validate fingerprint for anomalies (basic checks)
 */
export function validateFingerprintSanity(
  fingerprint: PhysicalFingerprint
): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Timestamp must be recent (within 5 minutes of now)
  const capturedTime = new Date(fingerprint.timestampUtc).getTime();
  const now = Date.now();
  const timeDiffMs = Math.abs(now - capturedTime);
  if (timeDiffMs > 5 * 60 * 1000) {
    reasons.push('Timestamp too far from current time');
  }

  // GPS coordinates sanity check
  if (
    fingerprint.gps.latitude < -90 ||
    fingerprint.gps.latitude > 90 ||
    fingerprint.gps.longitude < -180 ||
    fingerprint.gps.longitude > 180
  ) {
    reasons.push('Invalid GPS coordinates');
  }

  // Accelerometer magnitude should be roughly 9.8 m/s² when stationary (1G)
  // But can vary. Basic sanity: between 0 and 20
  if (fingerprint.accelerometer.magnitude < 0 || fingerprint.accelerometer.magnitude > 20) {
    reasons.push('Accelerometer magnitude out of range');
  }

  // Battery level should be between 0 and 1
  if (fingerprint.device.batteryLevel < 0 || fingerprint.device.batteryLevel > 1) {
    reasons.push('Invalid battery level');
  }

  return {
    valid: reasons.length === 0,
    reasons
  };
}
