import { Router, Request, Response } from 'express';
import { verifyService } from '../services/verify.service';
import { verifyRateLimit } from '../middleware/rateLimit.middleware';
import { logger } from '../utils/errors';

const router = Router();

/**
 * GET /api/v1/verify/:shortCode
 * Public verification endpoint
 */
router.get('/:shortCode', verifyRateLimit, async (req: Request, res: Response) => {
  try {
    const { shortCode } = req.params;

    const verification = await verifyService.getVerificationByShortCode(shortCode);

    logger.debug('Verification retrieved', { shortCode });
    res.json(verification);
  } catch (error) {
    logger.error('Verification error', { error, shortCode: req.params.shortCode });
    throw error;
  }
});

/**
 * POST /api/v1/verify/batch
 * Batch verify multiple shortCodes
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { shortCodes } = req.body;

    if (!Array.isArray(shortCodes) || shortCodes.length === 0) {
      throw new Error('shortCodes array is required');
    }

    if (shortCodes.length > 100) {
      throw new Error('Maximum 100 shortCodes per batch');
    }

    const results = await verifyService.batchVerify(shortCodes);

    const response = shortCodes.map((code: string) => ({
      shortCode: code,
      badge: results.get(code) || 'NOT_FOUND'
    }));

    res.json({ results: response });
  } catch (error) {
    logger.error('Batch verify error', { error });
    throw error;
  }
});

export default router;
