import React from 'react';
import { Link } from 'react-router-dom';

export default function PlaceholderPage() {
  const path = window.location.pathname;
  const pageName = path.replace('/', '').replace(/-/g, ' ').toUpperCase() || 'PAGE';

  return (
    <div className="min-h-screen bg-midnight-void flex flex-col items-center justify-center px-4 text-center">
      <h1 className="font-heading text-5xl md:text-7xl tracking-wider text-outlaw-gold uppercase text-glow-gold">
        {pageName}
      </h1>
      <p className="mt-4 text-white/60 font-body text-lg">This page is under construction.</p>
      <Link
        to="/"
        className="mt-8 px-6 py-3 border-2 border-outlaw-gold text-outlaw-gold font-heading text-lg tracking-widest uppercase rounded hover:bg-outlaw-gold hover:text-black transition-all"
      >
        ← Back to Home
      </Link>
    </div>
  );
}