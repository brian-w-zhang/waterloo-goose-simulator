// Google Maps place names around campus: node tools/refs/maps_places.mjs
// Runs a few searches, scrolls each result list and records name, category, address and the place's
// coordinates (from its link) in docs/refs/places/google_places.json.
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const queries = [
  "restaurants near 170 University Ave W Waterloo", "restaurants near 258 Phillip St Waterloo", "restaurants near 330 Phillip St Waterloo",
  "restaurants near 280 Lester St Waterloo", "restaurants near 203 Lester St Waterloo", "cafes near University of Waterloo",
  "student residence near Lester St Waterloo", "student housing near Phillip St Waterloo", "University of Waterloo buildings",
  "shops near 160 University Ave W Waterloo", "stores near 255 King St N Waterloo",
];
const b = await chromium.launch({ channel: "chrome", headless: false });
const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 }, locale: "en-CA" })).newPage();
const all = new Map();
for (const q of queries) {
  await p.goto(`https://www.google.com/maps/search/${encodeURIComponent(q)}/@43.4730,-80.5390,16z`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(6000);
  for (let k = 0; k < 8; k++) {
    await p.evaluate(() => { const f = document.querySelector('[role="feed"]'); if (f) f.scrollBy(0, 4000); });
    await p.waitForTimeout(1500);
  }
  const rows = await p.evaluate(() => [...document.querySelectorAll('[role="feed"] a[href*="/maps/place/"]')].map((a) => {
    const card = a.closest("div[jsaction]")?.parentElement ?? a.parentElement;
    return { name: a.getAttribute("aria-label"), href: a.href, text: (card?.innerText ?? "").split("\n").slice(0, 6).join(" | ") };
  }));
  for (const r of rows) {
    const m = r.href.match(/!3d(-?[\d.]+)!4d(-?[\d.]+)/);
    if (!r.name || !m) continue;
    all.set(r.name + m[1], { name: r.name, lat: +m[1], lng: +m[2], card: r.text, query: q });
  }
  console.log(q, rows.length, all.size);
}
await b.close();
writeFileSync("docs/refs/places/google_places.json", JSON.stringify([...all.values()], null, 1));
