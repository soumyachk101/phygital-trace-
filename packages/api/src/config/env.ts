import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // IPFS
  PINATA_API_KEY: z.string(),
  PINATA_SECRET_KEY: z.string(),
  PINATA_GATEWAY_URL: z.string().default('https://gateway.pinata.cloud/ipfs'),

  // Blockchain
  BASE_RPC_URL: z.string().url(),
  ATTESTATION_CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  PRIVATE_KEY_SIGNER: z.string().regex(/^0x[a-fA-F0-9]{64}$/),

  // AI Service
  AI_SERVICE_URL: z.string().url(),
  AI_SERVICE_API_KEY: z.string().optional(),

  // Application
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Rate Limiting
  RATE_LIMIT_CAPTURE: z.string().default('10'),
  RATE_LIMIT_VERIFY: z.string().default('100'),

  // Worker
  WORKER_CONCURRENCY: z.string().default('5')
});

export const env = envSchema.parse(process.env);
