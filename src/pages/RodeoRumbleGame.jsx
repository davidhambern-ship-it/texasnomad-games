import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '@/components/home/Header';
import TestFeedbackButton from '@/components/testing/TestFeedbackButton';
import RRHost from '@/components/brawl/RRHost';
import RRController from '@/components/brawl/RRController';
import RRDisplay from '@/components/brawl/RRDisplay';
import RRPortrait from '@/components/brawl/RRPortrait';
import { ROSTER } from '@/lib/brawl/fighters';
import { rrSfx } from '@/components/brawl/rrSfx';
import { useTngGameIdentity } from '@/hooks/useTngGameIdentity';
import '@/components/brawl/rr.css';

// Rodeo Rumble — multiplayer-only TNG platform fighter
//   /games/rodeo-rumble            join / learn-more landing
//   /games/rodeo-rumble?host=1     authenticated Host + live fight screen
//   /games/rodeo-rumble?room=CODE  signed-in phone controller
//   /games/rodeo-rumble?display=CODE read-only paired Game Display / spectator
export default function RodeoRumbleGame() {
  const [params, setParams] = useSearchParams();
  const room = (params.get('room') || '').toUpperCase();
  const display = (params.get('display') || '').toUpperCase();
  const isHost = params.get('host') === '1';
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const identity = useTngGameIdentity();
  const toMenu = () => { setParams({}, { replace: true }); };

  if (/^[A-Z]{5}$/.test(display)) {
    return <RRDisplay code={display} />;
  }

  if (isHost) {
    return <RRHost onExit={() => window.location.assign('/host')} />;
  }

  if (/^[A-Z]{5}$/.test(room)) {
    return (
      <RRController
        code={room}
        onExit={toMenu}
        identityName={identity.publicName || ''}
        identityLoading={!!identity.loading}
      />
    );
  }

  const join = () => {
    const c = code.trim().toUpperCase();
    if (!/^[A-Z]{5}$/.test(c)) {
      setErr('Room codes are 5 letters — check the Host screen.');
      return;
    }
    rrSfx.unlock();
    setParams({ room: c }, { replace: true });
  };

  return (
    <div className="rr-root">
      <Header />
      <div className="rr-scroll">
        <div className="rr-wrap" style={{ maxWidth: 900, paddingTop: 78 }}>
          <div style={{ textAlign: 'center', margin: '6px 0 10px' }}>
            <h1 className="rr-h rr-logo">Rodeo<b>Rumble</b></h1>
            <p className="rr-sub">2–8 human fighters. Knock ’em off the stage — the more damage they take, the farther they fly.</p>
          </div>

          <div className="rr-menu-strip">
            {ROSTER.map((fighter) => <RRPortrait key={fighter.id} ch={fighter} size={96} />)}
          </div>

          <div className="rr-card" style={{ textAlign: 'center' }}>
            <div className="rr-label" style={{ marginBottom: 8 }}>Got a room code?</div>
            <div className="rr-row" style={{ justifyContent: 'center' }}>
              <input
                className="rr-input"
                style={{ maxWidth: 220 }}
                value={code}
                maxLength={5}
                placeholder="CODE"
                onChange={(event) => {
                  setCode(event.target.value.toUpperCase().replace(/[^A-Z]/g, ''));
                  setErr('');
                }}
                onKeyDown={(event) => event.key === 'Enter' && join()}
              />
              <button type="button" className="rr-btn primary" style={{ fontSize: 18, padding: '12px 24px' }} onClick={join}>Join</button>
            </div>
            {err && <p className="rr-sub" style={{ color: '#ff8a8a' }}>{err}</p>}
            {identity.error && <p className="rr-sub" style={{ color: '#ff8a8a' }}>{identity.error}</p>}
          </div>

          <div className="rr-modes">
            <button
              type="button"
              className="rr-mode"
              onClick={() => window.location.assign('/host?game=rodeo-rumble')}
            >
              <b>Host a rumble</b>
              <span>Launch from the TNG Host Controller, then 2–8 signed-in players join on their phones. Every phone becomes a controller.</span>
            </button>
          </div>
        </div>
      </div>
      <TestFeedbackButton gameId="rodeo-rumble" roomCode={room} testerName={identity.publicName || ''} />
    </div>
  );
}