# Testing Okey

Rules (vitest, `npx vitest run`):
- Rules are pure functions in `game.js`: `(state, player, ...args) => newState | "toast message" | undefined` (no change). `OkeyContext.jsx` only wires them to Yjs. New rules go in `game.js` or a pure sibling like `checkFinish.js`, with tests.
- Pattern in `game.test.js`: `seated(n)` for an unshuffled table, `game.startGame(state, { okeyTile, hands })` to deal a known position.
- Americano: round table and score constants at the top of `americano.js`; küt/seri checks in `melds.js`. `americano.*` wraps `game.*` for the moves that differ (start, discard, finish). Tests in `americano.test.js`.
- Tile id `${color}${rank}-${copy}` (`red7-0`, fake okey `yellow👌-1`). `okeyTile` is the indicator; the okey is the next rank in the same colour. A hand has 26 slots (13 per row); `null` is a gap, and gaps separate groups.

Multiplayer and UI (Playwright MCP):
- With the dev server running, open the same `/<room>/okey` in several tabs of one browser. They sync over BroadcastChannel, with no signaling. Log in per tab; login is in memory, so a reload logs out.
- Dev-only `window.okey` reads and writes the shared state. To play as any seat: `g = await import("/src/Components/Okey/game.js")`, then `okey.set(g.drawTile(okey.get(), seat, tile, slot))`.
- Shared state is split across Yjs keys by writer (`sync.js` `parts`), so simultaneous moves by different players both survive. New top-level state lands in the `turn` key; if another player can write it at the same time, give it its own key. Only a hand's owner writes it: tiles given to another player go through their `inbox`. Whole-game changes (start, new game, reset) go through `replaceState`.
- `dragTo` works with react-dnd. Tag the source and target with `data-*` first. Your own rack is `.rack` 0.
