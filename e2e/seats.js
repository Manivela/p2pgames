// The table's seats in the e2e tests (Table, src/Components/Table): labels
// in English (desktop) or Turkish (phones)

export const SIT = /^(Sit|Otur)$/;
export const BOTH = /^(Play both sides|İki tarafı da oyna)$/;
export const MENU = /^(Table menu|Masa menüsü)$/;
export const FACING = /^(Face to face|Karşılıklı)$/;
export const NEXT = /^(Next game|Sonraki oyun)$/;
export const START = /^(Start|Başlat)$/;
export const SETTINGS = /^(Settings|Ayarlar)$/;
// whose presses start the next round (Settings.jsx): all, half or off
export const WAIT_ALL = /^(Next round waits for|Sonraki el kimi bekler)$/;
export const READY = /^(ready|hazır)$/;
export const HINTS = /^(Key hints|Tuş ipuçları)$/;
// a ready check after a break (⋯, hooks/useRoom.js): its item, its end, each
// player's Ready, a move tried meanwhile, and how it ends
export const CHECK = /^(Ready check|Hazır mısınız\?)$/;
export const END_CHECK = /^(End the ready check|Beklemeyi bitir)$/;
export const BACK = /^(Ready|Hazırım)$/;
export const WAITING =
  /^(Waiting for everyone to be ready|Herkesin hazır olması bekleniyor)$/;
export const ALL_BACK = /^(Everyone's ready|Herkes hazır)$/;
export const CHECK_ENDED = /^(Ready check ended|Bekleme bitti)$/;
// on to the next round or game without the rest's press (⋯)
export const GO_ON = /^(Go on without waiting|Beklemeden devam et)$/;
export const SOUND = /^(Sound|Ses)$/;
export const LANGUAGE = /^(Language|Dil)$/;

// a table's ⋯ → Settings (Settings.jsx, Okey's too), closed with Escape
export async function settings(page) {
  await page.getByRole("button", { name: MENU }).click();
  await page.getByRole("button", { name: SETTINGS }).click();
}

// why the menu can't take the room to another game, or mode, now
export const IN_PLAY =
  /^(A game is in play: finish it, or start a new one in ⋯|Oyun sürüyor: bitirin ya da ⋯ menüsünden yenisini başlatın)$/;
export const PLAYERS_ONLY =
  /^(Only the players can change the game|Oyunu yalnızca oynayanlar değiştirebilir)$/;
// the other's seat may come over the network after the page: slowly with
// the whole suite running at once
export const NET = { timeout: 30000 };

export const room = (game) =>
  `e2e-${game}-${Math.random().toString(36).slice(2, 10)}`;

// a game in the site's menu (Menu.jsx), by its tile's name, picked: the
// room goes there, everyone in it, as its table allows
export async function pick(page, name) {
  await page.getByRole("button", { name: /^(Menu|Menü)$/ }).click();
  await page.locator(".site-menu .games").getByRole("button", { name }).click();
}

// each game's first way to play, as the menu names it
const FIRST = {
  tictactoe: /^(Tic-tac-toe Classic|XOX Klasik)$/,
  backgammon: /^(Backgammon|Tavla)$/,
  go: /^Go$/,
  batak: /^Batak$/,
};
const made = new Set();

// a page in `room`, named, watching, at `game`: the room's first page
// takes it there (a room plays Okey till then), not waiting to hear from
// others first (sessionStorage alone, root.jsx); the others find it there
// once it comes over the network
export async function enter(browser, info, room, game, name) {
  const { viewport, hasTouch, locale } = info.project.use;
  const context = await browser.newContext({ viewport, hasTouch, locale });
  const page = await context.newPage();
  await page.goto(`/${room}`);
  const first = !made.has(room);
  made.add(room);
  if (first)
    await page.evaluate((r) => sessionStorage.setItem("alone", r), room);
  await page.getByRole("textbox").fill(name);
  await page.getByRole("button", { name: /^(Go|Gir)$/ }).click();
  if (first && FIRST[game]) await pick(page, FIRST[game]);
  return page;
}

// a page at `game` in `room`, named, its seat taken (0 or 1)
export async function sitDown(browser, info, room, game, name, seat) {
  const page = await enter(browser, info, room, game, name);
  const sit = page.locator(".tb-plate").getByRole("button", { name: SIT });
  // the board lists the far seat first, the first seat's for a page that
  // hasn't sat
  await sit.nth(seat ? 0 : 1).click();
  return page;
}

export const BOT = /^(Add a bot|Bot ekle)$/;

// a page in the first seat, a bot in the other, its moves 100 ms apart
export async function againstBot(browser, info, room, game) {
  const page = await sitDown(browser, info, room, game, "Ayşe", 0);
  await page.evaluate(() => sessionStorage.setItem("botPace", "100"));
  await page.getByRole("button", { name: BOT }).click();
  return page;
}

// one page sitting in both seats, face to face or not
export async function bothSides(page, facing) {
  await page.getByRole("button", { name: MENU }).click();
  await page.getByRole("button", { name: BOTH }).click();
  if (!facing) return;
  await settings(page);
  await page.getByRole("checkbox", { name: FACING }).check();
  await page.keyboard.press("Escape");
}

// the most of `selector` animating at once, each frame for `ms`: long
// enough for the game to come over the network after a reload
export const moving = (page, selector, ms = 5000) =>
  page.evaluate(
    async ([selector, ms]) => {
      let most = 0;
      for (const start = performance.now(); performance.now() - start < ms;) {
        const els = document.querySelectorAll(selector);
        const now = [...els].filter((el) => el.getAnimations().length).length;
        most = Math.max(most, now);
        await new Promise(requestAnimationFrame);
      }
      return most;
    },
    [selector, ms],
  );
