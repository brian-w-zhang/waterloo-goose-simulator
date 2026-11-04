"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { swatchHex } from "@/config";
import { HOTSPOTS } from "./hotspot";
import { buildingAt, buildModel, drawMap, gooseMarker, type MapData, type MapModel, toScreen, toWorld, uiFont, type View } from "@/ui/mapDraw";
import { displayName, groupOf, GROUPS, type Place } from "@/ui/places";

/**
 * Corner minimap (turns with the camera, goose at the centre) and a full campus map on M:
 * click anywhere on it, or a place in the list, to teleport the goose to the nearest outdoor path.
 * Layers come from public/world/minimap.json (pipeline/build/minimap.py), the same data as the world;
 * the illustrated drawing is src/ui/mapDraw.ts.
 */
const CORNER_SCALE = 1.25; // CSS pixels per metre in the corner map
const ui = (k: string) => swatchHex(k, "ui");
const MARKERS = HOTSPOTS.map((h) => ({ x: h.anchor.x, z: h.anchor.z, label: h.name }));

function teleport(x: number, z: number, label?: string) {
  const w = window.__wgs;
  if (!w || w.goose.teleporting()) return;
  // land on the nearest outdoor path point, never inside a building
  const [px, pz] = w.goose.nearestPathPoint(x, z);
  void w.goose.teleport(px, pz, label);
}

/** The camera-facing wedge, the rim, the north badge: everything on the corner map that is not the map. */
function cornerChrome(g: CanvasRenderingContext2D, S: number, yaw: number) {
  const c = S / 2;
  const cone = g.createRadialGradient(c, c, 4, c, c, c * 0.75);
  cone.addColorStop(0, ui("keycap")); cone.addColorStop(1, ui("map_grass"));
  g.save(); g.globalAlpha = 0.45; g.fillStyle = cone;
  g.beginPath(); g.moveTo(c, c); g.arc(c, c, c * 0.75, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); g.closePath(); g.fill();
  g.restore();
  // inner rim shading
  const rim = g.createRadialGradient(c, c, c * 0.82, c, c, c);
  rim.addColorStop(0, ui("map_grass")); rim.addColorStop(1, ui("map_shadow"));
  g.save(); g.globalAlpha = 0.35; g.globalCompositeOperation = "multiply"; g.fillStyle = rim; g.fillRect(0, 0, S, S); g.restore();
  // north badge on the rim (the map turns with the camera, so north moves round)
  const r = c - 12, nx = c - Math.sin(yaw) * r, ny = c - Math.cos(yaw) * r; // world north rotated by -yaw
  g.save(); g.translate(nx, ny);
  g.beginPath(); g.arc(0, 1, 9, 0, Math.PI * 2); g.globalAlpha = 0.3; g.fillStyle = ui("shadow"); g.fill(); g.globalAlpha = 1;
  g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.fillStyle = ui("keycap"); g.fill();
  g.lineWidth = 1.5; g.strokeStyle = ui("warn"); g.stroke();
  g.fillStyle = ui("warn"); g.font = `900 10px ${uiFont()}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("N", 0, 0.5);
  g.restore();
}

/** Full map compass (north is always up there). */
function compass(g: CanvasRenderingContext2D, x: number, y: number) {
  g.save(); g.translate(x, y);
  g.beginPath(); g.arc(0, 2, 20, 0, Math.PI * 2); g.globalAlpha = 0.2; g.fillStyle = ui("shadow"); g.fill(); g.globalAlpha = 1;
  g.beginPath(); g.arc(0, 0, 20, 0, Math.PI * 2); g.fillStyle = ui("keycap"); g.fill(); g.strokeStyle = ui("paper_edge"); g.lineWidth = 1.5; g.stroke();
  g.beginPath(); g.moveTo(0, -14); g.lineTo(5, 0); g.lineTo(-5, 0); g.closePath(); g.fillStyle = ui("warn"); g.fill();
  g.beginPath(); g.moveTo(0, 14); g.lineTo(5, 0); g.lineTo(-5, 0); g.closePath(); g.fillStyle = ui("paper_edge"); g.fill();
  g.fillStyle = ui("text"); g.font = `900 9px ${uiFont()}`; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("N", 0, -26);
  g.restore();
}

export default function Minimap() {
  const corner = useRef<HTMLCanvasElement>(null);
  const big = useRef<HTMLCanvasElement>(null);
  const [model, setModel] = useState<MapModel | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tip, setTip] = useState<{ x: number; y: number; id: string; name: string } | null>(null);
  const [hot, setHot] = useState<string | null>(null);
  const view = useRef<View>({ cx: 0, cz: 0, scale: 0.5, rot: 0, w: 1, h: 1 });
  const dirty = useRef(true);
  const hover = useRef<ReturnType<typeof buildingAt>>(undefined);

  useEffect(() => {
    fetch("/world/minimap.json").then((r) => {
      if (!r.ok) throw new Error(`minimap.json HTTP ${r.status}`);
      return r.json();
    }).then((d: MapData) => setModel(buildModel(d)), (e: Error) => console.warn("[wgs] no minimap:", e.message));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") { if (e.code === "Escape") setOpen(false); return; }
      if (e.code === "KeyM" && !e.repeat && !window.__wgs?.goose.teleporting()) { e.preventDefault(); setQuery(""); setOpen((o) => !o); }
      if (e.code === "Escape") setOpen(false);
    };
    // a teleport closes the map as the wipe starts
    const onTele = () => setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("wgs:teleport", onTele);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("wgs:teleport", onTele); };
  }, []);

  // corner map: redrawn every frame from the live goose and camera
  useEffect(() => {
    if (!model) return;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = corner.current, w = window.__wgs;
      if (!c || !w?.ready) return;
      const S = c.clientWidth, dpr = window.devicePixelRatio || 1;
      if (c.width !== Math.round(S * dpr)) { c.width = Math.round(S * dpr); c.height = Math.round(S * dpr); }
      const g = c.getContext("2d")!;
      const s = w.goose.state(), yaw = (w.follow().yaw * Math.PI) / 180;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, S, S);
      g.save();
      g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); g.clip();
      drawMap(g, model, { cx: s.x, cz: s.z, scale: CORNER_SCALE * (S / 196), rot: -yaw, w: S, h: S }, { labels: "main", markers: MARKERS });
      cornerChrome(g, S, yaw);
      g.restore();
      // the goose's heading relative to the camera (up on the map is where the camera looks)
      gooseMarker(g, S / 2, S / 2, s.yaw - yaw, 0.95);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [model]);

  // full map: pan with drag, zoom with the wheel (towards the pointer), hover names, click to teleport
  useEffect(() => {
    if (!open || !model) return;
    const c = big.current, w = window.__wgs;
    if (!c || !w) return;
    const s = w.goose.state();
    const [bx0, bz0, bx1, bz1] = model.bounds;
    view.current = { cx: s.x, cz: s.z, scale: Math.min(c.clientWidth / (bx1 - bx0), c.clientHeight / (bz1 - bz0)) * 3.2, rot: 0, w: c.clientWidth, h: c.clientHeight };
    dirty.current = true;
    let raf = 0, lastGoose = "";
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const dpr = window.devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight;
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); dirty.current = true; }
      const st = w.goose.state();
      const gk = `${st.x.toFixed(1)},${st.z.toFixed(1)},${st.yaw.toFixed(2)}`;
      if (gk !== lastGoose) { lastGoose = gk; dirty.current = true; }
      if (!dirty.current) return;
      dirty.current = false;
      const v = view.current;
      v.w = W; v.h = H;
      const g = c.getContext("2d")!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawMap(g, model, v, { labels: "zoom", hover: hover.current, markers: MARKERS });
      const [gx, gy] = toScreen(v, st.x, st.z);
      gooseMarker(g, gx, gy, st.yaw, 1.25);
      compass(g, W - 36, 44);
      // scale bar
      const metres = [50, 100, 200, 500, 1000].find((m) => m * v.scale > 70) ?? 1000;
      const L = metres * v.scale;
      g.fillStyle = ui("keycap"); g.globalAlpha = 0.9; g.beginPath(); g.roundRect(W - 30 - L - 16, H - 40, L + 32, 26, 9); g.fill(); g.globalAlpha = 1;
      g.strokeStyle = ui("text"); g.lineWidth = 2; g.lineCap = "round";
      g.beginPath(); g.moveTo(W - 30 - L, H - 22); g.lineTo(W - 30, H - 22); g.moveTo(W - 30 - L, H - 26); g.lineTo(W - 30 - L, H - 20); g.moveTo(W - 30, H - 26); g.lineTo(W - 30, H - 20); g.stroke();
      g.fillStyle = ui("text"); g.font = `800 10px ${uiFont()}`; g.textAlign = "center"; g.fillText(metres >= 1000 ? `${metres / 1000} km` : `${metres} m`, W - 30 - L / 2, H - 31);
    };
    raf = requestAnimationFrame(draw);
    let drag: { x: number; y: number; moved: boolean } | null = null;
    const local = (e: { clientX: number; clientY: number }) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
    const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY, moved: false }; c.classList.add("dragging"); };
    const move = (e: PointerEvent) => {
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        view.current.cx -= dx / view.current.scale; view.current.cz -= dy / view.current.scale;
        drag.x = e.clientX; drag.y = e.clientY; dirty.current = true;
      }
      if (e.target !== c) { if (hover.current) { hover.current = undefined; dirty.current = true; setTip(null); } return; }
      const [sx, sy] = local(e);
      const [x, z] = toWorld(view.current, sx, sy);
      const b = buildingAt(model, x, z);
      if (b !== hover.current) { hover.current = b; dirty.current = true; }
      const p = b?.place;
      setTip(p ? { x: sx, y: sy, id: p.id, name: displayName(p.name) } : null);
    };
    const up = (e: PointerEvent) => {
      c.classList.remove("dragging");
      if (drag && !drag.moved && e.target === c) {
        const [sx, sy] = local(e);
        const [x, z] = toWorld(view.current, sx, sy);
        teleport(x, z, hover.current?.place ? displayName(hover.current.place.name) : undefined);
      }
      drag = null;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault(); e.stopPropagation();
      const v = view.current, [sx, sy] = local(e);
      const [x, z] = toWorld(v, sx, sy);
      v.scale = Math.min(8, Math.max(0.12, v.scale * Math.exp(-e.deltaY * 0.0015)));
      // keep the point under the pointer still
      const [x2, z2] = toWorld(v, sx, sy);
      v.cx += x - x2; v.cz += z - z2; dirty.current = true;
    };
    c.addEventListener("pointerdown", down); window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    c.addEventListener("wheel", wheel, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      c.removeEventListener("pointerdown", down); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      c.removeEventListener("wheel", wheel);
      hover.current = undefined; setTip(null);
    };
  }, [open, model]);

  const zoom = (k: number) => { view.current.scale = Math.min(8, Math.max(0.12, view.current.scale * k)); dirty.current = true; };
  const centre = (p: { x: number; z: number }) => { view.current.cx = p.x; view.current.cz = p.z; view.current.scale = Math.max(view.current.scale, 1.6); dirty.current = true; };

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all: Place[] = [...HOTSPOTS.map((h) => ({ id: "★", name: h.name, x: h.anchor.x, z: h.anchor.z, kind: "hotspot" })), ...(model?.places ?? [])];
    const hits = q ? all.filter((p) => p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) : all;
    return GROUPS.map((g) => ({ g, items: hits.filter((p) => groupOf(p) === g) })).filter((x) => x.items.length);
  }, [model, query]);

  if (!model) return null;
  const first = groups[0]?.items[0];
  return (
    <>
      <div className="hud minimap" onClick={() => setOpen(true)} title="Campus map (M)">
        <canvas ref={corner} />
        <span className="kbd minimap-key">M</span>
      </div>
      {open && (
        <div className="map-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="map-frame">
            <canvas ref={big} />
            {tip && <div className="map-tip" style={{ left: tip.x + 8, top: tip.y + 8 }}>{tip.id}<small>{tip.name}</small></div>}
            <div className="map-zoom">
              <button aria-label="Zoom in" onClick={() => zoom(1.5)}>+</button>
              <button aria-label="Zoom out" onClick={() => zoom(1 / 1.5)}>−</button>
            </div>
            <div className="map-legend">
              <span className="kbd">drag</span> pan <span className="kbd">wheel</span> zoom <span className="kbd">click</span> fly there
            </div>
          </div>
          <div className="map-side hud-card">
            <h2>Campus map
              <button className="map-close" aria-label="Close map" onClick={() => setOpen(false)}><span className="kbd">Esc</span></button>
            </h2>
            <div className="sub">Pick a place and the goose flies there. Hover a building for its name.</div>
            <div className="map-search">
              <svg viewBox="0 0 16 16"><circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" /></svg>
              <input autoFocus value={query} placeholder="Search: DC, library, lake…"
                onKeyDown={(e) => {
                  if (e.code === "Enter" && first) teleport(first.x, first.z, displayName(first.name));
                  if (e.code !== "Escape") e.stopPropagation();
                }}
                onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="map-list">
              {groups.length === 0 && <div className="map-empty">No such place. Honk.</div>}
              {groups.map(({ g, items }) => (
                <div key={g}>
                  <div className="map-group">{g}</div>
                  {items.map((p) => (
                    <button key={`${p.kind}-${p.id}-${p.name}`} className={`map-item${hot === p.id + p.name ? " hot" : ""}`}
                      onClick={() => teleport(p.x, p.z, displayName(p.name))}
                      onMouseEnter={() => { setHot(p.id + p.name); centre(p); }} onMouseLeave={() => setHot(null)}>
                      <span className={`id${p.kind === "hotspot" ? " star" : p.kind === "water" ? " water" : ""}`}>{p.kind === "water" ? "≈" : p.id}</span>
                      <span>{displayName(p.name)}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
