import { assert, test } from "vitest";
import {
  QUIET,
  hop,
  movable,
  newGame,
  plays,
  targets,
  undo,
  whyNot,
} from "./rules";

const IDS = ["a", "b"];

// A position from rows drawn as seat 0 sees them: w and b men, W and B
// kings, . empty; `turn` to move
function board(mode, rows, turn) {
  let id = 0;
  const cells = rows
    .join("")
    .split("")
    .map((ch) =>
      ch === "."
        ? null
        : {
            id: id++,
            seat: /[wW]/.test(ch) ? 0 : 1,
            king: ch === ch.toUpperCase(),
          },
    );
  return { ...newGame(null, IDS, mode), cells, turn };
}
const sq = (name) => (8 - Number(name[1])) * 8 + name.charCodeAt(0) - 97;
const go = (s, ...moves) =>
  moves.reduce((x, m) => {
    const [from, to] = m.split("-").map(sq);
    const next = hop(x, x.turn, from, to);
    assert.isDefined(next, m);
    return next;
  }, s);

test("checkers: 12 each on the dark squares, black first, seven moves", () => {
  const s = newGame(null, IDS, "checkers");
  assert.equal(s.cells.filter((p) => p?.seat === 0).length, 12);
  assert.equal(s.cells.filter((p) => p?.seat === 1).length, 12);
  assert.equal(s.turn, 1);
  assert.equal(plays(s).length, 7);
});

test("checkers: a jump has to be taken, and jumped on to the end", () => {
  const s = board(
    "checkers",
    [
      "........",
      "........",
      "...b....",
      "........",
      ".b......",
      "w.......",
      "........",
      "......w.",
    ],
    0,
  );
  assert.deepEqual(movable(s), [sq("a3")], "only the man that can jump");
  assert.equal(whyNot(s, sq("g1"), sq("h2")), "A jump has to be taken");
  const one = go(s, "a3-c5");
  assert.equal(one.turn, 0, "it jumps on");
  assert.deepEqual(targets(one, sq("c5")), [sq("e7")]);
  assert.equal(whyNot(one, sq("g1"), sq("h2")), "Jump on with the same piece");
  const two = go(one, "c5-e7");
  assert.isNull(two.turn, "black has nothing left: over");
  assert.equal(two.cells.filter((p) => p?.seat === 1).length, 0);
  assert.deepEqual(two.winner, { seat: 0 });
  assert.deepEqual(two.score, [1, 0]);
});

test("checkers: men go forward only; crowned on the far row, which ends the jumps", () => {
  const s = board(
    "checkers",
    [
      "........",
      "..b.b...",
      "........",
      "....w...",
      "........",
      "........",
      "........",
      "b.......",
    ],
    0,
  );
  assert.deepEqual(targets(s, sq("e5")).sort(), [sq("d6"), sq("f6")].sort());
  // a man jumping into the king row stops there, though a king could go on
  const t = board(
    "checkers",
    [
      "........",
      "..b.b...",
      ".w......",
      "........",
      "........",
      "........",
      "........",
      ".......b",
    ],
    0,
  );
  const crowned = go(t, "b6-d8");
  assert.equal(crowned.turn, 1);
  assert.isTrue(crowned.cells[sq("d8")].king);
  assert.isNotNull(crowned.cells[sq("e7")], "not jumped: the move ended");
});

test("dama: 16 each on the second and third rows, white first; men forward or sideways", () => {
  const s = newGame(null, IDS, "dama");
  assert.equal(s.cells.filter((p) => p?.seat === 0).length, 16);
  assert.equal(s.turn, 0);
  // the front row's men step forward; sideways is blocked by their own
  assert.equal(plays(s).length, 8);
  const t = board(
    "dama",
    [
      "........",
      "........",
      "........",
      "...w....",
      "........",
      "........",
      "........",
      "b.......",
    ],
    0,
  );
  assert.deepEqual(
    targets(t, sq("d5")).sort(),
    [sq("d6"), sq("c5"), sq("e5")].sort(),
    "not back",
  );
});

test("dama: the jump taking the most pieces has to be taken", () => {
  const s = board(
    "dama",
    [
      "........",
      "........",
      "...b....",
      "........",
      "...b.b..",
      "...w....",
      "........",
      "........",
    ],
    0,
  );
  // d3 over d4 to d5, then over d6 to d7
  assert.deepEqual(targets(s, sq("d3")), [sq("d5")]);
  const t = board(
    "dama",
    [
      "........",
      "........",
      "........",
      "........",
      "..b.....",
      "..w.wb..",
      "........",
      "...b....",
    ],
    0,
  );
  // c3 can take one (c4), e3 one (f3): either
  assert.equal(movable(t).length, 2);
  const u = board(
    "dama",
    [
      "........",
      "........",
      "..b.....",
      "........",
      "..b.....",
      "..w.wb..",
      "........",
      "........",
    ],
    0,
  );
  // c3 takes two (c4, c6), e3 one (f3): c3's only
  assert.deepEqual(movable(u), [sq("c3")]);
  assert.equal(whyNot(u, sq("e3"), sq("g3")), "Take the most pieces you can");
});

test("dama: a king flies, lands anywhere past, never turns straight back", () => {
  const k = board(
    "dama",
    [
      "...W....",
      "........",
      "........",
      "...b....",
      "........",
      "........",
      "........",
      "b.......",
    ],
    0,
  );
  // d8 down over d5, landing d4, d3, d2 or d1
  assert.deepEqual(
    targets(k, sq("d8")).sort(),
    [sq("d4"), sq("d3"), sq("d2"), sq("d1")].sort(),
  );
  // down over d3 to d2: back up over d7 would be a second, but it's
  // straight back the way it came
  const back = board(
    "dama",
    [
      "........",
      "...b....",
      "........",
      "...W....",
      "........",
      "...b....",
      "........",
      "b.......",
    ],
    0,
  );
  const down = go(back, "d5-d2");
  assert.equal(down.turn, 1, "the turn's over");
  assert.isNotNull(down.cells[sq("d7")]);
});

test("dama: a king against a lone man is a draw; so are 40 quiet moves each", () => {
  const three = go(
    board(
      "dama",
      [
        "W.......",
        "........",
        "........",
        "........",
        "........",
        "........",
        "........",
        "b......b",
      ],
      0,
    ),
    "a8-a2",
  );
  assert.isFalse(three.draw, "two men left");
  const lone = board(
    "dama",
    [
      "W.......",
      "........",
      "........",
      "........",
      "........",
      "........",
      "...b....",
      "........",
    ],
    0,
  );
  assert.isTrue(go(lone, "a8-a7").draw);
  const quiet = {
    ...board(
      "dama",
      [
        "W.......",
        "........",
        "........",
        "........",
        "........",
        "........",
        "...b..b.",
        "........",
      ],
      0,
    ),
    quiet: QUIET - 1,
  };
  const drawn = go(quiet, "a8-a7");
  assert.isTrue(drawn.draw);
  assert.isNull(drawn.turn);
  assert.isNull(drawn.winner);
});

test("a turn taken back, jumps and all, till the other moves", () => {
  const s = board(
    "checkers",
    [
      "........",
      "........",
      "...b....",
      "........",
      ".b......",
      "w.......",
      "........",
      "......wb",
    ],
    0,
  );
  const one = go(s, "a3-c5");
  const back = undo(one, 0);
  assert.deepEqual(back.cells, s.cells);
  assert.equal(back.turn, 0);
  assert.isNull(back.jumping);
  assert.isUndefined(undo(one, 1));
});
