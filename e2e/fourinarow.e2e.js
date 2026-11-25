import { expect, test } from "./test";
import {
  NET,
  NEXT,
  againstBot,
  bothSides,
  enter,
  room,
  sitDown,
} from "./seats";

// Four in a row at the table: two browsers, or one against the bot. Its
// state through the dev-only window.fourinarow.
const game = (page) => page.evaluate(() => window.fourinarow?.get());
const col = (page, n) => page.locator(`[data-col="${n}"]`);
const discs = async (page) =>
  (await game(page)).stones.filter((s) => s !== null).length;

test("four in a line wins: said and scoblack on both pages; the other starts the next", async ({
  browser,
}, info) => {
  const at = room("four");
  const black = await sitDown(browser, info, at, "fourinarow", "Ayşe", 0);
  const white = await sitDown(browser, info, at, "fourinarow", "Bora", 1);
  await expect.poll(() => game(black), NET).toBeTruthy();
  await expect.poll(() => game(white), NET).toBeTruthy();
  // black along the bottom, white on top of each
  for (const [k, c] of [0, 0, 1, 1, 2, 2, 3].entries()) {
    const [page, other] = k % 2 ? [white, black] : [black, white];
    const n = (await game(page)).last.n;
    await col(page, c).click();
    await expect.poll(async () => (await game(other)).last.n, NET).toBe(n + 1);
  }
  for (const page of [black, white]) {
    await expect.poll(async () => (await game(page)).winner?.seat, NET).toBe(0);
    await expect(page.locator(".fr-said")).toHaveText(/Ayşe/);
    await expect(page.locator(".fr-place.won")).toHaveCount(4);
  }
  await expect(black.locator(".tb-points")).toHaveText(["0", "1"]); // the far side first
  await white.getByRole("button", { name: NEXT }).click();
  await expect.poll(() => discs(black), NET).toBe(0);
  expect((await game(black)).turn).toBe(1);
});

test("a bot answers each disc", async ({ browser }, info) => {
  const page = await againstBot(browser, info, room("four"), "fourinarow");
  await expect.poll(async () => (await game(page))?.turn, NET).toBe(0);
  await col(page, 3).click();
  await expect.poll(() => discs(page)).toBe(2);
  expect((await game(page)).turn).toBe(0);
});

test("one device, face to face: the last disc taken back, a full column refused", async ({
  browser,
}, info) => {
  const page = await sitDown(
    browser,
    info,
    room("four"),
    "fourinarow",
    "Ayşe",
    0,
  );
  await bothSides(page, true);
  await expect.poll(() => game(page), NET).toBeTruthy();
  await col(page, 3).click();
  await col(page, 3).click();
  // white's, at white's side, turned to white
  await page.locator(".fr-side.over .fr-undo").click();
  expect(await discs(page)).toBe(1);
  expect((await game(page)).turn).toBe(1);
  await page.evaluate(() => {
    const g = window.fourinarow.get();
    // column 0 full, no four in it
    const stones = g.stones.map((s, i) =>
      i % 7 === 0 ? Math.floor(i / 14) % 2 : null,
    );
    window.fourinarow.set({ ...g, stones, turn: 0, back: null });
  });
  await col(page, 0).click();
  await expect(page.locator("[role=status]")).toHaveText(/full|dolu/);
  expect(await discs(page)).toBe(6);
});

test("? in the corner: how to play", async ({ browser }, info) => {
  const page = await enter(browser, info, room("four"), "fourinarow", "Ayşe");
  await page
    .getByRole("button", { name: /^(How to play|Nasıl oynanır)$/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText(/Four|dört/);
});
