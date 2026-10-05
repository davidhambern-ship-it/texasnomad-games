import React from 'react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[TNG recovery boundary] render crash', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-[#05030b] px-5 text-white">
        <div className="w-full max-w-xl rounded-2xl border border-[#BC13FE]/40 bg-black/60 p-7 text-center shadow-[0_0_60px_rgba(188,19,254,.16)]">
          <div className="text-[9px] font-bold uppercase tracking-[.28em] text-[#FFD700]">
            TNG Recovery Mode
          </div>
          <h1 className="mt-4 text-3xl font-semibold">This screen hit a problem.</h1>
          <p className="mt-3 text-sm leading-6 text-white/55">
            TNG stopped the broken screen instead of letting it take down the rest of the app.
            Reload this screen first; if the problem continues, return Home and reopen the game.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl border border-[#FFD700]/60 bg-[#FFD700]/10 px-4 py-3 text-sm font-semibold text-[#FFD700]"
            >
              RELOAD SCREEN
            </button>
            <button
              type="button"
              onClick={() => window.location.replace('/')}
              className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/75"
            >
              RETURN HOME
            </button>
          </div>
        </div>
      </div>
    );
  }
}
