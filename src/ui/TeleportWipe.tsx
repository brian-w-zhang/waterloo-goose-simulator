"use client";

import { useEffect, useState } from "react";
import type { TeleportEvent } from "@/game/engine";

/**
 * Teleport transition: a paper iris closes on the goose ("out"), stays shut while the destination loads,
 * and opens on the goose at the destination ("in"). Timings come from the engine's events.
 */
export function TeleportWipe() {
  const [s, setS] = useState<{ x: number; y: number; r: number; ms: number; label?: string; shut: boolean } | null>(null);
  useEffect(() => {
    const onTele = (e: Event) => {
      const d = (e as CustomEvent<TeleportEvent>).detail;
      // just big enough to clear the farthest screen corner, so the whole duration reads as closing
      const W = window.innerWidth, H = window.innerHeight;
      const R = Math.hypot(Math.max(d.x, W - d.x), Math.max(d.y, H - d.y)) + 12;
      if (d.phase === "out") {
        // start open, then close on the next frame so the transition runs
        setS({ x: d.x, y: d.y, r: R, ms: 0, label: d.label, shut: false });
        requestAnimationFrame(() => requestAnimationFrame(() => setS((p) => p && { ...p, r: 0, ms: d.ms, shut: true })));
      } else if (d.phase === "in") {
        setS((p) => ({ x: d.x, y: d.y, r: 0, ms: 0, label: p?.label, shut: true }));
        requestAnimationFrame(() => requestAnimationFrame(() => setS((p) => p && { ...p, r: R, ms: d.ms, shut: false })));
      } else {
        setS(null);
      }
    };
    window.addEventListener("wgs:teleport", onTele);
    return () => window.removeEventListener("wgs:teleport", onTele);
  }, []);
  if (!s) return null;
  const ease = s.shut ? "cubic-bezier(0.45, 0, 0.7, 0.5)" : "cubic-bezier(0.25, 0.7, 0.3, 1)";
  return (
    <div className="wipe">
      <div className="wipe-hole" style={{ left: s.x, top: s.y, width: s.r * 2, height: s.r * 2,
        transition: s.ms ? `width ${s.ms}ms ${ease}, height ${s.ms}ms ${ease}` : "none" }} />
      {s.shut && s.r === 0 && (
        <div className="wipe-note" style={{ animation: `fade-in 0.25s ${Math.round(s.ms * 0.8)}ms both` }}>
          <div className="where hand">{s.label ? `Off to ${s.label}` : "Flap flap flap"}</div>
          <div className="dots"><i /><i /><i /></div>
        </div>
      )}
    </div>
  );
}
