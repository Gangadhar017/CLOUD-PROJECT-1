import { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { AppDispatch, RootState } from '@/store';
import {
  setSocket,
  setConnected,
  setAuthenticated,
  subscribeContest,
  unsubscribeContest,
  updateLastPing,
  incrementReconnectAttempts,
  resetReconnectAttempts,
} from '@/store/slices/websocketSlice';
import { updateSubmissionStatus } from '@/store/slices/submissionSlice';
import { updateLeaderboardEntry, setLeaderboardFrozen } from '@/store/slices/contestSlice';

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

export const useWebSocket = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { accessToken } = useSelector((state: RootState) => state.auth);
  const { socket, connected, authenticated, reconnectAttempts } = useSelector(
    (state: RootState) => state.websocket
  );
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    if (socket?.connected || !accessToken) return;

    const rawWsBaseUrl = import.meta.env.VITE_WS_BASE_URL as string | undefined;
    const wsBaseUrl = rawWsBaseUrl?.endsWith('/') ? rawWsBaseUrl.slice(0, -1) : rawWsBaseUrl;
    const socketUrl = wsBaseUrl ?? '/ws';
    const socketOptions = wsBaseUrl
      ? { path: '/ws' }
      : undefined;

    const newSocket = io(socketUrl, {
      transports: ['websocket'],
      auth: { token: accessToken },
      reconnection: false,
      ...(socketOptions ?? {}),
    });

    newSocket.on('connect', () => {
      dispatch(setConnected(true));
      dispatch(resetReconnectAttempts());
      
      newSocket.emit('authenticate', { token: accessToken });
    });

    newSocket.on('disconnect', (reason) => {
      dispatch(setConnected(false));
      dispatch(setAuthenticated(false));
      
      if (reason !== 'io client disconnect' && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectTimeoutRef.current = setTimeout(() => {
          dispatch(incrementReconnectAttempts());
          connectRef.current();
        }, RECONNECT_DELAY * Math.pow(2, reconnectAttempts));
      }
    });

    newSocket.on('authenticated', () => {
      dispatch(setAuthenticated(true));
    });

    newSocket.on('auth_error', (error) => {
      dispatch(setAuthenticated(false));
      console.error('WebSocket auth error:', error);
    });

    newSocket.on('submission_update', (data) => {
      dispatch(updateSubmissionStatus(data));
    });

    newSocket.on('leaderboard_update', (data) => {
      dispatch(updateLeaderboardEntry(data));
    });

    newSocket.on('contest_frozen', () => {
      dispatch(setLeaderboardFrozen(true));
    });

    newSocket.on('contest_ended', () => {
      dispatch(setLeaderboardFrozen(false));
    });

    newSocket.on('ping', () => {
      dispatch(updateLastPing());
      newSocket.emit('pong');
    });

    dispatch(setSocket(newSocket));
  }, [accessToken, dispatch, reconnectAttempts, socket]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (socket) {
      socket.disconnect();
      dispatch(setSocket(null));
      dispatch(setConnected(false));
      dispatch(setAuthenticated(false));
    }
  }, [socket, dispatch]);

  const subscribeToContest = useCallback(
    (contestId: string) => {
      if (socket && authenticated) {
        socket.emit('subscribe_contest', { contestId });
        dispatch(subscribeContest(contestId));
      }
    },
    [socket, authenticated, dispatch]
  );

  const unsubscribeFromContest = useCallback(
    (contestId: string) => {
      if (socket && authenticated) {
        socket.emit('unsubscribe_contest', { contestId });
        dispatch(unsubscribeContest(contestId));
      }
    },
    [socket, authenticated, dispatch]
  );

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connected,
    authenticated,
    reconnectAttempts,
    connect,
    disconnect,
    subscribeToContest,
    unsubscribeFromContest,
  };
};

export default useWebSocket;
