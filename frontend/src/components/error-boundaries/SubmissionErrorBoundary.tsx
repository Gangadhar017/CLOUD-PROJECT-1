import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ClipboardX, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class SubmissionErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error });
    
    fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        component: 'SubmissionPanel',
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      }),
    }).catch(() => {});
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <ClipboardX className="w-12 h-12 text-blue-500 mb-4" />
          <h3 className="text-lg font-semibold text-blue-600 mb-2">
            Submission Panel Error
          </h3>
          <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
            Unable to display submissions. Your submission history is safe.
          </p>
          <Button onClick={this.handleReset} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reload Submissions
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default SubmissionErrorBoundary;
