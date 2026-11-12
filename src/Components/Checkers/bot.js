import { hop, plays, rowOf } from "./rules";

// A bot (Table's): it looks DEPTH turns ahead (dama's three: its kings fly,
// and four took a phone's second a hop), whole turns at a time (a
// chain of jumps is one), its own best against the other's best
// (minimax, alpha-beta), counting the pieces, a king more, a man a little
// more the further on it is; a little at random between turns as good. It
// plays the turn it picks a hop at a time, as anyone does, looking again
// at each.
// ponytail: a fixed depth; deeper, or by time, if it's too easy to beat
const DEPTH = { checkers: 4, dama: 3 };
const KING = { checkers: 1.6, dama: 2.5 };

// a whole turn played out, hop by hop through the rules
const after = (state, { from, hops }) =>
  hops.reduce(
    (s, h, i) => hop(s, s.turn, i ? hops[i - 1].to : from, h.to),
    state,
  );

// how good `s` is for `me`: a win (sooner better), or the pieces
function value(s, me, depth) {
  if (s.winner) return (s.winner.seat === me ? 1 : -1) * (1000 + depth);
  if (s.draw) return 0;
  let v = 0;
  s.cells.forEach((p, i) => {
    if (!p) return;
    const on = p.seat === 0 ? 7 - rowOf(i) : rowOf(i);
    const worth = p.king ? KING[s.mode] : 1 + on * 0.06;
    v += p.seat === me ? worth : -worth;
  });
  return v;
}

function minimax(s, depth, alpha, beta, me) {
  if (s.turn === null || !depth) return value(s, me, depth);
  const mine = s.turn === me;
  let best = mine ? -Infinity : Infinity;
  for (const play of plays(s)) {
    const v = minimax(after(s, play), depth - 1, alpha, beta, me);
    if (mine) {
      best = Math.max(best, v);
      alpha = Math.max(alpha, v);
    } else {
      best = Math.min(best, v);
      beta = Math.min(beta, v);
    }
    if (alpha >= beta) break;
  }
  return best;
}

function play(state, seat) {
  let best;
  let top = -Infinity;
  for (const p of plays(state)) {
    const v =
      minimax(
        after(state, p),
        DEPTH[state.mode] - 1,
        -Infinity,
        Infinity,
        seat,
      ) +
      Math.random() * 0.05;
    if (v > top) [top, best] = [v, p];
  }
  return best && hop(state, seat, best.from, best.hops[0].to);
}

export default { play };
