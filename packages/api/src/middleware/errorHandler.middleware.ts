import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ApiError, ERROR_CODES } from '../utils/errors';

export function errorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof ApiError) {
    logger.warn(`API Error [${err.statusCode}]: ${err.code} - ${err.message}`, {
      path: req.path,
      method: req.method,
      details: err.details
    });

    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details })
      }
    });
    return;
  }

  logger.error('Unhandled error', {
    error: err,
    path: req.path,
    method: req.method
  });

  // In production, don't leak stack traces
  res.status(500).json({
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'An internal server error occurred'
    }
  });
}
