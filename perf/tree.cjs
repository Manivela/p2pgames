// The call tree, in ms, of the renderer's long tasks okey.mjs recorded,
// mapped to source through the build's source maps (vite build writes them
// hidden, beside each file in dist/assets):
//   node perf/tree.cjs <out-dir> dist [minTaskMs 25] [minNodeMs 0.8]
const fs = require("fs");
const { SourceMapConsumer } = require("source-map-js");
const [dir, dist, minTask = "25", minNode = "0.8"] = process.argv.slice(2);
const p = JSON.parse(fs.readFileSync(`${dir}/profile.cpuprofile`));
const tr = JSON.parse(fs.readFileSync(`${dir}/trace.json`));
const ev = tr.traceEvents ?? tr;
const names = new Map(
  ev
    .filter((e) => e.ph === "M" && e.name === "thread_name")
    .map((e) => [`${e.pid}:${e.tid}`, e.args.name]),
);
const main = ev.filter(
  (e) => e.ph === "X" && names.get(`${e.pid}:${e.tid}`) === "CrRendererMain",
);
const wins = main
  .filter(
    (e) =>
      e.name === "ThreadControllerImpl::RunTask" && e.dur > +minTask * 1000,
  )
  // not the recording's own: DevTools starting and stopping the profiler
  .filter(
    (e) =>
      !main.some(
        (k) =>
          k.name === "Receive mojo message" &&
          JSON.stringify(k.args).includes("DevToolsSession") &&
          k.ts >= e.ts &&
          k.ts <= e.ts + e.dur,
      ),
  )
  .map((e) => [e.ts, e.ts + e.dur]);
const maps = {};
const orig = (cf) => {
  const file = cf.url.split("/").pop();
  if (!file.endsWith(".js") || !fs.existsSync(`${dist}/assets/${file}.map`))
    return `${cf.functionName || "(anon)"}${file ? " " + file : ""}`;
  maps[file] ??= new SourceMapConsumer(
    JSON.parse(fs.readFileSync(`${dist}/assets/${file}.map`)),
  );
  const o = maps[file].originalPositionFor({
    line: cf.lineNumber + 1,
    column: cf.columnNumber,
  });
  return `${o.name || cf.functionName || "(anon)"} ${(o.source || "").replace(/^.*node_modules\//, "nm/").replace(/^.*p2pgames\//, "")}:${o.line}`;
};
const nodes = new Map(p.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
wins.forEach(([a, b], wi) => {
  const tree = { kids: new Map(), ms: 0 };
  let t = p.startTime;
  p.samples.forEach((id, i) => {
    t += p.timeDeltas[i];
    if (t < a || t > b) return;
    const dt = (p.timeDeltas[i + 1] ?? 0) / 1000;
    const path = [];
    for (let x = id; x; x = parent.get(x))
      path.unshift(orig(nodes.get(x).callFrame));
    let n = tree;
    n.ms += dt;
    for (const k of path) {
      if (!n.kids.has(k)) n.kids.set(k, { kids: new Map(), ms: 0 });
      n = n.kids.get(k);
      n.ms += dt;
    }
  });
  console.log(
    `\n==== task ${wi}: ${((b - a) / 1000).toFixed(1)} ms, sampled ${tree.ms.toFixed(1)}`,
  );
  const walk = (n, d) => {
    // collapse single-child chains of library frames
    for (const [k, c] of [...n.kids].sort((x, y) => y[1].ms - x[1].ms)) {
      if (c.ms < +minNode) continue;
      const lib = !k.includes("src/");
      if (lib && c.kids.size === 1 && [...c.kids.values()][0].ms > c.ms * 0.9) {
        walk(c, d);
        continue;
      }
      console.log(`${" ".repeat(d * 2)}${c.ms.toFixed(1)} ${k}`);
      walk(c, d + 1);
    }
  };
  walk(tree, 0);
});
