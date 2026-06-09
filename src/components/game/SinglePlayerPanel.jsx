import React, { useState, useRef } from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

/**
 * SinglePlayerPanel — shown in all games when playing in 1P vs CPU mode.
 * Displays CPU opponent info, game status, and game-specific controls.
 *
 * Props:
 *   cpuCharacter: { name, avatar, difficulty, role }
 *   gameLabel: string
 *   children: optional extra controls
 */
export default function SinglePlayerPanel({ cpuCharacter, gameLabel, children }) {
  const [expanded, setExpanded] = useState(true);

  if (!cpuCharacter) return null;

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header bar */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-t-xl border-2 border-[#FFD700]/40 bg-[#FFD700]/5 transition-all"
        style={{ borderBottomLeftRadius: expanded ? 0 : '0.75rem', borderBottomRightRadius: expanded ? 0 : '0.75rem' }}
      >
        <div className="flex items-center gap-3">
          <img src={cpuCharacter.avatar} alt={cpuCharacter.name} className="w-8 h-8 rounded-lg border border-[#FFD700]/30 object-cover" />
          <div className="text-left">
            <div className="text-[7px] text-[#FFD700]/50 uppercase tracking-widest" style={PS2}>VS CPU · {gameLabel}</div>
            <div className="font-heading text-sm text-[#FFD700] tracking-widest uppercase">{cpuCharacter.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2 py-0.5 rounded border border-[#BC13FE]/40 text-[#BC13FE] text-[6px] uppercase tracking-widest" style={PS2}>
            LV {cpuCharacter.difficulty}
          </div>
          <span className="text-[#FFD700]/60 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-2 border-t-0 border-[#FFD700]/40 rounded-b-xl bg-black/80 px-4 py-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="text-[6px] text-white/30 uppercase tracking-widest" style={PS2}>Role</div>
            <div className="text-[7px] text-white/60 tracking-wide" style={PS2}>{cpuCharacter.role}</div>
          </div>
          {children}
        </div>
      )}
    </div>
  );
}