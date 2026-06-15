import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';

const GAME_NAME = {
  'bff': 'BFF', 'square-biz': 'SQUARE BIZ!', 'spades': 'SPADES',
  'word-search': 'WORD SEARCH', 'sudoku': 'SUDOKU', 'hangman': 'HANGMAN',
  'viral': 'VIRAL', 'name-that-track': 'NAME THAT TRACK',
};
const GAME_SUBTITLE = {
  'bff': 'BIGO FAMILY FEUD', 'square-biz': 'TRIVIA + TACTICS', 'spades': 'TEXASNOMAD DECK',
  'word-search': 'NOMADIC WORD HUNT', 'sudoku': 'COMPETITIVE PUZZLE', 'hangman': 'GUESS THE WORD',
  'viral': 'GO VIRAL BOARD GAME', 'name-that-track': 'MUSIC TRIVIA',
};

export default function LiveStatus() {
  const [rooms, setRooms] = useState([]);
  const [page, setPage] = useState(0);
  const [fade, setFade] = useState(true);
  const cycleRef = useRef(null);

  useEffect(() => {
    async function fetchLive() {
      const all = await base44.entities.GameRoom.list('-updated_date', 20);
      setRooms(all);
    }
    fetchLive();
    const dataInterval = setInterval(fetchLive, 15000);
    return () => clearInterval(dataInterval);
  }, []);

  useEffect(() => {
    if (rooms.length <= 2) return;
    cycleRef.current = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setPage(p => {
          const maxPage = Math.ceil(rooms.length / 2) - 1;
          return p >= maxPage ? 0 : p + 1;
        });
        setFade(true);
      }, 300);
    }, 10000);
    return () => clearInterval(cycleRef.current);
  }, [rooms.length]);

  const displayed = rooms.slice(page * 2, page * 2 + 2);
  const totalPages = Math.ceil(rooms.length / 2);

  return (
    <section className="px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="border border-cyber-purple/40 rounded-lg p-6 bg-midnight-void/80 box-glow-purple scanline-overlay relative overflow-hidden">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-heading text-2xl md:text-3xl tracking-[0.15em] text-outlaw-gold uppercase">★ LIVE ROOMS ★</h3>
            <span className="text-[7px] tracking-widest text-white/30 uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              {rooms.length} ROOM{rooms.length !== 1 ? 'S' : ''}
            </span>
          </div>

          <div style={{ transition: 'opacity 0.3s', opacity: fade ? 1 : 0 }} className="space-y-3 min-h-[120px]">
            {displayed.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-white/20 text-[8px] tracking-widest uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                No active rooms
              </div>
            ) : displayed.map((room) => {
              const isLive = room.status === 'active';
              const players = room.players_connected || 0;
              return (
                <div key={room.id} className="flex items-center justify-between px-4 py-3 border border-cyber-purple/20 rounded bg-black/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full shrink-0 ${isLive ? 'bg-kinetic-orange animate-pulse-glow' : 'bg-white/10'}`} />
                    <div>
                      <span className="font-heading text-lg tracking-wider text-white uppercase">{GAME_NAME[room.game_id] || room.game_id}</span>
                      <span className="block text-[8px] tracking-widest text-white/40 uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                        {GAME_SUBTITLE[room.game_id] || ''} · {room.room_code}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="font-heading text-2xl text-outlaw-gold">{players}</span>
                      <span className="block text-[10px] tracking-widest text-white/50 uppercase">PLAYERS</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded font-heading text-xs tracking-wider ${isLive ? 'bg-cyber-purple/20 border border-cyber-purple/50 text-cyber-purple animate-pulse-glow' : 'bg-white/5 border border-white/10 text-white/20'}`}>
                      {isLive ? 'LIVE' : room.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Page dots */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-1.5 mt-3">
              {Array.from({ length: totalPages }).map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full transition-all"
                  style={{ background: i === page ? '#FFD700' : 'rgba(255,255,255,0.15)' }} />
              ))}
            </div>
          )}

          <div className="mt-5 text-center">
            <Link to="/live-status" className="inline-block px-6 py-2 border-2 border-outlaw-gold/60 text-outlaw-gold font-heading text-sm tracking-widest uppercase rounded hover:bg-outlaw-gold hover:text-black hover:shadow-[0_0_20px_rgba(255,215,0,0.5)] transition-all duration-300">
              VIEW ALL LIVE GAMES
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}