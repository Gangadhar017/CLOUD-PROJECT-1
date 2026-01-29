import cron from 'node-cron';
import { prisma } from '../utils/prisma.js';
import { deleteCache } from '../utils/redis.js';
import { logger } from '../utils/logger.js';
import { ContestStatus } from '@prisma/client';
import { io } from '../index.js';
export const startContestScheduler = () => {
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            const upcomingContests = await prisma.contest.findMany({
                where: {
                    status: ContestStatus.UPCOMING,
                    startTime: { lte: now },
                },
            });
            for (const contest of upcomingContests) {
                await prisma.contest.update({
                    where: { id: contest.id },
                    data: { status: ContestStatus.RUNNING },
                });
                deleteCache(`contest:${contest.id}`);
                deleteCache('contests:list');
                io.to(`contest:${contest.id}`).emit('contest_started', { contestId: contest.id });
                logger.info(`Contest ${contest.id} started`);
            }
            const runningContests = await prisma.contest.findMany({
                where: {
                    status: ContestStatus.RUNNING,
                    freezeTime: { lte: now },
                    endTime: { gt: now },
                },
            });
            for (const contest of runningContests) {
                await prisma.contest.update({
                    where: { id: contest.id },
                    data: { status: ContestStatus.FROZEN },
                });
                deleteCache(`contest:${contest.id}`);
                deleteCache(`leaderboard:${contest.id}`);
                io.to(`contest:${contest.id}`).emit('contest_frozen', { contestId: contest.id });
                logger.info(`Contest ${contest.id} frozen`);
            }
            const frozenContests = await prisma.contest.findMany({
                where: {
                    status: ContestStatus.FROZEN,
                    endTime: { lte: now },
                },
            });
            for (const contest of frozenContests) {
                await prisma.contest.update({
                    where: { id: contest.id },
                    data: { status: ContestStatus.ENDED },
                });
                deleteCache(`contest:${contest.id}`);
                deleteCache('contests:list');
                io.to(`contest:${contest.id}`).emit('contest_ended', { contestId: contest.id });
                logger.info(`Contest ${contest.id} ended`);
            }
            const runningToEnd = await prisma.contest.findMany({
                where: {
                    status: ContestStatus.RUNNING,
                    endTime: { lte: now },
                },
            });
            for (const contest of runningToEnd) {
                await prisma.contest.update({
                    where: { id: contest.id },
                    data: { status: ContestStatus.ENDED },
                });
                deleteCache(`contest:${contest.id}`);
                deleteCache('contests:list');
                io.to(`contest:${contest.id}`).emit('contest_ended', { contestId: contest.id });
                logger.info(`Contest ${contest.id} ended`);
            }
        }
        catch (error) {
            logger.error('Contest scheduler error:', error);
        }
    });
    cron.schedule('0 */5 * * * *', async () => {
        try {
            const runningContests = await prisma.contest.findMany({
                where: {
                    status: { in: [ContestStatus.RUNNING, ContestStatus.FROZEN] },
                },
            });
            for (const contest of runningContests) {
                const submissions = await prisma.submission.findMany({
                    where: {
                        contestId: contest.id,
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
                const leaderboard = Array.from(userStats.values())
                    .sort((a, b) => {
                    if (a.solved !== b.solved)
                        return b.solved - a.solved;
                    return a.penalty - b.penalty;
                })
                    .map((entry, index) => ({ ...entry, rank: index + 1 }));
                await prisma.leaderboardSnapshot.create({
                    data: {
                        contestId: contest.id,
                        data: JSON.stringify(leaderboard),
                        isFinal: false,
                    },
                });
                logger.info(`Leaderboard snapshot created for contest ${contest.id}`);
            }
        }
        catch (error) {
            logger.error('Leaderboard snapshot error:', error);
        }
    });
    logger.info('Contest scheduler started');
};
//# sourceMappingURL=scheduler.js.map