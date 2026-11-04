"use client";

import { useEffect, useRef, useState } from "react";

/** The name of the place, written large for a moment when the goose arrives (entering a hotspot, or after a teleport). */
export function AreaToast({ area, near }: { area: string; near: boolean }) {
  const [shown, setShown] = useState<{ name: string; sub: string; n: number } | null>(null);
  const wasNear = useRef(false), n = useRef(0);
  useEffect(() => {
    if (near && !wasNear.current) setShown({ name: area, sub: "Goose business here", n: ++n.current });
    wasNear.current = near;
  }, [near, area]);
  useEffect(() => {
    const onTele = (e: Event) => {
      const d = (e as CustomEvent<{ phase: string; label?: string }>).detail;
      if (d.phase === "done" && d.label) setShown({ name: d.label, sub: "", n: ++n.current });
    };
    window.addEventListener("wgs:teleport", onTele);
    return () => window.removeEventListener("wgs:teleport", onTele);
  }, []);
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(null), 3700);
    return () => clearTimeout(t);
  }, [shown]);
  if (!shown) return null;
  return (
    <div key={shown.n} className="hud area-toast">
      <div className="name">{shown.name}</div>
      <div className="rule" />
      {shown.sub && <div className="sub">{shown.sub}</div>}
    </div>
  );
}
