import { assert, test } from "vitest";
import * as americano from "./americano";
import * as bot from "./bot";
import * as game from "./game";
import { meldOrder } from "./melds";
import { AMERICANO, CLASSIC, ONE_O_ONE } from "./rulesets";
import { createTile } from "./utils";

const indicator = createTile("blue", 13, 1); // the okey is blue1
const t = (color, rank, i = 0) => createTile(color, rank, i);
const ids = (tiles) => tiles.map((x) => x.id).sort();

function seated(count) {
  return {
    ...game.initialState,
    players: game.initialState.players.map((p) =>
      p.id <= count
        ? { ...p, user: { id: `u${p.id}`, name: `P${p.id}` }, userKey: p.id }
        : p,
    ),
  };
}

// a discard time past the wait that lets the others take the discard
const afterWait = (s) => s.offer.at + AMERICANO.claimWaitSeconds * 1000;

// every tile once, wherever it is
function assertAllTiles(s) {
  const all = [
    ...s.drawPile,
    s.okeyTile,
    s.finishTile,
    ...s.players.flatMap((p) => [...p.hand, ...p.discardPile]),
    ...s.melds.flatMap((m) => m.tiles),
  ]
    .filter(Boolean)
    .map((x) => x.id);
  assert.equal(all.length, game.tileSet(game.setsOf(s)).length);
  assert.equal(new Set(all).size, all.length);
}

// melds the rules take as they are, okeys where they stand
function assertMelds({ melds }, wrap, ind = indicator) {
  for (const m of melds) {
    const ordered = meldOrder(m.tiles, m.type, ind, wrap);
    assert.isOk(ordered, ids(m.tiles).join());
    if (m.type === "seri") assert.equal(ordered, m.tiles);
  }
}

test("the most tiles in melds, an okey filling in", () => {
  const tiles = [
    ...[t("red", 3), t("red", 4), t("red", 5)],
    ...[t("black", 5), t("yellow", 5), t("blue", 1)], // blue1: the okey
    t("red", 9),
  ];
  const best = bot.bestMelds(tiles, indicator, false);
  assert.equal(best.covered, 6);
  assert.deepEqual(ids(best.rest), ["red9-0"]);
  assertMelds(best, false);
  // the okey in a run, and a second copy in a run of its own
  const two = bot.bestMelds(
    [
      ...[t("red", 7), t("red", 8), t("red", 9)],
      ...[t("red", 7, 1), t("red", 8, 1), t("blue", 1)],
    ],
    indicator,
    false,
  );
  assert.equal(two.covered, 6);
  assertMelds(two, false);
});

test("12-13-1 is a run only with wrapRuns", () => {
  const tiles = [t("red", 12), t("red", 13), t("red", 1)];
  assert.equal(bot.bestMelds(tiles, indicator, true).covered, 3);
  assert.equal(bot.bestMelds(tiles, indicator, false).covered, 0);
  assertMelds(bot.bestMelds(tiles, indicator, true), true);
});

test("by points, the melds worth the most", () => {
  // red 11-12-13 or a küt of 2s: either way 3 tiles, but 36 beats 6
  const tiles = [
    ...[t("red", 11), t("red", 12), t("red", 13)],
    ...[t("red", 2), t("black", 2), t("yellow", 2)],
    t("blue", 1),
  ];
  const best = bot.bestMelds(tiles, indicator, false, "points");
  // the okey as a 10 in front of the run: 46, with the 2s' küt 52
  assert.equal(best.points, 52);
  assertMelds(best, false);
});

test("a 101 hand of 22 is read in good time", () => {
  const s = americano.startGame(seated(4), undefined, ONE_O_ONE);
  const start = performance.now();
  for (const p of s.players) {
    const hand = p.hand.filter(Boolean);
    assertMelds(bot.bestMelds(hand, s.okeyTile, false), false, s.okeyTile);
  }
  assert.isBelow(performance.now() - start, 2000);
});

// the others, as the pages playing them do between moves: tiles won onto
// the rack, or a claim on the discard up for it
function outOfTurn(s) {
  for (const p of s.players) {
    if (s.gameState !== "play") break;
    const next = p.inbox?.length
      ? americano.collectInbox(s, p.id)
      : bot.claim(s, p.id) || bot.catchTile(s, p.id);
    if (next) s = next;
  }
  return s;
}

// four bots play the round out: every step a move, no tile lost
function botsPlay(s) {
  let now = 0;
  for (let steps = 0; s.gameState === "play"; steps++) {
    now += 60000; // past the others' time to take the discard
    const next = bot.step(s, s.currentPlayer, now);
    assert.isObject(next, `round ${s.round}: ${next}`);
    // 101: it takes a discard only to use it, never to put it back (+101,
    // and it took it again, on and on)
    assert.notMatch(next.message ?? "", /put the tile back/);
    s = outOfTurn(next);
    assertAllTiles(s);
    assert.isBelow(steps, 3000, `round ${s.round} goes on and on`);
  }
  return s;
}

test("bots play every Americano round to its end", () => {
  let finished = 0;
  for (let round = 1; round <= AMERICANO.rounds.length; round++) {
    const s = americano.setUp(seated(4), round, {}, 1, AMERICANO);
    const end = botsPlay(s);
    if (end.finishTile) finished++;
  }
  // they open and finish, not just wait for the pile to run out
  assert.isAtLeast(finished, 7);
});

test("bots play 101 and the classic game to the end of a hand", () => {
  for (let i = 0; i < 10; i++) {
    assert.isOk(botsPlay(americano.setUp(seated(4), 1, {}, 1, ONE_O_ONE)));
  }
  assert.isOk(botsPlay(americano.startGame(seated(4), undefined, CLASSIC)));
});

test("a bot takes out of turn for a new meld, not to lengthen one", () => {
  // P1 throws a red 5, which P3, a bot, makes a küt with; then a red 9,
  // which only lengthens its run of 6-7-8
  const p3 = ["black5-0", "yellow5-0", "red6-0", "red7-0", "red8-0"];
  const deal = {
    okeyTile: "blue13-1",
    hands: [["red5-0", "red9-0", "black12-0", "black13-0"], ["yellow1-0"], p3],
  };
  let s = americano.startGame(seated(3), deal, AMERICANO);
  s = {
    ...s,
    players: s.players.map((p) =>
      p.id === 3 ? { ...p, user: { ...p.user, bot: true } } : p,
    ),
  };
  const take = (s, tileId) => {
    s = americano.discardTile(
      s,
      1,
      game.seat(s, 1).hand.find((t) => t?.id === tileId),
    );
    return s;
  };
  s = take(s, "red5-0");
  // a table whose bots miss every good move (botMistakes) lets it go
  const careless = { ...s, rules: { ...s.rules, botMistakes: 100 } };
  assert.isUndefined(bot.claim(careless, 3));
  s = bot.claim(s, 3);
  assert.isOk(game.seat(s, 3).claim);
  assert.isUndefined(bot.claim(s, 3, 0)); // claimed already
  // P2 draws from the pile and throws: the red 5 goes to P3, with a tile
  // from the pile, and onto its rack
  s = americano.drawTile(s, 2, s.drawPile.at(-1), 1, 0);
  s = americano.discardTile(s, 2, game.seat(s, 2).hand[1], 0);
  s = americano.collectInbox(s, 3);
  const hand = game
    .seat(s, 3)
    .hand.filter(Boolean)
    .map((t) => t.id);
  assert.include(hand, "red5-0");
  assert.lengthOf(hand, 7);
  assert.equal(s.takes[3], 1);
  // P3's turn: the küt opens round 1 for it; then P1's red 9 isn't claimed
  for (let now = 1e6; s.currentPlayer === 3; now += 1e6) {
    s = bot.step(s, 3, now, 0);
  }
  assert.isTrue(s.opened[3]);
  s = americano.drawTile(s, 1, s.drawPile.at(-1), 5, 9e6);
  s = take(s, "red9-0");
  assert.isUndefined(bot.claim(s, 3, 0));
});

test("a person who claims too gets their time, and the tile when first in line", () => {
  // P1 throws a red 5 that P4, a bot, claims at once; P2 is to play, and
  // P3, a person, after them: first in line for it
  const deal = {
    okeyTile: "blue13-1",
    hands: [
      ["red5-0", "black12-0", "black13-0"],
      ["yellow1-0"],
      ["blue2-0"],
      ["black5-0", "yellow5-0", "red6-0"],
    ],
  };
  let s = americano.startGame(seated(4), deal, AMERICANO);
  s = {
    ...s,
    players: s.players.map((p) =>
      p.id === 4 ? { ...p, user: { ...p.user, bot: true } } : p,
    ),
  };
  const red5 = game.seat(s, 1).hand.find((t) => t?.id === "red5-0");
  s = americano.discardTile(s, 1, red5);
  s = bot.claim(s, 4, 0);
  assert.isOk(game.seat(s, 4).claim);
  // P2 draws: the discard waits for P3 all the same
  s = americano.drawTile(s, 2, s.drawPile.at(-1), 1, 0);
  const throws = game.seat(s, 2).hand[1];
  assert.isString(americano.discardTile(s, 2, throws, 1000));
  s = americano.claimDiscard(s, 3, 1);
  s = americano.discardTile(s, 2, throws, afterWait(s));
  // P3 comes first after P2: the red 5 is theirs, though the bot was quicker
  assert.include(
    game.seat(s, 3).inbox.map((t) => t.id),
    "red5-0",
  );
  assert.deepEqual(game.seat(s, 4).inbox, []);
  assert.deepEqual(s.takes, { 3: 1 });
});

test("a bot keeps a tile that fits the table rather than have it caught", () => {
  // the 13s' küt on the table: P2's yellow 13 would add to it, so it
  // throws its red 2, though it'd throw the higher tile otherwise
  const deal = {
    okeyTile: "blue13-1",
    hands: [
      ["black1-0"],
      ["yellow13-0", "red2-0", "red7-0", "red8-0", "red9-0"],
    ],
  };
  let s = americano.startGame(seated(2), deal, AMERICANO);
  s = { ...s, currentPlayer: 2, drawn: true };
  const thrown = (s) => game.seat(bot.step(s, 2, 1e6, 0), 2).discardPile.at(-1);
  assert.equal(thrown(s).id, "yellow13-0");
  const kut = ["red13-0", "blue13-0", "black13-0"].map((id) => ({
    ...s.drawPile.find((t) => t.id === id),
    source: "table",
    hidden: false,
  }));
  s = {
    ...s,
    drawPile: s.drawPile.filter((t) => !kut.some((k) => k.id === t.id)),
    melds: [{ type: "kut", owner: 1, tiles: kut }],
  };
  assert.equal(thrown(s).id, "red2-0");
});

// P2, a bot, to play in round `round` of Americano with `hand`, the 13s'
// küt on the table and, in a yellow run, an okey standing for the yellow 5
function table13s(round, hand) {
  const deal = { okeyTile: "blue13-1", hands: [["black1-0"], hand] };
  let s = americano.startGame(seated(2), deal, AMERICANO);
  const onTable = (ids) =>
    ids.map((id) => ({
      ...s.drawPile.find((t) => t.id === id),
      source: "table",
      hidden: false,
    }));
  const kut = onTable(["red13-0", "blue13-0", "black13-0"]);
  const run = onTable(["yellow3-0", "yellow4-0", "blue1-0", "yellow6-0"]);
  return {
    ...s,
    round,
    currentPlayer: 2,
    drawn: true,
    drawPile: s.drawPile.filter(
      (t) => ![...kut, ...run].some((k) => k.id === t.id),
    ),
    melds: [
      { type: "kut", owner: 1, tiles: kut },
      { type: "seri", owner: 1, tiles: run },
    ],
    players: s.players.map((p) =>
      p.id === 2 ? { ...p, user: { ...p.user, bot: true } } : p,
    ),
  };
}

test("before opening, a bot takes a table okey when it opens the hand", () => {
  // round 6, a 4'lü küt: three 9s, and the okey for its yellow 5
  let s = table13s(6, ["red9-0", "blue9-0", "black9-0", "yellow5-0", "red2-0"]);
  s = bot.step(s, 2, 1e6, 0);
  assert.include(ids(game.seat(s, 2).hand.filter(Boolean)), "blue1-0");
  s = bot.step(s, 2, 2e6, 0);
  assert.isTrue(s.opened[2]);
  // with nothing it would open with, it leaves the okey where it is
  s = table13s(6, ["red9-0", "blue9-0", "yellow5-0", "red2-0"]);
  s = bot.step(s, 2, 1e6, 0);
  assert.notInclude(ids(game.seat(s, 2).hand.filter(Boolean)), "blue1-0");
});

test("a bot catches a tile thrown that fits the table", () => {
  let s = table13s(1, ["red2-0"]);
  s = {
    ...s,
    currentPlayer: 1,
    players: s.players.map((p) =>
      p.id === 1
        ? {
            ...p,
            hand: [
              ...p.hand.slice(0, 1),
              {
                ...s.drawPile.find((t) => t.id === "yellow13-0"),
                source: "hand-1",
              },
              ...p.hand.slice(2),
            ],
          }
        : p,
    ),
    drawPile: s.drawPile.filter((t) => t.id !== "yellow13-0"),
  };
  s = americano.discardTile(s, 1, game.seat(s, 1).hand[1]);
  s = bot.catchTile(s, 2, 0);
  assert.deepEqual(game.seat(s, 2).caught, ["yellow13-0"]);
  assert.isUndefined(bot.catchTile(s, 2, 0)); // caught already
});

test("in 101 a bot shows the gösterge on its first turn", () => {
  const deal = {
    okeyTile: "red7-0",
    hands: [["black1-0"], ["red7-1", "blue2-0"]],
  };
  let s = americano.startGame(seated(2), deal, ONE_O_ONE);
  s = { ...s, currentPlayer: 2, drawn: false };
  s = bot.step(s, 2, 1e6, 0);
  assert.equal(s.indicatorShown, 2);
  assert.equal(s.penalties[2], ONE_O_ONE.indicatorScore);
});

test("a bot keeps its rack in order: its melds, then the rest", () => {
  let s = table13s(1, [
    ...["red2-0", "black8-0", "red3-0", "yellow11-0", "red4-0"],
    ...["blue12-0", "black7-0", "black9-0"],
  ]);
  s = bot.step(s, 2, 1e6, 0);
  const groups = americano
    .groupsOf(game.seat(s, 2).hand, game.rowOf(s))
    .map((g) => g.map((t) => t.id));
  assert.deepEqual(groups.slice(0, 2), [
    ["red2-0", "red3-0", "red4-0"],
    ["black7-0", "black8-0", "black9-0"],
  ]);
});

test("nobody waits on a bot to take the discard", () => {
  let s = americano.startGame(seated(3), undefined, AMERICANO);
  s = americano.discardTile(s, 1, game.seat(s, 1).hand.find(Boolean));
  s = americano.drawTile(s, 2, s.drawPile.at(-1), 25, 0); // P1's on offer
  assert.isAbove(americano.claimWait(s, 2, 0), 0); // P3 could take it
  const empty = (s) => ({
    ...s,
    players: s.players.map((p) => (p.id === 3 ? { ...p, user: null } : p)),
  });
  s = bot.seatBot(empty(s), 3, 7);
  assert.equal(americano.claimWait(s, 2, 0), 0); // a bot won't
});

test("a bot sits in an empty seat, or in place of one who's gone", () => {
  const lobby = bot.seatBot(seated(3), 4, 7);
  const four = game.seat(lobby, 4);
  assert.isTrue(four.user.bot);
  assert.equal(four.userKey, 7);
  assert.isUndefined(bot.seatBot(seated(3), 2, 7)); // someone's in it
  // mid-round, P2's phone slept: the bot plays their hand, and P2 can come
  // back to it
  let s = americano.startGame(seated(3));
  const hand = game.seat(s, 2).hand;
  s = {
    ...s,
    players: s.players.map((p) =>
      p.id === 2 ? { ...p, user: null, userKey: null, away: "u2" } : p,
    ),
  };
  s = bot.seatBot(s, 2, 7);
  assert.isTrue(game.seat(s, 2).user.bot);
  assert.equal(game.seat(s, 2).away, "u2");
  assert.deepEqual(game.seat(s, 2).hand, hand);
});
