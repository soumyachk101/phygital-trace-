/**
 * Common types used across the Phygital-Trace platform
 */

export type UserRole = 'JOURNALIST' | 'ADMIN';

export type CaptureStatus =
  | 'PENDING_LOCAL'
  | 'PENDING_IPFS'
  | 'PENDING_CHAIN'
  | 'ATTESTED'
  | 'FAILED'
  | 'REVOKED';

export type AnomalyStatus = 'PENDING' | 'CLEAN' | 'SUSPICIOUS' | 'HIGH_RISK';

export type MediaType = 'PHOTO' | 'VIDEO';

export type VerificationBadge =
  | 'VERIFIED'
  | 'PENDING'
  | 'SUSPICIOUS'
  | 'TAMPERED'
  | 'REVOKED'
  | 'NOT_FOUND';

export interface ApiError<T = unknown> {
  statusCode: number;
  code: string;
  message: string;
  details?: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
}
