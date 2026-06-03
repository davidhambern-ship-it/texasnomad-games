import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

const SQUARE_BIZ_URL = 'https://media.base44.com/files/public/6a1faf9539e2c1e12925ead8/78526944c_Square-Biz-Game-App-v5-PDF-Trivia-Bank.html';

export default function SquareBizGame() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    fetch(SQUARE_BIZ_URL)
      .then(r => r.text())
      .then(html => {
        setHtmlContent(html);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleFullscreen = () => {
    const el = containerRef.current;
    if (!document.fullscreenElement) {
      el?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const handleRestart = () => {
    if (iframeRef.current) {
      iframeRef.current.srcdoc = htmlContent;
    }
  };

  const handleOpenRules = () => {
    if (iframeRef.current) {
      try {
        const iDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
        if (iDoc) {
          const rulesBtn = iDoc.querySelector('[data-screen="rules"], #rulesBtn, .rules-btn, [onclick*="rules"], [onclick*="Rules"]');
          if (rulesBtn) rulesBtn.click();
        }
      } catch (e) { /* cross-origin fallback */ }
    }
  };

  return (
    <div className="min-h-screen bg-[#05030b] text-white flex flex-col">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 border-b border-[#8a22ff]/30 bg-[#05030b]/90 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Left */}
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/" className="flex items-center gap-2 text-[#FFD700] hover:text-[#FF5F1F] transition-colors">
              <div className="w-8 h-8 rounded-full bg-[#8a22ff]/20 border border-[#FFD700] flex items-center justify-center">
                <span className="font-bold text-xs">TN</span>
              </div>
              <span className="hidden sm:block font-bold tracking-widest text-xs uppercase">TexasNomad</span>
            </Link>

            <span className="text-[#8a22ff]/50 hidden sm:block">|</span>

            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#ff2bd6] animate-pulse" />
              <div>
                <span
                  className="font-extrabold tracking-wider uppercase text-sm sm:text-base block leading-none"
                  style={{ fontFamily: "'Teko', sans-serif", letterSpacing: '0.12em', color: '#ff8a00', textShadow: '0 0 10px rgba(255,138,0,0.5)' }}
                >
                  Square Biz!
                </span>
                <span className="text-[#8a22ff] text-[10px] tracking-widest uppercase font-bold leading-none">
                  Trivia + Tactics
                </span>
              </div>
            </div>
          </div>

          {/* Right: buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border border-[#FFD700]/40 text-[#FFD700]/80 rounded text-xs font-bold tracking-widest uppercase hover:bg-[#FFD700]/10 hover:border-[#FFD700] transition-all"
            >
              ← LOBBY
            </Link>
            <button
              onClick={handleOpenRules}
              className="px-3 py-1.5 border border-[#00b8ff]/40 text-[#00b8ff]/80 rounded text-xs font-bold tracking-widest uppercase hover:bg-[#00b8ff]/10 hover:border-[#00b8ff] transition-all"
            >
              RULES
            </button>
            <button
              onClick={handleRestart}
              className="px-3 py-1.5 border border-[#8a22ff]/40 text-[#8a22ff]/80 rounded text-xs font-bold tracking-widest uppercase hover:bg-[#8a22ff]/10 hover:border-[#8a22ff] transition-all"
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
        <div className="text-5xl">🎯</div>
        <h2
          className="text-3xl uppercase font-extrabold"
          style={{ fontFamily: "'Teko', sans-serif", color: '#ff8a00', textShadow: '0 0 16px rgba(255,138,0,0.4)' }}
        >
          Bigger Screen Required!
        </h2>
        <p className="text-white/70 text-sm leading-relaxed max-w-xs">
          For the best Square Biz! experience, use a tablet, laptop, or desktop. The game board is designed for a larger screen.
        </p>
        <Link
          to="/"
          className="mt-4 px-6 py-2.5 border-2 border-[#FFD700] text-[#FFD700] font-bold tracking-widest uppercase text-sm rounded hover:bg-[#FFD700] hover:text-black transition-all"
        >
          ← Back to Lobby
        </Link>
      </div>

      {/* ── GAME FRAME ── */}
      <div
        ref={containerRef}
        className="hidden sm:flex flex-col flex-1 min-h-0"
        style={{ background: '#05030b' }}
      >
        <div style={{ height: '3px', background: 'linear-gradient(90deg, #8a22ff, #ff2bd6, #ff8a00, #00b8ff, #8a22ff)' }} />

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-[#8a22ff] border-t-transparent rounded-full animate-spin" />
              <span className="text-[#ff8a00] font-bold tracking-widest text-sm uppercase">Loading Square Biz!…</span>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            srcdoc={htmlContent}
            title="Square Biz! Trivia + Tactics"
            className="flex-1 w-full border-0"
            style={{ minHeight: 'calc(100vh - 3.5rem - 3px)', background: '#05030b' }}
            allow="microphone"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"
          />
        )}
      </div>
    </div>
  );
}