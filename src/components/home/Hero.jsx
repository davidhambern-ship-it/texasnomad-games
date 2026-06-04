import React from 'react';

export default function Hero({ heroBg, crownLogo }) {
  return (
    <section className="relative w-full min-h-[70vh] flex flex-col items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img src={heroBg} alt="Dark cityscape background" className="w-full h-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-b from-midnight-void/40 via-midnight-void/20 to-midnight-void" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 py-12">
        {/* Crown B Logo */}
        <img src={crownLogo} alt="Crown B Logo" className="w-24 h-24 md:w-32 md:h-32 object-contain mb-2 drop-shadow-[0_0_30px_rgba(188,19,254,0.6)]" />

        {/* Title */}
        <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl tracking-wider uppercase leading-none"
          style={{ fontFamily: "'Rye', serif", color: '#E5870E', textShadow: '0 0 10px rgba(229,135,14,0.5), 0 0 20px rgba(229,135,14,0.3), 0 0 40px rgba(229,135,14,0.2)' }}>
          TEXASNOMAD
        </h1>
        <h2 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-wider uppercase leading-none mt-[-0.1em]"
          style={{ fontFamily: "'Monoton', cursive", color: '#ffffff', textShadow: '0 0 10px #BC13FE, 0 0 20px #BC13FE, 0 0 40px #BC13FE' }}>
          GAMES
        </h2>

        {/* Game icons row */}
        <div className="flex items-center gap-3 mt-4">
          <span className="text-3xl">🃏</span>
          <span className="text-3xl">❌⭕</span>
          <span className="text-3xl">♠️</span>
        </div>

        {/* Marquee Banner */}
        <div className="mt-6 w-full max-w-lg overflow-hidden">
          <div className="relative py-3 px-2 border-y-2 border-outlaw-gold/60">
            <div className="flex whitespace-nowrap animate-marquee">
              <span className="text-sm md:text-base tracking-[0.2em] text-kinetic-orange text-glow-orange mx-8" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                ★ PLAY • COMPETE • CONNECT ★
              </span>
              <span className="text-sm md:text-base tracking-[0.2em] text-kinetic-orange text-glow-orange mx-8" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                ★ PLAY • COMPETE • CONNECT ★
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}