import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { getCache, setCache, deleteCache } from '../utils/redis.js';
import { auditLog } from '../utils/logger.js';
import { AuthRequest, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { ContestStatus } from '@prisma/client';

const router = Router();

const CreateContestSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  freezeTime: z.string().datetime().optional(),
  isPublic: z.boolean().default(true),
});

const CreateProblemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  points: z.number().int().positive(),
  timeLimit: z.number().int().positive().default(1000),
  memoryLimit: z.number().int().positive().default(256),
  testCases: z.array(z.object({
    input: z.string(),
    output: z.string(),
    isSample: z.boolean().default(false),
  })),
});

router.get('/', async (req: AuthRequest, res, next) => {
  void req; // Mark as used
  try {
    const cacheKey = 'contests:list';
    const cached = await getCache(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const contests = await prisma.contest.findMany({
      where: { isPublic: true },
      include: {
        problems: {
          select: { id: true, title: true, difficulty: true, points: true, order: true },
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { registrations: true },
        },
      },
      orderBy: { startTime: 'desc' },
    });

    const result = contests.map(contest => ({
      ...contest,
      participantCount: contest._count.registrations,
      _count: undefined,
    }));

    await setCache(cacheKey, result, 60);

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const cacheKey = `contest:${id}`;
    const cached = await getCache(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const contest = await prisma.contest.findUnique({
      where: { id },
      include: {
        problems: {
          select: { id: true, title: true, difficulty: true, points: true, order: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!contest) {
      throw new AppError(404, 'Contest not found');
    }

    if (!contest.isPublic) {
      const registration = await prisma.contestRegistration.findUnique({
        where: { contestId_userId: { contestId: id, userId: userId! } },
      });
      
      if (!registration && req.user?.role !== 'ADMIN') {
        throw new AppError(403, 'Access denied');
      }
    }

    const now = new Date();
    let status = contest.status;
    
    if (now < contest.startTime) {
      status = ContestStatus.UPCOMING;
    } else if (now >= contest.startTime && now < contest.endTime) {
      if (contest.freezeTime && now >= contest.freezeTime) {
        status = ContestStatus.FROZEN;
      } else {
        status = ContestStatus.RUNNING;
      }
    } else {
      status = ContestStatus.ENDED;
    }

    const result = { ...contest, status };
    await setCache(cacheKey, result, 30);

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/leaderboard', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const contest = await prisma.contest.findUnique({
      where: { id },
      include: { problems: true },
    });

    if (!contest) {
      throw new AppError(404, 'Contest not found');
    }

    const now = new Date();
    const isFrozen = contest.freezeTime && now >= contest.freezeTime && now < contest.endTime;

    if (isFrozen && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Leaderboard is frozen', frozen: true });
    }

    const cacheKey = `leaderboard:${id}`;
    const cached = await getCache(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const finalSnapshot = await prisma.leaderboardSnapshot.findFirst({
      where: { contestId: id, isFinal: true },
    });

    if (finalSnapshot) {
      return res.json(JSON.parse(finalSnapshot.data));
    }

    const submissions = await prisma.submission.findMany({
      where: {
        contestId: id,
        verdict: 'ACCEPTED',
      },
      include: {
        user: { select: { id: true, username: true } },
        problem: { select: { id: true, points: true } },
      },
      orderBy: { submittedAt: 'asc' },
    });

    const userStats = new Map();

    for (const submission of submissions) {
      const key = submission.userId;
      
      if (!userStats.has(key)) {
        userStats.set(key, {
          userId: submission.userId,
          username: submission.user.username,
          solved: 0,
          penalty: 0,
          problemStats: {},
        });
      }

      const stats = userStats.get(key);
      const problemId = submission.problemId;

      if (!stats.problemStats[problemId]) {
        stats.problemStats[problemId] = {
          attempts: 0,
          solved: false,
          solveTime: null,
          points: 0,
        };
      }

      const problemStat = stats.problemStats[problemId];
      
      if (!problemStat.solved) {
        problemStat.solved = true;
        problemStat.solveTime = submission.submittedAt;
        problemStat.points = submission.problem.points;
        stats.solved += 1;
        
        const contestStart = new Date(contest.startTime).getTime();
        const solveTime = new Date(submission.submittedAt).getTime();
        const minutes = Math.floor((solveTime - contestStart) / 60000);
        stats.penalty += minutes + problemStat.attempts * 20;
      }
    }

    const allSubmissions = await prisma.submission.findMany({
      where: { contestId: id },
      select: { userId: true, problemId: true, verdict: true },
    });

    for (const submission of allSubmissions) {
      const key = submission.userId;
      
      if (!userStats.has(key)) {
        const user = await prisma.user.findUnique({
          where: { id: submission.userId },
          select: { id: true, username: true },
        });
        
        if (user) {
          userStats.set(key, {
            userId: user.id,
            username: user.username,
            solved: 0,
            penalty: 0,
            problemStats: {},
          });
        }
      }

      const stats = userStats.get(key);
      if (stats) {
        const problemId = submission.problemId;
        
        if (!stats.problemStats[problemId]) {
          stats.problemStats[problemId] = {
            attempts: 0,
            solved: false,
            solveTime: null,
            points: 0,
          };
        }

        if (!stats.problemStats[problemId].solved) {
          stats.problemStats[problemId].attempts += 1;
        }
      }
    }

    const leaderboard = Array.from(userStats.values())
      .sort((a, b) => {
        if (a.solved !== b.solved) return b.solved - a.solved;
        return a.penalty - b.penalty;
      })
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    if (!isFrozen && contest.status !== ContestStatus.ENDED) {
      await setCache(cacheKey, leaderboard, 30);
    }

    return res.json(leaderboard);
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireRole(['ADMIN']), async (req: AuthRequest, res, next) => {
  try {
    const data = CreateContestSchema.parse(req.body);
    const userId = req.user!.id;

    const contest = await prisma.contest.create({
      data: {
        ...data,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        freezeTime: data.freezeTime ? new Date(data.freezeTime) : null,
        createdBy: userId,
      },
    });

    await deleteCache('contests:list');

    auditLog({
      userId,
      action: 'CREATE_CONTEST',
      entityType: 'contest',
      entityId: contest.id,
      newValue: contest,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(201).json(contest);
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/problems', requireRole(['ADMIN']), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const data = CreateProblemSchema.parse(req.body);
    const userId = req.user!.id;

    const contest = await prisma.contest.findUnique({
      where: { id },
    });

    if (!contest) {
      throw new AppError(404, 'Contest not found');
    }

    const maxOrder = await prisma.problem.aggregate({
      where: { contestId: id },
      _max: { order: true },
    });

    const problem = await prisma.problem.create({
      data: {
        contestId: id,
        title: data.title,
        description: data.description,
        difficulty: data.difficulty,
        points: data.points,
        timeLimit: data.timeLimit,
        memoryLimit: data.memoryLimit,
        order: (maxOrder._max.order || 0) + 1,
        testCases: {
          create: data.testCases.map((tc, idx) => ({
            input: tc.input,
            output: tc.output,
            isSample: tc.isSample,
            order: idx,
          })),
        },
      },
      include: { testCases: true },
    });

    await deleteCache(`contest:${id}`);
    await deleteCache('contests:list');

    auditLog({
      userId,
      action: 'CREATE_PROBLEM',
      entityType: 'problem',
      entityId: problem.id,
      newValue: problem,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(201).json(problem);
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/register', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const contest = await prisma.contest.findUnique({
      where: { id },
    });

    if (!contest) {
      throw new AppError(404, 'Contest not found');
    }

    if (contest.status !== ContestStatus.UPCOMING && contest.status !== ContestStatus.RUNNING) {
      throw new AppError(400, 'Registration closed');
    }

    const registration = await prisma.contestRegistration.upsert({
      where: { contestId_userId: { contestId: id, userId } },
      update: {},
      create: {
        contestId: id,
        userId,
        ipAddress: req.ip,
      },
    });

    auditLog({
      userId,
      action: 'REGISTER_CONTEST',
      entityType: 'contest_registration',
      entityId: registration.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ message: 'Registered successfully', registration });
  } catch (error) {
    next(error);
  }
});

export default router;
