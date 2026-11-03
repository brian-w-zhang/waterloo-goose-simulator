// Screenshot of /inspect for one item: node tools/art/inspect_shot.mjs dc [OUT.jpg]
import { chromium } from "@playwright/test";
const [item = "dc", out = `review/art/inspect_${item}.jpg`] = process.argv.slice(2);
const b = await chromium.launch({ args: ["--use-angle=metal"] });
const p = await b.newPage({ viewport: { width: 1500, height: 1100 } });
p.on("pageerror", (e) => console.log("pageerror", e.message));
await p.goto(`http://localhost:${process.env.PORT ?? 3100}/inspect?item=${item}`);
await p.waitForTimeout(6000);
await p.screenshot({ path: out, type: "jpeg", quality: 80 });
await b.close();
console.log(out);
