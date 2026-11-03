// All-round captures for many buildings, a few at a time: node tools/refs/around_queue.mjs [--jobs 3] dir dir ...
// Each building runs tools/refs/around.mjs in its own Chrome window (resumable: finished images are kept).
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const j = args.indexOf("--jobs");
const JOBS = j >= 0 ? Number(args.splice(j, 2)[1]) : 3;
const queue = [...args];
mkdirSync("review/art/logs", { recursive: true });
let running = 0;
await new Promise((done) => {
  const next = () => {
    if (!queue.length && !running) return done();
    while (running < JOBS && queue.length) {
      const dir = queue.shift();
      running++;
      const name = dir.split("/").pop();
      const p = spawn("node", ["tools/refs/around.mjs", dir], { stdio: ["ignore", "ignore", "ignore"] });
      console.log(`start ${name}`);
      p.on("exit", (code) => { running--; console.log(`${code === 0 ? "done" : "FAILED " + code} ${name}`); next(); });
    }
  };
  next();
});
console.log("queue finished");
