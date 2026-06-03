import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function JoinGame() {
  const [roomCode, setRoomCode] = useState('');
  const [shaking, setShaking] = useState(false);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const handleJoin = () => {
    if (!roomCode.trim()) {
      setError(true);
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
      return;
    }
    setError(false);
    navigate(`/join/${roomCode.trim().toUpperCase()}`);
  };

  return (
    <section className="px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="border border-cyber-purple/40 rounded-lg p-6 bg-midnight-void/80 box-glow-purple scanline-overlay relative overflow-hidden flex flex-col items-center">
          {/* Title */}
          <h3 className="font-heading text-2xl md:text-3xl tracking-[0.15em] text-outlaw-gold text-center mb-4 uppercase">
            ★ JOIN A LIVE GAME ★
          </h3>

          <p className="font-heading text-sm tracking-widest text-white/70 uppercase mb-3">
            ENTER ROOM CODE
          </p>

          {/* Input */}
          <input
            type="text"
            value={roomCode}
            onChange={(e) => {
              setRoomCode(e.target.value.toUpperCase());
              if (error) setError(false);
            }}
            placeholder="EX: TN817"
            className={`w-full max-w-xs px-4 py-3 rounded bg-black/80 border-2 text-center font-mono text-lg tracking-widest text-white placeholder:text-white/30 focus:outline-none focus:border-outlaw-gold transition-colors ${
              error ? 'border-kinetic-orange animate-shake' : 'border-cyber-purple/50'
            } ${shaking ? 'animate-shake' : ''}`}
          />

          {error && (
            <p className="text-kinetic-orange text-xs mt-2 font-body">
              Please enter a room code to join!
            </p>
          )}

          {/* Join Button */}
          <button
            onClick={handleJoin}
            className="mt-4 px-8 py-3 border-2 border-kinetic-orange text-kinetic-orange font-heading text-xl tracking-widest uppercase rounded hover:bg-kinetic-orange hover:text-black hover:shadow-[0_0_20px_rgba(255,95,31,0.5)] transition-all duration-300 focus-visible:outline-2 focus-visible:outline-outlaw-gold"
          >
            JOIN GAME
          </button>

          <p className="mt-3 font-display text-sm text-outlaw-gold/60 italic">
            ★ BE PART OF THE ACTION ★
          </p>
        </div>
      </div>
    </section>
  );
}