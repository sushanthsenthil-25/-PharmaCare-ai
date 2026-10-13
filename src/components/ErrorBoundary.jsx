import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[PharmaCare ErrorBoundary] Caught render error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
          <div className="p-6 max-w-sm w-full rounded-2xl bg-surface-container-lowest border border-outline-variant/20 shadow-xl flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px]">error</span>
            </div>
            <h2 className="font-headline-sm text-base font-bold text-primary">
              Something went wrong
            </h2>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              An unexpected error occurred while rendering this view. Please try reloading the page.
            </p>
            <div className="flex gap-2 w-full mt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                Reload Page
              </button>
              <a
                href="/"
                className="px-4 py-2.5 rounded-xl bg-surface-container-low text-primary text-xs font-bold hover:bg-surface-container transition-all flex items-center justify-center"
              >
                Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
