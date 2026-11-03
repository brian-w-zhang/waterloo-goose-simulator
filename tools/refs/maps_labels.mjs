// Labelled Google Maps tiles (road map, place names) over the edge areas: node tools/refs/maps_labels.mjs
// For reading the Google Maps names of businesses and residences; saved in docs/refs/places/google-maps-labels/private/.
import { chromium } from "@playwright/test";
const OUT = "docs/refs/places/google-maps-labels/private";
const spots = {
  plaza_west: [43.4727, -80.5355], plaza_east: [43.4722, -80.5340], phillip_north: [43.4760, -80.5365],
  phillip_mid: [43.4745, -80.5358], lester_north: [43.4752, -80.5333], lester_mid: [43.4738, -80.5322],
  lester_south: [43.4722, -80.5312], columbia_phillip: [43.4778, -80.5372], uwp_seagram: [43.4705, -80.5320],
  campus_core: [43.4710, -80.5440], campus_south: [43.4685, -80.5420], campus_north: [43.4740, -80.5460],
};
const b = await chromium.launch({ channel: "chrome", headless: false });
const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 }, locale: "en-CA" })).newPage();
for (const [k, [la, lo]] of Object.entries(spots)) {
  await p.goto(`https://www.google.com/maps/@${la},${lo},19z`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(7000);
  await p.screenshot({ path: `${OUT}/maps_${k}.jpg`, type: "jpeg", quality: 85, clip: { x: 420, y: 80, width: 1180, height: 860 } });
  console.log(k);
}
await b.close();
