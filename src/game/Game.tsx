"use client";

import { useEffect, useRef } from "react";
import { swatchHex } from "@/config";
import { startGame } from "./engine";
import { startStyleScene } from "./styleScene";

export default function Game() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    document.documentElement.style.setProperty("--sky", swatchHex("sky"));
    let stop: (() => void) | undefined;
    let cancelled = false;
    if (new URLSearchParams(window.location.search).get("scene") === "style") {
      void startStyleScene(ref.current!);
    } else {
      startGame(ref.current!).then((s) => { if (cancelled) s(); else stop = s; });
    }
    return () => { cancelled = true; stop?.(); };
  }, []);
  return <canvas ref={ref} style={{ width: "100vw", height: "100vh" }} />;
}
