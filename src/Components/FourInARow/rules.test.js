import { assert, test } from "vitest";
import { HIGH, WIDE, drop, newGame, undo, whyNot } from "./rules";
import bot from "./bot";

const IDS = ["a", "b"];
// discs dropped by turns from a new game, black first: `cols`
const after = (...cols) =>
  cols.reduce((s, col) => drop(s, s.turn, col), newGame(null, IDS));
const at = (row, col) => row * WIDE + col;

test("a disc rests on the ones under it; a full column is refused", () => {
  const s = after(3, 3, 3);
  assert.deepEqual(
    [5, 4, 3].map((row) => s.stones[at(row, 3)]),
    [0, 1, 0],
  );
  const full = after(3, 3, 3, 3, 3, 3);
  assert.equal(whyNot(full, 3), "That column is full");
  assert.isUndefined(drop(full, full.turn, 3));
  assert.isUndefined(whyNot(full, 2));
});

test("four in a line wins: across, down, and both diagonals", () => {
  const across = after(0, 0, 1, 1, 2, 2, 3);
  assert.sameMembers(
    across.winner.line,
    [0, 1, 2, 3].map((c) => at(5, c)),
  );
  assert.deepEqual(across.score, [1, 0]);
  assert.isNull(across.turn);
  const down = after(0, 1, 0, 1, 0, 1, 0);
  assert.equal(down.winner.seat, 0);
  // black climbs: (5,0) (4,1) (3,2) (2,3)
  const up = after(0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3);
  assert.sameMembers(up.winner.line, [at(5, 0), at(4, 1), at(3, 2), at(2, 3)]);
  // and the other way: (5,6) (4,5) (3,4) (2,3)
  const other = after(6, 5, 5, 4, 4, 3, 4, 3, 3, 0, 3);
  assert.equal(other.winner.seat, 0);
});

test("three isn't a win, nor four round the rack's edge", () => {
  assert.isNull(after(0, 0, 1, 1, 2, 2).winner);
  // black on the bottom row's last two and, a row up, the first two
  const s = newGame(null, IDS);
  const stones = s.stones.slice();
  for (const p of [at(5, 5), at(5, 6), at(4, 0)]) stones[p] = 0;
  stones[at(5, 0)] = 1;
  stones[at(5, 1)] = 1;
  assert.isNull(drop({ ...s, stones }, 0, 1).winner);
});

test("the last disc is its maker's to take back; the other starts the next game", () => {
  const s = after(3);
  assert.isUndefined(undo(s, 1));
  const back = undo(s, 0);
  assert.isNull(back.stones[at(5, 3)]);
  assert.equal(back.turn, 0);
  assert.equal(newGame(s, IDS).turn, 1);
  assert.equal(newGame(newGame(s, IDS), IDS).turn, 1, "nobody dropped yet");
});

test("the bot takes a win, blocks one, and doesn't set one up", () => {
  // black has three along the bottom, white three on top of them
  const three = after(0, 0, 1, 1, 2, 2);
  assert.equal(bot.play(three, 0).winner.seat, 0);
  assert.equal(bot.play(after(0, 0, 1, 1, 2), 1).last.at, at(5, 3));
  // white's three along the second row: a black disc under their fourth
  // place would hand it to them
  const s = newGame(null, IDS);
  const stones = s.stones.slice();
  for (const c of [0, 1, 2]) {
    stones[at(5, c)] = c % 2;
    stones[at(4, c)] = 1;
  }
  for (let i = 0; i < 20; i++) {
    assert.notEqual(bot.play({ ...s, stones }, 0).last.at, at(5, 3));
  }
});

test("two bots play a game to its end", () => {
  let s = newGame(null, IDS);
  for (let i = 0; i < WIDE * HIGH && s.turn !== null; i++) {
    s = bot.play(s, s.turn);
  }
  assert.isNull(s.turn);
});
