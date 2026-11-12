# Okey

How each part works is in its code comments; this file holds the conventions, decisions and gotchas they don't. The table's words: `GLOSSARY.md`.

## Rules and state

- Rules are pure functions, `(state, player, ...args) => newState | "toast message" | undefined` (no change), each with tests, in `okey.js` (the one module anything else imports) over `game.js`. `OkeyContext.jsx` only wires them to Yjs.
- A rule that differs between games is a setting in the ruleset, never a check of which game it is (a preset's id) or of what the whole game opens with: players make their own games by combining settings, and the presets are just their values. What a round shows or allows goes by that round (`roundOf`, `isElden`).
- A rule reads its setting from `state.rules` at the move, so one changed mid-game (⋯ → Rules) counts from then on; every ruleset has every setting (`DEFAULTS`, where adding one is spelled out), so nothing reads one with a fallback.
- 101 follows the Eşli 101 Turnuvası's PDF over pagat.com, each rule its own switch; a setting whose comment says "the user's call" departs from the PDF on purpose.
- Older builds' games and saves aren't kept playable: no migrations.
- Sync (`sync.js`) splits the state into Yjs keys by writer, so simultaneous moves by different players both survive. New top-level state lands in the `turn` key, written by the player whose turn it is; state another player can write at the same moment needs a key of its own. A hand is written only by its owner: tiles given to someone go through their `inbox`. Whole-game changes go through `replaceState`.
- Every string the table shows is English through `t()`, with a Turkish line in `src/i18n.js`.

## Table

- Show what everyone at a real table sees and leave the thinking to the player: no hints about what to lay, no auto-sort. Make hands faster, not smarter. The one exception, asked for: El aç's first press picks what the rules would lay down (the opening they find, the highest tiles first as they'd count against you left on the rack, then the sets and runs as they lie on the rack; never pairs, those are picked on purpose), for the player to change or lay.
- Gestures over buttons wherever one fits. Moves that end or replace the game, or change who's in the round, live in the ⋯ menu (`TableMenu.jsx`) behind a second tap (`Confirm`). Nothing times out: the turn waits for the player.
- One layout for every screen, sized in tile widths `--t` (`useTileSize`); only the size changes. Anything that comes and goes (badges, Sit, the tea glass, Catch) is placed absolutely, so its row never shifts; along the top it stays inside the row, as a full table's melds come right up to it, and a seat has room for one line of badges.
- Phones play everything a hand needs; extras don't all have to fit one. Something a phone has no room for (an editor, a long list of settings) can be left off phones, as long as nothing needed to play is. When the same layout fits a phone with little work, keep it the same instead of leaving the phone out.
- Bootstrap 3's CSS is global: give table parts names of their own (`.half`, `.seat`), clear of its classes (`.row`, `.hidden`, `.label`, `.open`, `.fade`, `.table`…).
- A new place a tile can be gets the `data-*` attribute animations find it by (`moves.js`).

## Verify

1. `npm run check`: the unit tests (vitest) and lint, prettier inside it, no errors. A discard waits out the others' claim time unless its `now` is past it: tests pass `afterWait(s)`, scripts `Infinity`.
2. End to end, the tests of what changed, on the Mac: `npx playwright test -g "<title>" --project desktop`, and `--project phone` for touch or Turkish; the screenshots are compared only in Playwright's Linux image. Positions come from `e2e/table.js`. A new table stage gets the fit check (`check()`: nothing overlaps or falls off-screen) and a reference screenshot. After an intended visual change: `npm run test:e2e -- --update-snapshots -g "<title>"` runs those tests in the Linux image (`e2e/docker.sh`; the first run pulls ~1 GB), look at each new PNG in `e2e/okey.e2e.js-snapshots/`, commit them (a change within the per-pixel tolerance keeps the old image; `=all` rewrites every one).
3. The whole e2e suite runs on CI (`.github/workflows/test.yml`), on every push to main, the screenshots compared, and main deploys only once it's green (its last job). To see it before pushing: `npm run test:e2e`, about 4 minutes with the laptop otherwise idle; busy with anything else, its timing and screenshot tests fail.
4. A layout change, by eye: 1348×870, 1024×768, 820×1180, 844×390 and 667×320, each in the lobby, mid-game, at round end and watching without a seat, in English and Turkish.

Done when check and the e2e of what changed are green, every layout change has been seen at each size and stage, its strings in Turkish too, and once pushed, CI's run is green (`gh run watch`).

Driving the table in a browser or a script (Playwright, `window.okey`, bots, touch, Turkish, a second player): `DRIVING.md`.
