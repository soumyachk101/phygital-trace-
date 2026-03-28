import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config as dotenvConfig } from 'dotenv';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler.middleware';
import { globalRateLimit } from './middleware/rateLimit.middleware';
import { initBlockchain } from './config/blockchain';
import captureRoutes from './routes/capture.routes';
import verifyRoutes from './routes/verify.routes';
import authRoutes from './routes/auth.routes';
import healthRoutes from './routes/health.routes';

dotenvConfig();

export function createApp(): Express {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.NODE_ENV === 'production'
      ? [process.env.NEXT_PUBLIC_APP_URL].filter(Boolean)
      : '*',
    credentials: true
  }));

  // Compression
  app.use(compression());

  // Logging
  if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  } else {
    app.use(morgan('combined'));
  }

  // Global rate limiting
  app.use(globalRateLimit);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/captures', captureRoutes);
  app.use('/api/v1/verify', verifyRoutes);
  app.use('/health', healthRoutes);

  // 404 handler
  app.use('*', (req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`
      }
    });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  // Initialize blockchain connection
  try {
    initBlockchain();
  } catch (error) {
    logger.error('Failed to initialize blockchain', { error });
    // Continue anyway — blockchain calls will fail at runtime
  }

  return app;
}
