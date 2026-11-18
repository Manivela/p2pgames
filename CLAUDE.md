# p2pgames

How each part works is in its code comments; this file holds the conventions, decisions and gotchas they don't, for every table. Okey's own: `src/Components/Okey/CLAUDE.md`.

- No artifacts for this project: show screenshots and results locally (open the images in Preview), never as a published page.
- Every string a page shows is English through `t()`, with a Turkish line in `src/i18n.js`.
- A feature that fits every game goes to every table at once. When that's more than the task, it's still built in the shared code (`src/Components/`, `src/hooks/`), called from the tables that have it so far, so another table takes it up with a call and nothing moves.
- Gestures over buttons wherever one fits. Moves that end or replace the game, or change who's in it, live in the table's ⋯ menu (Okey's `TableMenu.jsx`, the others' `Table/index.jsx`) behind a second tap (`Confirm`). Nothing times out: the turn waits for the player.
- Every menu, dialog and popup closes on a tap outside it and on Escape (`useEscape`), as the shared `Dialog` (`Saves.jsx`) does.
- A game shows as few words as it can; explaining belongs on its help page (`?`). Playing should feel like sitting at a real table together.
- Phones play everything a game needs; extras don't all have to fit one. Something a phone has no room for (an editor, a long list of settings) can be left off phones, as long as nothing needed to play is. When the same layout fits a phone with little work, keep it the same instead of leaving the phone out.
- Bootstrap 3's CSS is global: give parts names of their own (`.half`, `.seat`), clear of its classes (`.row`, `.hidden`, `.label`, `.open`, `.fade`, `.table`…).
- Older builds' games and saves aren't kept playable: no migrations. The stats' recordings (`Stats/`) are the exception: kept for good and passed between devices, each stamped with the `BUILD` that made it, so a stat reads old shapes as it finds them, and a changed stat bumps `VERSION` to work every recorded game out again.

## Verify

1. `npm run check`: the unit tests (vitest) and lint, prettier inside it, no errors.
2. End to end, the tests of what changed, on the Mac: `npx playwright test -g "<title>" --project desktop`, and `--project phone` for touch or Turkish; the screenshots are compared only in Playwright's Linux image. After an intended visual change: `npm run test:e2e -- --update-snapshots -g "<title>"` runs those tests in the Linux image (`e2e/docker.sh`; the first run pulls ~1 GB), look at each new PNG in `e2e/*.e2e.js-snapshots/`, commit them (a change within the per-pixel tolerance keeps the old image; `=all` rewrites every one).
3. The whole e2e suite runs on CI (`.github/workflows/test.yml`), on every push to main, the screenshots compared, and main deploys only once it's green (its last job). To see it before pushing: `npm run test:e2e`, about 4 minutes with the laptop otherwise idle; busy with anything else, its timing and screenshot tests fail.
4. A layout change, by eye: 1348×870, 1024×768, 820×1180, 844×390 and 667×320, each in the lobby, mid-game, at a round's or game's end and watching without a seat, in English and Turkish.

Done when check and the e2e of what changed are green, every layout change has been seen at each size and stage, its strings in Turkish too, and once pushed, CI's run is green (`gh run watch`).
