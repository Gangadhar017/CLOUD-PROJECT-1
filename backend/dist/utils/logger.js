import winston from 'winston';
const { combine, timestamp, json, errors } = winston.format;
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: {
        service: 'codecontest-backend',
        environment: process.env.NODE_ENV || 'development',
    },
    format: combine(timestamp(), errors({ stack: true }), json()),
    transports: [
        new winston.transports.Console({
            format: process.env.NODE_ENV === 'development'
                ? winston.format.combine(winston.format.colorize(), winston.format.simple())
                : undefined,
        }),
    ],
});
if (process.env.NODE_ENV === 'production') {
    logger.add(new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
    }));
    logger.add(new winston.transports.File({
        filename: 'logs/combined.log',
    }));
}
export const auditLog = ({ userId, action, entityType, entityId, oldValue, newValue, ipAddress, userAgent, }) => {
    logger.info('AUDIT_LOG', {
        userId,
        action,
        entityType,
        entityId,
        oldValue: oldValue ? JSON.stringify(oldValue) : undefined,
        newValue: newValue ? JSON.stringify(newValue) : undefined,
        ipAddress,
        userAgent,
        timestamp: new Date().toISOString(),
    });
};
//# sourceMappingURL=logger.js.map