import React, { useState } from 'react';
import TXDDomino, { DOMINO_SET } from '@/components/domino/TXDDomino';
import Header from '@/components/home/Header';

export default function TXDDominoDemo() {
  const [size, setSize] = useState(80);
  const [showBack, setShowBack] = useState(false);

  return (
    <div className="min-h-screen bg-midnight-void text-white">
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-heading text-outlaw-gold tracking-widest text-center mb-2"
            style={{ textShadow: '0 0 20px #FFD700' }}>
          TXD DOUBLE-SIX DOMINOES
        </h1>
        <p className="text-white/50 text-center font-body mb-8">Complete set — 28 dominoes</p>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-6 mb-10">
          <div className="flex items-center gap-3">
            <label className="text-white/70 font-body text-sm">Size</label>
            <input
              type="range" min={50} max={150} value={size}
              onChange={e => setSize(Number(e.target.value))}
              className="w-32 accent-cyber-purple"
            />
            <span className="text-outlaw-gold font-mono text-sm w-10">{size}px</span>
          </div>
          <button
            onClick={() => setShowBack(!showBack)}
            className={`px-4 py-2 rounded border font-heading tracking-wider text-sm transition-all
              ${showBack ? 'bg-cyber-purple border-cyber-purple text-white' : 'border-white/30 text-white/60 hover:border-white hover:text-white'}`}
          >
            {showBack ? 'SHOWING BACK' : 'SHOW BACK'}
          </button>
        </div>

        {/* Domino grid */}
        <div className="flex flex-wrap justify-center gap-4">
          {DOMINO_SET.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <TXDDomino
                top={d.top}
                bottom={d.bottom}
                width={size}
                faceDown={showBack}
              />
              {!showBack && (
                <span className="text-white/40 font-mono text-xs">{d.top}-{d.bottom}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}