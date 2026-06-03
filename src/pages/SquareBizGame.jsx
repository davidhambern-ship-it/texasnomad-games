import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useGameRoom } from '@/hooks/useGameRoom';

export default function SquareBizGame() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  if (!roomCode) return <SquareBizIframe />;
  return <SquareBizViewer roomCode={roomCode} />;
}

/* ── VIEWER: connected to a room ── */
function SquareBizViewer({ roomCode }) {
  const { room, loading } = useGameRoom(roomCode, 'square-biz', 'viewer');
  const gs = room?.game_state || {};
  const board = gs.board || Array(9).fill('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const cellDisplay = (v) => {
    if (v === 'X') return { char: 'X', color: '#BC13FE', glow: '0 0 20px rgba(188,19,254,0.6)' };
    if (v === 'O') return { char: 'O', color: '#FF5F1F', glow: '0 0 20px rgba(255,95,31,0.6)' };
    return { char: '', color: '#ffffff15', glow: 'none' };
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-[#05030b] text-white flex flex-col">
      <header className="sticky top-0 z-50 border-b border-[#8a22ff]/30 bg-[#05030b]/90 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 text-[#FFD700]">
              <div className="w-7 h-7 rounded-full bg-[#8a22ff]/20 border border-[#FFD700] flex items-center justify-center">
                <span className="font-bold text-[10px]">TN</span>
              </div>
            </Link>
            <span className="font-heading text-lg tracking-widest text-[#ff8a00] uppercase">Square Biz!</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#ff2bd6] animate-pulse" />
              <span className="font-heading text-[10px] tracking-widest text-[#ff2bd6] uppercase">ROOM {roomCode}</span>
            </div>
          </div>
          <button
            onClick={() => { if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.(); else document.exitFullscreen?.(); }}
            className="px-3 py-1 bg-[#FF5F1F] text-white font-heading text-xs tracking-widest uppercase rounded hover:bg-[#FF5F1F]/80 transition-all">
            {isFullscreen ? '✕ EXIT' : '⛶ FULL'}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#8a22ff] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
          {/* Turn Indicator */}
          <div className="text-center">
            <div className="font-heading text-xs tracking-[0.25em] text-white/40 uppercase mb-1">Current Turn</div>
            <div className="font-heading text-5xl font-bold"
              style={{
                color: gs.current_turn === 'X' ? '#BC13FE' : '#FF5F1F',
                textShadow: `0 0 30px ${gs.current_turn === 'X' ? '#BC13FE' : '#FF5F1F'}`,
              }}>
              {gs.current_turn || 'X'}
            </div>
          </div>

          {/* Board */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
            {board.map((cell, idx) => {
              const { char, color, glow } = cellDisplay(cell);
              return (
                <div key={idx}
                  className="aspect-square flex items-center justify-center rounded-xl border-2 text-5xl md:text-7xl font-heading transition-all"
                  style={{
                    borderColor: cell ? color : '#ffffff10',
                    color,
                    background: cell ? `${color}15` : '#00000060',
                    boxShadow: glow,
                  }}>
                  {char}
                </div>
              );
            })}
          </div>

          {/* Question */}
          {gs.show_question && gs.current_question && (
            <div className="w-full max-w-2xl p-6 border border-[#8a22ff]/40 rounded-2xl bg-black/60 text-center"
              style={{ boxShadow: '0 0 30px rgba(138,34,255,0.15)' }}>
              <div className="font-heading text-xs tracking-[0.2em] text-[#8a22ff]/70 uppercase mb-2">Question</div>
              <div className="font-heading text-2xl md:text-3xl text-white tracking-wide">{gs.current_question}</div>
            </div>
          )}

          {gs.winner && (
            <div className="text-center">
              <div className="font-heading text-3xl tracking-widest uppercase"
                style={{ color: gs.winner === 'X' ? '#BC13FE' : '#FF5F1F', textShadow: `0 0 30px ${gs.winner === 'X' ? '#BC13FE' : '#FF5F1F'}` }}>
                🏆 {gs.winner} WINS!
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── LEGACY IFRAME MODE ── */
const SQUARE_BIZ_URL = 'https://media.base44.com/files/public/6a1faf9539e2c1e12925ead8/78526944c_Square-Biz-Game-App-v5-PDF-Trivia-Bank.html';

function SquareBizIframe() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    fetch(SQUARE_BIZ_URL).then(r => r.text()).then(html => { setHtmlContent(html); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  return (
    <div className="min-h-screen bg-[#05030b] text-white flex flex-col">
      <header className="sticky top-0 z-50 border-b border-[#8a22ff]/30 bg-[#05030b]/90 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/" className="flex items-center gap-2 text-[#FFD700] hover:text-[#FF5F1F] transition-colors">
              <div className="w-8 h-8 rounded-full bg-[#8a22ff]/20 border border-[#FFD700] flex items-center justify-center">
                <span className="font-bold text-xs">TN</span>
              </div>
            </Link>
            <span className="font-heading text-base tracking-widest text-[#ff8a00] uppercase">Square Biz! — Trivia + Tactics</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="hidden sm:flex px-3 py-1.5 border border-[#FFD700]/40 text-[#FFD700]/80 rounded text-xs font-bold tracking-widest uppercase hover:bg-[#FFD700]/10 transition-all">← LOBBY</Link>
            <button
              onClick={() => { if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.(); else document.exitFullscreen?.(); }}
              className="px-3 py-1.5 bg-[#FF5F1F] text-white rounded text-xs font-bold tracking-widest uppercase hover:bg-[#FF5F1F]/80 transition-all">
              {isFullscreen ? '✕ EXIT' : '⛶ FULL'}
            </button>
          </div>
        </div>
      </header>
      <div className="sm:hidden flex flex-col items-center justify-center flex-1 px-6 py-16 text-center gap-4">
        <div className="text-5xl">🎯</div>
        <h2 className="text-3xl uppercase font-extrabold" style={{ fontFamily: "'Teko', sans-serif", color: '#ff8a00' }}>Bigger Screen Required!</h2>
        <Link to="/" className="mt-4 px-6 py-2.5 border-2 border-[#FFD700] text-[#FFD700] font-bold tracking-widest uppercase text-sm rounded hover:bg-[#FFD700] hover:text-black transition-all">← Back to Lobby</Link>
      </div>
      <div ref={containerRef} className="hidden sm:flex flex-col flex-1 min-h-0" style={{ background: '#05030b' }}>
        <div style={{ height: '3px', background: 'linear-gradient(90deg, #8a22ff, #ff2bd6, #ff8a00, #00b8ff, #8a22ff)' }} />
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-[#8a22ff] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <iframe ref={iframeRef} srcdoc={htmlContent} title="Square Biz!" className="flex-1 w-full border-0"
            style={{ minHeight: 'calc(100vh - 3.5rem - 3px)' }}
            allow="microphone" allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads" />
        )}
      </div>
    </div>
  );
}