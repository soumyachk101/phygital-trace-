import { startAttestationWorker } from '../services/queue.service';
import { blockchainService } from '../config/blockchain';
import prisma from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { ApiError, ERROR_CODES } from '../utils/errors';

// Initialize blockchain connection before starting worker
import('../config/blockchain').then(() => {
  logger.info('Blockchain module loaded, starting worker...');
});

async function processAttestationJob(job: any): Promise<void> {
  const { captureId, payloadHash, ipfsCid } = job.data;

  logger.info('Processing attestation job', { captureId, payloadHash });

  try {
    // 1. Call blockchain service
    const { txHash, blockNumber } = await blockchainService.attest(payloadHash, ipfsCid);

    // 2. Update capture in database
    await prisma.capture.update({
      where: { id: captureId },
      data: {
        status: 'ATTESTED',
        txHash,
        blockNumber: BigInt(blockNumber),
        attestedAt: new Date()
      }
    });

    logger.info('Attestation job completed', { captureId, txHash, blockNumber });

    // 3. Clear cached verification data
    const capture = await prisma.capture.findUnique({
      where: { id: captureId },
      select: { shortCode: true }
    });
    if (capture) {
      await redis.del(`verify:${capture.shortCode}`);
    }
  } catch (error: any) {
    logger.error('Attestation job failed', { error, captureId });

    // If it's a recoverable error, BullMQ will retry automatically
    if (error instanceof ApiError && error.statusCode === 409) {
      // AlreadyAttested — this is actually a success (race condition)
      logger.warn('Attestation already exists, marking as complete', { captureId });
      await prisma.capture.update({
        where: { id: captureId },
        data: { status: 'ATTESTED' }
      });
      throw error; // Don't retry
    }

    throw error; // Let BullMQ handle retry
  }
}

// Start the worker
const worker = startAttestationWorker(processAttestationJob);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, closing worker...');
  worker.close().then(() => {
    logger.info('Worker closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, closing worker...');
  worker.close().then(() => {
    logger.info('Worker closed');
    process.exit(0);
  });
});

logger.info('Attestation worker started');
