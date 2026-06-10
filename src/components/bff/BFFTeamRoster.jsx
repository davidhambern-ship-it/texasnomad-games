import React from 'react';
import { TEXASNOMAD_CHARACTERS } from '@/data/texasNomadCharacters';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const TN_TEAM = TEXASNOMAD_CHARACTERS;

/**
 * Shows both team rosters side by side.
 * Props:
 *   gs - game state
 *   playerId - current human player id
 *   humanPlayers - array of { playerId, playerName, familyTeam }
 */
export default function BFFTeamRoster({ gs, playerId, humanPlayers }) {
  const familyName = gs.family1 || 'Human Family';
  const tnTeamName = gs.family2 || 'TexasNomad Team';
  const activeTurn = gs.active_turn; // 1 or 2
  const answeringId = gs.answering_player_id;
  const aiMemberIdx = gs.ai_member_idx || 0;

  const team1 = humanPlayers.filter(p => p.familyTeam === 1 || p.familyTeam === '1');
  const team2 = TN_TEAM;

  const renderSlot = (name, isActive, isMe, avatar) => (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all"
      style={{
        borderColor: isActive ? '#FFD700' : '#ffffff10',
        background: isActive ? '#FFD70010' : 'transparent',
      }}>
      {avatar && <img src={avatar} alt={name} className="w-6 h-6 rounded" />}
      <span className="text-[7px] uppercase tracking-widest flex-1 truncate"
        style={{ ...PS2, color: isActive ? '#FFD700' : isMe ? '#22d3ee' : '#ffffff50' }}>
        {name}
      </span>
      {isActive && <span className="text-[6px] text-[#FFD700] animate-pulse" style={PS2}>▶</span>}
      {isMe && !isActive && <span className="text-[6px] text-[#22d3ee]/50" style={PS2}>YOU</span>}
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-3 w-full">
      {/* Team 1 — Human Family */}
      <div className="border-2 rounded-xl p-3 space-y-2"
        style={{ borderColor: activeTurn === 1 ? '#BC13FE' : '#BC13FE30', background: '#BC13FE05' }}>
        <div className="text-center">
          <div className="text-[7px] tracking-widest uppercase mb-0.5" style={{ ...PS2, color: activeTurn === 1 ? '#BC13FE' : '#BC13FE60' }}>
            {activeTurn === 1 ? '▶ ' : ''}{familyName}
          </div>
          <div className="font-heading text-2xl text-[#BC13FE]">{gs.score1 || 0}</div>
        </div>
        <div className="space-y-1">
          {team1.map(p => renderSlot(p.playerName || `Seat ${p.seatNumber}`, answeringId === p.playerId && activeTurn === 1, p.playerId === playerId, null))}
          {Array.from({ length: Math.max(0, 6 - team1.length) }).map((_, i) => (
            <div key={i} className="px-3 py-2 rounded-lg border border-white/5 text-center">
              <span className="text-[6px] text-white/15 uppercase" style={PS2}>open slot</span>
            </div>
          ))}
        </div>
      </div>

      {/* Team 2 — TexasNomad */}
      <div className="border-2 rounded-xl p-3 space-y-2"
        style={{ borderColor: activeTurn === 2 ? '#FF5F1F' : '#FF5F1F30', background: '#FF5F1F05' }}>
        <div className="text-center">
          <div className="text-[7px] tracking-widest uppercase mb-0.5" style={{ ...PS2, color: activeTurn === 2 ? '#FF5F1F' : '#FF5F1F60' }}>
            {activeTurn === 2 ? '▶ ' : ''}{tnTeamName}
          </div>
          <div className="font-heading text-2xl text-[#FF5F1F]">{gs.score2 || 0}</div>
        </div>
        <div className="space-y-1">
          {team2.map((c, i) => renderSlot(c.name, activeTurn === 2 && i === aiMemberIdx && !!gs.answering_ai, false, c.avatar))}
        </div>
      </div>
    </div>
  );
}