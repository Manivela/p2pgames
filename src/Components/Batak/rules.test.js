import { assert, test } from "vitest";
import {
  bid,
  bidsOpen,
  dealNext,
  legal,
  newGame,
  play,
  score,
  trump,
  whyNot,
} from "./rules";
import bot from "./bot";

const IDS = ["a", "b", "c", "d"];
// a card by its name: "AS" the ace of spades, "10H", "2C", "QD"
const SUIT = { S: 0, H: 1, C: 2, D: 3 };
const RANK = { J: 11, Q: 12, K: 13, A: 14 };
const c = (name) =>
  SUIT[name.at(-1)] * 13 + (RANK[name.slice(0, -1)] ?? +name.slice(0, -1)) - 2;
const cs = (names) => names.split(" ").map(c);

// a deal in play, spades trumps unless said, the trick on the table
const inPlay = (hands, trick = [], { trumps = 0, broken = false } = {}) => ({
  ...newGame(null, IDS),
  phase: "play",
  bidder: 0,
  contract: 5,
  trump: trumps,
  broken,
  hands: hands.map(cs),
  trick: trick.map(([seat, name]) => ({ seat, card: c(name) })),
  turn: trick.length ? (trick.at(-1)[0] + 1) % 4 : 0,
});

test("four bots play matches to their end: every deal legal, dealt in turn", () => {
  let s = null;
  for (const mode of ["4", "8", "12"]) {
    s = newGame(s, IDS, mode);
    const first = s.dealer;
    let seen = new Set();
    for (let i = 0; i < 2000 && s.turn !== null; i++) {
      const before = s;
      // the bot plays from the hands as they are, never changing them
      s.hands.forEach(Object.freeze);
      if (s.phase === "play") {
        const ok = legal(s, s.turn);
        s = bot.play(s, s.turn);
        assert.include(ok, s.last.card);
        seen.add(s.last.card);
      } else s = bot.play(s, s.turn);
      assert.isObject(s, `${before.phase}: no move`);
      if (s.phase === "over" && before.phase === "play") {
        // each deal: every card played, 13 tricks, its points
        assert.equal(seen.size, 52);
        assert.equal(
          s.taken.reduce((a, b) => a + b),
          13,
        );
        assert.deepEqual(s.points, score(s.bidder, s.contract, s.taken));
        seen = new Set();
      }
    }
    // the match's deals, each seat dealing in turn, the totals their sum,
    // won by the most
    assert.isNull(s.turn);
    assert.equal(s.rows.length, Number(mode));
    s.rows.forEach((r, i) => assert.equal(r.dealer, (first + i) % 4));
    const sums = [0, 1, 2, 3].map((p) =>
      s.rows.reduce((t, r) => t + r.points[p], 0),
    );
    assert.deepEqual(s.score, sums);
    const top = Math.max(...sums);
    assert.deepEqual(
      s.winners,
      [0, 1, 2, 3].filter((p) => sums[p] === top),
    );
  }
  // a new match: from nothing, the deal passed on
  const again = newGame(s, IDS, "8");
  assert.deepEqual(again.score, [0, 0, 0, 0]);
  assert.deepEqual(again.rows, []);
  assert.equal(again.round, 1);
});

test("a deal over: the next seat deals the next one, the score kept", () => {
  let s = newGame(null, IDS, "4"); // dealer 0
  s = { ...s, phase: "over", turn: 1, score: [3, -5, 2, 4], rows: [{}] };
  assert.isUndefined(dealNext(s, 2), "not theirs to deal");
  const d = dealNext(s, 1);
  assert.equal(d.dealer, 1);
  assert.equal(d.round, 2);
  assert.equal(d.phase, "bid");
  assert.equal(d.turn, 2);
  assert.equal(d.last.kind, "new");
  assert.deepEqual(d.score, [3, -5, 2, 4]);
  assert.deepEqual(d.bids, [null, null, null, null]);
  d.hands.forEach((h) => assert.lengthOf(h, 13));
  // an unknown length: 8 deals
  assert.equal(newGame(null, IDS, "batak").deals, 8);
});

test("bidding: one over the highest, at least 5; the last in takes it", () => {
  let s = newGame(null, IDS); // dealer 0, seat 1 first
  assert.equal(s.turn, 1);
  assert.deepEqual(bidsOpen(s), [0, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  assert.isUndefined(bid(s, 2, 5), "out of turn");
  assert.isUndefined(bid(s, 1, 4), "under 5");
  s = bid(s, 1, 6);
  assert.deepEqual(bidsOpen(s), [0, 7, 8, 9, 10, 11, 12, 13]);
  s = bid(s, 2, 0);
  s = bid(s, 3, 7);
  s = bid(s, 0, 0);
  // seat 2 passed: skipped
  assert.equal(s.turn, 1);
  s = bid(s, 1, 0);
  assert.equal(s.phase, "trump");
  assert.equal(s.bidder, 3);
  assert.equal(s.contract, 7);
  assert.equal(s.turn, 3);
  assert.isUndefined(trump(s, 0, 1));
  s = trump(s, 3, 1);
  assert.equal(s.phase, "play");
  assert.equal(s.trump, 1);
  assert.equal(s.turn, 3, "the bidder leads");
});

test("all pass: the dealer has to bid", () => {
  let s = newGame(null, IDS);
  for (const seat of [1, 2, 3]) s = bid(s, seat, 0);
  assert.equal(s.turn, 0);
  assert.notInclude(bidsOpen(s), 0);
  assert.isUndefined(bid(s, 0, 0));
  s = bid(s, 0, 5);
  assert.equal(s.bidder, 0);
  assert.equal(s.contract, 5);
});

test("follow suit, higher while you can", () => {
  const s = inPlay(["2S 3S", "4H KH 2H AS", "5D", "6D"], [[0, "QH"]], {
    trumps: 0,
    broken: true,
  });
  assert.sameMembers(legal(s, 1), cs("KH"));
  assert.equal(
    whyNot(s, 1, c("2H")),
    "Play higher: you have one that beats it",
  );
  assert.equal(whyNot(s, 1, c("AS")), "Follow the suit led");
  // nothing higher: any of the suit
  const low = inPlay(["2S", "4H 2H AS", "5D", "6D"], [[0, "QH"]]);
  assert.sameMembers(legal(low, 1), cs("4H 2H"));
});

test("trumped: follow suit, but no need to go higher", () => {
  const s = inPlay(
    ["2S", "3S", "4H KH 2H", "5D"],
    [
      [0, "QH"],
      [1, "3S"],
    ],
    { trumps: 0 },
  );
  assert.sameMembers(legal(s, 2), cs("4H KH 2H"));
});

test("none of the suit led: trump, higher than a trump on the table", () => {
  const s = inPlay(
    ["2S", "3S", "4S JS 2D", "5D"],
    [
      [0, "QH"],
      [1, "5S"],
    ],
    { trumps: 0 },
  );
  assert.sameMembers(legal(s, 2), cs("JS"));
  assert.equal(
    whyNot(s, 2, c("2D")),
    "Trump it: you have none of the suit led",
  );
  // no trump higher: any trump
  const under = inPlay(
    ["2S", "3S", "4S 2D", "5D"],
    [
      [0, "QH"],
      [1, "5S"],
    ],
  );
  assert.sameMembers(legal(under, 2), cs("4S"));
  // neither: anything
  const none = inPlay(["2S", "3S", "2D 3C", "5D"], [[0, "QH"]]);
  assert.sameMembers(legal(none, 2), cs("2D 3C"));
});

test("no trump led till one's been played, unless it's all you have", () => {
  const s = inPlay(["AS 2H", "3S", "4S", "5D"]);
  assert.sameMembers(legal(s, 0), cs("2H"));
  assert.equal(whyNot(s, 0, c("AS")), "No trumps till one's been played");
  assert.sameMembers(legal({ ...s, broken: true }, 0), cs("AS 2H"));
  assert.sameMembers(
    legal(inPlay(["AS KS", "3S", "4S", "5D"]), 0),
    cs("AS KS"),
  );
});

test("a trick to the highest trump, or of the suit led; the taker leads", () => {
  let s = inPlay(["QH 2C", "AH 3C", "2S 4C", "KD 5C"], [], { broken: true });
  s = play(s, 0, c("QH"));
  s = play(s, 1, c("AH"));
  s = play(s, 2, c("2S"));
  s = play(s, 3, c("KD"));
  assert.equal(s.lastTrick.by, 2);
  assert.deepEqual(s.taken, [0, 0, 1, 0]);
  assert.equal(s.turn, 2);
  assert.deepEqual(s.trick, []);
});

test("the last trick scores the deal: the bidder made it, or not", () => {
  // bidder 0, contract 5: made with 6, the others their tricks
  assert.deepEqual(score(0, 5, [6, 3, 2, 2]), [6, 3, 2, 2]);
  // down: less the contract
  assert.deepEqual(score(0, 5, [4, 3, 3, 3]), [-5, 3, 3, 3]);
  // anyone else with no trick goes down too
  assert.deepEqual(score(0, 5, [9, 4, 0, 0]), [9, 4, -5, -5]);
  let s = inPlay(["AH", "2H", "3H", "4H"], [], { broken: true });
  s = { ...s, taken: [5, 4, 2, 1], score: [10, 0, 0, 0] };
  for (const [seat, card] of [
    [0, "AH"],
    [1, "2H"],
    [2, "3H"],
    [3, "4H"],
  ]) {
    s = play(s, seat, c(card));
  }
  assert.equal(s.phase, "over");
  assert.deepEqual(s.points, [6, 4, 2, 1]);
  assert.deepEqual(s.score, [16, 4, 2, 1]);
  assert.deepEqual(s.rows.at(-1).points, [6, 4, 2, 1]);
  // the match goes on: the next seat's deal, no one's won it yet
  assert.equal(s.turn, 1);
  assert.isNull(s.winners);
});

test("the bidder down, less the bid; a tie for the most at the end wins it for both", () => {
  let s = inPlay(["2H", "AH", "3H", "4H"], [], { broken: true });
  s = { ...s, taken: [3, 4, 3, 2] };
  for (const [seat, card] of [
    [0, "2H"],
    [1, "AH"],
    [2, "3H"],
    [3, "4H"],
  ]) {
    s = play(s, seat, c(card));
  }
  // bid 5, took 3: down
  assert.deepEqual(s.points, [-5, 5, 3, 2]);
  // the last deal of a match: level at the top, both win
  let t = inPlay(["AH", "2H", "3H", "4H"], [], { broken: true });
  t = { ...t, deals: 1, taken: [5, 4, 2, 1], score: [0, 2, 0, 0] };
  for (const [seat, card] of [
    [0, "AH"],
    [1, "2H"],
    [2, "3H"],
    [3, "4H"],
  ]) {
    t = play(t, seat, c(card));
  }
  assert.deepEqual(t.score, [6, 6, 2, 1]);
  assert.isNull(t.turn);
  assert.deepEqual(t.winners, [0, 1]);
});

test("a bot waits out the deal, then a trick's slide, before it plays", () => {
  const s = newGame(null, IDS);
  assert.isAbove(bot.wait(s), bot.wait({ ...s, last: { kind: "bid" } }));
  assert.equal(bot.wait({ ...s, last: { kind: "bid" } }), 900);
});
