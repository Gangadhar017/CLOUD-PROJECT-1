import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
    log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
    ],
});
prisma.$on('query', (e) => {
    logger.debug('Prisma Query:', {
        query: e.query,
        params: e.params,
        duration: e.duration,
    });
});
prisma.$on('error', (e) => {
    logger.error('Prisma Error:', e.message);
});
if (process.env.NODE_ENV !== 'production')
    globalForPrisma.prisma = prisma;
//# sourceMappingURL=prisma.js.map