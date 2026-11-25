import { expect, test } from "./test";
import { NET, NEXT, againstBot, enter, room, sitDown } from "./seats";

// Five in a row at the table, on Go's board: two browsers, or one against
// the bot. Its state through the dev-only window.gomoku.
const game = (page) => page.evaluate(() => window.gomoku?.get());
const point = (page, row, col) => page.locator(`[data-at="${row * 15 + col}"]`);
const stones = async (page) =>
  (await game(page)).stones.filter((s) => s !== null).length;

test("five in a line wins: said and scored on both pages, then a new game", async ({
  browser,
}, info) => {
  const at = room("gomoku");
  const black = await sitDown(browser, info, at, "gomoku", "Ayşe", 0);
  const white = await sitDown(browser, info, at, "gomoku", "Bora", 1);
  await expect.poll(() => game(black), NET).toBeTruthy();
  await expect.poll(() => game(white), NET).toBeTruthy();
  // no bowl to pass at
  await expect(black.locator("button.go-bowl")).toHaveCount(0);
  // black along row 7, white along row 9
  for (let k = 0; k < 5; k++) {
    for (const [page, other, row] of [
      [black, white, 7],
      [white, black, 9],
    ]) {
      if (k === 4 && page === white) break;
      const n = (await game(page)).last.n;
      await point(page, row, 3 + k).click();
      await expect
        .poll(async () => (await game(other)).last.n, NET)
        .toBe(n + 1);
    }
  }
  for (const page of [black, white]) {
    await expect.poll(async () => (await game(page)).winner?.seat, NET).toBe(0);
    await expect(page.locator(".go-said")).toHaveText(/Ayşe/);
    await expect(page.locator(".go-stone.last")).toHaveCount(5);
    await expect(page.locator(".go-own")).toHaveCount(0);
  }
  await expect(black.locator(".tb-points")).toHaveText(["0", "1"]); // the far side first
  await white.getByRole("button", { name: NEXT }).click();
  await expect.poll(() => stones(black), NET).toBe(0);
});

test("a bot answers each stone", async ({ browser }, info) => {
  const page = await againstBot(browser, info, room("gomoku"), "gomoku");
  await expect.poll(async () => (await game(page))?.turn, NET).toBe(0);
  await point(page, 7, 7).click();
  await expect.poll(() => stones(page)).toBe(2);
  expect((await game(page)).turn).toBe(0);
});

test("? in the corner: how to play", async ({ browser }, info) => {
  const page = await enter(browser, info, room("gomoku"), "gomoku", "Ayşe");
  await page
    .getByRole("button", { name: /^(How to play|Nasıl oynanır)$/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText("15×15");
});
