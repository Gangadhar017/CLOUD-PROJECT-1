import React, { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import {
  submitSolution,
  pollSubmissionStatus,
} from '@/store/slices/submissionSlice';
import { setSubmitCooldown } from '@/store/slices/submissionSlice';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import SubmissionErrorBoundary from '../error-boundaries/SubmissionErrorBoundary';
import { SupportedLanguage } from '@/store/slices/editorSlice';

interface SubmissionPanelProps {
  contestId: string;
  problemId: string;
  code: string;
  language: SupportedLanguage;
}

const verdictIcons: Record<string, React.ReactNode> = {
  pending: <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />,
  compiling: <Loader2 className="w-4 h-4 animate-spin text-blue-500" />,
  running: <Loader2 className="w-4 h-4 animate-spin text-blue-500" />,
  verifying: <Loader2 className="w-4 h-4 animate-spin text-purple-500" />,
  accepted: <CheckCircle className="w-4 h-4 text-green-500" />,
  wrong_answer: <XCircle className="w-4 h-4 text-red-500" />,
  time_limit_exceeded: <Clock className="w-4 h-4 text-orange-500" />,
  memory_limit_exceeded: <AlertTriangle className="w-4 h-4 text-orange-500" />,
  runtime_error: <AlertTriangle className="w-4 h-4 text-red-500" />,
  compilation_error: <XCircle className="w-4 h-4 text-red-500" />,
  system_error: <AlertTriangle className="w-4 h-4 text-gray-500" />,
};

const verdictClasses: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  compiling: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  running: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  verifying: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  accepted: 'bg-green-500/10 text-green-600 border-green-500/20',
  wrong_answer: 'bg-red-500/10 text-red-600 border-red-500/20',
  time_limit_exceeded: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  memory_limit_exceeded: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  runtime_error: 'bg-red-500/10 text-red-600 border-red-500/20',
  compilation_error: 'bg-red-500/10 text-red-600 border-red-500/20',
  system_error: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
};

const SubmissionPanel: React.FC<SubmissionPanelProps> = ({
  contestId,
  problemId,
  code,
  language,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { toast } = useToast();
  
  const {
    submissions,
    currentSubmission,
    loading,
    submitCooldown,
    pendingVerifications,
  } = useSelector((state: RootState) => state.submission);

  const problemSubmissions = submissions.filter(
    (s) => s.contestId === contestId && s.problemId === problemId
  );

  useEffect(() => {
    if (submitCooldown > 0) {
      const interval = setInterval(() => {
        dispatch(setSubmitCooldown(Math.max(0, submitCooldown - 1000)));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [submitCooldown, dispatch]);

  useEffect(() => {
    const pollInterval = setInterval(() => {
      pendingVerifications.forEach((submissionId) => {
        dispatch(pollSubmissionStatus(submissionId));
      });
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [pendingVerifications, dispatch]);

  const generateIdempotencyKey = useCallback(() => {
    return `${contestId}:${problemId}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
  }, [contestId, problemId]);

  const handleSubmit = useCallback(async () => {
    if (submitCooldown > 0) {
      toast({
        title: 'Submission Cooldown',
        description: `Please wait ${Math.ceil(submitCooldown / 1000)} seconds before submitting again.`,
        variant: 'destructive',
      });
      return;
    }

    if (code.trim().length < 10) {
      toast({
        title: 'Code Too Short',
        description: 'Your solution appears to be incomplete.',
        variant: 'destructive',
      });
      return;
    }

    const idempotencyKey = generateIdempotencyKey();
    
    try {
      const result = await dispatch(
        submitSolution({
          contestId,
          problemId,
          language,
          code,
          idempotencyKey,
        })
      );

      if (submitSolution.fulfilled.match(result)) {
        toast({
          title: 'Submission Sent',
          description: 'Your solution is being evaluated.',
        });
      } else if (submitSolution.rejected.match(result)) {
        toast({
          title: 'Submission Failed',
          description: result.payload as string,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: 'Submission Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    }
  }, [code, contestId, problemId, language, submitCooldown, dispatch, toast, generateIdempotencyKey]);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString();
  };

  const formatVerdict = (verdict: string) => {
    return verdict.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <SubmissionErrorBoundary>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-3 bg-muted rounded-t-lg">
          <h3 className="font-semibold">Submissions</h3>
          <button
            onClick={handleSubmit}
            disabled={loading || submitCooldown > 0}
            className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting...
              </>
            ) : submitCooldown > 0 ? (
              <>
                <Clock className="w-4 h-4" />
                Wait {Math.ceil(submitCooldown / 1000)}s
              </>
            ) : (
              'Submit Solution'
            )}
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-2">
          {problemSubmissions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No submissions yet. Submit your first solution!
            </div>
          ) : (
            problemSubmissions.map((submission) => (
              <div
                key={submission.id}
                className={`p-3 rounded-lg border ${verdictClasses[submission.verdict]} ${
                  currentSubmission?.id === submission.id ? 'ring-2 ring-primary' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {verdictIcons[submission.verdict]}
                    <span className="font-medium">{formatVerdict(submission.verdict)}</span>
                  </div>
                  <span className="text-xs opacity-70">{formatTime(submission.submittedAt)}</span>
                </div>
                
                {(submission.verdict === 'accepted' || 
                  submission.verdict === 'wrong_answer' ||
                  submission.verdict === 'time_limit_exceeded' ||
                  submission.verdict === 'memory_limit_exceeded' ||
                  submission.verdict === 'runtime_error') && (
                  <div className="mt-2 text-sm grid grid-cols-3 gap-2">
                    {submission.executionTime !== null && (
                      <div>
                        <span className="opacity-70">Time:</span>{' '}
                        <span className="font-mono">{submission.executionTime}ms</span>
                      </div>
                    )}
                    {submission.memoryUsed !== null && (
                      <div>
                        <span className="opacity-70">Memory:</span>{' '}
                        <span className="font-mono">{(submission.memoryUsed / 1024 / 1024).toFixed(2)}MB</span>
                      </div>
                    )}
                    <div>
                      <span className="opacity-70">Tests:</span>{' '}
                      <span className="font-mono">
                        {submission.testCasesPassed}/{submission.totalTestCases}
                      </span>
                    </div>
                  </div>
                )}
                
                {submission.verdict === 'pending' || submission.verdict === 'verifying' ? (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Verifying on server...</span>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </SubmissionErrorBoundary>
  );
};

export default SubmissionPanel;
