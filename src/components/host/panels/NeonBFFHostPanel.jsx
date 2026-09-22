import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  Users,
  Play,
  SkipForward,
  Eye,
  EyeOff,
  Plus,
  RotateCcw,
  Radio,
  Trophy,
  Volume2,
  Frown,
  Sparkles,
  Zap,
  Undo2,
  Pencil,
} from 'lucide-react';

import { tngApi } from '@/api/tngApi';
import { armBffSoundUnlock, playBffSound, preloadBffSounds } from '@/lib/bffSound';

const PS2 = { fontFamily: "'Press Start 2P', monospace" };

const ANSWER_COLORS = [
  '#BC13FE',
  '#FF5F1F',
  '#22D3EE',
  '#FFD700',
  '#4ADE80',
  '#F472B6',
  '#8B5CF6',
  '#FB7185',
];

function TeamCard({ team, name, score, players, active, accent, onRename }) {
  return (
    <section
      className="relative min-w-0 overflow-hidden rounded-2xl border bg-black/60 p-3"
      style={{
        borderColor: active ? '#FFD700' : `${accent}55`,
        boxShadow: active
          ? `0 0 24px rgba(255,215,0,.20), inset 0 0 24px ${accent}10`
          : `inset 0 0 24px ${accent}08`,
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />

      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onRename}
          className="group min-w-0 text-left"
          title="Edit family name"
        >
          <div className="flex items-center gap-1.5">
            <span
              className="truncate text-[8px] font-black uppercase tracking-wide sm:text-[10px]"
              style={{ color: accent }}
            >
              {name}
            </span>
            <Pencil className="h-3 w-3 shrink-0 opacity-25 transition-opacity group-hover:opacity-70" />
          </div>
          <div className="mt-1 text-[5px] uppercase tracking-widest text-white/25" style={PS2}>
            TEAM {team}
          </div>
        </button>

        {active && (
          <span
            className="rounded-md border border-[#FFD700]/45 bg-[#FFD700]/10 px-1.5 py-1 text-[5px] text-[#FFD700]"
            style={PS2}
          >
            CONTROL
          </span>
        )}
      </div>

      <div
        className="my-3 text-center font-heading text-5xl leading-none sm:text-6xl"
        style={{ color: accent, textShadow: `0 0 16px ${accent}55` }}
      >
        {score}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-[5px] uppercase tracking-widest text-white/28" style={PS2}>
          {players.length} PLAYER{players.length === 1 ? '' : 'S'}
        </div>
      </div>

      <div className="mt-2 flex min-h-[38px] flex-wrap content-start gap-1">
        {players.length ? players.map((player) => (
          <span
            key={player.playerId}
            className="max-w-full truncate rounded-md border px-1.5 py-1 text-[8px]"
            style={{
              borderColor: `${accent}35`,
              background: `${accent}08`,
              color: 'rgba(255,255,255,.70)',
            }}
          >
            {player.playerName || player.name || 'Player'}
          </span>
        )) : (
          <span className="text-[8px] italic text-white/18">No players assigned</span>
        )}
      </div>
    </section>
  );
}

function BFFCenterCard({ round, bank, controlTeam, stealMode }) {
  return (
    <section
      className="relative overflow-hidden rounded-2xl border-2 border-[#FF7A1A]/60 bg-[#080512] p-3 text-center"
      style={{
        boxShadow: '0 0 28px rgba(188,19,254,.18), inset 0 0 26px rgba(255,95,31,.08)',
      }}
    >
      <div className="absolute inset-[7px] rounded-xl border-2 border-dotted border-[#FFD784]/45" />
      <div className="relative z-10">
        <div className="text-[5px] uppercase tracking-[.20em] text-[#FFD700]" style={PS2}>
          TEXASNOMAD GAMES
        </div>
        <div
          className="mt-2 font-heading text-5xl leading-none sm:text-6xl"
          style={{
            color: '#FFF8ED',
            WebkitTextStroke: '1px #FF5F1F',
            textShadow: '0 0 10px #FF5F1F, 0 0 20px rgba(188,19,254,.65)',
          }}
        >
          BFF
        </div>
        <div className="mt-1 text-[6px] uppercase tracking-widest text-[#22D3EE]" style={PS2}>
          BIG FAMILY FEUD
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <div className="rounded-lg border border-white/10 bg-white/[.025] p-2">
            <div className="text-[5px] text-white/25" style={PS2}>ROUND</div>
            <div className="mt-1 font-heading text-xl text-white">{round}</div>
          </div>
          <div className="rounded-lg border border-[#22D3EE]/25 bg-[#22D3EE]/5 p-2">
            <div className="text-[5px] text-[#22D3EE]/60" style={PS2}>BANK</div>
            <div className="mt-1 font-heading text-xl text-[#22D3EE]">{bank}</div>
          </div>
        </div>

        <div
          className={`mt-2 rounded-lg border px-2 py-1.5 text-[5px] uppercase tracking-widest ${
            stealMode
              ? 'border-[#FFD700]/55 bg-[#FFD700]/10 text-[#FFD700]'
              : 'border-white/10 text-white/35'
          }`}
          style={PS2}
        >
          {stealMode ? 'STEAL LIVE' : `TEAM ${controlTeam} IN CONTROL`}
        </div>
      </div>
    </section>
  );
}

function AnswerSlot({ slot, index, selected, onSelect }) {
  const accent = ANSWER_COLORS[index % ANSWER_COLORS.length];
  const revealed = Boolean(slot?.revealed);

  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      className="relative min-h-[76px] overflow-hidden rounded-xl border-2 p-2 text-left transition-transform active:scale-[.99]"
      style={{
        borderColor: selected ? '#FFD700' : `${accent}75`,
        background: revealed
          ? `linear-gradient(135deg, ${accent}24, rgba(255,255,255,.04))`
          : `linear-gradient(135deg, ${accent}12, rgba(0,0,0,.55))`,
        boxShadow: selected
          ? '0 0 18px rgba(255,215,0,.26)'
          : `inset 0 0 20px ${accent}08`,
      }}
    >
      <div
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: accent, boxShadow: `0 0 10px ${accent}` }}
      />

      <div className="flex h-full items-center gap-3 pl-1">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border font-heading text-lg"
          style={{
            borderColor: `${accent}80`,
            color: accent,
            background: `${accent}10`,
          }}
        >
          {index + 1}
        </div>

        <div className="min-w-0 flex-1">
          <div
            className="text-[6px] uppercase tracking-[.16em]"
            style={{ ...PS2, color: revealed ? '#FFD700' : `${accent}cc` }}
          >
            {revealed ? 'REVEALED' : 'HIDDEN ANSWER'}
          </div>
          <div className="mt-2 flex gap-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className="h-1.5 flex-1 rounded-full"
                style={{ background: revealed ? `${accent}85` : `${accent}20` }}
              />
            ))}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[5px] uppercase text-white/20" style={PS2}>PTS</div>
          <div className="mt-1 font-heading text-lg" style={{ color: accent }}>
            {Number(slot?.points) || 0}
          </div>
        </div>
      </div>
    </button>
  );
}

function ByeMeter({ count }) {
  const letters = ['B', 'Y', 'E'];
  return (
    <div className="grid grid-cols-3 gap-2">
      {letters.map((letter, index) => {
        const active = index < count;
        return (
          <div
            key={letter}
            className="flex h-14 items-center justify-center rounded-xl border-2 font-heading text-3xl"
            style={{
              borderColor: active ? '#FF174D' : 'rgba(255,255,255,.10)',
              background: active ? 'rgba(255,23,77,.14)' : 'rgba(255,255,255,.025)',
              color: active ? '#FF174D' : 'rgba(255,255,255,.12)',
              textShadow: active ? '0 0 12px #FF174D' : 'none',
            }}
          >
            {letter}
          </div>
        );
      })}
    </div>
  );
}

function ControlButton({ label, icon: Icon, accent = '#BC13FE', active = false, onClick, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-lg border px-1.5 py-2 text-center disabled:opacity-25"
      style={{
        borderColor: active ? accent : `${accent}55`,
        color: accent,
        background: active ? `${accent}18` : `${accent}06`,
        boxShadow: active ? `0 0 12px ${accent}24` : 'none',
      }}
    >
      {Icon && <Icon className="h-4 w-4" />}
      <span className="text-[5px] uppercase leading-tight tracking-wider" style={PS2}>{label}</span>
    </button>
  );
}

function PlayerRow({ player, team, onAssign, busy }) {
  const accent = team === 1 ? '#BC13FE' : team === 2 ? '#FF5F1F' : '#FFD700';

  return (
    <div
      className="rounded-lg border bg-black/40 p-2"
      style={{ borderColor: `${accent}38` }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[10px] font-bold text-white/75">
            {player.playerName || player.name || 'Player'}
          </div>
          <div className="mt-0.5 text-[5px] uppercase text-white/22" style={PS2}>
            SEAT {player.seatNumber ?? '—'}
          </div>
        </div>
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#4ade80]" />
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1">
        {[1, 2].map((teamNumber) => {
          const teamAccent = teamNumber === 1 ? '#BC13FE' : '#FF5F1F';
          return (
            <button
              key={teamNumber}
              type="button"
              disabled={busy}
              onClick={() => onAssign(player.playerId, teamNumber)}
              className="rounded-md border px-1 py-1.5 text-[5px] disabled:opacity-25"
              style={{
                ...PS2,
                borderColor: team === teamNumber ? teamAccent : `${teamAccent}35`,
                color: teamAccent,
                background: team === teamNumber ? `${teamAccent}14` : 'transparent',
              }}
            >
              T{teamNumber}
            </button>
          );
        })}
        <button
          type="button"
          disabled={busy}
          onClick={() => onAssign(player.playerId, null)}
          className="rounded-md border border-white/10 px-1 py-1.5 text-[5px] text-white/25 disabled:opacity-25"
          style={PS2}
        >
          OPEN
        </button>
      </div>
    </div>
  );
}

export default function NeonBFFHostPanel({ controllerId }) {
  const [room, setRoom] = useState(null);
  const [actionError, setActionError] = useState('');
  const [pollError, setPollError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(0);
  const [manualPoints, setManualPoints] = useState(10);
  const lastSoundCueRef = useRef(null);

  const gameState = room?.gameState || {};
  const players = Array.isArray(gameState.players)
    ? gameState.players
    : Array.isArray(room?.players)
      ? room.players
      : [];
  const teamMap = gameState.playerTeams || {};

  const team1 = useMemo(
    () => players.filter((player) => Number(teamMap[player.playerId] ?? player.familyTeam) === 1),
    [players, teamMap],
  );
  const team2 = useMemo(
    () => players.filter((player) => Number(teamMap[player.playerId] ?? player.familyTeam) === 2),
    [players, teamMap],
  );

  const answers = Array.isArray(gameState.answers) ? gameState.answers : [];
  const byeCount = Math.max(0, Math.min(3, Number(gameState.bye_count) || 0));
  const controlTeam = Number(gameState.control_team || gameState.active_turn || 1) === 2 ? 2 : 1;

  const refresh = useCallback(async () => {
    if (!controllerId) return;
    try {
      const payload = await tngApi.bff.getHostState(controllerId);
      setRoom(payload.room || null);
      setPollError('');
    } catch (err) {
      setPollError(err?.message || 'Could not load BFF Host state.');
    }
  }, [controllerId]);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 800);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    preloadBffSounds();
    armBffSoundUnlock();
  }, []);

  useEffect(() => {
    const cue = gameState.sound_cue;
    if (!cue?.at || cue.at === lastSoundCueRef.current) return;
    lastSoundCueRef.current = cue.at;
    playBffSound(String(cue.name || ''));
  }, [gameState.sound_cue]);

  const act = useCallback(async (action, payload = {}) => {
    if (!controllerId || busy) return false;
    setBusy(true);
    setActionError('');

    try {
      const result = await tngApi.bff.hostAction(controllerId, action, payload);
      setRoom(result.room || null);
      return true;
    } catch (err) {
      setActionError(err?.message || 'That BFF Host action could not be completed.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, controllerId]);

  const assignPlayer = (playerId, team) => act('assign_player', { playerId, team });

  const renameFamily = async (team) => {
    const current = team === 1
      ? (gameState.family1 || 'Family 1')
      : (gameState.family2 || 'Family 2');
    const nextName = window.prompt(`Team ${team} family name`, current);
    if (nextName == null) return;

    await act('set_family_names', {
      family1: team === 1 ? nextName : (gameState.family1 || 'Family 1'),
      family2: team === 2 ? nextName : (gameState.family2 || 'Family 2'),
    });
  };

  if (!room && !pollError) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#BC13FE]" />
        <span className="text-sm text-white/40">Loading BFF Host controls…</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1650px] space-y-2.5">
      {actionError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-400">
          {actionError}
        </div>
      )}

      {!room && pollError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-400">
          {pollError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 min-[600px]:grid-cols-[minmax(0,1fr)_minmax(130px,.62fr)_minmax(0,1fr)]">
        <TeamCard
          team={1}
          name={gameState.family1 || 'Family 1'}
          score={Number(gameState.score1) || 0}
          players={team1}
          active={controlTeam === 1}
          accent="#BC13FE"
          onRename={() => renameFamily(1)}
        />

        <BFFCenterCard
          round={Number(gameState.round_number) || 1}
          bank={Number(gameState.round_bank) || 0}
          controlTeam={controlTeam}
          stealMode={Boolean(gameState.steal_mode)}
        />

        <TeamCard
          team={2}
          name={gameState.family2 || 'Family 2'}
          score={Number(gameState.score2) || 0}
          players={team2}
          active={controlTeam === 2}
          accent="#FF5F1F"
          onRename={() => renameFamily(2)}
        />
      </div>

      <section
        className="rounded-xl border border-[#22D3EE]/30 bg-black/60 px-3 py-3 text-center"
        style={{ boxShadow: 'inset 0 0 20px rgba(34,211,238,.06)' }}
      >
        <div className="text-[5px] uppercase tracking-[.20em] text-[#22D3EE]/65" style={PS2}>
          SURVEY QUESTION · ROUND {Number(gameState.round_number) || 1}
        </div>
        <div className="mt-2 font-heading text-base leading-snug text-white sm:text-xl">
          {gameState.current_question || 'Waiting for the survey question…'}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-2 min-[680px]:grid-cols-[minmax(0,1fr)_minmax(285px,335px)]">
        <section className="rounded-xl border border-white/10 bg-black/50 p-2">
          <div className="mb-2 flex items-center justify-between px-1">
            <div className="text-[6px] uppercase tracking-[.18em] text-white/35" style={PS2}>
              ANSWER BOARD
            </div>
            <div className="text-[5px] uppercase tracking-widest text-[#FFD700]/55" style={PS2}>
              HOST VIEW · ANSWERS HIDDEN
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {answers.map((slot, index) => (
              <AnswerSlot
                key={index}
                slot={slot}
                index={index}
                selected={selectedAnswer === index}
                onSelect={setSelectedAnswer}
              />
            ))}
          </div>
        </section>

        <aside className="rounded-xl border border-[#FF5F1F]/25 bg-black/60 p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[6px] uppercase tracking-[.18em] text-[#FF9A3D]" style={PS2}>
              GAME CONTROLS
            </div>
            <div className="text-right">
              <div className="text-[5px] text-white/25" style={PS2}>
                SLOT {selectedAnswer + 1}
              </div>
              <div
                className={`mt-1 text-[5px] uppercase ${gameState.buzzer_open ? 'text-[#22D3EE]' : gameState.buzz_winner ? 'text-[#FFD700]' : 'text-white/20'}`}
                style={PS2}
              >
                {gameState.buzzer_open
                  ? 'BUZZERS LIVE'
                  : gameState.buzz_winner
                    ? `${gameState.buzz_winner.playerName || 'PLAYER'} BUZZED`
                    : 'BUZZERS HIDDEN'}
              </div>
            </div>
          </div>

          <ByeMeter count={byeCount} />

          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <ControlButton
              label="Start Round"
              icon={Play}
              accent="#4ADE80"
              onClick={() => act('start_round')}
              disabled={busy || gameState.phase === 'playing'}
            />
            <ControlButton
              label="Next Q"
              icon={SkipForward}
              accent="#22D3EE"
              onClick={() => act('next_question')}
              disabled={busy}
            />
            <ControlButton
              label="Undo"
              icon={Undo2}
              accent="#FFD700"
              onClick={() => act('undo_last_action')}
              disabled={busy}
            />

            <ControlButton
              label="Reveal"
              icon={Eye}
              accent="#BC13FE"
              onClick={() => act('reveal_answer', { index: selectedAnswer })}
              disabled={busy}
            />
            <ControlButton
              label="Hide"
              icon={EyeOff}
              accent="#8B5CF6"
              onClick={() => act('hide_answer', { index: selectedAnswer })}
              disabled={busy}
            />
            <ControlButton
              label="+ Points"
              icon={Plus}
              accent="#FFD700"
              onClick={() => act('add_points', { amount: Number(manualPoints) || 0 })}
              disabled={busy}
            />

            <ControlButton
              label="+ BYE"
              icon={Plus}
              accent="#FF174D"
              onClick={() => act('add_bye')}
              disabled={busy || byeCount >= 3}
            />
            <ControlButton
              label="- BYE"
              icon={RotateCcw}
              accent="#FB7185"
              onClick={() => act('undo_bye')}
              disabled={busy || byeCount <= 0}
            />
            <ControlButton
              label="Steal"
              icon={Zap}
              accent="#FFD700"
              active={Boolean(gameState.steal_mode)}
              onClick={() => act('toggle_steal')}
              disabled={busy}
            />

            <ControlButton
              label="Team 1 Ctrl"
              icon={Radio}
              accent="#BC13FE"
              active={controlTeam === 1}
              onClick={() => act('set_control_team', { team: 1 })}
              disabled={busy}
            />
            <ControlButton
              label="Activate Buzz"
              icon={Radio}
              accent="#22D3EE"
              active={Boolean(gameState.buzzer_open)}
              onClick={() => act('open_buzzers')}
              disabled={busy || Boolean(gameState.buzzer_open)}
            />
            <ControlButton
              label="Team 2 Ctrl"
              icon={Radio}
              accent="#FF5F1F"
              active={controlTeam === 2}
              onClick={() => act('set_control_team', { team: 2 })}
              disabled={busy}
            />

            <ControlButton
              label="Hide Buzz"
              icon={EyeOff}
              accent="#64748B"
              onClick={() => act('hide_buzzers')}
              disabled={busy || !gameState.buzzer_open}
            />
            <ControlButton
              label="Reset Buzz"
              icon={RotateCcw}
              accent="#22D3EE"
              onClick={() => act('reset_buzzers')}
              disabled={busy}
            />
            <ControlButton
              label="Buzz Sound"
              icon={Volume2}
              accent="#22D3EE"
              onClick={() => act('sound', { name: 'buzz' })}
              disabled={busy}
            />

            <ControlButton
              label="Bank → T1"
              icon={Trophy}
              accent="#BC13FE"
              onClick={() => act('award_bank', { team: 1 })}
              disabled={busy}
            />
            <ControlButton
              label="Ding"
              icon={Sparkles}
              accent="#4ADE80"
              onClick={() => act('sound', { name: 'correct' })}
              disabled={busy}
            />
            <ControlButton
              label="Bank → T2"
              icon={Trophy}
              accent="#FF5F1F"
              onClick={() => act('award_bank', { team: 2 })}
              disabled={busy}
            />

            <ControlButton
              label="Applause"
              icon={Volume2}
              accent="#FFD700"
              onClick={() => act('sound', { name: 'applause' })}
              disabled={busy}
            />
            <ControlButton
              label="Awwww"
              icon={Frown}
              accent="#F472B6"
              onClick={() => act('sound', { name: 'awww' })}
              disabled={busy}
            />
            <ControlButton
              label="BYE Sound"
              icon={Volume2}
              accent="#FF174D"
              onClick={() => act('sound', { name: 'bye' })}
              disabled={busy}
            />
          </div>

          <div className="mt-2 flex items-center gap-2 rounded-lg border border-[#FFD700]/20 bg-[#FFD700]/[.03] p-2">
            <label className="text-[5px] uppercase text-[#FFD700]/60" style={PS2}>
              MANUAL PTS
            </label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={manualPoints}
              onChange={(event) => setManualPoints(event.target.value)}
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/60 px-2 py-1.5 text-center text-sm text-white outline-none focus:border-[#FFD700]/40"
            />
          </div>

          <div className="mt-3 border-t border-white/10 pt-2.5">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-white/40">
                <Users className="h-3.5 w-3.5" />
                <span className="text-[6px] uppercase tracking-[.16em]" style={PS2}>
                  CONNECTED PLAYERS
                </span>
              </div>
              <span className="font-heading text-base text-[#FFD700]">{players.length}</span>
            </div>

            <div className="grid max-h-[210px] grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2 min-[680px]:grid-cols-1">
              {players.length ? players.map((player) => (
                <PlayerRow
                  key={player.playerId}
                  player={player}
                  team={Number(teamMap[player.playerId] ?? player.familyTeam) || null}
                  onAssign={assignPlayer}
                  busy={busy}
                />
              )) : (
                <div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-[9px] text-white/20">
                  No connected players
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
