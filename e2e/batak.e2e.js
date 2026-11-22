import { expect, test } from "./test";
import {
  BOT,
  MENU,
  NET,
  NEXT,
  SIT,
  START,
  WAIT_ALL,
  CHECK,
  BACK,
  enter,
  room,
  settings,
} from "./seats";

// Batak at the table: a player in the first seat, bots in the other three,
// a deal played through. Its state through the dev-only window.batak.
const game = (page) => page.evaluate(() => window.batak?.get());
const PASS = /^(Pass|Pas)$/;
const NEW_GAME = /^(New Game|Yeni oyun)$/;
const DEAL = /^(Deal|Dağıt)$/;
const END_GAME = /^(End the game|Oyunu bitir)$/;
const ENDING =
  /^(The game ends after this deal|Oyun bu dağıtımdan sonra bitiyor)$/;
const SAVED = /^(Saved games|Kayıtlı oyunlar)$/;
const DEALS = { name: /^(Deals|Dağıtım sayısı)/ };
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
    await page.getByRole("combobox", DEALS).selectOption(deals);
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

// An endless match (∞ in the settings): no length, so the sheet has only
// the deals played and the one being played.
test("an endless match: picked as ∞, its sheet only what's been dealt", async ({
  browser,
}, info) => {
  const page = await withBots(browser, info, "0");
  expect((await game(page)).deals).toBe(0);
  await page.locator(".tb-scores summary").click();
  await expect(page.locator(".tb-scores tbody tr")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await settings(page);
  await expect(
    page.getByRole("combobox", DEALS).locator("option:checked"),
  ).toHaveText("∞");
  await page.keyboard.press("Escape");
  const row = { dealer: 3, bidder: 1, contract: 5, trump: 0 };
  const played = {
    rows: [{ ...row, points: [1, 6, 3, 3] }],
    score: [1, 6, 3, 3],
  };
  const end = async () => {
    await page.getByRole("button", { name: MENU }).click();
    await page.getByRole("button", { name: END_GAME }).click();
    await page.locator(".tb-menu button.armed").click();
  };
  // a deal played, the next one bid in, Ayşe's to bid (the bots' passed):
  // ended from ⋯, it plays on to its end, said at the table, End gone
  await page.evaluate(
    (p) =>
      window.batak.set({
        ...window.batak.get(),
        ...p,
        bids: [null, 0, 0, 0],
        turn: 0,
      }),
    played,
  );
  await end();
  await expect(page.getByText(ENDING)).toBeVisible();
  expect((await game(page)).ending).toBe(true);
  expect((await game(page)).winners).toBeNull();
  await page.getByRole("button", { name: MENU }).click();
  await expect(page.getByRole("button", { name: END_GAME })).toHaveCount(0);
  await page.keyboard.press("Escape");
  // between deals, seat 1's lead, Ayşe's to deal next (a bot's would deal
  // by itself): ended from ⋯ at once, seat 1 wins it
  await page.evaluate(
    (p) =>
      window.batak.set({
        ...window.batak.get(),
        ...p,
        ending: false,
        phase: "over",
        turn: 0,
        points: [1, 6, 3, 3],
      }),
    played,
  );
  await end();
  await expect(page.locator(".bk-won")).toHaveText(/^Bot (wins!|kazandı!)$/);
  expect((await game(page)).winners).toEqual([1]);
  await expect(page.getByRole("button", { name: NEXT })).toBeVisible();
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
  await page.getByRole("combobox", { name: WAIT_ALL }).selectOption("all");
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
  await page.getByRole("combobox", { name: WAIT_ALL }).selectOption("off");
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await game(page)).round, NET).toBe(3);
});

// A ready check after a break (⋯): a bot's turn waits too, its pace long
// past, till both players have pressed Ready; then it plays on.
test("a ready check holds a bot's turn till both players are back", async ({
  browser,
}, info) => {
  const at = room("batak");
  const page = await enter(browser, info, at, "batak", "Ayşe");
  await page
    .locator('[data-seat="0"]')
    .getByRole("button", { name: SIT })
    .click();
  await page.evaluate(() => sessionStorage.setItem("botPace", "100"));
  const bora = await enter(browser, info, at, "batak", "Bora");
  await bora
    .locator('[data-seat="1"]')
    .getByRole("button", { name: SIT })
    .click();
  for (const seat of [2, 3]) {
    await page
      .locator(`[data-seat="${seat}"]`)
      .getByRole("button", { name: BOT })
      .click();
  }
  await page.getByRole("button", { name: START }).click();
  await expect.poll(() => game(bora), NET).toBeTruthy();
  await page.getByRole("button", { name: MENU }).click();
  await page.getByRole("button", { name: CHECK }).click();
  await expect(bora.locator(".ready-plate")).toHaveCount(1, NET);
  // Bora's plate says whom it waits for, above his hand
  await expect(bora.locator(".ready-waiting")).toHaveText("Ayşe");
  const plate = await bora.locator(".ready-plate").boundingBox();
  const hand = await bora.locator(".bk-hand").boundingBox();
  expect(plate.y + plate.height).toBeLessThanOrEqual(hand.y);
  // a bot's turn: it waits
  await page.evaluate(() =>
    window.batak.set({ ...window.batak.get(), turn: 2 }),
  );
  await page.waitForTimeout(1500);
  const { last, turn } = await game(page);
  expect(turn).toBe(2);
  // both back: it plays
  for (const p of [page, bora]) {
    await p.getByRole("button", { name: BACK }).click();
  }
  await expect
    .poll(async () => (await game(page)).last.n, NET)
    .not.toBe(last.n);
  // a check outlives ⋯ → New Game: back to waiting, its Start held till
  // both are back
  await page.getByRole("button", { name: MENU }).click();
  await page.getByRole("button", { name: CHECK }).click();
  await expect(bora.locator(".ready-plate")).toHaveCount(1, NET);
  await page.getByRole("button", { name: MENU }).click();
  await page.getByRole("button", { name: NEW_GAME }).click();
  await page.locator(".tb-menu button.armed").click();
  await expect.poll(() => game(bora), NET).toBeFalsy();
  await expect(bora.locator(".ready-plate")).toHaveCount(1);
  await expect(page.getByRole("button", { name: START })).toHaveCount(0);
  for (const p of [page, bora]) {
    await p.getByRole("button", { name: BACK }).click();
  }
  await expect(page.getByRole("button", { name: START })).toBeVisible(NET);
});

// A deal's end, the room not waiting for everyone: Deal is any player's,
// not only the next dealer's, and deals from the dealer's seat.
test("any player deals the next deal, from its dealer's seat", async ({
  browser,
}, info) => {
  const at = room("batak");
  const page = await enter(browser, info, at, "batak", "Ayşe");
  await page
    .locator('[data-seat="0"]')
    .getByRole("button", { name: SIT })
    .click();
  const bora = await enter(browser, info, at, "batak", "Bora");
  await bora
    .locator('[data-seat="1"]')
    .getByRole("button", { name: SIT })
    .click();
  for (const seat of [2, 3]) {
    await page
      .locator(`[data-seat="${seat}"]`)
      .getByRole("button", { name: BOT })
      .click();
  }
  await page.getByRole("button", { name: START }).click();
  await expect.poll(() => game(bora), NET).toBeTruthy();
  // the deal over, Bora's to deal next
  await page.evaluate(() =>
    window.batak.set({
      ...window.batak.get(),
      phase: "over",
      turn: 1,
      points: [0, 0, 0, 0],
    }),
  );
  await expect(bora.getByRole("button", { name: DEAL })).toBeVisible(NET);
  await page.getByRole("button", { name: DEAL }).click();
  await expect
    .poll(async () => {
      const s = await game(bora);
      return [s.round, s.dealer];
    }, NET)
    .toEqual([2, 1]);
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
