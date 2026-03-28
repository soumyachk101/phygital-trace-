import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database';
import { ipfsService } from './ipfs.service';
import { blockchainService } from './blockchain.service';
import { aiService } from './ai.service';
import { fingerprintService } from './fingerprint.service';
import { enqueueAttestation } from './queue.service';
import { logger } from '../utils/logger';
import { ApiError, ERROR_CODES } from '../utils/errors';
import { Capture, CaptureSubmission, CaptureSubmitResponse, VerificationResponse, PhysicalFingerprint } from '@phygital-trace/shared';

export class CaptureService {
  /**
   * Main capture processing pipeline
   */
  async processCapture(
    submission: CaptureSubmission,
    userId: string
  ): Promise<CaptureSubmitResponse> {
    const captureId = `cap_${uuidv4()}`;
    const shortCode = this.generateShortCode();

    try {
      // 1. Parse payload
      const certificate = submission.payload;
      const imageFile = submission.image;

      // Additional validation: payload must match device signature
      // (signature verification happens before calling this service)

      // 2. Compute image hash from file
      logger.debug('Computing image hash', { captureId });
      const imageBuffer = await fs.readFile(imageFile.path);
      const imageHash = await this.sha256(imageBuffer);

      if (imageHash !== certificate.imageHash) {
        throw new ApiError(400, ERROR_CODES.IMAGE_HASH_MISMATCH, 'Uploaded image hash does not match');
      }

      // 3. Generate thumbnail
      logger.debug('Generating thumbnail', { captureId });
      const thumbnailBuffer = await sharp(imageBuffer)
        .resize(300, 300, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();

      // 4. Validate fingerprint sanity
      const sanity = fingerprintService.validateFingerprintSanity(certificate.fingerprint);
      if (!sanity.valid) {
        logger.warn('Fingerprint sanity check failed', { captureId, reasons: sanity.reasons });
        // Don't reject — let AI service flag it
      }

      // 5. Call AI service for anomaly detection (async, non-blocking)
      logger.debug('Calling AI service', { captureId });
      const anomalyResult = await aiService.analyzeFingerprint(certificate.fingerprint);

      // 6. Upload image + thumbnail to IPFS (parallel)
      logger.debug('Uploading to IPFS', { captureId });

      // Prepare metadata JSON
      const metadata = {
        ...certificate,
        captureId,
        userId,
        uploadedAt: new Date().toISOString()
      };

      const [imageCid, thumbCid] = await Promise.all([
        ipfsService.uploadFile(imageFile.path, `capture-${captureId}.jpg`, metadata),
        ipfsService.uploadJSON(
          { ...metadata, image: undefined }, // thumbnail metadata (no image)
          `thumb-${captureId}`
        )
      ]);

      // 7. Save to database
      logger.debug('Saving capture to DB', { captureId });
      const capture = await prisma.capture.create({
        data: {
          id: captureId,
          userId,
          imageHash,
          fingerprintHash: certificate.fingerprintHash,
          payloadHash: certificate.payloadHash,
          deviceSignature: certificate.deviceSignature,
          ipfsCid: imageCid,
          ipfsThumbnailCid: thumbCid,
          status: 'PENDING_CHAIN',
          txHash: null,
          blockNumber: null,
          attestedAt: null,
          anomalyStatus: anomalyResult.is_suspicious ? 'SUSPICIOUS' : 'CLEAN',
          anomalyScore: anomalyResult.confidence,
          anomalyFlags: anomalyResult.flags.map(f => f.type),
          capturedAt: new Date(certificate.capturedAt),
          latitude: certificate.fingerprint.gps.latitude,
          longitude: certificate.fingerprint.gps.longitude,
          accuracy: certificate.fingerprint.gps.accuracy,
          mediaType: 'PHOTO',
          fileSizeBytes: imageBuffer.length,
          shortCode
        }
      });

      // 8. Save fingerprint entity
      await prisma.fingerprint.create({
        data: fingerprintService.mapFingerprintToEntity(captureId, certificate.fingerprint)
      });

      // 9. Enqueue attestation job
      await enqueueAttestation(captureId, certificate.payloadHash, imageCid);

      // 10. Return response
      const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify/${shortCode}`;

      return {
        captureId,
        shortCode,
        status: capture.status,
        verificationUrl,
        ipfsCid: imageCid
      };
    } catch (error) {
      logger.error('Capture processing failed', { error, captureId });
      throw error;
    }
  }

  /**
   * Get captures for a user (with pagination)
   */
  async getCapturesByUser(
    userId: string,
    limit: number = 20,
    cursor?: string
  ): Promise<{ data: Capture[]; nextCursor?: string; hasMore: boolean }> {
    const where = { userId };

    const order = { createdAt: 'desc' };

    if (cursor) {
      const cursorDate = new Date(cursor);
      const items = await prisma.capture.findMany({
        where,
        take: limit + 1,
        cursor: { createdAt: cursorDate },
        order,
        include: {
          fingerprint: true
        }
      });

      const hasMore = items.length > limit;
      const data = hasMore ? items.slice(0, limit) : items;

      return {
        data,
        nextCursor: hasMore ? data[data.length - 1].createdAt.toISOString() : undefined,
        hasMore
      };
    }

    const items = await prisma.capture.findMany({
      where,
      take: limit + 1,
      order,
      include: {
        fingerprint: true
      }
    });

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;

    return {
      data,
      nextCursor: hasMore ? data[data.length - 1].createdAt.toISOString() : undefined,
      hasMore
    };
  }

  /**
   * Get single capture by ID (user must be owner)
   */
  async getCaptureById(captureId: string, userId: string): Promise<Capture> {
    const capture = await prisma.capture.findFirst({
      where: { id: captureId, userId },
      include: {
        fingerprint: true,
        user: { select: { username: true } }
      }
    });

    if (!capture) {
      throw new ApiError(404, ERROR_CODES.CERTIFICATE_NOT_FOUND, 'Capture not found');
    }

    return capture;
  }

  private generateShortCode(): string {
    // 8-character alphanumeric (base36)
    return uuidv4().substring(0, 8).toLowerCase();
  }

  private async sha256(buffer: Buffer): Promise<string> {
    const { createHash } = await import('crypto');
    return createHash('sha256').update(buffer).digest('hex');
  }
}

export const captureService = new CaptureService();
