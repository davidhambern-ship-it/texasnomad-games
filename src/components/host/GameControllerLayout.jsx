import React from 'react';

export function HostWorkspace({ primary, companion, className = '' }) {
  return (
    <section
      className={`grid min-w-0 grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(220px,280px)] md:items-start xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] ${className}`}
    >
      <div className="min-w-0">{primary}</div>
      <div className="min-w-0">{companion}</div>
    </section>
  );
}

export function HostControlDeck({ children, className = '' }) {
  return (
    <section
      className={`grid gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 ${className}`}
    >
      {children}
    </section>
  );
}

export function HostControlCard({
  title,
  value,
  accent = '#BC13FE',
  children,
  className = '',
  compact = false,
}) {
  return (
    <div
      className={`rounded-xl border bg-black/55 ${compact ? 'p-2.5' : 'p-3'} ${className}`}
      style={{
        borderColor: `${accent}38`,
        boxShadow: `inset 0 0 22px ${accent}08`,
      }}
    >
      {title && (
        <div
          className="text-[6px] uppercase tracking-[.18em]"
          style={{ fontFamily: "'Press Start 2P', monospace", color: `${accent}cc` }}
        >
          {title}
        </div>
      )}
      {value !== undefined && value !== null && (
        <div
          className="mt-2 font-heading text-2xl"
          style={{ color: accent }}
        >
          {value}
        </div>
      )}
      {children}
    </div>
  );
}
