import React, { useState } from 'react';
import { SUIT_PRESETS } from '@/hooks/useSuitOrder';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_NAMES = { '♠': 'Spades', '♥': 'Hearts', '♦': 'Diamonds', '♣': 'Clubs' };
const SUIT_COLORS = { '♠': '#BC13FE', '♥': '#ef4444', '♦': '#3b82f6', '♣': '#4ade80' };

export default function HandSetup({ suitOrder, onSuitOrderChange, onClose }) {
  const [customOrder, setCustomOrder] = useState([...suitOrder]);
  const [isCustom, setIsCustom] = useState(
    !SUIT_PRESETS.slice(0, 3).some(p => JSON.stringify(p.suits) === JSON.stringify(suitOrder))
  );
  const [dragOver, setDragOver] = useState(null);
  const [dragging, setDragging] = useState(null);

  const applyPreset = (preset) => {
    if (preset.suits === null) {
      setIsCustom(true);
      setCustomOrder([...suitOrder]);
    } else {
      setIsCustom(false);
      setCustomOrder([...preset.suits]);
      onSuitOrderChange([...preset.suits]);
    }
  };

  const handleCustomChange = (idx, suit) => {
    const newOrder = [...customOrder];
    const swapIdx = newOrder.indexOf(suit);
    if (swapIdx !== -1 && swapIdx !== idx) {
      [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    } else {
      newOrder[idx] = suit;
    }
    setCustomOrder(newOrder);
    onSuitOrderChange(newOrder);
  };
  
  // Auto-close after applying changes - parent will re-sort immediately
  const handleDone = () => {
    onClose();
  };

  // Drag & drop for custom order
  const handleDragStart = (e, idx) => {
    setDragging(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    setDragOver(idx);
  };
  const handleDrop = (e, idx) => {
    e.preventDefault();
    if (dragging === null || dragging === idx) { setDragging(null); setDragOver(null); return; }
    const newOrder = [...customOrder];
    const item = newOrder.splice(dragging, 1)[0];
    newOrder.splice(idx, 0, item);
    setCustomOrder(newOrder);
    onSuitOrderChange(newOrder);
    setDragging(null);
    setDragOver(null);
  };

  const activePresetIdx = SUIT_PRESETS.findIndex(p => p.suits && JSON.stringify(p.suits) === JSON.stringify(isCustom ? [] : customOrder));

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-3">
      <div className="bg-gradient-to-br from-[#0a0a1a] to-[#050510] border-2 border-[#BC13FE]/50 rounded-2xl p-4 max-w-sm w-full shadow-2xl overflow-y-auto max-h-[90vh]"
        style={{ boxShadow: '0 0 40px rgba(188,19,254,0.25)' }}>
        
        <div className="flex items-center justify-between mb-4">
          <div className="text-[9px] tracking-widest text-[#BC13FE] uppercase" style={PS2}>🃏 Hand Setup</div>
          <button onClick={handleDone} className="px-3 py-1 rounded-lg border border-[#4ade80]/40 text-[#4ade80] text-[6px] tracking-widest uppercase hover:bg-[#4ade80]/10 transition-all" style={PS2}>✓ DONE</button>
        </div>

        <div className="text-[6px] text-white/40 uppercase mb-3 tracking-widest" style={PS2}>
          Choose Suit Order
        </div>

        {/* Preset buttons */}
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {SUIT_PRESETS.map((preset, i) => {
            const isActive = preset.suits === null ? isCustom : (!isCustom && JSON.stringify(preset.suits) === JSON.stringify(customOrder));
            return (
              <button key={i} onClick={() => applyPreset(preset)}
                className={`px-2 py-2 rounded-lg border-2 text-left transition-all ${isActive ? 'border-[#BC13FE] bg-[#BC13FE]/20' : 'border-white/15 bg-white/5 hover:border-white/30'}`}>
                <div className="text-[5px] tracking-widest uppercase mb-1" style={{ ...PS2, color: isActive ? '#BC13FE' : 'rgba(255,255,255,0.5)' }}>
                  {preset.label}
                </div>
                {preset.suits && (
                  <div className="flex gap-0.5">
                    {preset.suits.map(s => (
                      <span key={s} style={{ color: SUIT_COLORS[s], fontSize: 12 }}>{s}</span>
                    ))}
                  </div>
                )}
                {preset.suits === null && (
                  <div className="text-white/30 text-[7px]">Drag to reorder</div>
                )}
              </button>
            );
          })}
        </div>

        {/* Custom order — dropdowns only (compact, works on mobile) */}
        {isCustom && (
          <div className="border-t border-white/10 pt-3">
            <div className="text-[5px] text-white/40 uppercase mb-2 tracking-widest" style={PS2}>Select suit order</div>
            <div className="grid grid-cols-2 gap-1.5">
              {customOrder.map((suit, idx) => (
                <div key={idx} className="flex flex-col gap-1">
                  <div className="text-[5px] text-white/30 uppercase" style={PS2}>#{idx + 1}</div>
                  <select
                    value={suit}
                    onChange={(e) => handleCustomChange(idx, e.target.value)}
                    className="px-2 py-1.5 rounded-lg bg-black/80 border border-white/20 text-white text-sm focus:outline-none focus:border-[#BC13FE]"
                    style={{ color: SUIT_COLORS[suit] }}>
                    {SUITS.map(s => (
                      <option key={s} value={s} style={{ color: SUIT_COLORS[s] }}>{SUIT_NAMES[s]}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview */}
        <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between">
          <div className="text-[5px] text-white/30 uppercase tracking-widest" style={PS2}>Order</div>
          <div className="flex gap-2">
            {customOrder.map((s, i) => (
              <div key={s} className="flex flex-col items-center gap-0.5">
                <span style={{ color: SUIT_COLORS[s], fontSize: 18 }}>{s}</span>
                <span className="text-[5px] text-white/20" style={PS2}>{i + 1}</span>
              </div>
            ))}
          </div>
          <button onClick={() => { onSuitOrderChange(customOrder); onClose(); }}
            className="px-3 py-1.5 rounded-lg border-2 border-[#4ade80] text-[#4ade80] text-[6px] tracking-widest uppercase hover:bg-[#4ade80]/20 transition-all"
            style={PS2}>
            ✓ Done
          </button>
        </div>
      </div>
    </div>
  );
}