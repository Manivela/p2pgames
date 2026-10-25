import { assert, test } from "vitest";
import * as americano from "./americano";
import * as game from "./game";
import { isOkey, meldOrder } from "./melds";
import { ONE_O_ONE } from "./rulesets";
import { createTile } from "./utils";

const indicator = createTile("blue", 13, 1); // okey is blue1, fake okey = blue1
const t = (color, rank, i = 0) => createTile(color, rank, i);
const ids = (tiles) => tiles && tiles.map((x) => x.id);

function seated(count) {
  return {
    ...game.initialState,
    drawPile: game.tiles.map((x) => ({ ...x, hidden: true })),
    players: game.initialState.players.map((p) =>
      p.id <= count
        ? { ...p, user: { id: `u${p.id}`, name: `P${p.id}` }, userKey: p.id }
        : p,
    ),
  };
}
const player = (s, id) => s.players.find((p) => p.id === id);
const tileIn = (s, id, tileId) =>
  player(s, id).hand.find((x) => x?.id === tileId);

function assertAllTiles(s) {
  const all = [
    ...s.drawPile,
    s.okeyTile,
    s.finishTile,
    ...s.players.flatMap((p) => [...p.hand, ...p.discardPile]),
    ...(s.melds ?? []).flatMap((m) => m.tiles),
  ]
    .filter(Boolean)
    .map((x) => x.id);
  assert.equal(all.length, 106);
  assert.equal(new Set(all).size, 106);
}

// P1 (22 tiles, starts): red 10-11-okey (the okey as the 12: 33), four 13s
// (52) and yellow 5-6-7 (18), apart on the rack: 103. P2 (21): six pairs.
const seri = ["red10-0", "red11-0", "blue1-0"];
const kut = ["black13-0", "red13-0", "yellow13-0", "blue13-0"];
const yellow = ["yellow5-0", "yellow6-0", "yellow7-0"];
const p1Rest = [
  ...["black2-0", "black3-0", "black5-0", "black7-0", "black9-0", "red2-0"],
  ...["red4-0", "red6-0", "red8-0", "yellow9-0", "yellow11-0", "yellow1-0"],
];
const fivePairs = [
  ...["black4-0", "black4-1", "blue6-0", "blue6-1", "yellow8-0"],
  ...["yellow8-1", "red9-0", "red9-1", "blue11-0", "blue11-1"],
];
const p2Hand = [
  ...fivePairs,
  ...["black6-0", "black6-1", "blue2-0", "blue3-0", "blue4-0", "black11-0"],
  ...["black12-0", "red12-0", "yellow12-0", "black9-1", "yellow4-0"],
];
const hand1 = (first) => [
  ...first,
  null,
  ...kut,
  null,
  ...yellow,
  null,
  ...p1Rest,
];
const deal = (first = seri) => ({
  okeyTile: "blue13-1",
  hands: [hand1(first), p2Hand],
});
const start = (n = 2, first, rules = ONE_O_ONE) =>
  americano.startGame(seated(n), deal(first), rules);
const lying = (id, source) => ({
  ...game.tiles.find((x) => x.id === id),
  source,
  hidden: false,
});
// seat `id` holds these tiles instead (null for a gap)
const holding = (s, id, ids) => ({
  ...s,
  players: s.players.map((p) =>
    p.id === id
      ? {
          ...p,
          hand: [
            ...ids.map((x) => x && lying(x, `hand-${id}`)),
            ...Array(30 - ids.length).fill(null),
          ],
        }
      : p,
  ),
});
const opening = [...seri, ...kut, ...yellow];

test("101: 22 tiles for the starter, 21 for the others, the rules kept", () => {
  const s = americano.startGame(seated(3), undefined, ONE_O_ONE);
  assert.deepEqual(
    s.players.map((p) => p.hand.filter(Boolean).length),
    [22, 21, 21],
  );
  assert.equal(s.rules.id, "101");
  assertAllTiles(s);
  assertAllTiles(start());
});

test("101: the sets and runs as they lie on the rack count as the opening would", () => {
  const s = start();
  // the okey counts as the 12; the rest of P1's rack makes nothing
  assert.equal(americano.rackPoints(s, 1), 33 + 52 + 18);
  // rows of 15: blue 2-3-4 and the 12s
  assert.equal(americano.rackPoints(s, 2), 9 + 36);
  assert.equal(player(s, 2).hand.length, 30);
  // a row's end splits a run: blue 2-3 | 4
  const across = (from) => ({
    ...s,
    players: s.players.map((p) => {
      if (p.id !== 2) return p;
      const hand = Array(30).fill(null);
      ["blue2-0", "blue3-0", "blue4-0"].forEach(
        (id, k) => (hand[from + k] = tileIn(s, 2, id)),
      );
      return { ...p, hand };
    }),
  });
  assert.equal(americano.rackPoints(across(12), 2), 9);
  assert.equal(americano.rackPoints(across(13), 2), 0);
});

test("101: runs don't wrap, and a pair is two of a tile or an okey and any", () => {
  const run = (tiles, wrap) => ids(meldOrder(tiles, "seri", indicator, wrap));
  assert.isNull(run([t("red", 12), t("red", 13), t("red", 1)], false));
  assert.isOk(run([t("red", 12), t("red", 13), t("red", 1)], true));
  assert.isOk(run([t("red", 1), t("red", 2), t("red", 3)], false));
  // an okey after 12-13 can't be the 1: it's the 11
  assert.deepEqual(run([t("red", 12), t("red", 13), t("blue", 1)], false), [
    "blue1-0",
    "red12-0",
    "red13-0",
  ]);
  const pair = (tiles) => meldOrder(tiles, "pair", indicator);
  assert.isOk(pair([t("red", 5), t("red", 5, 1)]));
  assert.isOk(pair([t("red", 5), t("blue", 1)]));
  assert.isNull(pair([t("red", 5), t("black", 5)]));
  assert.isNull(pair([t("red", 5), t("red", 5, 1), t("blue", 1)]));
});

test("101: open with 101 points as laid out on the rack, an okey where it stands", () => {
  let s = start();
  assert.equal(
    americano.openHand(s, 1, [[...seri, ...kut]]),
    "Open with 101+ or 5 pairs",
  );
  s = americano.openHand(s, 1, [opening]);
  assert.isTrue(s.opened[1]);
  assert.deepEqual(
    s.melds.map((m) => ids(m.tiles)),
    [seri, kut, yellow],
  );
  // the okey left of the 10 is the 9: 30 + 52 + 18 = 100
  const okeyFirst = ["blue1-0", "red10-0", "red11-0"];
  assert.equal(
    americano.openHand(start(2, okeyFirst), 1, [opening]),
    "Open with 101+ or 5 pairs",
  );
});

test("101: picked tiles that fit no set or run stay on the rack", () => {
  // the red 3 right after red 10-11-okey, and a black 2 on its own
  let s = start(2, [...seri, "red3-0"]);
  s = americano.openHand(s, 1, [[...opening, "red3-0", "black2-0"]]);
  assert.isTrue(s.opened[1]);
  assert.deepEqual(
    s.melds.map((m) => ids(m.tiles)),
    [seri, kut, yellow],
  );
  assert.isOk(tileIn(s, 1, "red3-0"));
  assert.isOk(tileIn(s, 1, "black2-0"));
  assertAllTiles(s);
  // the 13s and yellows alone are 70
  assert.equal(
    americano.openHand(start(), 1, [[...kut, ...yellow, "black2-0"]]),
    "Open with 101+ or 5 pairs",
  );
  // P2: six pairs out of more picked tiles, all six laid
  s = americano.discardTile(start(), 1, tileIn(start(), 1, "yellow11-0"));
  s = americano.drawTile(s, 2, s.drawPile.at(-1), 25);
  const sixPairs = [...fivePairs, "black6-0", "black6-1"];
  s = americano.openHand(s, 2, [[...sixPairs, "blue2-0", "yellow4-0"]]);
  assert.isTrue(s.openedWithPairs[2]);
  assert.deepEqual(
    s.melds.flatMap((m) => ids(m.tiles)).sort(),
    [...sixPairs].sort(),
  );
  assert.isOk(tileIn(s, 2, "blue2-0"));
  assert.isOk(tileIn(s, 2, "yellow4-0"));
});

test("101: open with 5 pairs; then only pairs, or adding to sets and runs", () => {
  let s = americano.openHand(start(), 1, [opening]);
  // laying more right after opening is allowed (this just isn't a meld)
  assert.equal(
    americano.layMelds(s, 1, [["black2-0", "black3-0", "yellow1-0"]]),
    "That's not a küt or a seri",
  );
  s = americano.discardTile(s, 1, tileIn(s, 1, "yellow11-0"));
  s = americano.drawTile(s, 2, s.drawPile.at(-1), 25);

  assert.equal(
    americano.openHand(s, 2, [fivePairs.slice(0, 8)]),
    "Open with 101+ or 5 pairs",
  );
  s = americano.openHand(s, 2, [fivePairs]);
  assert.isTrue(s.openedWithPairs[2]);
  assert.equal(s.melds.length, 3 + 5);
  // the same turn: more pairs, and extending P1's run, but no new runs
  assert.match(
    americano.layMelds(s, 2, [["blue2-0", "blue3-0", "blue4-0"]]),
    /You opened with pairs/,
  );
  s = americano.layMelds(s, 2, [["black6-0", "black6-1"]]);
  assert.equal(s.melds.at(-1).type, "pair");
  s = americano.addToMeld(s, 2, "yellow4-0", 2);
  assert.deepEqual(ids(s.melds[2].tiles), ["yellow4-0", ...yellow]);
  // a pair doesn't grow
  assert.equal(s.melds[3].type, "pair");
  assert.equal(
    americano.addToMeld(s, 2, "black11-0", 3),
    "That tile doesn't fit there",
  );
  assertAllTiles(s);
});

test("101: no out-of-turn takes", () => {
  let s = americano.openHand(start(3), 1, [opening]);
  s = americano.discardTile(s, 1, tileIn(s, 1, "yellow11-0"));
  assert.isNull(americano.upForClaim(s));
  s = americano.drawTile(s, 2, s.drawPile.at(-1), 25);
  assert.isNull(s.offer);
  assert.equal(americano.claimDiscard(s, 3, 25), "Nothing to take right now");
});

test("101: a discard taken must go into a meld that turn, or back on its pile", () => {
  let s = start();
  s = americano.discardTile(s, 1, tileIn(s, 1, "black9-0"));
  const taken = player(s, 1).discardPile.at(-1);
  s = americano.drawTile(s, 2, taken, 25);
  assert.equal(
    americano.discardTile(s, 2, tileIn(s, 2, "yellow12-0")),
    "Use the tile you took from the discard, or put it back",
  );

  assert.deepEqual(s.turnMoves, [{ by: 2, move: "took", tiles: ["black9-0"] }]);
  // put back: P2 draws from the pile instead
  const back = americano.returnDiscard(s, 2);
  assert.deepEqual(back.penalties, { 2: 101 });
  assert.equal(back.message, "P2 put the tile back: +101");
  assert.deepEqual(back.turnMoves, []);
  assert.equal(player(back, 1).discardPile.at(-1).id, "black9-0");
  assert.isNotOk(tileIn(back, 2, "black9-0"));
  assert.isFalse(back.drawn);
  assertAllTiles(back);

  // or used in the opening, here a sixth pair
  s = americano.openHand(s, 2, [[...fivePairs, "black9-0", "black9-1"]]);
  s = americano.discardTile(s, 2, tileIn(s, 2, "yellow12-0"));
  assert.equal(s.currentPlayer, 1);
  assertAllTiles(s);
});

test("101: a table okey goes to whoever holds its tile, once they've opened", () => {
  let s = americano.openHand(start(), 1, [opening]);
  s = americano.discardTile(s, 1, tileIn(s, 1, "yellow11-0"));
  s = americano.drawTile(s, 2, s.drawPile.at(-1), 25);
  // red12 is what the okey in red 10-11-okey stands for
  assert.equal(
    americano.playOnMeld(s, 2, "red12-0", 0),
    "Open your hand first",
  );
  s = americano.playOnMeld(
    { ...s, opened: { ...s.opened, 2: true } },
    2,
    "red12-0",
    0,
  );
  assert.deepEqual(ids(s.melds[0].tiles), ["red10-0", "red11-0", "red12-0"]);
  assert.isOk(tileIn(s, 2, "blue1-0"));
  assertAllTiles(s);
});

test("101: open all but one tile at once and finish, under 101 too", () => {
  // red 1-2-3 and three 5s: 21 points, and a 9 to finish with
  const melds = [
    "red1-1",
    "red2-1",
    "red3-1",
    "red5-1",
    "black5-1",
    "yellow5-1",
  ];
  const one = (extra) =>
    holding(start(), 1, [
      ...melds.slice(0, 3),
      null,
      ...melds.slice(3),
      null,
      "blue9-1",
      ...extra,
    ]);
  // a tile more, short of 101, doesn't open
  assert.equal(
    americano.openHand(one(["blue10-1"]), 1, [melds]),
    "Open with 101+ or 5 pairs",
  );
  let s = americano.openHand(one([]), 1, [melds]);
  assert.isTrue(s.opened[1]);
  s = americano.finishGame(s, 1, tileIn(s, 1, "blue9-1"));
  assert.equal(s.scores[1][0], -101);
  // doubling: nobody else had opened, so that's twice over
  const doubled = { ...ONE_O_ONE, doubling: true };
  s = holding(start(2, seri, doubled), 1, [...melds, null, "blue9-1"]);
  s = americano.openHand(s, 1, [melds]);
  s = americano.finishGame(s, 1, tileIn(s, 1, "blue9-1"));
  assert.equal(s.scores[1][0], -202);
  assert.equal(s.scores[2][0], 404);
});

test("101: a pairs opener adds 2 tiles a turn; once someone opens with pairs, anyone lays pairs", () => {
  let s = americano.openHand(start(), 1, [opening]);
  s = americano.discardTile(s, 1, tileIn(s, 1, "yellow11-0"));
  s = americano.drawTile(s, 2, s.drawPile.at(-1), 25);
  s = americano.openHand(s, 2, [fivePairs]);
  // red 4, 3 and 2 for a run of red 5-6-7
  const run = ["red5-1", "red6-1", "red7-1"].map((x) => lying(x, "table"));
  s = { ...s, melds: [...s.melds, { type: "seri", owner: 1, tiles: run }] };
  s = holding(s, 2, ["red4-1", "red3-1", "red2-1", "blue2-0", "blue3-0"]);
  const at = s.melds.length - 1;
  s = americano.addToMeld(s, 2, "red4-1", at);
  s = americano.addToMeld(s, 2, "red3-1", at);
  assert.equal(
    americano.addToMeld(s, 2, "red2-1", at),
    "You opened with pairs: 2 tiles a turn",
  );
  // P1 lays a pair now that P2 opened with them
  s = americano.discardTile(s, 2, tileIn(s, 2, "blue2-0"));
  s = americano.drawTile(s, 1, s.drawPile.at(-1), 25);
  s = holding(s, 1, ["red2-0", "red2-1", "black3-0"]);
  s = americano.layMelds(s, 1, [["red2-0", "red2-1"]]);
  assert.equal(s.melds.at(-1).type, "pair");
});

test("101: a discard is caught until the next player draws, and never by a partner", () => {
  const partners = { ...ONE_O_ONE, partners: true };
  assert.equal(
    americano.startGame(seated(3), undefined, partners).message,
    "Partners take four players",
  );
  let s = americano.openHand(start(4, seri, partners), 1, [opening]);
  s = americano.discardTile(s, 1, tileIn(s, 1, "black2-0"));
  s = americano.drawTile(s, 2, s.drawPile.at(-1), 25);
  // yellow 4 fits P1's yellow 5-6-7; P4 is P2's partner
  s = americano.discardTile(s, 2, tileIn(s, 2, "yellow4-0"));
  assert.equal(americano.catchDiscard(s, 4), "That's your partner's tile");
  assert.deepEqual(player(americano.catchDiscard(s, 1), 1).caught, [
    "yellow4-0",
  ]);
  s = americano.drawTile(s, 3, s.drawPile.at(-1), 25);
  assert.equal(americano.catchDiscard(s, 1), "Too late to catch it");
});

// P1 finishes by discarding their last tile; P2 opened with sets and runs,
// P3 with pairs, P4 didn't open
function finished({
  pairsWin = false,
  last = "yellow1-0",
  rules = ONE_O_ONE,
  p4 = ["red9-0"],
  round = 1,
} = {}) {
  let s = americano.startGame(
    seated(4),
    { okeyTile: "blue13-1" }, // the okey is blue1
    rules,
  );
  const hand = (id, tileIds) => tileIds.map((x) => lying(x, `hand-${id}`));
  const hands = {
    1: hand(1, [last]),
    2: hand(2, ["red5-0", "black7-0", "blue1-1"]), // 12 + an okey: 113
    3: hand(3, ["red3-0", "red4-0"]),
    4: hand(4, p4),
  };
  s = {
    ...s,
    round,
    currentPlayer: 1,
    drawn: true,
    opened: { 1: true, 2: true, 3: true },
    openedWithPairs: { 3: true, ...(pairsWin && { 1: true }) },
    penalties: { 2: 101 },
    players: s.players.map((p) => ({ ...p, hand: hands[p.id] })),
  };
  return americano.finishGame(s, 1, player(s, 1).hand[0]);
}
const scoresOf = (s) =>
  Object.fromEntries(s.players.map((p) => [p.id, s.scores[p.id].at(-1)]));
const finish = (options) => scoresOf(finished(options));

test("101: scoring a hand, as it is or doubling, alone or in pairs", () => {
  // the winner -101; face value (an okey 101), 202 for not opening and 101
  // for each okey held; penalties on top
  assert.deepEqual(finish(), { 1: -101, 2: 113 + 101, 3: 7, 4: 202 });
  assert.deepEqual(finish({ pairsWin: true, last: "blue1-0" }), finish());
  assert.deepEqual(finish({ p4: ["red9-0", "blue1-0"] }), {
    ...{ 1: -101, 2: 214, 3: 7, 4: 202 + 101 },
  });
  // doubling: a pairs opener pays twice; a win with pairs or with the okey
  // doubles every score, each
  const doubling = { ...ONE_O_ONE, doubling: true };
  assert.deepEqual(finish({ rules: doubling }), {
    ...{ 1: -101, 2: 214, 3: 14, 4: 202 },
  });
  assert.deepEqual(finish({ rules: doubling, pairsWin: true }), {
    ...{ 1: -202, 2: 2 * 113 + 101, 3: 28, 4: 404 },
  });
  assert.deepEqual(
    finish({ rules: doubling, pairsWin: true, last: "blue1-0" }),
    { 1: -404, 2: 4 * 113 + 101, 3: 56, 4: 808 },
  );
  // in pairs the finisher's partner, across the table, pays nothing for
  // their hand; the lowest pair wins
  const partners = { ...ONE_O_ONE, partners: true };
  assert.deepEqual(finish({ rules: partners }), {
    ...{ 1: -101, 2: 214, 3: 0, 4: 202 },
  });
  assert.equal(
    finished({ rules: partners, round: 11 }).message,
    "P1 & P3 win with -101",
  );
});

test("101: discarding the okey costs 101", () => {
  let s = americano.openHand(start(), 1, [opening]);
  s = americano.discardTile(s, 1, tileIn(s, 1, "yellow11-0"));
  s = americano.drawTile(s, 2, s.drawPile.at(-1), 25);
  const okey = { ...game.tiles.find((x) => x.id === "blue1-1") };
  s = {
    ...s,
    drawPile: s.drawPile.filter((x) => x.id !== okey.id),
    players: s.players.map((p) =>
      p.id === 2
        ? {
            ...p,
            hand: p.hand.map((x, i) =>
              i === 24 ? { ...okey, source: "hand-2", hidden: false } : x,
            ),
          }
        : p,
    ),
  };
  s = americano.discardTile(s, 2, tileIn(s, 2, "blue1-1"));
  assert.deepEqual(s.penalties, { 2: 101 });
});

test("101: a pile that runs out ends the hand as usual; it's dealt again only if everyone opened with pairs", () => {
  // P2 threw the okey earlier in the hand
  let s = {
    ...americano.startGame(seated(3), undefined, ONE_O_ONE),
    penalties: { 2: 101 },
  };
  while (s.gameState === "play") {
    const p = s.currentPlayer;
    if (!s.drawn) {
      s = americano.drawTile(s, p, s.drawPile.at(-1), 25);
    }
    s = americano.discardTile(s, p, player(s, p).hand.find(Boolean));
  }
  assert.equal(s.gameState, "roundEnd");
  assert.isFalse(s.replay);
  assert.equal(s.message, "Round 1: no tiles left");
  const okeys = (p) => p.hand.filter((x) => x && isOkey(x, s.okeyTile)).length;
  for (const p of s.players.filter((x) => x.user)) {
    // nobody opened: 202, the okeys held, and the okeys thrown on the way
    assert.equal(
      s.scores[p.id][0],
      202 + 101 * okeys(p) + (s.penalties[p.id] ?? 0),
    );
  }
  assert.equal(americano.nextRound(s).round, 2);

  // everyone opened with pairs: nobody could finish
  let p = start();
  p = {
    ...p,
    opened: { 1: true, 2: true },
    openedWithPairs: { 1: true, 2: true },
    drawPile: [],
  };
  p = americano.discardTile(p, 1, tileIn(p, 1, "black2-0"));
  assert.isTrue(p.replay);
  assert.equal(p.message, "Round 1: no tiles left, dealt again");
});

test("101: a game set up mid-hand starts clean", () => {
  const s = americano.setUp(
    {
      ...start(),
      openedWithPairs: { 1: true },
      penalties: { 2: 101 },
      replay: true,
      tookDiscard: { player: 1, from: 2, tileId: "red5-0" },
      tookOkey: { player: 1, meld: 0, tileId: "blue1-0" },
    },
    3,
    { 1: 50, 2: 120 },
    2,
    ONE_O_ONE,
  );
  assert.equal(s.round, 3);
  assert.deepEqual(s.openedWithPairs, {});
  assert.deepEqual(s.penalties, {});
  assert.isFalse(s.replay);
  assert.isNull(s.tookDiscard);
  assert.isNull(s.tookOkey);
});
