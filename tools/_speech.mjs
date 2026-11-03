import { chromium } from "@playwright/test";
const browser = await chromium.launch({ args: ["--enable-unsafe-webgpu", "--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto("http://localhost:3100/?hud=0&yaw=30");
await page.waitForFunction(() => window.__wgs?.ready, null, { timeout: 60000 });
await page.evaluate(async () => {
  const g = window.__wgs;
  const p = g.hotspot.npcs().find((n) => n.id === "green:prof");
  await g.goose.place(p.x + 2, p.z + 1);
});
await page.waitForTimeout(800);
await page.keyboard.down("Space"); await page.waitForTimeout(120); await page.keyboard.up("Space");
await page.waitForTimeout(400);
console.log(await page.evaluate(() => JSON.stringify(window.__wgs.hotspot.npcs().slice(0, 2))));
console.log(await page.evaluate(() => [...document.querySelectorAll("div")].filter((d) => d.textContent && d.style.transform.includes("-100%")).map((d) => d.textContent + "|" + d.style.display)));
await page.screenshot({ path: "review/look/speech.png" });
await browser.close();
