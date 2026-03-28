import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const adminId = uuidv4();
  const admin = await prisma.user.upsert({
    where: { email: 'admin@phygitaltrace.app' },
    update: {},
    create: {
      id: adminId,
      email: 'admin@phygitaltrace.app',
      username: 'admin',
      deviceId: 'device_admin_001',
      publicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1SU1LfVLPHCozMxH2Mo
4lgOEePzNm0tRgeLezV6ffAt0gunVTLw7onLRnrq0/IzW7yWR7QkrmBL7jTKEn5u
qKhYw8fmuqGnpg+2IY8GCQQrKSzTOdH6gfa17A4NfV7g+kA8fmLDM9oAmDHYEyXy
4ZFo9XjRgCRBJKd9hgc1M25I5yd7Fa8tqpddp3C6IXM8dx5xt3qte4+4y4H/GeCC
TqMj2s3SqX>x2euFE7zQ7KnD0pUviIWR5fEMK+JPDA2G1CJGEJtKKThiuVpGvXLC
RzKuGjZcgs4qobLe8Gy2udF5nG+qmEA6RT2gMnoFTjMXFy4PJb9+cDfVAgMBAAEC
QQDDy0tfC02N4BHjW4uexLfabM5UBUxUHIVK9RLDUA5+9xCFvw5owKxQm7E3kMP8
xRP9Tp+omTKPPIsG6l3RkV4PFiES1`,
      role: 'ADMIN'
    }
  });

  console.log('✅ Created admin user:', admin.email);

  // Create journalist user
  const journalistId = uuidv4();
  const journalist = await prisma.user.upsert({
    where: { email: 'journalist@phygitaltrace.app' },
    update: {},
    create: {
      id: journalistId,
      email: 'journalist@phygitaltrace.app',
      username: 'journalist',
      deviceId: 'device_journalist_001',
      publicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxL6D37W2ZFz2jPLq9EcN
rSAtjZmht3sO5rIGqYNEZ+q+3gfCczq2pWu4s1f5PG/he1sK3zGqN0WvJGptm2Oq
mJievbbTq8DnRIsp7vN/F9pVq3X6JKWnLVk8d69hJ6U7Y1sPJtKK/QrKU5EIDBws
7qHCf6/9xGC/zDQDd6nW8rXfFL_modeD/9RFdNuHrNP0x+cRRspMCC/fH8ZrFIR/
dqBKdxVRQjeW3IC5cwwUzxu+M12VTXmL8V5T0KJQWTVLGgnDxOJ5nypicaljrDSR
3e79hJtxAYRcbDMqZBXFG4YXfI4T0I1F5v/ENThTgQRXKlJY9oxHB8CKK7dL/dIBM
D9rJJ5HqHQIDAQAB
-----END PUBLIC KEY-----`,
      role: 'JOURNALIST'
    }
  });

  console.log('✅ Created journalist user:', journalist.email);

  // Create sample fingerprint
  const sampleFingerprintId = uuidv4();
  const sampleCaptureId = 'cap_sample_001';

  await prisma.fingerprint.create({
    data: {
      id: sampleFingerprintId,
      captureId: sampleCaptureId,
      timestampUtc: new Date().toISOString(),
      timestampUnixMs: BigInt(Date.now()),
      gpsLatitude: 22.5726,
      gpsLongitude: 88.3639,
      gpsAltitude: 15.2,
      gpsAccuracy: 3.5,
      gpsSpeed: 0.0,
      gpsHeading: null,
      accelX: 0.12,
      accelY: 9.78,
      accelZ: 0.34,
      accelMagnitude: 9.79,
      gyroX: 0.001,
      gyroY: -0.002,
      gyroZ: 0.0,
      lightLux: 1250.5,
      pressureHpa: 1013.2,
      wifiRssi: -65,
      cellularSignal: null,
      connectionType: 'wifi',
      deviceModel: 'iPhone 15 Pro',
      osVersion: 'iOS 17.4',
      batteryLevel: 0.82,
      isCharging: false
    }
  });

  console.log('✅ Created sample fingerprint');

  // Create sample capture (attested)
  await prisma.capture.upsert({
    where: { id: sampleCaptureId },
    update: {},
    create: {
      id: sampleCaptureId,
      userId: journalistId,
      imageHash: 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef',
      fingerprintHash: 'f1e2d3c4b5a6978877665544332211ffeeddccbbaa99887766554433221100',
      payloadHash: 'hash_abc123xyz789',
      deviceSignature: 'base64signatureexample==',
      ipfsCid: 'QmSampleCid123456789',
      ipfsThumbnailCid: 'QmSampleThumbCid123456',
      status: 'ATTESTED',
      txHash: '0xabcdef1234567890',
      blockNumber: 12345678n,
      attestedAt: new Date(),
      anomalyStatus: 'CLEAN',
      anomalyScore: 0.04,
      anomalyFlags: [],
      capturedAt: new Date(),
      latitude: 22.5726,
      longitude: 88.3639,
      accuracy: 3.5,
      mediaType: 'PHOTO',
      fileSizeBytes: 2048000,
      shortCode: 'abc12345'
    }
  });

  console.log('✅ Created sample capture (attested)');

  // Create another capture (pending)
  const pendingCaptureId = 'cap_sample_002';
  await prisma.capture.upsert({
    where: { id: pendingCaptureId },
    update: {},
    create: {
      id: pendingCaptureId,
      userId: journalistId,
      imageHash: 'b2c3d4e5f6a78901234567890abcdef1234567890abcdef1234567890abcde',
      fingerprintHash: 'e2d3c4b5a6978877665544332211ffeeddccbbaa998877665544332211001',
      payloadHash: 'hash_def456uvw012',
      deviceSignature: 'base64signatureexample2==',
      ipfsCid: 'QmSampleCidSecond123456',
      status: 'PENDING_CHAIN',
      anomalyStatus: 'CLEAN',
      anomalyScore: 0.02,
      anomalyFlags: [],
      capturedAt: new Date(),
      latitude: 22.5730,
      longitude: 88.3640,
      accuracy: 4.2,
      mediaType: 'PHOTO',
      fileSizeBytes: 3145728,
      shortCode: 'def45678'
    }
  });

  console.log('✅ Created sample capture (pending)');

  console.log('🎉 Seed completed!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
