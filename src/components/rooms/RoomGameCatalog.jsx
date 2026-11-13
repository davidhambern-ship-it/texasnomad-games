import React from 'react';
import TXDDomino from '@/components/domino/TXDDomino';

// This list is the single source of truth for ALL games on the platform.
// When a new game is added, add it here and it automatically appears in the room launcher.
export const ALL_GAMES = [
  {
    id: 'out',
    lobbyRules: 'Play cards from your hand and be the first player to get rid of every card.',
    title: 'OUT!',
    subtitle: 'LAST CARD WINS',
    color: '#FFD700',
    emoji: '🃏',
    path: '/games/out',
  },
  {
    id: 'bff',
    lobbyRules: 'Answer the prompts and compete with the room in this BIGO Family Feud-style game.',
    title: 'BFF',
    subtitle: 'BIGO FAMILY FEUD',
    color: '#BC13FE',
    emoji: '🎤',
    path: '/games/bff',
  },
  {
    id: 'square-biz',
    lobbyRules: 'Answer trivia questions and use strategy to claim squares on the board.',
    title: 'SQUARE BIZ!',
    subtitle: 'TRIVIA + TACTICS',
    color: '#FF5F1F',
    emoji: '🎯',
    path: '/games/square-biz',
  },
  {
    id: 'hangman',
    lobbyRules: 'Guess the hidden word one letter at a time before you run out of attempts.',
    title: 'HANGMAN',
    subtitle: 'GUESS THE WORD',
    color: '#FFD700',
    emoji: '🔤',
    path: '/games/hangman',
  },
  {
    id: 'spades',
    lobbyRules: 'Bid the tricks your team expects to take, then play hands to reach the target score.',
    title: 'SPADES',
    subtitle: 'CARD GAME',
    color: '#4ade80',
    emoji: '♠️',
    path: '/games/spades',
  },
  {
    id: 'word-search',
    lobbyRules: 'Find the hidden words in the letter grid and compete to discover them first.',
    title: 'WORD SEARCH',
    subtitle: 'HUNT EVERY LETTER',
    color: '#00c875',
    emoji: '🔍',
    path: '/games/word-search',
  },
  {
    id: 'viral',
    lobbyRules: 'Play through the creator journey and its challenges together.',
    title: 'VIRAL!',
    subtitle: 'CREATOR JOURNEY',
    color: '#BC13FE',
    iconType: 'viral-stars',
    path: '/games/viral',
  },
  {
    id: 'dominoes',
    lobbyRules: 'Match domino ends, take turns placing tiles, and score according to the table rules.',
    title: 'DOMINOES',
    subtitle: 'TEXAS DOMINO SHOWDOWN',
    color: '#FFD700',
    iconType: 'domino-32',
    path: '/games/dominoes',
  },
  {
    id: 'see-that',
    lobbyRules: 'Search each scene for the hidden objects before the other players.',
    title: 'SEE THAT?!',
    subtitle: 'HIDDEN OBJECT PARTY',
    color: '#4ade80',
    emoji: '👁',
    path: '/games/see-that',
  },
  {
    id: 'word-wrangler',
    lobbyRules: 'Race to build valid words from the available letters and earn points.',
    title: 'WORD WRANGLER',
    subtitle: 'LIVE WORD RACE',
    color: '#BC13FE',
    emoji: '🔤',
    path: '/games/word-wrangler',
  },
  {
    id: 'sudoku',
    lobbyRules: 'Solve Sudoku puzzles to earn battle actions, then fire at your opponent’s fleet.',
    title: 'BATTLESUDOKU',
    subtitle: 'SOLVE · FIRE · SINK',
    color: '#22d3ee',
    emoji: '⚓',
    path: '/games/sudoku',
  },
  {
    id: 'rodeo-rumble',
    lobbyRules: 'Battle in the arena, use your fighter’s moves, and avoid getting knocked out.',
    title: 'RODEO RUMBLE',
    subtitle: 'PARTY BRAWLER · 8 PLAYERS',
    color: '#ff7a3d',
    emoji: '🤠',
    path: '/games/rodeo-rumble',
  },
];

export function RoomGameIcon({ game, size = 'lg' }) {
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
