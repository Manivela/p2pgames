// The table's seats in the e2e tests (Table, src/Components/Table): labels
// in English (desktop) or Turkish (phones)
import { expect } from "@playwright/test";

export const SIT = /^(Sit|Otur)$/;
export const BOTH = /^(Play both sides|İki tarafı da oyna)$/;
export const MENU = /^(Table menu|Masa menüsü)$/;
export const FACING = /^(Face to face|Karşılıklı)$/;
export const NEXT = /^(Next game|Sonraki oyun)$/;
// the other's seat may come over the network after the page: slowly with
// the whole suite running at once
export const NET = { timeout: 30000 };

export const room = (game) =>
  `e2e-${game}-${Math.random().toString(36).slice(2, 10)}`;

// a page at `game` in `room`, named, its seat taken (0 or 1)
export async function sitDown(browser, info, room, game, name, seat) {
  const { viewport, hasTouch, locale } = info.project.use;
  const context = await browser.newContext({ viewport, hasTouch, locale });
  const page = await context.newPage();
  await page.goto(`/${room}/${game}`);
  await page.getByRole("textbox").fill(name);
  await page.getByRole("button", { name: /^(Go|Gir)$/ }).click();
  const sit = page.locator(".tb-plate").getByRole("button", { name: SIT });
  // the board lists the far seat first, the first seat's for a page that
  // hasn't sat
  await sit.nth(seat ? 0 : 1).click();
  return page;
}

// one page sitting in both seats, face to face or not
export async function bothSides(page, facing) {
  await page.getByRole("button", { name: MENU }).click();
  await page.getByRole("button", { name: BOTH }).click();
  if (!facing) return;
  await page.getByRole("button", { name: MENU }).click();
  await page.getByRole("checkbox", { name: FACING }).check();
  await page.locator(".tb-menu .backdrop").click();
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

export { expect };
