# Okey

How each part works is in its code comments; this file holds the conventions, decisions and gotchas they don't.

## Rules and state

- Rules are pure functions, `(state, player, ...args) => newState | "toast message" | undefined` (no change), each with tests: classic and what every ruleset shares in `game.js`, Americano and 101 in `americano.js` (wrapping `game.*` for the moves that differ, importing the shared helpers), meld and finish checks in `melds.js` / `checkFinish.js`. `OkeyContext.jsx` only wires them to Yjs.
- A ruleset's numbers and switches are a preset in `rulesets.js`, stored in the game as `rules` and read from there, so a game keeps the rules it started with; classic has `rules` null. 101 follows the Eşli 101 Turnuvası's rules (the PDF linked in `rulesets.js`) over pagat.com's, each rule its own switch so a game started before keeps pagat's; partners and doubling (katlamalı) are options chosen at the start, and the gösterge (`indicatorScore`) is the user's addition, though the PDF has none. Not yet: "devam" (×4), a pairs opener looking through the discards, best-of-three matches.
- Tile id `${color}${rank}-${copy}` (`red7-0`, fake okey `yellow👌-1`). `okeyTile` is the indicator; the okey is the next rank in its colour. A hand has two rack rows of `rowOf(state)` slots (13; 101's `rowSlots` 15); `null` is a gap, and gaps separate groups. The hex in a tile is game state (saves, `melds.js` compares it): colour tiles through their `c-<colour>` class.
- A hand ends when someone throws their last tile to the middle (`finishGame`; discarding it is refused), where it lies as `finishTile` until the next deal, or when the pile runs out: Americano and 101 end the round, classic lets the player whose turn it is shuffle the discards into a new pile or end the game (`pileOut`).
- A move the round end should show is logged with `logMove` (`turnMoves`, emptied as the turn passes).
- Sync (`sync.js`) splits the state into Yjs keys by writer, so simultaneous moves by different players both survive. New top-level state lands in the `turn` key, written by the player whose turn it is; state another player can write at the same moment gets a key of its own. A hand is written only by its owner: tiles given to someone go through their `inbox`. Whole-game changes (start, new game, reset, load) go through `replaceState`.
- A player who drops out (a reload, a phone that slept) leaves their seat `away: <user id>`, and only they sit back down in it by themselves; a reset or a freed seat (`left`) isn't sat back in.
- New versions (`src/version.js`): each page tells the table its build (awareness). A page older than the site or than someone at the table offers Reload, and reloads by itself between hands only when someone at the table runs the newer build: they keep the game meanwhile. Never auto-reload on the site's version alone, or the whole table reloads at once and the game is gone.
- Rules and shared messages are English, shown through `t()` (`src/i18n.js`): every new string gets a Turkish line. `TR` takes the first match, so a specific pattern sits above any catch-all it would hit (`No tiles left` above `(.+) left`). `i18n.test.js` checks the `return "…"` messages of the rules files it lists: a new rules file joins the list.

## Table

- Show what everyone at a real table sees and leave the thinking to the player: no hints about what to lay, no auto-sort. Make hands faster, not smarter. The one exception, asked for: El aç pressed again with nothing picked opens the sets and runs the rules find on the rack (never pairs, those are picked on purpose), with nothing shown beforehand.
- Gestures over buttons wherever one fits. Moves that end or replace the game live in the ⋯ menu (`TableMenu.jsx`) behind a second tap (`Confirm`).
- The turn timer only reminds: it loops, turns red after the first lap, and the turn waits for the player.
- One layout for every screen (`Board.jsx`, a CSS grid), sized in tile widths `--t` (`useTileSize`); only the size changes. Anything that comes and goes (badges, Sit, the tea glass, Catch) is placed absolutely, so its row never shifts.
- Bootstrap 3's CSS is global: give table parts names of their own (`.half`, `.seat`), clear of its classes (`.row`, `.hidden`, `.label`, `.open`, `.fade`, `.table`…).
- A face-down tile renders only `.back`, its colour and number out of the page: inspecting the pile would show the next tile.
- Animations (`moves.js`) find tiles and places by `data-tile-id`, `data-seat`, `data-pile`, `data-meld`, `data-hand`: a new place a tile can be needs its attribute; a picture of a tile (`TileFace`) carries none, so nothing flies to it. Flights measure screen rects, which Chrome and WebKit both report right inside `zoom` (small piles, melds, shown hands).

## Verify

1. Rules: `npx vitest run` from the repo root (from this folder it skips test files). Deal a known position with `seated(n)` (`game.test.js`) and `game.startGame(state, { okeyTile, hands })`, or `americano.startGame(state, deal, rules)`. Americano's claim wait: `drawTile` / `discardTile` take an optional `now`; tests discard at `afterWait(s)`, scripts pass `Infinity`.
2. `npm run lint`: no errors (prettier runs inside it).
3. End to end: `npm run test:e2e` runs `e2e/okey.e2e.js` in Playwright's Linux image (`e2e/docker.sh`; the first run pulls ~1 GB), so screenshots match on every machine; `npx playwright test` on the Mac runs the same tests in ~15 s without the screenshot comparisons. Positions come from `e2e/table.js`: the real rules on a fixed deal, written with `window.okey`. A new table stage gets the fit check (`check()`: nothing overlaps or falls off-screen) and a reference screenshot. After an intended visual change: `npm run test:e2e -- --update-snapshots`, look at each new PNG in `e2e/okey.e2e.js-snapshots/`, commit them (a change within the per-pixel tolerance keeps the old image; `=all` rewrites every one).
4. A layout change, by eye: 1348×870, 1024×768, 820×1180, 844×390 and 667×320, each in the lobby, mid-game, at round end and watching without a seat, in English and Turkish.

Done when vitest, lint and the Docker e2e are green and every layout change has been seen at each size and stage, its strings in Turkish too.

Driving the table (Playwright MCP or a script, against the dev server):

- Tabs of one browser on the same `/<room>/okey` sync over BroadcastChannel, almost instantly; for real network sync, open the second player in `browser.newContext()`. Login is per tab (sessionStorage): a reload keeps it and sits you back down, a new tab is a new player. A tab reloaded while alone in its room comes back to an empty table: the game lives only in the open pages.
- A tab plays a newer build in development with `sessionStorage.setItem("build", n)` before it loads (`secondPlayer()` in the e2e).
- Dev-only `window.okey` reads and writes the shared state; to play any seat: `g = await import("/src/Components/Okey/game.js")`, then `okey.set(g.drawTile(okey.get(), seat, tile, slot))`. Dev-only `window.okeyFlights` counts animation flights.
- `dragTo` works with react-dnd once source and target carry a `data-*` to find them by. Your own rack is the only `.rack`.
- Turkish: override `navigator.language` with `addInitScript` before loading (CDP's locale override leaves it alone).
- Touch: the touch backend is picked at load from `navigator.maxTouchPoints`: call CDP `Emulation.setTouchEmulationEnabled` before navigating, then drag with `Input.dispatchTouchEvent` start / move / end.
- Report a problem (Sentry's form) loads only on the deployed site: serve a production build at the live address (`route`) and intercept `ingest.us.sentry.io`.
