import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'HOME', path: '/' },
  { label: 'GAMES', path: '/games' },
  { label: 'LIVE STATUS', path: '/live-status' },
  { label: 'ABOUT', path: '/about' },
  { label: 'CONTACT', path: '/contact' },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-cyber-purple/30 bg-midnight-void/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        {/* Logo / Branding */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src="https://media.base44.com/images/public/6a1faf9539e2c1e12925ead8/30f43cf4a_logoimage-1.png" alt="TexasNomad Logo" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
          <div className="flex flex-col leading-tight">
<span className="tracking-widest text-white uppercase text-xs sm:text-base" style={{ fontFamily: "'Rye', serif" }}>
  TEXASNOMAD
</span>
            <span className="text-[6px] sm:text-[8px] tracking-[0.2em] text-kinetic-orange uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>PRODUCTIONS</span>
          </div>
        </Link>

        {/* Nav - Desktop */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              to={item.path}
              className="px-3 py-1.5 text-[10px] tracking-widest text-white/80 hover:text-outlaw-gold transition-colors uppercase"
              style={{ fontFamily: "'Press Start 2P', monospace" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Host Link - Desktop */}
        <Link
          to="/host"
          className="hidden md:flex items-center gap-1.5 px-3 py-1 border border-[#BC13FE]/40 text-[#BC13FE]/70 rounded text-[9px] tracking-widest uppercase hover:bg-[#BC13FE]/10 hover:border-[#BC13FE] transition-all mr-2"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          🎛 HOST
        </Link>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden px-3 py-1.5 border-2 border-white/60 rounded text-white hover:text-outlaw-gold hover:border-outlaw-gold transition-colors active:scale-95"
          style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, letterSpacing: '0.15em' }}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? '✕ CLOSE' : '▶ MENU'}
        </button>

        {/* Social Icons - Desktop */}
        <div className="hidden md:flex items-center gap-2">
          <a href="https://youtube.com/@bernatune?si=meQWazY1fXAjPeF0" target="_blank" rel="noopener noreferrer"
            className="w-9 h-9 rounded bg-red-600 flex items-center justify-center hover:scale-110 transition-transform">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.55 15.5V8.5l6.28 3.5-6.28 3.5z"/>
            </svg>
          </a>
          <a href="https://www.tiktok.com/@nomadic_libra?is_from_webapp=1&sender_device=pc" target="_blank" rel="noopener noreferrer"
            className="w-9 h-9 rounded bg-black border border-white/30 flex items-center justify-center hover:scale-110 transition-transform">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1 0-5.78c.27 0 .54.04.8.1v-3.5a6.37 6.37 0 0 0-.8-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 10.86 4.43V13.3a8.16 8.16 0 0 0 5.58 2.17V12a4.85 4.85 0 0 1-2-.73v-.3a4.82 4.82 0 0 0 2-4.28z"/>
            </svg>
          </a>
          <a href="https://www.bigo.tv/daberna" target="_blank" rel="noopener noreferrer"
            className="w-9 h-9 rounded bg-cyber-purple flex items-center justify-center hover:scale-110 transition-transform">
            <span className="text-white font-bold text-xs">BIGO</span>
          </a>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-cyber-purple/30 bg-midnight-void/95 backdrop-blur-xl">
          <div className="px-4 py-4 space-y-3">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 text-sm tracking-widest text-white/80 hover:text-outlaw-gold hover:bg-cyber-purple/10 rounded-lg transition-colors uppercase"
                style={{ fontFamily: "'Press Start 2P', monospace" }}
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/host"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-3 text-sm tracking-widest text-[#BC13FE]/70 hover:text-[#BC13FE] hover:bg-[#BC13FE]/10 rounded-lg transition-colors uppercase border border-[#BC13FE]/30"
              style={{ fontFamily: "'Press Start 2P', monospace" }}
            >
              🎛 HOST
            </Link>
            
            {/* Mobile Social Icons */}
            <div className="flex gap-3 pt-3 border-t border-cyber-purple/30">
              <a href="https://youtube.com/@bernatune?si=meQWazY1fXAjPeF0" target="_blank" rel="noopener noreferrer"
                className="w-10 h-10 rounded bg-red-600 flex items-center justify-center hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.55 15.5V8.5l6.28 3.5-6.28 3.5z"/>
                </svg>
              </a>
              <a href="https://www.tiktok.com/@nomadic_libra?is_from_webapp=1&sender_device=pc" target="_blank" rel="noopener noreferrer"
                className="w-10 h-10 rounded bg-black border border-white/30 flex items-center justify-center hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1 0-5.78c.27 0 .54.04.8.1v-3.5a6.37 6.37 0 0 0-.8-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 10.86 4.43V13.3a8.16 8.16 0 0 0 5.58 2.17V12a4.85 4.85 0 0 1-2-.73v-.3a4.82 4.82 0 0 0 2-4.28z"/>
                </svg>
              </a>
              <a href="https://www.bigo.tv/daberna" target="_blank" rel="noopener noreferrer"
                className="w-10 h-10 rounded bg-cyber-purple flex items-center justify-center hover:scale-110 transition-transform">
                <span className="text-white font-bold text-xs">BIGO</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}