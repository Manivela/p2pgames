// Go on a 9×9, 13×13 or 19×19 board (the table's mode, index.jsx), counted
// as the Tromp-Taylor rules count: a game that
// ends and counts itself. Seat 0 plays black and moves first, seat 1 white.
// (Unlike Tromp-Taylor, no suicide, and plain ko, not superko.) A stone
// with no liberties left is taken off; a stone may not be put where it
// would have none itself, nor where it would make the board as it was
// before the other's last move (ko). Two passes in a row end the game, and
// the board is counted as it stands, every stone on it alive: a side's
// stones and the empty points only its stones reach, white 7.5 more for
// moving second. Dead stones are taken off by capturing them, which costs
// nothing in this count.
//
// The state, the same in every page (Table: `turn`, `winner`, `score`):
// - stones: the points row by row, each the seat whose stone is on it, or
//   null: as many as the board's size squared
// - taken: how many of the other's stones each seat has taken
// - before: the stones before the last move, for ko
// - passes: passes in a row, 0 or 1
// - back: { seat, was }, the last move and the state before it, its
//   maker's to take back till the other moves
// - winner: { seat, by } once it's over; area: each side's count then
// - last: { n, kind, at, off }, what happened last: a stone put `at`,
//   taking `off`; a pass; an undo (Board.jsx, index.jsx)

// the first the default
export const SIZE = 9;
export const SIZES = [9, 13, 19];
export const KOMI = 7.5;

export const sizeOf = (stones) => Math.round(Math.sqrt(stones.length));
export const next = (i, size) => {
  const [row, col] = [Math.floor(i / size), i % size];
  return [
    row > 0 && i - size,
    row < size - 1 && i + size,
    col > 0 && i - 1,
    col < size - 1 && i + 1,
  ].filter((n) => n !== false);
};

// the points joined to `i` that hold what it holds, and what they touch
export function reach(stones, i) {
  const size = sizeOf(stones);
  const all = new Set([i]);
  const touch = new Set();
  for (const p of all) {
    for (const n of next(p, size)) {
      if (stones[n] === stones[i]) all.add(n);
      else touch.add(n);
    }
  }
  return { all, touch };
}

const free = (stones, i) =>
  [...reach(stones, i).touch].some((n) => stones[n] === null);

// `ids`: the seated players' ids: the score carries over while the same
// two sit in the same seats; `mode`: the board's size
export function newGame(prev, ids, mode = SIZE) {
  const same =
    !!prev && prev.players[0] === ids[0] && prev.players[1] === ids[1];
  const size = Number(mode);
  return {
    stones: Array(size * size).fill(null),
    players: ids,
    score: same ? prev.score : [0, 0],
    turn: 0,
    taken: [0, 0],
    before: null,
    passes: 0,
    back: null,
    winner: null,
    area: null,
    last: { n: (prev?.last?.n ?? 0) + 1, kind: "new" },
  };
}

// a stone of `seat`'s put `at`: the stones after, and the ones it took
// off; or why not
function put(state, seat, at) {
  if (state.stones[at] !== null) return { why: "That point is taken" };
  let stones = state.stones.with(at, seat);
  const off = [];
  for (const n of next(at, sizeOf(stones))) {
    if (stones[n] === 1 - seat && !free(stones, n)) {
      for (const p of reach(stones, n).all) {
        off.push(p);
        stones = stones.with(p, null);
      }
    }
  }
  if (!free(stones, at)) return { why: "That stone would have no liberties" };
  if (state.before?.every((s, i) => s === stones[i])) {
    return { why: "Ko: play elsewhere first" };
  }
  return { stones, off };
}

// the state as it was before a move, for taking it back
const was = ({ stones, taken, before, passes, turn }) => ({
  stones,
  taken,
  before,
  passes,
  turn,
});

export function play(state, seat, at) {
  if (state.turn !== seat) return;
  const { stones, off, why } = put(state, seat, at);
  if (why) return;
  return {
    ...state,
    stones,
    taken: state.taken.with(seat, state.taken[seat] + off.length),
    before: state.stones,
    passes: 0,
    turn: 1 - seat,
    back: { seat, was: was(state) },
    last: { n: state.last.n + 1, kind: "stone", at, off },
  };
}

// why a stone can't go `at`, said to the one whose turn it is
export function whyNot(state, at) {
  if (state.turn === null) return;
  return put(state, state.turn, at).why;
}

// Each side's count: its stones and the empty points only its stones
// reach (`owner`, each empty point's side, or null when both or neither)
export function count(stones) {
  const owner = Array(stones.length).fill(null);
  const area = [0, 0];
  const seen = new Set();
  stones.forEach((s, i) => {
    if (s !== null) area[s]++;
    else if (!seen.has(i)) {
      const { all, touch } = reach(stones, i);
      const sides = new Set([...touch].map((n) => stones[n]));
      const side = sides.size === 1 ? [...sides][0] : null;
      for (const p of all) {
        seen.add(p);
        owner[p] = side;
      }
      if (side !== null) area[side] += all.size;
    }
  });
  return { owner, area };
}

export function pass(state, seat) {
  if (state.turn !== seat) return;
  const last = { n: state.last.n + 1, kind: "pass" };
  if (!state.passes) {
    return {
      ...state,
      before: null,
      passes: 1,
      turn: 1 - seat,
      back: { seat, was: was(state) },
      last,
    };
  }
  // the second pass in a row: counted, over
  const { area } = count(state.stones);
  const diff = area[0] - area[1] - KOMI;
  const won = diff > 0 ? 0 : 1;
  return {
    ...state,
    passes: 2,
    turn: null,
    back: null,
    area: [area[0], area[1] + KOMI],
    winner: { seat: won, by: Math.abs(diff) },
    score: state.score.with(won, state.score[won] + 1),
    last,
  };
}

export function undo(state, seat) {
  if (state.back?.seat !== seat) return;
  return {
    ...state,
    ...state.back.was,
    back: null,
    last: { n: state.last.n + 1, kind: "undo" },
  };
}
