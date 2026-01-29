import { redis } from '../utils/redis.js';
import { logger } from '../utils/logger.js';
const QUEUE_KEY = 'submission:queue';
const PROCESSING_KEY = 'submission:processing';
const DEAD_LETTER_KEY = 'submission:dead-letter';
export const queueSubmission = async (job) => {
    try {
        const jobData = JSON.stringify({
            ...job,
            enqueuedAt: Date.now(),
            attempts: 0,
        });
        await redis.lpush(QUEUE_KEY, jobData);
        logger.info(`Submission ${job.submissionId} queued`);
    }
    catch (error) {
        logger.error('Failed to queue submission:', error);
        throw error;
    }
};
export const dequeueSubmission = async () => {
    try {
        const result = await redis.brpop(QUEUE_KEY, 5);
        if (!result)
            return null;
        const jobData = JSON.parse(result[1]);
        await redis.hset(PROCESSING_KEY, jobData.submissionId, JSON.stringify({
            ...jobData,
            startedAt: Date.now(),
        }));
        return jobData;
    }
    catch (error) {
        logger.error('Failed to dequeue submission:', error);
        return null;
    }
};
export const markSubmissionComplete = async (submissionId) => {
    try {
        await redis.hdel(PROCESSING_KEY, submissionId);
    }
    catch (error) {
        logger.error('Failed to mark submission complete:', error);
    }
};
export const markSubmissionFailed = async (submissionId, error) => {
    try {
        await redis.hdel(PROCESSING_KEY, submissionId);
        await redis.lpush(DEAD_LETTER_KEY, JSON.stringify({
            submissionId,
            error,
            failedAt: Date.now(),
        }));
    }
    catch (err) {
        logger.error('Failed to mark submission failed:', err);
    }
};
export const getQueueStats = async () => {
    try {
        const [queued, processing, deadLetter] = await Promise.all([
            redis.llen(QUEUE_KEY),
            redis.hlen(PROCESSING_KEY),
            redis.llen(DEAD_LETTER_KEY),
        ]);
        return {
            queued,
            processing,
            deadLetter,
        };
    }
    catch (error) {
        logger.error('Failed to get queue stats:', error);
        return { queued: 0, processing: 0, deadLetter: 0 };
    }
};
export const requeueDeadLetter = async () => {
    try {
        const jobs = [];
        let job;
        while ((job = await redis.rpop(DEAD_LETTER_KEY))) {
            const jobData = JSON.parse(job);
            if (jobData.attempts < 3) {
                jobs.push(JSON.stringify({
                    ...jobData,
                    attempts: jobData.attempts + 1,
                    requeuedAt: Date.now(),
                }));
            }
        }
        if (jobs.length > 0) {
            await redis.lpush(QUEUE_KEY, ...jobs);
        }
        return jobs.length;
    }
    catch (error) {
        logger.error('Failed to requeue dead letter:', error);
        return 0;
    }
};
//# sourceMappingURL=queue.js.map