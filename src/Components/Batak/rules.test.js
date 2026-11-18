import { assert, test } from "vitest";
import {
  bid,
  bidsOpen,
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

test("four bots play deals to their end: every card legal, 13 tricks", () => {
  let s = null;
  for (let deal = 0; deal < 30; deal++) {
    s = newGame(s, IDS);
    const seen = new Set();
    for (let i = 0; i < 100 && s.turn !== null; i++) {
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
    }
    assert.equal(s.phase, "over");
    assert.equal(seen.size, 52);
    assert.equal(
      s.taken.reduce((a, b) => a + b),
      13,
    );
    assert.deepEqual(s.points, score(s.bidder, s.contract, s.taken));
  }
  // the score carried over, the deal passed on
  assert.equal(s.dealer, 29 % 4);
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
  assert.isNull(s.turn);
  assert.deepEqual(s.points, [6, 4, 2, 1]);
  assert.deepEqual(s.score, [16, 4, 2, 1]);
  // the bidder made it: theirs alone
  assert.deepEqual(s.winners, [0]);
});

test("the bidder down: the deal is the three's who sent them down", () => {
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
  assert.deepEqual(s.winners, [1, 2, 3]);
});

test("a bot waits out the deal, then a trick's slide, before it plays", () => {
  const s = newGame(null, IDS);
  assert.isAbove(bot.wait(s), bot.wait({ ...s, last: { kind: "bid" } }));
  assert.equal(bot.wait({ ...s, last: { kind: "bid" } }), 900);
});
