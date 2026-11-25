import { WIDE, drop, lines, rest } from "./rules";

// A bot (Table's): each column weighed by the lines a disc there would
// make, its own (four wins, taken first) and the other's it would stop,
// never under a place where the other then wins if another column will do,
// a little toward the middle and at random between ones about as good.
// shortcut: one ply and the place above; a search a few moves deep if it's
// too weak
const made = (stones, at, seat) =>
  lines(stones.with(at, seat), at).reduce(
    (sum, line) => sum + 10 ** Math.min(line.length, 4),
    0,
  );

function worth(stones, seat, col) {
  const at = rest(stones, col);
  const mine = made(stones, at, seat);
  let v = 2 * mine + made(stones, at, 1 - seat);
  const above = at - WIDE;
  // not a win itself, and the other wins on top of it
  if (mine < 10 ** 4 && above >= 0) {
    const [line] = lines(stones.with(at, seat).with(above, 1 - seat), above);
    if (line.length > 3) v -= 5000;
  }
  return v - Math.abs(col - (WIDE - 1) / 2) + Math.random();
}

function play(state, seat) {
  let best;
  let top = -Infinity;
  for (let col = 0; col < WIDE; col++) {
    if (rest(state.stones, col) < 0) continue;
    const v = worth(state.stones, seat, col);
    if (v > top) [top, best] = [v, col];
  }
  return drop(state, seat, best);
}

export default { play };
