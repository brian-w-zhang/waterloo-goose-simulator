"use client";

import { useEffect, useState } from "react";

/** Controls: a one-line key hint that fades after a while; H or ? opens the full list. */
const SHORT: [string[], string][] = [[["W", "A", "S", "D"], "move"], [["Shift"], "run"], [["Space"], "honk"], [["G"], "grab"], [["M"], "map"], [["H"], "help"]];
const FULL: [string[], string][] = [
  [["W", "A", "S", "D"], "waddle"], [["Shift"], "run"], [["Space"], "honk"], [["G"], "grab / drop"], [["C"], "crouch (sneak)"],
  [["F"], "flap (with Shift: escape burst)"], [["Q", "E"], "turn the camera"], [["right-drag"], "look around"], [["wheel"], "zoom"],
  [["click"], "fly to that spot"], [["M"], "campus map"], [["Tab"], "fold the to-do list"], [["H"], "this help"],
];
const FADE_MS = 14000;

const Keys = ({ ks }: { ks: string[] }) => <>{ks.map((k) => <span key={k} className="kbd">{k}</span>)}</>;

export function Controls() {
  const [hint, setHint] = useState(true);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHint(false), FADE_MS);
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || e.repeat) return;
      if (e.code === "KeyH" || e.key === "?") { setHelp((h) => !h); setHint(false); }
      if (e.code === "Escape") setHelp(false);
    };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, []);
  if (help) {
    return (
      <div className="hud hud-card help" onClick={() => setHelp(false)}>
        <h3>How to goose</h3>
        <dl>{FULL.map(([ks, what]) => <div key={what} style={{ display: "contents" }}><dt><Keys ks={ks} /></dt><dd>{what}</dd></div>)}</dl>
        <div className="hint">Press H or ? to close.</div>
      </div>
    );
  }
  return (
    <>
      <div className={`hud hud-card controls${hint ? "" : " faded"}`}>
        {SHORT.map(([ks, what]) => <span key={what}><Keys ks={ks} />{what}</span>)}
      </div>
      {!hint && <div className="hud hud-card help-chip" onClick={() => setHelp(true)}><span className="kbd">H</span>controls</div>}
    </>
  );
}
