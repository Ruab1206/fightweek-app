// ErrorBoundary — catches render-time crashes in a subtree and shows a
// recoverable fallback instead of taking the whole app to a black screen (#1190).
import React from 'react';

interface Props {
  children: React.ReactNode;
  isDark?: boolean;
  /** Short label for the area being guarded, shown in the fallback. */
  label?: string;
  /** Called when the user dismisses the failed subtree (e.g. close the admin area). */
  onClose?: () => void;
}

interface State {
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(err: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? ` ${this.props.label}` : ''}] Render crash:`, err, info);
  }

  render() {
    if (this.state.error) {
      const { isDark, label, onClose } = this.props;
      const bg = isDark ? 'bg-slate-950' : 'bg-surface-subtle';
      const txt = isDark ? 'text-slate-200' : 'text-ds-text';
      return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center ${bg} p-8`}>
          <div className={`text-center max-w-lg ${txt}`}>
            <p className="text-xl font-bold mb-2">⚠️ {label || 'Something went wrong'}</p>
            <p className="text-sm mb-4 opacity-70">An unexpected error occurred. Your data is safe.</p>
            <pre className={`text-xs text-left p-3 rounded-lg overflow-auto max-h-40 ${isDark ? 'bg-slate-900 text-red-300' : 'bg-red-50 text-red-700'}`}>
              {this.state.error.message}
            </pre>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button onClick={() => this.setState({ error: null })}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                Retry
              </button>
              {onClose && (
                <button onClick={() => { this.setState({ error: null }); onClose(); }}
                  className={`px-4 py-2 text-sm rounded-lg ${isDark ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-surface-hover text-ds-text hover:opacity-80'}`}>
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
