import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Socket } from 'socket.io-client';

interface WebSocketState {
  socket: Socket | null;
  connected: boolean;
  authenticated: boolean;
  subscribedContests: Set<string>;
  lastPing: number;
  reconnectAttempts: number;
}

const initialState: WebSocketState = {
  socket: null,
  connected: false,
  authenticated: false,
  subscribedContests: new Set(),
  lastPing: 0,
  reconnectAttempts: 0,
};

const websocketSlice = createSlice({
  name: 'websocket',
  initialState,
  reducers: {
    setSocket: (state, action: PayloadAction<Socket | null>) => {
      state.socket = action.payload as any;
    },
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.connected = action.payload;
    },
    setAuthenticated: (state, action: PayloadAction<boolean>) => {
      state.authenticated = action.payload;
    },
    subscribeContest: (state, action: PayloadAction<string>) => {
      state.subscribedContests.add(action.payload);
    },
    unsubscribeContest: (state, action: PayloadAction<string>) => {
      state.subscribedContests.delete(action.payload);
    },
    updateLastPing: (state) => {
      state.lastPing = Date.now();
    },
    incrementReconnectAttempts: (state) => {
      state.reconnectAttempts += 1;
    },
    resetReconnectAttempts: (state) => {
      state.reconnectAttempts = 0;
    },
    clearSubscriptions: (state) => {
      state.subscribedContests.clear();
    },
  },
});

export const {
  setSocket,
  setConnected,
  setAuthenticated,
  subscribeContest,
  unsubscribeContest,
  updateLastPing,
  incrementReconnectAttempts,
  resetReconnectAttempts,
  clearSubscriptions,
} = websocketSlice.actions;

export default websocketSlice.reducer;
