import { rankOf, suitOf, takes } from "../Cards/cards";
import { bid, bidsOpen, dealNext, legal, play, trump } from "./rules";

// A bot at the Batak table: it bids what its hand looks good for, names
// its strongest suit trumps, and plays the lowest card that takes the
// trick, or the lowest it has when none does; it deals when it's its deal.

// the tricks a hand looks good for with `trumps`: its aces, guarded kings
// and queens, and the trumps past three
function strength(hand, trumps) {
  let n = 0;
  for (let s = 0; s < 4; s++) {
    const ranks = hand.filter((c) => suitOf(c) === s).map(rankOf);
    if (ranks.includes(14)) n += 1;
    if (ranks.includes(13) && ranks.length >= 2) n += 0.7;
    if (ranks.includes(12) && ranks.length >= 3) n += 0.4;
    if (s === trumps) n += Math.max(0, ranks.length - 3);
  }
  return n;
}

const bestSuit = (hand) =>
  [0, 1, 2, 3].reduce((a, b) =>
    strength(hand, b) > strength(hand, a) ? b : a,
  );

// low cards first, a trump only after every other suit's
const cheap = (c, t) => (suitOf(c) === t ? 100 : 0) + rankOf(c);

export default {
  play(state, seat) {
    if (state.phase === "over") return dealNext(state, seat);
    const hand = state.hands[seat];
    if (state.phase === "bid") {
      const worth = Math.floor(strength(hand, bestSuit(hand)));
      const open = bidsOpen(state);
      const n = open.find((b) => b > 0 && b <= worth) ?? open[0];
      return bid(state, seat, n);
    }
    if (state.phase === "trump") return trump(state, seat, bestSuit(hand));
    // a copy: legal() may hand back the hand itself
    const cards = [...legal(state, seat)].sort(
      (a, b) => cheap(a, state.trump) - cheap(b, state.trump),
    );
    // leading: its highest, an ace or king while it has one
    if (!state.trick.length) return play(state, seat, cards.at(-1));
    const wins = cards.filter(
      (c) =>
        takes([...state.trick, { seat, card: c }], state.trump).seat === seat,
    );
    return play(state, seat, wins[0] ?? cards[0]);
  },
  // a new deal once it's dealt (SHUFFLE_MS and the cards going round,
  // index.jsx, Cards/deal.js); a trick just taken stays in sight till it's
  // slid to its taker (GATHER_MS) before the next lead
  // and the next deal once the last one's points have been read
  wait: (state) =>
    state.phase === "over"
      ? 3500
      : state.last.kind === "new"
        ? 2800
        : !state.trick.length && state.lastTrick
          ? 1600
          : 900,
};
