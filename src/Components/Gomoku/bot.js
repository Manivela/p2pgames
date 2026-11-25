import { SIZE, lineOf, play as stone } from "./rules";

// A bot (Table's): each empty point weighed by the lines a stone there
// would make, its own (five wins, taken first) and the other's it would
// stop (their five blocked next, then its four, their four…), a little
// toward the middle and at random between points about as good.
// shortcut: one ply, blind to open ends and to two threats at once;
// read a move ahead if it's too weak
const DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];
const MIDDLE = (SIZE - 1) / 2;

function worth(stones, seat, at) {
  let v = 0;
  for (const [side, weight] of [
    [seat, 2],
    [1 - seat, 1],
  ]) {
    const put = stones.with(at, side);
    for (const d of DIRS) {
      v += weight * 10 ** Math.min(lineOf(put, at, d).length, 5);
    }
  }
  const [row, col] = [Math.floor(at / SIZE), at % SIZE];
  return v - Math.abs(row - MIDDLE) - Math.abs(col - MIDDLE) + Math.random();
}

function play(state, seat) {
  let best;
  let top = -Infinity;
  state.stones.forEach((s, at) => {
    if (s !== null) return;
    const v = worth(state.stones, seat, at);
    if (v > top) [top, best] = [v, at];
  });
  return stone(state, seat, best);
}

export default { play };
