import React from 'react';
import { motion } from 'framer-motion';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

export const DISTRICTS = {
  V: { name: 'Neighborhood', spaces: '1-20', color: '#10b981', theme: 'The Beginning', description: 'Community streets, coffee shops, creator supply stores' },
  I: { name: 'Highway', spaces: '21-40', color: '#3b82f6', theme: 'The Grind', description: 'Billboards, data centers, distribution hubs' },
  R: { name: 'Shopping', spaces: '41-80', color: '#f97316', theme: 'Creator Investment', description: 'Malls, tech stores, equipment upgrades' },
  A: { name: 'Business', spaces: '81-100', color: '#a855f7', theme: 'Monetization', description: 'Sponsor towers, talent agencies, podcast studios' },
  L: { name: 'Downtown', spaces: '101-120', color: '#eab308', theme: 'Creator Legend', description: 'TV studios, award theater, creator boulevard' },
};

export const SPACE_TYPES = {
  Follower: { icon: '👥', color: '#06b6d4', label: 'FOLLOW' },
  Sponsorship: { icon: '🤝', color: '#a855f7', label: 'SPON' },
  Equipment: { icon: '📷', color: '#10b981', label: 'EQUIP' },
  Viral: { icon: '🔥', color: '#f97316', label: 'VIRAL' },
  Challenge: { icon: '⚔️', color: '#ef4444', label: 'CHAL' },
  Collaboration: { icon: '✨', color: '#ec4899', label: 'COLLAB' },
  Drama: { icon: '💥', color: '#7c3aed', label: 'DRAMA' },
  Pay: { icon: '💰', color: '#eab308', label: 'PAY' },
  Play: { icon: '🎮', color: '#3b82f6', label: 'PLAY' },
  Event: { icon: '🎪', color: '#f43f5e', label: 'EVENT' },
  SAFE: { icon: '🛡️', color: '#22c55e', label: 'SAFE' },
  CREATOR_MANSION: { icon: '🏆', color: '#fbbf24', label: 'MANSION' },
};

export const getDistrict = (spaceNumber) => {
  if (spaceNumber >= 1 && spaceNumber <= 20) return 'V';
  if (spaceNumber >= 21 && spaceNumber <= 40) return 'I';
  if (spaceNumber >= 41 && spaceNumber <= 80) return 'R';
  if (spaceNumber >= 81 && spaceNumber <= 100) return 'A';
  if (spaceNumber >= 101 && spaceNumber <= 120) return 'L';
  return null;
};

export const getVIRALPosition = (spaceNumber) => {
  const district = getDistrict(spaceNumber);
  if (!district) return { x: 0, y: 0 };

  const districtInDistrict = spaceNumber % 20 === 0 ? 20 : spaceNumber % 20;
  const letterSpacing = 18;
  const baseX = { V: 0, I: 1, R: 2, A: 3, L: 4 };
  
  const letterShapes = {
    V: () => {
      if (districtInDistrict <= 10) {
        return { x: baseX.V * letterSpacing + (10 - districtInDistrict) * 0.8, y: districtInDistrict * 1.2 };
      } else {
        const pos = districtInDistrict - 10;
        return { x: baseX.V * letterSpacing + pos * 0.8, y: (20 - districtInDistrict) * 1.2 + 12 };
      }
    },
    I: () => {
      return { x: baseX.I * letterSpacing + 2, y: districtInDistrict * 1.2 };
    },
    R: () => {
      if (districtInDistrict <= 12) {
        return { x: baseX.R * letterSpacing, y: districtInDistrict * 1.2 };
      } else if (districtInDistrict <= 20) {
        const loopPos = districtInDistrict - 12;
        return { x: baseX.R * letterSpacing + 1 + loopPos * 0.6, y: 2 + loopPos * 0.8 };
      } else if (districtInDistrict <= 28) {
        const backPos = districtInDistrict - 20;
        return { x: baseX.R * letterSpacing + 5 - backPos * 0.4, y: 10 - backPos * 0.6 };
      } else {
        const legPos = districtInDistrict - 28;
        return { x: baseX.R * letterSpacing + 2 + legPos * 0.7, y: 8 + legPos * 1.1 };
      }
    },
    A: () => {
      if (districtInDistrict <= 8) {
        return { x: baseX.A * letterSpacing + (8 - districtInDistrict) * 0.7, y: districtInDistrict * 1.3 };
      } else if (districtInDistrict <= 16) {
        const rightPos = districtInDistrict - 8;
        return { x: baseX.A * letterSpacing + 5 + rightPos * 0.7, y: (16 - rightPos) * 1.3 + 10.4 };
      } else {
        const barPos = districtInDistrict - 16;
        return { x: baseX.A * letterSpacing + 2 + barPos * 0.8, y: 7.5 };
      }
    },
    L: () => {
      if (districtInDistrict <= 12) {
        return { x: baseX.L * letterSpacing + 2, y: districtInDistrict * 1.3 };
      } else {
        const horizPos = districtInDistrict - 12;
        return { x: baseX.L * letterSpacing + 2 + horizPos * 0.9, y: 15.6 };
      }
    },
  };

  return letterShapes[district]();
};