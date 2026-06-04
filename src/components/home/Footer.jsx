import React from 'react';

export default function Footer() {
  return (
    <footer className="border-t border-cyber-purple/30 bg-midnight-void px-4 sm:px-6 py-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Branding */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-cyber-purple/20 border border-outlaw-gold flex items-center justify-center">
            <span className="font-display text-outlaw-gold text-xs">TN</span>
          </div>
          <div>
            <span className="text-sm tracking-widest text-white uppercase" style={{ fontFamily: "'Rye', serif" }}>TEXASNOMAD</span>
            <span className="block text-[7px] tracking-[0.2em] text-kinetic-orange uppercase mt-0.5" style={{ fontFamily: "'Press Start 2P', monospace" }}>PRODUCTIONS</span>
          </div>
        </div>

        {/* Social Links */}
        <div className="flex items-center gap-4">
          <a href="https://youtube.com/@bernatune?si=meQWazY1fXAjPeF0" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-white/60 hover:text-red-500 transition-colors text-[8px]" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.55 15.5V8.5l6.28 3.5-6.28 3.5z"/>
            </svg>
            YOUTUBE
          </a>
          <a href="https://www.tiktok.com/@nomadic_libra?is_from_webapp=1&sender_device=pc" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors text-[8px]" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1 0-5.78c.27 0 .54.04.8.1v-3.5a6.37 6.37 0 0 0-.8-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 10.86 4.43V13.3a8.16 8.16 0 0 0 5.58 2.17V12a4.85 4.85 0 0 1-2-.73v-.3a4.82 4.82 0 0 0 2-4.28z"/>
            </svg>
            TIKTOK
          </a>
          <a href="https://www.bigo.tv/daberna" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-white/60 hover:text-cyber-purple transition-colors text-[8px]" style={{ fontFamily: "'Press Start 2P', monospace" }}>
            <span className="w-4 h-4 rounded-full bg-cyber-purple/40 flex items-center justify-center text-[8px] font-bold text-white">B</span>
            BIGO LIVE
          </a>
        </div>

        {/* Copyright */}
        <p className="text-[7px] tracking-widest text-white/40 uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
          © 2026 TEXASNOMAD GAMES
        </p>
      </div>
    </footer>
  );
}