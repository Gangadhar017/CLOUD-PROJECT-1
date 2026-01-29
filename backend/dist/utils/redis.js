import Redis from 'ioredis';
import { logger } from './logger.js';
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
export const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy: (times) => {
        if (times > 10) {
            logger.error('Redis connection failed after 10 retries');
            return null;
        }
        return Math.min(times * 100, 3000);
    },
});
redis.on('connect', () => {
    logger.info('Redis connected');
});
redis.on('error', (error) => {
    logger.error('Redis error:', error);
});
redis.on('reconnecting', () => {
    logger.warn('Redis reconnecting...');
});
export const getCache = async (key) => {
    try {
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
    }
    catch (error) {
        logger.error('Cache get error:', error);
        return null;
    }
};
export const setCache = async (key, value, ttlSeconds) => {
    try {
        const data = JSON.stringify(value);
        if (ttlSeconds) {
            await redis.setex(key, ttlSeconds, data);
        }
        else {
            await redis.set(key, data);
        }
    }
    catch (error) {
        logger.error('Cache set error:', error);
    }
};
export const deleteCache = async (key) => {
    try {
        await redis.del(key);
    }
    catch (error) {
        logger.error('Cache delete error:', error);
    }
};
export const incrementRateLimit = async (key, windowSeconds) => {
    try {
        const multi = redis.multi();
        multi.incr(key);
        multi.expire(key, windowSeconds);
        const results = await multi.exec();
        return results?.[0]?.[1] || 0;
    }
    catch (error) {
        logger.error('Rate limit increment error:', error);
        return 0;
    }
};
export const getRateLimit = async (key) => {
    try {
        const count = await redis.get(key);
        return count ? parseInt(count, 10) : 0;
    }
    catch (error) {
        logger.error('Rate limit get error:', error);
        return 0;
    }
};
//# sourceMappingURL=redis.js.map