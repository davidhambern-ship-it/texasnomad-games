import React from 'react';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

function TeamScore({ side, name, score, active, accent, players = [] }) {
  const members = players.slice(0, 6);
  const leftMembers = members.slice(0, 3);
  const rightMembers = members.slice(3, 6);

  const MemberColumn = ({ items, align = 'left' }) => (
    <div className={`flex min-w-0 flex-col gap-1 ${align === 'right' ? 'items-end text-right' : 'items-start text-left'}`}>
      {Array.from({ length: 3 }).map((_, index) => {
        const player = items[index];
        return (
          <div
            key={player?.playerId || `${side}-empty-${align}-${index}`}
            className="min-h-[22px] w-full max-w-[92px] rounded-md border px-1.5 py-1"
            style={{
              borderColor: player ? `${accent}35` : 'rgba(255,255,255,.05)',
              background: player ? `${accent}08` : 'rgba(255,255,255,.015)',
              color: player ? 'rgba(255,255,255,.72)' : 'rgba(255,255,255,.08)',
            }}
          >
            <div className="truncate text-[7px] font-semibold sm:text-[8px]">
              {player ? (player.playerName || player.name || 'Player') : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      className="relative overflow-hidden rounded-[26px] border bg-black/55 px-3 py-3 text-center backdrop-blur-xl"
      style={{
        borderColor: active ? '#FFD700' : `${accent}66`,
        boxShadow: active
          ? `0 0 26px rgba(255,215,0,.28), inset 0 0 26px ${accent}12`
          : `0 0 24px ${accent}18, inset 0 0 22px rgba(255,255,255,.03)`,
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />

      <div className="flex items-start justify-between gap-2 text-left">
        <div className="min-w-0">
          <div className="truncate text-[7px] uppercase tracking-[0.22em] text-white/45" style={PS2}>
            {side}
          </div>
          <div className="mt-1 truncate font-heading text-base uppercase tracking-wider text-white sm:text-lg">
            {name}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[5px] uppercase tracking-widest text-white/20" style={PS2}>
            FAMILY
          </div>
          <div className="mt-1 text-[7px]" style={{ ...PS2, color: accent }}>
            {members.length}/6
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <MemberColumn items={leftMembers} />

        <div className="min-w-[58px]">
          <div
            className="font-heading text-4xl leading-none sm:text-5xl"
            style={{ color: accent, textShadow: `0 0 18px ${accent}` }}
          >
            {score}
          </div>
          <div
            className={`mt-2 text-[5px] uppercase tracking-[0.16em] ${active ? 'text-[#FFD700]' : 'text-white/20'}`}
            style={PS2}
          >
            {active ? '▶ CONTROL' : 'WAIT'}
          </div>
        </div>

        <MemberColumn items={rightMembers} align="right" />
      </div>
    </div>
  );
}

function Marquee() {
  return (
    <div
      className="bff-tng-marquee relative min-h-[150px] overflow-hidden rounded-[30px] border-2 px-5 py-4 text-center"
      style={{
        borderColor: 'rgba(255,138,24,.72)',
        background:
          'radial-gradient(circle at center, rgba(255,138,24,.20), transparent 50%), linear-gradient(180deg, rgba(255,255,255,.07), rgba(0,0,0,.60)), rgba(5,3,11,.85)',
        boxShadow:
          '0 0 34px rgba(255,95,31,.24), 0 0 44px rgba(188,19,254,.28), inset 0 0 28px rgba(255,255,255,.04)',
      }}
    >
      <div className="bff-tng-bulbs absolute inset-[10px] rounded-[22px] border-[5px] border-dotted border-[#FFD784]/80" />
      <div className="absolute inset-[26px] rounded-[22px] border-2 border-[#BC13FE]/70 shadow-[0_0_28px_rgba(188,19,254,.5)]" />
      <div className="relative z-10 flex min-h-[116px] flex-col items-center justify-center">
        <div className="mb-1 text-[7px] uppercase tracking-[0.24em] text-[#FFD700]" style={PS2}>
          ★ TEXASNOMAD GAMES ★
        </div>
        <div
          className="font-heading text-6xl leading-[.85] sm:text-7xl"
          style={{
            color: '#FFF8ED',
            WebkitTextStroke: '2px #FF5F1F',
            textShadow:
              '0 0 8px #FF5F1F, 0 0 18px rgba(188,19,254,.9), 4px 5px 0 rgba(0,0,0,.55)',
          }}
        >
          BFF
        </div>
        <div className="mt-2 text-[8px] uppercase tracking-[0.18em] text-[#22D3EE]" style={PS2}>
          BIG FAMILY FEUD
        </div>
      </div>
    </div>
  );
}

function AnswerTile({ answer, index }) {
  const revealed = Boolean(answer?.revealed);
  return (
    <div
      className="relative min-h-[66px] overflow-hidden rounded-2xl border transition-all duration-500"
      style={{
        borderColor: revealed ? 'rgba(255,215,0,.7)' : 'rgba(188,19,254,.38)',
        background: revealed
          ? 'linear-gradient(90deg, rgba(255,95,31,.16), rgba(255,215,0,.10), rgba(188,19,254,.14))'
          : 'linear-gradient(180deg, rgba(188,19,254,.10), rgba(0,0,0,.46))',
        boxShadow: revealed
          ? '0 0 20px rgba(255,215,0,.16), inset 0 0 18px rgba(255,255,255,.04)'
          : 'inset 0 0 18px rgba(188,19,254,.05)',
      }}
    >
      <div className="flex min-h-[66px] items-center gap-3 px-3 sm:px-4">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border font-heading text-lg"
          style={{
            borderColor: revealed ? '#FFD700' : 'rgba(34,211,238,.35)',
            color: revealed ? '#080516' : '#22D3EE',
            background: revealed ? '#FFD700' : 'rgba(34,211,238,.08)',
            boxShadow: revealed ? '0 0 14px rgba(255,215,0,.45)' : 'none',
          }}
        >
          {index + 1}
        </div>

        <div className="min-w-0 flex-1">
          {revealed ? (
            <div className="font-heading text-lg uppercase tracking-wide text-white sm:text-xl">
              {answer.text || answer.answer}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 7 }).map((_, i) => (
                <span
                  key={i}
                  className="h-2.5 flex-1 rounded-full bg-[#BC13FE]/20 shadow-[0_0_8px_rgba(188,19,254,.16)]"
                />
              ))}
            </div>
          )}
        </div>

        <div
          className="w-12 shrink-0 text-right font-heading text-xl sm:text-2xl"
          style={{ color: revealed ? '#FF9A3D' : 'rgba(255,255,255,.12)' }}
        >
          {revealed ? answer.points || 0 : '—'}
        </div>
      </div>
    </div>
  );
}

function StrikeMeter({ count = 0 }) {
  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-500/5 px-3 py-3">
      <div className="mb-2 text-center text-[6px] uppercase tracking-[0.18em] text-red-300/60" style={PS2}>
        STRIKES
      </div>
      <div className="flex justify-center gap-2">
        {['B', 'Y', 'E'].map((letter, i) => (
          <div
            key={letter}
            className="flex h-10 w-10 items-center justify-center rounded-xl border-2 font-heading text-2xl"
            style={{
              borderColor: i < count ? '#FF174D' : 'rgba(255,255,255,.10)',
              background: i < count ? 'rgba(255,23,77,.18)' : 'rgba(255,255,255,.025)',
              color: i < count ? '#FF174D' : 'rgba(255,255,255,.12)',
              textShadow: i < count ? '0 0 12px #FF174D' : 'none',
            }}
          >
            {letter}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BFFTngBoard({ gs = {}, isVsAI = false }) {
  const answers = gs.answers || [];
  const family1 = gs.family1 || (isVsAI ? 'Your Family' : 'Family 1');
  const family2 = gs.family2 || (isVsAI ? 'TexasNomad Team' : 'Family 2');
  const activeTurn = Number(gs.active_turn || gs.control_team || 1);
  const stealMode = Boolean(gs.steal_mode);
  const byeCount = Math.min(3, Number(gs.bye_count || 0));
  const players = Array.isArray(gs.players) ? gs.players : [];
  const teamOnePlayers = players.filter((player) => Number(player.familyTeam) === 1).slice(0, 6);
  const teamTwoPlayers = players.filter((player) => Number(player.familyTeam) === 2).slice(0, 6);

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#080516]/95 p-3 sm:p-4">
      <style>{`
        @keyframes bffBulbPulse {
          from { opacity: .56; filter: drop-shadow(0 0 3px rgba(255,210,120,.55)); }
          to { opacity: 1; filter: drop-shadow(0 0 9px rgba(255,210,120,1)); }
        }
        @keyframes bffGridDrift {
          from { background-position: 0 0; }
          to { background-position: 48px 48px; }
        }
        .bff-tng-bulbs { animation: bffBulbPulse 1.25s ease-in-out infinite alternate; }
        .bff-tng-grid {
          background-image:
            linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px),
            linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px);
          background-size: 48px 48px;
          animation: bffGridDrift 18s linear infinite;
        }
      `}</style>

      <div className="bff-tng-grid pointer-events-none absolute inset-0 opacity-50" />
      <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[#FF5F1F]/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#BC13FE]/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-90px] left-1/2 h-56 w-80 -translate-x-1/2 rounded-full bg-[#22D3EE]/10 blur-3xl" />

      <div className="relative z-10 space-y-3">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(180px,.8fr)_minmax(300px,1.45fr)_minmax(180px,.8fr)]">
          <TeamScore
            side="TEAM ONE"
            name={family1}
            score={gs.score1 || 0}
            active={activeTurn === 1}
            accent="#FF9A3D"
            players={teamOnePlayers}
          />
          <Marquee />
          <TeamScore
            side="TEAM TWO"
            name={family2}
            score={gs.score2 || 0}
            active={activeTurn === 2}
            accent="#BC8CFF"
            players={teamTwoPlayers}
          />
        </div>

        <div
          className="rounded-[24px] border px-4 py-4 text-center backdrop-blur-md sm:px-6"
          style={{
            borderColor: 'rgba(34,211,238,.42)',
            background: 'rgba(0,0,0,.48)',
            boxShadow: '0 0 26px rgba(34,211,238,.14), inset 0 0 20px rgba(255,255,255,.025)',
          }}
        >
          <div className="mb-2 text-[6px] uppercase tracking-[0.28em] text-[#8DEEFF]" style={PS2}>
            SURVEY QUESTION · ROUND {gs.round_number || 1}
          </div>
          <div className="font-heading text-xl leading-snug text-white sm:text-2xl">
            {gs.current_question || 'Waiting for the next survey question…'}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_180px]">
          <div className="space-y-2 rounded-[24px] border border-[#BC13FE]/25 bg-black/45 p-2.5 sm:p-3">
            {answers.length ? (
              answers.map((answer, index) => <AnswerTile key={index} answer={answer} index={index} />)
            ) : (
              <div className="flex min-h-[250px] items-center justify-center rounded-2xl border border-dashed border-white/10 text-center">
                <div>
                  <div className="font-heading text-2xl uppercase text-white/20">Board Locked</div>
                  <div className="mt-2 text-[6px] uppercase tracking-[0.18em] text-white/15" style={PS2}>
                    WAITING FOR SURVEY DATA
                  </div>
                </div>
              </div>
            )}
          </div>

          <aside className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:content-start">
            <div
              className="rounded-2xl border border-[#22D3EE]/30 bg-[#22D3EE]/5 px-3 py-4 text-center"
              style={{ boxShadow: 'inset 0 0 18px rgba(34,211,238,.06)' }}
            >
              <div className="text-[6px] uppercase tracking-[0.18em] text-[#8DEEFF]/60" style={PS2}>
                ROUND BANK
              </div>
              <div className="mt-2 font-heading text-4xl text-[#22D3EE] drop-shadow-[0_0_10px_rgba(34,211,238,.5)]">
                {gs.round_bank || 0}
              </div>
            </div>

            <StrikeMeter count={byeCount} />

            <div
              className={`col-span-2 rounded-2xl border px-3 py-4 text-center lg:col-span-1 ${
                stealMode
                  ? 'border-[#FFD700] bg-[#FFD700]/10'
                  : 'border-white/10 bg-white/[.025]'
              }`}
              style={stealMode ? { boxShadow: '0 0 24px rgba(255,215,0,.22)' } : undefined}
            >
              <div
                className={`text-[6px] uppercase tracking-[0.18em] ${
                  stealMode ? 'text-[#FFD700]' : 'text-white/25'
                }`}
                style={PS2}
              >
                {stealMode ? '⚡ STEAL LIVE' : 'STEAL'}
              </div>
              <div
                className={`mt-2 font-heading text-xl uppercase ${
                  stealMode ? 'text-[#FFD700]' : 'text-white/15'
                }`}
              >
                {stealMode ? 'ONE SHOT' : 'STANDBY'}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
