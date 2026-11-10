import React, { useCallback, useEffect, useState } from 'react';
import { tngApi } from '@/api/tngApi';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };
const OPTIONS = [
  { key: 'difficulty', label: 'PUZZLE', values: [['easy', 'EASY'], ['normal', 'NORMAL'], ['hard', 'HARD']] },
  { key: 'solveSec', label: 'SOLVE PHASE', values: [[30, '30 SEC'], [40, '40 SEC'], [60, '60 SEC']] },
  { key: 'battleSec', label: 'BATTLE PHASE', values: [[10, '10 SEC'], [15, '15 SEC'], [20, '20 SEC']] },
  { key: 'volleys', label: 'VOLLEYS', values: [[6, '6'], [8, '8'], [10, '10']] },
];

export default function BattleSudokuLobbySettings({ controllerId }) {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');

  const refresh = useCallback(async () => {
    if (!controllerId) return;
    try {
      const payload = await tngApi.battleSudoku.getHostState(controllerId);
      setSettings(payload?.room?.settings || {});
      setError('');
    } catch (e) {
      setError(e?.message || 'Battle settings could not be loaded.');
    }
  }, [controllerId]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 2500);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const change = async (key, value) => {
    if (busyKey) return;
    setBusyKey(key);
    setError('');
    try {
      const payload = await tngApi.battleSudoku.hostAction(controllerId, 'settings', { [key]: value });
      setSettings(payload?.room?.settings || (current => ({ ...current, [key]: value })));
    } catch (e) {
      setError(e?.message || 'That setting could not be saved.');
    } finally {
      setBusyKey('');
    }
  };

  return (
    <section className="nc-panel mx-auto mt-3 w-full max-w-[1180px] p-3">
      <div className="mb-3 text-[7px] uppercase tracking-widest text-[#f2c14e]" style={PS2}>BATTLE SUDOKU · HOST SETTINGS</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {OPTIONS.map((option) => (
          <div key={option.key} className="min-w-0">
            <div className="mb-2 text-[6px] uppercase tracking-widest text-white/45" style={PS2}>{option.label}</div>
            <div className="flex flex-wrap gap-1">
              {option.values.map(([value, label]) => (
                <button key={String(value)} type="button" disabled={!settings || Boolean(busyKey)}
                  aria-pressed={settings?.[option.key] === value}
                  onClick={() => change(option.key, value)}
                  className="rounded-lg border px-2 py-2 text-[9px] text-white/70 disabled:opacity-40"
                  style={{ borderColor: settings?.[option.key] === value ? '#8ee0a9' : 'rgba(255,255,255,.14)', background: settings?.[option.key] === value ? 'rgba(142,224,169,.12)' : 'rgba(0,0,0,.2)' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
    </section>
  );
}
