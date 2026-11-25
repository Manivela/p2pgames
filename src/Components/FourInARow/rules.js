import { lineOf } from "../Gomoku/rules";

// Four in a row: a rack seven columns wide and six high, a disc dropped
// down a column in turn, resting on the ones in it. Seat 0 plays black,
// seat 1 white, taking turns to start a game. Four or more of a side's in
// a line, across, down or diagonally, win; a full rack with no line is a
// draw.
//
// The state, the same in every page (Table: `turn`, `winner`, `score`):
// - stones: the rack's places row by row from the top, each the seat
//   whose disc is in it, or null
// - start: who began this game; turn: who drops next, null once it's over
// - winner: { seat, line }, the places of the line that won
// - back: { seat, was }, the last disc and the rack before it, its
//   maker's to take back till the other drops
// - last: { n, kind, at }, what happened last: a disc come to rest `at`,
//   an undo (Board.jsx, index.jsx)

export const WIDE = 7;
export const HIGH = 6;
const DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

// `ids`: the seated players' ids: the score carries over while the same
// two sit in the same seats, and the other starts the next game
export function newGame(prev, ids) {
  const same =
    !!prev && prev.players[0] === ids[0] && prev.players[1] === ids[1];
  // dealt again before anyone dropped: the same one starts
  const start = !same
    ? 0
    : prev.last.kind === "new"
      ? prev.start
      : 1 - prev.start;
  return {
    stones: Array(WIDE * HIGH).fill(null),
    players: ids,
    score: same ? prev.score : [0, 0],
    start,
    turn: start,
    back: null,
    winner: null,
    last: { n: (prev?.last?.n ?? 0) + 1, kind: "new" },
  };
}

// where a disc dropped down `col` comes to rest, or -1 in a full one
export function rest(stones, col) {
  for (let row = HIGH - 1; row >= 0; row--) {
    if (stones[row * WIDE + col] === null) return row * WIDE + col;
  }
  return -1;
}

// the lines through `at` of what it holds, the longest first
export const lines = (stones, at) =>
  DIRS.map((d) => lineOf(stones, at, d, WIDE)).sort(
    (a, b) => b.length - a.length,
  );

// why a disc can't go down `col`, said to the one whose turn it is
export function whyNot(state, col) {
  if (state.turn !== null && rest(state.stones, col) < 0) {
    return "That column is full";
  }
}

export function drop(state, seat, col) {
  const at = rest(state.stones, col);
  if (state.turn !== seat || at < 0) return;
  const stones = state.stones.with(at, seat);
  const [line] = lines(stones, at);
  const won = line.length > 3;
  const over = won || stones.every((s) => s !== null);
  return {
    ...state,
    stones,
    turn: over ? null : 1 - seat,
    winner: won ? { seat, line } : null,
    score: won ? state.score.with(seat, state.score[seat] + 1) : state.score,
    back: over ? null : { seat, was: { stones: state.stones } },
    last: { n: state.last.n + 1, kind: "disc", at },
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
