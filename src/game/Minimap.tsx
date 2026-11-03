"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { styleRules, swatchHex } from "@/config";
import { HOTSPOTS } from "./hotspot";

/**
 * Corner minimap (turns with the camera, goose at the centre) and a full campus map on M:
 * click anywhere on it, or a place in the list, to teleport the goose to the nearest outdoor path.
 * Layers come from public/world/minimap.json (pipeline/build/minimap.py), the same data as the world.
 */
interface MapData {
  layers: Record<string, number[][]>;
  buildings: { r: number[][]; uw: boolean; s: string }[];
  places: { id: string; name: string; x: number; z: number; kind: string }[];
}

const PX_PER_M = 1;          // the pre-rendered map raster
const CORNER = 210;          // corner map size in CSS pixels
const CORNER_SCALE = 1.4;    // CSS pixels per metre in the corner map
const LAYER_COLOUR: Record<string, string> = {
  water: swatchHex("water"), wood: swatchHex("grass_shadow"), pitch: swatchHex("pitch"), parking: swatchHex("parking"),
  road: swatchHex("asphalt"), paving: swatchHex("paving"), path: swatchHex("path"), rail: swatchHex("rail"),
};
const styles = styleRules.styles as unknown as Record<string, { wall: string }>;
const wallHex = (s: string) => { try { return swatchHex(styles[s]?.wall ?? "concrete"); } catch { return swatchHex("concrete"); } };

function rasterise(d: MapData) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const rs of Object.values(d.layers)) for (const r of rs) for (let k = 0; k < r.length; k += 2) {
    x0 = Math.min(x0, r[k]); x1 = Math.max(x1, r[k]); z0 = Math.min(z0, r[k + 1]); z1 = Math.max(z1, r[k + 1]);
  }
  const c = document.createElement("canvas");
  c.width = Math.ceil((x1 - x0) * PX_PER_M); c.height = Math.ceil((z1 - z0) * PX_PER_M);
  const g = c.getContext("2d")!;
  g.fillStyle = swatchHex("grass"); g.fillRect(0, 0, c.width, c.height);
  const poly = (r: number[]) => {
    g.beginPath();
    for (let k = 0; k < r.length; k += 2) g.lineTo((r[k] - x0) * PX_PER_M, (r[k + 1] - z0) * PX_PER_M);
    g.closePath(); g.fill();
  };
  for (const [name, rs] of Object.entries(d.layers)) { g.fillStyle = LAYER_COLOUR[name] ?? swatchHex("concrete"); rs.forEach(poly); }
  for (const b of d.buildings) {
    g.fillStyle = b.uw ? wallHex(b.s) : swatchHex("concrete_shadow");
    b.r.forEach(poly);
    g.strokeStyle = swatchHex("concrete_shadow"); g.lineWidth = 1;
    b.r.forEach((r) => { g.beginPath(); for (let k = 0; k < r.length; k += 2) g.lineTo((r[k] - x0) * PX_PER_M, (r[k + 1] - z0) * PX_PER_M); g.closePath(); g.stroke(); });
  }
  return { canvas: c, x0, z0, x1, z1 };
}

type Raster = ReturnType<typeof rasterise>;

function drawGoose(g: CanvasRenderingContext2D, x: number, y: number, rot: number, s = 1) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  g.fillStyle = swatchHex("panel", "ui"); g.strokeStyle = swatchHex("text", "ui"); g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 4); g.lineTo(-6, 7); g.closePath(); g.fill(); g.stroke();
  g.restore();
}

export default function Minimap() {
  const corner = useRef<HTMLCanvasElement>(null);
  const big = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<MapData | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const raster = useRef<Raster | null>(null);
  const view = useRef({ cx: 0, cz: 0, scale: 0.5 });

  useEffect(() => {
    fetch("/world/minimap.json").then((r) => {
      if (!r.ok) throw new Error(`minimap.json HTTP ${r.status}`);
      return r.json();
    }).then((d: MapData) => { raster.current = rasterise(d); setData(d); },
      (e: Error) => console.warn("[wgs] no minimap:", e.message));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") { if (e.code === "Escape") setOpen(false); return; }
      if (e.code === "KeyM" && !e.repeat) { e.preventDefault(); setQuery(""); setOpen((o) => !o); }
      if (e.code === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // corner map: redrawn every frame from the live goose and camera
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = corner.current, R = raster.current, w = window.__wgs;
      if (!c || !R || !w?.ready) return;
      const g = c.getContext("2d")!;
      const dpr = window.devicePixelRatio || 1;
      if (c.width !== CORNER * dpr) { c.width = CORNER * dpr; c.height = CORNER * dpr; }
      const s = w.goose.state(), yaw = (w.follow().yaw * Math.PI) / 180;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, CORNER, CORNER);
      g.save();
      g.beginPath(); g.arc(CORNER / 2, CORNER / 2, CORNER / 2 - 3, 0, Math.PI * 2); g.clip();
      g.translate(CORNER / 2, CORNER / 2); g.rotate(-yaw); g.scale(CORNER_SCALE, CORNER_SCALE);
      g.translate(-(s.x - R.x0), -(s.z - R.z0));
      g.drawImage(R.canvas, 0, 0, R.canvas.width / PX_PER_M, R.canvas.height / PX_PER_M);
      g.restore();
      // the goose's heading relative to the camera (up on the map is where the camera looks)
      drawGoose(g, CORNER / 2, CORNER / 2, s.yaw - yaw);
      // north marker on the rim
      const nx = CORNER / 2 - Math.sin(-yaw) * (CORNER / 2 - 14), ny = CORNER / 2 - Math.cos(-yaw) * (CORNER / 2 - 14);
      g.fillStyle = swatchHex("text", "ui"); g.font = "700 12px ui-rounded, system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("N", nx, ny);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [data]);

  // full map: pan with drag, zoom with the wheel, click to teleport
  useEffect(() => {
    if (!open) return;
    const c = big.current, R = raster.current, w = window.__wgs;
    if (!c || !R || !w) return;
    const s = w.goose.state();
    view.current = { cx: s.x, cz: s.z, scale: Math.min(c.clientWidth / (R.x1 - R.x0), c.clientHeight / (R.z1 - R.z0)) * 1.6 };
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const dpr = window.devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight;
      if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
      const g = c.getContext("2d")!, v = view.current, st = w.goose.state();
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = swatchHex("grass"); g.fillRect(0, 0, W, H);
      g.save(); g.translate(W / 2, H / 2); g.scale(v.scale, v.scale); g.translate(-(v.cx - R.x0), -(v.cz - R.z0));
      g.drawImage(R.canvas, 0, 0, R.canvas.width / PX_PER_M, R.canvas.height / PX_PER_M);
      g.restore();
      const toScreen = (x: number, z: number) => [W / 2 + (x - v.cx) * v.scale, H / 2 + (z - v.cz) * v.scale];
      g.font = `700 ${v.scale > 1.2 ? 13 : 11}px ui-rounded, system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
      for (const p of data?.places ?? []) {
        const [x, y] = toScreen(p.x, p.z);
        if (x < -50 || y < -20 || x > W + 50 || y > H + 20) continue;
        g.lineWidth = 3; g.strokeStyle = swatchHex("panel", "ui"); g.strokeText(p.id, x, y);
        g.fillStyle = swatchHex("text", "ui"); g.fillText(p.id, x, y);
      }
      for (const h of HOTSPOTS) {
        const [x, y] = toScreen(h.anchor.x, h.anchor.z);
        g.fillStyle = swatchHex("accent", "ui"); g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
        g.fillStyle = swatchHex("panel", "ui"); g.fillText("!", x, y + 0.5);
      }
      const [gx, gy] = toScreen(st.x, st.z);
      drawGoose(g, gx, gy, st.yaw, 1.3);
    };
    raf = requestAnimationFrame(draw);
    let drag: { x: number; y: number; moved: boolean } | null = null;
    const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY, moved: false }; };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      view.current.cx -= dx / view.current.scale; view.current.cz -= dy / view.current.scale;
      drag.x = e.clientX; drag.y = e.clientY;
    };
    const up = (e: PointerEvent) => {
      if (drag && !drag.moved) {
        const r = c.getBoundingClientRect(), v = view.current;
        teleport(v.cx + (e.clientX - r.left - r.width / 2) / v.scale, v.cz + (e.clientY - r.top - r.height / 2) / v.scale);
      }
      drag = null;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault(); e.stopPropagation();
      view.current.scale = Math.min(8, Math.max(0.15, view.current.scale * Math.exp(-e.deltaY * 0.0015)));
    };
    c.addEventListener("pointerdown", down); window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    c.addEventListener("wheel", wheel, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      c.removeEventListener("pointerdown", down); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      c.removeEventListener("wheel", wheel);
    };
  }, [open, data]);

  const teleport = (x: number, z: number) => {
    const w = window.__wgs;
    if (!w) return;
    // land on the nearest outdoor path point, never inside a building
    const [px, pz] = w.goose.nearestPathPoint(x, z);
    void w.goose.place(px, pz);
    setOpen(false);
  };

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = [...HOTSPOTS.map((h) => ({ id: "!", name: h.name, x: h.anchor.x, z: h.anchor.z, kind: "hotspot" })), ...(data?.places ?? [])];
    return q ? all.filter((p) => p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) : all;
  }, [data, query]);

  if (!data) return null;
  const ui = { panel: swatchHex("panel", "ui"), text: swatchHex("text", "ui"), accent: swatchHex("accent", "ui") };
  return (
    <>
      <canvas ref={corner} onClick={() => setOpen(true)} title="Map (M)"
        style={{ position: "absolute", right: 16, top: 112, width: CORNER, height: CORNER, borderRadius: "50%", cursor: "pointer",
          boxShadow: `0 4px 0 ${ui.accent}`, background: ui.panel, border: `3px solid ${ui.panel}` }} />
      {open && (
        <div style={{ position: "absolute", inset: 24, display: "flex", gap: 12, zIndex: 10 }}>
          <canvas ref={big} style={{ flex: 1, height: "100%", borderRadius: 14, cursor: "crosshair", boxShadow: `0 4px 0 ${ui.accent}` }} />
          <div style={{ width: 280, background: ui.panel, color: ui.text, borderRadius: 14, padding: 12, display: "flex", flexDirection: "column",
            boxShadow: `0 4px 0 ${ui.accent}`, font: "15px ui-rounded, system-ui, sans-serif" }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Campus map</div>
            <div style={{ fontSize: 12, opacity: 0.7, margin: "2px 0 8px" }}>Click the map or a place to teleport · drag to pan · wheel to zoom · M or Esc to close</div>
            <input autoFocus value={query} onKeyDown={(e) => { if (e.code !== "Escape") e.stopPropagation(); }} onChange={(e) => setQuery(e.target.value)} placeholder="Search (DC, Library, lake…)"
              style={{ padding: "6px 10px", borderRadius: 8, border: `2px solid ${ui.accent}`, marginBottom: 8, font: "inherit" }} />
            <div style={{ overflowY: "auto", flex: 1 }}>
              {list.map((p) => (
                <div key={`${p.kind}-${p.id}-${p.name}`} onClick={() => teleport(p.x, p.z)}
                  style={{ padding: "5px 6px", borderRadius: 6, cursor: "pointer", display: "flex", gap: 8 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = swatchHex("accent", "ui") + "22"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <b style={{ minWidth: 42 }}>{p.id}</b><span style={{ opacity: 0.85 }}>{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
