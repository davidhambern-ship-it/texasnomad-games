import React, { useState, useEffect, useRef } from 'react';
import { getDialogueLine, getCatchphrase, DIALOGUE_COOLDOWN_MS } from '@/data/texasNomadDialogue';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const MOOD_CONFIG = {
  Ready:      { color: '#4ade80', icon: '🟢', label: 'Ready' },
  Thinking:   { color: '#FFD700', icon: '🤔', label: 'Thinking…' },
  Confident:  { color: '#BC13FE', icon: '😏', label: 'Confident' },
  Pressured:  { color: '#FF5F1F', icon: '😤', label: 'Pressured' },
  Frustrated: { color: '#ef4444', icon: '😠', label: 'Frustrated' },
  'Locked In':{ color: '#22d3ee', icon: '🔒', label: 'Locked In' },
  Celebrating:{ color: '#FFD700', icon: '🎉', label: 'Celebrating' },
};

/**
 * Inline CPU player card shown during active gameplay.
 * Props:
 *   character: character object
 *   mood: 'Ready'|'Thinking'|'Confident'|'Pressured'|'Frustrated'|'Locked In'|'Celebrating'
 *   dialogueMoment: string|null — triggers a dialogue line if provided (set to null to clear)
 *   compact: boolean — smaller version for in-game sidebars
 */
export default function CPUPlayerCard({ character, mood = 'Ready', dialogueMoment, compact = false }) {
  const [speechLine, setSpeechLine] = useState(null);
  const [speechVisible, setSpeechVisible] = useState(false);
  const lastDialogueMoment = React.useRef(null);
  const cooldownRef = React.useRef(0);

  useEffect(() => {
    if (!dialogueMoment || dialogueMoment === lastDialogueMoment.current) return;
    if (Date.now() - cooldownRef.current < DIALOGUE_COOLDOWN_MS) return;

    lastDialogueMoment.current = dialogueMoment;
    cooldownRef.current = Date.now();

    const line = getDialogueLine(character, dialogueMoment) || getCatchphrase(character);
    if (!line) return;

    setSpeechLine(line);
    setSpeechVisible(true);
    const timer = setTimeout(() => setSpeechVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [dialogueMoment, character]);

  const moodCfg = MOOD_CONFIG[mood] || MOOD_CONFIG.Ready;

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border"
        style={{ borderColor: `${moodCfg.color}40`, background: `${moodCfg.color}08` }}>
        <img src={character.avatar} alt={character.name} className="w-8 h-8 rounded-lg border border-white/10 shrink-0" />
        <div className="min-w-0">
          <div className="font-heading text-sm tracking-widest text-white uppercase leading-none">{character.name}</div>
          <div className="text-[6px] tracking-widest uppercase mt-0.5" style={{ ...PS2, color: moodCfg.color }}>
            {moodCfg.icon} {moodCfg.label}
          </div>
        </div>
        {speechVisible && speechLine && (
          <div className="flex-1 min-w-0 ml-1">
            <div className="px-2 py-1 rounded-lg border text-[8px] font-body text-white/80 truncate"
              style={{ borderColor: '#ffffff20', background: '#ffffff08' }}>
              "{speechLine}"
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative p-4 rounded-2xl border-2 transition-all"
      style={{ borderColor: `${moodCfg.color}50`, background: `${moodCfg.color}05` }}>

      {/* Header row */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative shrink-0">
          <img src={character.avatar} alt={character.name} className="w-12 h-12 rounded-xl border-2"
            style={{ borderColor: moodCfg.color }} />
          {/* Mood indicator dot */}
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#050505] flex items-center justify-center text-[8px]"
            style={{ background: moodCfg.color }}>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-heading text-xl tracking-widest text-white uppercase leading-tight">{character.name}</div>
          <div className="text-[7px] tracking-widest uppercase" style={{ ...PS2, color: '#BC13FEaa' }}>{character.role}</div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs">{moodCfg.icon}</span>
            <span className="text-[7px] tracking-widest uppercase" style={{ ...PS2, color: moodCfg.color }}>{moodCfg.label}</span>
          </div>
        </div>
        {/* Difficulty badge */}
        <div className="shrink-0 px-2 py-1 rounded-lg border text-center"
          style={{ borderColor: `${moodCfg.color}40`, background: `${moodCfg.color}10` }}>
          <div className="text-[5px] text-white/30 uppercase tracking-widest mb-0.5" style={PS2}>LVL</div>
          <div className="font-heading text-lg leading-none" style={{ color: moodCfg.color }}>{character.difficulty}</div>
        </div>
      </div>

      {/* Speech bubble */}
      <div className={`transition-all duration-300 overflow-hidden ${speechVisible && speechLine ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="relative px-3 py-2 rounded-xl border mt-1"
          style={{ borderColor: `${moodCfg.color}40`, background: `${moodCfg.color}08` }}>
          {/* Triangle */}
          <div className="absolute -top-2 left-5 w-3 h-3 rotate-45"
            style={{ background: `${moodCfg.color}15`, borderTop: `1px solid ${moodCfg.color}40`, borderLeft: `1px solid ${moodCfg.color}40` }} />
          <p className="text-white/80 text-xs font-body italic">"{speechLine}"</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to derive CPU mood from game state.
 */
export function useCpuMood({ playerScore = 0, cpuScore = 0, isCpuTurn = false, justMistake = false, gameOver = false, cpuWon = false }) {
  if (gameOver) return cpuWon ? 'Celebrating' : 'Pressured';
  if (justMistake) return 'Frustrated';
  if (isCpuTurn) return 'Thinking';
  const diff = cpuScore - playerScore;
  if (diff >= 2) return 'Confident';
  if (diff <= -2) return 'Pressured';
  if (Math.abs(diff) <= 1 && (playerScore + cpuScore) > 4) return 'Locked In';
  return 'Ready';
}