import { assert, test } from "vitest";
import { newGame, roll } from "./rules";
import bot, { value } from "./bot";

const IDS = ["a", "bot"];

test("it rolls, then plays the dice through the rules", () => {
  let s = newGame(null, IDS, [3, 1]);
  // white opens 3-1: the 8 and 6 points to 5
  s = bot.play(bot.play(s, 0), 0);
  assert.equal(s.checkers[0][5], 2, "the five point made");
  assert.equal(s.turn, 1);
  assert.equal(bot.play(s, 1).last.kind, "roll");
});

test("a blot in reach is worth less than one out of it", () => {
  const near = newGame(null, IDS).checkers.map((c) => [...c]);
  const far = near.map((c) => [...c]);
  // white's 6 to 18 (in reach of black's back checkers), or to 23
  near[0][6]--;
  near[0][18]++;
  far[0][6]--;
  far[0][23]++;
  assert.isBelow(value(near, 0) - 5, value(far, 0) + 1);
});

test("two bots play a game to its end", () => {
  let s = newGame(null, IDS);
  for (let i = 0; i < 3000 && !s.winner; i++) s = bot.play(s, s.turn);
  assert.isNotNull(s.winner);
  assert.isUndefined(roll(s, s.turn), "over");
});
