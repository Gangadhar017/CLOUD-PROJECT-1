import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
export const setupWebSocket = (io) => {
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication required'));
            }
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded.type === 'refresh') {
                return next(new Error('Invalid token type'));
            }
            const user = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: { id: true, username: true, email: true, role: true, isActive: true },
            });
            if (!user || !user.isActive) {
                return next(new Error('User not found or inactive'));
            }
            socket.user = user;
            next();
        }
        catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                return next(new Error('Token expired'));
            }
            if (error instanceof jwt.JsonWebTokenError) {
                return next(new Error('Invalid token'));
            }
            logger.error('WebSocket auth error:', error);
            next(new Error('Authentication failed'));
        }
    });
    io.on('connection', (socket) => {
        logger.info(`WebSocket connected: ${socket.id}, user: ${socket.user?.username}`);
        socket.on('authenticate', (data) => {
            socket.emit('authenticated');
        });
        socket.on('subscribe_contest', async (data) => {
            try {
                const { contestId } = data;
                if (!contestId) {
                    socket.emit('error', { message: 'Contest ID required' });
                    return;
                }
                const contest = await prisma.contest.findUnique({
                    where: { id: contestId },
                });
                if (!contest) {
                    socket.emit('error', { message: 'Contest not found' });
                    return;
                }
                const registration = await prisma.contestRegistration.findUnique({
                    where: {
                        contestId_userId: {
                            contestId,
                            userId: socket.user.id,
                        },
                    },
                });
                if (!registration && socket.user.role !== 'ADMIN' && !contest.isPublic) {
                    socket.emit('error', { message: 'Access denied' });
                    return;
                }
                socket.join(`contest:${contestId}`);
                socket.emit('subscribed', { contestId });
                logger.info(`User ${socket.user?.username} subscribed to contest ${contestId}`);
            }
            catch (error) {
                logger.error('Subscribe contest error:', error);
                socket.emit('error', { message: 'Failed to subscribe' });
            }
        });
        socket.on('unsubscribe_contest', (data) => {
            const { contestId } = data;
            socket.leave(`contest:${contestId}`);
            socket.emit('unsubscribed', { contestId });
            logger.info(`User ${socket.user?.username} unsubscribed from contest ${contestId}`);
        });
        socket.on('pong', () => {
            socket.emit('ping');
        });
        socket.on('disconnect', (reason) => {
            logger.info(`WebSocket disconnected: ${socket.id}, reason: ${reason}`);
        });
        socket.on('error', (error) => {
            logger.error(`WebSocket error for ${socket.id}:`, error);
        });
    });
    setInterval(() => {
        io.emit('ping');
    }, 30000);
};
export const emitToContest = (io, contestId, event, data) => {
    io.to(`contest:${contestId}`).emit(event, data);
};
export const emitToUser = (io, userId, event, data) => {
    io.sockets.sockets.forEach((socket) => {
        if (socket.user?.id === userId) {
            socket.emit(event, data);
        }
    });
};
//# sourceMappingURL=websocket.js.map