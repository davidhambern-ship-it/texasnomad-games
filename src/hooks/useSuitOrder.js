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
      // Jokers are treated as spades (highest-ranked spades)
      const aSuit = a.suit === 'Joker' ? '♠' : a.suit;
      const bSuit = b.suit === 'Joker' ? '♠' : b.suit;
      const aIdx = suitOrder.indexOf(aSuit);
      const bIdx = suitOrder.indexOf(bSuit);
      const aOrder = aIdx === -1 ? 98 : aIdx;
      const bOrder = bIdx === -1 ? 98 : bIdx;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (RANK_ORDER[b.value] || 0) - (RANK_ORDER[a.value] || 0);
    });
  }, [suitOrder]);

  return { suitOrder, setSuitOrder, sortHand };
}