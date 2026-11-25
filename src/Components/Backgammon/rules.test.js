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
  best,
  forced,
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

test("of two ways to the same spot, the one with fewer dice", () => {
  // 2-5 (rolled in that order) on 3 and 1: the 5 bears off the 3, not 2 then 5
  const s = position({ 3: 1, 1: 1, [OFF]: 13 }, { 1: 15 }, [2, 5]);
  assert.deepEqual(reach(s, 3), { [OFF]: 1, 1: 1 });
  const after = move(s, 0, 3, OFF);
  assert.equal(after.checkers[0][1], 1, "the 1 stays, for the 2");
  assert.deepEqual(after.left, [2]);
});

test("of two ways hitting as much, the game picks the better die first", () => {
  // black blots on white's 10 and 11 (its own 15 and 14): 13 to 8 hits
  // one on the way either die first; the one further on costs black more
  const s = position({ 13: 1, 6: 14 }, { 15: 1, 14: 1, 1: 13 }, [3, 2]);
  assert.deepEqual(
    targets(s, 13)
      .get(8)
      .map((x) => x.die),
    [2, 3],
  );
  const after = move(s, 0, 13, 8);
  assert.equal(after.checkers[1][14], 0);
  assert.equal(after.checkers[1][15], 1);
});

test("a double tap's move: a die at a time, toward the best the turn comes to", () => {
  // 13 to 11 with the 2 hits black's blot there (its 14); the 3 hits none
  const s = position({ 13: 1, 6: 14 }, { 14: 1, 1: 14 }, [3, 2]);
  assert.equal(best(s, 13), 11);
  // nothing to move from an empty point
  assert.isUndefined(best(s, 20));
});

test("forced: one way to play, or every way leaving the same board", () => {
  // a lone checker: 3 then 2 or 2 then 3, the same board
  const lone = position({ 13: 1, [OFF]: 14 }, { 1: 15 }, [3, 2]);
  assert.deepEqual(forced(lone).from, 13);
  // a blot on the way one die first: a choice
  const blot = position({ 13: 1, [OFF]: 14 }, { 14: 1, 1: 14 }, [3, 2]);
  assert.isUndefined(forced(blot));
  // two checkers: a choice
  assert.isUndefined(forced(position({ 13: 1, 6: 14 }, { 1: 15 }, [3, 2])));
  // bearing off the last two, either first
  const off = position({ 2: 1, 1: 1, [OFF]: 13 }, { 24: 15 }, [6, 5]);
  assert.equal(forced(off).to, OFF);
  // nothing rolled: nothing forced
  assert.isUndefined(forced({ ...lone, left: [] }));
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
  // and its winner starts it, with a roll of both dice
  const next = newGame(won, IDS);
  assert.equal(next.turn, 0);
  assert.deepEqual(next.left, []);
  assert.isNull(next.winner);
  assert.equal(pips(next.checkers[1]), 167);
  assert.deepEqual(roll(next, 0, [3, 1]).left, [3, 1]);
  assert.isOk(newGame(won, ["a", "c"]).opening, "new players: an opening roll");
  // nothing else of the last game's comes along (the table's `touched`)
  assert.isUndefined(newGame({ ...won, touched: true }, IDS).touched);
  // after checkers on the back of the case, no dice lying: an opening roll
  const checkers = {
    players: IDS,
    score: [1, 0],
    winner: { seat: 0 },
    mode: "checkers",
    last: { n: 9, kind: "hop" },
  };
  assert.lengthOf(newGame(checkers, IDS).dice, 2);
  assert.isOk(newGame(checkers, IDS).opening);
  assert.deepEqual(newGame(won, ["a", "c"]).score, [0, 0]);
});
