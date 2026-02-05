import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Editor from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import { AppDispatch, RootState } from '@/store';
import {
  setCode,
  setLanguage,
  markSaved,
  restoreCode,
  SupportedLanguage,
  loadEditorState,
  saveEditorState,
} from '@/store/slices/editorSlice';
import { useToast } from '@/hooks/use-toast';
import EditorErrorBoundary from '../error-boundaries/EditorErrorBoundary';

interface CodeEditorProps {
  contestId: string;
  problemId: string;
  height?: string;
}

const languageMap: Record<SupportedLanguage, string> = {
  cpp: 'cpp',
  java: 'java',
  python: 'python',
  javascript: 'javascript',
  go: 'go',
  rust: 'rust',
};

const CodeEditor: React.FC<CodeEditorProps> = ({
  contestId,
  problemId,
  height = '600px',
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { toast } = useToast();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const autosaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { code, language, theme, fontSize, tabSize, wordWrap, minimap, autosave } = useSelector(
    (state: RootState) => state.editor
  );
  
  const [isLoading, setIsLoading] = useState(true);
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    const loadSavedCode = async () => {
      try {
        const savedCode = await loadEditorState(contestId, problemId, language);
        if (savedCode) {
          dispatch(restoreCode(savedCode));
          toast({
            title: 'Code Restored',
            description: 'Your previous code has been loaded.',
          });
        }
      } catch (error) {
        console.error('Failed to load saved code:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSavedCode();
  }, [contestId, problemId, language, dispatch, toast]);

  useEffect(() => {
    if (autosave && !isLoading) {
      autosaveIntervalRef.current = setInterval(async () => {
        try {
          await saveEditorState(contestId, problemId, language, code);
          dispatch(markSaved());
    } catch (error) {
      console.error('Autosave failed:', error);
    }
      }, 30000);
    }

    return () => {
      if (autosaveIntervalRef.current) {
        clearInterval(autosaveIntervalRef.current);
      }
    };
  }, [autosave, code, contestId, problemId, language, dispatch, isLoading]);

  const handleEditorDidMount = useCallback((editor: editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    monaco.editor.defineTheme('vs-dark-custom', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.lineHighlightBackground': '#2d2d2d',
      },
    });

    editor.focus();
  }, []);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      dispatch(setCode(value));
    }
  }, [dispatch]);

  const handleLanguageChange = useCallback((newLanguage: SupportedLanguage) => {
    dispatch(setLanguage(newLanguage));
  }, [dispatch]);

  const handleManualSave = useCallback(async () => {
    try {
      await saveEditorState(contestId, problemId, language, code);
      dispatch(markSaved());
      toast({
        title: 'Code Saved',
        description: 'Your code has been saved locally.',
      });
    } catch (error) {
      console.error('Manual save failed:', error);
      toast({
        title: 'Save Failed',
        description: 'Failed to save code. Please try again.',
        variant: 'destructive',
      });
    }
  }, [code, contestId, problemId, language, dispatch, toast]);

  const handleEditorReset = useCallback(() => {
    setEditorKey(prev => prev + 1);
  }, []);

  const editorOptions: editor.IStandaloneEditorConstructionOptions = {
    fontSize,
    tabSize,
    wordWrap: wordWrap ? 'on' : 'off',
    minimap: { enabled: minimap },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    formatOnPaste: true,
    formatOnType: true,
    autoIndent: 'full',
    folding: true,
    foldingStrategy: 'indentation',
    showFoldingControls: 'always',
    unfoldOnClickAfterEndOfLine: false,
    lineNumbers: 'on',
    renderLineHighlight: 'all',
    bracketPairColorization: { enabled: true },
    guides: {
      bracketPairs: true,
      indentation: true,
    },
    quickSuggestions: true,
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'on',
    snippetSuggestions: 'top',
    wordBasedSuggestions: 'currentDocument',
    parameterHints: { enabled: true },
    hover: { enabled: true },
    contextmenu: true,
    mouseWheelZoom: false,
    smoothScrolling: true,
    cursorBlinking: 'blink',
    cursorSmoothCaretAnimation: 'on',
    selectionHighlight: true,
    occurrencesHighlight: 'singleFile',
    codeLens: true,
    colorDecorators: true,
    lightbulb: { enabled: editor.ShowLightbulbIconMode.On },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-muted rounded-lg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <EditorErrorBoundary onReset={handleEditorReset}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-2 bg-muted rounded-t-lg">
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
            className="px-3 py-1 bg-background border rounded text-sm"
          >
            <option value="cpp">C++ (GNU++17)</option>
            <option value="java">Java 17</option>
            <option value="python">Python 3.11</option>
            <option value="javascript">Node.js 20</option>
            <option value="go">Go 1.22</option>
            <option value="rust">Rust 1.78</option>
          </select>
          <button
            onClick={handleManualSave}
            className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90"
          >
            Save (Ctrl+S)
          </button>
        </div>
        <div className="flex-1 rounded-b-lg overflow-hidden">
          <Editor
            key={editorKey}
            height={height}
            language={languageMap[language]}
            value={code}
            theme={theme === 'vs-dark' ? 'vs-dark-custom' : 'light'}
            options={editorOptions}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            loading={
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            }
          />
        </div>
      </div>
    </EditorErrorBoundary>
  );
};

export default CodeEditor;
