import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { fetchLeaderboard } from '@/store/slices/contestSlice';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, Trophy, Lock, AlertTriangle } from 'lucide-react';

const LeaderboardPage: React.FC = () => {
  const { contestId } = useParams<{ contestId: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  
  const { currentContest, leaderboard, leaderboardFrozen } = useSelector(
    (state: RootState) => state.contest
  );

  useEffect(() => {
    if (contestId) {
      dispatch(fetchLeaderboard(contestId));
    }
  }, [contestId, dispatch]);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{currentContest?.name} - Leaderboard</h1>
              <p className="text-sm text-muted-foreground">
                {leaderboardFrozen ? 'Scoreboard is frozen' : 'Live standings'}
              </p>
            </div>
          </div>
          <Trophy className="w-6 h-6 text-yellow-500" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {leaderboardFrozen && (
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-3">
            <Lock className="w-5 h-5 text-blue-500" />
            <div>
              <p className="font-medium text-blue-600">Scoreboard Frozen</p>
              <p className="text-sm text-blue-600/70">
                The leaderboard is hidden during the final phase of the contest.
              </p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Standings</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <table className="w-full">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Rank</th>
                    <th className="text-left py-3 px-4 font-medium">User</th>
                    <th className="text-center py-3 px-4 font-medium">Solved</th>
                    <th className="text-center py-3 px-4 font-medium">Penalty</th>
                    {currentContest?.problems.map((problem) => (
                      <th key={problem.id} className="text-center py-3 px-2 font-medium text-xs">
                        {problem.title.substring(0, 10)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={5 + (currentContest?.problems.length || 0)} className="py-12 text-center text-muted-foreground">
                        {leaderboardFrozen ? (
                          <div className="flex flex-col items-center gap-2">
                            <Lock className="w-8 h-8" />
                            <p>Leaderboard is frozen</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <AlertTriangle className="w-8 h-8" />
                            <p>No standings available yet</p>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    leaderboard.map((entry) => (
                      <tr key={entry.userId} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-mono">{entry.rank}</td>
                        <td className="py-3 px-4 font-medium">{entry.username}</td>
                        <td className="py-3 px-4 text-center font-mono">{entry.solved}</td>
                        <td className="py-3 px-4 text-center font-mono">{entry.penalty}</td>
                        {currentContest?.problems.map((problem) => {
                          const stats = entry.problemStats?.[problem.id];
                          return (
                            <td key={problem.id} className="py-3 px-2 text-center">
                              {stats?.solved ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 bg-green-500 text-white text-xs rounded-full">
                                  +
                                </span>
                              ) : stats?.attempts > 0 ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 bg-red-500 text-white text-xs rounded-full">
                                  -{stats.attempts}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default LeaderboardPage;
