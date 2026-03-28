import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { env } from '../config/env';
import { ApiError, ERROR_CODES } from '../utils/errors';
import { logger } from '../utils/logger';

const redis = new Redis(env.REDIS_URL);

interface RateLimitConfig {
  max: number;
  windowMs: number;
  keyGenerator: (req: Request) => string;
}

/**
 * Create a rate limiting middleware
 */
export function createRateLimit(config: RateLimitConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = `rate:${config.keyGenerator(req)}`;
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.pexpire(key, config.windowMs);
    }

    if (current > config.max) {
      throw new ApiError(429, ERROR_CODES.RATE_LIMIT_EXCEEDED, 'Rate limit exceeded');
    }

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', config.max.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - current).toString());

    next();
  };
}

/**
 * Capture rate limit: 10 per hour per deviceId
 */
export const captureRateLimit = createRateLimit({
  max: parseInt(env.RATE_LIMIT_CAPTURE),
  windowMs: 60 * 60 * 1000, // 1 hour
  keyGenerator: (req) => {
    // For capture endpoint, extract deviceId from body
    if (req.method === 'POST' && req.path === '/captures') {
      return `capture:${(req.body as any)?.deviceId || 'unknown'}`;
    }
    return `capture:${req.ip}`;
  }
});

/**
 * Verification rate limit: 100 per minute per IP
 */
export const verifyRateLimit = createRateLimit({
  max: parseInt(env.RATE_LIMIT_VERIFY),
  windowMs: 60 * 1000, // 1 minute
  keyGenerator: (req) => `verify:${req.ip}`
});

/**
 * Global rate limit: 1000 requests per minute per IP
 */
export const globalRateLimit = createRateLimit({
  max: 1000,
  windowMs: 60 * 1000,
  keyGenerator: (req) => req.ip
});
