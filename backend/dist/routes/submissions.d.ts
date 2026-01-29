declare const router: import("express-serve-static-core").Router;
export declare const updateSubmissionVerdict: (submissionId: string, verdict: string, data: {
    score?: number;
    executionTime?: number;
    memoryUsed?: number;
    testCasesPassed?: number;
    totalTestCases?: number;
    runnerId?: string;
    runnerSignature?: string;
}) => Promise<{
    userId: string;
    id: string;
    code: string;
    contestId: string;
    problemId: string;
    language: string;
    codeHash: string;
    verdict: import(".prisma/client").$Enums.Verdict;
    score: number;
    executionTime: number | null;
    memoryUsed: number | null;
    testCasesPassed: number;
    totalTestCases: number;
    idempotencyKey: string;
    runnerId: string | null;
    runnerSignature: string | null;
    submittedAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
} | undefined>;
export default router;
//# sourceMappingURL=submissions.d.ts.map