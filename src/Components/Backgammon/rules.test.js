import { assert, test } from "vitest";
import {
  BAR,
  OFF,
  move,
  newGame,
  pips,
  roll,
  sources,
  targets,
  undo,
  whyNot,
} from "./rules";

const IDS = ["a", "b"];

// a seat's checkers from { point: count }
const seat = (points) => {
  const s = Array(26).fill(0);
  for (const [n, c] of Object.entries(points)) s[n] = c;
  return s;
};

// white (seat 0) to play `dice` with these checkers
const position = (white, black, dice) =>
  roll(
    {
      ...newGame(null, IDS, [6, 1]),
      checkers: [seat(white), seat(black)],
      left: [],
    },
    0,
    dice,
  );

const reach = (state, from) =>
  Object.fromEntries(
    [...targets(state, from)].map(([to, steps]) => [to, steps.length]),
  );

test("a new game: the higher opening die starts, playing both", () => {
  const g = newGame(null, IDS, [2, 5]);
  assert.equal(g.turn, 1);
  assert.deepEqual(g.left, [2, 5]);
  assert.equal(pips(g.checkers[0]), 167);
  assert.equal(pips(g.checkers[1]), 167);
  assert.isUndefined(roll(g, 1), "the opening dice are played first");
});

test("3-2 reaches 3, 2 and, in one go, 5", () => {
  const s = position({ 13: 1, 6: 14 }, { 24: 15 }, [3, 2]);
  assert.deepEqual(reach(s, 13), { 11: 1, 10: 1, 8: 2 });
  const after = move(s, 0, 13, 8);
  assert.equal(after.checkers[0][8], 1);
  assert.equal(after.checkers[0][13], 0);
  assert.equal(after.turn, 1, "both dice played: the turn passes");
  assert.deepEqual(after.left, []);
});

test("the sum isn't offered when both points between are blocked", () => {
  // black holds white's 11 and 10 (its own 14 and 15)
  const s = position({ 13: 1, 6: 14 }, { 14: 2, 15: 2, 24: 11 }, [3, 2]);
  assert.deepEqual(reach(s, 13), {});
  // one open point between is enough
  const t = position({ 13: 1, 6: 14 }, { 14: 2, 24: 13 }, [3, 2]);
  assert.deepEqual(reach(t, 13), { 10: 1, 8: 2 });
});

test("doubles reach every multiple, and a blot passed over is hit", () => {
  // a black blot on white's 9 (black's 16)
  const s = position({ 13: 1, 6: 14 }, { 16: 1, 24: 14 }, [2, 2]);
  assert.deepEqual(reach(s, 13), { 11: 1, 9: 2, 7: 3, 5: 4 });
  const after = move(s, 0, 13, 5);
  assert.equal(after.checkers[1][16], 0);
  assert.equal(after.checkers[1][BAR], 1);
  assert.equal(after.last.steps, 4);
});

test("from the bar first, and further only when it's the one there", () => {
  const one = position({ [BAR]: 1, 6: 14 }, { 24: 15 }, [4, 3]);
  assert.deepEqual(sources(one), [BAR]);
  assert.deepEqual(reach(one, BAR), { 21: 1, 22: 1, 18: 2 });
  const two = position({ [BAR]: 2, 6: 13 }, { 24: 15 }, [4, 3]);
  assert.deepEqual(reach(two, BAR), { 21: 1, 22: 1 });
  // black's home blocked where the 4 enters: only the 3
  const blocked = position({ [BAR]: 1, 6: 14 }, { 4: 2, 24: 13 }, [4, 3]);
  assert.deepEqual(reach(blocked, BAR), { 22: 1, 18: 2 });
});

test("bearing off: exactly, or the furthest checker with a bigger die", () => {
  const s = position({ 5: 1, 3: 1, 2: 13 }, { 24: 15 }, [6, 3]);
  assert.deepEqual(reach(s, 3), { [OFF]: 1 });
  assert.deepEqual(reach(s, 5), { [OFF]: 1, 2: 1 });
  // not while a checker is outside home
  const out = position({ 7: 1, 3: 14 }, { 24: 15 }, [3, 1]);
  assert.deepEqual(reach(out, 3), { 2: 1 });
  assert.deepEqual(reach(out, 7), { 4: 1, 6: 1, 3: 2 });
});

test("both dice must be played when they can", () => {
  // black holds white's 6 and 3: 13 -1-> 12 leaves the 6 unplayable, so
  // the 1 is played from 9 or after the 6
  const s = position({ 13: 1, 9: 1, 1: 13 }, { 19: 2, 22: 2, 1: 11 }, [6, 1]);
  assert.deepEqual(reach(s, 13), { 7: 1 });
  assert.deepEqual(reach(s, 9), { 8: 1, 2: 2 });
  assert.equal(
    whyNot(s, 13, 12),
    "Every die that can be played has to be played",
  );
  assert.isUndefined(whyNot(s, 13, 11), "no die lands there");
  assert.isUndefined(whyNot(s, 13), "it can move");
  assert.isUndefined(whyNot(s, 13, 7), "it can go there");
});

test("only one die playable of two: the higher, if it can", () => {
  // black holds white's 6: after either die the other is stuck
  const s = position({ 13: 1, 1: 14 }, { 19: 2, 1: 13 }, [6, 1]);
  assert.deepEqual(reach(s, 13), { 7: 1 });
  assert.equal(
    whyNot(s, 13, 12),
    "Only one die can be played: it has to be the higher one",
  );
});

test("why a checker can't move: the bar first, home before bearing off", () => {
  const bar = position({ [BAR]: 1, 13: 1, 6: 13 }, { 24: 15 }, [4, 3]);
  assert.equal(whyNot(bar, 13), "Play your checker on the bar first");
  const out = position({ 7: 1, 3: 14 }, { 24: 15 }, [4, 1]);
  assert.equal(
    whyNot(out, 3, OFF),
    "Bring every checker home before bearing off",
  );
});

test("no moves: the dice stay up and the turn passes", () => {
  // white on the bar, black's whole home closed
  const s = position(
    { [BAR]: 1, 6: 14 },
    { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 5 },
    [3, 5],
  );
  assert.equal(s.turn, 1);
  assert.deepEqual(s.dice, [3, 5]);
  assert.deepEqual(s.left, []);
  assert.equal(s.by, 0);
});

test("only the player to move rolls and moves", () => {
  const g = newGame(null, IDS, [5, 2]);
  assert.isUndefined(roll(g, 1));
  assert.isUndefined(move(g, 1, 24, 19));
  assert.isUndefined(move(g, 0, 13, 4), "not a target");
  assert.isOk(move(g, 0, 13, 8));
});

test("undo takes a move back, also after the turn passed, till the roll", () => {
  const s = position({ 13: 1, 6: 14 }, { 24: 15 }, [3, 2]);
  const one = move(s, 0, 13, 10);
  const two = move(one, 0, 10, 8);
  assert.equal(two.turn, 1);
  assert.isUndefined(undo(two, 1), "only the roller undoes");
  const back = undo(two, 0);
  assert.equal(back.turn, 0);
  assert.deepEqual(back.left, [2]);
  assert.deepEqual(back.checkers, one.checkers);
  assert.deepEqual(undo(back, 0).checkers, s.checkers);
  const rolled = roll(two, 1, [1, 2]);
  assert.isUndefined(undo(rolled, 0));
});

test("bearing off the last checker wins once: mars counts two", () => {
  const s = position({ 1: 1, [OFF]: 14 }, { 19: 15 }, [1, 2]);
  const won = move(s, 0, 1, OFF);
  assert.deepEqual(won.winner, { seat: 0, points: 2 });
  assert.deepEqual(won.score, [2, 0]);
  assert.isUndefined(roll(won, 1));
  assert.isUndefined(undo(won, 0));
  // black has borne one off: a plain win
  const plain = move(
    { ...s, checkers: [seat({ 1: 1, [OFF]: 14 }), seat({ 3: 14, [OFF]: 1 })] },
    0,
    1,
    OFF,
  );
  assert.deepEqual(plain.winner, { seat: 0, points: 1 });
  // the score carries over to the next game with the same pair only
  assert.deepEqual(newGame(won, IDS).score, [2, 0]);
  assert.deepEqual(newGame(won, ["a", "c"]).score, [0, 0]);
});
