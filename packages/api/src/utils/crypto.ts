import { createHash, createVerify, createHmac } from 'crypto';
import { randomBytes } from 'crypto';

export async function sha256(data: string | Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    hash.update(data);
    resolve(hash.digest('hex'));
  });
}

export async function sha256Buffer(data: string | Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    hash.update(data);
    resolve(hash.digest());
  });
}

export function verifySignature(
  publicKey: string,
  message: string,
  signature: string
): boolean {
  return new Promise((resolve) => {
    const verify = createVerify('SHA256');
    verify.update(message);
    verify.end();
    const result = verify.verify(publicKey, Buffer.from(signature, 'base64'));
    resolve(result);
  }) as unknown as boolean;
}

/**
 * Verify ES256 signature (ECDSA P-256 with SHA256)
 * This is synchronous to match the interface
 */
export function verifySignatureSync(publicKey: string, message: string, signature: string): boolean {
  const verify = createVerify('SHA256');
  verify.update(message);
  verify.end();
  try {
    return verify.verify(publicKey, Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
}

export function generateNonce(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

export function hmacSha256(key: Buffer, data: string | Buffer): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

export function bytesToHex(bytes: Buffer): string {
  return bytes.toString('hex');
}

export function hexToBytes(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

/**
 * Convert IPFS CID to bytes32 format for blockchain storage
 */
export function cidToBytes32(cid: string): string {
  // Simple implementation: take first 32 bytes of the CID
  // In production, use proper CID decoding (multiformats)
  const buffer = Buffer.from(cid.replace(/^Qm[0-9A-Za-z]+$/, '').slice(0, 64), 'hex');
  const padded = Buffer.alloc(32, 0);
  buffer.copy(padded, 32 - buffer.length);
  return '0x' + padded.toString('hex');
}

export function bytes32ToCid(bytes32: string): string {
  // Simplified reverse operation
  const hex = bytes32.replace(/^0x/, '');
  // In production: reconstruct proper CID format
  return 'Qm' + hex.substring(0, 44); // approximate
}
