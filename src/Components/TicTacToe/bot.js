import { LINES, mark } from "./rules";

// A bot (Table's): two plies, each of its marks against the other's best
// answer. Classic: it wins when it can and blocks when it must, and is
// beaten by a fork, as a fair player is. Super: as well, the boards held
// and nearly held, and where a mark sends the other.

// the squares the one to move may mark, and the state after each
const moves = (s) =>
  s.cells.flatMap((_, i) => {
    const next = mark(s, s.turn, i);
    return next ? [[i, next]] : [];
  });

// rows of three that `seat` holds two of, the third open, and the other's
function twos(cells, seat) {
  let v = 0;
  for (const line of LINES) {
    const marks = line.map((i) => cells[i]);
    const mine = marks.filter((c) => c === seat).length;
    const theirs = marks.filter((c) => c === 1 - seat).length;
    const open = marks.filter((c) => c === null).length;
    if (open === 1 && mine === 2) v++;
    if (open === 1 && theirs === 2) v--;
  }
  return v;
}

// how good `s` is for `seat`: a win, and in Super the boards
function value(s, seat) {
  if (s.winner) return s.winner.seat === seat ? 1000 : -1000;
  if (!s.boards || s.turn === null) return 0;
  // big rows its boards make, and the other's, none of the other's in it
  let v = 0;
  for (const line of LINES) {
    const held = line.map((b) => s.boards[b]);
    if (held.includes(-1)) continue;
    const mine = held.filter((b) => b === seat).length;
    const theirs = held.filter((b) => b === 1 - seat).length;
    if (!theirs) v += [0, 2, 8][mine];
    if (!mine) v -= [0, 2, 8][theirs];
  }
  s.boards.forEach((b, board) => {
    if (b === null) v += twos(s.cells.slice(board * 9, board * 9 + 9), seat);
  });
  // sent to a decided board, the one to move marks anywhere
  if (s.next === null) v += s.turn === seat ? 3 : -3;
  return v;
}

// Classic, between marks as good: the middle, then the corners
const PLACE = [0.5, 0, 0.5, 0, 1, 0, 0.5, 0, 0.5];

function play(state, seat) {
  let best;
  let top = -Infinity;
  for (const [i, after] of moves(state)) {
    const answers = after.turn === null ? [] : moves(after);
    const v =
      (answers.length
        ? Math.min(...answers.map(([, a]) => value(a, seat)))
        : value(after, seat)) +
      (state.boards ? 0 : PLACE[i]) +
      Math.random() * 0.3;
    if (v > top) [top, best] = [v, after];
  }
  return best;
}

export default { play };
