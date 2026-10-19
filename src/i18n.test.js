import { readFileSync } from "node:fs";
import { assert, test } from "vitest";
import { t } from "./i18n";

test("every message the rules return has a Turkish version", () => {
  const rules = ["game.js", "americano.js", "rulesets.js"]
    .map((f) => readFileSync(`src/Components/Okey/${f}`, "utf8"))
    .join("\n");
  const messages = [...rules.matchAll(/return "([^"]+)"/g)].map((m) => m[1]);
  assert.isNotEmpty(messages);
  for (const m of messages) assert.notEqual(t(m, true), m, m);
});

test("messages with names and numbers translate both ways", () => {
  assert.equal(
    t("Give the others 7s to take the discard", true),
    "Diğerlerine taşı almaları için 7 sn ver",
  );
  assert.equal(
    t("Ali wants Ayşe's red 4", true),
    "Ali istiyor: Ayşe · kırmızı 4",
  );
  assert.equal(
    t("Open with exactly: 3'lü küt + 3'lü seri", false),
    "Open with exactly: set of 3 + run of 3",
  );
});
