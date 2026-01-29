import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import contestReducer from './slices/contestSlice';
import submissionReducer from './slices/submissionSlice';
import editorReducer from './slices/editorSlice';
import websocketReducer from './slices/websocketSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    contest: contestReducer,
    submission: submissionReducer,
    editor: editorReducer,
    websocket: websocketReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['websocket/setSocket'],
        ignoredPaths: ['websocket.socket'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
