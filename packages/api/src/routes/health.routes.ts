import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import Redis from 'ioredis';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

const router = Router();

/**
 * GET /health/deep
 * Comprehensive health check of all dependencies
 */
router.get('/deep', async (req: Request, res: Response) => {
  const health: any = {
    timestamp: new Date().toISOString()
  };

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.database = 'ok';
  } catch (error) {
    health.database = 'error';
    health.databaseError = (error as Error).message;
  }

  // Check Redis
  try {
    const redis = new Redis(process.env.REDIS_URL);
    await redis.ping();
    await redis.quit();
    health.redis = 'ok';
  } catch (error) {
    health.redis = 'error';
    health.redisError = (error as Error).message;
  }

  // Check blockchain (optional)
  try {
    // Simple RPC call to check connectivity
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
    const network = await provider.getNetwork();
    health.blockchain = {
      status: 'ok',
      chainId: network.chainId,
      name: network.name
    };
  } catch (error) {
    health.blockchain = {
      status: 'error',
      error: (error as Error).message
    };
  }

  // Check IPFS (Pinata)
  try {
    const response = await fetch('https://api.pinata.cloud/data/testAuthentication', {
      method: 'GET',
      headers: {
        'pinata_api_key': process.env.PINATA_API_KEY,
        'pinata_secret_api_key': process.env.PINATA_SECRET_KEY
      }
    });
    if (response.ok) {
      health.ipfs = 'ok';
    } else {
      health.ipfs = `error: ${response.status}`;
    }
  } catch (error) {
    health.ipfs = 'error';
    health.ipfsError = (error as Error).message;
  }

  // Overall status
  const allOk =
    health.database === 'ok' &&
    health.redis === 'ok' &&
    typeof health.blockchain === 'object' &&
    health.blockchain?.status === 'ok' &&
    health.ipfs === 'ok';

  health.status = allOk ? 'ok' : 'degraded';

  res.status(allOk ? 200 : 503).json(health);
});

export default router;
