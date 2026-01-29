import { Response, NextFunction } from 'express';
import { redis, incrementRateLimit } from '../utils/redis.js';
import { logger } from '../utils/logger.js';
import { AuthRequest } from './auth.js';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

const SUBMISSION_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 5,
  keyPrefix: 'submit',
};

const IDEMPOTENCY_WINDOW_MS = 5 * 60 * 1000;

export const rateLimitMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const key = `${SUBMISSION_RATE_LIMIT.keyPrefix}:${userId}`;
    const count = await incrementRateLimit(key, SUBMISSION_RATE_LIMIT.windowMs / 1000);

    if (count > SUBMISSION_RATE_LIMIT.maxRequests) {
      logger.warn('Rate limit exceeded:', { userId, path: req.path });
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil(SUBMISSION_RATE_LIMIT.windowMs / 1000),
      });
      return;
    }

    res.setHeader('X-RateLimit-Limit', SUBMISSION_RATE_LIMIT.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, SUBMISSION_RATE_LIMIT.maxRequests - count));

    next();
  } catch (error) {
    logger.error('Rate limit middleware error:', error);
    next();
  }
};

export const checkIdempotency = async (
  idempotencyKey: string,
  userId: string
): Promise<boolean> => {
  const key = `idempotency:${userId}:${idempotencyKey}`;
  const exists = await redis.exists(key);
  
  if (exists) {
    return true;
  }
  
  await redis.setex(key, IDEMPOTENCY_WINDOW_MS / 1000, '1');
  return false;
};

export const createIdempotencyKey = (
  contestId: string,
  problemId: string,
  userId: string,
  codeHash: string
): string => {
  const data = `${contestId}:${problemId}:${userId}:${codeHash}:${Date.now()}`;
  return Buffer.from(data).toString('base64');
};

export const slidingWindowRateLimit = (
  config: RateLimitConfig
) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const identifier = req.user?.id || req.ip;
      const key = `${config.keyPrefix}:${identifier}`;
      
      const now = Date.now();
      const windowStart = now - config.windowMs;
      
      await redis.zremrangebyscore(key, 0, windowStart);
      const count = await redis.zcard(key);
      
      if (count >= config.maxRequests) {
        const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
        const retryAfter = Math.ceil((parseInt(oldest[1]) + config.windowMs - now) / 1000);
        
        res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter,
        });
        return;
      }
      
      await redis.zadd(key, now, `${now}-${Math.random()}`);
      await redis.pexpire(key, config.windowMs);
      
      res.setHeader('X-RateLimit-Limit', config.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - count - 1));
      
      next();
    } catch (error) {
      logger.error('Sliding window rate limit error:', error);
      next();
    }
  };
};
