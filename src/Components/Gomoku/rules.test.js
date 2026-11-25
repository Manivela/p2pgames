import { assert, test } from "vitest";
import { SIZE, newGame, play, undo, whyNot } from "./rules";
import bot from "./bot";

const IDS = ["a", "b"];
const at = (row, col) => row * SIZE + col;
// stones put by turns from a new game, black first
const after = (...moves) =>
  moves.reduce((s, p) => play(s, s.turn, p), newGame(null, IDS));
// black's `points` with white's put far off between them, along row 14
const blacks = (points) =>
  after(...points.flatMap((p, i) => [p, at(14, i * 2)]).slice(0, -1));

test("five in a line wins, each way, and scores a point", () => {
  for (const [dr, dc] of [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ]) {
    const line = [0, 1, 2, 3, 4].map((k) => at(2 + dr * k, 6 + dc * k));
    const s = blacks(line);
    assert.equal(s.winner.seat, 0);
    assert.sameMembers(s.winner.line, line);
    assert.isNull(s.turn);
    assert.deepEqual(s.score, [1, 0]);
  }
});

test("four isn't a win, nor five round the board's edge; six is", () => {
  assert.isNull(blacks([0, 1, 2, 3].map((c) => at(3, c))).winner);
  // the end of one row and the start of the next
  assert.isNull(
    blacks([at(3, 13), at(3, 14), at(4, 0), at(4, 1), at(4, 2)]).winner,
  );
  // the middle one last: six in a row
  const six = blacks([0, 1, 2, 4, 5, 3].map((c) => at(3, c)));
  assert.lengthOf(six.winner.line, 6);
});

test("a taken point is refused; the last stone is its maker's to take back", () => {
  const s = after(at(7, 7));
  assert.equal(whyNot(s, at(7, 7)), "That point is taken");
  assert.isUndefined(play(s, 1, at(7, 7)));
  assert.isUndefined(undo(s, 1));
  const back = undo(s, 0);
  assert.isNull(back.stones[at(7, 7)]);
  assert.equal(back.turn, 0);
  // the other starts the next game
  assert.equal(newGame(s, IDS).turn, 1);
});

test("a full board with no line is a draw", () => {
  // pairs along each row, the next row's the other colour: never three
  const s = newGame(null, IDS);
  const stones = s.stones.map((_, i) => {
    const [row, col] = [Math.floor(i / SIZE), i % SIZE];
    return (Math.floor(col / 2) + row) % 2;
  });
  const last = at(14, 14);
  const end = play(
    { ...s, stones: stones.with(last, null), turn: stones[last] },
    stones[last],
    last,
  );
  assert.isNull(end.winner);
  assert.isNull(end.turn);
});

test("the bot takes a win, and blocks one", () => {
  const four = [0, 1, 2, 3].map((c) => at(7, 4 + c));
  // black to move with four: wins at either end
  const win = bot.play(play(blacks(four), 1, at(0, 0)), 0);
  assert.equal(win.winner.seat, 0);
  // white to move: blocks an end
  const block = bot.play(blacks(four), 1);
  assert.include([at(7, 3), at(7, 8)], block.last.at);
});

test("two bots play a game to its end", () => {
  let s = newGame(null, IDS);
  for (let i = 0; i < SIZE * SIZE && s.turn !== null; i++) {
    s = bot.play(s, s.turn);
  }
  assert.isNull(s.turn);
});
