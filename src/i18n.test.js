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
    t("Open with 101+ or 5 pairs", true),
    "101+ sayıyla ya da 5 çiftle aç",
  );
  assert.equal(
    t("Open with exactly: 3'lü küt + 3'lü seri", false),
    "Open with exactly: set of 3 + run of 3",
  );
  assert.equal(t("No tiles left", true), "Taş kalmadı"); // not "(.+) left"
  assert.equal(
    t("Ayşe put the tile back: +101", true),
    "Ayşe taşı geri bıraktı: +101",
  );
  assert.equal(
    t("You opened with pairs: 2 tiles a turn", true),
    "Çift açtın: elde en fazla 2 taş işlersin",
  );
  assert.equal(t("Ali & Can win with 38", true), "Ali & Can kazandı: 38");
  assert.equal(t("Elden", false), "from hand");
  assert.equal(t("Elden", true), "Elden");
});
