import { expect, test } from "@playwright/test";
import { NET, NEXT, bothSides, moving, room, sitDown } from "./seats";

// Go at the table: two browsers, or one device playing both sides. Its
// state through the dev-only window.go.
const PASS = /^(Pass|Pas)$/;
const game = (page) => page.evaluate(() => window.go?.get());
const point = (page, row, col) => page.locator(`[data-at="${row * 9 + col}"]`);
const stones = async (page) =>
  (await game(page)).stones.filter((s) => s !== null).length;

async function twoPlayers(browser, info) {
  const at = room("go");
  const black = await sitDown(browser, info, at, "go", "Ayşe", 0);
  const white = await sitDown(browser, info, at, "go", "Bora", 1);
  await expect.poll(() => game(black), NET).toBeTruthy();
  await expect.poll(() => game(white), NET).toBeTruthy();
  return { black, white };
}

// stones put in turn, each seen on the other page
async function moves(black, white, ...list) {
  for (const [i, [row, col]] of list.entries()) {
    const [page, other] = i % 2 ? [white, black] : [black, white];
    const n = (await game(page)).last.n;
    await point(page, row, col).click();
    await expect.poll(async () => (await game(other)).last.n, NET).toBe(n + 1);
  }
}

test("a capture, a ko refused, two passes: counted on both pages", async ({
  browser,
}, info) => {
  const { black, white } = await twoPlayers(browser, info);
  // black takes white's (1,1) with (1,2): the ko shape
  await moves(
    black,
    white,
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 1],
    [2, 1],
    [2, 2],
    [8, 8],
    [1, 3],
    [1, 2],
  );
  expect((await game(white)).taken).toEqual([1, 0]);
  await expect(white.locator(".go-stone.going, .go-stone")).not.toHaveCount(0);
  // retaking at once is refused, said to white
  await point(white, 1, 1).click();
  await expect(white.locator("[role=status]")).toHaveText(/Ko/);
  expect(await stones(white)).toBe(8);
  // two passes: over, white ahead by komi and more
  await white.getByRole("button", { name: PASS }).click();
  await expect(black.locator(".go-own")).not.toHaveCount(0, NET);
  await black.getByRole("button", { name: PASS }).click();
  for (const page of [black, white]) {
    await expect.poll(async () => (await game(page)).winner, NET).toBeTruthy();
    await expect(page.locator(".go-said")).toHaveCount(1);
  }
  const { winner, area } = await game(black);
  expect(area[1] - area[0]).toBe(winner.seat ? winner.by : -winner.by);
  const points = winner.seat ? ["1", "0"] : ["0", "1"];
  await expect(black.locator(".tb-points")).toHaveText(points);
  await white.getByRole("button", { name: NEXT }).click();
  await expect.poll(() => stones(black), NET).toBe(0);
});

test("a reload shows the board as it is: no stone coming down", async ({
  browser,
}, info) => {
  const { black, white } = await twoPlayers(browser, info);
  await moves(black, white, [4, 4], [4, 5]);
  await white.reload();
  const most = await moving(white, ".go-stone");
  await expect(white.locator(".go-stone")).toHaveCount(2, NET);
  expect(most).toBe(0);
});

test("one device, face to face: a word to each, the far side turned", async ({
  browser,
}, info) => {
  const page = await sitDown(browser, info, room("go"), "go", "Ayşe", 0);
  await bothSides(page, true);
  await expect.poll(() => game(page), NET).toBeTruthy();
  await point(page, 4, 4).click();
  // white's turn: white's bowl passes, on white's side, turned to white
  await expect(page.locator(".go-side.far.over")).toHaveCount(1);
  await expect(page.locator(".go-side.far button.go-bowl")).toHaveCount(1);
  await page.getByRole("button", { name: PASS }).click();
  await expect(page.locator(".go-said")).toHaveCount(2);
  // white takes the pass back, at white's side
  await page.locator(".go-side.far .tb-undo").click();
  expect((await game(page)).passes).toBe(0);
});

test("a 13×13 board, picked beside the bowl", async ({ browser }, info) => {
  const page = await sitDown(browser, info, room("go"), "go", "Ayşe", 0);
  await bothSides(page, false);
  await expect.poll(() => game(page), NET).toBeTruthy();
  await page.getByRole("button", { name: "13×13" }).click();
  await expect.poll(async () => (await game(page)).stones.length).toBe(169);
  await expect(page.locator(".go-point")).toHaveCount(169);
  // the far corner, on the bigger board
  await page.locator('[data-at="168"]').click();
  expect((await game(page)).stones[168]).toBe(0);
});
