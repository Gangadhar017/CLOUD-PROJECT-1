import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { fetchContest, setCurrentProblem, updateTimeRemaining } from '@/store/slices/contestSlice';
import { useWebSocket } from '@/hooks/useWebSocket';
import CodeEditor from '@/components/editor/CodeEditor';
import SubmissionPanel from '@/components/submission/SubmissionPanel';
import ProblemErrorBoundary from '@/components/error-boundaries/ProblemErrorBoundary';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Trophy, ChevronLeft } from 'lucide-react';

const ContestPage: React.FC = () => {
  const { contestId } = useParams<{ contestId: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { subscribeToContest, unsubscribeFromContest } = useWebSocket();
  
  const { currentContest, currentProblem, timeRemaining, loading, error } = useSelector(
    (state: RootState) => state.contest
  );
  const { code, language } = useSelector((state: RootState) => state.editor);

  useEffect(() => {
    if (contestId) {
      dispatch(fetchContest(contestId));
      subscribeToContest(contestId);
    }
    return () => {
      if (contestId) {
        unsubscribeFromContest(contestId);
      }
    };
  }, [contestId, dispatch, subscribeToContest, unsubscribeFromContest]);

  useEffect(() => {
    if (currentContest && !currentProblem && currentContest.problems.length > 0) {
      dispatch(setCurrentProblem(currentContest.problems[0].id));
    }
  }, [currentContest, currentProblem, dispatch]);

  useEffect(() => {
    if (!currentContest) return;
    
    const interval = setInterval(() => {
      const endTime = new Date(currentContest.endTime).getTime();
      const remaining = Math.max(0, endTime - Date.now());
      dispatch(updateTimeRemaining(remaining));
      
      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentContest, dispatch]);

  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !currentContest) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Contest</h2>
          <p className="text-muted-foreground">{error || 'Contest not found'}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded"
          >
            Back to Contests
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-card border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-muted rounded-lg"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold">{currentContest.name}</h1>
            <p className="text-sm text-muted-foreground">
              {currentContest.status === 'running' ? 'In Progress' : 
               currentContest.status === 'frozen' ? 'Scoreboard Frozen' : 
               currentContest.status === 'ended' ? 'Ended' : 'Upcoming'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4" />
            <span className={timeRemaining < 300000 ? 'text-destructive font-medium' : ''}>
              {formatTime(timeRemaining)}
            </span>
          </div>
          <button
            onClick={() => navigate(`/contest/${contestId}/leaderboard`)}
            className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg hover:bg-muted/80"
          >
            <Trophy className="w-4 h-4" />
            <span className="text-sm">Leaderboard</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 bg-card border-r flex flex-col">
          <div className="p-3 border-b">
            <h3 className="font-medium text-sm">Problems</h3>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {currentContest.problems.map((problem) => (
                <button
                  key={problem.id}
                  onClick={() => dispatch(setCurrentProblem(problem.id))}
                  className={`w-full text-left p-2 rounded-lg text-sm transition-colors ${
                    currentProblem?.id === problem.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{problem.title}</span>
                    <span className="text-xs opacity-70">{problem.points}pts</span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </aside>

        <main className="flex-1 flex">
          <div className="flex-1 flex flex-col min-w-0">
            <Tabs defaultValue="problem" className="flex-1 flex flex-col">
              <TabsList className="mx-4 mt-2">
                <TabsTrigger value="problem">Problem</TabsTrigger>
                <TabsTrigger value="submissions">Submissions</TabsTrigger>
              </TabsList>
              
              <TabsContent value="problem" className="flex-1 m-0 p-4 overflow-auto">
                <ProblemErrorBoundary>
                  {currentProblem ? (
                    <div className="max-w-3xl">
                      <h2 className="text-2xl font-bold mb-4">{currentProblem.title}</h2>
                      <div className="flex items-center gap-4 mb-6 text-sm">
                        <span className={`px-2 py-1 rounded ${
                          currentProblem.difficulty === 'easy' ? 'bg-green-500/10 text-green-600' :
                          currentProblem.difficulty === 'medium' ? 'bg-yellow-500/10 text-yellow-600' :
                          'bg-red-500/10 text-red-600'
                        }`}>
                          {currentProblem.difficulty.charAt(0).toUpperCase() + currentProblem.difficulty.slice(1)}
                        </span>
                        <span className="text-muted-foreground">{currentProblem.points} points</span>
                      </div>
                      <div className="prose dark:prose-invert max-w-none">
                        <p>Problem statement would be loaded here...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      Select a problem to view
                    </div>
                  )}
                </ProblemErrorBoundary>
              </TabsContent>
              
              <TabsContent value="submissions" className="flex-1 m-0 p-4">
                {contestId && currentProblem && (
                  <SubmissionPanel
                    contestId={contestId}
                    problemId={currentProblem.id}
                    code={code}
                    language={language}
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div className="w-1/2 min-w-[500px] border-l bg-card">
            {contestId && currentProblem && (
              <CodeEditor
                contestId={contestId}
                problemId={currentProblem.id}
                height="100%"
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ContestPage;
