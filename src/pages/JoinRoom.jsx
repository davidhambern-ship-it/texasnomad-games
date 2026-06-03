import React from 'react';
import { Link } from 'react-router-dom';

export default function JoinRoom() {
  const path = window.location.pathname;
  const roomCode = path.split('/join/')[1] || 'UNKNOWN';

  return (
    <div className="min-h-screen bg-midnight-void flex flex-col items-center justify-center px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-cyber-purple/20 border-2 border-cyber-purple flex items-center justify-center mb-6 animate-pulse-glow">
        <span className="font-heading text-3xl text-cyber-purple">⚡</span>
      </div>
      <h1 className="font-heading text-4xl md:text-6xl tracking-wider text-outlaw-gold uppercase text-glow-gold">
        JOINING ROOM
      </h1>
      <p className="mt-4 font-mono text-2xl text-cyber-purple tracking-[0.3em]">{roomCode}</p>
      <p className="mt-4 text-white/60 font-body">Connecting to game session...</p>
      <Link
        to="/"
        className="mt-8 px-6 py-3 border-2 border-outlaw-gold/60 text-outlaw-gold font-heading text-sm tracking-widest uppercase rounded hover:bg-outlaw-gold hover:text-black transition-all"
      >
        ← Back to Home
      </Link>
    </div>
  );
}