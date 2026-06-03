import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

const BFF_HTML_URL = 'https://media.base44.com/files/public/6a1faf9539e2c1e12925ead8/f87b881b3_BFF-GameBoard-v69-collapsible-control-panel.html';

export default function BFFGame() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef(null);
  const containerRef = useRef(null);

  const handleFullscreen = () => {
    const el = containerRef.current;
    if (!document.fullscreenElement) {
      el?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleRestart = () => {
    if (iframeRef.current) {
      iframeRef.current.src = BFF_HTML_URL;
    }
  };

  const handleHostControls = () => {
    if (iframeRef.current) {
      try {
        const iDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
        if (iDoc) {
          const btn = iDoc.getElementById('hostPanelToggleBtn');
          if (btn) btn.click();
        }
      } catch (e) {
        // cross-origin fallback — silently ignore
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      {/* ── PAGE HEADER ── */}
      <header className="sticky top-0 z-50 border-b border-[#BC13FE]/30 bg-[#050505]/90 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Left: logo + title */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/"
              className="flex items-center gap-2 text-[#FFD700] hover:text-[#FF5F1F] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#BC13FE]/20 border border-[#FFD700] flex items-center justify-center">
                <span className="font-bold text-xs">TN</span>
              </div>
              <span className="hidden sm:block font-bold tracking-widest text-xs uppercase">TexasNomad</span>
            </Link>

            <span className="text-[#BC13FE]/50 hidden sm:block">|</span>

            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#BC13FE] animate-pulse" />
              <span
                className="font-extrabold tracking-wider uppercase text-sm sm:text-base"
                style={{
                  fontFamily: "'Teko', sans-serif",
                  letterSpacing: '0.12em',
                  color: '#FFD700',
                  textShadow: '0 0 10px rgba(255,215,0,0.5)',
                }}
              >
                BFF — BIGO Family Feud
              </span>
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border border-[#FFD700]/40 text-[#FFD700]/80 rounded text-xs font-bold tracking-widest uppercase hover:bg-[#FFD700]/10 hover:border-[#FFD700] transition-all"
            >
              ← LOBBY
            </Link>
            <button
              onClick={handleHostControls}
              className="px-3 py-1.5 border border-[#22d3ee]/40 text-[#22d3ee]/80 rounded text-xs font-bold tracking-widest uppercase hover:bg-[#22d3ee]/10 hover:border-[#22d3ee] transition-all"
            >
              HOST
            </button>
            <button
              onClick={handleRestart}
              className="px-3 py-1.5 border border-[#BC13FE]/40 text-[#BC13FE]/80 rounded text-xs font-bold tracking-widest uppercase hover:bg-[#BC13FE]/10 hover:border-[#BC13FE] transition-all"
            >
              RESTART
            </button>
            <button
              onClick={handleFullscreen}
              className="px-3 py-1.5 bg-[#FF5F1F] border border-[#FF5F1F] text-white rounded text-xs font-bold tracking-widest uppercase hover:bg-[#FF5F1F]/80 transition-all"
            >
              {isFullscreen ? '✕ EXIT' : '⛶ FULL'}
            </button>
          </div>
        </div>
      </header>

      {/* ── MOBILE WARNING ── */}
      <div className="sm:hidden flex flex-col items-center justify-center flex-1 px-6 py-16 text-center gap-4">
        <div className="text-5xl">🎮</div>
        <h2
          className="text-3xl uppercase font-extrabold"
          style={{
            fontFamily: "'Teko', sans-serif",
            color: '#FFD700',
            textShadow: '0 0 16px rgba(255,215,0,0.4)',
          }}
        >
          Game On — Bigger Screen!
        </h2>
        <p className="text-white/70 text-sm leading-relaxed max-w-xs">
          For the best BFF experience, play on a tablet, laptop, or desktop. The game board is designed for a larger screen.
        </p>
        <Link
          to="/"
          className="mt-4 px-6 py-2.5 border-2 border-[#FFD700] text-[#FFD700] font-bold tracking-widest uppercase text-sm rounded hover:bg-[#FFD700] hover:text-black transition-all"
        >
          ← Back to Lobby
        </Link>
      </div>

      {/* ── GAME FRAME (desktop / tablet) ── */}
      <div
        ref={containerRef}
        className="hidden sm:flex flex-col flex-1 min-h-0"
        style={{ background: '#050505' }}
      >
        {/* Neon border accent strip */}
        <div
          style={{
            height: '3px',
            background: 'linear-gradient(90deg, #BC13FE, #FF5F1F, #FFD700, #BC13FE)',
            backgroundSize: '200% 100%',
          }}
        />

        {/* The iframe — fills all remaining space */}
        <iframe
          ref={iframeRef}
          src={BFF_HTML_URL}
          title="BFF — BIGO Family Feud Game Board"
          className="flex-1 w-full border-0"
          style={{
            minHeight: 'calc(100vh - 3.5rem - 3px)',
            background: '#080516',
          }}
          allow="microphone"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"
        />
      </div>
    </div>
  );
}