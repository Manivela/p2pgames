// What a move costs a frame at the Okey table (src/Components/Okey/PERF.md):
// plays one alone with three bots and records a Chrome trace and a CPU
// profile while it drags along the rack, discards by a drag and takes a
// discard with Take, each a phase marked in the trace.
//
//   B=$(mktemp -d); npx vite build --outDir $B; npx vite preview --outDir $B
//   node perf/okey.mjs http://localhost:4173 [out-dir] [--headless]
//
// Built outside dist/, whose source maps the Sentry plugin deletes.
//
// A window by default; --headless measures the main thread the same, but
// has no GPU: it rasters in software and shows no GPU stall. ARGS
// passes Chromium flags (ARGS=--disable-gpu, software raster); SAMPLE sets
// the profile's interval in µs (default 50). Writes trace.json,
// profile.cpuprofile and frames.json to out-dir (a temp folder by default),
// then read them with phases.py, tasks.py and tree.cjs beside this.
import { createRequire } from "module";
import fs from "fs";
import os from "os";
import path from "path";

const require = createRequire(new URL("../package.json", import.meta.url));
const { chromium } = require("playwright");

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const base = args[0] ?? "http://localhost:4173";
const out = args[1] ?? fs.mkdtempSync(path.join(os.tmpdir(), "okey-perf-"));
fs.mkdirSync(out, { recursive: true });
const headless = process.argv.includes("--headless");
const room = `perf-${Math.random().toString(36).slice(2, 10)}`;

const browser = await chromium.launch({
  headless,
  args: process.env.ARGS ? process.env.ARGS.split(" ") : [],
});
const ctx = await browser.newContext({
  viewport: { width: 1348, height: 870 },
});
const page = await ctx.newPage();
// each frame's time, and Chrome's long animation frames, by phase: the
// trace is the ground truth (this counter misses frames a long task drops)
await page.addInitScript(() => {
  window.__frames = [];
  window.__loaf = [];
  window.__phase = "load";
  const tick = (t) => {
    window.__frames.push([t, window.__phase]);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries())
        window.__loaf.push({
          phase: window.__phase,
          dur: e.duration,
          scripts: e.scripts.map((s) => ({
            inv: s.invoker,
            fn: s.sourceFunctionName,
            dur: s.duration,
          })),
        });
    }).observe({ type: "long-animation-frame", buffered: true });
  } catch {
    // not this browser
  }
});
const phase = (p) =>
  page.evaluate((p) => {
    window.__phase = p;
    performance.mark(`phase:${p}`);
  }, p);
const frame = () => new Promise((r) => setTimeout(r, 16));

// alone in a new room, three bots, started
const cdp = await ctx.newCDPSession(page);
await page.goto(`${base}/${room}`);
await page.evaluate((r) => sessionStorage.setItem("alone", r), room);
await page.getByRole("textbox").fill("Perf");
await page.getByRole("button", { name: /^(Go|Gir)$/ }).click();
await page
  .locator(".playerName", { hasText: /Player 1(?!\d)/ })
  .getByRole("button", { name: /^Sit$/ })
  .click();
for (let i = 0; i < 3; i++)
  await page
    .getByRole("button", { name: /^Add a bot$/ })
    .first()
    .click();
await page
  .getByRole("button", { name: /^Start$/ })
  .first()
  .click();
const rack = page.locator(".rack:not(.mini)").first();
await rack.locator("[data-tile-id]").first().waitFor();
// the deal's flights landed
await page.waitForFunction(() => !document.querySelector(".flights > *"));

await browser.startTracing(page, {
  path: `${out}/trace.json`,
  categories: [
    "toplevel",
    "blink.user_timing",
    "devtools.timeline",
    "disabled-by-default-devtools.timeline",
    "disabled-by-default-devtools.timeline.frame",
    "v8",
    "blink",
    "cc",
    "gpu",
    "viz",
  ],
});
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", {
  interval: Number(process.env.SAMPLE ?? 50),
});
await cdp.send("Profiler.start");

await phase("idle");
await page.waitForTimeout(1500);

// a tile dragged along the rack and back, a mouse move a frame
async function sweep(name) {
  await phase(name);
  const a = await rack.locator("[data-tile-id]").first().boundingBox();
  const r = await rack.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  const y = a.y + a.height / 2;
  const steps = 90;
  for (let i = 0; i <= steps; i++) {
    const f = i <= steps / 2 ? i / (steps / 2) : 2 - i / (steps / 2);
    await page.mouse.move(
      r.x + 20 + f * (r.width - 40),
      y + Math.sin(i / 6) * 8,
    );
    await frame();
  }
  await page.mouse.up();
  await phase("after");
  await page.waitForTimeout(500);
}
await sweep("rackDrag");

// seat 1 starts with 15 tiles; were it another's turn, the bots play till
// it's ours and the discard is taken with Take, which flies
const take = page.locator("[data-pile] button.take");
if ((await rack.locator("[data-tile-id]").count()) < 15) {
  await phase("bots");
  await take.waitFor({ timeout: 60000 });
  await page.waitForTimeout(800);
  await phase("takeFly");
  await take.click();
  await page.waitForTimeout(1200);
}
await sweep("rackDrag2");

// a discard dragged to our pile, landing turned
await phase("discardDrag");
{
  const a = await rack.locator("[data-tile-id]").nth(3).boundingBox();
  const b = await page.locator('[data-pile="1"] .slot').boundingBox();
  const [x0, y0] = [a.x + a.width / 2, a.y + a.height / 2];
  const [x1, y1] = [b.x + b.width / 2, b.y + b.height / 2];
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= 30; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / 30, y0 + ((y1 - y0) * i) / 30);
    await frame();
  }
  await page.mouse.up();
  await page.waitForTimeout(1200);
}
// the bots' turns (their discards fly), then the discard taken with Take
await phase("bots2");
await take.waitFor({ timeout: 60000 });
await page.waitForTimeout(500);
await phase("takeFly2");
await take.click();
await page.waitForTimeout(1500);

const { profile } = await cdp.send("Profiler.stop");
await browser.stopTracing();
fs.writeFileSync(`${out}/profile.cpuprofile`, JSON.stringify(profile));
const data = await page.evaluate(() => ({
  frames: window.__frames,
  loaf: window.__loaf,
}));
fs.writeFileSync(`${out}/frames.json`, JSON.stringify(data));
await browser.close();

// a first look: each phase's frame intervals as the page counted them
const by = {};
for (let i = 1; i < data.frames.length; i++) {
  const [t, p] = data.frames[i];
  (by[p] ??= []).push(t - data.frames[i - 1][0]);
}
const q = (a, p) =>
  [...a].sort((x, y) => x - y)[Math.floor(p * (a.length - 1))];
console.log("phase        frames   p50   p95    max >20ms");
for (const [p, a] of Object.entries(by))
  console.log(
    p.padEnd(12),
    String(a.length).padStart(6),
    q(a, 0.5).toFixed(1).padStart(5),
    q(a, 0.95).toFixed(1).padStart(5),
    Math.max(...a)
      .toFixed(1)
      .padStart(6),
    String(a.filter((x) => x > 20).length).padStart(5),
  );
console.log(`\n${out}`);
