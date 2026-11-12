import { expect, test } from "@playwright/test";

// Two players at the backgammon board, each in a browser of their own:
// labels in English (desktop) or Turkish (phones). Positions and dice are
// set through the dev-only window.backgammon.
import {
  BOTH,
  FACING,
  MENU,
  NET,
  NEXT,
  SIT,
  moving,
  room,
  sitDown as sit,
} from "./seats";

const LEFT = /^(Home on the left|Ev solda)$/;
const WINS = /^(Ayşe wins!|Ayşe kazandı!)/;

const game = (page) => page.evaluate(() => window.backgammon?.get());

// a page in `room`, named, its seat taken (0 white, 1 black)
const sitDown = (browser, info, room, name, seat) =>
  sit(browser, info, room, "backgammon", name, seat);

async function twoPlayers(browser, info) {
  const at = room("bg");
  const white = await sitDown(browser, info, at, "Ayşe", 0);
  const black = await sitDown(browser, info, at, "Bora", 1);
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
    const mid = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
    const bar = mid(await point(page, 25).boundingBox());
    const six = await point(page, 6).boundingBox();
    expect(mid(six).x).toBeGreaterThan(bar.x);
    expect(mid(six).y).toBeGreaterThan(bar.y);
    // the five checkers on that point are the page's own, once the board
    // has turned to the page's side as it sat down
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
  // black plays with their home on the left: the board the other way
  // round, the tray on the left too, kept on a reload
  await black.getByRole("button", { name: MENU }).click();
  await black.getByRole("checkbox", { name: LEFT }).check();
  await black.locator(".tb-menu .backdrop").click();
  await black.reload();
  const mid = async (n) => {
    const b = await point(black, n).boundingBox();
    return b.x + b.width / 2;
  };
  await expect.poll(() => mid(6)).toBeLessThan(await mid(25));
  expect(await mid(0)).toBeLessThan(await mid(6));
  expect(await mid(13)).toBeGreaterThan(await mid(25));
});

test("a reload shows the board as it is: nothing slides or is tossed", async ({
  browser,
}, info) => {
  const { black } = await twoPlayers(browser, info);
  await black.reload();
  // every frame for a while, as the room arrives and the board turns to
  // black's side: how many checkers and dice were moving
  const most = await moving(black, ".bg-checker, .bg-die, .bg-die *");
  expect(await game(black)).toBeTruthy();
  expect(most).toBe(0);
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
  // each page lists the other first, the points on each one's plate
  await expect(white.locator(".tb-points")).toHaveText(["0", "2"]);
  await expect(black.locator(".tb-points")).toHaveText(["2", "0"], NET);
  // no card: who won on the board, the dice lit to start the next game
  for (const page of [white, black]) {
    await expect(page.locator(".bg-status")).toContainText(WINS);
    await expect(page.locator(".bg-status .mars")).toHaveCount(1);
  }
  await black.getByRole("button", { name: NEXT }).click();
  await expect.poll(async () => (await game(white)).winner, NET).toBe(null);
  expect((await game(white)).score).toEqual([2, 0]);
});

test("one device plays both sides, taking turns", async ({ browser }, info) => {
  const page = await sitDown(browser, info, room("bg"), "Ayşe", 0);
  // the empty seat offers no Sit to someone seated: black's seat too is in
  // the menu, and the game starts on this page alone
  await expect(page.getByRole("button", { name: SIT })).toHaveCount(0);
  await page.getByRole("button", { name: MENU }).click();
  await page.getByRole("button", { name: BOTH }).click();
  await expect.poll(() => game(page), NET).toBeTruthy();
  await setUp(page, { 13: 1, 6: 14 }, { 13: 1, 6: 14 }, [3, 2]);
  // the two sit face to face: what's black's to read is turned to black,
  // white's isn't
  await page.getByRole("button", { name: MENU }).click();
  await page.getByRole("checkbox", { name: FACING }).check();
  await page.locator(".tb-menu .backdrop").click();
  await point(page, 13).click();
  await expect(page.locator(".bg-mark")).toHaveCount(3);
  await expect(page.locator(".bg-mark.over")).toHaveCount(0);
  await point(page, 8).click();
  // black to roll, here, by a tap on the dice; white's move can still be
  // taken back
  await expect(page.locator(".bg-throw")).toHaveCount(1);
  await expect(page.locator(".bg-undo")).toHaveCount(1);
  await page.evaluate(() => (window.backgammon.dice = [6, 5]));
  await page.locator(".bg-throw").click();
  // the board stays white's way round: black's 13 is white's 12, and
  // 6-5 takes it to black's 2, white's 23
  await point(page, 12).click();
  const marks = await page.locator(".bg-mark.over").allTextContents();
  expect(marks.sort()).toEqual(["11", "5", "6"]);
  await point(page, 23).click();
  const g = await game(page);
  expect(g.checkers[1][2]).toBe(1);
  expect(g.checkers[1][13]).toBe(0);
  expect(g.turn).toBe(0);
});
