import React from 'react';
import TXDDomino from '@/components/domino/TXDDomino';

// This list is the single source of truth for ALL games on the platform.
// When a new game is added, add it here and it automatically appears in the Host Panel.
export const ALL_GAMES = [
  { id: 'nomadic-bowling', title: 'NOMADIC BOWLING', subtitle: 'ROLL STRAIGHT · PLAY DIRTY', color: '#32e6ff', emoji: '🎳', path: '/games/nomadic-bowling', hostPath: '/games/nomadic-bowling?host=1', standalone: true },
  { id: 'out', title: 'OUT!', subtitle: 'LAST CARD · LOUD CALL', color: '#f2c14e', emoji: '🃏', path: '/games/out', hostPath: '/games/out?host=1', standalone: true },
  {
    id: 'bff',
    title: 'BFF',
    subtitle: 'BIGO FAMILY FEUD',
    color: '#BC13FE',
    emoji: '🎤',
    path: '/games/bff',
  },
  {
    id: 'square-biz',
    title: 'SQUARE BIZ!',
    subtitle: 'TRIVIA + TACTICS',
    color: '#FF5F1F',
    emoji: '🎯',
    path: '/games/square-biz',
  },
  {
    id: 'hangman',
    title: 'HANGMAN',
    subtitle: 'GUESS THE WORD',
    color: '#FFD700',
    emoji: '🔤',
    path: '/games/hangman',
  },
  {
    id: 'spades',
    title: 'SPADES',
    subtitle: 'CARD GAME',
    color: '#4ade80',
    emoji: '♠️',
    path: '/games/spades',
  },
  {
    id: 'word-search',
    title: 'WORD SEARCH',
    subtitle: 'HUNT EVERY LETTER',
    color: '#00c875',
    emoji: '🔍',
    path: '/games/word-search',
  },
  {
    id: 'viral',
    title: 'VIRAL!',
    subtitle: 'CREATOR JOURNEY',
    color: '#BC13FE',
    iconType: 'viral-stars',
    path: '/games/viral',
    hostPath: '/games/viral?host=1',
    standalone: true,
  },
  {
    id: 'dominoes',
    title: 'DOMINOES',
    subtitle: 'TEXAS DOMINO SHOWDOWN',
    color: '#FFD700',
    iconType: 'domino-32',
    path: '/games/dominoes',
    hostPath: '/games/dominoes/host',
    standalone: true,
  },
  {
    id: 'see-that',
    title: 'SEE THAT?!',
    subtitle: 'HIDDEN OBJECT PARTY',
    color: '#4ade80',
    emoji: '👁',
    path: '/games/see-that',
    hostPath: '/games/see-that?host=1',
    standalone: true,
  },
  {
    id: 'word-wrangler',
    title: 'WORD WRANGLER',
    subtitle: 'LIVE WORD RACE',
    color: '#BC13FE',
    emoji: '🔤',
    path: '/games/word-wrangler',
    hostPath: '/games/word-wrangler?host=1',
    standalone: true,
  },
  {
    id: 'sudoku',
    title: 'BATTLESUDOKU',
    subtitle: 'SOLVE · FIRE · SINK',
    color: '#22d3ee',
    emoji: '⚓',
    path: '/games/sudoku',
    hostPath: '/games/sudoku?host=1',
    standalone: true,
  },
  {
    id: 'rodeo-rumble',
    title: 'RODEO RUMBLE',
    subtitle: 'PARTY BRAWLER · 8 PLAYERS',
    color: '#ff7a3d',
    emoji: '🤠',
    path: '/games/rodeo-rumble',
    hostPath: '/games/rodeo-rumble?host=1',
    standalone: true,
  },
];

export function HostGameIcon({ game, size = 'lg' }) {
  const compact = size === 'sm';

  if (game?.iconType === 'viral-stars') {
    const box = compact ? 'h-8 w-12' : 'h-14 w-20';
    const main = compact ? 'text-2xl' : 'text-4xl';
    const side = compact ? 'text-xl' : 'text-3xl';

    return (
      <div className={`relative ${box}`} aria-label="VIRAL stars">
        <span
          className={`absolute left-0 top-3 ${side} leading-none`}
          style={{ color: '#BC13FE', textShadow: '0 0 12px #BC13FE' }}
        >
          ★
        </span>
        <span
          className={`absolute left-1/2 top-0 -translate-x-1/2 ${main} leading-none`}
          style={{ color: '#FF5F1F', textShadow: '0 0 14px #FF5F1F' }}
        >
          ★
        </span>
        <span
          className={`absolute right-0 top-3 ${side} leading-none`}
          style={{ color: '#FF2FD1', textShadow: '0 0 12px #FF2FD1' }}
        >
          ★
        </span>
      </div>
    );
  }

  if (game?.iconType === 'domino-32') {
    return (
      <div
        className="flex items-center justify-center"
        style={{ filter: 'drop-shadow(0 0 8px rgba(255,215,0,.35))' }}
        aria-label="TNG 3-2 domino"
      >
        <TXDDomino
          top={3}
          bottom={2}
          width={compact ? 18 : 26}
          orientation="vertical"
          style={{ pointerEvents: 'none' }}
        />
      </div>
    );
  }

  return (
    <span className={compact ? 'text-xl' : 'text-5xl'}>
      {game?.emoji || '🎮'}
    </span>
  );
}
