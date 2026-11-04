"use client";

import { useEffect, useRef, useState } from "react";

/** MENACE score: a compact badge; a running combo hangs under it as a chip with the multiplier and a timer ring. */
export interface Menace { banked: number; pending: number; multiplier: number; window: number; lastBail: number }
const WINDOW_S = 4; // src/sim/menace.ts COMBO_WINDOW_S
const R = 7, C = 2 * Math.PI * R;

const Honk = () => (
  <svg viewBox="0 0 16 16" aria-hidden><path d="M2 6h3l4-3v10l-4-3H2zM11 5.5q2 2.5 0 5M12.8 3.8q3.4 4.2 0 8.4" strokeWidth="1.6" stroke="currentColor" fill="none" strokeLinecap="round" /></svg>
);

export function ScoreBadge({ m }: { m: Menace }) {
  const [bail, setBail] = useState(0);
  const lastBail = useRef(m.lastBail);
  useEffect(() => {
    if (m.lastBail !== lastBail.current) {
      lastBail.current = m.lastBail;
      if (m.lastBail > 0) { setBail(m.lastBail); const t = setTimeout(() => setBail(0), 1400); return () => clearTimeout(t); }
    }
  }, [m.lastBail]);
  return (
    <div className="hud hud-card score" title="Menace: chain mischief within 4 s for a bigger multiplier">
      <div className="score-label"><Honk />MENACE</div>
      <div key={m.banked} className={`score-value${m.banked ? " bump" : ""}`}>{m.banked.toLocaleString()}</div>
      {m.pending > 0 && (
        <div className="chain">
          <svg className="chain-ring" viewBox="0 0 20 20">
            <circle className="track" cx="10" cy="10" r={R} />
            <circle className="left" cx="10" cy="10" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, m.window / WINDOW_S))} />
          </svg>
          <span>+{m.pending.toLocaleString()}</span>
          <span key={m.multiplier} className="chain-mult bump">×{m.multiplier.toFixed(1)}</span>
        </div>
      )}
      {bail > 0 && m.pending === 0 && <div className="bail">−{bail.toLocaleString()} snatched back!</div>}
    </div>
  );
}
