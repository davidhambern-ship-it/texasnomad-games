import { useState, useEffect, useCallback } from 'react';

export const SUIT_PRESETS = [
  { label: 'Spades First',  suits: ['♠', '♥', '♦', '♣'] },
  { label: 'Clubs First',   suits: ['♣', '♦', '♥', '♠'] },
  { label: 'Hearts First',  suits: ['♥', '♦', '♣', '♠'] },
  { label: 'Custom',        suits: null },
];

const RANK_ORDER = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2, 'BJ': 16, 'LJ': 15 };

const STORAGE_KEY = 'tn_spades_suit_order';

const DEFAULT_SUITS = ['♠', '♥', '♦', '♣'];

function loadSavedOrder() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length === 4) return parsed;
    }
  } catch {}
  return DEFAULT_SUITS;
}

export function useSuitOrder() {
  const [suitOrder, setSuitOrderState] = useState(loadSavedOrder);

  const setSuitOrder = useCallback((order) => {
    setSuitOrderState(order);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(order)); } catch {}
  }, []);

  const sortHand = useCallback((hand) => {
    if (!hand || hand.length === 0) return [];
    return [...hand].sort((a, b) => {
      const ai = suitOrder.indexOf(a.suit === 'Joker' ? (a.value === 'BJ' ? '♠' : '♠') : a.suit);
      const bi = suitOrder.indexOf(b.suit === 'Joker' ? (b.value === 'BJ' ? '♠' : '♠') : b.suit);
      // Jokers go to end
      const aIdx = a.suit === 'Joker' ? 99 : (ai === -1 ? 98 : ai);
      const bIdx = b.suit === 'Joker' ? 99 : (bi === -1 ? 98 : bi);
      if (aIdx !== bIdx) return aIdx - bIdx;
      return (RANK_ORDER[b.value] || 0) - (RANK_ORDER[a.value] || 0);
    });
  }, [suitOrder]);

  return { suitOrder, setSuitOrder, sortHand };
}