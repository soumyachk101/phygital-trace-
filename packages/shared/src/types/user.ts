import { UserRole } from './common';

export interface User {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  walletAddress?: string | null;
  email?: string | null;
  username?: string | null;
  role: UserRole;
  deviceId: string;
  publicKey: string; // PEM format EC P-256 public key
}

export interface AuthRegisterInput {
  deviceId: string;
  publicKey: string;
  deviceModel?: string;
  osVersion?: string;
  email?: string;
  username?: string;
}

export interface AuthChallengeResponse {
  challenge: string;
  deviceId: string;
  expiresAt: Date;
}

export interface AuthLoginInput {
  deviceId: string;
  challenge: string;
  signature: string; // base64 ES256 signature
}

export interface AuthResponse {
  userId: string;
  token: string;
  expiresAt: Date;
}
