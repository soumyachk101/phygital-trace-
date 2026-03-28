import { CaptureStatus, AnomalyStatus, MediaType, VerificationBadge } from './common';
import { PhysicalFingerprint, FingerprintEntity } from './fingerprint';

export interface TruthCertificate {
  imageHash: string;
  fingerprintHash: string;
  payloadHash: string;
  deviceSignature: string; // base64 ES256 signature
  capturedAt: string;
  fingerprint: PhysicalFingerprint;
}

export interface Capture {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  imageHash: string;
  fingerprintHash: string;
  payloadHash: string;
  deviceSignature: string;
  ipfsCid?: string | null;
  ipfsThumbnailCid?: string | null;
  status: CaptureStatus;
  txHash?: string | null;
  blockNumber?: bigint | null;
  attestedAt?: Date | null;
  anomalyStatus: AnomalyStatus;
  anomalyScore?: number | null;
  anomalyFlags: string[];
  capturedAt: Date;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  mediaType: MediaType;
  fileSizeBytes?: number | null;
  shortCode: string;
  fingerprint?: FingerprintEntity | null;
}

export interface CaptureListItem {
  id: string;
  capturedAt: Date;
  status: CaptureStatus;
  shortCode: string;
  thumbnailUrl?: string | null;
  anomalyStatus: AnomalyStatus;
  latitude?: number | null;
  longitude?: number | null;
}

export interface CaptureSubmission {
  image: File;
  payload: string; // JSON string of TruthCertificate (without image)
}

export interface CaptureSubmitResponse {
  captureId: string;
  shortCode: string;
  status: CaptureStatus;
  verificationUrl: string;
  ipfsCid?: string;
  estimatedConfirmationMs?: number;
}

export interface VerificationResponse {
  captureId: string;
  status: CaptureStatus;
  capturedAt: string;
  attestedAt?: string;
  hashes: {
    payloadHash: string;
    imageHash: string;
    fingerprintHash: string;
  };
  blockchain: {
    chain: string;
    chainId: number;
    txHash: string;
    blockNumber: number;
    contractAddress: string;
    explorerUrl: string;
  };
  ipfs: {
    cid: string;
    gatewayUrl: string;
    thumbnailUrl: string;
  };
  fingerprint: {
    timestamp: string;
    location: {
      latitude: number;
      longitude: number;
      accuracy: string;
    };
    sensors: {
      accelerometer: string;
      light: string;
      pressure: string;
    };
    device: string;
  };
  anomaly: {
    status: AnomalyStatus;
    score: number;
    flags: string[];
  };
  verificationBadge: 'VERIFIED' | 'PENDING' | 'SUSPICIOUS' | 'TAMPERED' | 'REVOKED' | 'NOT_FOUND';
  verificationUrl: string;
}

export interface AttestationJob {
  id: string;
  captureId: string;
  payloadHash: string;
  ipfsCid: string;
  attempts: number;
  lastError?: string | null;
  status: 'QUEUED' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  createdAt: Date;
  processedAt?: Date | null;
}
