import React from 'react';
import { Link } from 'react-router-dom';
import { TEXASNOMAD_CHARACTERS } from '@/data/texasNomadCharacters';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const AI_VICTORY_LINES = {
  berna:    ['Good game.', 'Well played.', 'Respect.'],
  dexter:   ['The numbers finally caught up.', 'Statistically inevitable.', 'As expected.'],
  lemonade: ["Told y'all!", 'Easy money!', 'That\'s how we do it!'],
  tank:     ['Patience.', 'Slow and steady.', 'Didn\'t rush it.'],
  carlos:   ['I definitely planned that.', 'Classic Carlos.', 'Called it.'],
  violet:   ['Well played.', 'Team effort.', 'We worked together.'],
};

const AI_DEFEAT_LINES = {
  berna:    ['Good game.', 'Next time.', 'Respect.'],
  dexter:   ['Miscalculated.', 'The data was wrong.', 'Unusual outcome.'],
  lemonade: ["Nah nah nah, rematch!", 'That was a fluke!', 'We weren\'t warmed up.'],
  tank:     ['We\'ll get \'em next time.', 'Stay patient.', 'Reset.'],
  carlos:   ['Also planned that.', 'Part of the plan.', 'I let you win.'],
  violet:   ['Good match.', 'We\'ll be better.', 'Learning experience.'],
};

export default function SpadesMatchOver({ gs, onPlayAgain, onLobby }) {
  const score1 = gs.score1 || 0;
  const score2 = gs.score2 || 0;
  const winnerTeam = score1 >= 100 ? 1 : 2;
  const winnerName = winnerTeam === 1 ? (gs.team1Name || 'Team A') : (gs.team2Name || 'Team B');
  const winnerScore = winnerTeam === 1 ? score1 : score2;
  const loserScore = winnerTeam === 1 ? score2 : score1;
  const loserName = winnerTeam === 1 ? (gs.team2Name || 'Team B') : (gs.team1Name || 'Team A');

  // Find AI characters present in the game
  const aiPlayers = (gs.players || []).filter(p => p.playerType === 'cpu' && p.characterId);
  const aiReactions = aiPlayers.map(p => {
    const char = TEXASNOMAD_CHARACTERS.find(c => c.id === p.characterId);
    if (!char) return null;
    const isWinningTeam = (winnerTeam === 1 && (p.seatNumber === 1 || p.seatNumber === 3)) ||
                          (winnerTeam === 2 && (p.seatNumber === 2 || p.seatNumber === 4));
    const lines = isWinningTeam ? (AI_VICTORY_LINES[p.characterId] || []) : (AI_DEFEAT_LINES[p.characterId] || []);
    const line = lines[Math.floor(Math.random() * lines.length)];
    return { char, line, isWinningTeam };
  }).filter(Boolean);

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[200] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-[#0a0a1a] to-[#050510] border-4 border-[#FFD700]/60 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center space-y-5"
        style={{ boxShadow: '0 0 80px rgba(255,215,0,0.4)' }}>

        <div className="text-6xl">🏆</div>
        <div style={{ ...PS2, fontSize: 14, color: '#FFD700' }} className="uppercase tracking-widest">Match Over</div>

        <div className="border-2 border-[#FFD700]/30 rounded-xl p-4 bg-[#FFD700]/5">
          <div style={{ ...PS2, fontSize: 8, color: '#ffffff60' }} className="uppercase mb-1">Winner</div>
          <div className="font-heading text-3xl text-[#FFD700] uppercase tracking-widest">{winnerName}</div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="border-2 rounded-xl p-3" style={{ borderColor: '#BC13FE60', background: '#BC13FE08' }}>
            <div style={{ ...PS2, fontSize: 7, color: '#BC13FE80' }} className="uppercase mb-1 truncate">
              {gs.team1Name || 'Team A'}
            </div>
            <div className="font-heading text-3xl" style={{ color: winnerTeam === 1 ? '#FFD700' : '#ffffff60' }}>
              {score1}
            </div>
          </div>
          <div className="border-2 rounded-xl p-3" style={{ borderColor: '#FF5F1F60', background: '#FF5F1F08' }}>
            <div style={{ ...PS2, fontSize: 7, color: '#FF5F1F80' }} className="uppercase mb-1 truncate">
              {gs.team2Name || 'Team B'}
            </div>
            <div className="font-heading text-3xl" style={{ color: winnerTeam === 2 ? '#FFD700' : '#ffffff60' }}>
              {score2}
            </div>
          </div>
        </div>

        {/* AI reactions */}
        {aiReactions.length > 0 && (
          <div className="space-y-2">
            {aiReactions.map(({ char, line, isWinningTeam }, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg border text-left"
                style={{ borderColor: isWinningTeam ? '#FFD70040' : '#ffffff10', background: isWinningTeam ? '#FFD70008' : 'transparent' }}>
                <img src={char.avatar} alt={char.name} className="w-8 h-8 rounded-lg shrink-0" />
                <div>
                  <div style={{ ...PS2, fontSize: 6, color: isWinningTeam ? '#FFD700' : '#ffffff50' }} className="uppercase mb-0.5">{char.name}</div>
                  <div className="text-white/70 text-sm italic">"{line}"</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 pt-2">
          <button onClick={onPlayAgain}
            className="w-full py-4 rounded-xl border-2 border-[#FFD700] text-[#FFD700] font-heading tracking-widest uppercase hover:bg-[#FFD700]/20 transition-all active:scale-95"
            style={PS2}>
            🔄 Play Again
          </button>
          <button onClick={onLobby}
            className="w-full py-4 rounded-xl border-2 border-white/30 text-white/60 font-heading tracking-widest uppercase hover:bg-white/10 transition-all active:scale-95"
            style={PS2}>
            🏠 Return to Lobby
          </button>
        </div>
      </div>
    </div>
  );
}