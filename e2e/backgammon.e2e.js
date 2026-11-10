import { expect, test } from "@playwright/test";

// Two players at the backgammon board, each in a browser of their own:
// labels in English (desktop) or Turkish (phones). Positions and dice are
// set through the dev-only window.backgammon.
const SIT = /^(Sit|Otur)$/;
const NEXT = /^(Next game|Sonraki oyun)$/;
const NET = { timeout: 15000 };

const game = (page) => page.evaluate(() => window.backgammon?.get());

// a page in a fresh room, named, its seat taken (0 white, 1 black)
async function sitDown(browser, info, room, name, seat) {
  const { viewport, hasTouch, locale } = info.project.use;
  const context = await browser.newContext({ viewport, hasTouch, locale });
  const page = await context.newPage();
  await page.goto(`/${room}/backgammon`);
  await page.getByRole("textbox").fill(name);
  await page.getByRole("button", { name: /^(Go|Gir)$/ }).click();
  const sit = page.locator(".bg-plate").getByRole("button", { name: SIT });
  // the other's seat may arrive over the network after the page: the
  // board lists the far seat first, white for a page that hasn't sat
  await sit.nth(seat ? 0 : 1).click();
  return page;
}

async function twoPlayers(browser, info) {
  const room = `e2e-bg-${Math.random().toString(36).slice(2, 10)}`;
  const white = await sitDown(browser, info, room, "Ayşe", 0);
  const black = await sitDown(browser, info, room, "Bora", 1);
  await expect.poll(() => game(white), NET).toBeTruthy();
  return { white, black };
}

// a position: white (seat 0) to play `dice`, each seat's checkers by point
async function setUp(page, white, black, dice) {
  await page.evaluate(
    ([white, black, dice]) => {
      const seat = (points) => {
        const s = Array(26).fill(0);
        for (const [n, c] of Object.entries(points)) s[n] = c;
        return s;
      };
      const g = window.backgammon.get();
      window.backgammon.set({
        ...g,
        checkers: [seat(white), seat(black)],
        turn: 0,
        by: 0,
        dice,
        left: dice,
        undo: [],
        opening: null,
        winner: null,
      });
    },
    [white, black, dice],
  );
}

const point = (page, n) => page.locator(`[data-pos="${n}"]`).first();

test("each player sees their own home bottom right", async ({
  browser,
}, info) => {
  const { white, black } = await twoPlayers(browser, info);
  for (const [page, color] of [
    [white, "white"],
    [black, "black"],
  ]) {
    // right of the bar, below the middle
    const bar = await point(page, 25).boundingBox();
    const six = await point(page, 6).boundingBox();
    expect(six.x).toBeGreaterThanOrEqual(bar.x + bar.width);
    expect(six.y).toBeGreaterThan(bar.y + bar.height / 2);
    // the five checkers on that point are the page's own, once they've
    // slid round as the page sat down
    const there = () =>
      page.locator(`.bg-checker.${color}`).evaluateAll(
        (els, r) =>
          els.filter((el) => {
            const b = el.getBoundingClientRect();
            const x = b.x + b.width / 2;
            const y = b.y + b.height / 2;
            return (
              x > r.x && x < r.x + r.width && y > r.y && y < r.y + r.height
            );
          }).length,
        six,
      );
    await expect.poll(there).toBe(5);
  }
});

test("3-2 also offers 5, played in one go, seen by the other", async ({
  browser,
}, info) => {
  const { white, black } = await twoPlayers(browser, info);
  await setUp(white, { 13: 1, 6: 14 }, { 24: 15 }, [3, 2]);
  await point(white, 13).click();
  const marks = await white.locator(".bg-mark").allTextContents();
  expect(marks.sort()).toEqual(["2", "3", "5"]);
  await point(white, 8).click();
  await expect.poll(async () => (await game(black)).checkers[0][8]).toBe(1);
  expect((await game(black)).turn).toBe(1);
  // only the one who played takes it back, till the other rolls
  await expect(white.locator(".bg-undo")).toHaveCount(1);
  await expect(black.locator(".bg-undo")).toHaveCount(0);
});

test("bearing off the last checker: mars, 2-0 on both pages", async ({
  browser,
}, info) => {
  const { white, black } = await twoPlayers(browser, info);
  await setUp(white, { 1: 1, 0: 14 }, { 19: 15 }, [1, 2]);
  await point(white, 1).click();
  await point(white, 0).click();
  // each page lists the other first: Bora 0 – 2 Ayşe, Ayşe 2 – 0 Bora
  await expect(white.locator(".bg-score")).toHaveText("0–2");
  await expect(black.locator(".bg-score")).toHaveText("2–0", NET);
  await black.getByRole("button", { name: NEXT }).click();
  await expect.poll(async () => (await game(white)).winner, NET).toBe(null);
  expect((await game(white)).score).toEqual([2, 0]);
});
