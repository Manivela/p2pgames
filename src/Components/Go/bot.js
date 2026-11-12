import { KOMI, count, next, pass, play as stone, reach, sizeOf } from "./rules";

// A bot (Table's): each point it may play weighed one move ahead (`worth`):
// stones it takes or saves, the other's it leaves short of liberties, its
// own it mustn't leave in atari, its own eyes never filled, settled areas
// left alone, and early on the third and fourth lines; a little at random
// between points about as good. It passes when nothing's worth a stone,
// or when the other just has and it wins the count as the board stands.
// ponytail: one ply, no reading of life and death; Monte Carlo playouts if
// it's too weak

const liberties = (stones, i) =>
  [...reach(stones, i).touch].filter((n) => stones[n] === null).length;

// each empty point's area: how big, and the one side whose stones it
// touches, or null
function areas(stones) {
  const out = Array(stones.length).fill(null);
  stones.forEach((s, i) => {
    if (s !== null || out[i]) return;
    const { all, touch } = reach(stones, i);
    const sides = new Set([...touch].map((n) => stones[n]));
    const area = {
      size: all.size,
      side: sides.size === 1 ? [...sides][0] : null,
    };
    for (const p of all) out[p] = area;
  });
  return out;
}

function worth(state, seat, at, after, area) {
  const { stones } = state;
  const size = sizeOf(stones);
  const around = next(at, size);
  const took = after.last.off.length;
  let v = 12 * took;
  // its own stones in atari beside it, saved if this gives them room
  const saved = new Set();
  for (const n of around) {
    if (stones[n] === seat && liberties(stones, n) === 1) {
      for (const p of reach(stones, n).all) saved.add(p);
    }
  }
  const room = liberties(after.stones, at);
  if (room >= 2) v += 10 * saved.size;
  if (room === 1) v -= (took ? 2 : 15) * reach(after.stones, at).all.size;
  if (room === 2) v -= 1;
  // the other's stones beside it, in atari or nearly
  const seen = new Set();
  for (const n of around) {
    if (after.stones[n] !== 1 - seat || seen.has(n)) continue;
    const group = reach(after.stones, n);
    for (const p of group.all) seen.add(p);
    const left = liberties(after.stones, n);
    if (left === 1) v += 3 * group.all.size;
    if (left === 2) v += 0.5 * group.all.size;
  }
  if (!took && !saved.size) {
    // its own eye
    if (around.every((n) => stones[n] === seat)) v -= 30;
    // inside an area one side has walled off: its own, filling it, or the
    // other's, where it would only be taken
    const { side, size: points } = area[at];
    if (side === seat && points <= 2 * size) v -= 8;
    if (side === 1 - seat && points <= size) v -= 8;
  }
  const [row, col] = [Math.floor(at / size), at % size];
  const line = Math.min(row, col, size - 1 - row, size - 1 - col);
  return v + [-2, -0.5, 1, 1, 0.5][Math.min(line, 4)] + Math.random();
}

// the board counted as it stands, `seat` ahead
function ahead(stones, seat) {
  const { area } = count(stones);
  return (area[0] - area[1] - KOMI > 0 ? 0 : 1) === seat;
}

function play(state, seat) {
  if (state.passes && ahead(state.stones, seat)) return pass(state, seat);
  const area = areas(state.stones);
  let best;
  let top = 0;
  state.stones.forEach((s, at) => {
    const after = s === null && stone(state, seat, at);
    if (!after) return;
    const v = worth(state, seat, at, after, area);
    if (v > top) [top, best] = [v, after];
  });
  return best ?? pass(state, seat);
}

export default { play };
