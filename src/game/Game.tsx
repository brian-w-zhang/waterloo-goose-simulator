"use client";

import { useEffect, useRef, useState } from "react";
import { swatchHex } from "@/config";
import { AreaToast } from "@/ui/AreaToast";
import { Controls } from "@/ui/Controls";
import { TaskToast, TodoCard } from "@/ui/Notebook";
import { ScoreBadge } from "@/ui/Score";
import { TeleportWipe } from "@/ui/TeleportWipe";
import { type HudState, startGame } from "./engine";
import { HOTSPOTS } from "./hotspot";
import Minimap from "./Minimap";
import { startStyleScene } from "./styleScene";

const CREDITS = [
  "Map data (c) OpenStreetMap contributors, available under the Open Database Licence.",
  "Contains information licensed under the Open Government Licence, Ontario.",
  "Contains information provided by the City of Waterloo under licence.",
  "Contains information provided by the Regional Municipality of Waterloo under licence.",
  "Not affiliated with the University of Waterloo, House House or Panic.",
];

/** Within this many metres of a hotspot anchor the goose is "in" it (the area name is shown on entry). */
const AREA_RADIUS_M = 45;

/** The HUD: styling lives in app/globals.css (palette "ui" colours as --ui-* variables), components in src/ui/. */
export default function Game() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [credits, setCredits] = useState(false);
  const [title, setTitle] = useState(true);
  const isStyle = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("scene") === "style";
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const isTest = !!params && (params.has("test") || params.get("hud") === "0");

  useEffect(() => {
    const dismiss = () => setTitle(false);
    window.addEventListener("keydown", dismiss, { once: true });
    window.addEventListener("pointerdown", dismiss, { once: true });
    return () => { window.removeEventListener("keydown", dismiss); window.removeEventListener("pointerdown", dismiss); };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--sky", swatchHex("sky"));
    let stop: (() => void) | undefined;
    let cancelled = false;
    if (isStyle) {
      startStyleScene(ref.current!).catch((e: Error) => { console.error("[wgs] style scene failed", e); setFatal(e.message); });
    } else {
      startGame(ref.current!, setHud).then((s) => { if (cancelled) s(); else stop = s; },
        (e: Error) => { console.error("[wgs] the game failed to start", e); setFatal(e.message); });
    }
    return () => { cancelled = true; stop?.(); };
  }, [isStyle]);

  const g = hud ? window.__wgs?.goose.state() : undefined;
  const away = g ? Math.min(...HOTSPOTS.map((h) => Math.hypot(h.anchor.x - g.x, h.anchor.z - g.z))) : 0;
  const near = !!g && away < AREA_RADIUS_M;

  return (
    <>
      <canvas ref={ref} style={{ width: "100vw", height: "100vh" }} />
      {fatal && (
        <div role="alert" className="hud hud-card fatal">
          <div style={{ fontWeight: 800, marginBottom: 6 }}>The campus could not load</div>
          <div style={{ fontSize: 13, opacity: 0.8 }}>{fatal}</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>Check that <code>npm run pipeline</code> has built <code>public/world</code>, then reload.</div>
        </div>
      )}
      {hud && !isTest && (
        <>
          <TodoCard area={near || !g ? hud.area : `${hud.area} · ${away < 1000 ? `${Math.round(away / 10) * 10} m` : `${(away / 1000).toFixed(1)} km`}`} clock={hud.clock} tasks={hud.tasks} />
          <ScoreBadge m={hud.menace} />
          <Minimap />
          <AreaToast area={hud.area} near={near} />
          {hud.toast && <TaskToast text={hud.toast} />}
          {hud.prompt && (
            <div className="hud hud-card prompt">
              <span className="kbd">{hud.prompt.split(":")[0]}</span>{hud.prompt.split(":").slice(1).join(":").trim()}
            </div>
          )}
          {!title && <Controls />}
          <div className="hud credits-link" onClick={() => setCredits((c) => !c)}>© OpenStreetMap contributors · credits</div>
          {credits && (
            <div className="hud hud-card credits">
              <b>Waterloo Goose Simulator</b>
              {CREDITS.map((c) => <div key={c}>{c}</div>)}
              <div style={{ marginTop: 6, opacity: 0.7 }}>Renderer: {hud.backend}</div>
            </div>
          )}
          {title && (
            <div className="hud title-card">
              <h1>Waterloo Goose Simulator</h1>
              <p>A Canada goose is loose on the University of Waterloo campus. It has a to-do list.</p>
              <p className="small">The campus is built from open map data: City of Waterloo footprints, Ontario lidar, OpenStreetMap.</p>
              <div className="go"><span className="kbd">any key</span> or click to start</div>
            </div>
          )}
          <TeleportWipe />
        </>
      )}
    </>
  );
}
