import { expect, test } from "@playwright/test";

// Labels in English (desktop) or Turkish (phones)
const GO = /^(Go|Gir)$/;
const SIT = /^(Sit|Otur)$/;
const MENU = /^(Table menu|Masa menüsü)$/;
// the lobby's rules, their settings, and Start
const RULES = /^(Rules|Kurallar)$/;
const SETTINGS = /^(Game settings|Oyun ayarları)$/;
const START = /^(Start|Başlat)$/;
const RESET = /^(Reset Game|Oyunu sıfırla)$/;
const SAVED = /^(Saved games|Kayıtlı oyunlar)$/;
const CLOSE = /^(Close|Kapat)$/;
const PASTE = /Paste a save code|Kayıt kodunu yapıştır/;
const LOAD = /^(Load this game|Bu oyunu yükle)$/;
const NEXT = /^(Next Round|Sonraki el)$/;
const SHUFFLE = /^(Shuffle and play on|Karıştır, devam et)$/;
const END = /^(End the round|Eli bitir)$/;
const NEW_GAME = /^(New Game|Yeni oyun)$/;
const REDEAL = /^(Deal this round again|Bu eli yeniden dağıt)$/;
const OPEN = /^(Open your hand|El aç)$/;
const UPDATE = /^(Update to the new version|Yeni sürüme geç)$/;
const SOUND = /^(Sound|Ses)$/;
const FIND = /^(Find and open|Bul ve aç)$/;
const LAY = /^(Lay melds|Per aç)$/;
const FREE = (name) => new RegExp(`^(Free seat|Yeri boşalt): ${name}$`);
const STAND = /^(Stand|Kalk)$/;
const LEAVE = /^(Leave the round|Elden çekil)$/;
const SIT_IN = /^(Sit down in this round|Bu ele otur)$/;

// a helper from e2e/table.js, run in the page
const table = (page, name, ...args) =>
  page.evaluate(
    async ([name, args]) => (await import("/e2e/table.js"))[name](...args),
    [name, args],
  );
const state = (page) => page.evaluate(() => window.okey.get());
const handIds = async (page) =>
  (await state(page)).players[0].hand.map((t) => t?.id ?? null);

const sitInSeat1 = (page) =>
  page
    .locator(".playerName", { hasText: /(Player|Oyuncu) 1(?!\d)/ })
    .getByRole("button", { name: SIT })
    .click();
// seated in seat 1, as a page joining a table sits down by itself
const inSeat1 = (page, name = "Ayşe") =>
  expect
    .poll(() => page.evaluate(() => window.okey?.get()?.players[0].user?.name))
    .toBe(name);

// a page in another browser first reaching the room: over the network,
// about a second, longer under load
const NET = { timeout: 15000 };
// the game has reached a page in another browser: what it does before then
// is lost to the table's
const arrived = (page) =>
  expect
    .poll(() => page.evaluate(() => !!window.okey?.get()?.players[0].user), NET)
    .toBe(true);

// what the table does rather than what fits: small-phone differs from phone
// only in size, so phone (touch, Turkish) and desktop (mouse, English) cover it
const anySize = (info) =>
  test.skip(info.project.name === "small-phone", "not about the size");

// a fresh room each time: rooms with the same name sync, through the e2e
// signaling server (playwright.config.js) or the live one.
// A page asked for a name as it first loads (a reload keeps the login); the
// first in a new room taps Sit, one joining a table sits down by itself
// unless `sit: false` (it only watches). A browser is one player
// (useStore.js): another player is a browser context of its own.
async function sitDown(page, { name = "Ayşe", room, sit = true } = {}) {
  room ??= `e2e-${Math.random().toString(36).slice(2, 10)}`;
  await page.addInitScript((watch) => {
    if (watch) sessionStorage.setItem("watch", "1");
    if (sessionStorage.getItem("asked")) return;
    sessionStorage.setItem("asked", "1");
    localStorage.removeItem("user");
  }, !sit);
  await page.goto(`/${room}/okey`);
  await page.getByRole("textbox").fill(name);
  await page.getByRole("button", { name: GO }).click();
  if (sit) await sitInSeat1(page);
  return room;
}

// my rack's slot i (13 to a row)
const slot = (page, i) =>
  page
    .locator(".rack:not(.mini)")
    .first()
    .locator(i < 13 ? ".top" : ".bottom")
    .locator(":scope > *")
    .nth(i % 13);

// The held tile moved there. A browser repeats dragover while the mouse
// rests, and react-dnd takes one hover a frame, dropping those in between;
// Playwright sends none at rest, so a move once that frame has passed
// settles it.
async function holdAt(page, x, y) {
  await page.mouse.move(x, y, { steps: 8 });
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await page.mouse.move(x, y + 1);
}

// to: a locator, or a point ({ x, y })
async function drag(page, from, to) {
  const a = await from.boundingBox();
  const b = to.boundingBox
    ? await to.boundingBox()
    : { ...to, width: 0, height: 0 };
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}

// bare felt, at every size: just above my rack's left end
async function felt(page) {
  const r = await page.locator(".rack:not(.mini)").first().boundingBox();
  return { x: r.x + 10, y: r.y - 15 };
}

// a menu item that takes a second tap
async function confirm(page, item) {
  await page.getByRole("button", { name: MENU }).click();
  await page.getByRole("button", { name: item }).click();
  await page.locator(".table-menu button.armed").click();
}

const stages = {
  lobby: async () => {},
  play: async (page) => {
    await table(page, "start", 4);
    await table(page, "toMyTurn");
    await table(page, "openKut");
  },
  menu: async (page) => {
    await stages.play(page);
    await page.getByRole("button", { name: MENU }).click();
  },
  roundEnd: async (page) => {
    await table(page, "start", 4);
    await table(page, "playToEnd");
  },
  classic: async (page) => {
    await table(page, "start", 4, "classic");
    await table(page, "play", 5);
  },
  101: async (page) => {
    await table(page, "start", 4, "101");
    await table(page, "toMyTurn");
  },
  settings: async (page) => {
    await page.getByLabel(RULES).selectOption("americano");
    await page.getByRole("button", { name: SETTINGS }).click();
  },
};

for (const [stage, setUp] of Object.entries(stages)) {
  test(`${stage}: everything fits and looks as before`, async ({ page }) => {
    await sitDown(page);
    await setUp(page);
    // the score sheet opens over the table at round end on purpose
    const ignore = stage === "roundEnd" ? [".scores"] : [];
    expect(await table(page, "check", ignore)).toEqual({
      overlaps: [],
      offscreen: [],
    });
    await expect(page).toHaveScreenshot(`${stage}.png`);
  });
}

// what someone who follows an invite sees first, every seat still free, and
// a table crowded with melds, which must stay clear of your name
test("before you sit, everything fits", async ({ page }) => {
  await sitDown(page, { sit: false });
  expect(await table(page, "check")).toEqual({ overlaps: [], offscreen: [] });
});

test("a crowded table fits", async ({ page }) => {
  await sitDown(page);
  await stages.play(page);
  await table(page, "crowd");
  expect(await table(page, "check")).toEqual({ overlaps: [], offscreen: [] });
});

// the table full while another plays: their tea glass and badges stay in
// the row along the top, clear of the melds, and Catch for the latest
// discard is under the pile left of my rack
test("a crowded table keeps clear of what hangs under the others", async ({
  page,
}) => {
  await sitDown(page);
  await stages.play(page);
  await table(page, "crowd", 7);
  await table(page, "play", 2);
  await expect(page.locator(".head .glass")).toBeVisible();
  await expect(page.locator(".head .catch")).toHaveCount(0);
  await expect(page.locator(".foot .catch")).toBeVisible();
  expect(await table(page, "check")).toEqual({ overlaps: [], offscreen: [] });
});

// a tap on the tea glass pours a Perge, then rakı, then tea again, and the
// glass keeps its drink as the turn takes it to the next seat
test("a tap on the tea glass pours the next drink", async ({ page }, info) => {
  anySize(info);
  await sitDown(page);
  await stages.play(page);
  const drink = (fill, at = ".rack") =>
    expect(page.locator(`${at} .glass [fill="url(#tea-glass-${fill})"]`));
  const pour = () =>
    info.project.name === "desktop"
      ? page.locator(".glass").click()
      : page.locator(".glass").tap();
  await drink("tea").toBeVisible();
  for (const next of ["bottle", "raki", "tea", "bottle"]) {
    await pour();
    await drink(next).toBeVisible();
  }
  await table(page, "play", 1);
  await drink("bottle", ".head").toBeVisible();
});

// a discard that fit a meld gives the others time to catch it: the next
// player's take waits meanwhile, a ghost in its slot, and Catch shows the
// tile it catches
test("a discard that fits waits the others' time to catch it, then comes", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await stages.play(page);
  await table(page, "toMyTurn", false);
  await page.evaluate(() =>
    window.okey.set({ ...window.okey.get(), discardFits: true }),
  );
  const top = (await state(page)).players[3].discardPile.at(-1).id;
  await expect(page.locator(".foot .catch .tile")).toHaveCount(1);
  const free = (await handIds(page)).indexOf(null);
  await drag(page, page.locator('[data-pile="4"] .slot'), slot(page, free));
  await expect(slot(page, free)).toHaveClass(/ghost/);
  const { drawn, rules } = await state(page);
  expect(drawn).toBeFalsy();
  // once the ruleset's seconds to catch it are up
  const timeout = (rules.catchWaitSeconds + 3) * 1000;
  await expect
    .poll(async () => (await handIds(page))[free], { timeout })
    .toBe(top);
  await expect(slot(page, free)).not.toHaveClass(/ghost/);
});

// changed your mind: the waiting draw's ghost goes round the rack, and let
// go anywhere off it, nothing is drawn
test("a draw waiting the others' time is undone by dragging it off the rack", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await stages.play(page);
  await table(page, "toMyTurn", false);
  // time enough for all the drags below
  await page.evaluate(() => {
    const s = window.okey.get();
    const rules = { ...s.rules, catchWaitSeconds: 60 };
    window.okey.set({ ...s, discardFits: true, rules });
  });
  const ids = await handIds(page);
  const [a, b] = [ids.indexOf(null), ids.indexOf(null, ids.indexOf(null) + 1)];
  const pile = page.locator('[data-pile="4"] .slot');
  await drag(page, pile, slot(page, a));
  await drag(page, slot(page, a).locator(".tile"), slot(page, b));
  await expect(slot(page, b)).toHaveClass(/ghost/);
  await expect(slot(page, a)).not.toHaveClass(/ghost/);
  // El aç's second press waits too: nothing, not even a "Draw a tile first"
  const elAc = page.locator("button[aria-pressed]");
  await elAc.click();
  await expect(elAc).toHaveAttribute("aria-pressed", "true");
  await elAc.click();
  await expect(elAc).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[role=status]")).toHaveCount(0);
  const { x, y } = await felt(page);
  await page.mouse.click(x, y);
  await expect(elAc).toHaveAttribute("aria-pressed", "false");
  // on the felt, the middle pile, a meld, or back on its pile
  const offRack = [
    await felt(page),
    page.locator(".draw .stack"),
    page.locator(".meld").first(),
    pile,
  ];
  for (const to of offRack) {
    if (!(await slot(page, b).getAttribute("class")).includes("ghost")) {
      await drag(page, pile, slot(page, b));
    }
    await expect(slot(page, b)).toHaveClass(/ghost/);
    await drag(page, slot(page, b).locator(".tile"), to);
    await expect(slot(page, b)).not.toHaveClass(/ghost/);
    await expect(page.locator("[role=status]")).toHaveCount(0);
  }
  // with the wait over, a draw still held would come now
  await page.evaluate(() => {
    const s = window.okey.get();
    window.okey.set({ ...s, rules: { ...s.rules, catchWaitSeconds: 0 } });
  });
  await page.waitForTimeout(500);
  expect((await state(page)).drawn).toBeFalsy();
  expect((await handIds(page))[b]).toBeNull();
});

test("on a wide screen the melds wrap about four to a row, as on a phone", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "a wide screen");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await sitDown(page);
  await stages.play(page);
  await table(page, "crowd", 6);
  const tops = await page
    .locator(".meld")
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
  expect(new Set(tops.map(Math.round)).size).toBe(2);
});

// three at the table: the seats and piles along the top, the hands on the
// rack at round end
test("three at the table fit, in play and once the round is over", async ({
  page,
}) => {
  await sitDown(page);
  await table(page, "start", 3);
  await table(page, "toMyTurn");
  await table(page, "openKut");
  expect(await table(page, "check")).toEqual({ overlaps: [], offscreen: [] });
  await table(page, "playToEnd");
  await expect(page.locator(".rack .hands [data-hand]")).toHaveCount(3);
  expect(await table(page, "check", [".scores"])).toEqual({
    overlaps: [],
    offscreen: [],
  });
});

// a fifth seat: four others and three piles along the top, five hands on
// the rack at round end
test("five at a table fit, in play and once the round is over", async ({
  page,
}) => {
  await sitDown(page);
  await table(page, "start", 5, "americano", { seats: 5 });
  await table(page, "toMyTurn");
  await table(page, "openKut");
  expect(await table(page, "check")).toEqual({ overlaps: [], offscreen: [] });
  await expect(page).toHaveScreenshot("five-play.png");
  await table(page, "playToEnd");
  await expect(page.locator(".rack .hands [data-hand]")).toHaveCount(5);
  expect(await table(page, "check", [".scores"])).toEqual({
    overlaps: [],
    offscreen: [],
  });
  await expect(page).toHaveScreenshot("five-round-end.png");
});

// eight, with four sets of tiles: a phone too can play it
test("eight at a table fit, in play and once the round is over", async ({
  page,
}) => {
  await sitDown(page);
  await table(page, "start", 8, "americano", { seats: 8, tileSets: 4 });
  await table(page, "toMyTurn");
  await table(page, "openKut");
  expect(await table(page, "check")).toEqual({ overlaps: [], offscreen: [] });
  await expect(page).toHaveScreenshot("eight-play.png");
  await table(page, "playToEnd");
  await expect(page.locator(".rack .hands [data-hand]")).toHaveCount(8);
  // the hands rise over the table's melds on purpose
  expect(await table(page, "check", [".scores", ".meld"])).toEqual({
    overlaps: [],
    offscreen: [],
  });
  await expect(page).toHaveScreenshot("eight-round-end.png");
});

// four played a round of rules with a fifth seat: someone arriving sees it
// to take, beside the score sheet and the menu
test("after a round of four, a fifth arriving has a seat, and it fits", async ({
  page,
}) => {
  const room = await sitDown(page);
  await table(page, "start", 4, "americano", { seats: 5 });
  await table(page, "playToEnd");
  const fifth = await secondPlayer(page, room);
  await expect(
    fifth.locator('.others [data-seat="5"]').getByRole("button", { name: SIT }),
  ).toBeVisible();
  expect(await table(fifth, "check", [".scores"])).toEqual({
    overlaps: [],
    offscreen: [],
  });
});

// classic: once the pile runs out, whoever's turn it is shuffles the
// discards into a new one, or ends the hand from the menu, to deal it again
test("classic: an empty pile is shuffled again, or the hand dealt again", async ({
  page,
}) => {
  await sitDown(page);
  await table(page, "start", 4, "classic");
  await table(page, "emptyPile");
  expect(await table(page, "check")).toEqual({ overlaps: [], offscreen: [] });
  await page.getByRole("button", { name: SHUFFLE }).click();
  await expect(page.locator(".draw .count")).toHaveText("49");
  await expect(page.getByRole("button", { name: SHUFFLE })).toHaveCount(0);

  await table(page, "emptyPile");
  await confirm(page, END);
  await expect(page.locator(".rack .hands [data-hand]")).toHaveCount(4);
  await expect(page.getByRole("button", { name: NEXT })).toBeVisible();
  expect(await table(page, "check")).toEqual({ overlaps: [], offscreen: [] });
});

// the "Drag here" line shows only where it has room: on a phone it would
// shrink every meld each time you pick a tile
test("picking a tile keeps the melds' size", async ({ page }) => {
  await sitDown(page);
  await stages.play(page);
  await table(page, "crowd", 4);
  const fit = () =>
    page.locator(".melds").evaluate((el) => el.style.getPropertyValue("--fit"));
  const before = await fit();
  await slot(page, 3).locator(".tile").click();
  await expect(page.locator(".melds.droppable")).toBeVisible();
  expect(await fit()).toBe(before);
});

// a table with room has the draw pile in the middle until the melds need
// it (phones keep the pile on the left: see their screenshots)
test("the draw pile makes way as the table fills", async ({ page }, info) => {
  anySize(info);
  await page.setViewportSize({ width: 1100, height: 700 });
  await sitDown(page);
  await stages.play(page);
  const inMiddle = page.locator(".center .draw");
  await expect(inMiddle).toHaveCount(1);
  await table(page, "crowd", 16);
  await expect(inMiddle).toHaveCount(0);
  await expect(page.locator(".middle > .left > .draw")).toHaveCount(1);
});

test("picked tiles dragged onto the table before drawing ask for a draw", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "start", 4);
  await table(page, "toMyTurn", false);
  for (const i of [0, 1, 2]) await slot(page, i).locator(".tile").click();
  await drag(page, slot(page, 1).locator(".tile"), page.locator(".melds"));
  await expect(page.locator("[role=status]")).toHaveText(
    /^(Draw a tile first|Önce taş çek)$/,
  );
  expect((await state(page)).melds).toEqual([]);
});

test("dragging picked tiles onto the table opens the hand", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "start", 4);
  await table(page, "toMyTurn");
  // the küt is dealt into my first three slots; the fourth tile is extra
  const extra = (await handIds(page))[3];
  for (const i of [0, 1, 2, 3]) await slot(page, i).locator(".tile").click();
  await expect(page.locator(".melds.droppable")).toBeVisible();
  await drag(page, slot(page, 1).locator(".tile"), page.locator(".melds"));
  await expect.poll(async () => (await state(page)).melds.length).toBe(1);
  expect((await state(page)).opened[1]).toBeTruthy();
  // the extra tile stays on the rack, no longer picked
  expect((await handIds(page))[3]).toBe(extra);
  await expect(page.locator(".rack .tile.selected")).toHaveCount(0);
});

test("El aç: it picks what it would open, a tap picks a whole group, and it stays to lay more", async ({
  page,
}, info) => {
  anySize(info);
  await page.clock.install();
  await sitDown(page);
  await table(page, "start", 4);
  await table(page, "toMyTurn");
  const picked = () =>
    page
      .locator(".rack .tile.selected")
      .evaluateAll((els) => els.map((e) => e.dataset.tileId).sort());
  const kut = ["black7-0", "blue7-0", "red7-0"];
  await page.getByRole("button", { name: OPEN }).click();
  await expect.poll(picked).toEqual(kut);
  // my first row is one group, end to end
  await slot(page, 5).locator(".tile").click();
  await expect(page.locator(".rack .tile.selected")).toHaveCount(13);
  await slot(page, 5).locator(".tile").click();
  await expect(page.locator(".rack .tile.selected")).toHaveCount(0);
  await page.getByRole("button", { name: FIND }).click();
  await expect.poll(async () => (await state(page)).melds.length).toBe(1);
  expect((await state(page)).melds[0].tiles.map((t) => t.id).sort()).toEqual(
    kut,
  );
  await expect(page.getByRole("button", { name: LAY })).toBeVisible();
  // left pressed with nothing touched, it goes back to normal
  const elAc = page.locator("button[aria-pressed]");
  await elAc.click();
  await expect(elAc).toHaveAttribute("aria-pressed", "true");
  await page.clock.fastForward(20000);
  await expect(elAc).toHaveAttribute("aria-pressed", "false");
  await expect(elAc).toHaveText(LAY);
  await expect(page.locator(".rack .tile.selected")).toHaveCount(0);
  // and a tap on the felt lets it go at once
  await elAc.click();
  await expect(elAc).toHaveAttribute("aria-pressed", "true");
  const { x, y } = await felt(page);
  await page.mouse.click(x, y);
  await expect(elAc).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".rack .tile.selected")).toHaveCount(0);
});

test("101: once opened, El aç picks the runs on the rack and lays them", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "start", 4, "101");
  await table(page, "toMyTurn");
  await table(page, "runFirst");
  const run = ["red3-1", "red4-1", "red5-1"];
  await page.getByRole("button", { name: LAY }).click();
  for (const id of run) {
    await expect(page.locator(`.rack [data-tile-id="${id}"]`)).toHaveClass(
      /selected/,
    );
  }
  await page
    .getByRole("button", { name: /^(Open picked|Seçilenleri aç)$/ })
    .click();
  await expect
    .poll(async () =>
      (await state(page)).melds.map((m) => m.tiles.map((t) => t.id).join()),
    )
    .toContain(run.join());
});

// an okey held over a seri's right half shows where it would go, as the
// tile it would stand for, and goes there when dropped
test("an okey shows where it would go, and goes on the end it's dropped on", async ({
  page,
}) => {
  await sitDown(page);
  await table(page, "start", 4);
  await table(page, "toMyTurn");
  const okey = await table(page, "okeyAndSeri");
  await table(page, "crowd", 2);
  // the seri's last tile is right of its middle; hovering it first waits
  // for the table to settle
  const last = page.locator('[data-meld="0"] .tile').last();
  await last.hover();
  const b = await last.boundingBox();
  const next = page.locator('[data-meld="1"]');
  const was = await next.boundingBox();
  const [x, y] = [b.x + b.width / 2, b.y + b.height / 2];
  await slot(page, 0).locator(".tile").hover();
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 8 });
  // a held mouse keeps hovering; Playwright's drag only does when it moves
  let dx = 0;
  await expect
    .poll(async () => {
      await page.mouse.move(x + (++dx % 4), y);
      return page.locator(".meld .ghost.after").count();
    })
    .toBe(1);
  // the ghost opens a slot in its own meld: the next one stays put, clear
  // of it
  const is = await next.boundingBox();
  expect(Math.abs(is.x - was.x) + Math.abs(is.y - was.y)).toBeLessThan(2);
  const g = await page.locator(".meld .ghost").boundingBox();
  expect(
    g.x + g.width <= is.x + 1 ||
      is.x + is.width <= g.x + 1 ||
      g.y + g.height <= is.y + 1 ||
      is.y + is.height <= g.y + 1,
  ).toBe(true);
  await page.mouse.up();
  await expect
    .poll(async () => (await state(page)).melds[0].tiles.at(-1).id)
    .toBe(okey);
  await expect(page.locator(".meld .ghost")).toHaveCount(0);
});

test("picked tiles dropped on a meld go on it, and one comes back this turn", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "start", 4);
  await table(page, "toMyTurn");
  const [low, high] = await table(page, "seriAndEnds");
  const meld = async () => (await state(page)).melds[0].tiles.map((t) => t.id);
  for (const i of [1, 2]) await slot(page, i).locator(".tile").click();
  await drag(
    page,
    slot(page, 2).locator(".tile"),
    page.locator('[data-meld="0"]'),
  );
  await expect.poll(meld).toHaveLength(5);
  expect([(await meld())[0], (await meld())[4]]).toEqual([low, high]);
  await expect(page.locator(".rack .tile.selected")).toHaveCount(0);
  // dragged back to the rack, into the slot it's dropped on, once it has
  // landed (a tile in flight can't be picked up)
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => !a.effect.target?.matches(".tile")),
  );
  await drag(
    page,
    page.locator(`.meld [data-tile-id="${high}"]`),
    slot(page, 2),
  );
  await expect.poll(async () => (await handIds(page))[2]).toBe(high);
  expect(await meld()).not.toContain(high);
  expect(await meld()).toContain(low);
});

test("a discard taken goes back on its pile with a drag", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "start", 4);
  await table(page, "toMyTurn", false);
  const pile = page.locator('[data-pile="4"] .slot');
  const top = (await state(page)).players[3].discardPile.at(-1).id;
  const gap = (await handIds(page)).indexOf(null);
  await drag(page, pile.locator(".tile"), slot(page, gap));
  await expect.poll(async () => (await handIds(page))[gap]).toBe(top);
  await drag(page, slot(page, gap).locator(".tile"), pile);
  await expect
    .poll(async () => (await state(page)).players[3].discardPile.at(-1).id)
    .toBe(top);
  expect((await state(page)).drawn).toBe(false);
  expect(await handIds(page)).not.toContain(top);
});

// what's ticked in the settings goes into the game it starts, without saving
// anything; in pairs it takes four
test("101 starts with what's ticked, and in pairs with four at the table", async ({
  page,
}) => {
  await sitDown(page);
  await page.getByLabel(RULES).selectOption("101");
  await page.getByRole("button", { name: SETTINGS }).click();
  await page.getByLabel(/^(Four in two pairs|Eşli:)/).check();
  await page.getByLabel(/^(Opening with points takes more|Katlamalı:)/).check();
  await page.getByRole("button", { name: CLOSE }).click();
  await expect(page.getByLabel(RULES)).toContainText("101 *");
  const start101 = page.getByRole("button", { name: START });
  await start101.click();
  await expect(
    page.getByText(
      /^(Partners take four players|Eşli oyun dört kişiyle oynanır)$/,
    ),
  ).toBeVisible();
  await table(page, "seatBots", 4);
  await start101.click();
  await expect
    .poll(async () => (await state(page)).rules)
    .toMatchObject({
      id: "101",
      partners: true,
      raiseOpening: true,
    });
  expect(await table(page, "check")).toEqual({ overlaps: [], offscreen: [] });
});

// four sets of tiles in the settings: the lobby's pile is all of them, and
// four of a tile isn't taken for a duplicate
test("four sets of tiles picked in the settings make a pile of 212", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await page.getByRole("button", { name: SETTINGS }).click();
  await page.getByLabel(/^(Sets of 53 tiles|53'lük taş takımı)/).fill("4");
  await expect.poll(async () => (await state(page)).drawPile.length).toBe(212);
  // the error would toast as the pile changed: given time to show
  await page.waitForTimeout(1500);
  expect(
    await page
      .getByText(/Duplicate tile detected|Aynı taştan fazla var/)
      .count(),
  ).toBe(0);
});

// a game played as a preset sets the next one up as that preset, unchanged
test("after a game of Americano, the next is set up as Americano", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "seatBots", 2);
  await page.getByLabel(RULES).selectOption("americano");
  await page.getByRole("button", { name: START }).click();
  await expect.poll(async () => (await state(page)).gameState).toBe("play");
  await confirm(page, NEW_GAME);
  await expect(page.getByLabel(RULES).locator("option:checked")).toHaveText(
    "Americano",
  );
});

// mid-game, the ⋯ menu's settings change the rules played from then on, for
// the whole table, and say so; the table's own (seats, tiles, the rack) stay
// as dealt
test("the rules can be changed mid-game, for the whole table", async ({
  page,
}, info) => {
  anySize(info);
  const room = await sitDown(page);
  const other = await secondPlayer(page, room);
  await table(page, "start", 2);
  await page.getByRole("button", { name: MENU }).click();
  await page.getByRole("button", { name: RULES }).click();
  await expect(
    page.getByLabel(/^(Tiles dealt to each|Her oyuncuya dağıtılan)/),
  ).toHaveCount(0);
  const penalty = page.getByLabel(
    /^(Written for throwing a tile that fit|Yerdeki bir pere işleyen taşı atıp)/,
  );
  // the rules read a number as it's written: an emptied one isn't
  await penalty.fill("");
  await page.locator(".settings .start").click();
  await expect(
    page.getByText(/^(Fill in every number|Her sayıyı doldur)$/),
  ).toBeVisible();
  await penalty.fill("50");
  await page.locator(".settings .start").click();
  await expect
    .poll(async () => (await state(other)).rules.catchPenalty, NET)
    .toBe(50);
  await expect(
    other.getByText(/^(Ayşe changed the rules|Ayşe kuralları değiştirdi)$/),
  ).toBeVisible();
});

// your own rack's rows, apart from the table's: yours to set any time, in
// the Rules, your hand laid out on them
test("your own rack's rows are set mid-round, and your hand moves onto them", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "start", 2);
  const tiles = (await handIds(page)).filter(Boolean).length;
  await page.getByRole("button", { name: MENU }).click();
  await page.getByRole("button", { name: RULES }).click();
  // Americano's: a hand, a draw and three takes want 11 at least
  const rows = page.getByLabel(
    /^(Slots in each row of your own rack|Kendi ıstakanın her sırasındaki)/,
  );
  await rows.fill("10");
  await page.locator(".settings .start").click();
  await expect(
    page.getByText(/^(Make the rack's rows longer|Istaka sıralarını uzat)$/),
  ).toBeVisible();
  await rows.fill("11");
  await page.locator(".settings .start").click();
  await expect(page.locator(".rack:not(.mini) .top > *")).toHaveCount(11);
  expect((await handIds(page)).filter(Boolean)).toHaveLength(tiles);
  expect(await table(page, "check")).toEqual({ overlaps: [], offscreen: [] });
});

// the settings: a game set up any way, started from them and kept on this
// device under a name, for the next night
test("a game set up in the settings starts that way, and is kept", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "seatBots", 2);
  await page.getByLabel(RULES).selectOption("americano");
  await page.getByRole("button", { name: SETTINGS }).click();
  await page
    .getByLabel(/^(Tiles dealt to each|Her oyuncuya dağıtılan)/)
    .fill("12");
  // an emptied number isn't played as its default
  const finishing = page.getByLabel(
    /^(Written for whoever finishes|Bitirene yazılan)/,
  );
  await finishing.fill("");
  await page.locator(".settings .start").click();
  await expect(
    page.getByText(/^(Fill in every number|Her sayıyı doldur)$/),
  ).toBeVisible();
  await expect.poll(async () => (await state(page)).gameState).toBe("start");
  await finishing.fill("-20");
  await page
    .getByRole("button", { name: /^(Remove the round|Eli kaldır)$/ })
    .first()
    .click();
  await page.getByLabel(/^(Name|Ad)$/).fill("Short Americano");
  await page.getByRole("button", { name: /^(Save|Kaydet)$/ }).click();
  await page.locator(".settings .start").click();
  await expect
    .poll(async () => (await state(page)).rules?.name)
    .toBe("Short Americano");
  const { rules } = await state(page);
  expect(rules).toMatchObject({ name: "Short Americano", handSize: 12 });
  // Americano's rounds, but the first
  expect(rules.rounds).toHaveLength(12);
  expect(rules.rounds[0]).toEqual({ name: "3'lü seri", melds: [["seri", 3]] });
  expect(
    await page.evaluate(() => JSON.parse(localStorage["okey-rulesets"])),
  ).toEqual([rules]);
  // the next game is set up the same, and nothing reads as changed
  await confirm(page, NEW_GAME);
  await expect(page.getByLabel(RULES).locator("option:checked")).toHaveText(
    "Short Americano",
  );
});

// a link dragged over the table is the browser's own drag, with no tile in
// it: the table stays
test("a link dragged over the table leaves it be", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the browser's own drag");
  await sitDown(page);
  await table(page, "start", 4);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const a = await page.getByRole("link", { name: "TicTacToe" }).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  for (const x of [500, 700, 800]) await page.mouse.move(x, 450, { steps: 5 });
  await page.waitForTimeout(300);
  await expect(page.locator(".board")).toHaveCount(1);
  await page.mouse.up();
});

// right click flips your tile while the round is played; once it's over,
// every hand shows face up (the rules turn them) and stays that way
test("a tile flips during play, and shows once the round is over", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "start", 4);
  const hidden = async () => (await state(page)).players[0].hand[0].hidden;
  const { id } = (await state(page)).players[0].hand[0];
  let tile = slot(page, 0).locator(".tile");
  const flip = () => tile.click({ button: "right" });
  await flip();
  await expect.poll(hidden).toBe(true);
  await expect(tile).toHaveClass(/\bback\b/);
  await table(page, "playToEnd");
  // once it's over, every hand is shown on the rack: mine too
  tile = page.locator(`.rack [data-hand="1"] [data-tile-id="${id}"]`);
  await expect(tile).not.toHaveClass(/\bback\b/);
  await flip();
  await page.waitForTimeout(300);
  expect(await hidden()).toBe(false);
  await expect(tile).not.toHaveClass(/\bback\b/);
});

// an easter egg: two quick taps on the felt knock on the table, and each
// player hears it from where it was, as they sit
test("a knock on the table is heard from where it was", async ({
  page,
  browser,
}, info) => {
  const room = await sitDown(page);
  const guest = await (await browser.newContext()).newPage();
  await sitDown(guest, { room, name: "Bora", sit: false });
  await arrived(guest);
  await guest
    .locator(".playerName", { hasText: /(Player|Oyuncu) 2(?!\d)/ })
    .getByRole("button", { name: SIT })
    .click();
  await expect
    .poll(async () => (await state(page)).players[1].user?.name)
    .toBe("Bora");
  // bare felt: the bottom left of the table's middle
  const board = await page.locator(".board").boundingBox();
  const middle = await page.locator(".middle").boundingBox();
  const at = { x: middle.x + 10, y: middle.y + middle.height - 10 };
  if (info.project.name === "desktop") await page.mouse.dblclick(at.x, at.y);
  else {
    await page.touchscreen.tap(at.x, at.y);
    await page.touchscreen.tap(at.x, at.y);
  }
  const x = ((at.x - board.x) / board.width) * 2 - 1;
  const y = 1 - ((at.y - board.y) / board.height) * 2;
  const heard = (p) => p.evaluate(() => window.okeyKnocks ?? []);
  // Ayşe hears it on her left; Bora sits on her right, so that side of the
  // table is in front of him: the farther up her screen, the more to his right
  await expect.poll(() => heard(page)).toHaveLength(1);
  expect((await heard(page))[0]).toBeCloseTo(x);
  await expect.poll(() => heard(guest)).toHaveLength(1);
  expect((await heard(guest))[0]).toBeCloseTo(y);
  // a knock beside the ⋯ button picks no word off the table
  const dots = await page.locator(".dots").boundingBox();
  await page.mouse.dblclick(dots.x - 30, dots.y + dots.height / 2);
  expect(await page.evaluate(() => getSelection().toString())).toBe("");
});

// an easter egg: a right click turns the fake okey upside down, and back
test("the fake okey turns on a right click, for good", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "start", 4);
  const id = (await handIds(page)).find((x) => x?.includes("👌"));
  const fake = page.locator(`.rack [data-tile-id="${id}"]`);
  await fake.click({ button: "right" });
  await expect(fake).toHaveClass(/\bspun\b/);
  // turned, not flipped
  await expect(fake).not.toHaveClass(/\bback\b/);
  // it stays turned in the next game
  await confirm(page, NEW_GAME);
  await table(page, "start", 4);
  await expect(fake).toHaveClass(/\bspun\b/);
  await fake.click({ button: "right" });
  await expect(fake).not.toHaveClass(/\bspun\b/);
});

// phones: a tile held still flips when the finger lets go (or the phone
// cancels the touch); a finger that moves drags it instead, and nothing
// stays in the air
test("holding a tile still flips it, moving drags it", async ({
  page,
}, info) => {
  test.skip(info.project.name === "desktop", "touch only");
  await sitDown(page);
  await table(page, "start", 4);
  await table(page, "toMyTurn");
  const id = (await handIds(page))[0];
  const touch = (type, dx = 0) =>
    page.evaluate(
      ([id, type, dx]) => {
        const el = document.querySelector(`.rack [data-tile-id="${id}"]`);
        const r = el.getBoundingClientRect();
        const t = new Touch({
          identifier: 1,
          target: el,
          clientX: r.left + r.width / 2 + dx,
          clientY: r.top + r.height / 2,
        });
        const on = type === "touchstart" || type === "touchmove" ? [t] : [];
        el.dispatchEvent(
          new TouchEvent(type, {
            touches: on,
            targetTouches: on,
            changedTouches: [t],
            bubbles: true,
            cancelable: true,
          }),
        );
      },
      [id, type, dx],
    );
  const hidden = async () => (await state(page)).players[0].hand[0].hidden;
  // held still (a finger shakes a little): it wiggles, then flips on letting go
  await touch("touchstart");
  await touch("touchmove", 3);
  await page.waitForTimeout(800);
  await expect(page.locator(`.rack [data-tile-id="${id}"].armed`)).toHaveCount(
    1,
  );
  expect(await hidden()).toBe(false);
  await touch("touchend", 3);
  await expect.poll(hidden).toBe(true);
  // and back, through a touch the phone cancels
  await touch("touchstart");
  await page.waitForTimeout(800);
  await touch("touchcancel");
  await expect.poll(hidden).toBe(false);
  // held, then moved: a drag, no flip, whether the touch ends or is cancelled
  for (const end of ["touchend", "touchcancel"]) {
    await touch("touchstart");
    await page.waitForTimeout(800);
    await touch("touchmove", 20);
    await touch(end, 20);
    expect(await hidden()).toBe(false);
    await expect(page.locator(".dragPreview")).toHaveCount(0);
  }
  await expect(page.locator(".rack .tile.armed")).toHaveCount(0);
});

test("the last tile is thrown to the middle to finish", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "start", 4);
  await table(page, "toMyTurn");
  await table(page, "openKut");
  // everything else laid down: one tile left
  const last = await page.evaluate(() => {
    const s = window.okey.get();
    const hand = s.players[0].hand;
    const tile = hand.findLast(Boolean);
    window.okey.set({
      ...s,
      justOpened: null,
      players: s.players.map((p) =>
        p.id === 1
          ? { ...p, hand: hand.map((t) => (t === tile ? t : null)) }
          : p,
      ),
    });
    return { id: tile.id, at: hand.indexOf(tile) };
  });
  const tile = slot(page, last.at).locator(".tile");
  await drag(page, tile, page.locator('[data-pile="1"] .slot'));
  await expect(
    page.getByText(/Throw your last tile|son taşını ortaya at/),
  ).toBeVisible();
  expect((await state(page)).gameState).toBe("play");

  await drag(page, tile, page.locator(".draw .stack"));
  await expect.poll(async () => (await state(page)).gameState).toBe("roundEnd");
  await expect(
    page.locator(`.draw .thrown[data-tile-id="${last.id}"]`),
  ).toBeVisible();
  // the table stays as it ended: my turn's moves, opening and finishing,
  // marked on their tiles and listed; the hands left on the rack (mine is
  // empty)
  await expect(page.locator(".moves li")).toHaveCount(2);
  await expect(page.locator(".melds .tile.marked")).toHaveCount(3);
  await expect(page.locator(".draw .thrown")).toHaveAttribute("data-mark", "2");
  await expect(page.locator(".rack .hands [data-hand]")).toHaveCount(3);
});

test("picked tiles move together", async ({ page }, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "start", 4);
  const before = await handIds(page);
  for (const i of [3, 6, 9]) await slot(page, i).locator(".tile").click();
  // held by the middle one, dropped on 20: they land on 19, 20 and 21
  await drag(page, slot(page, 6).locator(".tile"), slot(page, 20));
  await expect
    .poll(async () => (await handIds(page)).slice(19, 22))
    .toEqual([before[3], before[6], before[9]]);
  // they stay picked; a tap on the rack off the tiles drops the pick
  const picked = page.locator(".rack .tile.selected");
  await expect(picked).toHaveCount(3);
  await slot(page, 25).click();
  await expect(picked).toHaveCount(0);
});

test("picked tiles from both rows each stay in their row", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "start", 4);
  const before = await handIds(page);
  for (const i of [2, 13]) await slot(page, i).locator(".tile").click();
  // held by the top one, 4 slots right: the bottom one comes 4 along too
  const from = await slot(page, 2).locator(".tile").boundingBox();
  const to = await slot(page, 6).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await holdAt(page, to.x + to.width / 2, to.y + to.height / 2);
  await expect(slot(page, 6)).toHaveClass(/over/);
  await expect(slot(page, 17)).toHaveClass(/over/);
  await page.mouse.up();
  await expect
    .poll(async () => {
      const ids = await handIds(page);
      return [ids[6], ids[17]];
    })
    .toEqual([before[2], before[13]]);
});

// the pick goes with the round: its end shows the hands unpicked
test("a pick is dropped when the round ends", async ({ page }, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "start", 4);
  await slot(page, 2).locator(".tile").click();
  await expect(page.locator(".rack .tile.selected")).toHaveCount(1);
  await table(page, "playToEnd");
  await expect(page.locator(".rack .hands [data-hand]")).toHaveCount(4);
  await expect(page.locator(".tile.selected")).toHaveCount(0);
});

// picked tiles held partly over where they were: every slot they'd land in
// is marked, theirs too
test("picked tiles held near where they were mark every slot they'd land in", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "start", 4);
  for (const i of [2, 3, 4]) await slot(page, i).locator(".tile").click();
  const from = await slot(page, 3).locator(".tile").boundingBox();
  const to = await slot(page, 5).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await holdAt(page, to.x + to.width / 2, to.y + to.height / 2);
  // they'd land on 4, 5 and 6
  await expect(slot(page, 4)).toHaveClass(/moving over/);
  await expect(page.locator(".rack .slot.over")).toHaveCount(3);
  await page.mouse.up();
});

test("a tile held over the rack shows the others sliding aside", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "start", 4);
  const before = await handIds(page);
  // slot 0's tile over slot 3: 1 2 3 would close up to its left
  const from = await slot(page, 0).locator(".tile").boundingBox();
  const to = await slot(page, 3).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await holdAt(page, to.x + to.width / 2, to.y + to.height / 2);
  await expect(slot(page, 3)).toHaveCSS("--dx", "-1");
  await expect(slot(page, 1)).toHaveCSS("--dx", "-1");
  await expect(slot(page, 4)).not.toHaveCSS("--dx", /./);
  await expect(slot(page, 0)).toHaveClass(/moving/);
  await page.mouse.up();
  await expect
    .poll(async () => (await handIds(page)).slice(0, 5))
    .toEqual([before[1], before[2], before[3], before[0], before[4]]);
  await expect(page.locator(".rack .slot.aside")).toHaveCount(0);
});

// the tile slid aside into a gap doesn't take the gap from the one held:
// held over its neighbour, then over the gap, it drops into the gap
test("a tile held over a gap drops into it, past the tile slid there", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "start", 4);
  // a gap at slot 3: its tile to the bottom row
  await page.evaluate(() => {
    const s = window.okey.get();
    const hand = [...s.players[0].hand];
    hand[hand.indexOf(null, 13)] = hand[3];
    hand[3] = null;
    window.okey.set({
      ...s,
      players: s.players.map((p, i) => (i ? p : { ...p, hand })),
    });
  });
  const before = await handIds(page);
  const held = before.findIndex((t, i) => i >= 13 && t);
  const at = async (i) => {
    const b = await slot(page, i).boundingBox();
    await holdAt(page, b.x + b.width / 2, b.y + b.height / 2);
  };
  const from = await slot(page, held).locator(".tile").boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await at(2); // slot 2's tile slides right, into the gap
  await expect(slot(page, 2)).toHaveCSS("--dx", "1");
  await at(3);
  await expect(page.locator(".rack .slot.aside")).toHaveCount(0);
  await page.mouse.up();
  await expect
    .poll(async () => (await handIds(page)).slice(2, 4))
    .toEqual([before[2], before[held]]);
});

test("a box drawn on the rack picks the tiles in it", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "start", 4);
  const hand = await handIds(page);
  // from an empty slot in the bottom row, up and across to slot 2's middle
  const empty = hand.findIndex((t, i) => i >= 13 && !t);
  const a = await slot(page, empty).boundingBox();
  const b = await slot(page, 2).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await expect(page.locator(".lasso")).toBeVisible();
  await page.mouse.up();
  await expect(page.locator(".lasso")).toHaveCount(0);
  const picked = await page
    .locator(".rack .tile.selected")
    .evaluateAll((els) => els.map((el) => el.dataset.tileId));
  const lo = Math.min(empty % 13, 2);
  const hi = Math.max(empty % 13, 2);
  const inBox = hand.filter((t, i) => t && i % 13 >= lo && i % 13 <= hi);
  expect(picked.sort()).toEqual(inBox.sort());
});

test("a box drawn from the felt picks the tiles it reaches, a tap there drops them", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "start", 4);
  const hand = await handIds(page);
  const b = await slot(page, 2).boundingBox();
  // bare felt straight above slot 2, clear of the tiles that lift once
  // picked: nothing there to press
  const x = b.x + b.width / 2;
  const rack = await page.locator(".rack").boundingBox();
  const y = await page.evaluate(
    ([x, top]) => {
      for (let y = top; y > 0; y--) {
        const el = document.elementFromPoint(x, y);
        if (!el.closest(".rack, .tile, button, details, .discardPile"))
          return y;
      }
    },
    [x, rack.y - b.height / 2],
  );
  await page.mouse.move(x, y);
  await page.mouse.down();
  // down and left to slot 0's middle
  const a = await slot(page, 0).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2, { steps: 8 });
  await expect(page.locator(".lasso")).toBeVisible();
  await page.mouse.up();
  await expect(page.locator(".lasso")).toHaveCount(0);
  const picked = await page
    .locator(".rack .tile.selected")
    .evaluateAll((els) => els.map((el) => el.dataset.tileId));
  // the top row's slots 0 to 2 lie under the box
  expect(picked.sort()).toEqual([hand[0], hand[1], hand[2]].sort());
  // a tap on the felt drops the pick
  await page.mouse.click(x, y);
  await expect(page.locator(".rack .tile.selected")).toHaveCount(0);
});

test("a finger draws a box from the middle of the table", async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name === "desktop", "touch only");
  // real touches, which the browser can take over to scroll or zoom
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await sitDown(page);
  await table(page, "start", 4);
  const touch = (type, x, y) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y }],
    });
  // from the melds band above the rack down to slot 0's middle
  const rack = await page.locator(".rack").boundingBox();
  const a = await slot(page, 0).boundingBox();
  const [x, y] = [rack.x + rack.width / 2, rack.y - a.height];
  const [toX, toY] = [a.x + a.width / 2, a.y + a.height / 2];
  await touch("touchStart", x, y);
  for (let i = 1; i <= 8; i++) {
    await touch("touchMove", x + ((toX - x) * i) / 8, y + ((toY - y) * i) / 8);
  }
  await expect(page.locator(".lasso")).toBeVisible();
  await touch("touchEnd");
  await expect(page.locator(".rack .tile.selected")).not.toHaveCount(0);
  // a tap there drops the pick
  await page.touchscreen.tap(x, y);
  await expect(page.locator(".rack .tile.selected")).toHaveCount(0);
});

test("on the pair round a tap spreads a discard pile out", async ({ page }) => {
  await sitDown(page);
  await table(page, "start", 4);
  await table(page, "play", 40); // ten tiles on each pile
  const piles = page.locator("[data-pile]");
  await expect(piles).toHaveCount(4);
  // round 1: a tap on a pile does nothing
  await piles.first().locator(".slot").click();
  await expect(page.locator(".peek")).toHaveCount(0);
  // 4 çift: each pile spreads out, all of it on the screen, and a tap on
  // another closes the one before
  await page.evaluate(() =>
    window.okey.set({ ...window.okey.get(), round: 12 }),
  );
  const { width, height } = page.viewportSize();
  for (const pile of await piles.all()) {
    await pile.locator(".slot").click();
    await expect(page.locator(".peek")).toHaveCount(1);
    await expect(pile.locator(".peek .tile")).toHaveCount(10);
    const box = await pile.locator(".peek").boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
  }
  // a tap anywhere else puts it back
  await page.mouse.click(4, height / 2);
  await expect(page.locator(".peek")).toHaveCount(0);
  // any round, once someone's opened with pairs (101's peekWithPairs)
  await page.evaluate(() => {
    const s = window.okey.get();
    window.okey.set({
      ...s,
      round: 1,
      rules: { ...s.rules, peekWithPairs: true },
      openedWithPairs: { 2: true },
    });
  });
  await piles.first().locator(".slot").click();
  await expect(page.locator(".peek")).toHaveCount(1);
});

test("the sound level is set in the menu and kept", async ({ page }) => {
  await sitDown(page);
  await page.getByRole("button", { name: MENU }).click();
  await page.getByLabel(SOUND).fill("0.3");
  // one level for every game on this device (useStore.js)
  const kept = () => JSON.parse(localStorage.getItem("volume")).state.volume;
  expect(await page.evaluate(kept)).toBe(0.3);
  expect(await table(page, "check")).toEqual({ overlaps: [], offscreen: [] });
  await page.reload();
  await page.getByRole("button", { name: MENU }).click();
  await expect(page.getByLabel(SOUND)).toHaveValue("0.3");
});

// a second player, in the same browser: tabs sync over BroadcastChannel,
// and this one keeps the game while the first reloads, once it has it.
// build: a newer one it runs
async function secondPlayer(page, room, build) {
  const other = await (await page.context().browser().newContext()).newPage();
  if (build) {
    await other.addInitScript((b) => sessionStorage.setItem("build", b), build);
  }
  await sitDown(other, { name: "Bora", room, sit: false });
  await expect
    .poll(() => other.evaluate(() => !!window.okey?.get()), NET)
    .toBe(true);
  return other;
}

test("a reload keeps you logged in and in your seat", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "not about the layout");
  const room = await sitDown(page);
  const other = await secondPlayer(page, room);
  await table(page, "start", 2);
  // the game reaches Bora's page, which keeps it while this one reloads
  await expect
    .poll(() => other.evaluate(() => window.okey.get().gameState))
    .toBe("play");
  await page.reload();
  await expect(page.getByRole("button", { name: GO })).toHaveCount(0);
  // the game back from Bora's page, and Ayşe in her seat in it
  await expect
    .poll(async () => {
      const s = await state(page);
      return [s?.gameState, s?.players[0].user?.name];
    }, NET)
    .toEqual(["play", "Ayşe"]);
  await expect(page.locator(".rack:not(.mini) .tile")).toHaveCount(15);
});

// a new tab in this browser is the same player, under the name given once;
// a name changed in the sidebar shows on your seat for everyone, and in
// your other tabs
test("your name is remembered, and changed from the sidebar", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "not about the layout");
  const room = await sitDown(page);
  const tab = await page.context().newPage();
  await tab.goto(`/${room}/okey`);
  await expect(tab.getByLabel(/^(Your name|Adın)$/)).toHaveValue("Ayşe");
  await expect(tab.getByRole("button", { name: SIT })).toHaveCount(0);
  await expect(tab.locator(".rack > .playerName")).toHaveText("Ayşe");
  await page.getByRole("button", { name: /^(Menu|Menü)$/ }).click();
  const field = page.getByLabel(/^(Your name|Adın)$/);
  await field.fill("Ayşe K");
  await field.press("Enter");
  await expect(tab.locator(".rack > .playerName")).toHaveText("Ayşe K");
  await expect(
    tab.locator("#sidebar main li", { hasText: "Ayşe K" }),
  ).toHaveCount(1);
  await expect(tab.getByLabel(/^(Your name|Adın)$/)).toHaveValue("Ayşe K");
  expect(
    await tab.evaluate(() => JSON.parse(localStorage.user).state.currentUser),
  ).toMatchObject({ name: "Ayşe K" });
  // emptied, it keeps the name it had
  await field.fill("");
  await field.blur();
  await expect(field).toHaveValue("Ayşe K");
});

test("a page leaving the table keeps it till it's gone", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "not about the layout");
  const room = await sitDown(page);
  // two others, so this page still sees someone once it drops itself
  await secondPlayer(page, room);
  await secondPlayer(page, room);
  await table(page, "start", 2);
  // y-webrtc drops this page's own presence as it unloads (a reload for a
  // new version): its seat was marked away and taken back, over and over
  await page.evaluate(() => window.dispatchEvent(new Event("beforeunload")));
  await page.waitForTimeout(500);
  await expect(page.locator(".board")).toBeVisible();
  const [mine] = (await state(page)).players;
  expect([mine.user?.name, mine.away]).toEqual(["Ayşe", undefined]);
});

test("the table comes up without a ResizeObserver loop", async ({
  playwright,
  baseURL,
}, info) => {
  test.skip(info.project.name !== "desktop", "not about the layout");
  // Playwright hides scrollbars; Windows' take room, as these do
  const browser = await playwright.chromium.launch({
    ignoreDefaultArgs: ["--hide-scrollbars"],
  });
  const page = await browser.newPage({ baseURL });
  await page.addInitScript(() => {
    window.errors = [];
    addEventListener("error", (e) => window.errors.push(e.message));
    document.addEventListener("DOMContentLoaded", () =>
      document.head.insertAdjacentHTML(
        "beforeend",
        "<style>::-webkit-scrollbar { width: 17px; height: 17px }</style>",
      ),
    );
  });
  await sitDown(page);
  await table(page, "start", 4);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.errors)).toEqual([]);
  await browser.close();
});

test("a newer version on the site is offered", async ({ page }) => {
  await page.route("**/version.json", (route) =>
    route.fulfill({ json: { build: Date.now() + 60_000 } }),
  );
  await sitDown(page);
  // a dot on the menu, and in it the reload
  const menu = page.getByRole("button", { name: MENU });
  await expect(menu).toHaveClass(/news/);
  await menu.click();
  await expect(page.getByRole("button", { name: UPDATE })).toBeVisible();
  expect(await table(page, "check")).toEqual({ overlaps: [], offscreen: [] });
  const reloaded = page.waitForEvent("load");
  await page.getByRole("button", { name: UPDATE }).click();
  await reloaded;
});

test("a newer version at the table is picked up between hands", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "not about the layout");
  const room = await sitDown(page);
  await table(page, "start", 2);
  // Bora comes in on a newer build
  await secondPlayer(page, room, Date.now() + 60_000);
  await expect(page.getByRole("button", { name: MENU })).toHaveClass(/news/);
  // not in the middle of a hand
  await page.evaluate(() => (window.stayed = true));
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.stayed)).toBe(true);
  const reloaded = page.waitForEvent("load");
  await table(page, "playToEnd");
  await reloaded;
  // back in the seat, and once is enough
  await expect
    .poll(async () => (await state(page))?.players[0].user?.name)
    .toBe("Ayşe");
  await page.evaluate(() => (window.stayed = true));
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.stayed)).toBe(true);
});

test("another player's move flies across the table", async ({ page }, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "start", 4);
  await table(page, "play", 1); // my discard
  const flights = () => page.evaluate(() => window.okeyFlights ?? 0);
  const before = await flights();
  await table(page, "play", 1); // Bora draws and discards
  await expect.poll(flights).toBeGreaterThan(before);
});

test("tiles taken out of turn fly into their slots on my rack", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "start", 4);
  await table(page, "play", 2); // me, then Bora
  await table(page, "claim", 1); // Bora's discard
  const extra = (await state(page)).drawPile.at(-2).id; // under Can's draw
  // Can draws and discards: Bora's discard and the extra tile come to me,
  // each slot hidden while its tile flies there
  const hidden = await page.evaluate(async (id) => {
    (await import("/e2e/table.js")).play(1);
    const tile = () => document.querySelector(`.rack [data-tile-id="${id}"]`);
    while (!tile()) await new Promise(requestAnimationFrame);
    return tile().style.visibility;
  }, extra);
  expect(hidden).toBe("hidden");
});

// Americano: a claim on the discard, dragged off the rack, is withdrawn
test("a claim's ghost dragged off the rack withdraws it", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "start", 4);
  await table(page, "play", 2); // me, then Bora: Bora's discard on offer
  const free = (await handIds(page)).indexOf(null);
  await drag(page, page.locator('[data-pile="2"] .slot'), slot(page, free));
  await expect(slot(page, free)).toHaveClass(/ghost/);
  await drag(page, slot(page, free).locator(".tile"), await felt(page));
  await expect(slot(page, free)).not.toHaveClass(/ghost/);
  expect((await state(page)).players[0].claim).toBeNull();
  await expect(page.locator("[role=status]")).toHaveCount(0);
});

// Americano's out-of-turn takes: yours this round, beside the round's name;
// the others' aren't shown
test("your takes out of turn are counted beside the round", async ({
  page,
}) => {
  await sitDown(page);
  await table(page, "start", 4);
  await table(page, "play", 2); // me, then Bora
  await table(page, "claim", 1); // Bora's discard
  await table(page, "play", 1); // Can discards: it's mine
  await table(page, "claim", 2); // Can's discard
  await table(page, "play", 1); // Deniz discards: it's Bora's
  await expect(page.locator(".round .takes")).toHaveText(
    /^(taken|yandan) 1\/3$/,
  );
  await expect(page.locator(".round .takes")).toHaveCount(1);
  expect(await table(page, "check")).toEqual({ overlaps: [], offscreen: [] });
});

test("a discard during the others' wait is held, then thrown", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "start", 4);
  await table(page, "toMyTurn");
  // Deniz's discard is on offer from now, for 2 s
  await page.evaluate(() => {
    const s = window.okey.get();
    window.okey.set({
      ...s,
      offer: { ...s.offer, at: Date.now() },
      rules: { ...s.rules, claimWaitSeconds: 2 },
    });
  });
  const id = (await handIds(page))[5];
  const pile = page.locator('[data-pile="1"]');
  await drag(page, slot(page, 5).locator(".tile"), pile.locator(".slot"));
  // a ghost on my pile, gone from my rack, no "give the others" message
  await expect(pile.locator(`.ghost [data-tile-id="${id}"]`)).toBeVisible();
  await expect(slot(page, 5).locator(".tile")).toHaveCount(0);
  await expect(page.getByText(/Give the others|Diğerlerine/)).toHaveCount(0);
  // Bora takes Deniz's discard meanwhile
  await table(page, "claim", 2);
  await expect
    .poll(async () => (await state(page)).players[0].discardPile.at(-1)?.id)
    .toBe(id);
  const s = await state(page);
  expect(s.players[1].inbox).toHaveLength(2);
  expect(s.currentPlayer).toBe(2);
  await expect(pile.locator(".ghost")).toHaveCount(0);
});

test("between rounds a seat can be freed and taken", async ({
  page,
  browser,
}, info) => {
  anySize(info);
  const room = await sitDown(page);
  await table(page, "start", 3);
  await table(page, "playToEnd");

  // someone new opens the room and sits in the free seat
  const guest = await (await browser.newContext()).newPage();
  await sitDown(guest, { room, name: "Ece", sit: false });
  await arrived(guest);
  // once the game reaches the new tab, seat 4 is the only one free
  const free = guest.getByRole("button", { name: SIT });
  await expect(free).toHaveCount(1);
  await free.click();

  await confirm(page, FREE("Can"));
  await page.getByRole("button", { name: NEXT }).click();
  // freed from the menu, Can's seat is out of the deal; its score stays
  await expect
    .poll(async () => (await state(page)).players.map((p) => p.user?.name))
    .toEqual(["Ayşe", "Bora", "Ece"]);
  const { scores } = await state(page);
  const total = (id) => scores[id].reduce((a, b) => a + (b ?? 0), 0);
  expect(scores[3]).toHaveLength(1);
  // Ece starts level with the worst total still playing
  expect(total(4)).toBe(Math.max(total(1), total(2)));
});

test("mid-round, the round is dealt again once the seats are right", async ({
  page,
}) => {
  await sitDown(page);
  await table(page, "start", 4);
  await table(page, "toMyTurn");
  const { round } = await state(page);
  await confirm(page, REDEAL);
  await expect.poll(async () => (await state(page)).gameState).toBe("roundEnd");
  // an empty table between rounds
  expect(await table(page, "check", [".scores"])).toEqual({
    overlaps: [],
    offscreen: [],
  });
  await confirm(page, FREE("Can"));
  await page.getByRole("button", { name: NEXT }).click();
  await expect
    .poll(async () => (await state(page)).players.map((p) => p.user?.name))
    .toEqual(["Ayşe", "Bora", "Deniz"]);
  expect((await state(page)).round).toBe(round);
});

test("mid-round a seat is freed and the round plays on", async ({ page }) => {
  await sitDown(page);
  await table(page, "start", 4);
  await table(page, "toMyTurn");
  const { round, deal } = await state(page);
  await confirm(page, FREE("Bora"));
  await expect
    .poll(async () => (await state(page)).players.map((p) => p.user?.name))
    .toEqual(["Ayşe", "Can", "Deniz"]);
  const s = await state(page);
  expect([s.gameState, s.round, s.currentPlayer]).toEqual(["play", round, 1]);
  expect(s.deal).not.toBe(deal);
  await expect(page.locator('[data-seat="2"]')).toHaveCount(0);
  // my discard goes to Can, next round the table now
  await table(page, "play", 1);
  expect((await state(page)).currentPlayer).toBe(3);
  expect(await table(page, "check")).toEqual({ overlaps: [], offscreen: [] });
});

test("mid-round someone sits down from the menu, dealt from the middle pile", async ({
  page,
  browser,
}, info) => {
  anySize(info);
  const room = await sitDown(page);
  await table(page, "start", 3);
  const { drawPile, currentPlayer } = await state(page);
  // Deniz comes in mid-round: watching, the empty seat not at the table
  const deniz = await (await browser.newContext()).newPage();
  await deniz.goto(`/${room}/okey`);
  await deniz.getByRole("textbox").fill("Deniz");
  await deniz.getByRole("button", { name: GO }).click();
  await arrived(deniz);
  await expect(deniz.locator('[data-seat="4"]')).toHaveCount(0);
  expect((await state(page)).players).toHaveLength(3);
  // and sits down from the ⋯ menu: seat 4, dealt in, the turn as it was
  await confirm(deniz, SIT_IN);
  await expect
    .poll(async () => (await state(page)).players[3]?.user?.name, NET)
    .toBe("Deniz");
  const s = await state(page);
  expect(s.players[3].hand.filter(Boolean)).toHaveLength(14);
  expect(s.drawPile).toHaveLength(drawPile.length - 14);
  expect(s.currentPlayer).toBe(currentPlayer);
  await expect(deniz.locator(".rack:not(.mini) [data-tile-id]")).toHaveCount(
    14,
  );
  expect(await table(page, "check")).toEqual({ overlaps: [], offscreen: [] });
});

test("mid-round, standing leaves my hand; leaving takes it out", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "start", 4);
  await table(page, "toMyTurn");
  const hand = await handIds(page);
  // stood up from (one tap), my seat keeps its hand for whoever sits down: me again
  await page.getByRole("button", { name: MENU }).click();
  await page.getByRole("button", { name: STAND }).click();
  await expect.poll(async () => (await state(page)).players[0].user).toBeNull();
  await page.getByRole("button", { name: SIT }).click();
  await expect
    .poll(async () => (await state(page)).players[0].user?.name)
    .toBe("Ayşe");
  expect(await handIds(page)).toEqual(hand);
  // leaving: out of the round, the turn passing on
  await confirm(page, LEAVE);
  await expect
    .poll(async () => (await state(page)).players.map((p) => p.user?.name))
    .toEqual(["Bora", "Can", "Deniz"]);
  expect((await state(page)).currentPlayer).toBe(2);
});

test("someone joining sits down by themselves, in the first free seat", async ({
  page,
  browser,
}, info) => {
  anySize(info);
  // three browsers, each reaching the room in turn
  test.setTimeout(60000);
  const room = await sitDown(page);
  const other = await (await browser.newContext()).newPage();
  await sitDown(other, { room, name: "Bora", sit: false });
  // not one who only watches
  await other.waitForTimeout(1500);
  expect((await state(page)).players[1].user).toBeNull();
  const bora = await (await browser.newContext()).newPage();
  await bora.goto(`/${room}/okey`);
  await bora.getByRole("textbox").fill("Bora");
  await bora.getByRole("button", { name: GO }).click();
  await expect
    .poll(async () => (await state(page)).players[1].user?.name, NET)
    .toBe("Bora");
});

// the live signaling server, the one players find each other through (the
// other tests have one of their own): two browsers meet at a table
test("two browsers find each other through the live signaling server", async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.name !== "desktop", "one check of the server");
  const live = () => sessionStorage.setItem("signaling", "live");
  const bora = await (await browser.newContext()).newPage();
  const sockets = [];
  for (const p of [page, bora]) {
    await p.addInitScript(live);
    p.on("websocket", (ws) => sockets.push(new URL(ws.url()).host));
  }
  const room = await sitDown(page);
  await sitDown(bora, { room, name: "Bora", sit: false });
  await arrived(bora);
  expect((await state(bora)).players[0].user.name).toBe("Ayşe");
  // through the live one, not the e2e's
  expect(sockets).toContain("webrtc-signaling.fly.dev");
  expect(sockets).not.toContain("localhost:4444");
});

const BOT = /^(Add a bot|Bot ekle)$/;

test("bots fill the table and play their turns", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("botPace", "0"));
  await sitDown(page);
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: BOT }).first().click();
  }
  await expect
    .poll(async () => (await state(page)).players.filter((p) => p.user?.bot))
    .toHaveLength(3);
  expect(await table(page, "check")).toEqual({ overlaps: [], offscreen: [] });
  // a lap at Classic's pace: the lobby's Americano waits out a claim
  // after every discard
  await page.getByLabel(RULES).selectOption("classic");
  await page.getByRole("button", { name: START }).click();
  // my turn first: once I've thrown, the three bots play round to me
  await table(page, "play", 1);
  await expect
    .poll(async () => (await state(page)).currentPlayer, { timeout: 30000 })
    .toBe(1);
  // a turn ends with a discard: mine and each bot's (one may take another's)
  expect((await state(page)).discards).toBe(4);
});

test("a bot plays for someone gone, and makes way when they're back", async ({
  page,
  browser,
}, info) => {
  anySize(info);
  test.setTimeout(60000);
  await page.addInitScript(() => sessionStorage.setItem("botPace", "0"));
  const room = await sitDown(page);
  // someone watching, so this page still sees someone once Bora's gone
  const watcher = await (await browser.newContext()).newPage();
  await sitDown(watcher, { room, name: "Can", sit: false });
  const other = await (await browser.newContext()).newPage();
  await sitDown(other, { room, name: "Bora", sit: false });
  await arrived(other);
  await other
    .locator(".playerName", { hasText: /(Player|Oyuncu) 2(?!\d)/ })
    .getByRole("button", { name: SIT })
    .click();
  await expect
    .poll(async () => (await state(page)).players[1].user?.name)
    .toBe("Bora");
  // a lap at Classic's pace: the lobby's Americano waits out a claim
  // after every discard
  await page.getByLabel(RULES).selectOption("classic");
  await page.getByRole("button", { name: START }).click();
  await expect.poll(async () => (await state(page)).gameState).toBe("play");
  const bora = (await state(page)).players[1].user.id;
  // Bora closes the page: their seat waits, and a bot takes it over
  const back = other.context();
  await other.close({ runBeforeUnload: true });
  await expect.poll(async () => (await state(page)).players[1].away).toBe(bora);
  // marked away, under their name: not an empty seat
  await expect(
    page.locator(".playerName", { hasText: "Bora" }).locator(".badge.away"),
  ).toHaveText(/^(away|yok)$/);
  await page
    .locator(".playerName", { hasText: "Bora" })
    .getByRole("button", { name: BOT })
    .click();
  await table(page, "play", 1);
  await expect
    .poll(async () => (await state(page)).currentPlayer, { timeout: 20000 })
    .toBe(1);
  expect((await state(page)).discards).toBe(2);
  // Bora's back (the same login): the bot makes way, the hand theirs again
  const hand = (await state(page)).players[1].hand;
  const again = await back.newPage();
  await again.goto(`/${room}/okey`);
  await expect
    .poll(async () => (await state(page)).players[1].user?.name, NET)
    .toBe("Bora");
  expect((await state(page)).players[1].hand).toEqual(hand);
});

test("a bot plays on when the page that added it closes", async ({
  page,
  browser,
}, info) => {
  anySize(info);
  test.setTimeout(60000);
  const fast = () => sessionStorage.setItem("botPace", "0");
  await page.addInitScript(fast);
  const room = await sitDown(page);
  // Bora joins and sits; Can only watches
  const can = await (await browser.newContext()).newPage();
  await can.addInitScript(fast);
  await sitDown(can, { room, name: "Can", sit: false });
  const bora = await (await browser.newContext()).newPage();
  await bora.addInitScript(fast);
  await bora.goto(`/${room}/okey`);
  await bora.getByRole("textbox").fill("Bora");
  await bora.getByRole("button", { name: GO }).click();
  await expect
    .poll(async () => (await state(page)).players[1].user?.name, NET)
    .toBe("Bora");
  await page
    .locator(".playerName", { hasText: /(Player|Oyuncu) 3(?!\d)/ })
    .getByRole("button", { name: BOT })
    .click();
  // a lap at Classic's pace: the lobby's Americano waits out a claim
  // after every discard
  await page.getByLabel(RULES).selectOption("classic");
  await page.getByRole("button", { name: START }).click();
  // a lap: Ayşe, Bora, and the bot this page plays
  await table(page, "play", 1);
  await expect.poll(async () => (await state(bora)).currentPlayer).toBe(2);
  await table(bora, "play", 1);
  await expect.poll(async () => (await state(bora)).currentPlayer).toBe(1);
  // Ayşe's page closes: her seat waits, a bot takes it, and her bot is
  // played on by a page still here
  await page.close({ runBeforeUnload: true });
  await expect
    .poll(async () => (await state(bora)).players[0].away)
    .toBeTruthy();
  // her seat keeps her name, marked away
  await bora
    .locator(".playerName", { hasText: "Ayşe" })
    .getByRole("button", { name: BOT })
    .click();
  await expect.poll(async () => (await state(bora)).currentPlayer).toBe(2);
  await table(bora, "play", 1);
  await expect
    .poll(async () => (await state(bora)).currentPlayer, { timeout: 20000 })
    .toBe(2);
  // the first lap's three, Ayşe's bot, then Bora and both bots
  expect((await state(bora)).discards).toBe(7);
});

test("this device keeps the last two games", async ({ page }, info) => {
  anySize(info);
  await sitDown(page);
  const kept = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("okey-save") ?? "[]").map((s) => s.game),
    );
  const games = [];
  for (let i = 0; i < 3; i++) {
    if (i) await confirm(page, NEW_GAME);
    await table(page, "start", 4);
    games.unshift((await state(page)).gameId);
    // autosave waits a second: probed often, as the default backoff
    // (100, 250, 500, then 1000 ms) found it up to a second late
    await expect.poll(kept, { intervals: [100] }).toEqual(games.slice(0, 2));
  }
  await page.getByRole("button", { name: MENU }).click();
  await page.getByRole("button", { name: SAVED }).click();
  await expect(page.locator(".saves > li")).toHaveCount(2);
});

test("a save code brings the game back, and can't be read", async ({
  page,
}, info) => {
  anySize(info);
  await sitDown(page);
  await table(page, "start", 4);
  await table(page, "toMyTurn");
  const before = await handIds(page);

  await page.getByRole("button", { name: MENU }).click();
  await page.getByRole("button", { name: SAVED }).click();
  const link = page.locator(".dialog a[download]");
  await expect(link).toHaveAttribute("href", /,.{100}/);
  const code = decodeURIComponent(
    (await link.getAttribute("href")).split(",")[1],
  );
  expect(code).toMatch(/^[A-Za-z0-9+/=]+$/);
  await page.getByRole("button", { name: CLOSE }).click();

  await confirm(page, RESET);
  await expect.poll(async () => (await state(page)).gameState).toBe("start");
  await inSeat1(page); // sat down again by itself
  await page.getByRole("button", { name: MENU }).click();
  await page.getByRole("button", { name: SAVED }).click();
  await page.getByPlaceholder(PASTE).fill(code);
  await page.getByRole("button", { name: LOAD }).click();
  await page.locator(".dialog button.armed").click();
  await expect.poll(() => handIds(page)).toEqual(before);
});
