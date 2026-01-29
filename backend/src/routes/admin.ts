import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { redis } from '../utils/redis.js';
import { auditLog } from '../utils/logger.js';
import { AuthRequest, requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

router.use(requireRole(['ADMIN']));

const CreateUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['USER', 'ADMIN', 'CONTESTANT']).default('USER'),
});

router.get('/users', async (req: AuthRequest, res, next) => {
  try {
    const { search, role, limit = '50', offset = '0' } = req.query;

    const where: any = {};
    
    if (search) {
      where.OR = [
        { username: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    
    if (role) where.role = role;

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: { submissions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    res.json(users);
  } catch (error) {
    next(error);
  }
});

router.post('/users', async (req: AuthRequest, res, next) => {
  try {
    const data = CreateUserSchema.parse(req.body);
    const userId = req.user!.id;

    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        passwordHash,
        role: data.role,
      },
    });

    auditLog({
      userId,
      action: 'CREATE_USER',
      entityType: 'user',
      entityId: user.id,
      newValue: { username: user.username, email: user.email, role: user.role },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/stats', async (req: AuthRequest, res, next) => {
  void req;
  try {
    const [
      totalUsers,
      totalContests,
      totalSubmissions,
      activeContests,
      pendingSubmissions,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.contest.count(),
      prisma.submission.count(),
      prisma.contest.count({
        where: {
          startTime: { lte: new Date() },
          endTime: { gte: new Date() },
        },
      }),
      prisma.submission.count({
        where: {
          verdict: { in: ['PENDING', 'COMPILING', 'RUNNING', 'VERIFYING'] },
        },
      }),
    ]);

    const submissionsByVerdict = await prisma.submission.groupBy({
      by: ['verdict'],
      _count: { verdict: true },
    });

    const recentSubmissions = await prisma.submission.findMany({
      take: 10,
      orderBy: { submittedAt: 'desc' },
      include: {
        user: { select: { username: true } },
        problem: { select: { title: true } },
        contest: { select: { name: true } },
      },
    });

    res.json({
      totalUsers,
      totalContests,
      totalSubmissions,
      activeContests,
      pendingSubmissions,
      submissionsByVerdict,
      recentSubmissions,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/audit-logs', async (req: AuthRequest, res, next) => {
  try {
    const { userId, action, limit = '100', offset = '0' } = req.query;

    const where: any = {};
    
    if (userId) where.userId = userId as string;
    if (action) where.action = action as string;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      include: {
        user: { select: { username: true } },
      },
    });

    res.json(logs);
  } catch (error) {
    next(error);
  }
});

router.post('/clear-cache', async (req: AuthRequest, res, next) => {
  try {
    const keys = await redis.keys('*');
    
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    auditLog({
      userId: req.user!.id,
      action: 'CLEAR_CACHE',
      entityType: 'system',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ message: 'Cache cleared', keysDeleted: keys.length });
  } catch (error) {
    next(error);
  }
});

router.post('/contests/:id/finalize', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const contest = await prisma.contest.findUnique({
      where: { id },
      include: { problems: true },
    });

    if (!contest) {
      throw new AppError(404, 'Contest not found');
    }

    if (contest.status !== 'ENDED') {
      throw new AppError(400, 'Contest must be ended before finalizing');
    }

    const existingSnapshot = await prisma.leaderboardSnapshot.findFirst({
      where: { contestId: id, isFinal: true },
    });

    if (existingSnapshot) {
      throw new AppError(400, 'Contest already finalized');
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

    await prisma.leaderboardSnapshot.create({
      data: {
        contestId: id,
        data: JSON.stringify(leaderboard),
        isFinal: true,
      },
    });

    auditLog({
      userId,
      action: 'FINALIZE_CONTEST',
      entityType: 'contest',
      entityId: id,
      newValue: { leaderboard },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ message: 'Contest finalized', leaderboard });
  } catch (error) {
    next(error);
  }
});

export default router;
