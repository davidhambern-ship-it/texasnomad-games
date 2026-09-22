import React, { useState } from 'react';

import Header from '@/components/home/Header';
import Footer from '@/components/home/Footer';

const CONTACT_EMAIL = 'hello@hireberna.app';

const REASONS = [
  'I need help building a game',
  'I have a game idea for TNG',
  'I want to host / collaborate',
  'I found something broken',
  'Something else entirely',
];

export default function Contact() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    reason: REASONS[0],
    idea: '',
    message: '',
  });

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = (event) => {
    event.preventDefault();

    const subject = `TNG Contact — ${form.reason}`;
    const body = [
      `Name: ${form.name || 'Not provided'}`,
      `Reply Email: ${form.email || 'Not provided'}`,
      `Reason: ${form.reason}`,
      '',
      form.idea ? `Game / Project: ${form.idea}` : '',
      '',
      form.message,
    ].filter(Boolean).join('\n');

    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="min-h-screen bg-midnight-void text-white overflow-x-hidden">
      <Header />

      <main className="px-4 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <div className="text-[8px] tracking-[.3em] text-kinetic-orange uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              GOT SOMETHING COOKING?
            </div>
            <h1 className="mt-4 text-5xl sm:text-7xl uppercase text-outlaw-gold" style={{ fontFamily: "'Monoton', cursive" }}>
              CONTACT
            </h1>
            <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-white/50">
              Need help building a game? Got an idea that belongs in the TNG arcade? Want to collaborate, host, test, break something on purpose or tell us what we accidentally broke?
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[.75fr_1.25fr]">
            <aside className="space-y-4">
              <div className="rounded-2xl border border-cyber-purple/35 bg-black/45 p-6">
                <div className="text-[7px] tracking-widest text-cyber-purple uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                  DIRECT LINE
                </div>
                <div className="mt-4 text-2xl text-white" style={{ fontFamily: "'Rye', serif" }}>TexasNomad Games</div>
                <a href={`mailto:${CONTACT_EMAIL}`} className="mt-3 block break-all text-outlaw-gold hover:text-white">
                  {CONTACT_EMAIL}
                </a>
                <p className="mt-4 text-sm leading-relaxed text-white/40">
                  This inbox is for game ideas, build help, collaborations, bugs, weird experiments and the occasional “yo, what if…” message.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
                <div className="text-[7px] tracking-widest text-kinetic-orange uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                  FIND TEXASNOMAD
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  <a href="https://www.bigo.tv/daberna" target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-white/10 px-4 py-3 text-white/60 hover:border-cyber-purple/50 hover:text-white">
                    BIGO · DaBerna
                  </a>
                  <a href="https://youtube.com/@bernatune?si=meQWazY1fXAjPeF0" target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-white/10 px-4 py-3 text-white/60 hover:border-red-500/50 hover:text-white">
                    YouTube · @bernatune
                  </a>
                  <a href="https://www.tiktok.com/@nomadic_libra?is_from_webapp=1&sender_device=pc" target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-white/10 px-4 py-3 text-white/60 hover:border-white/40 hover:text-white">
                    TikTok · @nomadic_libra
                  </a>
                </div>
              </div>
            </aside>

            <form onSubmit={submit} className="rounded-3xl border border-outlaw-gold/25 bg-black/45 p-6 sm:p-8">
              <div className="text-[7px] tracking-widest text-outlaw-gold uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                DROP THE IDEA ON THE TABLE
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="YOUR NAME">
                  <input required value={form.name} onChange={(event) => update('name', event.target.value)} className="contact-input" placeholder="What do we call you?" />
                </Field>
                <Field label="YOUR EMAIL">
                  <input required type="email" value={form.email} onChange={(event) => update('email', event.target.value)} className="contact-input" placeholder="you@example.com" />
                </Field>
              </div>

              <Field label="WHAT ARE WE TALKING ABOUT?">
                <select value={form.reason} onChange={(event) => update('reason', event.target.value)} className="contact-input">
                  {REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                </select>
              </Field>

              <Field label="GAME / PROJECT NAME — IF IT HAS ONE">
                <input value={form.idea} onChange={(event) => update('idea', event.target.value)} className="contact-input" placeholder="Square Biz 2: Electric Boogaloo?" />
              </Field>

              <Field label="TELL ME WHAT YOU'RE THINKING">
                <textarea required rows={7} value={form.message} onChange={(event) => update('message', event.target.value)} className="contact-input resize-y" placeholder="The weird ideas are usually the fun ones…" />
              </Field>

              <button type="submit" className="mt-2 w-full rounded-xl border-2 border-kinetic-orange bg-kinetic-orange/10 px-5 py-4 text-[8px] tracking-widest text-kinetic-orange uppercase hover:bg-kinetic-orange hover:text-black" style={{ fontFamily: "'Press Start 2P', monospace" }}>
                SEND IT TO BERNA →
              </button>

              <p className="mt-3 text-center text-[10px] leading-relaxed text-white/25">
                Submitting opens your email app with everything filled in for {CONTACT_EMAIL}.
              </p>
            </form>
          </div>
        </div>
      </main>

      <style>{`
        .contact-input {
          width: 100%;
          margin-top: .55rem;
          border-radius: .75rem;
          border: 1px solid rgba(188,19,254,.28);
          background: rgba(0,0,0,.55);
          padding: .85rem 1rem;
          color: white;
          outline: none;
        }
        .contact-input:focus {
          border-color: rgba(255,215,0,.7);
          box-shadow: 0 0 0 2px rgba(255,215,0,.06);
        }
        .contact-input option { background: #090411; }
      `}</style>

      <Footer />
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="mt-4 block">
      <span className="text-[7px] tracking-widest text-white/40 uppercase" style={{ fontFamily: "'Press Start 2P', monospace" }}>{label}</span>
      {children}
    </label>
  );
}
