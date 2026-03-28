import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';

import { captureService } from '../services/capture.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { captureRateLimit } from '../middleware/rateLimit.middleware';
import { ApiError, ERROR_CODES } from '../utils/errors';
import { logger } from '../utils/logger';

const router = Router();

// Configure multer to use memory storage (we'll write to temp file)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG and PNG allowed.'));
    }
  }
});

/**
 * POST /api/v1/captures
 * Submit a new capture
 */
router.post(
  '/',
  upload.single('image'),
  captureRateLimit,
  async (req: Request, res: Response) => {
    try {
      // Validate multipart request
      if (!req.file) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Image file is required');
      }
      if (!req.body.payload) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Payload JSON is required');
      }

      // Parse payload
      let payload;
      try {
        payload = JSON.parse(req.body.payload);
      } catch {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid JSON in payload');
      }

      // Get user from auth middleware
      const authReq = req as any;
      if (!authReq.userId) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      // Write file to temporary location for processing
      const tempDir = './temp';
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFileName = `${uuidv4()}_${req.file.originalname}`;
      const tempFilePath = path.join(tempDir, tempFileName);

      await fs.writeFile(tempFilePath, req.file.buffer);

      try {
        const result = await captureService.processCapture({
          image: {
            path: tempFilePath,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            buffer: req.file.buffer,
            size: req.file.size
          },
          payload
        }, authReq.userId);

        logger.info('Capture submitted', {
          captureId: result.captureId,
          shortCode: result.shortCode,
          userId: authReq.userId
        });

        res.status(202).json(result);
      } finally {
        // Cleanup temp file
        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          logger.warn('Failed to cleanup temp file', { error: cleanupError, path: tempFilePath });
        }
      }
    } catch (error: any) {
      logger.error('Capture submission error', { error, userId: (req as any).userId });
      throw error;
    }
  }
);

/**
 * GET /api/v1/captures
 * List user's captures (requires auth)
 */
router.get('/', authMiddleware, async (req: any, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const cursor = req.query.page as string;

    const result = await captureService.getCapturesByUser(req.userId, limit, cursor);

    res.json(result);
  } catch (error) {
    logger.error('Get captures error', { error, userId: req.userId });
    throw error;
  }
});

/**
 * GET /api/v1/captures/:id
 * Get specific capture (requires auth)
 */
router.get('/:id', authMiddleware, async (req: any, res: Response) => {
  try {
    const capture = await captureService.getCaptureById(req.params.id, req.userId);
    res.json(capture);
  } catch (error) {
    logger.error('Get capture error', { error, captureId: req.params.id, userId: req.userId });
    throw error;
  }
});

export default router;
