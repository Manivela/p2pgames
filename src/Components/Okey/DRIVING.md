# Driving the Okey table

In a browser or a script, against the dev server (Playwright MCP, a Node script, the e2e).

- Another player is another browser: `browser.newContext()`, synced over the network in about a second (the e2e's pages find each other through a signaling server of their own, `playwright.config.js`; a plain dev server's through the live one); what its page does before the game arrives is lost (`arrived()` in the e2e waits). Remove localStorage `user` before a page first loads to be asked a name, and set sessionStorage `watch` to keep it from sitting down by itself (`sitDown()`). A tab reloaded while alone in its room comes back to the same game and way of playing (sessionStorage `room-game`, `root.jsx`) but an empty table: the game lives only in the open pages. The e2e dev server starts every room with "Next round waits for everyone" off (`WAITS`, `hooks/useRoom.js`); a test of it switches it on in ⋯ → Settings.
- A bot is a seat whose `user.bot` is set, played by the page whose `userKey` it holds (`bot.js`); the e2e's `seatBots` users aren't bots and stay unplayed. sessionStorage `botPace` (ms between moves) runs them fast.
- A tab plays a newer build in development with `sessionStorage.setItem("build", n)` before it loads (`secondPlayer()` in the e2e).
- Dev-only `window.okey` reads and writes the shared state; to play any seat: `g = await import("/src/Components/Okey/okey.js")`, then `okey.set(g.drawTile(okey.get(), seat, tile, slot))`. Dev-only `window.okeyFlights` counts animation flights.
- `dragTo` works with react-dnd once source and target carry a `data-*` to find them by. Your own rack is the only `.rack`.
- Turkish: override `navigator.language` with `addInitScript` before loading (CDP's locale override leaves it alone).
- Touch: react-dnd's touch backend drags the mouse too, on every screen (never the browser's own drag and drop, which goes through the OS: players on Windows 11 lost copy and paste in every app while at the table). For real touches (a tile's hold, a finger's box) call CDP `Emulation.setTouchEmulationEnabled` before navigating, then `Input.dispatchTouchEvent` start / move / end.
- Report a problem (Sentry's form) loads only on the deployed site: serve a production build at the live address (`route`) and intercept `ingest.us.sentry.io`.
