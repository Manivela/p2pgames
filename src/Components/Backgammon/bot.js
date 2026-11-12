import { BAR, apply, move, pips, plays, roll } from "./rules";

// A bot (Table's): it rolls, then plays the dice one checker at a time,
// each the first step of the way to play them that leaves it best placed
// (`value`), a little at random between ones about as good. One ply, no
// lookahead at the other's roll beyond the shots at its blots.
// ponytail: hand-weighted, a learned evaluation (gnubg's) if it's too weak

// the ways in 36 to roll a number that moves a checker this many points:
// one die or both, blocked points not counted
const SHOTS = [0, 11, 12, 14, 15, 15, 17, 6, 6, 5, 3, 2, 3];

// how good `checkers` are for `seat`, in pips: the race, points made (home
// ones most), and each blot's chance of being hit times what that costs
export function value(checkers, seat) {
  const mine = checkers[seat];
  const theirs = checkers[1 - seat];
  let v = pips(theirs) - pips(mine);
  // where theirs are, in this seat's points (their n is its 25 - n, their
  // bar its 0): each hits a blot ahead of it, the way they move
  const at = [];
  for (let n = 1; n <= BAR; n++) if (theirs[n]) at.push(25 - n);
  for (let n = 1; n <= 24; n++) {
    if (mine[n] >= 2) v += n <= 6 ? 4 : n <= 9 ? 3 : 1;
    if (mine[n] !== 1) continue;
    const ways = new Set(
      at.filter((m) => m < n && n - m <= 12).map((m) => n - m),
    );
    const hit = Math.min(
      36,
      [...ways].reduce((sum, d) => sum + SHOTS[d], 0),
    );
    // hit, it goes back to the bar: 25 - n pips lost
    v -= (hit / 36) * (25 - n);
  }
  return v;
}

function play(state, seat) {
  if (!state.left.length) return roll(state, seat);
  let best;
  let top = -Infinity;
  for (const seq of plays(state)) {
    const end = seq.reduce((c, step) => apply(c, seat, step), state.checkers);
    const v = value(end, seat) + Math.random() * 0.5;
    if (v > top) [top, best] = [v, seq[0]];
  }
  return best && move(state, seat, best.from, best.to);
}

// the dice tumble for up to 1.5s (Board.jsx): it plays once they're down
const wait = (state) => (state.last.kind === "roll" ? 1800 : 900);

export default { play, wait };
