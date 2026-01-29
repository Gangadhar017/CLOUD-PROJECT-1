import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import localforage from 'localforage';

localforage.config({
  name: 'CodeContestPlatform',
  storeName: 'editor_state',
});

export type SupportedLanguage = 'cpp' | 'java' | 'python' | 'javascript' | 'go' | 'rust';

interface EditorState {
  code: string;
  language: SupportedLanguage;
  theme: 'vs-dark' | 'light';
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  autosave: boolean;
  lastSaved: number | null;
  isDirty: boolean;
}

const defaultCode: Record<SupportedLanguage, string> = {
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    \n    return 0;\n}',
  java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        \n    }\n}',
  python: 'import sys\n\ndef main():\n    pass\n\nif __name__ == "__main__":\n    main()',
  javascript: 'const readline = require("readline");\n\nconst rl = readline.createInterface({\n    input: process.stdin,\n    output: process.stdout\n});\n\nrl.on("line", (line) => {\n    \n});',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n    \n}',
  rust: 'use std::io;\n\nfn main() {\n    \n}',
};

const initialState: EditorState = {
  code: defaultCode.cpp,
  language: 'cpp',
  theme: 'vs-dark',
  fontSize: 14,
  tabSize: 4,
  wordWrap: true,
  minimap: true,
  autosave: true,
  lastSaved: null,
  isDirty: false,
};

const getStorageKey = (contestId: string, problemId: string, language: SupportedLanguage) =>
  `editor:${contestId}:${problemId}:${language}`;

export const loadEditorState = async (
  contestId: string,
  problemId: string,
  language: SupportedLanguage
): Promise<string | null> => {
  const key = getStorageKey(contestId, problemId, language);
  return await localforage.getItem<string>(key);
};

export const saveEditorState = async (
  contestId: string,
  problemId: string,
  language: SupportedLanguage,
  code: string
): Promise<void> => {
  const key = getStorageKey(contestId, problemId, language);
  await localforage.setItem(key, code);
};

export const clearEditorState = async (
  contestId: string,
  problemId: string,
  language: SupportedLanguage
): Promise<void> => {
  const key = getStorageKey(contestId, problemId, language);
  await localforage.removeItem(key);
};

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    setCode: (state, action: PayloadAction<string>) => {
      state.code = action.payload;
      state.isDirty = true;
    },
    setLanguage: (state, action: PayloadAction<SupportedLanguage>) => {
      state.language = action.payload;
      state.code = defaultCode[action.payload];
      state.isDirty = false;
    },
    setTheme: (state, action: PayloadAction<'vs-dark' | 'light'>) => {
      state.theme = action.payload;
    },
    setFontSize: (state, action: PayloadAction<number>) => {
      state.fontSize = action.payload;
    },
    setTabSize: (state, action: PayloadAction<number>) => {
      state.tabSize = action.payload;
    },
    setWordWrap: (state, action: PayloadAction<boolean>) => {
      state.wordWrap = action.payload;
    },
    setMinimap: (state, action: PayloadAction<boolean>) => {
      state.minimap = action.payload;
    },
    setAutosave: (state, action: PayloadAction<boolean>) => {
      state.autosave = action.payload;
    },
    markSaved: (state) => {
      state.lastSaved = Date.now();
      state.isDirty = false;
    },
    restoreCode: (state, action: PayloadAction<string>) => {
      state.code = action.payload;
      state.isDirty = false;
    },
    resetEditor: (state) => {
      state.code = defaultCode[state.language];
      state.isDirty = false;
    },
  },
});

export const {
  setCode,
  setLanguage,
  setTheme,
  setFontSize,
  setTabSize,
  setWordWrap,
  setMinimap,
  setAutosave,
  markSaved,
  restoreCode,
  resetEditor,
} = editorSlice.actions;

export default editorSlice.reducer;
