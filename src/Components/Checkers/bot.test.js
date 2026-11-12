import { assert, test } from "vitest";
import { newGame } from "./rules";
import bot from "./bot";

const IDS = ["a", "bot"];

test("of two jumps it takes the one taking two", () => {
  // checkers, white to move: a3 over b4 and on over d6, or e3 over f4 only
  const rows = [
    "........",
    "........",
    "...b....",
    "........",
    ".b...b..",
    "w...w...",
    "........",
    "b.......",
  ];
  let id = 0;
  const cells = rows
    .join("")
    .split("")
    .map((ch) =>
      ch === "." ? null : { id: id++, seat: ch === "w" ? 0 : 1, king: false },
    );
  const s = { ...newGame(null, IDS, "checkers"), cells, turn: 0 };
  const sq = (n) => (8 - Number(n[1])) * 8 + n.charCodeAt(0) - 97;
  const next = bot.play(s, 0);
  assert.equal(next.last.from, sq("a3"));
  assert.equal(next.turn, 0, "and jumps on");
});

test("two bots play every game to its end, both kinds", () => {
  for (const mode of ["checkers", "dama"]) {
    let s = newGame(null, IDS, mode);
    let hops = 0;
    while (s.turn !== null && hops < 2000) {
      s = bot.play(s, s.turn);
      hops++;
    }
    assert.isNull(s.turn, `${mode}: over in ${hops} hops`);
  }
}, 30000);
