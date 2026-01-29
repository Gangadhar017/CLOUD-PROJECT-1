import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../utils/prisma.js';
import { logger, auditLog } from '../utils/logger.js';
import { AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { checkIdempotency } from '../middleware/rateLimit.js';
import { queueSubmission } from '../services/queue.js';
import { io } from '../index.js';

const router = Router();

const SubmitSchema = z.object({
  contestId: z.string().uuid(),
  problemId: z.string().uuid(),
  language: z.enum(['cpp', 'java', 'python', 'javascript', 'go', 'rust']),
  code: z.string().min(1).max(100000),
  idempotencyKey: z.string(),
});

const hashCode = (code: string): string => {
  return crypto.createHash('sha256').update(code).digest('hex');
};

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = SubmitSchema.parse(req.body);
    const userId = req.user!.id;

    const contest = await prisma.contest.findUnique({
      where: { id: data.contestId },
    });

    if (!contest) {
      throw new AppError(404, 'Contest not found');
    }

    const now = new Date();
    if (now < contest.startTime || now > contest.endTime) {
      throw new AppError(400, 'Contest is not active');
    }

    const problem = await prisma.problem.findUnique({
      where: { id: data.problemId },
    });

    if (!problem || problem.contestId !== data.contestId) {
      throw new AppError(404, 'Problem not found');
    }

    const codeHash = hashCode(data.code);
    const isDuplicate = await checkIdempotency(data.idempotencyKey, userId);
    
    if (isDuplicate) {
      const existingSubmission = await prisma.submission.findFirst({
        where: {
          userId,
          idempotencyKey: data.idempotencyKey,
        },
      });

      if (existingSubmission) {
        return res.status(409).json({
          error: 'Duplicate submission',
          submissionId: existingSubmission.id,
        });
      }
    }

    const recentSubmission = await prisma.submission.findFirst({
      where: {
        userId,
        problemId: data.problemId,
        codeHash,
        submittedAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000),
        },
      },
    });

    if (recentSubmission) {
      return res.status(409).json({
        error: 'Identical code submitted recently',
        submissionId: recentSubmission.id,
      });
    }

    const submission = await prisma.submission.create({
      data: {
        contestId: data.contestId,
        problemId: data.problemId,
        userId,
        language: data.language,
        code: data.code,
        codeHash,
        verdict: 'PENDING',
        idempotencyKey: data.idempotencyKey,
      },
    });

    await prisma.verdictHistory.create({
      data: {
        submissionId: submission.id,
        oldVerdict: 'PENDING',
        newVerdict: 'PENDING',
        reason: 'Submission created',
      },
    });

    await queueSubmission({
      submissionId: submission.id,
      language: data.language,
      code: data.code,
      problemId: data.problemId,
      timeLimit: problem.timeLimit,
      memoryLimit: problem.memoryLimit,
    });

    auditLog({
      userId,
      action: 'SUBMIT_SOLUTION',
      entityType: 'submission',
      entityId: submission.id,
      newValue: {
        contestId: data.contestId,
        problemId: data.problemId,
        language: data.language,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(201).json(submission);
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        problem: { select: { title: true, points: true } },
        contest: { select: { name: true } },
      },
    });

    if (!submission) {
      throw new AppError(404, 'Submission not found');
    }

    if (submission.userId !== userId && req.user?.role !== 'ADMIN') {
      throw new AppError(403, 'Access denied');
    }

    return res.json(submission);
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const submission = await prisma.submission.findUnique({
      where: { id },
      select: {
        id: true,
        verdict: true,
        score: true,
        executionTime: true,
        memoryUsed: true,
        testCasesPassed: true,
        totalTestCases: true,
        completedAt: true,
        userId: true,
      },
    });

    if (!submission) {
      throw new AppError(404, 'Submission not found');
    }

    if (submission.userId !== userId && req.user?.role !== 'ADMIN') {
      throw new AppError(403, 'Access denied');
    }

    res.json(submission);
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { contestId, problemId, limit = '20', offset = '0' } = req.query;

    const where: any = { userId };

    if (contestId) where.contestId = contestId;
    if (problemId) where.problemId = problemId;

    const submissions = await prisma.submission.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      include: {
        problem: { select: { title: true } },
        contest: { select: { name: true } },
      },
    });

    return res.json(submissions);
  } catch (error) {
    return next(error);
  }
});

export const updateSubmissionVerdict = async (
  submissionId: string,
  verdict: string,
  data: {
    score?: number;
    executionTime?: number;
    memoryUsed?: number;
    testCasesPassed?: number;
    totalTestCases?: number;
    runnerId?: string;
    runnerSignature?: string;
  }
) => {
  try {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      logger.error(`Submission ${submissionId} not found for verdict update`);
      return;
    }

    const oldVerdict = submission.verdict;

    const updated = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        verdict: verdict as any,
        score: data.score ?? submission.score,
        executionTime: data.executionTime,
        memoryUsed: data.memoryUsed,
        testCasesPassed: data.testCasesPassed ?? submission.testCasesPassed,
        totalTestCases: data.totalTestCases ?? submission.totalTestCases,
        runnerId: data.runnerId,
        runnerSignature: data.runnerSignature,
        completedAt: new Date(),
      },
    });

    await prisma.verdictHistory.create({
      data: {
        submissionId,
        oldVerdict,
        newVerdict: verdict as any,
        reason: 'Runner evaluation completed',
      },
    });

    io.to(`contest:${submission.contestId}`).emit('submission_update', {
      submissionId,
      verdict,
      score: data.score,
      executionTime: data.executionTime,
      memoryUsed: data.memoryUsed,
      testCasesPassed: data.testCasesPassed,
      totalTestCases: data.totalTestCases,
    });

    logger.info(`Submission ${submissionId} verdict updated: ${oldVerdict} -> ${verdict}`);

    return updated;
  } catch (error) {
    logger.error('Failed to update submission verdict:', error);
    throw error;
  }
};

export default router;
