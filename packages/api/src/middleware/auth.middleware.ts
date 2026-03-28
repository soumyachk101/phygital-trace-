import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError, ERROR_CODES } from '../utils/errors';
import prisma from '../config/database';

export interface AuthRequest extends Request {
  userId?: string;
  deviceId?: string;
  user?: {
    id: string;
    deviceId: string;
  };
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as {
      userId: string;
      deviceId: string;
    };

    // Verify user exists in DB (optional, but good for validity)
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, deviceId: true }
    });

    if (!user || user.deviceId !== payload.deviceId) {
      throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Invalid token');
    }

    req.userId = payload.userId;
    req.deviceId = payload.deviceId;
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Invalid token');
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, ERROR_CODES.UNAUTHORIZED, 'Token expired');
    }
    next(error);
  }
}
