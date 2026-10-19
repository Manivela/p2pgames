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
    .locator(".rack", { hasText: SEAT_1 })
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

test("dragging picked tiles onto the table opens the hand", async ({
  page,
}) => {
  await sitDown(page);
  await table(page, "start", 4);
  await table(page, "toMyTurn");
  // the küt is dealt into my first three slots
  for (const i of [0, 1, 2]) await slot(page, i).locator(".tile").click();
  await expect(page.locator(".melds.droppable")).toBeVisible();
  await drag(page, slot(page, 1).locator(".tile"), page.locator(".melds"));
  await expect.poll(async () => (await state(page)).melds.length).toBe(1);
  expect((await state(page)).opened[1]).toBeTruthy();
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
