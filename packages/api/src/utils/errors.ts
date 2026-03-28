export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// Common error codes
export const ERROR_CODES = {
  // Auth (4xx)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  SIGNATURE_MISMATCH: 'SIGNATURE_MISMATCH',
  IMAGE_HASH_MISMATCH: 'IMAGE_HASH_MISMATCH',
  UNAUTHORIZED: 'UNAUTHORIZED',
  CERTIFICATE_NOT_FOUND: 'CERTIFICATE_NOT_FOUND',

  // Blockchain (4xx, 5xx)
  BLOCKCHAIN_ERROR: 'BLOCKCHAIN_ERROR',
  CONTRACT_ERROR: 'CONTRACT_ERROR',
  TX_FAILED: 'TX_FAILED',

  // Storage (5xx)
  IPFS_UPLOAD_FAILED: 'IPFS_UPLOAD_FAILED',
  S3_UPLOAD_FAILED: 'S3_UPLOAD_FAILED',

  // AI (4xx)
  ANOMALY_DETECTED: 'ANOMALY_DETECTED',

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Server (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
} as const;
