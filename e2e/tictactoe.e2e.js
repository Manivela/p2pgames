import { expect, test } from "@playwright/test";
import { NET, NEXT, bothSides, moving, room, sitDown } from "./seats";

// Tic-tac-toe at the table: two browsers, or one device playing both
// sides. Its state through the dev-only window.tictactoe.
const WINS = (name) => new RegExp(`^${name} (wins!|kazandı!)$`);
const game = (page) => page.evaluate(() => window.tictactoe?.get());
const cell = (page, i) => page.locator(`[data-cell="${i}"]`);
const SUPER = /^(Super|Süper)$/;

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

test("Super, picked on the sheet: sent to a board, a board taken", async ({
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
  await page.getByRole("button", { name: SUPER }).click();
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
  // a game in play: no modes to pick
  await expect(page.locator(".tb-modes")).toHaveCount(0);
});

test("Super picked before the other sits: both sheets Super", async ({
  browser,
}, info) => {
  const at = room("ttt");
  const x = await sitDown(browser, info, at, "tictactoe", "Ayşe", 0);
  await x.getByRole("button", { name: SUPER }).click();
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
