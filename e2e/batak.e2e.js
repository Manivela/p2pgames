import { expect, test } from "./test";
import { BOT, MENU, NET, NEXT, SIT, enter, room } from "./seats";

// Batak at the table: a player in the first seat, bots in the other three,
// a deal played through. Its state through the dev-only window.batak.
const game = (page) => page.evaluate(() => window.batak?.get());
const PASS = /^(Pass|Pas)$/;
const SAVED = /^(Saved games|Kayıtlı oyunlar)$/;
const STATS = /^(Your stats|İstatistiklerin)$/;

async function withBots(browser, info) {
  const page = await enter(browser, info, room("batak"), "batak", "Ayşe");
  await page
    .locator('[data-seat="0"]')
    .getByRole("button", { name: SIT })
    .click();
  await page.evaluate(() => sessionStorage.setItem("botPace", "100"));
  for (const seat of [1, 2, 3]) {
    await page
      .locator(`[data-seat="${seat}"]`)
      .getByRole("button", { name: BOT })
      .click();
  }
  await expect.poll(() => game(page), NET).toBeTruthy();
  return page;
}

test("a deal with three bots: bid, trumps, every card legal, the score", async ({
  browser,
}, info) => {
  test.setTimeout(120000);
  const page = await withBots(browser, info);
  // 13 cards in your hand, none of the others'
  await expect(page.locator(".bk-hand .cd-card")).toHaveCount(13);
  for (let i = 0; i < 200; i++) {
    const s = await game(page);
    if (s.phase === "over") break;
    if (s.turn === 0) {
      if (s.phase === "bid") {
        const bids = page.locator(".bk-bids button");
        await expect(bids.first()).toBeVisible();
        // pass, or the least bid when it's yours to take
        const pass = page.locator(".bk-bids").getByRole("button", {
          name: PASS,
        });
        await ((await pass.count()) ? pass : bids.first()).click();
      } else if (s.phase === "trump") {
        await page.locator(".bk-bids.suits button").first().click();
      } else {
        const played = s.last.n;
        // a card it can't play says why, and stays
        const no = page.locator(".bk-hand .cd-card.no");
        if (await no.count()) {
          await no.first().click();
          await expect(page.getByRole("status")).toBeVisible();
          expect((await game(page)).last.n).toBe(played);
        }
        await page.locator(".bk-hand [data-legal]").first().click();
        await expect
          .poll(async () => (await game(page)).last.n)
          .not.toBe(played);
      }
    }
    await page.waitForTimeout(100);
  }
  const end = await game(page);
  expect(end.phase).toBe("over");
  expect(end.taken.reduce((a, b) => a + b)).toBe(13);
  // each plate's points, the deal's on it by the name
  await expect(page.locator(".tb-points")).toHaveText(end.score.map(String));
  await expect(page.locator(".bk-hand .cd-card")).toHaveCount(0);
  // the next deal, from the next dealer
  await page.getByRole("button", { name: NEXT }).click();
  await expect.poll(async () => (await game(page)).dealer, NET).toBe(1);
  await expect(page.locator(".bk-hand .cd-card")).toHaveCount(13);
  // the deal played, kept on the device (a second after): its four players
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: MENU }).click();
  await page.getByRole("button", { name: SAVED }).click();
  await expect(page.locator(".saves > li").first()).toContainText("Ayşe");
  await page.keyboard.press("Escape");
  // and in the stats, under Batak
  await page.getByRole("button", { name: /^(Menu|Menü)$/ }).click();
  await page.getByRole("button", { name: STATS }).click();
  await expect(
    page.locator(".dialog.stats h4", { hasText: /^Batak$/ }),
  ).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: /^(How to play|Nasıl oynanır)$/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Batak");
});

// one move for whoever's turn it is on `page`, seated at `seat`: a pass,
// or the least bid when it's theirs to take, trumps, or the first card it
// may play; the card played, if one was
async function move(page, seat) {
  const s = await game(page);
  if (s.turn !== seat) return null;
  if (s.phase === "bid") {
    const pass = page.locator(".bk-bids").getByRole("button", { name: PASS });
    await (
      (await pass.count()) ? pass : page.locator(".bk-bids button").first()
    ).click();
  } else if (s.phase === "trump") {
    await page.locator(".bk-bids.suits button").first().click();
  } else if (s.phase === "play") {
    const card = page.locator(".bk-hand [data-legal]").first();
    const played = Number(await card.getAttribute("data-card"));
    await card.click();
    return played;
  }
  await expect.poll(async () => (await game(page)).last.n).not.toBe(s.last.n);
  return null;
}

test("two at the table: each sees only their own hand, the other's card across", async ({
  browser,
}, info) => {
  test.setTimeout(120000);
  const at = room("batak");
  const a = await enter(browser, info, at, "batak", "Ayşe");
  await a.locator('[data-seat="0"]').getByRole("button", { name: SIT }).click();
  const b = await enter(browser, info, at, "batak", "Bora");
  await b.locator('[data-seat="2"]').getByRole("button", { name: SIT }).click();
  await a.evaluate(() => sessionStorage.setItem("botPace", "100"));
  for (const seat of [1, 3]) {
    await a
      .locator(`[data-seat="${seat}"]`)
      .getByRole("button", { name: BOT })
      .click();
  }
  await expect.poll(() => game(a), NET).toBeTruthy();
  await expect.poll(() => game(b), NET).toBeTruthy();
  const shown = (page) =>
    page
      .locator(".bk-hand .cd-card")
      .evaluateAll((els) => els.map((el) => Number(el.dataset.card)));
  // the seat's hand as the game has it now: both pages deal the first hand
  // as the table fills, and one of the two deals wins
  const own = async (page, seat) =>
    JSON.stringify(await shown(page)) ===
    JSON.stringify((await game(page)).hands[seat]);
  await expect.poll(() => own(a, 0), NET).toBe(true);
  await expect.poll(() => own(b, 2), NET).toBe(true);
  expect(await shown(a)).not.toEqual(await shown(b));
  // played on till Ayşe plays a card Bora has still to answer: it lies at
  // the top of his table, across from him
  for (let i = 0; i < 300; i++) {
    const s = await game(a);
    const early = s.phase === "play" && s.turn === 0 && s.trick.length <= 1;
    const played = await move(a, 0);
    if (early && played !== null) {
      await expect(
        b.locator(`.bk-trick .at-top[data-card="${played}"]`),
      ).toHaveCount(1, NET);
      return;
    }
    await move(b, 2);
    await a.waitForTimeout(100);
  }
  throw new Error("Ayşe never led or followed early in a trick");
});
