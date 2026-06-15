import React, { useState } from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const HEADING = { fontFamily: "'Teko', sans-serif" };

const GAME_DATA = {
  bff: {
    name: 'BFF — BIGO FAMILY FEUD',
    color: '#BC13FE',
    howToPlay: [
      { icon: '👥', title: 'JOIN A TEAM', desc: 'Players split into two teams. The host assigns seats from the Host Panel.' },
      { icon: '🎯', title: 'BUZZ IN', desc: 'When the question appears on screen, be the first to buzz in to answer for your team.' },
      { icon: '✅', title: 'MATCH THE SURVEY', desc: 'Give answers that match what the survey said. The closer to #1, the more points!' },
      { icon: '❌', title: 'THREE STRIKES', desc: 'Three wrong answers and the other team gets a chance to steal.' },
      { icon: '🏆', title: 'WIN THE ROUND', desc: 'The team with the most points at the end wins the game.' },
    ],
    hostInfo: 'The host controls the game from the Host Panel — revealing answers, marking correct/wrong, and advancing rounds. Players just buzz in and answer!',
  },
  'square-biz': {
    name: 'SQUARE BIZ! — TRIVIA',
    color: '#FFD700',
    howToPlay: [
      { icon: '🎮', title: 'PICK YOUR ROLE', desc: 'Choose to be a Contestant or Spectator when you join the room.' },
      { icon: '❓', title: 'ANSWER QUESTIONS', desc: 'Multiple choice trivia questions appear on screen. Select A, B, C, or D.' },
      { icon: '⚡', title: 'SPEED MATTERS', desc: 'Faster correct answers earn more points. Think quick!' },
      { icon: '📊', title: 'LEADERBOARD', desc: 'Track your score against other players in real time.' },
      { icon: '🏆', title: 'MOST POINTS WINS', desc: 'The player with the highest score when rounds end is the winner.' },
    ],
    hostInfo: 'The host selects and reveals questions from the Host Panel, controls the timer, and can advance to the next question at any time.',
  },
  hangman: {
    name: 'HANGMAN',
    color: '#FF5F1F',
    howToPlay: [
      { icon: '🔤', title: 'GUESS THE WORD', desc: 'A hidden word is shown as blank spaces. Guess one letter at a time.' },
      { icon: '✋', title: 'TAP A LETTER', desc: 'Press any letter on the on-screen keyboard to make your guess.' },
      { icon: '❌', title: 'WRONG GUESSES', desc: 'Each wrong letter adds a part to the hangman. Too many and it\'s game over!' },
      { icon: '💡', title: 'USE THE CLUE', desc: 'A category hint is shown above the word to help narrow it down.' },
      { icon: '🏆', title: 'SOLVE IT', desc: 'Reveal the full word before the hangman is complete to win!' },
    ],
    hostInfo: 'The host picks the word and category from the Host Panel and can reveal letters or skip the round at any time.',
  },
  spades: {
    name: 'SPADES — TN DECK',
    color: '#4ade80',
    howToPlay: [
      { icon: '🃏', title: 'GET DEALT CARDS', desc: 'Each player is dealt a hand of cards from the Texas Nomad deck.' },
      { icon: '🤔', title: 'PLACE YOUR BID', desc: 'Before play, each player bids how many tricks they think they\'ll win.' },
      { icon: '♠️', title: 'PLAY TRICKS', desc: 'Take turns playing cards. Highest card (or spade) wins the trick.' },
      { icon: '🎯', title: 'HIT YOUR BID', desc: 'Make exactly your bid for full points. Going over or under costs you!' },
      { icon: '🏆', title: 'REACH 500 POINTS', desc: 'First team or player to 500 points wins the match.' },
    ],
    hostInfo: 'The host manages the deal, bid phase, and scoring from the Host Panel. Players receive their cards on their device and play from there.',
  },
  'word-search': {
    name: 'WORD SEARCH',
    color: '#22d3ee',
    howToPlay: [
      { icon: '🔍', title: 'FIND THE WORDS', desc: 'A grid of letters hides several words. Find and highlight them all.' },
      { icon: '👆', title: 'DRAG TO SELECT', desc: 'Click/tap the first letter and drag to the last letter of a word.' },
      { icon: '↗️', title: 'ANY DIRECTION', desc: 'Words can be hidden horizontally, vertically, or diagonally.' },
      { icon: '⚡', title: 'RACE OPPONENTS', desc: 'Find more words faster than other players to score higher.' },
      { icon: '🏆', title: 'MOST WORDS WINS', desc: 'The player who finds the most words when time runs out wins.' },
    ],
    hostInfo: 'The host sets the word category and time limit from the Host Panel, then starts the round for all players simultaneously.',
  },
  sudoku: {
    name: 'SUDOKU TN',
    color: '#BC13FE',
    howToPlay: [
      { icon: '🔢', title: 'FILL THE GRID', desc: 'Complete the 9×9 grid so every row, column, and 3×3 box has digits 1–9.' },
      { icon: '👆', title: 'TAP A CELL', desc: 'Tap any empty cell to select it, then tap a number from the numpad.' },
      { icon: '✏️', title: 'USE NOTES', desc: 'Toggle Notes mode to pencil in candidate numbers without committing.' },
      { icon: '❌', title: 'AVOID MISTAKES', desc: '3 mistakes and you\'re eliminated. Think before you place!' },
      { icon: '🏆', title: 'FINISH FIRST', desc: 'Complete your unique puzzle before the timer (3 min) runs out to win.' },
    ],
    hostInfo: 'The host selects difficulty and starts the game from the Host Panel. Each player gets a unique puzzle — no copying!',
  },
  viral: {
    name: 'VIRAL — BOARD GAME',
    color: '#FF5F1F',
    howToPlay: [
      { icon: '🎲', title: 'ROLL THE DICE', desc: 'On your turn, roll the dice to move your token around the 120-space board.' },
      { icon: '📱', title: 'LAND ON SPACES', desc: 'Each space triggers an event — gain followers, lose money, draw a card, and more.' },
      { icon: '🛒', title: 'BUY EQUIPMENT', desc: 'Spend money to upgrade your gear (BS → Playing → Serious tier) for more reach.' },
      { icon: '🤝', title: 'GET SPONSORS', desc: 'Land on sponsor spaces to lock in brand deals and earn passive income.' },
      { icon: '🏆', title: 'GO VIRAL', desc: 'Hit 1 million followers before anyone else to win the game!' },
    ],
    hostInfo: 'The host controls turn order and can trigger special events from the Host Panel. AI players fill empty seats automatically.',
  },
  'name-that-track': {
    name: 'NAME THAT TRACK',
    color: '#FFD700',
    howToPlay: [
      { icon: '🎵', title: 'LISTEN UP', desc: 'A music clip plays — your job is to identify the song.' },
      { icon: '✍️', title: 'TYPE YOUR ANSWER', desc: 'Type the song title or artist name as fast as you can.' },
      { icon: '⚡', title: 'FIRST IS BEST', desc: 'The faster you answer correctly, the more points you earn.' },
      { icon: '🎶', title: 'MULTIPLE ROUNDS', desc: 'Play through several tracks across different categories.' },
      { icon: '🏆', title: 'MOST POINTS WINS', desc: 'Highest score after all rounds takes the crown.' },
    ],
    hostInfo: 'The host picks playlists and categories from the Host Panel, controls when each clip plays, and can reveal the answer at any time.',
  },
};

export default function GameInstructions({ gameId, onDismiss }) {
  const [tab, setTab] = useState('how');
  const data = GAME_DATA[gameId] || GAME_DATA['bff'];
  const color = data.color;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ border: `2px solid ${color}`, boxShadow: `0 0 60px ${color}40`, background: '#08050f' }}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center" style={{ borderBottom: `1px solid ${color}30` }}>
          <div style={{ ...HEADING, fontSize: 28, color, letterSpacing: '0.1em', lineHeight: 1.1 }}>{data.name}</div>
          <div style={{ ...PS2, fontSize: 7, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>HOW TO PLAY</div>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: `${color}30` }}>
          {[
            { key: 'how', label: '📖 HOW TO PLAY' },
            { key: 'host', label: '🎛 HOST PANEL' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-1 py-3 transition-all"
              style={{
                ...PS2, fontSize: 7,
                color: tab === t.key ? color : 'rgba(255,255,255,0.4)',
                background: tab === t.key ? `${color}15` : 'transparent',
                borderBottom: tab === t.key ? `2px solid ${color}` : '2px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-5" style={{ minHeight: 280 }}>
          {tab === 'how' && (
            <div className="space-y-4">
              {data.howToPlay.map((step, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="text-2xl shrink-0 w-8 text-center">{step.icon}</div>
                  <div>
                    <div style={{ ...PS2, fontSize: 8, color, marginBottom: 4 }}>{step.title}</div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {tab === 'host' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl" style={{ background: `${color}10`, border: `1px solid ${color}30` }}>
                <div style={{ ...PS2, fontSize: 8, color, marginBottom: 8 }}>🎛 WHAT THE HOST DOES</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>{data.hostInfo}</div>
              </div>
              <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ ...PS2, fontSize: 8, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>YOUR ROLE AS PLAYER</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
                  You play from your own device. The main game screen (TV/projector) is controlled by the host. Watch the screen, react on your phone!
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dismiss */}
        <div className="px-6 pb-6">
          <button
            onClick={onDismiss}
            className="w-full py-4 rounded-xl font-heading text-xl tracking-widest uppercase transition-all hover:opacity-90 active:scale-95"
            style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)`, color: '#000', fontFamily: "'Teko', sans-serif", fontSize: 22, boxShadow: `0 0 25px ${color}50` }}
          >
            ✅ LET'S PLAY!
          </button>
        </div>
      </div>
    </div>
  );
}