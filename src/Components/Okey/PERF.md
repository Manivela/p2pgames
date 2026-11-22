# What a move costs a frame

Measured November 2026 on an M-series MacBook at 60 Hz, in a production build in a headed Chrome, with the scripts in `perf/` (below). Nothing at the table misses a frame there. A rack drag and the flights hold 60 fps. A discard, yours or anyone's, and a discard taken, cost one task of 9–12 ms, a bot's 5–9, inside a frame. A phone or an old laptop pays two to four times that and would miss one.

## Where a discard's 12 ms go

From a CPU profile at 50 µs inside the discard's task, mapped to source through the build's source maps:

- **3.6 ms, a bot's claim check:** `bots.claim` in OkeyContext's out-of-turn effect, its `bestMelds` search, on the page that plays the bots. It runs in the same task, as React runs effects at once after a tap.
- **About 3 ms, React rendering and committing the table.** The whole table re-renders on every state change, as `OkeyContext`'s value is one object every consumer reads.
- **1.4 ms, the drop and its write:** react-dnd, `writeState`, Yjs.
- **1.4 ms, the page's layout,** forced early by `usePileAside`'s layout effect (`Board.jsx`). After every render it reads `clientHeight`, and it makes a new ResizeObserver each time. The frame needs the layout anyway, so moving that read alone saves nothing. The flights (`fly` in `moves.js`) also read rects after writing.

What would cut it, biggest first:

1. The bot's claim check after the frame (a timeout).
2. Re-render less: split the context, or memo the racks and seats, so a discard renders only what changed.
3. The flights' reads before their writes.

Worth doing once a slower device shows a hitch.

## Fixed already

- **The tea glass** was made at the next seat and taken down at the last every turn, 80 SVG elements. Every seat now keeps one and only the turn's shows (`TeaGlass.jsx`); it slides itself to the next seat (`slide` in `moves.js`). A discard went from 11–13 ms to 9–10, and the one frame a run missed is gone.
- **The dragged tile** moved by `left` and `top`, so the felt under it was painted again each frame. It now moves by `transform`, on a layer of its own (`DragPreview` in `index.jsx`, `tile.css`). That's 15% less raster work with the GPU, 30% less without it.

## Mistakes not to make again

- **Chrome's invalidation tracking** (`disabled-by-default-devtools.timeline.invalidationTracking`) inflates style and layout two to three times, worst where many elements change. With it on, a discard read 33–39 ms before the glass fix and 22 after. Leave it out of a trace; `okey.mjs` does.
- **The repo's `dist` has no source maps.** The Sentry plugin deletes `./dist/**/*.map` after every build, uploaded or not. Build to another folder (`--outDir`), as below.
- **A requestAnimationFrame counter in the page** misses the frames a long task drops. Count the gaps between the trace's `FireAnimationFrame`s instead, as `tasks.py` does.
- **The recording's own tasks** are DevTools starting and stopping the profiler: 20–50 ms at either end, not the page's. The scripts leave them out.

## Ruled out

- **`:has()` selectors:** all 18 rules dropped changed little.
- **`removeChild`** can show several ms in a profile. That's the profiler's attribution: removals timed directly take under 0.5 ms.
- **Sentry's tracing** can't see this: it (the loader in `main.jsx`) covers page loads and how fast taps are answered, never frames during play. Hitches during play reach it through `src/hitches.js` instead. Its long frames are all at load, the worst Cloudflare's Rocket Loader (a zone setting, up to 400 ms).
- **What was felt on the deployed site** (choppy discards) isn't the main thread's on this Mac. When it's felt again, record DevTools' Performance panel in that browser while it happens; meanwhile `src/hitches.js` sends players' hitches to Sentry, with what held each up where Chrome can say. Candidates:
  - GPU stalls: shaders compiled into an empty cache, 100–260 ms in a fresh browser.
  - A browser capping the frame rate: Opera GX's GX Control, or Chrome's Energy Saver at 30 fps.

## Measuring again

```sh
B=$(mktemp -d)
npx vite build --outDir $B                   # keeps its source maps
npx vite preview --outDir $B                 # http://localhost:4173
node perf/okey.mjs http://localhost:4173     # prints where it wrote
python3 -I perf/tasks.py <out>/trace.json    # long tasks and dropped frames, by phase
python3 -I perf/phases.py <out>/trace.json   # paints, raster, the busy threads
node perf/tree.cjs <out> $B 8                # the call tree of each task over 8 ms
```

`okey.mjs` plays alone with three bots: an idle stretch, drags along the rack, a discard by a drag, the bots' turns and a discard taken with Take, each marked as a phase. It opens a window by default. `--headless` gives the same main thread (JavaScript, style, layout: a discard's task within noise), so it's enough for that. But headless has no GPU: it rasters on the CPU in software, about ten times the time, as `ARGS=--disable-gpu` does, and a GPU stall can't show. Use a window for repaints and the GPU.
