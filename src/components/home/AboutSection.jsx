import React from 'react';

export default function AboutSection({ aboutBg }) {
  return (
    <section className="relative px-4 sm:px-6 overflow-hidden">
      {/* Background image */}
      {aboutBg && (
        <div className="absolute inset-0 -mx-4 sm:-mx-6">
          <img src={aboutBg} alt="" className="w-full h-full object-cover opacity-15" />
          <div className="absolute inset-0 bg-midnight-void/80" />
        </div>
      )}

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid md:grid-cols-[auto_1fr_auto] gap-8 items-center py-8">
          {/* TN Logo */}
          <div className="hidden md:flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-cyber-purple/20 border-2 border-outlaw-gold flex items-center justify-center">
              <span className="font-display text-outlaw-gold text-xl">TN</span>
            </div>
          </div>

          {/* Text */}
          <div className="text-center md:text-left">
            <h3 className="font-heading text-2xl md:text-3xl tracking-[0.15em] text-outlaw-gold mb-4 uppercase">
              ★ ABOUT TEXASNOMAD GAMES ★
            </h3>
            <p className="font-body text-sm md:text-base leading-relaxed text-white/80 max-w-xl">
              TexasNomad Games is a livestream gaming network built for interactive competition,
              community engagement, and live entertainment.
            </p>
            <p className="font-body text-sm md:text-base leading-relaxed text-white/80 max-w-xl mt-2">
              Join the action, compete in real-time, and become part of the network.
            </p>
          </div>

          {/* Fort Worth text */}
          <div className="hidden md:block text-right">
            <p className="font-display text-xl text-kinetic-orange leading-tight text-glow-orange">
              FORT WORTH<br/>MADE.<br/>NATIONWIDE<br/>PLAYED.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}