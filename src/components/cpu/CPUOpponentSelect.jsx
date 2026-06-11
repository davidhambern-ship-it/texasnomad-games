import React, { useState } from 'react';
import { TEXASNOMAD_CHARACTERS, getRandomCharacter } from '@/data/texasNomadCharacters';
import CPUOpponentCard from './CPUOpponentCard';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

/**
 * CPU Opponent Selection Screen
 * Props:
 *   gameKey: 'bff' | 'squareBiz' | 'hangman' | 'spades'
 *   gameName: string (display name)
 *   onSelect: (character) => void
 *   onBack: () => void
 */
export default function CPUOpponentSelect({ gameKey, gameName, onSelect, onBack }) {
  const [selectedId, setSelectedId] = useState(null);
  const isPartnerGame = gameKey === 'spades';

  const characters = TEXASNOMAD_CHARACTERS.filter(c => c.gameProfiles?.[gameKey]);
  const selected = characters.find(c => c.id === selectedId);

  const handleRandom = () => {
    const randomChar = getRandomCharacter();
    setSelectedId(randomChar.id);
  };

  const handleStart = () => {
    if (selected) onSelect(selected);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#050505]/95 backdrop-blur-xl border-b border-[#BC13FE]/20 px-4 h-14 flex items-center justify-between">
        <button onClick={onBack}
          className="flex items-center gap-2 text-[#BC13FE]/70 hover:text-[#BC13FE] transition-colors"
          style={PS2}>
          <span className="text-sm">←</span>
          <span className="text-[8px] tracking-widest uppercase">Back</span>
        </button>
        <div className="text-[#FFD700] text-[9px] tracking-widest uppercase hidden sm:block" style={PS2}>
          {gameName} · Single Player
        </div>
        <div className="w-16" />
      </div>

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {/* Title */}
        <div className="text-center mb-8">
          <div className="text-[8px] tracking-[0.4em] uppercase text-[#BC13FE]/70 mb-2" style={PS2}>
            TexasNomad Team
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl tracking-widest uppercase text-white" style={{ textShadow: '0 0 30px rgba(188,19,254,0.3)' }}>
            {isPartnerGame ? 'Choose Your Partner' : 'Choose Your Opponent'}
          </h1>
          <p className="mt-2 text-white/40 text-sm font-body">
            {isPartnerGame
              ? 'Pick a TexasNomad character as your partner. You\'ll face the other two as opponents.'
              : 'Play against the TexasNomad Team. Each character plays differently.'}
          </p>
        </div>

        {/* Random button */}
        <div className="flex justify-center mb-6">
          <button
            onClick={handleRandom}
            className="px-6 py-3 rounded-xl border-2 font-heading text-sm tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
            style={{ borderColor: '#BC13FE60', color: '#BC13FEcc', background: '#BC13FE10' }}>
            🎲 {isPartnerGame ? 'Random Partner' : 'Random Opponent'}
          </button>
        </div>

        {/* Character Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {characters.map(character => (
            <CPUOpponentCard
              key={character.id}
              character={character}
              selected={selectedId === character.id}
              onSelect={() => setSelectedId(character.id)}
              gameKey={gameKey}
            />
          ))}
        </div>

        {/* Start button */}
        {selected && (
          <div className="sticky bottom-6 flex justify-center">
            <div className="flex items-center gap-4 px-6 py-4 rounded-2xl border-2 border-[#FFD700]"
              style={{ background: 'rgba(5,5,5,0.95)', backdropFilter: 'blur(12px)', boxShadow: '0 0 30px rgba(255,215,0,0.2)' }}>
              <img src={selected.avatar} alt={selected.name} className="w-10 h-10 rounded-lg border border-[#FFD700]/40" />
              <div>
                <div className="text-[7px] text-[#FFD700]/60 uppercase tracking-widest" style={PS2}>{isPartnerGame ? 'Partner Selected' : 'Opponent Selected'}</div>
                <div className="font-heading text-lg text-[#FFD700] tracking-widest uppercase">{selected.name}</div>
              </div>
              <button
                onClick={handleStart}
                className="px-6 py-3 rounded-xl font-heading text-base tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
                style={{ background: '#FFD700', color: '#000', boxShadow: '0 0 20px rgba(255,215,0,0.4)' }}>
                ▶ Start Game
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}