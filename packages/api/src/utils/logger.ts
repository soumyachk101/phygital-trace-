import winston from 'winston';
import { env } from '../config/env';

const logLevel = env.NODE_ENV === 'development' ? 'debug' : env.LOG_LEVEL;

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'phygital-api' },
  transports: [
    new winston.transports.Console({
      format: env.NODE_ENV === 'development'
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        : undefined
    })
  ]
});
