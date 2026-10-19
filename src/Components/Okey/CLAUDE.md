# Testing Okey

Rules (vitest, `npx vitest run`):
- Rules are pure functions in `game.js`: `(state, player, ...args) => newState | "toast message" | undefined` (no change). `OkeyContext.jsx` only wires them to Yjs. New rules go in `game.js` or a pure sibling like `checkFinish.js`, with tests.
- Pattern in `game.test.js`: `seated(n)` for an unshuffled table, `game.startGame(state, { okeyTile, hands })` to deal a known position.
- Americano: round table and score constants at the top of `americano.js`; küt/seri checks in `melds.js`. `americano.*` wraps `game.*` for the moves that differ (start, discard, finish). Tests in `americano.test.js`.
- A discard can be claimed before the current player draws: `upForClaim` gives the discard up for claim, the offer once they draw from the pile. A table okey's value is fixed by where it sits (`okeyStandsFor`); a seri keeps the order it was laid in off the rack.
- Tile id `${color}${rank}-${copy}` (`red7-0`, fake okey `yellow👌-1`). `okeyTile` is the indicator; the okey is the next rank in the same colour. A hand has 26 slots (13 per row); `null` is a gap, and gaps separate groups.

Design:
- Prefer gestures to buttons wherever one fits: drag picked tiles onto the table to open, drag a picked tile to move the whole pick, hold to flip. Moves that end or replace the game (new game, reset, stand, load, set up Americano) live in the ⋯ table menu (`TableMenu.jsx`) behind a second tap.
- Every device auto-saves the latest game it saw, in any room, to `localStorage` (`okey-save`, one slot) as a save code (`game.encodeSave`: deflated and base64'd, so hands aren't readable at a glance); loading seats whoever sits in each seat now (`game.restore`).
- Between games and Americano rounds every seat shows (`game.allSeats`), so people can sit down or be freed from the ⋯ menu; the next deal goes to whoever sits. A seat keeps its score whoever sits in it; a seat new to the game starts at the worst total of those still playing (`americano.nextRound`).

Multiplayer and UI (Playwright MCP):
- With the dev server running, open the same `/<room>/okey` in several tabs of one browser. They sync over BroadcastChannel, with no signaling. Log in per tab; login is in memory, so a reload logs out.
- Dev-only `window.okey` reads and writes the shared state. To play as any seat: `g = await import("/src/Components/Okey/game.js")`, then `okey.set(g.drawTile(okey.get(), seat, tile, slot))`.
- Shared state is split across Yjs keys by writer (`sync.js` `parts`), so simultaneous moves by different players both survive. New top-level state lands in the `turn` key; if another player can write it at the same time, give it its own key. Only a hand's owner writes it: tiles given to another player go through their `inbox`. Whole-game changes (start, new game, reset) go through `replaceState`. A client that hasn't received the doc yet writes to the `lobby` deal and never moves the `deal` pointer, so a rejoining phone can't wipe the game. To test real network sync, open the second player in `browser.newContext()`: tabs of one context sync over BroadcastChannel almost instantly.
- `dragTo` works with react-dnd. Tag the source and target with `data-*` first. Your own rack is `.rack` 0.
- Phones: `PhoneBoard` (Board.jsx) replaces the table when its box is under 500px tall; check it at 844×390 and 667×320. Touch screens get react-dnd's touch backend, picked at load from `navigator.maxTouchPoints`. To test touch, open a page, call CDP `Emulation.setTouchEmulationEnabled` on it *before* navigating, then drag with `Input.dispatchTouchEvent` start / move / end.
- The claim wait: `americano.drawTile` / `discardTile` take an optional `now` (ms). Tests discard at `afterWait(s)`; scripted play passes `Infinity`.
- Text: rules and shared messages stay in English; the UI shows them through `t()` from `src/i18n.js` (Turkish on Turkish devices). A new message needs a Turkish line there, or `i18n.test.js` fails. To see Turkish in Playwright, override `navigator.language` with `addInitScript` before loading; CDP's locale override doesn't change it.
