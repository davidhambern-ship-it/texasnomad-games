import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

const HANGMAN_URL = 'https://media.base44.com/files/public/6a1faf9539e2c1e12925ead8/3954f4d5d_TexasNomad-Hangman-Vercel-Ready-v3-Hidden-Setup-Host-Controls.html';

export default function HangmanGame() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    fetch(HANGMAN_URL)
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

  const handleHostControls = () => {
    if (iframeRef.current) {
      try {
        const iDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
        if (iDoc) {
          const btn = iDoc.querySelector('#hostMenuBtn, .host-menu-btn, [id*="host"], [class*="host-btn"]');
          if (btn) btn.click();
        }
      } catch (e) { /* cross-origin fallback */ }
    }
  };

  return (
    <div className="min-h-screen bg-[#070311] text-white flex flex-col">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 border-b border-[#8f37ff]/30 bg-[#070311]/90 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Left */}
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/" className="flex items-center gap-2 text-[#FFD700] hover:text-[#FF5F1F] transition-colors">
              <div className="w-8 h-8 rounded-full bg-[#8f37ff]/20 border border-[#FFD700] flex items-center justify-center">
                <span className="font-bold text-xs">TN</span>
              </div>
              <span className="hidden sm:block font-bold tracking-widest text-xs uppercase">TexasNomad</span>
            </Link>

            <span className="text-[#8f37ff]/50 hidden sm:block">|</span>

            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#19d7ff] animate-pulse" />
              <div>
                <span
                  className="font-extrabold tracking-wider uppercase text-sm sm:text-base block leading-none"
                  style={{ fontFamily: "'Teko', sans-serif", letterSpacing: '0.12em', color: '#FFD700', textShadow: '0 0 10px rgba(255,215,0,0.5)' }}
                >
                  TexasNomad Hangman
                </span>
                <span className="text-[#8f37ff] text-[10px] tracking-widest uppercase font-bold leading-none">
                  Guess the Word Before the Host Wins
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
              onClick={handleHostControls}
              className="px-3 py-1.5 border border-[#19d7ff]/40 text-[#19d7ff]/80 rounded text-xs font-bold tracking-widest uppercase hover:bg-[#19d7ff]/10 hover:border-[#19d7ff] transition-all"
            >
              HOST
            </button>
            <button
              onClick={handleRestart}
              className="px-3 py-1.5 border border-[#8f37ff]/40 text-[#8f37ff]/80 rounded text-xs font-bold tracking-widest uppercase hover:bg-[#8f37ff]/10 hover:border-[#8f37ff] transition-all"
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
        <div className="text-5xl">🔤</div>
        <h2
          className="text-3xl uppercase font-extrabold"
          style={{ fontFamily: "'Teko', sans-serif", color: '#FFD700', textShadow: '0 0 16px rgba(255,215,0,0.4)' }}
        >
          Bigger Screen Required!
        </h2>
        <p className="text-white/70 text-sm leading-relaxed max-w-xs">
          For the best TexasNomad Hangman experience, use a tablet, laptop, or desktop.
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
        style={{ background: '#070311' }}
      >
        <div style={{ height: '3px', background: 'linear-gradient(90deg, #8f37ff, #19d7ff, #FFD700, #FF5F1F, #8f37ff)' }} />

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-[#8f37ff] border-t-transparent rounded-full animate-spin" />
              <span className="text-[#FFD700] font-bold tracking-widest text-sm uppercase">Loading Hangman…</span>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            srcdoc={htmlContent}
            title="TexasNomad Hangman"
            className="flex-1 w-full border-0"
            style={{ minHeight: 'calc(100vh - 3.5rem - 3px)', background: '#070311' }}
            allow="microphone"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"
          />
        )}
      </div>
    </div>
  );
}