import prisma from '../config/database';
import redis from '../config/redis';
import { blockchainService } from './blockchain.service';
import { ipfsService } from './ipfs.service';
import { logger } from '../utils/logger';
import { ApiError, ERROR_CODES } from '../utils/errors';
import { Capture, VerificationResponse, CaptureStatus } from '@phygital-trace/shared';

const CACHE_TTL = 300; // 5 minutes

export class VerifyService {
  /**
   * Get verification data by shortCode
   * This is the main entry point for the verification page
   */
  async getVerificationByShortCode(shortCode: string): Promise<VerificationResponse> {
    // Check cache first
    const cacheKey = `verify:${shortCode}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Cache parse error, continue to DB
      }
    }

    // Fetch from database
    const capture = await prisma.capture.findUnique({
      where: { shortCode },
      include: {
        fingerprint: true,
        user: {
          select: { username: true }
        }
      }
    });

    if (!capture) {
      throw new ApiError(404, ERROR_CODES.CERTIFICATE_NOT_FOUND, 'Certificate not found');
    }

    // Determine verification badge based on status + blockchain
    const badge = await this.determineVerificationBadge(capture);

    // Build response
    const response: VerificationResponse = {
      captureId: capture.id,
      status: capture.status as CaptureStatus,
      capturedAt: capture.capturedAt.toISOString(),
      attestedAt: capture.attestedAt?.toISOString(),
      hashes: {
        payloadHash: capture.payloadHash,
        imageHash: capture.imageHash,
        fingerprintHash: capture.fingerprintHash
      },
      blockchain: {
        chain: 'Base L2',
        chainId: 8453,
        txHash: capture.txHash || '',
        blockNumber: capture.blockNumber ? Number(capture.blockNumber) : 0,
        contractAddress: process.env.ATTESTATION_CONTRACT_ADDRESS || '',
        explorerUrl: `${process.env.NEXT_PUBLIC_BASE_EXPLORER || 'https://basescan.org'}/tx/${capture.txHash || ''}`
      },
      ipfs: {
        cid: capture.ipfsCid || '',
        gatewayUrl: capture.ipfsCid ? ipfsService.getGatewayUrl(capture.ipfsCid) : '',
        thumbnailUrl: capture.ipfsThumbnailCid
          ? ipfsService.getGatewayUrl(capture.ipfsThumbnailCid)
          : capture.ipfsCid
          ? ipfsService.getGatewayUrl(capture.ipfsCid)
          : ''
      },
      fingerprint: {
        timestamp: capture.fingerprint?.timestampUtc || capture.capturedAt.toISOString(),
        location: {
          latitude: capture.latitude || 0,
          longitude: capture.longitude || 0,
          accuracy: `${capture.accuracy || 0}m`
        },
        sensors: {
          accelerometer:
            capture.fingerprint?.accelMagnitude
              ? `${capture.fingerprint.accelMagnitude.toFixed(2)} m/s²`
              : 'N/A',
          light: capture.fingerprint?.lightLux ? `${capture.fingerprint.lightLux.toFixed(1)} lux` : 'N/A',
          pressure: capture.fingerprint?.pressureHpa
            ? `${capture.fingerprint.pressureHpa.toFixed(1)} hPa`
            : 'N/A'
        },
        device:
          capture.fingerprint?.deviceModel && capture.fingerprint?.osVersion
            ? `${capture.fingerprint.deviceModel} / ${capture.fingerprint.osVersion}`
            : 'Unknown'
      },
      anomaly: {
        status: capture.anomalyStatus,
        score: capture.anomalyScore || 0,
        flags: capture.anomalyFlags
      },
      verificationBadge: badge,
      verificationUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify/${capture.shortCode}`
    };

    // Cache the response
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(response));

    return response;
  }

  /**
   * Determine the verification badge based on capture status and blockchain state
   */
  private async determineVerificationBadge(capture: Capture & { fingerprint?: any }): Promise<VerificationResponse['verificationBadge']> {
    switch (capture.status) {
      case 'ATTESTED':
        // Double-check blockchain state
        try {
          const onChain = await blockchainService.isAttested(capture.payloadHash);
          if (!onChain) {
            logger.warn('Capture attested in DB but not on-chain', { captureId: capture.id });
            return 'TAMPERED';
          }
          return capture.anomalyStatus === 'SUSPICIOUS' || capture.anomalyStatus === 'HIGH_RISK'
            ? 'SUSPICIOUS'
            : 'VERIFIED';
        } catch (error) {
          logger.error('Blockchain check failed', { error, captureId: capture.id });
          return 'PENDING'; // temporary
        }

      case 'PENDING_CHAIN':
        return 'PENDING';

      case 'FAILED':
        return 'TAMPERED';

      case 'REVOKED':
        return 'REVOKED';

      default:
        return 'PENDING';
    }
  }

  /**
   * Batch verify multiple shortCodes
   */
  async batchVerify(shortCodes: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    // Fetch all captures in one query
    const captures = await prisma.capture.findMany({
      where: { shortCode: { in: shortCodes } },
      select: { shortCode: true, status: true, payloadHash: true }
    });

    const captureMap = new Map(captures.map((c) => [c.shortCode, c]));

    for (const shortCode of shortCodes) {
      const capture = captureMap.get(shortCode);
      if (!capture) {
        results.set(shortCode, 'NOT_FOUND');
        continue;
      }

      switch (capture.status) {
        case 'ATTESTED':
          try {
            const onChain = await blockchainService.isAttested(capture.payloadHash);
            results.set(shortCode, onChain ? 'VERIFIED' : 'TAMPERED');
          } catch {
            results.set(shortCode, 'PENDING');
          }
          break;
        case 'PENDING_CHAIN':
          results.set(shortCode, 'PENDING');
          break;
        case 'REVOKED':
          results.set(shortCode, 'REVOKED');
          break;
        case 'FAILED':
          results.set(shortCode, 'TAMPERED');
          break;
        default:
          results.set(shortCode, 'PENDING');
      }
    }

    return results;
  }
}

export const verifyService = new VerifyService();
