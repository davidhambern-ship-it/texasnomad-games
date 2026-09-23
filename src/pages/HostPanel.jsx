import React from 'react';

const LazyPreviewHostPanel = React.lazy(() => import('@/pages/PreviewHostPanel'));

class HostPanelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[TNG Host Panel crash]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-red-500/40 bg-red-500/5 p-6">
            <div className="text-red-400 text-sm font-bold tracking-widest uppercase mb-3">
              HOST CONTROLLER CRASH
            </div>
            <div className="text-white/80 text-sm break-words">
              {this.state.error?.message || String(this.state.error)}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-lg border border-[#BC13FE] px-4 py-2 text-[#BC13FE]"
            >
              RELOAD HOST PANEL
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function HostPanel() {
  return (
    <HostPanelErrorBoundary>
      <React.Suspense
        fallback={
          <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
            <div className="text-[#BC13FE] text-sm tracking-widest uppercase">
              LOADING HOST CONTROLLER…
            </div>
          </div>
        }
      >
        <LazyPreviewHostPanel />
      </React.Suspense>
    </HostPanelErrorBoundary>
  );
}
