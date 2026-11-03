"use client";

import { useEffect, useRef, useState } from "react";
import { swatchHex } from "@/config";
import { type HudState, startGame } from "./engine";
import { startStyleScene } from "./styleScene";

const CREDITS = [
  "Map data (c) OpenStreetMap contributors, available under the Open Database Licence.",
  "Contains information licensed under the Open Government Licence, Ontario.",
  "Contains information provided by the City of Waterloo under licence.",
  "Contains information provided by the Regional Municipality of Waterloo under licence.",
  "Not affiliated with the University of Waterloo, House House or Panic.",
];

const panel: React.CSSProperties = {
  position: "absolute", background: swatchHex("panel", "ui"), color: swatchHex("text", "ui"),
  borderRadius: 14, padding: "12px 16px", fontSize: 15, lineHeight: 1.45, boxShadow: `0 4px 0 ${swatchHex("accent", "ui")}`,
  userSelect: "none",
};

export default function Game() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState<HudState | null>(null);
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
      void startStyleScene(ref.current!);
    } else {
      startGame(ref.current!, setHud).then((s) => { if (cancelled) s(); else stop = s; });
    }
    return () => { cancelled = true; stop?.(); };
  }, [isStyle]);

  return (
    <>
      <canvas ref={ref} style={{ width: "100vw", height: "100vh" }} />
      {hud && !isTest && (
        <>
          <div style={{ ...panel, top: 16, left: 16, minWidth: 280 }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>Goose to-do list · {hud.area}</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>{hud.clock}</div>
            {hud.tasks.map((t) => (
              <div key={t.text} style={{ textDecoration: t.done ? "line-through" : "none", opacity: t.done ? 0.55 : 1 }}>
                {t.done ? "✓" : "○"} {t.text}
              </div>
            ))}
          </div>
          <div style={{ ...panel, top: 16, right: 16, textAlign: "right", minWidth: 150 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>MENACE</div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{hud.menace.banked.toLocaleString()}</div>
            {hud.menace.pending > 0 && (
              <div style={{ fontWeight: 700 }}>+{hud.menace.pending.toLocaleString()} × {hud.menace.multiplier.toFixed(1)}
                <div style={{ height: 4, background: swatchHex("accent", "ui"), width: `${(hud.menace.window / 4) * 100}%`, borderRadius: 2, marginTop: 3, marginLeft: "auto" }} />
              </div>
            )}
          </div>
          {hud.toast && (
            <div style={{ ...panel, top: 16, left: "50%", transform: "translateX(-50%)", fontWeight: 700 }}>✓ {hud.toast}</div>
          )}
          {title && (
            <div style={{ ...panel, top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", padding: "24px 32px" }}>
              <div style={{ fontSize: 30, fontWeight: 800 }}>Waterloo Goose Simulator</div>
              <div style={{ marginTop: 6 }}>A Canada goose is loose on the University of Waterloo campus.</div>
              <div style={{ marginTop: 4, opacity: 0.75, fontSize: 13 }}>The campus is built from open map data: City of Waterloo footprints, Ontario lidar, OpenStreetMap.</div>
              <div style={{ marginTop: 14, fontWeight: 700 }}>Press any key or click to start</div>
            </div>
          )}
          {hud.prompt && <div style={{ ...panel, bottom: 70, left: "50%", transform: "translateX(-50%)" }}>{hud.prompt}</div>}
          <div style={{ ...panel, bottom: 16, left: 16, fontSize: 13, padding: "8px 12px" }}>
            WASD move · Shift run · Space honk · G or click grab · C crouch · F flap · Q E turn camera · wheel zoom · V free camera
          </div>
          <div style={{ ...panel, bottom: 16, right: 16, fontSize: 12, padding: "6px 10px", cursor: "pointer" }}
            onClick={() => setCredits((c) => !c)}>
            © OpenStreetMap contributors · credits
          </div>
          {credits && (
            <div style={{ ...panel, bottom: 56, right: 16, maxWidth: 420, fontSize: 13 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Waterloo Goose Simulator</div>
              {CREDITS.map((c) => <div key={c}>{c}</div>)}
              <div style={{ marginTop: 6, opacity: 0.7 }}>Renderer: {hud.backend}</div>
            </div>
          )}
        </>
      )}
    </>
  );
}
