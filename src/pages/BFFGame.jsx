import React from 'react';
import { Link } from 'react-router-dom';
import NeonBFFPlayer from '@/pages/NeonBFFPlayer.jsx';

function roomCodeFromLocation() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get('room') || '').trim().toUpperCase();
}

export default function BFFGame() {
  const roomCode = roomCodeFromLocation();

  if (roomCode) {
    return <NeonBFFPlayer roomCode={roomCode} />;
  }

  return (
    <div className="min-h-screen bg-midnight-void flex items-center justify-center px-5 text-center">
      <div className="max-w-xl rounded-2xl border border-white/10 bg-black/35 p-8">
        <h1 className="font-heading text-4xl text-outlaw-gold">BFF</h1>
        <p className="mt-4 text-white/60">
          BFF is a live TNG room game. Join with a room code or launch it from the Host Panel.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/" className="rounded-xl border border-outlaw-gold px-5 py-3 text-outlaw-gold">
            HOME
          </Link>
          <Link to="/host?game=bff" className="rounded-xl border border-cyber-purple px-5 py-3 text-cyber-purple">
            HOST BFF
          </Link>
        </div>
      </div>
    </div>
  );
}
