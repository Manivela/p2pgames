// Tic-tac-toe, Classic or Super (the table's mode, index.jsx). Seat 0
// plays X, seat 1 O, taking turns to start a game. Super is nine small
// boards in a big one: a mark sends the other to the small board where it
// sits in its own (a top right square, the top right board), or anywhere
// open once that one's decided; three in a row in a small board takes it,
// three boards in a row win.
//
// The state, the same in every page (Table: `turn`, `winner`, `score`):
// - cells: the squares, row by row (Super: board by board), each the seat
//   that marked it, or null
// - boards (Super): each small board's: the seat that took it, -1 full
//   with no row, null still open; next: the one the next mark goes in, or
//   null for any open one
// - start: who began this game; turn: who marks next, null once it's over
// - winner: { seat, line }, the three squares (Super: boards) in a row
// - back: { seat, was }, the last mark and what was before it, its
//   maker's to take back till the other marks
// - last: { n, kind, cell, took }, what happened last (`took`: a board
//   with it), for the sounds and the ink (index.jsx, Sheet.jsx); sheet:
//   the game's own n, a fresh sheet of paper each game

export const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

// `ids`: the seated players' ids: the score carries over while the same
// two sit in the same seats, and the other starts the next game
export function newGame(prev, ids, mode = "classic") {
  const same =
    !!prev && prev.players[0] === ids[0] && prev.players[1] === ids[1];
  // dealt again before anyone marked (another mode): the same one starts
  const start = !same
    ? 0
    : prev.last.kind === "new"
      ? prev.start
      : 1 - prev.start;
  const n = (prev?.last?.n ?? 0) + 1;
  const big = mode === "super";
  return {
    mode,
    cells: Array(big ? 81 : 9).fill(null),
    boards: big ? Array(9).fill(null) : null,
    next: null,
    players: ids,
    score: same ? prev.score : [0, 0],
    start,
    turn: start,
    winner: null,
    back: null,
    last: { n, kind: "new" },
    sheet: n,
  };
}

// three of a seat's in a row (not -1's, full boards')
const rowOf = (cells) =>
  LINES.find(
    ([a, b, c]) =>
      cells[a] !== null &&
      cells[a] >= 0 &&
      cells[a] === cells[b] &&
      cells[a] === cells[c],
  );

// why a square can't be marked
function closed({ cells, boards, next }, cell) {
  if (cells[cell] !== null) return "That square is taken";
  if (!boards) return;
  const board = Math.floor(cell / 9);
  if (boards[board] !== null) return "That board is decided";
  if (next !== null && next !== board) return "Play in the lit board";
}

export function mark(state, seat, cell) {
  if (state.turn !== seat || closed(state, cell)) return;
  const cells = state.cells.with(cell, seat);
  let { boards, next } = state;
  let took = false;
  if (boards) {
    const board = Math.floor(cell / 9);
    const small = cells.slice(board * 9, board * 9 + 9);
    took = !!rowOf(small);
    if (took) boards = boards.with(board, seat);
    else if (small.every((c) => c !== null)) boards = boards.with(board, -1);
    next = boards[cell % 9] === null ? cell % 9 : null;
  }
  const line = rowOf(boards ?? cells);
  const over = !!line || (boards ?? cells).every((c) => c !== null);
  return {
    ...state,
    cells,
    boards,
    next,
    turn: over ? null : 1 - seat,
    winner: line ? { seat, line } : null,
    score: line ? state.score.with(seat, state.score[seat] + 1) : state.score,
    back: over
      ? null
      : {
          seat,
          was: { cells: state.cells, boards: state.boards, next: state.next },
        },
    last: { n: state.last.n + 1, kind: "mark", cell, took },
  };
}

// why a tap on `cell` marks nothing, said to the one whose turn it is
export function whyNot(state, cell) {
  if (state.turn !== null) return closed(state, cell);
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
