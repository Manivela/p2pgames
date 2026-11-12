import { assert, test } from "vitest";
import { newGame, play as stone, pass } from "./rules";
import bot from "./bot";

const IDS = ["a", "bot"];

// stones put by turns from a new game: `moves`, points, black first
const after = (size, ...moves) =>
  moves.reduce((s, at) => stone(s, s.turn, at), newGame(null, IDS, size));

test("it takes a stone in atari", () => {
  // black's stone on 10 (row 1, col 1) has white on 1, 9 and 11 round it
  const s = after(9, 10, 1, 40, 9, 41, 11);
  assert.equal(s.turn, 0);
  const black = stone(s, 0, 50);
  assert.equal(bot.play(black, 1).last.at, 19);
});

test("two bots play a 9×9 game to its count", () => {
  let s = newGame(null, IDS, 9);
  for (let i = 0; i < 400 && s.turn !== null; i++) s = bot.play(s, s.turn);
  assert.isNotNull(s.winner, "over by two passes");
  assert.equal(s.passes, 2);
});

test("passed to, ahead as the board stands, it passes too", () => {
  // black walls off the left: ahead of white's komi
  const s = newGame(null, IDS, 9);
  const stones = s.stones.map((_, i) => (i % 9 === 4 ? 0 : null));
  const passed = pass({ ...s, stones, turn: 1 }, 1);
  assert.equal(passed.turn, 0);
  const end = bot.play(passed, 0);
  assert.isNotNull(end.winner);
  assert.equal(end.winner.seat, 0);
});

test("it never fills its own eye", () => {
  // white's wall down column 4, an eye at 0's corner of black's... simply:
  // a lone point ringed by its own stones
  const s = newGame(null, IDS, 9);
  const stones = s.stones.slice();
  for (const p of [1, 9, 11, 19]) stones[p] = 0;
  const eye = 10;
  const game = { ...s, stones };
  for (let i = 0; i < 20; i++) assert.notEqual(bot.play(game, 0).last.at, eye);
});
