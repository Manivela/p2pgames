import { expect, test } from "@playwright/test";

// Labels in English (desktop) or Turkish (phones)
const GO = /^(Go|Gir)$/;
const SIT = /^(Sit|Otur)$/;
const MENU = /^(Table menu|Masa menüsü)$/;
const RESET = /^(Reset Game|Oyunu sıfırla)$/;
const SAVED = /^(Saved games|Kayıtlı oyunlar)$/;
const CLOSE = /^(Close|Kapat)$/;
const PASTE = /Paste a save code|Kayıt kodunu yapıştır/;
const LOAD = /^(Load this game|Bu oyunu yükle)$/;
const NEXT = /^(Next Round|Sonraki el)$/;
const FREE = (name) => new RegExp(`^(Free seat|Yeri boşalt): ${name}$`);
const SEAT_1 = /(Player|Oyuncu) 1(?!\d)/;

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
    .locator(".playerName", { hasText: SEAT_1 })
    .getByRole("button", { name: SIT })
    .click();

// a fresh room each time: rooms with the same name sync over the internet
async function sitDown(page, { name = "Ayşe", room, sit = true } = {}) {
  room ??= `e2e-${Math.random().toString(36).slice(2, 10)}`;
  await page.goto(`/${room}/okey`);
  await page.getByRole("textbox").fill(name);
  await page.getByRole("button", { name: GO }).click();
  if (sit) {
    await sitInSeat1(page);
  }
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

async function drag(page, from, to) {
  const [a, b] = [await from.boundingBox(), await to.boundingBox()];
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
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
test("the draw pile makes way as the table fills", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 700 });
  await sitDown(page);
  await stages.play(page);
  const inMiddle = page.locator(".center .draw");
  await expect(inMiddle).toHaveCount(1);
  await table(page, "crowd", 16);
  await expect(inMiddle).toHaveCount(0);
  await expect(page.locator(".middle > .draw")).toHaveCount(1);
});

test("dragging picked tiles onto the table opens the hand", async ({
  page,
}) => {
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

// right click flips your tile while the round is played; once it's over,
// every hand shows face up (the rules turn them) and stays that way
test("a tile flips during play, and shows once the round is over", async ({
  page,
}) => {
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

test("the last tile is thrown to the middle to finish", async ({ page }) => {
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

test("picked tiles move together", async ({ page }) => {
  await sitDown(page);
  await table(page, "start", 4);
  const before = await handIds(page);
  for (const i of [3, 6, 9]) await slot(page, i).locator(".tile").click();
  await drag(page, slot(page, 6).locator(".tile"), slot(page, 20));
  await expect
    .poll(async () => (await handIds(page)).slice(20, 23))
    .toEqual([before[3], before[6], before[9]]);
  // they stay picked; a tap on the rack off the tiles drops the pick
  const picked = page.locator(".rack .tile.selected");
  await expect(picked).toHaveCount(3);
  await slot(page, 25).click();
  await expect(picked).toHaveCount(0);
});

test("another player's move flies across the table", async ({ page }) => {
  await sitDown(page);
  await table(page, "start", 4);
  await table(page, "play", 1); // my discard
  const flights = () => page.evaluate(() => window.okeyFlights ?? 0);
  const before = await flights();
  await table(page, "play", 1); // Bora draws and discards
  await expect.poll(flights).toBeGreaterThan(before);
});

test("a discard during the others' wait is held, then thrown", async ({
  page,
}) => {
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
  context,
}) => {
  const room = await sitDown(page);
  await table(page, "start", 3);
  await table(page, "playToEnd");

  // someone new opens the room and sits in the free seat
  const guest = await context.newPage();
  await sitDown(guest, { room, name: "Ece", sit: false });
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

test("a save code brings the game back, and can't be read", async ({
  page,
}) => {
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
  await sitInSeat1(page);
  await page.getByRole("button", { name: MENU }).click();
  await page.getByRole("button", { name: SAVED }).click();
  await page.getByPlaceholder(PASTE).fill(code);
  await page.getByRole("button", { name: LOAD }).click();
  await page.locator(".dialog button.armed").click();
  await expect.poll(() => handIds(page)).toEqual(before);
});
