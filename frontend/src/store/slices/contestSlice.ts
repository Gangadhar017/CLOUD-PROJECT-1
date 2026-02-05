import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { z } from 'zod';
import { apiUrl } from '@/lib/api';

const ContestSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  freezeTime: z.string().nullable(),
  isPublic: z.boolean(),
  status: z.enum(['upcoming', 'running', 'frozen', 'ended']),
  problems: z.array(z.object({
    id: z.string(),
    title: z.string(),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    points: z.number(),
    order: z.number(),
  })),
});

const LeaderboardEntrySchema = z.object({
  rank: z.number(),
  userId: z.string(),
  username: z.string(),
  solved: z.number(),
  penalty: z.number(),
  problemStats: z.record(z.string(), z.object({
    attempts: z.number(),
    solved: z.boolean(),
    solveTime: z.string().nullable(),
    points: z.number(),
  })),
});

export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

interface ContestState {
  contests: z.infer<typeof ContestSchema>[];
  currentContest: z.infer<typeof ContestSchema> | null;
  currentProblem: z.infer<typeof ContestSchema>['problems'][0] | null;
  leaderboard: z.infer<typeof LeaderboardEntrySchema>[];
  leaderboardFrozen: boolean;
  loading: boolean;
  error: string | null;
  timeRemaining: number;
  isRegistered: boolean;
}

const initialState: ContestState = {
  contests: [],
  currentContest: null,
  currentProblem: null,
  leaderboard: [],
  leaderboardFrozen: false,
  loading: false,
  error: null,
  timeRemaining: 0,
  isRegistered: false,
};

export const fetchContests = createAsyncThunk(
  'contest/fetchContests',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch(apiUrl('/api/contests'));
      if (!response.ok) throw new Error('Failed to fetch contests');
      const data = await response.json();
      return z.array(ContestSchema).parse(data);
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Fetch failed');
    }
  }
);

export const fetchContest = createAsyncThunk(
  'contest/fetchContest',
  async (contestId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(apiUrl(`/api/contests/${contestId}`));
      if (!response.ok) throw new Error('Failed to fetch contest');
      const data = await response.json();
      return ContestSchema.parse(data);
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Fetch failed');
    }
  }
);

export const fetchLeaderboard = createAsyncThunk(
  'contest/fetchLeaderboard',
  async (contestId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(apiUrl(`/api/contests/${contestId}/leaderboard`));
      if (response.status === 403) {
        return { frozen: true, entries: [] };
      }
      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      const data = await response.json();
      return {
        frozen: false,
        entries: z.array(LeaderboardEntrySchema).parse(data),
      };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Fetch failed');
    }
  }
);

const contestSlice = createSlice({
  name: 'contest',
  initialState,
  reducers: {
    setCurrentProblem: (state, action: PayloadAction<string>) => {
      if (state.currentContest) {
        state.currentProblem = state.currentContest.problems.find(p => p.id === action.payload) || null;
      }
    },
    updateTimeRemaining: (state, action: PayloadAction<number>) => {
      state.timeRemaining = action.payload;
    },
    updateLeaderboardEntry: (state, action: PayloadAction<z.infer<typeof LeaderboardEntrySchema>>) => {
      const index = state.leaderboard.findIndex(e => e.userId === action.payload.userId);
      if (index >= 0) {
        state.leaderboard[index] = action.payload;
      } else {
        state.leaderboard.push(action.payload);
      }
      state.leaderboard.sort((a, b) => {
        if (a.solved !== b.solved) return b.solved - a.solved;
        return a.penalty - b.penalty;
      });
      state.leaderboard.forEach((entry, idx) => {
        entry.rank = idx + 1;
      });
    },
    setLeaderboardFrozen: (state, action: PayloadAction<boolean>) => {
      state.leaderboardFrozen = action.payload;
    },
    clearContestError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchContests.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchContests.fulfilled, (state, action) => {
        state.loading = false;
        state.contests = action.payload;
      })
      .addCase(fetchContests.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchContest.fulfilled, (state, action) => {
        state.currentContest = action.payload;
        state.leaderboardFrozen = action.payload.status === 'frozen';
      })
      .addCase(fetchLeaderboard.fulfilled, (state, action) => {
        state.leaderboardFrozen = action.payload.frozen;
        state.leaderboard = action.payload.entries;
      });
  },
});

export const {
  setCurrentProblem,
  updateTimeRemaining,
  updateLeaderboardEntry,
  setLeaderboardFrozen,
  clearContestError,
} = contestSlice.actions;

export default contestSlice.reducer;
