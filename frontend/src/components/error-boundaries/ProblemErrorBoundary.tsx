import React, { Component, ErrorInfo, ReactNode } from 'react';
import { FileQuestion, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ProblemErrorBoundary extends Component<Props, State> {
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
        component: 'ProblemView',
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
        <div className="flex flex-col items-center justify-center h-full p-6 bg-amber-500/10 rounded-lg border border-amber-500/20">
          <FileQuestion className="w-12 h-12 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold text-amber-600 mb-2">
            Problem View Error
          </h3>
          <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
            Unable to display problem statement. Please try again.
          </p>
          <Button onClick={this.handleReset} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reload Problem
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ProblemErrorBoundary;
