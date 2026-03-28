import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { AttestationJob } from '@phygital-trace/shared';

const connection = new Redis(env.REDIS_URL);

export const attestationQueue = new Queue<AttestationJob>('attestation', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 100,
    removeOnFail: 500
  }
});

/**
 * Add a job to the attestation queue
 */
export async function enqueueAttestation(
  captureId: string,
  payloadHash: string,
  ipfsCid: string
): Promise<void> {
  await attestationQueue.add(
    'attest',
    {
      captureId,
      payloadHash,
      ipfsCid
    },
    {
      jobId: captureId // idempotent: same captureId won't create duplicate
    }
  );
  logger.info('Enqueued attestation job', { captureId, payloadHash });
}

/**
 * Start the attestation worker
 */
export function startAttestationWorker(processor: (job: Job<AttestationJob>) => Promise<void>): Worker {
  const worker = new Worker<AttestationJob>(
    'attestation',
    async (job: Job<AttestationJob>) => {
      await processor(job);
    },
    { connection, concurrency: parseInt(env.WORKER_CONCURRENCY) }
  );

  worker.on('completed', (job: Job) => {
    logger.info('Job completed', { id: job.id, data: job.data });
  });

  worker.on('failed', (job: Job | undefined, error: Error) => {
    logger.error('Job failed', {
      id: job?.id,
      data: job?.data,
      error: error.message
    });
  });

  worker.on('error', (error: Error) => {
    logger.error('Worker error', { error });
  });

  return worker;
}
