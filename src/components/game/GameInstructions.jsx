import React, { useState } from 'react';
import { X, Gamepad2, Trophy, Users, Clock, Lightbulb } from 'lucide-react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const HEADING = { fontFamily: "'Teko', sans-serif" };

const GAME_DATA = {
  'bff': {
    title: 'BFF',
    subtitle: 'BIG FAMILY FEUD',
    howToPlay: [
      { icon: <Users className="w-5 h-5" />, title: 'Teams of 2', desc: 'Partner up with a teammate' },
      { icon: <Lightbulb className="w-5 h-5" />, title: 'Guess Answers', desc: 'Match the top survey responses' },
      { icon: <Trophy className="w-5 h-5" />, title: 'Most Points Wins', desc: 'Highest score after all rounds' },
    ],
    hostPanel: [
      { icon: <Gamepad2 className="w-5 h-5" />, title: 'Control Game', desc: 'Start rounds, reveal answers' },
      { icon: <Users className="w-5 h-5" />, title: 'Manage Teams', desc: 'Add/remove players as needed' },
      { icon: <Trophy className="w-5 h-5" />, title: 'Track Scores', desc: 'Points awarded automatically' },
    ],
  },
  'square-biz': {
    title: 'SQUARE BIZ!',
    subtitle: 'TRIVIA + TACTICS',
    howToPlay: [
      { icon: <Lightbulb className="w-5 h-5" />, title: 'Answer Trivia', desc: 'Pick the correct multiple choice' },
      { icon: <Clock className="w-5 h-5" />, title: 'Beat the Timer', desc: 'Quick answers = more points' },
      { icon: <Trophy className="w-5 h-5" />, title: 'Top Score Wins', desc: 'Most points after all questions' },
    ],
    hostPanel: [
      { icon: <Gamepad2 className="w-5 h-5" />, title: 'Run Game', desc: 'Advance questions, reveal answers' },
      { icon: <Users className="w-5 h-5" />, title: 'Manage Players', desc: 'Seat assignments and scoring' },
      { icon: <Clock className="w-5 h-5" />, title: 'Control Timer', desc: 'Set pace for each question' },
    ],
  },
  'hangman': {
    title: 'HANGMAN',
    subtitle: 'GUESS THE WORD',
    howToPlay: [
      { icon: <Lightbulb className="w-5 h-5" />, title: 'Guess Letters', desc: 'Pick letters to reveal the word' },
      { icon: <Clock className="w-5 h-5" />, title: 'Beat Opponents', desc: 'Solve first to win the round' },
      { icon: <Trophy className="w-5 h-5" />, title: 'Most Rounds Wins', desc: 'Best solver takes the crown' },
    ],
    hostPanel: [
      { icon: <Gamepad2 className="w-5 h-5" />, title: 'Control Game', desc: 'Start rounds, reveal word' },
      { icon: <Users className="w-5 h-5" />, title: 'Manage Players', desc: 'Track turns and scores' },
      { icon: <Lightbulb className="w-5 h-5" />, title: 'Select Words', desc: 'Choose difficulty level' },
    ],
  },
  'spades': {
    title: 'SPADES',
    subtitle: 'TEXASNOMAD DECK',
    howToPlay: [
      { icon: <Users className="w-5 h-5" />, title: 'Partnership Game', desc: 'Work with your partner' },
      { icon: <Lightbulb className="w-5 h-5" />, title: 'Bid & Trick', desc: 'Predict and win your tricks' },
      { icon: <Trophy className="w-5 h-5" />, title: 'Reach Target', desc: 'First team to win threshold' },
    ],
    hostPanel: [
      { icon: <Gamepad2 className="w-5 h-5" />, title: 'Deal Cards', desc: 'Shuffle and distribute hands' },
      { icon: <Users className="w-5 h-5" />, title: 'Track Bids', desc: 'Record and display all bids' },
      { icon: <Clock className="w-5 h-5" />, title: 'Manage Turns', desc: 'Advance play through rounds' },
    ],
  },
  'word-search': {
    title: 'WORD SEARCH',
    subtitle: 'NOMADIC WORD HUNT',
    howToPlay: [
      { icon: <Lightbulb className="w-5 h-5" />, title: 'Find Words', desc: 'Search the grid for hidden words' },
      { icon: <Clock className="w-5 h-5" />, title: 'Race Others', desc: 'Fastest finder gets most points' },
      { icon: <Trophy className="w-5 h-5" />, title: 'Complete First', desc: 'Find all words to win' },
    ],
    hostPanel: [
      { icon: <Gamepad2 className="w-5 h-5" />, title: 'Start Game', desc: 'Launch puzzle for all players' },
      { icon: <Users className="w-5 h-5" />, title: 'Monitor Progress', desc: 'See who finds words first' },
      { icon: <Clock className="w-5 h-5" />, title: 'Set Timer', desc: 'Control game duration' },
    ],
  },
  'sudoku': {
    title: 'SUDOKU',
    subtitle: 'COMPETITIVE PUZZLE',
    howToPlay: [
      { icon: <Lightbulb className="w-5 h-5" />, title: 'Fill the Grid', desc: 'Complete 9x9 with 1-9' },
      { icon: <Clock className="w-5 h-5" />, title: 'Race the Clock', desc: 'Finish before time runs out' },
      { icon: <Trophy className="w-5 h-5" />, title: 'Fastest Wins', desc: 'First to complete takes the crown' },
    ],
    hostPanel: [
      { icon: <Gamepad2 className="w-5 h-5" />, title: 'Set Difficulty', desc: 'Choose easy, medium, hard, expert' },
      { icon: <Users className="w-5 h-5" />, title: 'Track Players', desc: 'Monitor completion status' },
      { icon: <Clock className="w-5 h-5" />, title: 'Control Timer', desc: 'Set time limit for puzzle' },
    ],
  },
  'name-that-track': {
    title: 'NAME THAT TRACK',
    subtitle: 'MUSIC TRIVIA',
    howToPlay: [
      { icon: <Lightbulb className="w-5 h-5" />, title: 'Listen & Guess', desc: 'Identify songs from clips' },
      { icon: <Clock className="w-5 h-5" />, title: 'Quick Answers', desc: 'Fastest correct answer wins' },
      { icon: <Trophy className="w-5 h-5" />, title: 'Most Points Wins', desc: 'Top score after all rounds' },
    ],
    hostPanel: [
      { icon: <Gamepad2 className="w-5 h-5" />, title: 'Play Clips', desc: 'Control music playback' },
      { icon: <Users className="w-5 h-5" />, title: 'Manage Players', desc: 'Track scores and turns' },
      { icon: <Trophy className="w-5 h-5" />, title: 'Reveal Answers', desc: 'Show correct song info' },
    ],
  },
  'viral': {
    title: 'VIRAL',
    subtitle: 'GO VIRAL BOARD GAME',
    howToPlay: [
      { icon: <Users className="w-5 h-5" />, title: 'Move & Compete', desc: 'Navigate the board space' },
      { icon: <Lightbulb className="w-5 h-5" />, title: 'Gain Followers', desc: 'Build your social empire' },
      { icon: <Trophy className="w-5 h-5" />, title: 'Go Viral First', desc: 'Most followers wins the game' },
    ],
    hostPanel: [
      { icon: <Gamepad2 className="w-5 h-5" />, title: 'Roll Dice', desc: 'Advance players on board' },
      { icon: <Users className="w-5 h-5" />, title: 'Track Stats', desc: 'Monitor followers and money' },
      { icon: <Trophy className="w-5 h-5" />, title: 'Declare Winner', desc: 'End game when goal reached' },
    ],
  },
};

export default function GameInstructions({ gameId, onDismiss }) {
  const [activeTab, setActiveTab] = useState('how-to-play');
  const data = GAME_DATA[gameId] || GAME_DATA['bff'];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{
          border: '2px solid #BC13FE',
          background: 'linear-gradient(135deg, #0d0a20 0%, #1a0f2e 100%)',
          boxShadow: '0 0 60px rgba(188,19,254,0.3)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#BC13FE]/30">
          <div>
            <h2 style={{ ...HEADING, fontSize: 32, color: '#FFD700', textShadow: '0 0 20px #FFD700' }}>
              {data.title}
            </h2>
            <p style={{ ...PS2, fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>{data.subtitle}</p>
          </div>
          <button
            onClick={onDismiss}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#BC13FE]/30">
          <button
            onClick={() => setActiveTab('how-to-play')}
            className="flex-1 px-4 py-3 text-sm tracking-widest uppercase transition-colors"
            style={{
              ...PS2,
              fontSize: 9,
              background: activeTab === 'how-to-play' ? 'rgba(188,19,254,0.2)' : 'transparent',
              color: activeTab === 'how-to-play' ? '#FFD700' : 'rgba(255,255,255,0.4)',
            }}
          >
            How to Play
          </button>
          <button
            onClick={() => setActiveTab('host-panel')}
            className="flex-1 px-4 py-3 text-sm tracking-widest uppercase transition-colors"
            style={{
              ...PS2,
              fontSize: 9,
              background: activeTab === 'host-panel' ? 'rgba(188,19,254,0.2)' : 'transparent',
              color: activeTab === 'host-panel' ? '#FFD700' : 'rgba(255,255,255,0.4)',
            }}
          >
            Host Panel
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'how-to-play' ? (
            <div className="space-y-4">
              {data.howToPlay.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-4 p-4 rounded-xl border"
                  style={{
                    borderColor: 'rgba(188,19,254,0.3)',
                    background: 'rgba(188,19,254,0.05)',
                  }}
                >
                  <div
                    className="p-2 rounded-lg"
                    style={{
                      background: 'rgba(188,19,254,0.2)',
                      color: '#BC13FE',
                    }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <h3 style={{ ...HEADING, fontSize: 20, color: '#FFD700' }}>{item.title}</h3>
                    <p style={{ ...PS2, fontSize: 7, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {data.hostPanel.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-4 p-4 rounded-xl border"
                  style={{
                    borderColor: 'rgba(255,95,31,0.3)',
                    background: 'rgba(255,95,31,0.05)',
                  }}
                >
                  <div
                    className="p-2 rounded-lg"
                    style={{
                      background: 'rgba(255,95,31,0.2)',
                      color: '#FF5F1F',
                    }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <h3 style={{ ...HEADING, fontSize: 20, color: '#FF5F1F' }}>{item.title}</h3>
                    <p style={{ ...PS2, fontSize: 7, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#BC13FE]/30">
          <button
            onClick={onDismiss}
            className="w-full py-4 rounded-xl font-heading text-xl tracking-widest uppercase hover:opacity-90 transition-all"
            style={{
              background: 'linear-gradient(135deg,#BC13FE,#9333ea)',
              color: 'white',
              boxShadow: '0 0 20px rgba(188,19,254,0.4)',
            }}
          >
            ✅ LET'S PLAY
          </button>
        </div>
      </div>
    </div>
  );
}