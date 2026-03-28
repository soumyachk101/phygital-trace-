import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ApiError, ERROR_CODES } from '../utils/errors';
import { PhysicalFingerprint } from '@phygital-trace/shared';

export interface AnomalyFlag {
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
}

export interface AnomalyResult {
  is_suspicious: boolean;
  confidence: number; // 0.0 to 1.0
  flags: AnomalyFlag[];
  risk_level: 'low' | 'medium' | 'high';
}

export class AIService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = env.AI_SERVICE_URL;
  }

  /**
   * Analyze fingerprint for anomalies
   * Returns anomaly assessment
   */
  async analyzeFingerprint(
    fingerprint: PhysicalFingerprint
  ): Promise<AnomalyResult> {
    try {
      logger.debug('Calling AI service', { timestamp: fingerprint.timestampUtc });

      const response = await axios.post<AnomalyResult>(
        `${this.baseUrl}/analyze`,
        { fingerprint },
        {
          timeout: 10000, // 10 second timeout
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error('AI service error', { error });

      if (error.response?.status === 503) {
        throw new ApiError(503, 'AI_SERVICE_UNAVAILABLE', 'AI anomaly service unavailable');
      }

      // If AI fails, we'll allow the capture but mark as PENDING
      // Return a default "clean" result to not block workflow
      logger.warn('AI service failed, returning default result');
      return {
        is_suspicious: false,
        confidence: 0,
        flags: [],
        risk_level: 'low'
      };
    }
  }
}

export const aiService = new AIService();
