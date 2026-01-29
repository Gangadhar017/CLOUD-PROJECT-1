import winston from 'winston';
export declare const logger: winston.Logger;
export declare const auditLog: ({ userId, action, entityType, entityId, oldValue, newValue, ipAddress, userAgent, }: {
    userId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    oldValue?: any;
    newValue?: any;
    ipAddress?: string;
    userAgent?: string;
}) => void;
//# sourceMappingURL=logger.d.ts.map