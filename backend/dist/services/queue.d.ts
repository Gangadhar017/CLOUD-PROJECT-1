interface SubmissionJob {
    submissionId: string;
    language: string;
    code: string;
    problemId: string;
    timeLimit: number;
    memoryLimit: number;
}
export declare const queueSubmission: (job: SubmissionJob) => Promise<void>;
export declare const dequeueSubmission: () => Promise<SubmissionJob | null>;
export declare const markSubmissionComplete: (submissionId: string) => Promise<void>;
export declare const markSubmissionFailed: (submissionId: string, error: string) => Promise<void>;
export declare const getQueueStats: () => Promise<{
    queued: number;
    processing: number;
    deadLetter: number;
}>;
export declare const requeueDeadLetter: () => Promise<number>;
export {};
//# sourceMappingURL=queue.d.ts.map