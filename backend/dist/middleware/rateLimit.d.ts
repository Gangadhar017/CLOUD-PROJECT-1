import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    keyPrefix: string;
}
export declare const rateLimitMiddleware: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const checkIdempotency: (idempotencyKey: string, userId: string) => Promise<boolean>;
export declare const createIdempotencyKey: (contestId: string, problemId: string, userId: string, codeHash: string) => string;
export declare const slidingWindowRateLimit: (config: RateLimitConfig) => (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export {};
//# sourceMappingURL=rateLimit.d.ts.map