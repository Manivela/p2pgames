// Backgammon (tavla) rules: pure functions over plain data, the game as it is
// written to the room (index.jsx). A move returns the next state, or
// undefined when it isn't allowed.
//
// Seat 0 plays white, seat 1 black. Each seat counts the board from its own
// side: its checkers run from point 24 down to its home, points 1-6, and off.
// `checkers[seat][n]` is how many of the seat's checkers are on its point n,
// with 25 the bar and 0 borne off; a seat's point n is the other's 25 - n.

import { value } from "./bot";

export const BAR = 25;
export const OFF = 0;

const START = { 24: 2, 13: 5, 8: 3, 6: 5 };

const d6 = () => 1 + Math.floor(Math.random() * 6);

function startingCheckers() {
  const seat = Array(26).fill(0);
  for (const [n, count] of Object.entries(START)) seat[n] = count;
  return seat;
}

// one die each, again on a tie: the higher starts the first game, playing
// both
export function openingRoll() {
  for (;;) {
    const dice = [d6(), d6()];
    if (dice[0] !== dice[1]) return dice;
  }
}

// `ids` are the seated players' ids: the score carries over while the same
// two sit in the same seats, and starts again at 0-0 when either changes.
// Who starts: the first game's opening roll decides; after that, between
// the same two, the winner of the last game, rolling both dice (the
// loser's last ones lie on the board till then, a tap on them the roll)
export function newGame(prev, ids, opening) {
  const same = prev?.players?.[0] === ids[0] && prev?.players?.[1] === ids[1];
  // (not after a game of checkers on the back of the case: no dice there)
  if (same && prev.winner && prev.dice?.length === 2 && !opening) {
    const { seat } = prev.winner;
    return {
      checkers: [startingCheckers(), startingCheckers()],
      players: ids,
      score: prev.score,
      turn: seat,
      opening: null,
      dice: prev.dice,
      by: 1 - seat,
      left: [],
      undo: [],
      winner: null,
      last: { n: prev.last.n + 1, kind: "new" },
      // the dice lie as they were: not tossed again
      rolled: prev.rolled,
    };
  }
  opening ??= openingRoll();
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

export function apply(checkers, seat, { from, to }) {
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
export function plays(state) {
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

// The step to play when there's nothing to choose: every way to play the
// dice leaves the same board (one way only, or the order changes nothing,
// as bearing off often); undefined while there's a choice. The board plays
// it by itself (Board.jsx).
const only = new WeakMap();
export function forced(state) {
  if (!only.has(state)) {
    const all = plays(state);
    const end = (seq) =>
      String(
        seq.reduce((c, step) => apply(c, state.turn, step), state.checkers),
      );
    const first = all.length && end(all[0]);
    only.set(
      state,
      all.every((seq) => end(seq) === first) ? all[0]?.[0] : undefined,
    );
  }
  return only.get(state);
}

// the points (or the bar) the player to move can move a checker from
export function sources(state) {
  return [...new Set(plays(state).map((s) => s[0].from))];
}

// Where the checker on `from` can go this turn, each with the steps that
// take it there: one die, or several in a row (3-2 also reaches 5) when the
// points between are open. A checker passing over a blot hits it; of two
// ways to the same point, the one that hits more, then the one with fewer
// dice, leaving the others to play (2-5 on 3 and 1 bears both off), then
// the one that can leave the player best placed once the turn's played
// (the bot's `value`: of two blots on the way, the one further on is hit),
// so the player never picks a die
function ranked(state, from) {
  const found = new Map();
  const seat = state.turn;
  for (const seq of plays(state)) {
    if (seq[0].from !== from) continue;
    const worth = value(
      seq.reduce((c, step) => apply(c, seat, step), state.checkers),
      seat,
    );
    let at = from;
    for (let i = 0; i < seq.length && seq[i].from === at; i++) {
      at = seq[i].to;
      const steps = seq.slice(0, i + 1);
      // most hits, then fewest dice, then the best it can come to
      const rank = [steps.filter((x) => x.hit).length, -steps.length, worth];
      const was = found.get(at)?.rank;
      const by = was && rank.map((r, k) => r - was[k]).find(Boolean);
      if (!was || by > 0) found.set(at, { steps, rank });
      if (at === OFF) break;
    }
  }
  return found;
}

export const targets = (state, from) =>
  new Map([...ranked(state, from)].map(([to, { steps }]) => [to, steps]));

// where the game would move the checker on `from` (a double tap on it,
// Board.jsx): on the way to the best the turn can come to, a die at a
// time; undefined when it can't move
export function best(state, from) {
  let top;
  for (const [to, { steps, rank }] of ranked(state, from)) {
    const by =
      top && (rank[2] - top.rank[2] || top.steps.length - steps.length);
    if (!top || by > 0) top = { to, steps, rank };
  }
  return top?.to;
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
    // the steps it took, a die each (Board.jsx stops on each)
    last: { n: state.last.n + 1, kind: "move", steps },
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
