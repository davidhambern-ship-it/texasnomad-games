import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { tngApi } from '@/api/tngApi';
import BSPhone from '@/components/battleSudoku/BSPhone';
import { quitTngGame } from '@/lib/quitTngGame';
import '@/components/battleSudoku/bs.css';

export default function NeonBattleSudokuPlayer({ roomCode }) {
  const deviceId = typeof window === 'undefined' ? '' : localStorage.getItem('tng_player_device_id') || '';
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const actionError = useRef(false);

  const refresh = useCallback(async () => {
    if (!deviceId || !roomCode || inFlight.current || busy) return;
    inFlight.current = true;
    try {
      const next = await tngApi.battleSudoku.getPlayerState(deviceId, roomCode);
      setPayload(next);
      if (!actionError.current) setError('');
    } catch (e) {
      setError(e?.message || 'The Battleship Sudoku room could not be loaded.');
    } finally {
      inFlight.current = false;
    }
  }, [busy, deviceId, roomCode]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 1200);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const act = useCallback(async (action, data = {}) => {
    if (!deviceId || busy) return { ok: false, error: 'Player connection is not ready.' };
    setBusy(true);
    actionError.current = false;
    setError('');
    try {
      const next = await tngApi.battleSudoku.playerAction(deviceId, roomCode, action, data);
      setPayload(next);
      return next?.result || { ok: true };
    } catch (e) {
      actionError.current = true;
      setError(e?.message || 'That Battleship Sudoku move failed.');
      return { ok: false, error: e?.message || 'Move failed.' };
    } finally {
      setBusy(false);
    }
  }, [busy, deviceId, roomCode]);

  const game = payload?.room?.game;
  if (!deviceId) return <div className="bs-wrap"><div className="bs-card" style={{ textAlign: 'center' }}>
    <p>Your player connection is not ready.</p><Link className="bs-btn" to={`/join/${roomCode}`}>Rejoin room {roomCode}</Link>
  </div></div>;
  if (!game && payload?.room?.status === 'lobby') return (
    <div className="bs-wrap" style={{ maxWidth: 720 }}>
      <div className="bs-card" style={{ textAlign: 'center' }}>
        <h1 className="bs-h bs-logo" style={{ fontSize: 54 }}>Battle<b>Sudoku</b></h1>
        <div className="bs-joincode" style={{ margin: '16px auto' }}>{roomCode}</div>
        <p className="bs-sub">You’re in the shared room. Waiting for the host to start the next battle…</p>
        <div className="bs-row" style={{ justifyContent: 'center', marginTop: 14 }}>
          {(payload.room.roster || []).map((captain) => <span key={captain.id} className="bs-chip" style={{ '--c': captain.color }}>{captain.name}</span>)}
        </div>
        {error && <div className="bs-err">{error}</div>}
        <button type="button" className="bs-btn ghost small" style={{ marginTop: 16 }} onClick={() => quitTngGame(roomCode)}>Leave room</button>
      </div>
    </div>
  );
  if (!game) return <div className="bs-wrap"><div className="bs-card" style={{ textAlign: 'center' }}>
    {error || 'Connecting to your captain board…'}
    {error && <button type="button" className="bs-btn" style={{ marginTop: 12 }} onClick={refresh}>Retry</button>}
  </div></div>;

  return (
    <>
      {error && <div className="bs-err" role="alert">{error}</div>}
      <BSPhone
        v={game}
        act={act}
        now={Date.now()}
        roomCode={roomCode}
        onExit={() => quitTngGame(roomCode)}
      />
    </>
  );
}
