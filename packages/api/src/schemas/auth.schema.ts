import { z } from 'zod';

export const authRegisterSchema = z.object({
  deviceId: z.string().min(1),
  publicKey: z.string().min(1), // PEM format
  deviceModel: z.string().optional(),
  osVersion: z.string().optional(),
  email: z.string().email().optional(),
  username: z.string().min(3).max(50).optional()
});

export const authChallengeSchema = z.object({
  deviceId: z.string().min(1)
});

export const authLoginSchema = z.object({
  deviceId: z.string().min(1),
  challenge: z.string().min(1),
  signature: z.string().min(1) // base64
});
