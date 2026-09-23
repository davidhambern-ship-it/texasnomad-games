import React from 'react';
import { Link } from 'react-router-dom';

import Header from '@/components/home/Header';
import Footer from '@/components/home/Footer';
import { TNG_ORIGIN_STORY } from '@/content/tngOriginStory';

const STEPS = [
  { title: 'SPADES', text: 'One panel. About five people. One question: “Y’all play Spades?” That was the spark.' },
  { title: 'HANGMAN', text: 'Once one game was possible, the obvious question became: what else can a livestream actually play together?' },
  { title: 'BFF', text: 'Hangman opened the door to bigger group games, audience energy, and games built around the people in the room.' },
  { title: 'SQUARE BIZ!', text: 'Then the arcade stopped feeling accidental. Square Biz turned the experiment into a full-on live game show.' },
];

export default function About() {
  return (
    <div className="min-h-screen bg-midnight-void text-white overflow-x-hidden">
      <Header />

      <main>
        <section className="relative overflow-hidden px-4 py-16 sm:py-24">
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(circle at 20% 20%, rgba(188,19,254,.16), transparent 28%), radial-gradient(circle at 80% 70%, rgba(255,95,31,.12), transparent 32%)',
          }} />
          <div className="relative mx-auto max-w-5xl text-center">
            <div className="text-[8px] tracking-[.35em] uppercase text-kinetic-orange" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              HOW DID WE GET HERE?
            </div>
            <h1 className="mt-4 text-5xl sm:text-7xl md:text-8xl uppercase text-outlaw-gold" style={{ fontFamily: "'Monoton', cursive", textShadow: '0 0 28px rgba(255,215,0,.25)' }}>
              THE RABBIT HOLE
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/55">
              TexasNomad Games did not start as a company meeting, a pitch deck, or a brilliant ten-year master plan. It started on a livestream with a simple question.
            </p>
          </div>
        </section>

        <section className="px-4 pb-10">
          <div className="mx-auto max-w-4xl rounded-3xl border border-cyber-purple/35 bg-black/45 p-6 sm:p-9 shadow-[0_0_50px_rgba(188,19,254,.08)]">
            <div className="text-3xl text-cyber-purple">“Y’all play Spades?”</div>

            <div className="mt-6 space-y-5 text-[15px] leading-8 text-white/62">
              {TNG_ORIGIN_STORY.map((block, index) => {
                if (block.type === 'quote') {
                  return (
                    <div
                      key={`${block.type}-${index}`}
                      className="rounded-2xl border border-kinetic-orange/35 bg-kinetic-orange/[.05] p-5 text-center text-2xl text-kinetic-orange"
                    >
                      {block.text}
                    </div>
                  );
                }

                if (block.type === 'signature') {
                  return <p key={`${block.type}-${index}`} className="pt-2 italic text-cyber-purple/75">{block.text}</p>;
                }

                const className = block.text === 'He was lost in a whole Digital Arcade.'
                  ? 'text-lg text-white'
                  : undefined;

                return (
                  <p key={`${block.type}-${index}`} className={className}>
                    {block.text}
                  </p>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-4 py-10">
          <div className="mx-auto max-w-6xl">
            <div className="text-center text-xl tracking-[.18em] uppercase text-outlaw-gold" style={{ fontFamily: "'Monoton', cursive" }}>
              THE ACCIDENTAL ROADMAP
            </div>
            <div className="mt-7 grid gap-4 md:grid-cols-4">
              {STEPS.map((step, index) => (
                <div key={step.title} className="rounded-2xl border border-white/10 bg-white/[.025] p-5">
                  <div className="text-[7px] tracking-widest text-kinetic-orange" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                    0{index + 1}
                  </div>
                  <div className="mt-3 text-2xl text-white" style={{ fontFamily: "'Rye', serif" }}>{step.title}</div>
                  <p className="mt-3 text-sm leading-relaxed text-white/45">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-14">
          <div className="mx-auto max-w-4xl rounded-3xl border border-outlaw-gold/25 bg-outlaw-gold/[.035] p-8 text-center">
            <div className="text-[8px] tracking-[.25em] text-outlaw-gold uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              THE POINT
            </div>
            <h2 className="mt-4 text-3xl sm:text-4xl text-white" style={{ fontFamily: "'Rye', serif" }}>
              Games built for the room, not the algorithm.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-white/55">
              TNG is about giving hosts and communities something real to do together: laugh, compete, argue about rules, talk trash, meet people and make a livestream feel like an event.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/games" className="rounded-xl border-2 border-outlaw-gold px-6 py-3 text-[8px] tracking-widest text-outlaw-gold uppercase hover:bg-outlaw-gold hover:text-black" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                ENTER THE ARCADE
              </Link>
              <Link to="/contact" className="rounded-xl border border-cyber-purple/60 px-6 py-3 text-[8px] tracking-widest text-cyber-purple uppercase hover:bg-cyber-purple/10" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                GOT A GAME IDEA?
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
