import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from './store';
import { refreshAccessToken } from './store/slices/authSlice';
import GlobalErrorBoundary from './components/error-boundaries/GlobalErrorBoundary';
import { useWebSocket } from './hooks/useWebSocket';
import { Toaster } from '@/components/ui/sonner';

import LoginPage from './pages/LoginPage';
import ContestListPage from './pages/ContestListPage';
import ContestPage from './pages/ContestPage';
import LeaderboardPage from './pages/LeaderboardPage';
import AdminPage from './pages/AdminPage';
import NotFoundPage from './pages/NotFoundPage';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  return isAuthenticated && user?.role === 'admin' ? (
    <>{children}</>
  ) : (
    <Navigate to="/" replace />
  );
};

const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, expiresAt } = useSelector((state: RootState) => state.auth);
  const { connect, disconnect } = useWebSocket();

  useEffect(() => {
    if (isAuthenticated && expiresAt) {
      const timeUntilExpiry = expiresAt - Date.now();
      if (timeUntilExpiry < 60000) {
        dispatch(refreshAccessToken());
      }
    }
  }, [isAuthenticated, expiresAt, dispatch]);

  useEffect(() => {
    if (isAuthenticated) {
      connect();
    } else {
      disconnect();
    }
  }, [isAuthenticated, connect, disconnect]);

  return (
    <GlobalErrorBoundary>
      <div className="min-h-screen bg-background">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <ContestListPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/contest/:contestId"
            element={
              <PrivateRoute>
                <ContestPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/contest/:contestId/leaderboard"
            element={
              <PrivateRoute>
                <LeaderboardPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster />
      </div>
    </GlobalErrorBoundary>
  );
};

export default App;
