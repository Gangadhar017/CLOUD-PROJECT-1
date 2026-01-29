export declare const redis: any;
export declare const getCache: <T>(key: string) => Promise<T | null>;
export declare const setCache: <T>(key: string, value: T, ttlSeconds?: number) => Promise<void>;
export declare const deleteCache: (key: string) => Promise<void>;
export declare const incrementRateLimit: (key: string, windowSeconds: number) => Promise<number>;
export declare const getRateLimit: (key: string) => Promise<number>;
//# sourceMappingURL=redis.d.ts.map