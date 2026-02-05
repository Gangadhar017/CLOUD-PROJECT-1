import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { z } from 'zod';
import { SupportedLanguage } from './editorSlice';
import { apiUrl } from '@/lib/api';

export const VerdictSchema = z.enum([
  'pending',
  'compiling',
  'running',
  'accepted',
  'wrong_answer',
  'time_limit_exceeded',
  'memory_limit_exceeded',
  'runtime_error',
  'compilation_error',
  'system_error',
  'verifying',
]);

const SubmissionSchema = z.object({
  id: z.string(),
  contestId: z.string(),
  problemId: z.string(),
  userId: z.string(),
  language: z.string(),
  code: z.string(),
  verdict: VerdictSchema,
  score: z.number(),
  executionTime: z.number().nullable(),
  memoryUsed: z.number().nullable(),
  testCasesPassed: z.number(),
  totalTestCases: z.number(),
  submittedAt: z.string(),
  completedAt: z.string().nullable(),
  idempotencyKey: z.string(),
});

interface SubmissionState {
  submissions: z.infer<typeof SubmissionSchema>[];
  currentSubmission: z.infer<typeof SubmissionSchema> | null;
  loading: boolean;
  error: string | null;
  submitCooldown: number;
  lastSubmitTime: number;
  pendingVerifications: Set<string>;
}

export type { SubmissionState };

const initialState: SubmissionState = {
  submissions: [],
  currentSubmission: null,
  loading: false,
  error: null,
  submitCooldown: 0,
  lastSubmitTime: 0,
  pendingVerifications: new Set(),
};

const SUBMIT_COOLDOWN_MS = 5000;

export const submitSolution = createAsyncThunk(
  'submission/submit',
  async (
    payload: {
      contestId: string;
      problemId: string;
      language: SupportedLanguage;
      code: string;
      idempotencyKey: string;
    },
    { getState, rejectWithValue }
  ) => {
    const state = getState() as { submission: SubmissionState };
    const now = Date.now();
    
    if (now - state.submission.lastSubmitTime < SUBMIT_COOLDOWN_MS) {
      return rejectWithValue('Submission cooldown active');
    }

    try {
      const response = await fetch(apiUrl('/api/submissions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': payload.idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 429) {
        return rejectWithValue('Rate limit exceeded');
      }
      if (response.status === 409) {
        return rejectWithValue('Duplicate submission');
      }
      if (!response.ok) throw new Error('Submission failed');

      const data = await response.json();
      return SubmissionSchema.parse(data);
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Submission failed');
    }
  }
);

export const fetchSubmission = createAsyncThunk(
  'submission/fetch',
  async (submissionId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(apiUrl(`/api/submissions/${submissionId}`));
      if (!response.ok) throw new Error('Failed to fetch submission');
      const data = await response.json();
      return SubmissionSchema.parse(data);
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Fetch failed');
    }
  }
);

export const pollSubmissionStatus = createAsyncThunk(
  'submission/poll',
  async (submissionId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(apiUrl(`/api/submissions/${submissionId}/status`));
      if (!response.ok) throw new Error('Failed to poll submission');
      const data = await response.json();
      return SubmissionSchema.parse(data);
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Poll failed');
    }
  }
);

const submissionSlice = createSlice({
  name: 'submission',
  initialState,
  reducers: {
    updateSubmissionStatus: (state, action: PayloadAction<z.infer<typeof SubmissionSchema>>) => {
      const index = state.submissions.findIndex(s => s.id === action.payload.id);
      if (index >= 0) {
        state.submissions[index] = action.payload;
      }
      if (state.currentSubmission?.id === action.payload.id) {
        state.currentSubmission = action.payload;
      }
      if (action.payload.verdict !== 'pending' && action.payload.verdict !== 'verifying') {
        state.pendingVerifications.delete(action.payload.id);
      }
    },
    addPendingVerification: (state, action: PayloadAction<string>) => {
      state.pendingVerifications.add(action.payload);
    },
    setSubmitCooldown: (state, action: PayloadAction<number>) => {
      state.submitCooldown = action.payload;
    },
    clearSubmissionError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitSolution.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(submitSolution.fulfilled, (state, action) => {
        state.loading = false;
        state.submissions.unshift(action.payload);
        state.currentSubmission = action.payload;
        state.lastSubmitTime = Date.now();
        state.submitCooldown = SUBMIT_COOLDOWN_MS;
        if (action.payload.verdict === 'pending' || action.payload.verdict === 'verifying') {
          state.pendingVerifications.add(action.payload.id);
        }
      })
      .addCase(submitSolution.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchSubmission.fulfilled, (state, action) => {
        const index = state.submissions.findIndex(s => s.id === action.payload.id);
        if (index >= 0) {
          state.submissions[index] = action.payload;
        } else {
          state.submissions.push(action.payload);
        }
      })
      .addCase(pollSubmissionStatus.fulfilled, (state, action) => {
        const index = state.submissions.findIndex(s => s.id === action.payload.id);
        if (index >= 0) {
          state.submissions[index] = action.payload;
        }
        if (state.currentSubmission?.id === action.payload.id) {
          state.currentSubmission = action.payload;
        }
        if (action.payload.verdict !== 'pending' && action.payload.verdict !== 'verifying') {
          state.pendingVerifications.delete(action.payload.id);
        }
      });
  },
});

export const {
  updateSubmissionStatus,
  addPendingVerification,
  setSubmitCooldown,
  clearSubmissionError,
} = submissionSlice.actions;

export default submissionSlice.reducer;
