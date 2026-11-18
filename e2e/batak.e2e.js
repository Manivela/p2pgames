import { expect, test } from "./test";
import {
  BOT,
  MENU,
  NET,
  NEXT,
  SIT,
  START,
  WAIT_ALL,
  enter,
  room,
  settings,
} from "./seats";

// Batak at the table: a player in the first seat, bots in the other three,
// a deal played through. Its state through the dev-only window.batak.
const game = (page) => page.evaluate(() => window.batak?.get());
const PASS = /^(Pass|Pas)$/;
const DEAL = /^(Deal|Dağıt)$/;
const SAVED = /^(Saved games|Kayıtlı oyunlar)$/;
const STATS = /^(Your stats|İstatistiklerin)$/;

// the table full, waiting for its Start; the match's length (`deals`)
// picked in the settings first, if given, then started
async function withBots(browser, info, deals) {
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
  // nothing dealt till someone starts it
  await expect(page.getByRole("button", { name: START })).toBeVisible();
  expect(await game(page)).toBeFalsy();
  if (deals) {
    await settings(page);
    await page.locator(".dialog select").selectOption(deals);
    await page.keyboard.press("Escape");
  }
  await page.getByRole("button", { name: START }).click();
  await expect.poll(() => game(page), NET).toBeTruthy();
  return page;
}

// Ayşe's turns till the match has played `deals` deals: a pass, or the
// least bid when it's hers to take, trumps, or a card; one she can't play
// says why first, and one goes by its key (`keyed` holds the card)
async function playTo(page, deals, keyed) {
  for (let i = 0; i < 400; i++) {
    const s = await game(page);
    if ((s.rows?.length ?? 0) >= deals) return;
    if (s.turn === 0 && s.phase === "bid") {
      const bids = page.locator(".bk-bids button");
      await expect(bids.first()).toBeVisible();
      const pass = page.locator(".bk-bids").getByRole("button", {
        name: PASS,
      });
      await ((await pass.count()) ? pass : bids.first()).click();
    } else if (s.turn === 0 && s.phase === "trump") {
      await page.locator(".bk-bids.suits button").first().click();
    } else if (s.turn === 0 && s.phase === "play") {
      const played = s.last.n;
      // a card it can't play says why, and stays
      const no = page.locator(".bk-hand .cd-card.no");
      if (await no.count()) {
        await no.first().click();
        await expect(page.getByRole("status")).toBeVisible();
        expect((await game(page)).last.n).toBe(played);
      }
      // a card by its key once, 1 the first you can play; tapped after
      const first = page.locator(".bk-hand [data-legal]").first();
      if (!keyed.card) {
        keyed.card = Number(await first.getAttribute("data-card"));
        await page.keyboard.press("1");
        await expect
          .poll(async () => (await game(page)).last.card)
          .toBe(keyed.card);
      } else await first.click();
      await expect.poll(async () => (await game(page)).last.n).not.toBe(played);
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`${deals} deals not played`);
}

test("a match with three bots: its length, every card legal, the sheet, the winner", async ({
  browser,
}, info) => {
  test.setTimeout(180000);
  // the match's length, picked in the settings before its Start
  const page = await withBots(browser, info, "4");
  expect((await game(page)).deals).toBe(4);
  // 13 cards in your hand, none of the others'
  await expect(page.locator(".bk-hand .cd-card")).toHaveCount(13);
  const keyed = {};
  await playTo(page, 1, keyed);
  // the deal's points on the sheet and by each name; then the next seat,
  // a bot, deals the next deal by itself
  const one = await game(page);
  expect(one.rows[0].points).toEqual(one.score);
  // a short clap for a bid made, none for one gone down
  const clapped = () => page.evaluate(() => window.tableClaps ?? 0);
  const made = (r) => (r.points[r.bidder] > 0 ? 1 : 0);
  await expect.poll(clapped).toBe(made(one.rows[0]));
  await expect(page.locator(".tb-points")).toHaveText(one.score.map(String));
  // the next seat's deal: a bot's by itself, or Ayşe's tap
  const dealer = (one.rows[0].dealer + 1) % 4;
  if (dealer === 0) {
    await page.getByRole("button", { name: /^(Deal|Dağıt)$/ }).click();
  }
  await expect
    .poll(async () => {
      const s = await game(page);
      return [s.round, s.dealer];
    }, NET)
    .toEqual([2, dealer]);
  await expect(page.locator(".bk-hand .cd-card")).toHaveCount(13);
  // shortened: this deal the match's last
  await page.evaluate(() =>
    window.batak.set({ ...window.batak.get(), deals: 2 }),
  );
  await playTo(page, 2, keyed);
  const end = await game(page);
  expect(end.turn).toBeNull();
  const top = Math.max(...end.score);
  expect(end.winners).toEqual([0, 1, 2, 3].filter((s) => end.score[s] === top));
  await expect(page.locator(".bk-won")).toHaveText(/(wins!|kazandı!)$/);
  // the match's applause, and no clap of its own for its last deal
  await expect.poll(() => page.evaluate(() => window.tableApplause)).toBe(1);
  expect(await clapped()).toBe(made(one.rows[0]));
  // the last trick lies a moment, the card that took it lit, then slides
  // to its taker and is gone
  const gathered = page.locator(".bk-trick .cd-card.gather");
  await expect(gathered).toHaveCount(4);
  await expect(page.locator(".bk-trick .took")).toHaveCount(1);
  await expect
    .poll(() =>
      gathered.evaluateAll((els) =>
        els.map((el) => getComputedStyle(el).opacity),
      ),
    )
    .toEqual(["0", "0", "0", "0"], NET);
  await expect(page.locator(".bk-hand .cd-card")).toHaveCount(0);
  // the sheet: a row a deal, the totals the plates'
  await page.locator(".tb-scores summary").click();
  await expect(page.locator(".tb-scores tbody tr")).toHaveCount(2);
  await expect(page.locator(".tb-scores tfoot td")).toHaveText(
    end.score.map(String),
  );
  await page.keyboard.press("Escape");
  // a new match: back to waiting for its Start, then from nothing
  await page.getByRole("button", { name: NEXT }).click();
  await expect.poll(() => game(page), NET).toBeFalsy();
  await page.getByRole("button", { name: START }).click();
  await expect
    .poll(async () => {
      const s = await game(page);
      return [s.round, s.score];
    }, NET)
    .toEqual([1, [0, 0, 0, 0]]);
  await expect(page.locator(".bk-hand .cd-card")).toHaveCount(13);
  // the match played, kept on the device (a second after): its players
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: MENU }).click();
  await page.getByRole("button", { name: SAVED }).click();
  await expect(page.locator(".saves > li").first()).toContainText("Ayşe");
  await page.keyboard.press("Escape");
  // and in the stats, under Batak; the cards' sounds credited
  await page.getByRole("button", { name: /^(Menu|Menü)$/ }).click();
  await expect(page.locator(".site-menu footer")).toContainText("Kenney");
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

// The room waits for everyone (⋯ → Settings): a hand's end waits for its
// players' Deal, a bot due to deal never dealing by itself; switched off,
// the bot deals as before.
test("a hand's end waits for the players' Deal, and a bot deals once it's off", async ({
  browser,
}, info) => {
  test.setTimeout(180000);
  const page = await withBots(browser, info);
  await settings(page);
  await page.getByRole("checkbox", { name: WAIT_ALL }).check();
  await page.keyboard.press("Escape");
  const keyed = {};
  // the next deal a bot's, the one after Ayşe
  const toBot = () =>
    page.evaluate(() => window.batak.set({ ...window.batak.get(), turn: 1 }));
  const over = () =>
    expect.poll(async () => (await game(page)).phase, NET).toBe("over");
  await playTo(page, 1, keyed);
  await over();
  await toBot();
  // not dealt by itself, the bot's pace long past
  await page.waitForTimeout(1500);
  expect((await game(page)).round).toBe(1);
  // Ayşe's Deal, the one player's: dealt, from the bot's seat
  await page.getByRole("button", { name: DEAL }).click();
  await expect
    .poll(async () => {
      const s = await game(page);
      return [s.round, s.dealer];
    }, NET)
    .toEqual([2, 1]);
  // the next hand's end, waiting switched off: the bot deals by itself
  await playTo(page, 2, keyed);
  await over();
  await toBot();
  await page.waitForTimeout(1500);
  expect((await game(page)).round).toBe(2);
  await settings(page);
  await page.getByRole("checkbox", { name: WAIT_ALL }).uncheck();
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await game(page)).round, NET).toBe(3);
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
  // the full table waits for a Start, either player's: Bora's deals it,
  // and the deal both see first is the one that stays
  await b.getByRole("button", { name: START }).click();
  await expect.poll(() => game(a), NET).toBeTruthy();
  await expect.poll(() => game(b), NET).toBeTruthy();
  const { id } = await game(a);
  expect((await game(b)).id).toBe(id);
  const shown = (page) =>
    page
      .locator(".bk-hand .cd-card")
      .evaluateAll((els) => els.map((el) => Number(el.dataset.card)));
  // the seat's hand as the game has it now
  const own = async (page, seat) =>
    JSON.stringify(await shown(page)) ===
    JSON.stringify((await game(page)).hands[seat]);
  await expect.poll(() => own(a, 0), NET).toBe(true);
  await expect.poll(() => own(b, 2), NET).toBe(true);
  expect(await shown(a)).not.toEqual(await shown(b));
  expect((await game(a)).id).toBe(id);
  expect((await game(b)).id).toBe(id);
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
