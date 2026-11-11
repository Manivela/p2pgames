// Backgammon (tavla) rules: pure functions over plain data, the game as it is
// written to the room (index.jsx). A move returns the next state, or
// undefined when it isn't allowed.
//
// Seat 0 plays white, seat 1 black. Each seat counts the board from its own
// side: its checkers run from point 24 down to its home, points 1-6, and off.
// `checkers[seat][n]` is how many of the seat's checkers are on its point n,
// with 25 the bar and 0 borne off; a seat's point n is the other's 25 - n.

export const BAR = 25;
export const OFF = 0;

const START = { 24: 2, 13: 5, 8: 3, 6: 5 };

const d6 = () => 1 + Math.floor(Math.random() * 6);

function startingCheckers() {
  const seat = Array(26).fill(0);
  for (const [n, count] of Object.entries(START)) seat[n] = count;
  return seat;
}

// one die each, again on a tie: the higher starts, playing both
export function openingRoll() {
  for (;;) {
    const dice = [d6(), d6()];
    if (dice[0] !== dice[1]) return dice;
  }
}

// `ids` are the seated players' ids: the score carries over while the same
// two sit in the same seats, and starts again at 0-0 when either changes
export function newGame(prev, ids, opening = openingRoll()) {
  const same = prev?.players?.[0] === ids[0] && prev?.players?.[1] === ids[1];
  const seat = opening[0] > opening[1] ? 0 : 1;
  const n = (prev?.last?.n ?? 0) + 1;
  return {
    checkers: [startingCheckers(), startingCheckers()],
    players: ids,
    score: same ? prev.score : [0, 0],
    turn: seat,
    // opening[0] is white's die, opening[1] black's
    opening,
    dice: [...opening],
    by: seat,
    left: [...opening],
    undo: [],
    winner: null,
    // what happened last, for the sounds (index.jsx), and which of those
    // put the dice up, tossed once each (Board.jsx)
    last: { n, kind: "new" },
    rolled: n,
  };
}

// where a checker on `from` lands with `die`, or null when it can't
function landing(checkers, seat, from, die) {
  const mine = checkers[seat];
  const theirs = checkers[1 - seat];
  if (mine[BAR] && from !== BAR) return null;
  const to = from - die;
  if (to >= 1) return theirs[25 - to] >= 2 ? null : to;
  // bearing off: every checker home first, and a die bigger than the point
  // only for the checker furthest from home
  for (let n = 7; n <= BAR; n++) if (mine[n]) return null;
  if (to === OFF) return OFF;
  for (let n = from + 1; n <= 6; n++) if (mine[n]) return null;
  return OFF;
}

function apply(checkers, seat, { from, to }) {
  const next = [[...checkers[0]], [...checkers[1]]];
  const mine = next[seat];
  const theirs = next[1 - seat];
  mine[from]--;
  mine[to]++;
  if (to !== OFF && theirs[25 - to] === 1) {
    theirs[25 - to] = 0;
    theirs[BAR]++;
  }
  return next;
}

// Every way to play `dice` that plays as many of them as possible, each a
// list of steps { from, to, die, hit }. When only one die of two can be
// played, it must be the higher one if that one can.
function sequences(checkers, seat, dice) {
  const all = [];
  const go = (c, rest, seq) => {
    const [die] = rest;
    let moved = false;
    if (die) {
      const froms = c[seat][BAR]
        ? [BAR]
        : c[seat].flatMap((count, n) => (count && n !== OFF ? [n] : []));
      for (const from of froms) {
        const to = landing(c, seat, from, die);
        if (to === null) continue;
        moved = true;
        const hit = to !== OFF && c[1 - seat][25 - to] === 1;
        go(apply(c, seat, { from, to }), rest.slice(1), [
          ...seq,
          { from, to, die, hit },
        ]);
      }
    }
    if (!moved) all.push(seq);
  };
  const orders =
    dice.length === 2 && dice[0] !== dice[1]
      ? [dice, [dice[1], dice[0]]]
      : [dice];
  for (const order of orders) go(checkers, order, []);
  const most = Math.max(...all.map((s) => s.length));
  if (!most) return [];
  let best = all.filter((s) => s.length === most);
  if (most === 1 && dice.length === 2) {
    const high = Math.max(...dice);
    if (best.some((s) => s[0].die === high)) {
      best = best.filter((s) => s[0].die === high);
    }
  }
  return best;
}

// the turn's legal sequences, worked out once for each state
const known = new WeakMap();
function plays(state) {
  if (!known.has(state)) {
    known.set(
      state,
      state.winner || !state.left.length
        ? []
        : sequences(state.checkers, state.turn, state.left),
    );
  }
  return known.get(state);
}

// the points (or the bar) the player to move can move a checker from
export function sources(state) {
  return [...new Set(plays(state).map((s) => s[0].from))];
}

// Where the checker on `from` can go this turn, each with the steps that
// take it there: one die, or several in a row (3-2 also reaches 5) when the
// points between are open. A checker passing over a blot hits it; of two
// ways to the same point, the one that hits more.
export function targets(state, from) {
  const found = new Map();
  for (const seq of plays(state)) {
    let at = from;
    for (let i = 0; i < seq.length && seq[i].from === at; i++) {
      at = seq[i].to;
      const steps = seq.slice(0, i + 1);
      const hits = (s) => s.filter((x) => x.hit).length;
      if (!found.has(at) || hits(steps) > hits(found.get(at))) {
        found.set(at, steps);
      }
      if (at === OFF) break;
    }
  }
  return found;
}

// Why the checker on `from` can't move (to `to`, when given) though a die
// seems to fit: the rule in the way, to show the player. Undefined when no
// die fits there at all, which the board shows by itself.
export function whyNot(state, from, to) {
  const { checkers, turn: seat, left } = state;
  if (!left.length || state.winner) return;
  if (
    to === undefined
      ? sources(state).includes(from)
      : targets(state, from).has(to)
  ) {
    return;
  }
  const mine = checkers[seat];
  if (mine[BAR] && from !== BAR) return "Play your checker on the bar first";
  const fits = left.some((die) => {
    const at = landing(checkers, seat, from, die);
    return at !== null && (to === undefined || at === to);
  });
  if (!fits) {
    const off = to === undefined || to === OFF;
    const outside = mine.some((count, n) => count && n > 6);
    if (off && outside && left.some((die) => die >= from)) {
      return "Bring every checker home before bearing off";
    }
    return;
  }
  if (
    plays(state)[0]?.length === 1 &&
    left.length === 2 &&
    left[0] !== left[1]
  ) {
    return "Only one die can be played: it has to be the higher one";
  }
  return "Every die that can be played has to be played";
}

const remove = (dice, used) => {
  const left = [...dice];
  for (const { die } of used) left.splice(left.indexOf(die), 1);
  return left;
};

export function roll(state, seat, dice = [d6(), d6()]) {
  if (state.turn !== seat || state.left.length || state.winner) return;
  const [a, b] = dice;
  const n = state.last.n + 1;
  const next = {
    ...state,
    opening: null,
    dice: [a, b],
    by: seat,
    left: a === b ? [a, a, a, a] : [a, b],
    undo: [],
    last: { n, kind: "roll" },
    rolled: n,
  };
  // nothing to play: the dice stay up and the turn passes
  return plays(next).length ? next : { ...next, left: [], turn: 1 - seat };
}

// moves the checker on `from` to `to`, by as many dice as it takes; the
// turn passes once there's nothing left to play
export function move(state, seat, from, to) {
  if (state.turn !== seat) return;
  const steps = targets(state, from).get(to);
  if (!steps) return;
  const checkers = steps.reduce(
    (c, step) => apply(c, seat, step),
    state.checkers,
  );
  const before = {
    checkers: state.checkers,
    left: state.left,
    turn: state.turn,
  };
  const next = {
    ...state,
    checkers,
    left: remove(state.left, steps),
    undo: [...state.undo, before],
    last: { n: state.last.n + 1, kind: "move" },
  };
  if (checkers[seat][OFF] === 15) {
    // mars: the other has borne nothing off, and it counts two
    const points = checkers[1 - seat][OFF] ? 1 : 2;
    const score = [...state.score];
    score[seat] += points;
    return { ...next, left: [], undo: [], score, winner: { seat, points } };
  }
  return plays(next).length ? next : { ...next, left: [], turn: 1 - seat };
}

// takes back the roller's last move, until the other rolls
export function undo(state, seat) {
  if (state.by !== seat || !state.undo.length || state.winner) return;
  return {
    ...state,
    ...state.undo.at(-1),
    undo: state.undo.slice(0, -1),
    last: { n: state.last.n + 1, kind: "undo" },
  };
}

// how far a seat's checkers have to go
export const pips = (seat) =>
  seat.reduce((sum, count, n) => sum + count * n, 0);
