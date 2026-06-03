import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGameRoom } from '@/hooks/useGameRoom';

export default function BFFGame() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');

  if (!roomCode) {
    window.location.href = '/';
    return null;
  }

  return <BFFViewer roomCode={roomCode} />;
}

/* ── VIEWER: connected to a room ── */
function BFFViewer({ roomCode }) {
  const { room, loading } = useGameRoom(roomCode, 'bff', 'viewer');
  const gs = room?.game_state || {};
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-[#050515] text-white flex flex-col"
      style={{ fontFamily: "'Teko', sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#BC13FE]/30 bg-[#050515]/90 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 text-[#FFD700] hover:text-[#FF5F1F] transition-colors">
              <div className="w-7 h-7 rounded-full bg-[#BC13FE]/20 border border-[#FFD700] flex items-center justify-center">
                <span className="font-bold text-[10px]">TN</span>
              </div>
            </Link>
            <span className="text-[#FFD700] font-heading text-lg tracking-widest uppercase">BFF — BIGO FAMILY FEUD</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#BC13FE] animate-pulse" />
              <span className="font-heading text-[10px] tracking-widest text-[#BC13FE] uppercase">ROOM {roomCode}</span>
            </div>
            {room?.host_connected && (
              <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/50 rounded text-green-400 font-heading text-[9px] tracking-widest uppercase">
                🔴 HOST LIVE
              </span>
            )}
          </div>
          <button onClick={handleFullscreen}
            className="px-3 py-1 bg-[#FF5F1F] text-white font-heading text-xs tracking-widest uppercase rounded hover:bg-[#FF5F1F]/80 transition-all">
            {isFullscreen ? '✕ EXIT' : '⛶ FULL'}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#BC13FE] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4 w-full max-w-5xl mx-auto">
          {/* Scores */}
          <div className="grid grid-cols-2 gap-6 w-full">
            {[
              { name: gs.family1 || 'Family 1', score: gs.score1 || 0, turn: 1 },
              { name: gs.family2 || 'Family 2', score: gs.score2 || 0, turn: 2 },
            ].map((f) => (
              <div key={f.turn} className="text-center p-4 border-2 rounded-2xl transition-all"
                style={{
                  borderColor: gs.active_turn === f.turn ? '#FFD700' : '#BC13FE30',
                  background: gs.active_turn === f.turn ? '#FFD70010' : '#00000060',
                  boxShadow: gs.active_turn === f.turn ? '0 0 40px rgba(255,215,0,0.2)' : 'none',
                }}>
                <div className="font-heading text-2xl md:text-3xl tracking-widest text-white uppercase truncate">{f.name}</div>
                <div className="font-heading text-5xl md:text-7xl text-[#FFD700] mt-1"
                  style={{ textShadow: '0 0 30px rgba(255,215,0,0.5)' }}>{f.score}</div>
                {gs.active_turn === f.turn && (
                  <div className="mt-1 text-xs tracking-widest text-[#FFD700] font-heading uppercase">▶ ACTIVE TURN</div>
                )}
              </div>
            ))}
          </div>

          {/* Round Bank */}
          {(gs.round_bank || 0) > 0 && (
            <div className="px-8 py-2 border-2 border-[#FF5F1F] rounded-xl text-center"
              style={{ boxShadow: '0 0 20px rgba(255,95,31,0.3)' }}>
              <div className="font-heading text-xs tracking-[0.2em] text-[#FF5F1F]/70 uppercase">Round Bank</div>
              <div className="font-heading text-3xl text-[#FF5F1F]">{gs.round_bank}</div>
            </div>
          )}

          {/* Current Question */}
          {gs.current_question && (
            <div className="w-full p-4 border border-[#BC13FE]/40 rounded-2xl bg-black/60 text-center"
              style={{ boxShadow: '0 0 30px rgba(188,19,254,0.15)' }}>
              <div className="font-heading text-xs tracking-[0.2em] text-[#BC13FE]/70 uppercase mb-1">Question</div>
              <div className="font-heading text-2xl md:text-4xl text-white tracking-wide">{gs.current_question}</div>
            </div>
          )}

          {/* Answer Board */}
          {gs.answers && gs.answers.length > 0 && (
            <div className="w-full grid grid-cols-2 gap-3">
              {gs.answers.map((ans, i) => (
                <div key={i}
                  className="flex items-center gap-3 px-5 py-3 border-2 rounded-xl transition-all"
                  style={{
                    borderColor: ans.revealed ? '#FFD700' : '#ffffff15',
                    background: ans.revealed ? '#FFD70015' : '#00000080',
                    boxShadow: ans.revealed ? '0 0 20px rgba(255,215,0,0.2)' : 'none',
                  }}>
                  <span className="font-heading text-2xl text-[#FFD700] w-8 text-center shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    {ans.revealed ? (
                      <>
                        <div className="font-heading text-lg md:text-2xl text-white tracking-wide truncate">{ans.text}</div>
                        {ans.points !== undefined && (
                          <div className="font-heading text-sm text-[#FF5F1F]">{ans.points} pts</div>
                        )}
                      </>
                    ) : (
                      <div className="font-heading text-2xl text-white/20 tracking-[0.4em]">▓▓▓▓▓▓▓</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Waiting state */}
          {gs.phase === 'setup' && (
            <div className="text-center mt-2">
              <div className="font-heading text-lg tracking-widest text-white/30 uppercase">Host is setting up the game…</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── LEGACY IFRAME MODE (no room code) ── */
const BFF_HTML_URL = 'https://media.base44.com/files/public/6a1faf9539e2c1e12925ead8/c10ab0da8_BFF-GameBoard-v73-fuzzy-synonym-scan.html';

function BFFIframe() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    fetch(BFF_HTML_URL).then(r => r.text()).then(html => { setHtmlContent(html); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <header className="sticky top-0 z-50 border-b border-[#BC13FE]/30 bg-[#050505]/90 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/" className="flex items-center gap-2 text-[#FFD700] hover:text-[#FF5F1F] transition-colors">
              <div className="w-8 h-8 rounded-full bg-[#BC13FE]/20 border border-[#FFD700] flex items-center justify-center">
                <span className="font-bold text-xs">TN</span>
              </div>
            </Link>
            <span className="font-heading text-base tracking-widest text-[#FFD700] uppercase">BFF — BIGO FAMILY FEUD</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="hidden sm:flex px-3 py-1.5 border border-[#FFD700]/40 text-[#FFD700]/80 rounded text-xs font-bold tracking-widest uppercase hover:bg-[#FFD700]/10 transition-all">← LOBBY</Link>
            <button onClick={handleFullscreen} className="px-3 py-1.5 bg-[#FF5F1F] text-white rounded text-xs font-bold tracking-widest uppercase hover:bg-[#FF5F1F]/80 transition-all">
              {isFullscreen ? '✕ EXIT' : '⛶ FULL'}
            </button>
          </div>
        </div>
      </header>
      <div className="sm:hidden flex flex-col items-center justify-center flex-1 px-6 py-16 text-center gap-4">
        <div className="text-5xl">🎮</div>
        <h2 className="text-3xl uppercase font-extrabold" style={{ fontFamily: "'Teko', sans-serif", color: '#FFD700' }}>Game On — Bigger Screen!</h2>
        <Link to="/" className="mt-4 px-6 py-2.5 border-2 border-[#FFD700] text-[#FFD700] font-bold tracking-widest uppercase text-sm rounded hover:bg-[#FFD700] hover:text-black transition-all">← Back to Lobby</Link>
      </div>
      <div ref={containerRef} className="hidden sm:flex flex-col flex-1 min-h-0" style={{ background: '#050505' }}>
        <div style={{ height: '3px', background: 'linear-gradient(90deg, #BC13FE, #FF5F1F, #FFD700, #BC13FE)' }} />
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-[#BC13FE] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <iframe ref={iframeRef} srcdoc={htmlContent} title="BFF" className="flex-1 w-full border-0"
            style={{ minHeight: 'calc(100vh - 3.5rem - 3px)' }}
            allow="microphone" allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads" />
        )}
      </div>
    </div>
  );
}