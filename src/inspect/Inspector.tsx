"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { swatchHex } from "@/config";

/**
 * /inspect: the Blender art models next to their references. Left: every catalogue item (models
 * first). Top: the selected model, orbit with the mouse (left drag rotate, right drag pan, wheel
 * zoom). Below: the reference images for that item by source (Google Earth, City aerials, Street
 * View, web, Commons, game-vs-Earth sheets) and its NOTES.md. Images come from /api/refs (local).
 */
interface Item { id: string; label: string; name?: string; kind: string; dir: string; uw: boolean; model: string | null }

const ui = { panel: swatchHex("panel", "ui"), text: swatchHex("text", "ui"), accent: swatchHex("accent", "ui") };
const img = (f: string) => `/api/refs?file=${encodeURIComponent(f)}`;

function Viewer({ model }: { model: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState("");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = true;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(swatchHex("sky"));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f80, 1.6));
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
    sun.position.set(-120, 200, 90);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -150, right: 150, top: 150, bottom: -150, far: 600 });
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(35, el.clientWidth / el.clientHeight, 0.5, 5000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    let raf = 0;
    const loop = () => { raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); };
    const resize = () => { renderer.setSize(el.clientWidth, el.clientHeight); camera.aspect = el.clientWidth / el.clientHeight; camera.updateProjectionMatrix(); };
    window.addEventListener("resize", resize);
    if (model) {
      setInfo("loading…");
      new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(`/models/${model}.glb`, (g) => {
        const root = g.scene;
        let tris = 0;
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
          m.castShadow = m.receiveShadow = true;
          tris += (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute("position").count) / 3;
        });
        // models are authored in world metres: centre this one on the origin, feet on y = 0
        const box = new THREE.Box3().setFromObject(root);
        const c = box.getCenter(new THREE.Vector3());
        root.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
        scene.add(root);
        const size = box.getSize(new THREE.Vector3());
        const ground = new THREE.Mesh(new THREE.CircleGeometry(Math.max(size.x, size.z) * 1.2, 48).rotateX(-Math.PI / 2),
          new THREE.MeshStandardMaterial({ color: swatchHex("grass"), roughness: 1 }));
        ground.position.y = 1.5;    // walls start 1.5 m below the building's ground (they meet sloping terrain)
        ground.receiveShadow = true;
        scene.add(ground);
        const r = Math.max(size.x, size.z);
        camera.position.set(r * 0.8, r * 0.6, r * 0.9);
        controls.target.set(0, size.y * 0.35, 0);
        setInfo(`${model} · ${size.x.toFixed(0)} × ${size.z.toFixed(0)} × ${size.y.toFixed(0)} m · ${Math.round(tris).toLocaleString()} triangles`);
      }, undefined, (e) => setInfo(`could not load ${model}: ${(e as Error).message}`));
    }
    loop();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); controls.dispose(); renderer.dispose(); el.removeChild(renderer.domElement); };
  }, [model]);
  return (
    <div style={{ position: "relative", height: "58vh", flexShrink: 0, borderRadius: 12, overflow: "hidden", background: ui.panel }}>
      <div ref={ref} style={{ position: "absolute", inset: 0 }} />
      {!model && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", opacity: 0.6 }}>No Blender model for this item yet: references only</div>}
      <div style={{ position: "absolute", left: 12, bottom: 10, fontSize: 13, background: ui.panel, padding: "4px 10px", borderRadius: 8 }}>
        {info} {model && "· left drag rotate · right drag pan · wheel zoom"}
      </div>
    </div>
  );
}

export default function Inspector() {
  const [items, setItems] = useState<Item[]>([]);
  const [sel, setSel] = useState<Item | null>(null);
  const [q, setQ] = useState("");
  const [refs, setRefs] = useState<{ groups: Record<string, string[]>; notes: string } | null>(null);
  const [tab, setTab] = useState("");
  const [big, setBig] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    fetch("/api/refs?items").then((r) => r.json()).then((all: Item[]) => {
      setItems(all);
      const want = new URLSearchParams(window.location.search).get("item");
      setSel(all.find((i) => i.id === want) ?? all.find((i) => i.model) ?? all[0]);
    });
  }, []);
  useEffect(() => {
    if (!sel) return;
    setRefs(null);
    history.replaceState(null, "", `?item=${sel.id}`);
    fetch(`/api/refs?item=${encodeURIComponent(sel.dir)}`).then((r) => r.json()).then((d) => {
      setRefs(d);
      const keys = Object.keys(d.groups);
      setTab(keys.includes("Google Earth") ? "Google Earth" : keys[0] ?? "");
    });
  }, [sel]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setBig(null); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const f = items.filter((i) => !s || i.id.includes(s) || i.label.toLowerCase().includes(s) || (i.name ?? "").toLowerCase().includes(s));
    const rank = (i: Item) => (i.model ? 0 : i.kind === "building" ? (i.uw ? 1 : 2) : i.kind === "street" ? 3 : 4);
    return f.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
  }, [items, q]);

  return (
    <div style={{ display: "flex", height: "100vh", font: "14px ui-rounded, system-ui, sans-serif", color: ui.text, background: swatchHex("sky") }}>
      <aside style={{ width: 290, display: "flex", flexDirection: "column", padding: 12, gap: 8, background: ui.panel }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>Model inspector</div>
        <a href="/" style={{ fontSize: 12, color: ui.accent }}>← back to the game</a>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search buildings, streets, zones"
          style={{ padding: "6px 10px", borderRadius: 8, border: `2px solid ${ui.accent}`, font: "inherit" }} />
        <div style={{ fontSize: 12, opacity: 0.7 }}>{items.filter((i) => i.model).length} with models · {items.length} items</div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {shown.map((i) => (
            <div key={i.dir} onClick={() => setSel(i)}
              style={{ padding: "4px 6px", borderRadius: 6, cursor: "pointer", display: "flex", gap: 6,
                background: sel?.dir === i.dir ? `${ui.accent}33` : "transparent" }}>
              <span style={{ width: 14 }}>{i.model ? "■" : i.kind === "building" ? "□" : i.kind === "street" ? "—" : "·"}</span>
              <span style={{ fontWeight: i.model ? 700 : 400 }}>{i.label}</span>
              {i.name && i.name !== i.label && <span style={{ opacity: 0.55, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.name}</span>}
            </div>
          ))}
        </div>
      </aside>
      <main style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {sel && (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{sel.label}</div>
              <div style={{ opacity: 0.7 }}>{sel.name}</div>
              <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.6 }}>{sel.dir}</div>
            </div>
            <Viewer model={sel.model} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {refs && Object.entries(refs.groups).map(([g, fs]) => (
                <button key={g} onClick={() => setTab(g)}
                  style={{ padding: "5px 12px", borderRadius: 999, border: `2px solid ${ui.accent}`, cursor: "pointer", font: "inherit",
                    background: tab === g ? ui.accent : ui.panel, color: tab === g ? ui.panel : ui.text }}>{g} ({fs.length})</button>
              ))}
              {refs?.notes && <button onClick={() => setShowNotes((v) => !v)}
                style={{ padding: "5px 12px", borderRadius: 999, border: `2px dashed ${ui.accent}`, cursor: "pointer", font: "inherit", background: ui.panel, color: ui.text }}>
                {showNotes ? "Hide" : "Show"} notes</button>}
              {!refs && <span style={{ opacity: 0.6 }}>loading references…</span>}
            </div>
            {showNotes && refs?.notes && <pre style={{ whiteSpace: "pre-wrap", background: ui.panel, padding: 12, borderRadius: 10, fontSize: 12, maxHeight: 360, overflowY: "auto" }}>{refs.notes}</pre>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
              {refs?.groups[tab]?.map((f) => (
                <figure key={f} style={{ margin: 0, background: ui.panel, borderRadius: 10, overflow: "hidden", cursor: "zoom-in" }} onClick={() => setBig(f)}>
                  <img src={img(f)} loading="lazy" alt={f} style={{ width: "100%", display: "block", aspectRatio: tab === "Aerial (City of Waterloo)" ? "1" : "2", objectFit: "cover" }} />
                  <figcaption style={{ fontSize: 11, padding: "4px 8px", opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.split("/").pop()}</figcaption>
                </figure>
              ))}
            </div>
          </>
        )}
      </main>
      {big && (
        <div onClick={() => setBig(null)} style={{ position: "fixed", inset: 0, background: "rgba(20,24,22,0.88)", display: "grid", placeItems: "center", cursor: "zoom-out", zIndex: 20 }}>
          <img src={img(big)} alt={big} style={{ maxWidth: "95vw", maxHeight: "92vh", borderRadius: 8 }} />
          <div style={{ position: "fixed", bottom: 14, color: "#fff", fontSize: 13 }}>{big} · click or Esc to close</div>
        </div>
      )}
    </div>
  );
}
