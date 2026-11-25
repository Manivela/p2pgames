// Five in a row on Go's board (Go/Board.jsx), 15×15: seat 0 plays black,
// seat 1 white, taking turns to start a game (moving first is an edge),
// a stone each in turn on any empty point.
// Five or more of a side's in a line, across, down or diagonally, win;
// a full board with no line is a draw. Nothing is captured, nobody passes.
//
// The state, the same in every page (Table: `turn`, `winner`, `score`),
// as Go's where the board reads it:
// - stones: the points row by row, each the seat whose stone is on it, or
//   null
// - back: { seat, was }, the last move and the stones before it, its
//   maker's to take back till the other moves
// - winner: { seat, line }, the points of the line that won
// - last: { n, kind, at, off }, what happened last: a stone put `at`
//   (`off` always empty: Go's stones taken), an undo

export const SIZE = 15;
const DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

// the points in a line through `at` holding what it holds, one way
// (`dr`, `dc`) and back, never past an edge, on a board `size` wide
// (Four in a row's rack too)
export function lineOf(stones, at, [dr, dc], size = SIZE) {
  const high = stones.length / size;
  const line = [at];
  for (const way of [1, -1]) {
    let [row, col] = [Math.floor(at / size), at % size];
    for (;;) {
      row += dr * way;
      col += dc * way;
      const p = row * size + col;
      if (row < 0 || row >= high || col < 0 || col >= size) break;
      if (stones[p] !== stones[at]) break;
      line.push(p);
    }
  }
  return line;
}

// `ids`: the seated players' ids: the score carries over while the same
// two sit in the same seats
export function newGame(prev, ids) {
  const same =
    !!prev && prev.players[0] === ids[0] && prev.players[1] === ids[1];
  // the other starts the next game; dealt again before anyone moved, the
  // same one
  const start = !same
    ? 0
    : prev.last.kind === "new"
      ? prev.start
      : 1 - prev.start;
  return {
    stones: Array(SIZE * SIZE).fill(null),
    players: ids,
    score: same ? prev.score : [0, 0],
    start,
    turn: start,
    back: null,
    winner: null,
    last: { n: (prev?.last?.n ?? 0) + 1, kind: "new" },
  };
}

// why a stone can't go `at`, said to the one whose turn it is
export function whyNot(state, at) {
  if (state.turn !== null && state.stones[at] !== null) {
    return "That point is taken";
  }
}

export function play(state, seat, at) {
  if (state.turn !== seat || state.stones[at] !== null) return;
  const stones = state.stones.with(at, seat);
  const line = DIRS.map((d) => lineOf(stones, at, d)).find((l) => l.length > 4);
  const over = !!line || stones.every((s) => s !== null);
  return {
    ...state,
    stones,
    turn: over ? null : 1 - seat,
    winner: line ? { seat, line } : null,
    score: line ? state.score.with(seat, state.score[seat] + 1) : state.score,
    back: over ? null : { seat, was: { stones: state.stones } },
    last: { n: state.last.n + 1, kind: "stone", at, off: [] },
  };
}

export function undo(state, seat) {
  if (state.back?.seat !== seat) return;
  return {
    ...state,
    ...state.back.was,
    turn: seat,
    back: null,
    last: { n: state.last.n + 1, kind: "undo" },
  };
}
