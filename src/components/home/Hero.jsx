import React from 'react';

export default function Hero({ heroBg, crownLogo }) {
  return (
    <section className="relative w-full min-h-[70vh] flex flex-col items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img 
          src={heroBg} 
          alt="US map background" 
          className="w-full h-full object-cover"
          style={{ 
            opacity: 0.6,
            filter: 'hue-rotate(250deg) saturate(1.5) brightness(0.9)',
          }} 
        />
        <div className="absolute inset-0 bg-gradient-to-b from-midnight-void/30 via-midnight-void/10 to-midnight-void" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 py-12">
        {/* Crown B Logo */}
        <img src={crownLogo} alt="Crown B Logo" className="w-32 h-32 md:w-44 md:h-44 object-contain mb-2 drop-shadow-[0_0_30px_rgba(188,19,254,0.6)]" />

        {/* Title */}
        <h1 className="text-4xl xs:text-5xl sm:text-7xl md:text-8xl lg:text-9xl tracking-wider uppercase leading-none w-full text-center"
          style={{ fontFamily: "'Rye', serif", color: '#E5870E', textShadow: '0 0 10px rgba(229,135,14,0.5), 0 0 20px rgba(229,135,14,0.3), 0 0 40px rgba(229,135,14,0.2)', fontSize: 'clamp(2rem, 12vw, 8rem)' }}>
          TEXASNOMAD
        </h1>
        <h2 className="tracking-wider uppercase leading-none mt-[-0.1em] w-full text-center"
          style={{ fontFamily: "'Monoton', cursive", color: '#ffffff', textShadow: '0 0 10px #BC13FE, 0 0 20px #BC13FE, 0 0 40px #BC13FE', fontSize: 'clamp(1.6rem, 10vw, 6rem)' }}>
          GAMES
        </h2>

        {/* Game icons row */}
        <div className="flex items-center gap-4 mt-4">
          {/* Orange X */}
          <span className="text-4xl font-bold leading-none" style={{ color: '#FF5F1F', textShadow: '0 0 10px rgba(255,95,31,0.6)', fontFamily: 'serif' }}>✕</span>
          {/* Card back */}
          <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/711c24400_BackDesign.png" alt="Card Back" className="h-12 w-auto rounded shadow-lg" />
          {/* Purple O */}
          <span className="font-bold leading-none" style={{ fontSize: '2.5rem', lineHeight: 1, color: '#BC13FE', textShadow: '0 0 10px rgba(188,19,254,0.6)', fontFamily: 'Arial, sans-serif' }}>O</span>
          {/* King of Spades */}
          <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/442e05070_King-spades.png" alt="King of Spades" className="h-12 w-auto rounded shadow-lg" />
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