# Okey

How each part works is in its code comments; this file holds the conventions, decisions and gotchas they don't, Okey's own over the repo's (`CLAUDE.md` at the root, Verify there too). The table's words: `GLOSSARY.md`.

## Rules and state

- Rules are pure functions, `(state, player, ...args) => newState | "toast message" | undefined` (no change), each with tests, in `okey.js` (the one module anything else imports) over `game.js`. `OkeyContext.jsx` only wires them to Yjs.
- A rule that differs between games is a setting in the ruleset, never a check of which game it is (a preset's id) or of what the whole game opens with: players make their own games by combining settings, and the presets are just their values. What a round shows or allows goes by that round (`roundOf`, `isElden`).
- A rule reads its setting from `state.rules` at the move, so one changed mid-game (⋯ → Rules) counts from then on; every ruleset has every setting (`DEFAULTS`, where adding one is spelled out), so nothing reads one with a fallback.
- 101 follows the Eşli 101 Turnuvası's PDF over pagat.com, each rule its own switch; a setting whose comment says "the user's call" departs from the PDF on purpose.
- Sync (`sync.js`) splits the state into Yjs keys by writer, so simultaneous moves by different players both survive. New top-level state lands in the `turn` key, written by the player whose turn it is; state another player can write at the same moment needs a key of its own. A hand is written only by its owner: tiles given to someone go through their `inbox`. Whole-game changes go through `replaceState`.

## Table

- Show what everyone at a real table sees and leave the thinking to the player: no hints about what to lay, no auto-sort. Make hands faster, not smarter. The one exception, asked for: El aç's first press picks what the rules would lay down (the opening they find, the highest tiles first as they'd count against you left on the rack, then the sets and runs as they lie on the rack; never pairs, those are picked on purpose), for the player to change or lay.
- One layout for every screen, sized in tile widths `--t` (`useTileSize`); only the size changes. Anything that comes and goes (badges, Sit, the tea glass, Take and Call!) is placed absolutely, so its row never shifts; along the top it stays inside the row, as a full table's melds come right up to it, and a seat has room for one line of badges.
- A new place a tile can be gets the `data-*` attribute animations find it by (`moves.js`), and a place code in `okeyView` (`Stats/history.js`), which records where every tile is for the stats: a tile it doesn't know drops out of the record.

## Testing

- A discard waits out the others' claim time unless its `now` is past it: tests pass `afterWait(s)`, scripts `Infinity`.
- End to end, positions come from `e2e/table.js`. A new table stage gets the fit check (`check()`: nothing overlaps or falls off-screen) and a reference screenshot.

Driving the table in a browser or a script (Playwright, `window.okey`, bots, touch, Turkish, a second player): `DRIVING.md`.
