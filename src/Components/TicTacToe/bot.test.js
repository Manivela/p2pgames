import { assert, test } from "vitest";
import { mark, newGame } from "./rules";
import bot from "./bot";

const IDS = ["a", "bot"];
const play = (mode, ...cells) =>
  cells.reduce((s, cell) => mark(s, s.turn, cell), newGame(null, IDS, mode));

test("Classic: it takes a win, and blocks one", () => {
  // X on 0 and 1, O on 3 and 4: X to move wins on 2
  assert.equal(bot.play(play("classic", 0, 3, 1, 4), 0).last.cell, 2);
  // X on 0 and 1, O on 4: O blocks on 2
  assert.equal(bot.play(play("classic", 0, 4, 1), 1).last.cell, 2);
});

test("two bots play every game to its end, Classic and Super", () => {
  for (const mode of ["classic", "super"]) {
    let s = newGame(null, IDS, mode);
    for (let i = 0; i < 81 && s.turn !== null; i++) s = bot.play(s, s.turn);
    assert.isNull(s.turn, mode);
  }
});
