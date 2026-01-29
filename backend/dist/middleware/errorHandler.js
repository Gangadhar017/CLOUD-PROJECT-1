import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger.js';
export class AppError extends Error {
    statusCode;
    message;
    isOperational;
    constructor(statusCode, message, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
export const errorHandler = (err, req, res, next) => {
    if (err instanceof AppError) {
        logger.warn('Operational error:', {
            statusCode: err.statusCode,
            message: err.message,
            path: req.path,
            method: req.method,
        });
        return res.status(err.statusCode).json({
            error: err.message,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
        });
    }
    if (err instanceof ZodError) {
        logger.warn('Validation error:', {
            errors: err.errors,
            path: req.path,
            method: req.method,
        });
        return res.status(400).json({
            error: 'Validation error',
            details: err.errors.map(e => ({
                path: e.path.join('.'),
                message: e.message,
            })),
        });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error('Database error:', {
            code: err.code,
            message: err.message,
            path: req.path,
            method: req.method,
        });
        if (err.code === 'P2002') {
            return res.status(409).json({
                error: 'Resource already exists',
            });
        }
        if (err.code === 'P2025') {
            return res.status(404).json({
                error: 'Resource not found',
            });
        }
        return res.status(500).json({
            error: 'Database error',
        });
    }
    if (err instanceof Prisma.PrismaClientValidationError) {
        logger.error('Prisma validation error:', {
            message: err.message,
            path: req.path,
            method: req.method,
        });
        return res.status(400).json({
            error: 'Invalid data provided',
        });
    }
    logger.error('Unexpected error:', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
    });
    return res.status(500).json({
        error: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};
//# sourceMappingURL=errorHandler.js.map