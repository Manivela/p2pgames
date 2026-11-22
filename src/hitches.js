// Hitches on players' devices, which Sentry's tracing doesn't see (it
// records page loads and how fast a tap is answered, never frames during
// play). Only while something moves at a table (a tile flying, one
// dragged: `watch`), never all the time, as a frame loop always running
// costs a battery, each frame is timed. One over 50 ms is a hitch, sent to
// Sentry as it happens: the game's own work if the browser's long animation
// frames (Chrome's) cover it, the GPU or the browser if they don't. A frame
// rate held near 30 (Opera GX's limiter, Chrome's Energy Saver) is sent
// once a page.

// a frame this long is a hitch, and a page sends this many at most: a
// device that struggles all game sends its first ones
const HITCH = 50;
const MOST = 20;

// what's moving, by name, and how to tell it still is
const watching = new Map();
// the frames' times since a watch began
const frames = [];
let last = null;
let looping = false;
let sent = 0;
let cappedSent = false;
// a hidden page draws no frames: the gap across it is no hitch
let hiddenAt = -Infinity;
// the long animation frames lately, where the browser has them
const LOAF =
  typeof PerformanceObserver !== "undefined" &&
  PerformanceObserver.supportedEntryTypes?.includes("long-animation-frame");
let long = [];
let observing = false;

// What held up the frames between start and end: the page's work when a
// long animation frame covers them (and the script that took longest in
// it), the GPU or the browser when none does; unknown without them.
export function causeOf(start, end, entries, supported = true) {
  if (!supported) return { cause: "unknown" };
  const frame = entries.find(
    (f) => f.startTime < end && f.startTime + f.duration > start,
  );
  if (!frame) return { cause: "gpu or browser" };
  const script = [...(frame.scripts ?? [])].sort(
    (a, b) => b.duration - a.duration,
  )[0];
  return {
    cause: "main thread",
    ...(script && {
      script: {
        ms: Math.round(script.duration),
        invoker: script.invoker,
        source: script.sourceURL,
        function: script.sourceFunctionName,
      },
    }),
  };
}

// A frame rate held near 30 a second: the frames' median time, from enough
// of them, when it's near 33 ms, or null.
export function cappedAt(times) {
  if (times.length < 10) return null;
  const sorted = [...times].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return median >= 28 && median <= 40 ? Math.round(median) : null;
}

function send(message, captureContext) {
  if (import.meta.env.DEV) (window.hitches ??= []).push(captureContext);
  window.Sentry?.captureMessage(message, {
    level: "warning",
    ...captureContext,
  });
}

function hitch(start, end, around) {
  if (sent >= MOST) return;
  sent++;
  const moving = [...watching.keys()].join(" ");
  // a long animation frame is reported after it: wait for its entry
  setTimeout(() => {
    const ms = Math.round(end - start);
    const { cause, script } = causeOf(start, end, long, LOAF);
    // the site's own scripts by name: another's (an extension's) could tell
    // what a player has installed
    if (script?.source && !script.source.startsWith(location.origin)) {
      script.source = "elsewhere";
    }
    send(`Hitch: ${ms} ms, ${cause}`, {
      fingerprint: ["hitch", cause],
      tags: { hitch: cause, moving },
      contexts: { hitch: { ms, frames: around.map(Math.round), script } },
    });
  }, 300);
}

function tick(now) {
  for (const [what, still] of watching) if (!still()) watching.delete(what);
  if (last !== null && last > hiddenAt && !document.hidden) {
    const gap = now - last;
    // a long drag's last few seconds
    if (frames.push(gap) > 300) frames.shift();
    if (gap > HITCH) hitch(last, now, frames.slice(-12));
  }
  last = now;
  if (watching.size) {
    requestAnimationFrame(tick);
    return;
  }
  const capped = cappedAt(frames);
  if (capped && !cappedSent) {
    cappedSent = true;
    send(`Frame rate held near ${Math.round(1000 / capped)} fps`, {
      fingerprint: ["capped frame rate"],
      tags: { hitch: "capped" },
      contexts: { hitch: { median: capped, frames: frames.length } },
    });
  }
  frames.length = 0;
  last = null;
  looping = false;
}

// Times the frames while `still()` says `what` is moving (checked each
// frame); several things can move at once.
export function watch(what, still) {
  if (typeof requestAnimationFrame === "undefined") return;
  watching.set(what, still);
  if (looping) return;
  looping = true;
  // from the first watch on: the last few seconds' kept
  if (LOAF && !observing) {
    observing = true;
    new PerformanceObserver((list) => {
      const since = performance.now() - 5000;
      long = [...long, ...list.getEntries()].filter((f) => f.startTime > since);
    }).observe({ type: "long-animation-frame" });
  }
  requestAnimationFrame(tick);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) hiddenAt = performance.now();
  });
}
