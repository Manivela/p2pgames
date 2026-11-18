import { readFileSync } from "node:fs";
import { expect, test } from "./test";
import {
  NET,
  BOT,
  MENU,
  IN_PLAY,
  NEXT,
  SIT,
  againstBot,
  pick,
  enter,
  bothSides,
  moving,
  room,
  sitDown,
} from "./seats";

// Tic-tac-toe at the table: two browsers, or one device playing both
// sides. Its state through the dev-only window.tictactoe.
const WINS = (name) => new RegExp(`^${name} (wins!|kazandı!)$`);
const game = (page) => page.evaluate(() => window.tictactoe?.get());
const cell = (page, i) => page.locator(`[data-cell="${i}"]`);
const SUPER = /^(Tic-tac-toe Super|XOX Süper)$/;
const CLASSIC = /^(Tic-tac-toe Classic|XOX Klasik)$/;
const NEW_GAME = /^(New Game|Yeni oyun)$/;
const SAVED = /^(Saved games|Kayıtlı oyunlar)$/;

async function twoPlayers(browser, info) {
  const at = room("ttt");
  const x = await sitDown(browser, info, at, "tictactoe", "Ayşe", 0);
  const o = await sitDown(browser, info, at, "tictactoe", "Bora", 1);
  await expect.poll(() => game(x), NET).toBeTruthy();
  await expect.poll(() => game(o), NET).toBeTruthy();
  return { x, o };
}

test("X wins in a row: both pages, the score, then O starts", async ({
  browser,
}, info) => {
  const { x, o } = await twoPlayers(browser, info);
  // marks in turn, each seen on the other page; one out of turn does nothing
  for (const [page, i] of [
    [x, 0],
    [o, 3],
    [x, 1],
    [o, 4],
  ]) {
    await cell(page, i).click();
    const other = page === x ? o : x;
    await expect(other.locator(".tt-ink")).toHaveCount(
      (await game(page)).cells.filter((c) => c !== null).length,
      NET,
    );
  }
  await cell(o, 8).click();
  expect((await game(o)).cells[8]).toBe(null);
  await cell(x, 2).click();
  for (const page of [x, o]) {
    await expect(page.locator(".tt-margin p")).toHaveText(WINS("Ayşe"), NET);
    await expect(page.locator(".tt-strike")).toHaveCount(1);
  }
  // both pages clap, once
  for (const page of [x, o]) {
    await expect.poll(() => page.evaluate(() => window.tableApplause)).toBe(1);
  }
  // each page lists the other first, the points on each one's plate
  await expect(x.locator(".tb-points")).toHaveText(["0", "1"]);
  await expect(o.locator(".tb-points")).toHaveText(["1", "0"], NET);
  // a tap on the sheet: the next game, O to start
  await o.getByRole("button", { name: NEXT }).click();
  await expect.poll(async () => (await game(x)).turn, NET).toBe(1);
  await expect(x.locator(".tt-ink")).toHaveCount(0);
});

test("a reload shows the sheet as it is: no ink being drawn", async ({
  browser,
}, info) => {
  const { x, o } = await twoPlayers(browser, info);
  await cell(x, 4).click();
  await expect.poll(async () => (await game(o)).turn, NET).toBe(1);
  await cell(o, 0).click();
  await o.reload();
  const most = await moving(o, ".tt-sheet, .tt-ink path");
  await expect(o.locator(".tt-ink")).toHaveCount(2, NET);
  expect(most).toBe(0);
});

test("one device, face to face: a word to each, O's Undo turned to O", async ({
  browser,
}, info) => {
  const page = await sitDown(
    browser,
    info,
    room("ttt"),
    "tictactoe",
    "Ayşe",
    0,
  );
  await bothSides(page, true);
  await expect.poll(() => game(page), NET).toBeTruthy();
  await cell(page, 4).click();
  // X's mark: X's to take back, at X's side, upright
  await expect(page.locator(".tb-undo")).toHaveCount(1);
  await expect(page.locator(".tb-undo.over")).toHaveCount(0);
  await cell(page, 0).click();
  await expect(page.locator(".tb-undo.over")).toHaveCount(1);
  await page.locator(".tb-undo").click();
  expect((await game(page)).cells[0]).toBe(null);
  for (const i of [0, 8, 3, 2, 6]) await cell(page, i).click();
  // a copy of it in each margin, the far one turned
  await expect(page.locator(".tt-margin p")).toHaveText([WINS("O"), WINS("O")]);
  await expect(page.locator(".tt-margin.over")).toHaveCount(1);
  await expect(page.locator(".tb-plate.turn")).toHaveCount(1);
});

// a computer's keys: ⌘Z or Ctrl+Z takes back (with ⇧, redo, it doesn't),
// N deals the next game once one's over; their keycaps, off at first on a
// phone, in ⋯, which Escape closes
test("keys: ⌘Z takes back, N deals the next game, Escape closes ⋯", async ({
  browser,
}, info) => {
  const page = await sitDown(
    browser,
    info,
    room("ttt"),
    "tictactoe",
    "Ayşe",
    0,
  );
  await bothSides(page);
  await expect.poll(() => game(page), NET).toBeTruthy();
  await cell(page, 4).click();
  const desktop = info.project.name === "desktop";
  const key = page.locator(".tb-undo kbd");
  await expect(key).toBeVisible({ visible: desktop });
  await page.getByRole("button", { name: MENU }).click();
  await page.locator(".tb-menu .hints input").setChecked(!desktop);
  await page.keyboard.press("Escape");
  await expect(page.locator(".tb-menu .menu")).toHaveCount(0);
  await expect(key).toBeVisible({ visible: !desktop });
  await page.keyboard.press("ControlOrMeta+Shift+z");
  expect((await game(page)).cells[4]).toBe(0);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => (await game(page)).cells[4]).toBe(null);
  const { id } = await game(page);
  await page.keyboard.press("n");
  for (const i of [0, 3, 1, 4, 2]) await cell(page, i).click();
  await expect.poll(async () => (await game(page)).winner).toBeTruthy();
  expect((await game(page)).id).toBe(id);
  await page.keyboard.press("n");
  await expect.poll(async () => (await game(page)).id).not.toBe(id);
});

test("Super, picked in the menu: sent to a board, a board taken", async ({
  browser,
}, info) => {
  const page = await sitDown(
    browser,
    info,
    room("ttt"),
    "tictactoe",
    "Ayşe",
    0,
  );
  await bothSides(page, false);
  await expect.poll(() => game(page), NET).toBeTruthy();
  await pick(page, SUPER);
  // dealt again, nobody having marked: X still starts
  await expect.poll(async () => (await game(page)).cells.length).toBe(81);
  expect((await game(page)).turn).toBe(0);
  const at = (board, square) => cell(page, board * 9 + square).click();
  await at(0, 4);
  // sent to board 4: a mark elsewhere is refused
  await expect(page.locator(".tt-lit")).toHaveCount(1);
  await at(1, 0);
  expect((await game(page)).cells[9]).toBe(null);
  // X takes board 0 with its middle row
  for (const [b, s] of [
    [4, 0],
    [0, 3],
    [3, 0],
    [0, 5],
  ])
    await at(b, s);
  expect((await game(page)).boards[0]).toBe(0);
  await expect(page.locator(".tt-ink.big")).toHaveCount(1);
  // a game in play: another mode waits for it, the menu says
  await pick(page, CLASSIC);
  await expect(page.getByText(IN_PLAY)).toBeVisible();
  expect((await game(page)).cells).toHaveLength(81);
});

test("Super picked before the other sits: both sheets Super", async ({
  browser,
}, info) => {
  const at = room("ttt");
  const x = await sitDown(browser, info, at, "tictactoe", "Ayşe", 0);
  await pick(x, SUPER);
  const o = await sitDown(browser, info, at, "tictactoe", "Bora", 1);
  for (const page of [x, o]) {
    await expect
      .poll(async () => (await game(page))?.cells.length, NET)
      .toBe(81);
    // the small boards' pencil lines, four each
    await expect(page.locator(".tt-grid .fine")).toHaveCount(36);
  }
  await o.reload();
  await expect(o.locator(".tt-grid .fine")).toHaveCount(36, NET);
});

test("a bot answers each mark, played on when its page goes, its seat anyone's", async ({
  browser,
}, info) => {
  const at = room("ttt");
  const page = await againstBot(browser, info, at, "tictactoe");
  await expect(page.locator(".tb-plate .name").first()).toHaveText("Bot");
  const marks = async (p = page) =>
    (await game(p))?.cells.filter((c) => c !== null).length;
  await expect.poll(async () => (await game(page))?.turn, NET).toBe(0);
  await cell(page, 4).click();
  await expect.poll(() => marks()).toBe(2);
  expect((await game(page)).turn).toBe(0);
  // Bora comes to watch (the game kept while Ayşe's page reloads); the
  // page that seated the bot gone, one still here plays it
  const bora = await enter(browser, info, at, "tictactoe", "Bora");
  await expect.poll(() => marks(bora), NET).toBe(2);
  await page.reload();
  await expect.poll(async () => (await game(page))?.turn, NET).toBe(0);
  const free = (await game(page)).cells.findIndex((c) => c === null);
  await cell(page, free).click();
  await expect.poll(() => marks(), NET).toBe(4);
  // Bora takes the bot's seat, the game theirs to play on
  await bora.getByRole("button", { name: SIT }).click();
  await expect(page.locator(".tb-plate .name").first()).toHaveText("Bora", NET);
  expect(await marks()).toBe(4);
});

test("two bots play each other for whoever's watching", async ({
  browser,
}, info) => {
  const page = await enter(browser, info, room("ttt"), "tictactoe", "Can");
  await page.evaluate(() => sessionStorage.setItem("botPace", "50"));
  await page.getByRole("button", { name: BOT }).first().click();
  await page.getByRole("button", { name: BOT }).click();
  // each a bot, with the Sit that takes it over
  await expect(page.locator(".tb-plate .name")).toHaveText(["Bot", "Bot"]);
  await expect(
    page.locator(".tb-plate").getByRole("button", { name: SIT }),
  ).toHaveCount(2);

  // dealt and played to the end; the next game theirs to start
  await expect.poll(async () => (await game(page))?.turn, NET).toBe(null);
  // a win named by its side
  await expect(page.locator(".tt-margin p")).toHaveText(
    /^([XO] (wins!|kazandı!)|Draw|Berabere)$/,
  );
  const sheet = (await game(page)).sheet;
  await page.getByRole("button", { name: NEXT }).click();
  await expect
    .poll(async () => (await game(page)).sheet)
    .toBeGreaterThan(sheet);
});

test("a game kept on this device comes back to the table", async ({
  browser,
}, info) => {
  const page = await sitDown(
    browser,
    info,
    room("ttt"),
    "tictactoe",
    "Ayşe",
    0,
  );
  await bothSides(page);
  await expect.poll(async () => (await game(page))?.turn, NET).toBe(0);
  await cell(page, 4).click();
  await cell(page, 0).click();
  const before = await game(page);
  // kept a second after the last mark: probed often
  const kept = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("tictactoe-save") ?? "[]").map(
        (s) => s.game,
      ),
    );
  await expect.poll(kept, { intervals: [100] }).toEqual([before.id]);

  // a new game in its place, nobody's played in yet: not kept over it
  await page.getByRole("button", { name: MENU }).click();
  await page.getByRole("button", { name: NEW_GAME }).click();
  await page.locator(".tb-menu button.armed").click();
  await expect.poll(async () => (await game(page)).id).not.toBe(before.id);
  await expect(page.locator(".tt-ink")).toHaveCount(0);
  await page.waitForTimeout(1500);
  expect(await kept()).toEqual([before.id]);

  await page.getByRole("button", { name: MENU }).click();
  await page.getByRole("button", { name: SAVED }).click();
  await expect(page.locator(".saves > li")).toHaveCount(1);
  await page.locator(".saves button").click();
  await page.locator(".dialog button.armed").click();
  await expect.poll(async () => (await game(page)).id).toBe(before.id);
  expect((await game(page)).cells).toEqual(before.cells);
  await expect(page.locator(".tt-ink")).toHaveCount(2);
});

// your stats, from the site's menu (☰): a line's value, by its label (the
// first: overall, above each game's own)
const STATS = /^(Your stats|İstatistiklerin)$/;
async function stats(page) {
  await page.getByRole("button", { name: /^(Menu|Menü)$/ }).click();
  await page.getByRole("button", { name: STATS }).click();
  return (label) =>
    page
      .locator(".dialog.stats dl > div")
      .filter({ has: page.locator("dt", { hasText: label }) })
      .first()
      .locator("dd");
}

test("the stats count a game once, and one lost while its page was closed", async ({
  browser,
}, info) => {
  const { x, o } = await twoPlayers(browser, info);
  for (const [page, i] of [
    [x, 0],
    [o, 3],
    [x, 1],
    [o, 4],
  ]) {
    await cell(page, i).click();
    const other = page === x ? o : x;
    await expect
      .poll(async () => (await game(other)).cells[i], NET)
      .not.toBe(null);
  }
  // O's page closed, X wins
  const away = o.context();
  await o.close();
  await cell(x, 2).click();
  await expect(x.locator(".tt-margin p")).toHaveText(WINS("Ayşe"));
  let stat = await stats(x);
  await expect(stat(/^(Won|Kazanılan)$/)).toHaveText("1");
  await expect(stat(/^(Lost|Kaybedilen)$/)).toHaveText("0");
  // the score reset after the game's end: a step after its packed ones,
  // worked out with them (the summary written again, ending later), the
  // game still the one, still won
  const ended = async (page) =>
    page.evaluate(
      (id) =>
        new Promise((resolve) => {
          const req = indexedDB.open("stats");
          // not there yet: left for the page to make (made here, it would
          // be bare, the page's own open finding no stores to make)
          req.onupgradeneeded = () => req.transaction.abort();
          req.onerror = () => resolve(null);
          req.onsuccess = () => {
            const kept = req.result
              .transaction("summaries")
              .objectStore("summaries")
              .get(id);
            kept.onsuccess = () => resolve(kept.result?.end ?? null);
          };
        }),
      (await game(page)).id,
    );
  const won = await ended(x);
  expect(won).toBeTruthy();
  // Escape closes the stats, then the menu they opened from
  await x.keyboard.press("Escape");
  await x.keyboard.press("Escape");
  await x.evaluate(() =>
    window.tictactoe.set({ ...window.tictactoe.get(), score: [0, 0] }),
  );
  await expect.poll(() => ended(x)).toBeGreaterThan(won);
  stat = await stats(x);
  await expect(stat(/^(Games|Oyun)$/)).toHaveText("1");
  await expect(stat(/^(Won|Kazanılan)$/)).toHaveText("1");
  // O back at the table: the game it lost while away, counted
  const back = await away.newPage();
  await back.goto(x.url());
  await expect.poll(async () => (await game(back))?.winner, NET).toBeTruthy();
  stat = await stats(back);
  await expect(stat(/^(Lost|Kaybedilen)$/)).toHaveText("1");
  await expect(stat(/^(Most played with|En çok birlikte oynanan)$/)).toHaveText(
    "Ayşe (1)",
  );
  // the game seen again on a reload (the game kept by O's page): still one
  await x.reload();
  await expect.poll(async () => (await game(x))?.winner, NET).toBeTruthy();
  stat = await stats(x);
  await expect(stat(/^(Games|Oyun)$/)).toHaveText("1");
  // the next game started, O's first mark made: a game in play, which
  // Export leaves out (its marks no one's to read in the file), and every
  // step it takes deflated, as save codes are
  await x.keyboard.press("Escape");
  await x.keyboard.press("Escape");
  await x.getByRole("button", { name: NEXT }).click();
  await expect.poll(async () => (await game(back))?.turn, NET).toBe(1);
  await back.keyboard.press("Escape");
  await back.keyboard.press("Escape");
  await cell(back, 4).click();
  await expect.poll(async () => (await game(x)).cells[4], NET).toBe(1);
  await stats(back);
  // O's record taken to another browser as a file, and brought in there
  // twice: the game once
  const saved = back.waitForEvent("download");
  await back.getByRole("button", { name: /^(Export|Dışa aktar)$/ }).click();
  const file = await (await saved).path();
  const data = JSON.parse(readFileSync(file, "utf8"));
  expect(data.games.map((g) => g.id)).not.toContain((await game(back)).id);
  expect(data.games.every((g) => g.over)).toBe(true);
  // the game's steps packed into one once it's over
  expect(data.games.every((g) => typeof g.packed === "string")).toBe(true);
  expect(data.steps).toEqual([]);
  expect(JSON.stringify(data)).not.toContain("cells");
  const there = await enter(
    browser,
    info,
    new URL(x.url()).pathname.slice(1),
    "tictactoe",
    "Can",
  );
  stat = await stats(there);
  const input = there.locator('.dialog.stats input[type="file"]');
  await input.setInputFiles(file);
  await expect(
    there.getByText(/^(Games added: 1|Eklenen oyun: 1)$/),
  ).toBeVisible();
  await expect(stat(/^(Lost|Kaybedilen)$/)).toHaveText("1");
  await input.setInputFiles(file);
  await expect(
    there.getByText(/^(Games added: 0|Eklenen oyun: 0)$/),
  ).toBeVisible();
  await expect(stat(/^(Games|Oyun)$/)).toHaveText("1");
});

// O's page hidden (a phone locked) while X marks: what it sees on waking
// is kept as a gap, the whole game afresh, not as a move it saw made
test("a page that was hidden keeps what it missed as a gap", async ({
  browser,
}, info) => {
  const { x, o } = await twoPlayers(browser, info);
  const hidden = (page, value) =>
    page.evaluate((value) => {
      Object.defineProperty(document, "hidden", {
        value,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    }, value);
  // whether each step O's page kept of the game in play starts it afresh
  const afresh = async () =>
    o.evaluate(
      (id) =>
        new Promise((resolve) => {
          const req = indexedDB.open("stats");
          // not there yet: left for the page to make (made here, it would
          // be bare, the page's own open finding no stores to make)
          req.onupgradeneeded = () => req.transaction.abort();
          req.onerror = () => resolve(null);
          req.onsuccess = () => {
            const all = req.result
              .transaction("steps")
              .objectStore("steps")
              .getAll();
            all.onsuccess = () =>
              resolve(
                all.result
                  .filter((s) => s.game === id)
                  .map((s) => s.from === null),
              );
          };
        }),
      (await game(o)).id,
    );
  await expect.poll(afresh, NET).toEqual([true]);
  await hidden(o, true);
  await cell(x, 0).click();
  await expect.poll(async () => (await game(o)).cells[0], NET).toBe(0);
  await hidden(o, false);
  await cell(o, 4).click();
  await expect.poll(afresh, NET).toEqual([true, true, false]);
});

// a browser that keeps this site from storing anything: reading IndexedDB
// throws in some, opening it in others (Chrome, site data blocked); the
// game plays to its end all the same, and the stats say why there are none
for (const [how, refuse] of [
  [
    "reading it throws",
    () =>
      Object.defineProperty(window, "indexedDB", {
        get() {
          throw new DOMException("denied", "SecurityError");
        },
      }),
  ],
  [
    "opening it throws",
    () => {
      IDBFactory.prototype.open = () => {
        throw new DOMException("denied", "SecurityError");
      };
    },
  ],
]) {
  test(`storage refused (${how}): the game plays on, the stats say why there are none`, async ({
    browser,
  }, info) => {
    const { viewport, hasTouch, locale } = info.project.use;
    const context = await browser.newContext({ viewport, hasTouch, locale });
    await context.addInitScript(refuse);
    const page = await context.newPage();
    const at = room("ttt");
    await page.goto(`/${at}`);
    await page.evaluate((r) => sessionStorage.setItem("alone", r), at);
    await page.getByRole("textbox").fill("Ayşe");
    await page.getByRole("button", { name: /^(Go|Gir)$/ }).click();
    await pick(page, CLASSIC);
    await page
      .locator(".tb-plate")
      .getByRole("button", { name: SIT })
      .nth(1)
      .click();
    await bothSides(page, false);
    await expect.poll(() => game(page), NET).toBeTruthy();
    for (const i of [0, 3, 1, 4, 2]) await cell(page, i).click();
    await expect(page.locator(".tt-margin p")).toHaveText(WINS("X"));
    await stats(page);
    await expect(
      page.getByText(
        /^(This browser isn't keeping data for this site|Bu tarayıcı bu site için veri saklamıyor)/,
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^(Export|Dışa aktar)$/ }),
    ).toHaveCount(0);
  });
}
