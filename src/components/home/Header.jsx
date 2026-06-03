import React from 'react';
import { Link } from 'react-router-dom';

const NAV_ITEMS = [
  { label: 'HOME', path: '/' },
  { label: 'GAMES', path: '/games' },
  { label: 'LIVE STATUS', path: '/live-status' },
  { label: 'ABOUT', path: '/about' },
  { label: 'CONTACT', path: '/contact' },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-cyber-purple/30 bg-midnight-void/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        {/* Logo / Branding */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-10 h-10 rounded-full bg-cyber-purple/20 border-2 border-outlaw-gold flex items-center justify-center">
            <span className="font-display text-outlaw-gold text-sm">TN</span>
          </div>
          <div className="hidden sm:block">
            <span className="font-heading text-xl tracking-widest text-white uppercase leading-none">TEXASNOMAD</span>
            <span className="block font-heading text-[10px] tracking-[0.3em] text-kinetic-orange uppercase leading-none">PRODUCTIONS</span>
          </div>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              to={item.path}
              className="px-3 py-1.5 font-heading text-sm tracking-widest text-white/80 hover:text-outlaw-gold transition-colors uppercase"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Social Icons */}
        <div className="flex items-center gap-2">
          <a href="https://youtube.com" target="_blank" rel="noopener noreferrer"
            className="w-9 h-9 rounded bg-red-600 flex items-center justify-center hover:scale-110 transition-transform">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.55 15.5V8.5l6.28 3.5-6.28 3.5z"/>
            </svg>
          </a>
          <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer"
            className="w-9 h-9 rounded bg-black border border-white/30 flex items-center justify-center hover:scale-110 transition-transform">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1 0-5.78c.27 0 .54.04.8.1v-3.5a6.37 6.37 0 0 0-.8-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 10.86 4.43V13.3a8.16 8.16 0 0 0 5.58 2.17V12a4.85 4.85 0 0 1-2-.73v-.3a4.82 4.82 0 0 0 2-4.28z"/>
            </svg>
          </a>
          <a href="https://bigo.tv" target="_blank" rel="noopener noreferrer"
            className="w-9 h-9 rounded bg-cyber-purple flex items-center justify-center hover:scale-110 transition-transform">
            <span className="text-white font-bold text-xs">BIGO</span>
          </a>
        </div>
      </div>
    </header>
  );
}