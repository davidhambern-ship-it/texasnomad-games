import React, { useEffect, useMemo, useRef, useState } from 'react';

function selectedCells(a, b) {
  if (!a || !b) return [];
  const dy = b.y - a.y;
  const dx = b.x - a.x;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  if (!(dx === 0 || dy === 0 || adx === ady)) return [];

  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  const len = Math.max(adx, ady) + 1;
  const cells = [];

  for (let i = 0; i < len; i += 1) {
    cells.push(`${a.y + sy * i}-${a.x + sx * i}`);
  }

  return cells;
}

function multiColorBackground(colors) {
  const unique = [...new Set(colors.filter(Boolean))];
  if (!unique.length) return null;
  if (unique.length === 1) return `${unique[0]}25`;

  const slice = 100 / unique.length;
  const stops = unique.flatMap((color, index) => {
    const start = (index * slice).toFixed(2);
    const end = ((index + 1) * slice).toFixed(2);
    return [`${color} ${start}%`, `${color} ${end}%`];
  });

  return `conic-gradient(from 45deg, ${stops.join(', ')})`;
}

export default function NeonWordSearchBoard({
  grid = [],
  words = [],
  players = [],
  mySeat,
  myColor = '#FFD700',
  canInteract = false,
  onSubmit,
  maxBoardPx = 650,
}) {
  const [start, setStart] = useState(null);
  const [preview, setPreview] = useState([]);
  const [selecting, setSelecting] = useState(false);
  const [viewportTick, setViewportTick] = useState(0);
  const boardRef = useRef(null);
  const activePointerRef = useRef(null);

  useEffect(() => {
    const resize = () => setViewportTick((value) => value + 1);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const size = grid.length || 1;
  const availableWidth = Math.max(260, Math.min(maxBoardPx, window.innerWidth - 40));
  const availableHeight = Math.max(260, Math.min(maxBoardPx, window.innerHeight - 190));
  const boardPx = Math.min(availableWidth, availableHeight);
  const gap = size >= 20 ? 1 : 2;
  const cellSize = Math.max(12, Math.floor((boardPx - gap * (size - 1) - 16) / size));

  void viewportTick;

  const colorBySeat = useMemo(
    () => new Map(players.map((player) => [String(player.seatNumber), player.color])),
    [players],
  );

  const foundColorsByCell = useMemo(() => {
    const map = new Map();

    for (const word of words) {
      if (!word.found || !Array.isArray(word.cells)) continue;
      const color = word.foundBy === 'reveal'
        ? '#7a7a7a'
        : colorBySeat.get(String(word.foundBy)) || '#7a7a7a';

      for (const cell of word.cells) {
        const colors = map.get(cell) || [];
        colors.push(color);
        map.set(cell, colors);
      }
    }

    return map;
  }, [words, colorBySeat]);

  function pointFromClient(clientX, clientY) {
    const element = document.elementFromPoint(clientX, clientY);
    if (!element) return null;
    const target = element.closest?.('[data-ws-cell="1"]');
    if (!target || !boardRef.current?.contains(target)) return null;

    return {
      y: Number(target.dataset.y),
      x: Number(target.dataset.x),
    };
  }

  function begin(y, x) {
    if (!canInteract) return;
    setSelecting(true);
    setStart({ y, x });
    setPreview([`${y}-${x}`]);
  }

  function move(y, x) {
    if (!canInteract || !selecting || !start) return;
    setPreview(selectedCells(start, { y, x }));
  }

  async function finish(y, x) {
    if (!selecting || !start) return;

    const cells = selectedCells(start, { y, x });
    setSelecting(false);
    setStart(null);
    setPreview([]);
    activePointerRef.current = null;

    if (!canInteract || cells.length < 2) return;
    await onSubmit?.(cells);
  }

  function cancelSelection() {
    setSelecting(false);
    setStart(null);
    setPreview([]);
    activePointerRef.current = null;
  }

  function handlePointerDown(event, y, x) {
    if (!canInteract) return;

    event.preventDefault();
    activePointerRef.current = event.pointerId;

    try {
      boardRef.current?.setPointerCapture?.(event.pointerId);
    } catch {}

    begin(y, x);
  }

  function handlePointerMove(event) {
    if (
      !canInteract ||
      !selecting ||
      activePointerRef.current !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    const point = pointFromClient(event.clientX, event.clientY);
    if (point) move(point.y, point.x);
  }

  function handlePointerUp(event) {
    if (
      !selecting ||
      activePointerRef.current !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    const point = pointFromClient(event.clientX, event.clientY);

    try {
      boardRef.current?.releasePointerCapture?.(event.pointerId);
    } catch {}

    if (point) {
      finish(point.y, point.x);
    } else {
      cancelSelection();
    }
  }

  return (
    <div
      ref={boardRef}
      className="inline-block rounded-xl p-2 select-none overscroll-contain"
      style={{
        background: 'linear-gradient(135deg,#07040d,#0d0620)',
        border: `2px solid ${myColor}55`,
        boxShadow: `0 0 26px ${myColor}18, inset 0 0 30px rgba(255,255,255,.02)`,
        touchAction: canInteract ? 'none' : 'pan-y',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={cancelSelection}
      onLostPointerCapture={cancelSelection}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${size}, ${cellSize}px)`,
          gap,
        }}
      >
        {grid.map((row, y) => (
          row.map((letter, x) => {
            const id = `${y}-${x}`;
            const foundColors = foundColorsByCell.get(id) || [];
            const found = foundColors.length > 0;
            const previewed = preview.includes(id);
            const activeColor = previewed ? myColor : foundColors[0];
            const background = previewed
              ? `${myColor}2c`
              : multiColorBackground(foundColors);

            return (
              <div
                key={id}
                data-ws-cell="1"
                data-y={y}
                data-x={x}
                onPointerDown={(event) => handlePointerDown(event, y, x)}
                className="flex items-center justify-center rounded-[3px] font-bold"
                style={{
                  width: cellSize,
                  height: cellSize,
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: Math.max(6, Math.floor(cellSize * 0.42)),
                  cursor: canInteract ? 'pointer' : 'default',
                  color: previewed
                    ? myColor
                    : found
                      ? '#ffffff'
                      : 'rgba(255,255,255,.72)',
                  background: background || 'rgba(188,19,254,.055)',
                  border: previewed
                    ? `2px solid ${myColor}`
                    : found
                      ? `1px solid ${activeColor}aa`
                      : '1px solid rgba(188,19,254,.16)',
                  boxShadow: previewed
                    ? `0 0 10px ${myColor}80`
                    : found
                      ? `0 0 7px ${activeColor}45`
                      : 'none',
                  textShadow: previewed || found
                    ? `0 0 7px ${activeColor || myColor}`
                    : 'none',
                }}
              >
                {letter}
              </div>
            );
          })
        ))}
      </div>
    </div>
  );
}
