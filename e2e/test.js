import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";

// Playwright's test, with every page a test opened closed once it's over.
// The contexts a test opens on the worker's browser (each player's, in
// seats.js, a guest's) outlive it otherwise: their bots and syncing run on
// through the worker's later tests, a few more each test, till the late
// ones time out. Torn down last, after Playwright's own page.
export const test = base.extend({
  closeContexts: [
    async ({ browser }, use) => {
      await use();
      await Promise.all(browser.contexts().map((c) => c.close()));
    },
    { auto: true },
  ],
});
