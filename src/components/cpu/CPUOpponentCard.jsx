import React from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const DIFFICULTY_LABELS = { 1:'Beginner', 2:'Beginner', 3:'Easy', 4:'Easy', 5:'Medium', 6:'Medium', 7:'Hard', 8:'Hard', 9:'Expert', 10:'Expert' };
const DIFFICULTY_COLORS = { 1:'#4ade80', 2:'#4ade80', 3:'#4ade80', 4:'#86efac', 5:'#FFD700', 6:'#FFD700', 7:'#FF5F1F', 8:'#FF5F1F', 9:'#ef4444', 10:'#ef4444' };

function DifficultyBar({ value }) {
  const color = DIFFICULTY_COLORS[value] || '#BC13FE';
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="w-2 h-2 rounded-sm transition-all"
            style={{ background: i < value ? color : '#ffffff15' }} />
        ))}
      </div>
      <span className="text-[7px] uppercase tracking-widest" style={{ ...PS2, color }}>{DIFFICULTY_LABELS[value]}</span>
    </div>
  );
}

export default function CPUOpponentCard({ character, selected, onSelect, gameKey }) {
  const profile = character.gameProfiles?.[gameKey];
  const borderColor = selected ? '#FFD700' : '#BC13FE30';
  const bg = selected ? '#FFD70008' : 'transparent';

  return (
    <div
      onClick={onSelect}
      className="relative rounded-2xl border-2 p-4 cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
      style={{
        borderColor,
        background: bg,
        boxShadow: selected ? '0 0 20px rgba(255,215,0,0.2)' : '0 0 10px rgba(188,19,254,0.05)',
      }}
    >
      {selected && (
        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs"
          style={{ background: '#FFD700', color: '#000' }}>✓</div>
      )}

      {/* Avatar */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0"
          style={{ borderColor: selected ? '#FFD700' : '#BC13FE40' }}>
          <img src={character.avatar} alt={character.name} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-heading text-xl tracking-widest text-white uppercase leading-tight">{character.name}</div>
          <div className="text-[7px] tracking-widest uppercase mt-0.5" style={{ ...PS2, color: '#BC13FEaa' }}>{character.role}</div>
          <div className="text-[7px] tracking-widest uppercase mt-0.5" style={{ ...PS2, color: '#ffffff30' }}>{character.archetype}</div>
        </div>
      </div>

      <DifficultyBar value={character.difficulty} />

      <p className="mt-2 text-white/60 text-xs font-body leading-relaxed">{character.shortDescription}</p>

      {/* Game profile */}
      {profile && (
        <div className="mt-2 px-2 py-1.5 rounded-lg border border-[#22d3ee]/20 bg-[#22d3ee]/5">
          <div className="text-[6px] tracking-widest uppercase mb-1" style={{ ...PS2, color: '#22d3eeaa' }}>
            {gameKey.toUpperCase()} STYLE
          </div>
          <div className="text-white/70 text-xs font-body">{profile.description}</div>
        </div>
      )}

      {/* Strengths / Weaknesses */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <div className="text-[6px] tracking-widest uppercase mb-1" style={{ ...PS2, color: '#4ade80aa' }}>Strengths</div>
          <div className="flex flex-wrap gap-1">
            {character.strengths.slice(0, 2).map(s => (
              <span key={s} className="text-[6px] px-1.5 py-0.5 rounded border" style={{ ...PS2, borderColor: '#4ade8030', color: '#4ade80aa' }}>{s}</span>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[6px] tracking-widest uppercase mb-1" style={{ ...PS2, color: '#ef4444aa' }}>Weaknesses</div>
          <div className="flex flex-wrap gap-1">
            {character.weaknesses.slice(0, 2).map(w => (
              <span key={w} className="text-[6px] px-1.5 py-0.5 rounded border" style={{ ...PS2, borderColor: '#ef444430', color: '#ef4444aa' }}>{w}</span>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        className="mt-3 w-full py-2 rounded-lg font-heading text-sm tracking-widest uppercase transition-all"
        style={{
          border: `2px solid ${selected ? '#FFD700' : '#BC13FE60'}`,
          color: selected ? '#FFD700' : '#BC13FEaa',
          background: selected ? '#FFD70010' : 'transparent',
        }}
      >
        {selected ? '✓ Selected' : 'Select'}
      </button>
    </div>
  );
}