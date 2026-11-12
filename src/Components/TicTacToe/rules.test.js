import { assert, test } from "vitest";
import { mark, newGame, undo, whyNot } from "./rules";

const IDS = ["a", "b"];

// marks the cells in turn from a new game, X (seat 0) first
const play = (...cells) =>
  cells.reduce((s, cell) => mark(s, s.turn, cell), newGame(null, IDS));

test("X starts, the two take turns, a taken square is refused", () => {
  const s = play(4);
  assert.equal(s.cells[4], 0);
  assert.equal(s.turn, 1);
  assert.isUndefined(mark(s, 0, 0), "not X's turn");
  assert.isUndefined(mark(s, 1, 4));
  assert.equal(whyNot(s, 4), "That square is taken");
  assert.isUndefined(whyNot(s, 0));
});

test("three in a row wins, scores, and ends the game", () => {
  const s = play(0, 3, 1, 4, 2);
  assert.deepEqual(s.winner, { seat: 0, line: [0, 1, 2] });
  assert.equal(s.turn, null);
  assert.deepEqual(s.score, [1, 0]);
  assert.isUndefined(mark(s, 1, 8));
  assert.isUndefined(whyNot(s, 0), "over: nothing to say");
});

test("a full board with no row is a draw", () => {
  const s = play(0, 1, 2, 4, 3, 5, 7, 6, 8);
  assert.equal(s.winner, null);
  assert.equal(s.turn, null);
  assert.deepEqual(s.score, [0, 0]);
});

test("the last mark is its maker's to take back, till the other marks", () => {
  const s = play(4);
  assert.isUndefined(undo(s, 1));
  const back = undo(s, 0);
  assert.equal(back.cells[4], null);
  assert.equal(back.turn, 0);
  assert.isUndefined(undo(back, 0), "once");
  assert.isUndefined(undo(mark(s, 1, 0), 0), "O has marked");
  assert.isUndefined(undo(play(0, 3, 1, 4, 2), 0), "not a win");
});

test("the next game: the other starts, the score carries while they sit", () => {
  const won = play(0, 3, 1, 4, 2);
  const next = newGame(won, IDS);
  assert.equal(next.turn, 1);
  assert.deepEqual(next.score, [1, 0]);
  assert.equal(newGame(mark(next, 1, 4), IDS).turn, 0);
  // dealt again before anyone marked: the same one starts
  assert.equal(newGame(next, IDS, "super").turn, 1);
  const others = newGame(won, ["a", "c"]);
  assert.equal(others.turn, 0);
  assert.deepEqual(others.score, [0, 0]);
});

// Super: marks in turn by board and square
const playSuper = (...moves) =>
  moves.reduce(
    (s, [board, square]) => mark(s, s.turn, board * 9 + square),
    newGame(null, IDS, "super"),
  );

test("Super: a mark sends the other to the board where it sits", () => {
  const s = playSuper([4, 2]);
  assert.equal(s.cells.length, 81);
  assert.equal(s.next, 2);
  assert.equal(whyNot(s, 0 * 9 + 0), "Play in the lit board");
  assert.isUndefined(mark(s, 1, 0));
  assert.equal(mark(s, 1, 2 * 9 + 4).next, 4);
});

test("Super: a row takes a board; sent to a decided one, anywhere open", () => {
  // X takes board 0 with its middle row, O sending X back each time
  const t = playSuper([0, 4], [4, 0], [0, 3], [3, 0], [0, 5]);
  assert.equal(t.boards[0], 0);
  assert.isTrue(t.last.took);
  // O sent to board 5, plays 0: X sent to the decided board 0, anywhere
  const u = mark(t, 1, 5 * 9 + 0);
  assert.equal(u.next, null);
  assert.equal(whyNot(u, 0 * 9 + 8), "That board is decided");
  assert.isUndefined(whyNot(u, 7 * 9 + 7));
});

test("Super: three boards in a row win", () => {
  const won = (boards) => ({
    ...newGame(null, IDS, "super"),
    boards,
  });
  // X holds boards 0 and 1, and is one square from board 2's top row
  const s = {
    ...won([0, 0, null, null, null, null, null, null, null]),
    cells: Array(81).fill(null).with(18, 0).with(19, 0),
    next: 2,
  };
  const end = mark(s, 0, 20);
  assert.deepEqual(end.winner, { seat: 0, line: [0, 1, 2] });
  assert.equal(end.turn, null);
  assert.deepEqual(end.score, [1, 0]);
});
