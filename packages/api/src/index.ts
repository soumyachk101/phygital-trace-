import { createApp } from './app';
import { logger } from './utils/logger';
import { startAttestationWorker } from './workers/attestation.worker';

const PORT = parseInt(process.env.PORT || '3001', 10);

const app = createApp();

// Start attestation worker in the same process
const worker = startAttestationWorker(async (job) => {
  // This is a simplified inline processor; normally the worker module handles it
  logger.info('Worker processing job', { jobId: job.id, data: job.data });
  // The actual worker logic is in attestation.worker.ts
});

app.listen(PORT, () => {
  logger.info(`🚀 Phygital-Trace API running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  logger.info(`Health: http://localhost:${PORT}/health`);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully...`);
  worker.close();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
