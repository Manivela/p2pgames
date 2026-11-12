import { assert, test } from "vitest";
import { KOMI, SIZE, count, newGame, pass, play, undo, whyNot } from "./rules";

const IDS = ["a", "b"];
const at = (row, col) => row * SIZE + col;

// a position from rows of "b", "w" and ".", black to play
const board = (...rows) => ({
  ...newGame(null, IDS),
  stones: rows
    .join("")
    .padEnd(SIZE * SIZE, ".")
    .split("")
    .map((c) => ({ b: 0, w: 1 })[c] ?? null),
});

// moves in turn from a position: [row, col], or "pass"
const moves = (state, ...list) =>
  list.reduce(
    (s, m) => (m === "pass" ? pass(s, s.turn) : play(s, s.turn, at(...m))),
    state,
  );

test("black first, in turn; a taken point is refused", () => {
  const s = play(newGame(null, IDS), 0, at(4, 4));
  assert.equal(s.stones[at(4, 4)], 0);
  assert.equal(s.turn, 1);
  assert.isUndefined(play(s, 0, at(0, 0)), "white's turn");
  assert.equal(whyNot(s, at(4, 4)), "That point is taken");
});

test("a stone with no liberties left is taken, and counted", () => {
  // white's stone at (0,1), its last liberty (0,2)
  const s = moves(board("bw.......", ".b......."), [0, 2]);
  assert.equal(s.stones[at(0, 1)], null);
  assert.deepEqual(s.taken, [1, 0]);
  assert.deepEqual(s.last.off, [at(0, 1)]);
});

test("no stone where it has no liberties, unless it takes", () => {
  const s = board(".b.......", "b........");
  const white = { ...s, turn: 1 };
  assert.equal(whyNot(white, at(0, 0)), "That stone would have no liberties");
  assert.isUndefined(play(white, 1, at(0, 0)));
  // the same point, taking a black stone with it: allowed
  const takes = board(".bw......", "bw.......", "w........");
  assert.isUndefined(whyNot({ ...takes, turn: 1 }, at(0, 0)));
});

test("ko: the stone just taken can't be taken back at once", () => {
  // black takes white's (1,1) with (1,2), left with that one liberty
  const s = moves(board(".bw......", "bw.w.....", ".bw......"), [1, 2]);
  assert.equal(s.stones[at(1, 1)], null, "taken");
  assert.equal(whyNot(s, at(1, 1)), "Ko: play elsewhere first");
  // after a move elsewhere each, it can
  const later = moves(s, [8, 8], [8, 0]);
  assert.isUndefined(whyNot(later, at(1, 1)));
  assert.equal(play(later, 1, at(1, 1)).stones[at(1, 2)], null);
});

test("the last move is its maker's to take back till the other moves", () => {
  const s = play(newGame(null, IDS), 0, at(4, 4));
  assert.isUndefined(undo(s, 1));
  const back = undo(s, 0);
  assert.equal(back.stones[at(4, 4)], null);
  assert.equal(back.turn, 0);
  assert.isUndefined(undo(play(s, 1, at(0, 0)), 0));
});

test("two passes end it: stones and surrounded points, komi to white", () => {
  // black walls off the left three columns, white the rest
  const rows = Array.from({ length: SIZE }, () => "..bw.....");
  const s = moves(board(...rows), "pass", "pass");
  assert.equal(s.turn, null);
  assert.deepEqual(s.area, [27, 54 + KOMI]);
  assert.deepEqual(s.winner, { seat: 1, by: 54 + KOMI - 27 });
  assert.deepEqual(s.score, [0, 1]);
  assert.isUndefined(play(s, 0, at(0, 0)));
  const { owner } = count(s.stones);
  assert.equal(owner[at(0, 0)], 0);
  assert.equal(owner[at(0, 8)], 1);
});

test("a pass then a stone: passes start again from none", () => {
  const s = moves(newGame(null, IDS), "pass", [4, 4], "pass");
  assert.equal(s.turn, 1);
  assert.equal(s.passes, 1);
  assert.equal(s.winner, null);
});

test("a 19×19 board: its own size, captures at its far edge", () => {
  const big = newGame(null, IDS, "19");
  assert.equal(big.stones.length, 361);
  // white's stone in the far corner, black taking it
  const s = {
    ...big,
    stones: big.stones.with(360, 1).with(359, 0),
  };
  const taken = play(s, 0, 360 - 19);
  assert.equal(taken.stones[360], null);
  assert.deepEqual(taken.taken, [1, 0]);
  assert.equal(count(taken.stones).area[0], 361 - 0);
});
