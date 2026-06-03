import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useGameRoom } from '@/hooks/useGameRoom';

export default function HangmanGame() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  if (!roomCode) {
    window.location.href = '/';
    return null;
  }
  return <HangmanViewer roomCode={roomCode} />;
}

/* ── VIEWER: connected to a room ── */
function HangmanViewer({ roomCode }) {
  const { room, loading } = useGameRoom(roomCode, 'hangman', 'viewer');
  const gs = room?.game_state || {};
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const word = gs.secret_word || '';
  const guessed = gs.guessed_letters || [];
  const wrong = gs.wrong_letters || [];
  const maxWrong = gs.max_wrong || 6;
  const wrongCount = wrong.length;

  // Mask the word — show guessed letters, hide others
  const maskedWord = word.split('').map(ch => ch === ' ' ? ' ' : (guessed.includes(ch) || gs.word_revealed ? ch : '_'));

  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  // SVG hangman parts based on wrong count
  const parts = [
    <line key="head-v" x1="120" y1="20" x2="120" y2="60" stroke="#BC13FE" strokeWidth="3" />, // rope
    <circle key="head" cx="120" cy="75" r="15" stroke="#FFD700" strokeWidth="3" fill="none" />, // head
    <line key="body" x1="120" y1="90" x2="120" y2="140" stroke="#FFD700" strokeWidth="3" />, // body
    <line key="arm-l" x1="120" y1="100" x2="90" y2="125" stroke="#FFD700" strokeWidth="3" />, // left arm
    <line key="arm-r" x1="120" y1="100" x2="150" y2="125" stroke="#FFD700" strokeWidth="3" />, // right arm
    <line key="leg-l" x1="120" y1="140" x2="90" y2="175" stroke="#FFD700" strokeWidth="3" />, // left leg
    <line key="leg-r" x1="120" y1="140" x2="150" y2="175" stroke="#FFD700" strokeWidth="3" />, // right leg
  ];

  return (
    <div ref={containerRef} className="min-h-screen bg-[#070311] text-white flex flex-col">
      <header className="sticky top-0 z-50 border-b border-[#8f37ff]/30 bg-[#070311]/90 backdrop-blur-xl">
        <div className="px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 text-[#FFD700]">
              <div className="w-7 h-7 rounded-full bg-[#8f37ff]/20 border border-[#FFD700] flex items-center justify-center">
                <span className="font-bold text-[10px]">TN</span>
              </div>
            </Link>
            <span className="font-heading text-lg tracking-widest text-[#FFD700] uppercase">TexasNomad Hangman</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#19d7ff] animate-pulse" />
              <span className="font-heading text-[10px] tracking-widest text-[#19d7ff] uppercase">ROOM {roomCode}</span>
            </div>
            {room?.host_connected && (
              <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/50 rounded text-green-400 font-heading text-[9px] tracking-widest uppercase">
                🔴 HOST LIVE
              </span>
            )}
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
          <div className="w-10 h-10 border-4 border-[#8f37ff] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : gs.phase === 'setup' ? (
        <div className="flex-1 flex items-center justify-center text-center px-4">
          <div>
            <div className="text-6xl mb-4">🔤</div>
            <div className="font-heading text-2xl tracking-widest text-white/40 uppercase">Waiting for Host…</div>
            <div className="font-heading text-xs tracking-widest text-white/20 uppercase mt-2">Host is setting up the game</div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-5">
          {/* Category */}
          {gs.category && (
            <div className="text-center">
              <div className="font-heading text-[10px] tracking-[0.25em] text-white/40 uppercase mb-1">Category</div>
              <div className="font-heading text-xl tracking-widest text-[#BC13FE] uppercase">{gs.category}</div>
            </div>
          )}

          {/* Hangman SVG + wrong count */}
          <div className="flex items-center gap-8">
            <svg width="180" height="200" className="shrink-0">
              {/* Gallows */}
              <line x1="20" y1="190" x2="160" y2="190" stroke="#ffffff30" strokeWidth="3" />
              <line x1="60" y1="190" x2="60" y2="10" stroke="#ffffff30" strokeWidth="3" />
              <line x1="60" y1="10" x2="120" y2="10" stroke="#ffffff30" strokeWidth="3" />
              <line x1="120" y1="10" x2="120" y2="20" stroke="#ffffff30" strokeWidth="3" />
              {/* Body parts — show based on wrong count */}
              {parts.slice(0, wrongCount + (wrongCount > 0 ? 1 : 0)).map((p, i) => i < wrongCount ? p : null)}
            </svg>

            <div className="text-center">
              <div className="font-heading text-4xl text-[#FF5F1F]">{wrongCount}</div>
              <div className="font-heading text-[10px] tracking-widest text-white/40 uppercase">Wrong</div>
              <div className="font-heading text-lg text-white/20">/ {maxWrong}</div>
            </div>
          </div>

          {/* Masked Word */}
          <div className="flex gap-2 flex-wrap justify-center">
            {maskedWord.map((ch, i) => (
              ch === ' ' ? (
                <div key={i} className="w-4" />
              ) : (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="font-mono text-3xl md:text-4xl font-bold text-[#FFD700] min-w-[1.5ch] text-center"
                    style={{ textShadow: ch !== '_' ? '0 0 15px rgba(255,215,0,0.5)' : 'none' }}>
                    {ch}
                  </span>
                  <div className="w-full h-0.5 bg-[#FFD700]/40 rounded" />
                </div>
              )
            ))}
          </div>

          {/* Hint */}
          {gs.hint_revealed && gs.hint && (
            <div className="px-6 py-3 border border-[#BC13FE]/40 rounded-xl bg-[#BC13FE]/10 text-center">
              <div className="font-heading text-[10px] tracking-widest text-[#BC13FE]/70 uppercase mb-1">💡 Hint</div>
              <div className="font-heading text-lg text-white tracking-wide">{gs.hint}</div>
            </div>
          )}

          {/* Wrong Letters */}
          {wrong.length > 0 && (
            <div className="text-center">
              <div className="font-heading text-[10px] tracking-widest text-white/40 uppercase mb-2">Wrong Letters</div>
              <div className="flex gap-2 flex-wrap justify-center">
                {wrong.map((l) => (
                  <span key={l} className="font-mono text-lg text-red-400 line-through">{l}</span>
                ))}
              </div>
            </div>
          )}

          {/* Alphabet */}
          <div className="flex flex-wrap gap-1.5 justify-center max-w-lg">
            {ALPHABET.map((l) => {
              const isWrong = wrong.includes(l);
              const isGuessed = guessed.includes(l) && !isWrong;
              return (
                <div key={l}
                  className="w-8 h-8 flex items-center justify-center rounded font-mono text-sm font-bold border transition-all"
                  style={{
                    borderColor: isWrong ? '#ef4444' : isGuessed ? '#4ade80' : '#ffffff20',
                    color: isWrong ? '#ef4444' : isGuessed ? '#4ade80' : '#ffffff40',
                    background: isWrong ? '#ef444410' : isGuessed ? '#4ade8010' : 'transparent',
                    textDecoration: isWrong ? 'line-through' : 'none',
                  }}>
                  {l}
                </div>
              );
            })}
          </div>

          {/* Win/Lose state */}
          {gs.phase === 'finished' && (
            <div className="text-center p-5 border-2 border-[#FFD700] rounded-2xl bg-[#FFD700]/10">
              <div className="font-heading text-3xl tracking-widest text-[#FFD700] uppercase">
                {gs.word_revealed ? '🏳 Word Revealed' : '🎉 Round Complete!'}
              </div>
              <div className="font-mono text-3xl text-white mt-2 tracking-[0.3em]">{gs.secret_word}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── LEGACY IFRAME MODE ── */
const HANGMAN_URL = 'https://media.base44.com/files/public/6a1faf9539e2c1e12925ead8/3954f4d5d_TexasNomad-Hangman-Vercel-Ready-v3-Hidden-Setup-Host-Controls.html';

function HangmanIframe() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    fetch(HANGMAN_URL).then(r => r.text()).then(html => { setHtmlContent(html); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  return (
    <div className="min-h-screen bg-[#070311] text-white flex flex-col">
      <header className="sticky top-0 z-50 border-b border-[#8f37ff]/30 bg-[#070311]/90 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/" className="flex items-center gap-2 text-[#FFD700] hover:text-[#FF5F1F] transition-colors">
              <div className="w-8 h-8 rounded-full bg-[#8f37ff]/20 border border-[#FFD700] flex items-center justify-center">
                <span className="font-bold text-xs">TN</span>
              </div>
            </Link>
            <span className="font-heading text-base tracking-widest text-[#FFD700] uppercase">TexasNomad Hangman</span>
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
        <div className="text-5xl">🔤</div>
        <h2 className="text-3xl uppercase font-extrabold" style={{ fontFamily: "'Teko', sans-serif", color: '#FFD700' }}>Bigger Screen Required!</h2>
        <Link to="/" className="mt-4 px-6 py-2.5 border-2 border-[#FFD700] text-[#FFD700] font-bold tracking-widest uppercase text-sm rounded hover:bg-[#FFD700] hover:text-black transition-all">← Back to Lobby</Link>
      </div>
      <div ref={containerRef} className="hidden sm:flex flex-col flex-1 min-h-0" style={{ background: '#070311' }}>
        <div style={{ height: '3px', background: 'linear-gradient(90deg, #8f37ff, #19d7ff, #FFD700, #FF5F1F, #8f37ff)' }} />
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-[#8f37ff] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <iframe ref={iframeRef} srcdoc={htmlContent} title="TexasNomad Hangman" className="flex-1 w-full border-0"
            style={{ minHeight: 'calc(100vh - 3.5rem - 3px)' }}
            allow="microphone" allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads" />
        )}
      </div>
    </div>
  );
}