import React, { useEffect, useMemo, useRef, useState } from 'react';

const DISPLAY = { fontFamily: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif" };
const MONO = { fontFamily: "'Press Start 2P', monospace" };

const X_COLOR = '#ff1593';
const O_COLOR = '#25b9ff';
const ORANGE = '#ff781f';
const PURPLE = '#9f45ff';
const GOLD = '#ffd633';

const WIN_COORDS = {
  '0,1,2': [18, 17, 82, 17],
  '3,4,5': [18, 50, 82, 50],
  '6,7,8': [18, 83, 82, 83],
  '0,3,6': [17, 18, 17, 82],
  '1,4,7': [50, 18, 50, 82],
  '2,5,8': [83, 18, 83, 82],
  '0,4,8': [18, 18, 82, 82],
  '2,4,6': [82, 18, 18, 82],
};

function FallbackX({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <g fill="none" stroke={X_COLOR} strokeLinecap="round">
        <path d="M18 17 C37 34 62 64 83 84" strokeWidth="17" />
        <path d="M82 15 C64 36 39 61 17 85" strokeWidth="16" />
      </g>
    </svg>
  );
}

function FallbackO({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <path d="M50 13 C76 12 88 29 87 51 C86 77 70 87 49 87 C26 87 13 72 13 50 C13 26 29 14 50 13 Z" fill="none" stroke={O_COLOR} strokeWidth="15" strokeLinecap="round" />
    </svg>
  );
}

function PieceArt({ mark, className = '' }) {
  const [failed, setFailed] = useState(false);
  const src = mark === 'X'
    ? '/assets/square-biz/piece-x.webp'
    : '/assets/square-biz/piece-o.webp';

  if (failed) {
    return mark === 'X'
      ? <FallbackX className={className} />
      : <FallbackO className={className} />;
  }

  return (
    <img
      src={src}
      alt=""
      draggable="false"
      onError={() => setFailed(true)}
      className={`${className} object-contain`}
    />
  );
}

function Marker({ mark, slam = false, compact = false }) {
  if (!mark) return null;
  return (
    <div className={`absolute inset-[5%] flex items-center justify-center ${slam ? 'sb-piece-slam' : ''}`}>
      <PieceArt mark={mark} className={compact ? 'h-[94%] w-[94%]' : 'h-full w-full'} />
    </div>
  );
}

function MiniPlayer({ player, mark, current }) {
  const color = mark === 'X' ? X_COLOR : O_COLOR;
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-2.5 transition-all ${current ? 'sb-current-player' : ''}`}
      style={{
        '--sb-player-color': color,
        borderColor: current ? color : `${color}55`,
        background: `linear-gradient(135deg, ${color}14, rgba(110,35,170,.10))`,
      }}
    >
      <div className="flex items-center gap-2">
        <PieceArt mark={mark} className="h-10 w-10 shrink-0" />
        <div className="min-w-0">
          <div className="text-[9px] uppercase tracking-[.16em]" style={{ ...MONO, color }}>{`PLAYER ${mark}`}</div>
          <div className="mt-1 truncate text-sm font-black text-white">
            {player?.name || 'WAITING…'}
          </div>
          <div className="mt-0.5 text-[9px] uppercase text-white/35">
            {current ? 'TURN LIVE' : player ? 'READY' : 'OPEN'}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SquareBizBoard({
  gameState = {},
  onSquareClick,
  interactive = false,
  compact = false,
  hostLabel = 'HOST',
}) {
  const fitRef = useRef(null);
  const [frame, setFrame] = useState({ width: compact ? 820 : 1180, height: compact ? 461 : 664 });

  useEffect(() => {
    const node = fitRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;

    const measure = () => {
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const maxWidth = compact ? 820 : 1280;
      const width = Math.max(280, Math.min(rect.width, rect.height * (16 / 9), maxWidth));
      setFrame({ width, height: width * (9 / 16) });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [compact]);

  const board = Array.isArray(gameState.board) && gameState.board.length === 9
    ? gameState.board
    : Array(9).fill(null);
  const players = Array.isArray(gameState.players) ? gameState.players : [];
  const xPlayer = players.find((p) => p.mark === 'X');
  const oPlayer = players.find((p) => p.mark === 'O');
  const latest = gameState.lastAction || {};
  const slammedSquare =
    latest.type === 'turn_changed' && latest.placedSquare != null
      ? Number(latest.placedSquare)
      : gameState.phase === 'finished' && latest.type === 'answer' && latest.result === 'correct'
        ? Number(latest.squareIndex)
        : -1;
  const winKey = Array.isArray(gameState.winningLine) ? gameState.winningLine.join(',') : '';
  const win = WIN_COORDS[winKey];

  return (
    <div ref={fitRef} className="flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden">
      <div
        className="sb-stage relative shrink-0 select-none overflow-hidden rounded-[28px] border border-[#ff781f]/25"
        style={{ width: frame.width, height: frame.height, maxWidth: '100%', maxHeight: '100%' }}
      >
      <div className="absolute inset-0 opacity-90" style={{
        background:
          'radial-gradient(circle at 16% 18%, rgba(159,69,255,.20), transparent 22%), radial-gradient(circle at 86% 78%, rgba(255,21,147,.18), transparent 24%), radial-gradient(circle at 55% 45%, rgba(255,120,31,.09), transparent 38%)',
      }} />

      <div className="relative grid h-full w-full grid-cols-[21%_1fr_22%] grid-rows-[22%_1fr] gap-x-[2%] gap-y-[1%] px-[3.6%] pb-[3%] pt-[2.6%]">
        <div className="col-span-3 flex items-center justify-center overflow-visible">
          <div className="relative text-center">
            <div
              className="sb-title -rotate-1 text-[clamp(2.15rem,5.7vw,5.45rem)] uppercase leading-[.9] tracking-tight"
              style={{
                ...DISPLAY,
                color: '#ff891f',
                WebkitTextStroke: '2px rgba(255,255,255,.2)',
                textShadow: '0 0 16px #ff5f1f, 6px 6px 0 #7724ff, -5px 2px 0 #ff1593',
              }}
            >
              SQUARE BIZ!
            </div>
            <div className="mt-1 -rotate-1 text-[clamp(.42rem,1vw,.86rem)] font-black uppercase tracking-[.24em] text-white/85">
              BE A CONTESTANT OR BE A SQUARE!
            </div>
          </div>
        </div>

        <section className="relative flex min-h-0 flex-col items-center justify-center rounded-3xl border border-[#9f45ff]/55 bg-[#7b2cff]/10 px-[6%] py-[4%]">
          <div className="absolute -left-3 top-[8%] h-2 w-16 -rotate-12 bg-[#ff1593]/70" />
          <div className="text-[clamp(.45rem,.85vw,.8rem)] uppercase tracking-[.25em] text-white/55" style={MONO}>HOST</div>
          <div className="my-[7%] text-[clamp(2rem,4.5vw,5rem)] leading-none" style={{ filter: 'drop-shadow(0 0 15px #9f45ff)' }}>♛</div>
          <div className="max-w-full truncate text-[clamp(.65rem,1.25vw,1.1rem)] font-black text-white">{hostLabel}</div>
          <div className="mt-[5%] rounded-full border border-[#ff781f]/50 px-3 py-1 text-[clamp(.38rem,.65vw,.6rem)] uppercase tracking-widest text-[#ffd633]" style={MONO}>ON AIR</div>
        </section>

        <section className="relative flex items-center justify-center">
          <div className="absolute -inset-[4%] rounded-[28px] border border-[#ff781f]/35 opacity-60" />
          <div className="relative grid h-full w-full grid-cols-3 grid-rows-3 gap-[2.8%]">
            {board.map((mark, index) => {
              const canClick = interactive && gameState.canSelectSquare && !mark;
              return (
                <button
                  type="button"
                  key={index}
                  disabled={!canClick}
                  onClick={() => canClick && onSquareClick?.(index)}
                  className={`group relative overflow-hidden rounded-[18%] border-[clamp(2px,.35vw,5px)] transition-all disabled:cursor-default ${canClick ? 'sb-open-square cursor-pointer hover:scale-[1.035]' : ''}`}
                  style={{
                    borderColor: mark === 'X' ? `${X_COLOR}cc` : mark === 'O' ? `${O_COLOR}cc` : '#ff781f',
                    background: mark
                      ? `radial-gradient(circle, ${mark === 'X' ? X_COLOR : O_COLOR}16, rgba(255,255,255,.015))`
                      : 'linear-gradient(145deg, rgba(255,120,31,.08), rgba(159,69,255,.035))',
                    boxShadow: mark
                      ? `inset 0 0 18px ${mark === 'X' ? X_COLOR : O_COLOR}25, 0 0 8px ${mark === 'X' ? X_COLOR : O_COLOR}55`
                      : 'inset 0 0 18px rgba(255,120,31,.08), 0 0 8px rgba(255,120,31,.26)',
                  }}
                  aria-label={mark ? `Square ${index + 1}, claimed by Player ${mark}` : `Choose square ${index + 1}`}
                >
                  {!mark && (
                    <span className="absolute left-[10%] top-[8%] text-[clamp(.35rem,.65vw,.65rem)] text-white/15" style={MONO}>{index + 1}</span>
                  )}
                  <Marker mark={mark} slam={index === slammedSquare} compact={compact} />
                </button>
              );
            })}

            {win && (
              <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                <line
                  className="sb-win-line"
                  x1={win[0]} y1={win[1]} x2={win[2]} y2={win[3]}
                  stroke={gameState.winner === 'X' ? X_COLOR : O_COLOR}
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col justify-center gap-[5%]">
          <MiniPlayer player={xPlayer} mark="X" current={gameState.currentMark === 'X' && gameState.phase !== 'finished'} />
          <MiniPlayer player={oPlayer} mark="O" current={gameState.currentMark === 'O' && gameState.phase !== 'finished'} />

          <div className="rounded-2xl border border-[#ffd633]/25 bg-[#ffd633]/5 px-3 py-2 text-center">
            <div className="text-[clamp(.35rem,.55vw,.55rem)] uppercase tracking-[.18em] text-[#ffd633]/65" style={MONO}>
              {gameState.phase === 'finished'
                ? 'WINNER'
                : gameState.phase === 'board'
                  ? 'CHOOSE A SQUARE'
                  : gameState.phase === 'intro'
                    ? 'SHOW OPEN'
                    : 'QUESTION LIVE'}
            </div>
            <div className="mt-1 text-[clamp(.55rem,1vw,.95rem)] font-black uppercase" style={{
              color: gameState.winner === 'X' || gameState.currentMark === 'X' ? X_COLOR : O_COLOR,
            }}>
              {gameState.winner ? `PLAYER ${gameState.winner}` : `PLAYER ${gameState.currentMark || 'X'}`}
            </div>
          </div>
        </section>
      </div>
      </div>
    </div>
  );
}

function AnswerButton({ letter, text, disabled, selected, correct, wrong, onClick }) {
  let border = 'rgba(255,255,255,.18)';
  let color = 'rgba(255,255,255,.88)';
  let bg = 'rgba(255,255,255,.04)';

  if (selected) {
    border = GOLD;
    color = GOLD;
    bg = 'rgba(255,214,51,.10)';
  }
  if (correct) {
    border = '#4ade80';
    color = '#4ade80';
    bg = 'rgba(74,222,128,.12)';
  }
  if (wrong) {
    border = '#ef4444';
    color = '#ef4444';
    bg = 'rgba(239,68,68,.10)';
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="min-h-[62px] rounded-2xl border-2 px-4 py-3 text-left transition-all enabled:hover:scale-[1.018] enabled:active:scale-[.985] disabled:cursor-default"
      style={{ borderColor: border, color, background: bg }}
    >
      <span className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs" style={{ ...MONO, borderColor: 'currentColor' }}>{letter}</span>
      <span className="font-bold">{text}</span>
    </button>
  );
}

export function SquareBizCueCard({ gameState = {}, onAnswer, now = Date.now(), busy = false }) {
  const phase = gameState.phase;
  const question = gameState.currentQuestion;
  if (!question || !['question_read', 'answering', 'result'].includes(phase)) return null;

  const choices = Array.isArray(question.choices) ? question.choices : [];
  const reading = phase === 'question_read';
  const result = phase === 'result';
  const deadline = Number(gameState.answerDeadlineAt || 0);
  const seconds = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-hidden bg-[#06020d]/78 p-3 backdrop-blur-md sm:p-6">
      <div
        className={`sb-cue relative w-full overflow-hidden rounded-[32px] border-2 transition-all duration-700 ${reading ? 'max-w-[1000px] p-7 sm:p-10' : 'max-w-[900px] p-5 sm:p-7'}`}
        style={{
          borderColor: result
            ? gameState.answerResult ? '#4ade80' : '#ef4444'
            : ORANGE,
          background: 'linear-gradient(145deg, rgba(46,8,72,.98), rgba(18,5,34,.98) 58%, rgba(71,10,78,.96))',
          boxShadow: result
            ? `0 0 46px ${gameState.answerResult ? 'rgba(74,222,128,.25)' : 'rgba(239,68,68,.22)'}`
            : '0 0 50px rgba(255,120,31,.18), inset 0 0 34px rgba(159,69,255,.12)',
        }}
      >
        <div className="pointer-events-none absolute -left-12 -top-9 h-28 w-52 rotate-[-18deg] bg-[#ff1593]/20 blur-sm" />
        <div className="pointer-events-none absolute -right-12 bottom-2 h-28 w-56 rotate-[14deg] bg-[#25b9ff]/18 blur-sm" />

        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <div className="rounded-full border border-[#ffd633]/45 bg-[#ffd633]/10 px-3 py-1.5 text-[8px] uppercase tracking-[.22em] text-[#ffd633]" style={MONO}>
              SQUARE BIZ! · CUE
            </div>
            {!reading && !result && seconds != null && (
              <div className={`text-xl font-black ${seconds <= 3 ? 'sb-countdown-hot' : 'text-white/65'}`} style={MONO}>{seconds}</div>
            )}
          </div>

          <div
            className={`mt-5 text-center font-black uppercase leading-[1.03] text-white ${reading ? 'text-[clamp(1.8rem,5vw,4.6rem)]' : 'text-[clamp(1.4rem,3.2vw,2.8rem)]'}`}
            style={{ ...DISPLAY, textShadow: '3px 3px 0 #7626c7, -2px 1px 0 #ff781f' }}
          >
            {question.question}
          </div>

          {reading && (
            <div className="mt-7 text-center text-[9px] uppercase tracking-[.2em] text-white/35" style={MONO}>
              READ IT… CHOICES IN A SEC
            </div>
          )}

          {!reading && choices.length === 4 && (
            <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {choices.map((text, index) => {
                const letter = ['A', 'B', 'C', 'D'][index];
                const selected = gameState.selectedAnswer === letter;
                const correct = result && gameState.correctAnswer === letter;
                const wrong = result && selected && gameState.answerResult === false;
                return (
                  <AnswerButton
                    key={letter}
                    letter={letter}
                    text={text}
                    disabled={busy || result || gameState.canAnswer !== true}
                    selected={!result && selected}
                    correct={correct}
                    wrong={wrong}
                    onClick={() => onAnswer?.(letter)}
                  />
                );
              })}
            </div>
          )}

          {result && (
            <div className="mt-6 text-center">
              <div
                className={`sb-result-pop text-[clamp(2rem,7vw,5rem)] font-black uppercase ${gameState.answerResult ? 'text-[#4ade80]' : 'text-[#ef4444]'}`}
                style={{ ...DISPLAY, textShadow: '0 0 24px currentColor' }}
              >
                {gameState.answerResult ? 'CORRECT!' : gameState.selectedAnswer ? 'WRONG!' : 'TIME!'}
              </div>
              {gameState.correctAnswer && (
                <div className="mt-2 text-sm text-white/55">
                  Answer: <span className="font-black text-white">{gameState.correctAnswer}. {gameState.correctAnswerText}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const INTRO_SLIDES = [
  {
    kicker: 'WELCOME TO',
    title: 'SQUARE BIZ!',
    body: 'BE A CONTESTANT OR BE A SQUARE!',
    accent: ORANGE,
    art: 'logo',
  },
  {
    kicker: 'HERE’S THE BIZ',
    title: 'PICK. ANSWER. CLAIM.',
    body: 'Choose an open square. Get the question right and your piece owns it. Miss it? The square stays open.',
    accent: PURPLE,
    art: 'rules',
  },
  {
    kicker: 'THAT’S IT!',
    title: 'THREE IN A ROW.',
    body: 'Right answers build your line. First Player X or Player O to connect three squares takes the round.',
    accent: X_COLOR,
    art: 'win',
  },
];

function IntroArt({ type }) {
  if (type === 'rules') {
    return (
      <div className="grid w-full max-w-[470px] grid-cols-3 items-center gap-3">
        <div className="rounded-2xl border-2 border-[#ff781f] p-3 text-center">
          <div className="text-4xl">☝️</div><div className="mt-2 text-[7px] text-[#ff781f]" style={MONO}>PICK</div>
        </div>
        <div className="rounded-2xl border-2 border-[#ffd633] p-3 text-center">
          <div className="text-4xl">?</div><div className="mt-2 text-[7px] text-[#ffd633]" style={MONO}>ANSWER</div>
        </div>
        <div className="rounded-2xl border-2 border-[#4ade80] p-3 text-center">
          <div className="text-4xl">💥</div><div className="mt-2 text-[7px] text-[#4ade80]" style={MONO}>CLAIM</div>
        </div>
      </div>
    );
  }

  if (type === 'win') {
    return (
      <div className="relative w-[220px] sm:w-[250px]">
        <div className="relative grid aspect-square w-full grid-cols-3 gap-2">
          {[0,1,2,3,4,5,6,7,8].map((i) => (
            <div
              key={i}
              className="relative aspect-square rounded-lg border-2 border-[#ff781f]/65 bg-[#ff781f]/5"
            >
              {[0,4,8].includes(i) && (
                <PieceArt mark="X" className="absolute inset-[12%] h-auto w-auto" />
              )}
            </div>
          ))}

          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <line
              x1="16"
              y1="16"
              x2="84"
              y2="84"
              stroke="#ff1593"
              strokeWidth="4"
              strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 8px #ff1593)' }}
            />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[170px] w-[300px]">
      <PieceArt mark="X" className="absolute left-0 top-4 h-36 w-36 -rotate-6 opacity-90" />
      <PieceArt mark="O" className="absolute right-0 top-2 h-40 w-40 rotate-6 opacity-90" />
      <div className="absolute inset-x-0 bottom-0 text-center text-5xl">♛</div>
    </div>
  );
}

export function SquareBizIntro({
  gameState = {},
  now = Date.now(),
  audioSrc = '/assets/square-biz/Square%20Biz!.mp3',
  playAudio = false,
}) {
  const audioRef = useRef(null);
  const audioOwnerRef = useRef(`sb-audio-${Math.random().toString(36).slice(2)}-${Date.now()}`);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [audioSuppressed, setAudioSuppressed] = useState(false);
  const start = Number(gameState.introStartedAt || now);
  const end = Number(gameState.introEndsAt || start + 30_800);
  const duration = Math.max(1, end - start);
  const elapsed = Math.max(0, now - start);
  const ratio = Math.min(0.999, elapsed / duration);
  const index = ratio < .34 ? 0 : ratio < .67 ? 1 : 2;
  const slide = INTRO_SLIDES[index];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playAudio) return undefined;

    let cancelled = false;
    const owner = audioOwnerRef.current;
    const lockKey = 'tng_square_biz_intro_audio_lock';
    const targetTime = Math.max(0, elapsed / 1000);
    const lockExpiry = Math.max(Date.now() + 5_000, end + 3_000);

    const claimAudio = () => {
      try {
        const raw = localStorage.getItem(lockKey);
        const current = raw ? JSON.parse(raw) : null;
        const sameIntro = Number(current?.start || 0) === start;
        const lockAlive = Number(current?.expiresAt || 0) > Date.now();

        if (current?.owner && current.owner !== owner && sameIntro && lockAlive) {
          setAudioSuppressed(true);
          return false;
        }

        localStorage.setItem(lockKey, JSON.stringify({
          owner,
          start,
          expiresAt: lockExpiry,
        }));
        setAudioSuppressed(false);
        return true;
      } catch {
        // If storage is unavailable, favor audio instead of silently muting the intro.
        setAudioSuppressed(false);
        return true;
      }
    };

    const releaseAudio = () => {
      try {
        const raw = localStorage.getItem(lockKey);
        const current = raw ? JSON.parse(raw) : null;
        if (current?.owner === owner) {
          localStorage.removeItem(lockKey);
        }
      } catch {}
    };

    const begin = async () => {
      if (cancelled || !claimAudio()) return;

      try {
        if (Math.abs(audio.currentTime - targetTime) > 1.25) {
          audio.currentTime = targetTime;
        }
        await audio.play();
        if (!cancelled) setAudioBlocked(false);
      } catch {
        if (!cancelled) setAudioBlocked(true);
      }
    };

    if (audio.readyState >= 3) {
      begin();
    } else {
      audio.addEventListener('canplaythrough', begin, { once: true });
      audio.load();
    }

    const handleStorage = (event) => {
      if (event.key !== lockKey || cancelled) return;
      try {
        const current = event.newValue ? JSON.parse(event.newValue) : null;
        if (current?.owner && current.owner !== owner && Number(current.start || 0) === start) {
          audio.pause();
          setAudioSuppressed(true);
        }
      } catch {}
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      cancelled = true;
      audio.removeEventListener('canplaythrough', begin);
      window.removeEventListener('storage', handleStorage);
      audio.pause();
      releaseAudio();
    };
  // Re-run only when a new intro starts or this screen becomes audio-capable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, playAudio]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#020104] px-4">
      <audio ref={audioRef} src={audioSrc} preload="auto" playsInline />
      <div className="absolute inset-0 opacity-45" style={{
        background:
          'radial-gradient(circle at 25% 15%, rgba(159,69,255,.28), transparent 26%), radial-gradient(circle at 78% 70%, rgba(255,21,147,.24), transparent 30%), radial-gradient(circle at 50% 55%, rgba(255,120,31,.13), transparent 35%)',
      }} />

      <div key={index} className="sb-intro-slide relative z-10 flex w-full max-w-[980px] flex-col items-center justify-center text-center">
        <div className="text-[9px] uppercase tracking-[.35em]" style={{ ...MONO, color: slide.accent }}>{slide.kicker}</div>
        <div
          className="mt-3 text-[clamp(3rem,9vw,8rem)] font-black uppercase leading-[.86] text-white"
          style={{ ...DISPLAY, textShadow: `5px 5px 0 ${slide.accent}, -4px 2px 0 #7323cf` }}
        >
          {slide.title}
        </div>
        <div className="mt-6">
          <IntroArt type={slide.art} />
        </div>
        <div className="mt-4 max-w-[760px] px-4 text-[clamp(.8rem,1.5vw,1.15rem)] font-bold leading-snug text-white/78">
          {slide.body}
        </div>
      </div>

      <div className="absolute bottom-5 left-1/2 h-1.5 w-[min(560px,74vw)] -translate-x-1/2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-[#9f45ff] via-[#ff1593] to-[#ff781f]" style={{ width: `${Math.max(2, ratio * 100)}%` }} />
      </div>

      {playAudio && !audioSuppressed && audioBlocked && (
        <button
          type="button"
          onClick={async () => {
            try {
              const lockKey = 'tng_square_biz_intro_audio_lock';
              localStorage.setItem(lockKey, JSON.stringify({
                owner: audioOwnerRef.current,
                start,
                expiresAt: Math.max(Date.now() + 5_000, end + 3_000),
              }));
              setAudioSuppressed(false);
              await audioRef.current?.play();
              setAudioBlocked(false);
            } catch {}
          }}
          className="absolute bottom-10 right-4 z-20 rounded-full border border-[#ffd633]/50 bg-[#ffd633]/10 px-4 py-2 text-[8px] uppercase tracking-widest text-[#ffd633]"
          style={MONO}
        >
          TAP FOR JINGLE
        </button>
      )}
    </div>
  );
}

export function SquareBizShowStyles() {
  return (
    <style>{`
      @keyframes sb-piece-slam {
        0% { transform: scale(2.8) rotate(-18deg); opacity: .05; filter: blur(8px); }
        55% { transform: scale(.82) rotate(4deg); opacity: 1; filter: blur(0); }
        72% { transform: scale(1.13) rotate(-2deg); }
        100% { transform: scale(1) rotate(0); }
      }
      @keyframes sb-board-hit {
        0%,100% { box-shadow: 0 0 0 rgba(255,120,31,0); }
        50% { box-shadow: 0 0 30px rgba(255,120,31,.42); }
      }
      @keyframes sb-player-pulse {
        0%,100% { box-shadow: 0 0 10px color-mix(in srgb, var(--sb-player-color) 25%, transparent); }
        50% { box-shadow: 0 0 26px color-mix(in srgb, var(--sb-player-color) 62%, transparent); }
      }
      @keyframes sb-result {
        0% { transform: scale(.25) rotate(-8deg); opacity: 0; }
        65% { transform: scale(1.16) rotate(2deg); opacity: 1; }
        100% { transform: scale(1) rotate(0); }
      }
      @keyframes sb-intro {
        0% { opacity: 0; transform: scale(.82) rotate(-2deg); filter: blur(10px); }
        18% { opacity: 1; transform: scale(1.03) rotate(0); filter: blur(0); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes sb-win {
        0% { stroke-dasharray: 0 160; opacity: .2; }
        100% { stroke-dasharray: 160 0; opacity: 1; }
      }
      @keyframes sb-hot {
        0%,100% { transform: scale(1); color:#fff; }
        50% { transform: scale(1.18); color:#ef4444; }
      }
      .sb-stage { background: linear-gradient(135deg, rgba(22,6,37,.94), rgba(8,3,18,.97)); }
      .sb-piece-slam { animation: sb-piece-slam 680ms cubic-bezier(.12,.82,.22,1.24) both; }
      .sb-open-square { animation: sb-board-hit 2.4s ease-in-out infinite; }
      .sb-current-player { animation: sb-player-pulse 1.4s ease-in-out infinite; }
      .sb-result-pop { animation: sb-result 520ms cubic-bezier(.12,.85,.22,1.25) both; }
      .sb-intro-slide { animation: sb-intro 760ms cubic-bezier(.2,.8,.2,1) both; }
      .sb-win-line { filter: drop-shadow(0 0 6px currentColor); animation: sb-win 650ms ease-out both; }
      .sb-countdown-hot { animation: sb-hot 750ms ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .sb-piece-slam,.sb-open-square,.sb-current-player,.sb-result-pop,.sb-intro-slide,.sb-win-line,.sb-countdown-hot { animation: none !important; }
      }
    `}</style>
  );
}
