import * as THREE from "three/webgpu";
import { swatch, swatchHex } from "@/config";

/**
 * Signs (pipeline/build/signs.py): UW-style monument signs at building entrances (dark panel, gold
 * band, building code and name) and storefront fascia bands for nearby businesses. Text is drawn
 * into a small canvas texture generated in code (no image files).
 */
export interface SignInfo { x: number; y: number; z: number; rot: number; text: string; sub: string; style: "uw" | "uw_plaque" | "shop" }

const SHOP_BANDS = ["shop_a", "shop_b", "shop_c", "shop_d", "shop_e"];
const FASCIA_H = 0.9;
const FASCIA_Y = 3.0;

function textTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Largest font size (px) at which text fits the width. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: string, max: number, width: number) {
  let s = max;
  for (; s > 10; s -= 2) {
    ctx.font = `${weight} ${s}px ui-rounded, "SF Pro Rounded", "Helvetica Neue", Arial, sans-serif`;
    if (ctx.measureText(text).width <= width) break;
  }
  return s;
}

function solid(color: string) {
  const m = new THREE.MeshToonNodeMaterial();
  m.color = swatch(color, "signs");
  return m;
}

const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

/**
 * UW freestanding building-entrance sign (Campus Wayfinding sign family, docs/research/plazas-signage-data.md):
 * a 589 x 2438 mm charcoal monolith with a sloped top and a gold perforated band along the slope,
 * the building code in gold and the name in white. Wall plaques use the 589 x 1665 mm wall version.
 */
function monument(s: SignInfo): THREE.Group {
  const g = new THREE.Group();
  const plaque = s.style === "uw_plaque";
  const W = 0.589, H = plaque ? 1.665 : 2.438, D = plaque ? 0.06 : 0.16, SLOPE = 0.16;
  g.position.y = plaque ? 0.9 : 0;
  const shape = new THREE.Shape();
  shape.moveTo(-W / 2, 0); shape.lineTo(W / 2, 0); shape.lineTo(W / 2, H); shape.lineTo(-W / 2, H - SLOPE); shape.lineTo(-W / 2, 0);
  const body = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false }).translate(0, 0, -D / 2 + (plaque ? D / 2 : 0));
  const band = new THREE.Shape();
  band.moveTo(-W / 2, H - SLOPE - 0.09); band.lineTo(W / 2, H - 0.09); band.lineTo(W / 2, H); band.lineTo(-W / 2, H - SLOPE);
  band.lineTo(-W / 2, H - SLOPE - 0.09);
  const bandGeo = new THREE.ExtrudeGeometry(band, { depth: D + 0.01, bevelEnabled: false }).translate(0, 0, -D / 2 - 0.005 + (plaque ? D / 2 : 0));
  g.add(new THREE.Mesh(body, solid("uw_panel")), new THREE.Mesh(bandGeo, solid("uw_gold_band")));
  const tex = textTexture(256, 900, (ctx) => {
    ctx.fillStyle = swatchHex("uw_panel", "signs");
    ctx.fillRect(0, 0, 256, 900);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const code = s.text, name = s.sub;
    ctx.fillStyle = swatchHex(name ? "uw_gold" : "uw_text", "signs");
    const sz = fit(ctx, code, "800", name ? 110 : 54, 220);
    let y = 70;
    ctx.fillText(code, 20, y);
    y += sz + 28;
    if (name) {
      ctx.fillStyle = swatchHex("uw_text", "signs");
      ctx.font = `600 32px ui-rounded, "SF Pro Rounded", "Helvetica Neue", Arial, sans-serif`;
      // wrap the building name onto lines that fit the panel
      let line = "";
      for (const word of name.split(/\s+/)) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > 216 && line) { ctx.fillText(line, 20, y); y += 40; line = word; }
        else line = test;
      }
      if (line) ctx.fillText(line, 20, y);
    }
  });
  const faceMat = new THREE.MeshToonNodeMaterial();
  faceMat.map = tex;
  const fh = H - SLOPE - 0.2;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.06, fh).translate(0, fh / 2 + 0.06, (plaque ? D : D / 2) + 0.003), faceMat);
  face.name = "sign_face";
  g.add(face);
  return g;
}

function fascia(s: SignInfo): THREE.Group {
  const g = new THREE.Group();
  const W = THREE.MathUtils.clamp(0.42 * s.text.length + 1.2, 3, 10);
  const band = SHOP_BANDS[hash(s.text) % SHOP_BANDS.length];
  const box = new THREE.Mesh(new THREE.BoxGeometry(W, FASCIA_H, 0.16).translate(0, FASCIA_Y + FASCIA_H / 2, 0.08), solid(band));
  const ratio = W / FASCIA_H;
  const tw = 1024, th = Math.max(64, Math.round(tw / ratio));
  const tex = textTexture(tw, th, (ctx) => {
    ctx.fillStyle = swatchHex(band, "signs");
    ctx.fillRect(0, 0, tw, th);
    ctx.fillStyle = swatchHex("shop_text", "signs");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fit(ctx, s.text, "800", Math.round(th * 0.62), tw * 0.92);
    ctx.fillText(s.text, tw / 2, th * 0.54);
  });
  const faceMat = new THREE.MeshToonNodeMaterial();
  faceMat.map = tex;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, FASCIA_H - 0.1).translate(0, FASCIA_Y + FASCIA_H / 2, 0.165), faceMat);
  face.name = "sign_face";
  g.add(box, face);
  return g;
}

/** All signs of one chunk; positions are chunk-local. */
export function buildSigns(signs: SignInfo[]): THREE.Group {
  const root = new THREE.Group();
  root.name = "signs";
  for (const s of signs) {
    const g = s.style === "shop" ? fascia(s) : monument(s);
    g.position.set(s.x, s.y + g.position.y, s.z);
    // rot is the outward wall normal in the east-north frame; the sign's front (+z) faces it
    g.rotation.y = s.rot + Math.PI / 2;
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = o.name !== "sign_face"; o.receiveShadow = true; } });
    root.add(g);
  }
  return root;
}

export function disposeSigns(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    const mat = m.material as THREE.MeshToonNodeMaterial;
    mat.map?.dispose();
    mat.dispose();
  });
}

