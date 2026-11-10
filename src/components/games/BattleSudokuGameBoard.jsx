import React, { useCallback, useEffect, useRef, useState } from 'react';
import { tngApi } from '@/api/tngApi';
import BSPhone from '@/components/battleSudoku/BSPhone';
import '@/components/battleSudoku/bs.css';

export default function BattleSudokuGameBoard({ controllerId }) {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const actionError = useRef(false);

  const refresh = useCallback(async () => {
    if (!controllerId || inFlight.current || busy) return;
    inFlight.current = true;
    try {
      const next = await tngApi.battleSudoku.getHostState(controllerId);
      setPayload(next);
      if (!actionError.current) setError('');
    } catch (e) {
      setError(e?.message || 'Battleship Sudoku could not refresh.');
    } finally {
      inFlight.current = false;
    }
  }, [controllerId, busy]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 1200);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const act = useCallback(async (action, data = {}) => {
    if (!controllerId || busy) return null;
    setBusy(true);
    actionError.current = false;
    setError('');
    try {
      const next = await tngApi.battleSudoku.hostAction(controllerId, action, data);
      setPayload(next);
      return next?.result || { ok: true };
    } catch (e) {
      actionError.current = true;
      setError(e?.message || 'That Battleship Sudoku action failed.');
      return { ok: false, error: e?.message || 'Action failed.' };
    } finally {
      setBusy(false);
    }
  }, [controllerId, busy]);

  const game = payload?.room?.game;
  if (!game) {
    return <div className="bs-wrap"><div className="bs-card" style={{ textAlign: 'center' }}>
      {error || 'Loading your Battleship Sudoku captain board…'}
      {error && <button type="button" className="bs-btn" style={{ marginTop: 12 }} onClick={refresh}>Retry</button>}
    </div></div>;
  }

  return (
    <div className="bs-shared-host">
      {error && <div className="bs-err" role="alert">{error}</div>}
      <BSPhone
        v={game}
        act={act}
        now={Date.now() + Number(payload?.room?.nowOffset || 0)}
        onExit={() => {}}
        isHost
        hostRoom={payload.room}
        hostAct={act}
      />
    </div>
  );
}
