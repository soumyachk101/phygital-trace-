import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { captureRateLimit } from '../middleware/rateLimit.middleware';
import { authRegisterSchema, authChallengeSchema, authLoginSchema } from '../schemas';
import { ApiError, ERROR_CODES } from '../utils/errors';
import { logger } from '../utils/logger';
import { verifySignature } from '../utils/crypto';
import { generateNonce } from '../utils/crypto';

const router = Router();

/**
 * POST /api/v1/auth/register
 * Register a new device/user
 */
router.post('/register', captureRateLimit, async (req: Request, res: Response) => {
  try {
    const validated = authRegisterSchema.parse(req.body);

    // Check if device already exists
    const existing = await prisma.user.findUnique({
      where: { deviceId: validated.deviceId }
    });

    if (existing) {
      // Return existing user info (device reinstall)
      const token = jwt.sign(
        { userId: existing.id, deviceId: existing.deviceId },
        process.env.JWT_SECRET!,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );
      return res.status(200).json({
        userId: existing.id,
        token
      });
    }

    // Create new user
    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        deviceId: validated.deviceId,
        publicKey: validated.publicKey,
        email: validated.email,
        username: validated.username,
        role: 'JOURNALIST'
      }
    });

    // Issue JWT
    const token = jwt.sign(
      { userId: user.id, deviceId: user.deviceId },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    logger.info('User registered', { userId: user.id, deviceId: validated.deviceId });

    res.status(201).json({
      userId: user.id,
      token
    });
  } catch (error: any) {
    logger.error('Register error', { error });
    throw error;
  }
});

/**
 * GET /api/v1/auth/challenge?deviceId=xxx
 * Generate a challenge for device signature
 */
router.get('/challenge', async (req: Request, res: Response) => {
  const deviceId = req.query.deviceId as string;

  if (!deviceId) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'deviceId is required');
  }

  // Check device exists
  const user = await prisma.user.findUnique({
    where: { deviceId }
  });

  if (!user) {
    throw new ApiError(404, 'DEVICE_NOT_FOUND', 'Device not registered');
  }

  // Generate random nonce challenge
  const challenge = generateNonce(32);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Store challenge in Redis (or could use in-memory for dev)
  // For simplicity, we'll return it and expect the device to sign it
  // In production, store hash of challenge to prevent reuse
  const redisClient = require('../config/redis').default;
  await redisClient.setex(`challenge:${deviceId}`, 300, challenge);

  res.json({
    challenge,
    deviceId,
    expiresAt
  });
});

/**
 * POST /api/v1/auth/login
 * Verify device signature and issue JWT
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { deviceId, challenge, signature } = authLoginSchema.parse(req.body);

    // Fetch user
    const user = await prisma.user.findUnique({
      where: { deviceId }
    });

    if (!user) {
      throw new ApiError(404, 'DEVICE_NOT_FOUND', 'Device not registered');
    }

    // Verify challenge
    const redisClient = require('../config/redis').default;
    const storedChallenge = await redisClient.get(`challenge:${deviceId}`);

    if (!storedChallenge || storedChallenge !== challenge) {
      throw new ApiError(401, ERROR_CODES.INVALID_SIGNATURE, 'Invalid or expired challenge');
    }

    // Verify signature
    const messageHash = require('crypto')
      .createHash('sha256')
      .update(Buffer.from(challenge, 'hex'))
      .digest()
      .toString('hex');

    const isValid = verifySignature(user.publicKey, messageHash, signature);

    if (!isValid) {
      throw new ApiError(401, ERROR_CODES.INVALID_SIGNATURE, 'Invalid device signature');
    }

    // Delete used challenge
    await redisClient.del(`challenge:${deviceId}`);

    // Issue new JWT
    const token = jwt.sign(
      { userId: user.id, deviceId: user.deviceId },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    logger.info('Device logged in', { userId: user.id, deviceId });

    res.json({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });
  } catch (error: any) {
    logger.error('Login error', { error });
    throw error;
  }
});

export default router;
