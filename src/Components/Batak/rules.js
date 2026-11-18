import { deal, suitOf, takes } from "../Cards/cards";

// İhaleli Batak, for four, each on their own: 13 cards each, a bid for the
// most tricks names trumps, and the bidder has to take as many.
// - The deal passes round, each seat dealing in turn; the bidding starts
//   at the seat after the dealer's, going round (`next`, counter-clockwise
//   as the table seats them, Board.jsx). Each bids one more than the
//   highest so far, at least MIN_BID, or passes, out for good; the last
//   one in takes it. All pass: the last to speak, the dealer, has to bid.
// - The bidder names trumps and leads. Follow the suit led, higher than
//   the highest of it on the table while you can (not once it's been
//   trumped); with none of it, trump, higher than a trump on the table
//   while you can; with neither, play anything. Trumps aren't led till
//   one's been played, unless they're all a hand has.
// - The highest trump takes a trick, or with none, the highest of the suit
//   led; whoever takes it leads the next. `score` says what a deal's worth.
//
// The state, the same in every page (Table: `turn`, `winner`, `score`):
// - players: the seated ids, the score carried over while the same four
//   sit; dealer: the seat that dealt
// - hands: each seat's cards (Cards/cards.js), shown only to its player
// - phase: "bid", "trump", "play", "over"; bids: each seat's, null not yet
//   spoken, 0 passed; bidder, contract: who took it, for how many
// - trump: the suit, once named; broken: a trump's been played
// - trick: [{ seat, card }…] on the table; lastTrick: { cards, by }, the
//   one taken last, left in sight till the next lead; taken: each seat's
//   tricks
// - points: each seat's for the deal once it's over; winner: { seat },
//   the most of them (none on a tie)
// - turn: who bids, names trumps or plays next, null once it's over
// - last: { n, kind, seat… }, what happened last, for the bots and sounds
export const MIN_BID = 5;
export const next = (seat) => (seat + 1) % 4;

export function newGame(prev, ids, mode = "batak") {
  const same = !!prev && ids.every((id, i) => prev.players[i] === id);
  // dealt again before anyone spoke (New Game in ⋯): the same dealer
  const dealer = !same
    ? 0
    : prev.last.kind === "new"
      ? prev.dealer
      : next(prev.dealer);
  return {
    mode,
    players: ids,
    score: same ? prev.score : [0, 0, 0, 0],
    dealer,
    hands: deal(4),
    phase: "bid",
    bids: [null, null, null, null],
    bidder: null,
    contract: null,
    trump: null,
    broken: false,
    trick: [],
    lastTrick: null,
    taken: [0, 0, 0, 0],
    points: null,
    winner: null,
    turn: next(dealer),
    last: { n: (prev?.last?.n ?? 0) + 1, kind: "new" },
  };
}

const highest = (bids) => Math.max(0, ...bids);

// what the seat to speak may bid: 0 to pass, or one over the highest so
// far, at least MIN_BID, up to 13; no pass for the last one in with no bid
// made
export function bidsOpen(state) {
  const top = highest(state.bids);
  const from = Math.max(MIN_BID, top + 1);
  const up = Array.from({ length: Math.max(0, 14 - from) }, (_, i) => from + i);
  const passed = state.bids.filter((b) => b === 0).length;
  return top === 0 && passed === 3 ? up : [0, ...up];
}

export function bid(state, seat, n) {
  if (state.phase !== "bid" || state.turn !== seat) return;
  if (!bidsOpen(state).includes(n)) return;
  const bids = state.bids.with(seat, n);
  const last = { n: state.last.n + 1, kind: "bid", seat, bid: n };
  const left = [0, 1, 2, 3].filter((s) => bids[s] !== 0);
  if (left.length === 1 && highest(bids) > 0) {
    const [bidder] = left;
    return {
      ...state,
      bids,
      phase: "trump",
      bidder,
      contract: bids[bidder],
      turn: bidder,
      last,
    };
  }
  let turn = next(seat);
  while (bids[turn] === 0) turn = next(turn);
  return { ...state, bids, turn, last };
}

export function trump(state, seat, suit) {
  if (state.phase !== "trump" || state.turn !== seat) return;
  if (!(suit >= 0 && suit < 4)) return;
  return {
    ...state,
    phase: "play",
    trump: suit,
    last: { n: state.last.n + 1, kind: "trump", seat, suit },
  };
}

// the cards `seat` may play now
export function legal(state, seat) {
  const hand = state.hands[seat];
  const { trick, trump } = state;
  const of = (suit) => hand.filter((c) => suitOf(c) === suit);
  if (!trick.length) {
    const rest = hand.filter((c) => suitOf(c) !== trump);
    return state.broken || !rest.length ? hand : rest;
  }
  // over the highest of `suit` on the table, if any of `cards` are
  const higher = (cards, suit) => {
    const top = Math.max(
      -1,
      ...trick.map((p) => p.card).filter((c) => suitOf(c) === suit),
    );
    const over = cards.filter((c) => c > top);
    return over.length ? over : cards;
  };
  const led = suitOf(trick[0].card);
  const trumped = led !== trump && trick.some((p) => suitOf(p.card) === trump);
  if (of(led).length) return trumped ? of(led) : higher(of(led), led);
  if (of(trump).length) return higher(of(trump), trump);
  return hand;
}

// why `card` can't be played, to the one whose turn it is
export function whyNot(state, seat, card) {
  if (state.phase !== "play" || state.turn !== seat) return;
  const ok = legal(state, seat);
  if (ok.includes(card)) return;
  if (!state.trick.length) return "No trumps till one's been played";
  const led = suitOf(state.trick[0].card);
  if (suitOf(ok[0]) === led && suitOf(card) !== led) {
    return "Follow the suit led";
  }
  if (suitOf(ok[0]) !== suitOf(card))
    return "Trump it: you have none of the suit led";
  return "Play higher: you have one that beats it";
}

// a deal's points: each seat's tricks, but less the contract for a bidder
// short of it, or anyone else who took none (they've gone down, batmak)
export const score = (bidder, contract, taken) =>
  taken.map((n, s) => ((s === bidder ? n >= contract : n > 0) ? n : -contract));

export function play(state, seat, card) {
  if (state.phase !== "play" || state.turn !== seat) return;
  if (!legal(state, seat).includes(card)) return;
  const hands = state.hands.with(
    seat,
    state.hands[seat].filter((c) => c !== card),
  );
  const trick = [...state.trick, { seat, card }];
  const broken = state.broken || suitOf(card) === state.trump;
  const n = state.last.n + 1;
  if (trick.length < 4) {
    return {
      ...state,
      hands,
      trick,
      broken,
      turn: next(seat),
      last: { n, kind: "play", seat, card },
    };
  }
  const by = takes(trick, state.trump).seat;
  const taken = state.taken.with(by, state.taken[by] + 1);
  const done = {
    ...state,
    hands,
    trick: [],
    lastTrick: { cards: trick, by },
    broken,
    taken,
    turn: by,
    last: { n, kind: "trick", seat, card, by },
  };
  if (hands[by].length) return done;
  const points = score(state.bidder, state.contract, taken);
  const best = Math.max(...points);
  const top = [0, 1, 2, 3].filter((s) => points[s] === best);
  return {
    ...done,
    phase: "over",
    turn: null,
    points,
    score: state.score.map((p, s) => p + points[s]),
    winner: top.length === 1 ? { seat: top[0] } : null,
  };
}
