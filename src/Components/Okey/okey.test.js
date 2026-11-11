import { assert, test } from "vitest";
import { cloneDeep, sum } from "lodash";
import * as okey from "./okey";
import * as game from "./game";
import { isOkey, meldOrder, okeyStandsFor, rankOf } from "./melds";
import { createTile } from "./utils";
import { AMERICANO, ONE_O_ONE } from "./rulesets";

const indicator = createTile("blue", 13, 1); // okey is blue1, fake okey = blue1
const t = (color, rank, i = 0) => createTile(color, rank, i);
const ids = (tiles) => tiles && tiles.map((x) => x.id);
// the turn so far, as [who, move, tiles...]
const turn = (s) => s.turnMoves.map((m) => [m.by, m.move, ...m.tiles]);

test("küt: one rank, different colours, 3 or 4 tiles, okey is wild", () => {
  const kut = (tiles) => ids(meldOrder(tiles, "kut", indicator));
  assert.isOk(kut([t("red", 5), t("black", 5), t("yellow", 5)]));
  assert.isOk(kut([t("red", 5), t("black", 5), t("blue", 1)]));
  assert.isNull(kut([t("red", 5), t("red", 5, 1), t("black", 5)]));
  assert.isNull(kut([t("red", 5), t("black", 6), t("yellow", 5)]));
  assert.isNull(kut([t("red", 5), t("black", 5)]));
  assert.isNull(
    kut([
      t("red", 5),
      t("black", 5),
      t("yellow", 5),
      t("blue", 5),
      t("blue", 1),
    ]),
  );
});

test("seri: one colour in a row, 12-13-1 but not 13-1-2, okey fills gaps", () => {
  const seri = (tiles) => ids(meldOrder(tiles, "seri", indicator));
  assert.deepEqual(seri([t("red", 5), t("red", 3), t("red", 4)]), [
    "red3-0",
    "red4-0",
    "red5-0",
  ]);
  assert.deepEqual(seri([t("red", 1), t("red", 12), t("red", 13)]), [
    "red12-0",
    "red13-0",
    "red1-0",
  ]);
  assert.isNull(seri([t("red", 13), t("red", 1), t("red", 2)]));
  assert.deepEqual(seri([t("red", 3), t("red", 5), t("blue", 1)]), [
    "red3-0",
    "blue1-0",
    "red5-0",
  ]);
  // an okey stands where it was put on the rack; out of order, the low end
  const okey = t("blue", 1);
  assert.deepEqual(seri([t("red", 4), t("red", 5), okey]), [
    ...["red4-0", "red5-0", "blue1-0"],
  ]);
  assert.deepEqual(seri([okey, t("red", 4), t("red", 5)]), [
    ...["blue1-0", "red4-0", "red5-0"],
  ]);
  assert.deepEqual(seri([t("red", 12), t("red", 13), okey]), [
    ...["red12-0", "red13-0", "blue1-0"],
  ]);
  assert.deepEqual(seri([t("red", 5), okey, t("red", 4)]), [
    ...["blue1-0", "red4-0", "red5-0"],
  ]);
  // the fake okey is the okey's face value: blue1
  assert.isOk(seri([t("yellow", "👌"), t("blue", 2), t("blue", 3)]));
  assert.isNull(seri([t("red", 3), t("black", 4), t("red", 5)]));
  assert.isNull(seri([t("red", 3), t("red", 3, 1), t("red", 4)]));
});

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

// every turn drawn from the pile and its first tile thrown, to the round's end
function playOut(s) {
  while (s.gameState === "play") {
    const p = s.currentPlayer;
    if (!s.drawn) s = game.drawTile(s, p, s.drawPile.at(-1), 25);
    s = okey.discardTile(s, p, player(s, p).hand.find(Boolean));
  }
  return s;
}

function assertAllTiles(s) {
  const all = [
    ...s.drawPile,
    s.okeyTile,
    s.finishTile,
    ...s.players.flatMap((p) => [
      ...p.hand,
      ...p.discardPile,
      ...(p.inbox ?? []),
    ]),
    ...(s.melds ?? []).flatMap((m) => m.tiles),
  ]
    .filter(Boolean)
    .map((x) => x.id);
  assert.equal(all.length, 106);
  assert.equal(new Set(all).size, 106);
}

// a discard time past the wait that lets the others take the discard
const afterWait = (s) => s.offer.at + AMERICANO.claimWaitSeconds * 1000;

const kut5 = ["red5-0", "blue5-0", "black5-0"];
const seri789 = ["red7-0", "red8-0", "red9-0"];
const seri234 = ["black2-0", "black3-0", "black4-0"];
const kut10 = ["blue10-0", "black10-0", "yellow10-0"];
const p2Hand = [
  ...["yellow5-0", "red11-0", "red12-0", "red13-0", "black11-0", "black12-0"],
  ...["black13-0", "blue2-0", "blue3-0", "blue4-0", "blue6-0", "blue7-0"],
  ...["blue8-0", "yellow1-0"],
];
const deal = {
  okeyTile: "blue13-1",
  hands: [
    [
      ...kut5,
      ...seri789,
      ...seri234,
      ...kut10,
      "red10-0",
      "yellow13-0",
      "yellow11-0",
    ],
    p2Hand,
  ],
};

// a run of six picked to lay goes down as one run, not as two of three
test("a long run is laid whole", () => {
  const seri6 = ["red2-0", "red3-0", "red4-0", "red5-0", "red6-0", "red7-0"];
  const rest = ["yellow9-0", "yellow11-0", "yellow13-0"];
  let s = okey.startGame(seated(2), {
    okeyTile: "blue13-1",
    hands: [[...kut10, ...seri6, ...seri234, ...rest], p2Hand],
  });
  s = okey.openHand(s, 1, [kut10]);
  s = okey.discardTile(s, 1, tileIn(s, 1, "yellow13-0"));
  s = game.drawTile(s, 2, s.drawPile.at(-1), 20);
  s = okey.discardTile(s, 2, tileIn(s, 2, "yellow5-0"));
  s = game.drawTile(s, 1, s.drawPile.at(-1), 20);
  s = okey.layMelds(s, 1, [seri6]);
  assert.deepEqual(
    s.melds.map((m) => ids(m.tiles)),
    [kut10, seri6],
  );
});

test("round 1: open exactly, lay and add later, finish by throwing the last tile to the middle", () => {
  let s = okey.startGame(seated(2), deal);
  assert.equal(s.round, 1);
  assert.equal(s.currentPlayer, 1);
  assertAllTiles(s);

  assert.equal(okey.openHand(s, 1, [seri234]), "Open with exactly: 3'lü küt");
  s = okey.openHand(s, 1, [kut5]);
  assert.isTrue(s.opened[1]);
  assert.equal(s.melds.length, 1);
  assert.equal(
    okey.layMelds(s, 1, [seri789]),
    "You can lay more from next turn",
  );
  assert.deepEqual(turn(s), [[1, "opened", ...kut5]]);
  s = okey.discardTile(s, 1, tileIn(s, 1, "yellow13-0"));
  assert.deepEqual(turn(s), []); // the turn passed

  assert.equal(okey.layMelds(s, 2, [["blue2-0"]]), "Open your hand first");
  s = game.drawTile(s, 2, s.drawPile.at(-1), 20);
  s = okey.discardTile(s, 2, tileIn(s, 2, "yellow5-0"));

  s = game.drawTile(s, 1, player(s, 2).discardPile.at(-1), 20);
  s = okey.addToMeld(s, 1, "yellow5-0", 0);
  assert.equal(s.melds[0].tiles.length, 4);
  assert.equal(
    okey.addToMeld(s, 1, "red10-0", 0),
    "That tile doesn't fit there",
  );
  s = okey.layMelds(s, 1, [seri789, seri234, kut10]);
  s = okey.addToMeld(s, 1, "red10-0", 1);
  assert.deepEqual(ids(s.melds[1].tiles), [...seri789, "red10-0"]);
  assert.equal(okey.layMelds(s, 1, [["yellow11-0"]]), "Keep a tile to discard");
  assertAllTiles(s);

  assert.equal(
    okey.discardTile(s, 1, tileIn(s, 1, "yellow11-0")),
    "Throw your last tile to the middle to finish",
  );
  s = okey.finishGame(s, 1, tileIn(s, 1, "yellow11-0"));
  assert.equal(s.gameState, "roundEnd");
  assert.equal(s.finishTile.id, "yellow11-0");
  assert.notInclude(ids(player(s, 1).discardPile), "yellow11-0");
  assertAllTiles(s);
  assert.deepEqual(s.scores, {
    1: [AMERICANO.finishScore],
    2: [AMERICANO.notOpenedScore],
  });
  // the round's end shows how P1 finished
  assert.deepEqual(turn(s), [
    [1, "took", "yellow5-0"],
    [1, "added", "yellow5-0"],
    [1, "laid", ...seri789, ...seri234, ...kut10],
    [1, "added", "red10-0"],
    [1, "finished", "yellow11-0"],
  ]);

  assert.equal(s.players.length, 4); // free seats to sit in

  s = okey.nextRound(s);
  assert.equal(s.round, 2);
  assert.equal(s.gameState, "play");
  assert.equal(s.players.length, 2);
  assert.equal(s.currentPlayer, 2); // the starter rotates
  assert.deepEqual(s.melds, []);
  assert.deepEqual(s.opened, {});
  assert.deepEqual(s.takes, {});
  assert.deepEqual(turn(s), []);
  assertAllTiles(s);
});

// P1 opened with the 5s; P2 threw a red 11 and P1 took it
function secondTurn() {
  let s = okey.startGame(seated(2), deal);
  s = okey.openHand(s, 1, [kut5]);
  s = okey.discardTile(s, 1, tileIn(s, 1, "yellow13-0"));
  s = game.drawTile(s, 2, s.drawPile.at(-1), 20);
  s = okey.discardTile(s, 2, tileIn(s, 2, "red11-0"));
  return okey.drawTile(s, 1, player(s, 2).discardPile.at(-1), 20);
}

test("a discard taken goes back on its pile that turn, free outside 101", () => {
  const s = secondTurn();
  // nor does it have to be used
  assert.isOk(okey.discardTile(s, 1, tileIn(s, 1, "yellow11-0")).players);
  const back = okey.returnDiscard(s, 1);
  assert.equal(player(back, 2).discardPile.at(-1).id, "red11-0");
  assert.isNotOk(tileIn(back, 1, "red11-0"));
  assert.isFalse(back.drawn);
  assert.deepEqual(back.penalties, {});
  assert.deepEqual(turn(back), []);
  assertAllTiles(back);
  // a hand finished from the hand (Elden) leaves nothing to put back
  assert.isNull(okey.nextRound({ ...back, gameState: "roundEnd" }).tookDiscard);
});

test("a tile added this turn comes back to the rack, a seri's from its end", () => {
  let s = okey.layMelds(secondTurn(), 1, [seri789]);
  s = okey.addToMeld(s, 1, "red10-0", 1);
  s = okey.addToMeld(s, 1, "red11-0", 1, true);
  assert.equal(
    okey.takeBack(s, 1, "red10-0", 20),
    "Take back the tile past it first",
  );
  assert.equal(
    okey.takeBack(s, 1, "red7-0", 20),
    "Only a tile you added this turn comes back",
  );
  s = okey.takeBack(s, 1, "red11-0", 20);
  assert.equal(player(s, 1).hand[20].id, "red11-0");
  assert.equal(player(s, 1).hand[20].source, "hand-1");
  s = okey.takeBack(s, 1, "red10-0", 21);
  assert.deepEqual(ids(s.melds[1].tiles), seri789);
  assert.deepEqual(turn(s), [
    [1, "took", "red11-0"],
    [1, "laid", ...seri789],
  ]);
  assertAllTiles(s);

  // once the turn has passed, it stays
  s = okey.addToMeld(s, 1, "red10-0", 1);
  s = okey.discardTile(s, 1, tileIn(s, 1, "yellow11-0"));
  assert.equal(
    okey.takeBack(s, 1, "red10-0", 20),
    "Only a tile you added this turn comes back",
  );
});

test("picked tiles dropped on a meld are all added to it, or laid down", () => {
  const s = okey.layMelds(secondTurn(), 1, [seri789]);
  // in whatever order they're picked
  for (const pick of [
    ["red11-0", "red10-0"],
    ["red10-0", "red11-0"],
  ]) {
    const added = okey.addPick(s, 1, [pick], 1);
    assert.deepEqual(ids(added.melds[1].tiles), [
      ...seri789,
      "red10-0",
      "red11-0",
    ]);
    assert.deepEqual(turn(added).slice(2), [
      [1, "added", "red10-0"],
      [1, "added", "red11-0"],
    ]);
  }
  // an okey goes on after the real tiles, on the end it's dropped on
  const wild = s.drawPile.find((x) => x.id.startsWith("blue1-"));
  const withOkey = cloneDeep(s);
  withOkey.drawPile = withOkey.drawPile.map((x) =>
    x.id === wild.id ? { ...tileIn(s, 1, "yellow11-0"), hidden: true } : x,
  );
  player(withOkey, 1).hand = player(withOkey, 1).hand.map((x) =>
    x?.id === "yellow11-0" ? { ...wild, source: "hand-1", hidden: false } : x,
  );
  for (const pick of [
    [wild.id, "red10-0"],
    ["red10-0", wild.id],
  ]) {
    const added = okey.addPick(withOkey, 1, [pick], 1, true);
    assert.deepEqual(ids(added.melds[1].tiles), [
      ...seri789,
      "red10-0",
      wild.id,
    ]);
    assertAllTiles(added);
  }
  // one that doesn't fit: none are added, and they don't lay down either
  assert.equal(
    okey.addPick(s, 1, [["red10-0", "yellow11-0"]], 1),
    "That's not a küt or a seri",
  );
  // a meld of their own that doesn't go on this one lays down
  const laid = okey.addPick(s, 1, [kut10], 1);
  assert.deepEqual(ids(laid.melds.at(-1).tiles), kut10);
  assertAllTiles(laid);
});

test("five play with a fifth seat; the presets refuse one", () => {
  // the fifth seat shows once the other four are taken, when the lobby's
  // settings seat five
  const five = (n) => ({ ...seated(n), setup: { ...AMERICANO, seats: 5 } });
  assert.lengthOf(game.tableSeats(five(3)), 4);
  assert.lengthOf(game.tableSeats(five(4)), 5);
  // and never with the four the presets seat
  assert.lengthOf(game.tableSeats({ ...seated(4), setup: AMERICANO }), 4);
  let s = okey.startGame(seated(5), undefined, {
    ...AMERICANO,
    seats: 5,
  });
  assert.equal(s.gameState, "play");
  assert.deepEqual(
    s.players.map((p) => p.hand.filter(Boolean).length),
    [15, 14, 14, 14, 14],
  );
  assert.equal(s.drawPile.length, 106 - 72);
  assertAllTiles(s);
  for (const refused of [
    game.startGame(seated(5)),
    okey.startGame(seated(5)),
    okey.startGame(seated(5), undefined, ONE_O_ONE),
  ]) {
    assert.equal(refused.gameState, "start");
    assert.equal(refused.message, "Up to 4 players with these rules");
  }
  // a 101 game offers four seats between hands
  s = okey.startGame(seated(2), undefined, ONE_O_ONE);
  assert.lengthOf(okey.redealRound(s).players, 4);
});

test("between rounds seats can be freed and taken", () => {
  const sit = (s, id, name) => ({
    ...s,
    players: s.players.map((p) =>
      p.id === id ? { ...p, user: name && { id: name, name }, userKey: id } : p,
    ),
  });
  let s = {
    ...okey.startGame(seated(3)),
    gameState: "roundEnd",
    round: 2,
    scores: { 1: [10, 5], 2: [30, 12], 3: [-20, 40] },
  };
  s = { ...s, players: game.allSeats(s.players) };
  // P3's phone slept
  s.players = s.players.map((p) =>
    p.id === 3 ? { ...p, user: null, userKey: null, away: "u3" } : p,
  );
  s = sit(s, 4, "Deniz");
  s = okey.freeSeat(s, 2);
  assert.equal(s.message, "P2 left");

  s = okey.nextRound(s);
  // P3's seat is still dealt, waiting for them or someone to sit down; P2's
  // is out, its score kept
  assert.deepEqual(
    s.players.map((p) => p.id),
    [1, 3, 4],
  );
  assert.deepEqual(s.scores[2], [30, 12]);
  assert.isNull(player(s, 3).user);
  assert.equal(player(s, 3).hand.filter(Boolean).length, 14);
  // Deniz starts level with the worst total still playing
  assert.deepEqual(s.scores[4], [null, 20]);
  assertAllTiles(s);

  // nobody sits back down in seat 3: it's scored all the same
  s = playOut(s);
  assert.equal(s.scores[3].length, 3);
  // a seat whose player is gone (away) is freed for good: nobody sits back
  // down in it by themselves
  assert.notProperty(player(okey.freeSeat(s, 3), 3), "away");
  // and P2's seat, back empty between rounds, stays out of the next deal
  s = okey.nextRound(s);
  assert.deepEqual(
    s.players.map((p) => p.id),
    [1, 3, 4],
  );
});

test("mid-round a freed seat leaves the round, the turn passing on", () => {
  let s = okey.startGame(seated(4));
  // P1 starts: freed on their turn, P2 plays on as if P1 had discarded
  s = okey.freeSeat(s, 1);
  assert.deepEqual(
    s.players.map((p) => p.id),
    [2, 3, 4],
  );
  assert.equal(s.currentPlayer, 2);
  assert.isFalse(s.drawn);
  assert.equal(s.message, "P1 left");
  // its 15 tiles went back into the middle pile
  assertAllTiles(s);
  // P3 freed out of turn: after P2 comes P4; its discard back in the pile,
  // and caught, no longer counts as caught
  s = game.drawTile(s, 2, s.drawPile.at(-1), 25);
  s = okey.discardTile(s, 2, player(s, 2).hand.find(Boolean), Infinity);
  s = game.drawTile(s, 3, s.drawPile.at(-1), 25);
  s = okey.discardTile(s, 3, player(s, 3).hand.find(Boolean), Infinity);
  const thrown = s.lastDiscard;
  s = {
    ...s,
    players: s.players.map((p) =>
      p.id === 4 ? { ...p, caught: [thrown] } : p,
    ),
  };
  s = okey.freeSeat(s, 3);
  assertAllTiles(s);
  assert.isTrue(s.drawPile.some((t) => t.id === thrown && t.hidden));
  assert.isFalse(okey.isCaught(s, thrown));
  assert.isNull(s.lastDiscard);
  s = game.drawTile(s, 4, s.drawPile.at(-1), 25);
  s = okey.discardTile(s, 4, player(s, 4).hand.find(Boolean), Infinity);
  s = game.drawTile(s, 2, s.drawPile.at(-1), 25);
  s = okey.discardTile(s, 2, player(s, 2).hand.find(Boolean));
  assert.equal(s.currentPlayer, 4);
  assert.equal(okey.freeSeat(s, 4), "A round takes two players");
  // played out by the two, scored for them alone
  s = playOut(s);
  assert.equal(s.gameState, "roundEnd");
  assert.deepEqual(Object.keys(s.scores), ["2", "4"]);
  s = okey.nextRound(s);
  assert.deepEqual(
    s.players.map((p) => p.id),
    [2, 4],
  );

  // partners sit by position: a seat can't leave their round
  const pairs = okey.startGame(seated(4), undefined, {
    ...AMERICANO,
    partners: true,
  });
  assert.equal(okey.freeSeat(pairs, 2), "Partners take four players");
});

test("mid-round an empty seat is sat down in, dealt from the middle pile", () => {
  const ece = { id: "u4", name: "Ece" };
  let s = okey.startGame(seated(3));
  // not at the table, nor sat down in by itself: the ⋯ menu's to offer
  assert.deepEqual(
    game.tableSeats(s).map((p) => p.id),
    [1, 2, 3],
  );
  assert.isUndefined(okey.seatToJoin(s, ece));
  assert.deepEqual(okey.freeSeats(s), [4]);
  const pile = s.drawPile.length;
  s = okey.sit(s, 4, ece, 7);
  assert.equal(player(s, 4).user.name, "Ece");
  assert.equal(player(s, 4).hand.filter(Boolean).length, 14);
  assert.equal(s.drawPile.length, pile - 14);
  assertAllTiles(s);
  // after P3 comes Ece
  assert.equal(game.next(s.players, 3).id, 4);
  // later in the game: level with whoever's losing
  s = {
    ...okey.freeSeat(s, 4),
    round: 3,
    scores: { 1: [10, 20], 2: [40, 30], 3: [0, 5] },
  };
  s = okey.sit(s, 4, ece, 7);
  assert.deepEqual(s.scores[4], [null, 70]);
  // no hand left in the pile for them, or partners: none dealt in
  const short = {
    ...okey.freeSeat(s, 4),
    drawPile: s.drawPile.slice(0, 13),
  };
  assert.equal(
    okey.sit(short, 4, ece, 7),
    "Not enough tiles left to deal you in",
  );
  assert.deepEqual(okey.freeSeats(short), []);
  const pairs = { ...short, rules: { ...short.rules, partners: true } };
  assert.equal(okey.sit(pairs, 4, ece, 7), "Partners take four players");
});

test("a seat whose page has gone is away, and sat back down in by its player", () => {
  let s = okey.startGame(seated(4));
  s = {
    ...s,
    players: s.players.map((p) =>
      p.id === 4 ? { ...p, user: { id: "bot", name: "🤖", bot: true } } : p,
    ),
  };
  // P2's and the bot's pages are gone; this page is P1's (key 1)
  const present = new Set([1, 3]);
  const next = okey.markGone(s, present, 1, "u1");
  assert.deepEqual(
    [player(next, 2).user, player(next, 2).away, player(next, 2).awayName],
    [null, "u2", "P2"],
  );
  assert.equal(next.message, "P2 left");
  // the bot played on by the page with the lowest key
  assert.equal(player(next, 4).userKey, 1);
  // and not by another
  assert.equal(player(okey.markGone(s, present, 3, "u3"), 4).userKey, 4);
  // seeing nobody else, this page is the one offline: nobody unseated
  assert.isUndefined(okey.markGone(s, new Set([1]), 1, "u1"));
  // P2 back: their seat, theirs again; nobody else sits in it by themselves
  const bora = { id: "u2", name: "P2" };
  assert.equal(okey.seatToSitBack(next, bora, new Set([1, 3, 9])), 2);
  assert.isUndefined(okey.seatToJoin(next, bora));
  const back = okey.sit(next, 2, bora, 9);
  assert.deepEqual(
    [player(back, 2).user, player(back, 2).away, player(back, 2).awayName],
    [bora, undefined, undefined],
  );
  // a bot keeps it for them meanwhile
  const kept = okey.sit(next, 2, { id: "b", name: "🤖", bot: true }, 1);
  assert.equal(player(kept, 2).away, "u2");
  assert.equal(okey.seatToSitBack(kept, bora, new Set([1, 9])), 2);
});

test("your own tiles flip while the round is played; laying waits for the draw", () => {
  let s = okey.startGame(seated(2));
  const mine = player(s, 1).hand.find(Boolean);
  const theirs = player(s, 2).hand.find(Boolean);
  const flipped = okey.flipTile(s, 1, mine.id);
  assert.isTrue(tileIn(flipped, 1, mine.id).hidden);
  assert.isFalse(tileIn(okey.flipTile(flipped, 1, mine.id), 1, mine.id).hidden);
  assert.isUndefined(okey.flipTile(s, 1, theirs.id));
  assert.isUndefined(
    okey.flipTile({ ...s, gameState: "roundEnd" }, 1, mine.id),
  );
  // the starter's extra tile is its draw; the next player lays once drawn
  assert.isTrue(okey.canLay(s, 1));
  assert.isFalse(okey.canLay(s, 2));
  s = okey.discardTile(s, 1, mine, Infinity);
  assert.isFalse(okey.canLay(s, 2));
  s = okey.drawTile(s, 2, s.drawPile.at(-1), 25);
  assert.isTrue(okey.canLay(s, 2));
});

test("standing up mid-round leaves the hand for a friend to sit down to", () => {
  let s = okey.startGame(seated(3));
  s = okey.standUp(s, 2);
  assert.equal(s.message, "P2 left");
  assert.deepEqual(
    s.players.map((p) => p.id),
    [1, 2, 3],
  );
  assert.isNull(player(s, 2).user);
  assert.equal(player(s, 2).hand.filter(Boolean).length, 14);
  // nobody sits down: played out, then out of the next deal
  s = okey.nextRound(playOut(s));
  assert.deepEqual(
    s.players.map((p) => p.id),
    [1, 3],
  );
});

test("a seat back after rounds without it scores each one's worst", () => {
  let s = {
    ...okey.startGame(seated(3)),
    gameState: "roundEnd",
    round: 4,
    // P3 was freed after round 1 and sits back down now
    scores: { 1: [10, 5, 50, 0], 2: [30, 12, 8, 70], 3: [-20] },
  };
  s = { ...s, players: game.allSeats(s.players) };
  s.players = s.players.map((p) =>
    p.id === 4 ? { ...p, user: { id: "u4", name: "Deniz" }, userKey: 4 } : p,
  );
  s = okey.nextRound(s);
  assert.deepEqual(s.scores[3], [-20, 12, 50, 70]);
  // a new seat starts level with the worst total, without rounds to fill
  assert.deepEqual(s.scores[4], [null, null, null, 120]);
  s = okey.nextRound(playOut(s));
  assert.deepEqual(s.scores[4].slice(0, 3), [null, null, null]);
});

test("a round dealt again: seats change in between, scores stay, its penalties go", () => {
  let s = {
    ...okey.startGame(seated(3)),
    round: 2,
    scores: { 1: [10], 2: [30], 3: [-20] },
  };
  s = okey.nextRound({ ...s, gameState: "roundEnd" });
  const { gameId, currentPlayer } = s;
  assert.isOk(gameId);
  s = okey.discardTile(s, currentPlayer, player(s, currentPlayer).hand[0]);
  s = {
    ...s,
    penalties: { [currentPlayer]: [20] },
    // an okey taken off a meld before opening, the table it'd go back to gone
    tookOkeys: [{ player: currentPlayer, meld: 0, tileId: "yellow3-0" }],
  };

  s = okey.redealRound(s);
  assert.equal(s.gameState, "roundEnd");
  assert.equal(s.message, "Round 3: dealt again");
  // back to before the deal: nothing on the table, every seat to sit in
  assert.equal(s.players.length, 4);
  assert.isTrue(
    s.players.every((p) => !p.hand.length && !p.discardPile.length),
  );
  assert.deepEqual(s.melds, []);
  assert.equal(okey.redealRound(s), "The round is over");

  s = okey.nextRound(s);
  assert.equal(s.round, 3);
  assert.equal(s.currentPlayer, currentPlayer); // from the same seat
  assert.equal(s.gameId, gameId);
  assert.deepEqual(s.scores, { 1: [10], 2: [30], 3: [-20] });
  assert.deepEqual(s.penalties, {});
  assert.deepEqual(s.tookOkeys, []);
  assertAllTiles(s);
});

test("a round isn't dealt to a table of one", () => {
  const s = okey.freeSeat(
    {
      ...okey.startGame(seated(2)),
      gameState: "roundEnd",
      round: 2,
      scores: { 1: [10, 5], 2: [30, 12] },
    },
    2,
  );
  assert.equal(okey.nextRound(s), "not enough players to start the game");
});

test("two-meld openings match in either order, okey included", () => {
  let s = okey.startGame(seated(2), deal);
  s = { ...s, round: 3 }; // 3'lü küt + 3'lü seri
  const withOkey = ["red7-0", "red8-0"];
  s = game.discardTile(s, 1, tileIn(s, 1, "yellow13-0"));
  s = game.drawTile(s, 2, s.drawPile.at(-1), 20);
  s = game.discardTile(s, 2, tileIn(s, 2, "red11-0"));
  const wild = s.drawPile.find((x) => x.id === "blue1-0");
  s = game.drawTile(s, 1, wild, 20);

  s = okey.openHand(s, 1, [[...withOkey, "blue1-0"], kut5]);
  assert.deepEqual(
    s.melds.map((m) => m.type),
    ["seri", "kut"],
  );
});

// three play until the pile runs out, nobody opening
function pileOut(rules) {
  let s = okey.startGame(seated(3), undefined, rules);
  while (s.gameState === "play") {
    const p = s.currentPlayer;
    if (!s.drawn) s = game.drawTile(s, p, s.drawPile.at(-1), 25);
    s = okey.discardTile(s, p, player(s, p).hand.find(Boolean));
  }
  return s;
}

test("the round ends with no finisher when the pile runs out", () => {
  let s = pileOut();
  assert.equal(s.gameState, "roundEnd");
  assert.equal(s.message, "Round 1: no tiles left");
  assert.deepEqual(turn(s), []); // nobody finished: nothing to show
  // scored as usual: nobody opened
  for (const p of s.players.filter((x) => x.user)) {
    assert.deepEqual(s.scores[p.id], [AMERICANO.notOpenedScore]);
  }
  // or the hands are counted
  s = pileOut({ ...AMERICANO, notOpenedHand: true });
  for (const p of s.players.filter((x) => x.user)) {
    const hand = p.hand.filter(Boolean);
    const expected = sum(
      hand.map((x) => (isOkey(x, s.okeyTile) ? 25 : rankOf(x, s.okeyTile))),
    );
    assert.deepEqual(s.scores[p.id], [expected]);
  }
  // or the round is dealt again, scoring the okeys held
  s = pileOut({ ...AMERICANO, pileOutCounts: false });
  assert.isTrue(s.replay);
  assert.equal(s.message, "Round 1: no tiles left, dealt again");
  for (const p of s.players.filter((x) => x.user)) {
    const okeys = p.hand.filter((x) => x && isOkey(x, s.okeyTile)).length;
    assert.deepEqual(s.scores[p.id], [25 * okeys]);
  }
});

test("the okey thrown as the last tile doubles everyone else's score", () => {
  const [p1Hand] = deal.hands;
  let s = okey.startGame(seated(2), {
    ...deal,
    hands: [p1Hand.map((x) => (x === "yellow11-0" ? "blue1-0" : x)), p2Hand],
  });
  s = okey.openHand(s, 1, [kut5]);
  s = okey.discardTile(s, 1, tileIn(s, 1, "yellow13-0"));
  s = game.drawTile(s, 2, s.drawPile.at(-1), 20);
  s = okey.discardTile(s, 2, tileIn(s, 2, "yellow5-0"));
  s = game.drawTile(s, 1, player(s, 2).discardPile.at(-1), 20);
  s = okey.addToMeld(s, 1, "yellow5-0", 0);
  s = okey.layMelds(s, 1, [seri789, seri234, kut10]);
  s = okey.addToMeld(s, 1, "red10-0", 1);
  s = okey.finishGame(s, 1, tileIn(s, 1, "blue1-0"));
  assert.deepEqual(s.scores, {
    1: [AMERICANO.finishScore],
    2: [AMERICANO.notOpenedScore * 2],
  });
  assert.equal(s.message, "P1 finished round 1 ×2");
  // and the finisher's too, if the rules say
  s = okey.startGame(
    seated(2),
    {
      ...deal,
      hands: [p1Hand.map((x) => (x === "yellow11-0" ? "blue1-0" : x)), p2Hand],
    },
    { ...AMERICANO, finishDoubled: true },
  );
  s = okey.openHand(s, 1, [kut5]);
  s = okey.discardTile(s, 1, tileIn(s, 1, "yellow13-0"));
  s = game.drawTile(s, 2, s.drawPile.at(-1), 20);
  s = okey.discardTile(s, 2, tileIn(s, 2, "yellow5-0"));
  s = game.drawTile(s, 1, player(s, 2).discardPile.at(-1), 20);
  s = okey.addToMeld(s, 1, "yellow5-0", 0);
  s = okey.layMelds(s, 1, [seri789, seri234, kut10]);
  s = okey.addToMeld(s, 1, "red10-0", 1);
  s = okey.finishGame(s, 1, tileIn(s, 1, "blue1-0"));
  assert.equal(s.scores[1][0], AMERICANO.finishScore * 2);
});

test("a ruleset can count the hand of a player who didn't open", () => {
  let s = okey.startGame(seated(2), deal, {
    ...AMERICANO,
    notOpenedHand: true,
  });
  s = okey.openHand(s, 1, [kut5]);
  s = okey.discardTile(s, 1, tileIn(s, 1, "yellow13-0"));
  s = game.drawTile(s, 2, s.drawPile.at(-1), 20);
  s = okey.discardTile(s, 2, tileIn(s, 2, "yellow5-0"));
  s = game.drawTile(s, 1, player(s, 2).discardPile.at(-1), 20);
  s = okey.addToMeld(s, 1, "yellow5-0", 0);
  s = okey.layMelds(s, 1, [seri789, seri234, kut10]);
  s = okey.addToMeld(s, 1, "red10-0", 1);
  s = okey.finishGame(s, 1, tileIn(s, 1, "yellow11-0"));
  const hand = player(s, 2).hand.filter(Boolean);
  const counted = sum(
    hand.map((x) => (isOkey(x, s.okeyTile) ? 25 : rankOf(x, s.okeyTile))),
  );
  assert.notEqual(counted, AMERICANO.notOpenedScore);
  assert.deepEqual(s.scores, { 1: [AMERICANO.finishScore], 2: [counted] });
});

test("Elden: no opening, finish from hand, lowest total wins the game", () => {
  const winningHand = [
    ...["red1-0", "red2-0", "red3-0", "red4-0", null],
    ...["blue5-0", "blue6-0", "blue7-0", null],
    ...["black9-0", "black10-0", "black11-0", "black12-0", null],
    ...["red8-0", "black8-0", "blue8-0", null],
  ];
  let s = okey.startGame(seated(2), {
    okeyTile: "blue13-1",
    hands: [[...winningHand, "yellow2-0"], p2Hand],
  });
  assert.equal(
    okey.finishGame(s, 1, tileIn(s, 1, "yellow2-0")),
    "Lay down your tiles, then throw the last one to the middle",
  );

  const elden = AMERICANO.rounds.length; // the last round
  s = {
    ...s,
    round: elden,
    scores: { 1: Array(elden - 1).fill(20), 2: Array(elden - 1).fill(0) },
  };
  assert.match(okey.openHand(s, 1, [kut5]), /No opening/);
  s = okey.finishGame(s, 1, tileIn(s, 1, "yellow2-0"));

  const p2Sum = sum(
    player(s, 2)
      .hand.filter(Boolean)
      .map((x) => x.rank),
  );
  assert.equal(s.gameState, "finish");
  assert.equal(s.scores[1][elden - 1], AMERICANO.finishScore);
  assert.equal(s.scores[2][elden - 1], p2Sum);
  assert.equal(s.message, `P2 wins with ${p2Sum}`); // P1 has 20 a round

  // thrown on the okey, the others' scores double
  s = okey.startGame(seated(2), {
    okeyTile: "blue13-1",
    hands: [[...winningHand, "blue1-0"], p2Hand],
  });
  s = okey.finishGame({ ...s, round: elden }, 1, tileIn(s, 1, "blue1-0"));
  assert.equal(s.scores[1][elden - 1], AMERICANO.finishScore);
  assert.equal(s.scores[2][elden - 1], p2Sum * 2);
});

test("the others' time to take a discard runs from the turn, not the draw", () => {
  let s = okey.startGame(seated(4));
  s = okey.discardTile(s, 1, player(s, 1).hand.find(Boolean));
  const turn = 1_000_000;
  const draw = (at) => okey.drawTile(s, 2, s.drawPile.at(-1), 25, at, turn);
  // drawn 5 s into the turn: 3 s left of the 8
  assert.equal(okey.claimWait(draw(turn + 5000), 2, turn + 5000), 3);
  // drawn after the others had their 8 s: no wait
  assert.equal(okey.claimWait(draw(turn + 9000), 2, turn + 9000), 0);
});

test("the others' time to take a discard before the next one", () => {
  let s = okey.startGame(seated(4));
  s = okey.discardTile(s, 1, player(s, 1).hand.find(Boolean));
  s = okey.drawTile(s, 2, s.drawPile.at(-1), 25);
  const soon = s.offer.at + 1000;
  assert.equal(okey.claimWait(s, 2, soon), 7);
  assert.equal(okey.claimWait(s, 2, afterWait(s)), 0);
  // a tile from my rack waits that long too
  const mine = player(s, 2).hand.find(Boolean);
  assert.equal(okey.waitBefore(s, 2, mine, soon), 7);
  // nobody else could take it
  assert.equal(okey.claimWait({ ...s, takes: { 3: 3, 4: 3 } }, 2, soon), 0);
  // a last tile goes at once
  const players = s.players.map((p) =>
    p.id === 2 ? { ...p, hand: [p.hand.find(Boolean)] } : p,
  );
  assert.equal(okey.claimWait({ ...s, players }, 2, soon), 0);
});

test("the turn's ring fills in the others' time to take the discard, or at once", () => {
  let s = okey.startGame(seated(4));
  // the starter throws without drawing: nothing on offer
  assert.equal(okey.discardWait(s), 0);
  s = okey.discardTile(s, 1, player(s, 1).hand.find(Boolean));
  // the ruleset's seconds, before the draw and after one from the pile
  assert.equal(okey.discardWait(s), AMERICANO.claimWaitSeconds);
  const rules = { ...s.rules, claimWaitSeconds: 5 };
  assert.equal(okey.discardWait({ ...s, rules }), 5);
  const drawn = okey.drawTile(s, 2, s.drawPile.at(-1), 25);
  assert.equal(okey.discardWait(drawn), AMERICANO.claimWaitSeconds);
  // the discard taken: nothing left on offer
  const top = player(s, 1).discardPile.at(-1);
  assert.equal(okey.discardWait(okey.drawTile(s, 2, top, 25)), 0);
  // nobody else could take it, or a game without out-of-turn takes
  assert.equal(okey.discardWait({ ...s, takes: { 3: 3, 4: 3 } }), 0);
  const off = { ...s.rules, outOfTurnTakes: false };
  assert.equal(okey.discardWait({ ...s, rules: off }), 0);
});

test("the next player takes the discard once the others had time to catch it", () => {
  let s = okey.startGame(seated(4));
  s = okey.discardTile(s, 1, player(s, 1).hand.find(Boolean));
  const turn = 1_000_000;
  const wait = (s, ...args) => okey.catchWait(s, 2, ...args);
  // nothing on the table it could be caught for
  assert.equal(wait(s, false, turn, turn), 0);
  s = { ...s, melds: [{ type: "kut", owner: 3, tiles: [] }] };
  // a tile that didn't fit a meld when it was thrown goes at once
  assert.equal(wait({ ...s, discardFits: false }, false, turn, turn), 0);
  s = { ...s, discardFits: true };
  // the ruleset's seconds, from the turn reaching them
  assert.equal(wait(s, false, turn, turn), AMERICANO.catchWaitSeconds);
  assert.equal(wait(s, false, turn + 500, turn), 1.5);
  assert.equal(wait(s, false, turn + 2000, turn), 0);
  const five = { ...s.rules, catchWaitSeconds: 5 };
  assert.equal(wait({ ...s, rules: five }, false, turn, turn), 5);
  // a draw from the pile leaves it to catch, unless that ends the catching
  assert.equal(wait(s, true, turn, turn), 0);
  const until = { ...s.rules, catchUntilDraw: true };
  assert.equal(wait({ ...s, rules: until }, true, turn, turn), 2);
  // and so does any tile drawn, by where it's drawn from
  const [top, pile] = [player(s, 1).discardPile.at(-1), s.drawPile.at(-1)];
  assert.equal(okey.waitBefore(s, 2, top, turn, turn), 2);
  assert.equal(okey.waitBefore(s, 2, pile, turn, turn), 0);
  // not someone else's turn; nor caught already, nor only bots to catch it
  assert.equal(okey.catchWait(s, 3, false, turn, turn), 0);
  const as = (ids, change) => ({
    ...s,
    players: s.players.map((p) => (ids.includes(p.id) ? change(p) : p)),
  });
  const caught = as([3], (p) => ({ ...p, caught: [s.lastDiscard] }));
  assert.equal(wait(caught, false, turn, turn), 0);
  const bots = as([3, 4], (p) => ({ ...p, user: { ...p.user, bot: true } }));
  assert.equal(wait(bots, false, turn, turn), 0);
});

test("out of turn: earliest claimant after the current player gets the discard + 1", () => {
  let s = okey.startGame(seated(4));
  const thrown = player(s, 1).hand.find(Boolean);
  s = okey.discardTile(s, 1, thrown);
  // P3 asks before P2 has even drawn: the claim waits for the offer,
  // hidden from P2 until they've drawn
  s = okey.claimDiscard(s, 3, 25);
  assert.isOk(player(s, 3).claim);
  assert.isEmpty(okey.claimants(s));

  s = okey.drawTile(s, 2, s.drawPile.at(-1), 25); // P2 passes on it
  assert.equal(okey.claimDiscard(s, 1, 25), "That's your own tile");
  assert.equal(okey.claimDiscard(s, 2, 25), "You already drew this turn");
  assert.deepEqual(ids(okey.claimants(s)), [3]);
  s = okey.claimDiscard(s, 4, 25);
  const pile = s.drawPile.length;
  const tile = player(s, 2).hand.find(Boolean);
  assert.equal(
    okey.discardTile(s, 2, tile, s.offer.at + 1000),
    "Give the others 7s to take the discard",
  );
  s = okey.discardTile(s, 2, tile, afterWait(s));

  assert.equal(player(s, 3).inbox[0].id, thrown.id); // P3 comes before P4
  assert.equal(player(s, 3).inbox.length, 2);
  assert.deepEqual(s.takes, { 3: 1 });
  assert.isEmpty(player(s, 4).inbox ?? []);
  assert.equal(player(s, 1).discardPile.length, 0);
  assert.equal(s.drawPile.length, pile - 1);
  assertAllTiles(s);

  const before = player(s, 3).hand.filter(Boolean).length;
  s = okey.collectInbox(s, 3);
  assert.equal(player(s, 3).hand.filter(Boolean).length, before + 2);
  assert.isEmpty(player(s, 3).inbox);
  assertAllTiles(s);
});

test("a claim made before the draw lapses if the current player takes the tile", () => {
  let s = okey.startGame(seated(3));
  const thrown = player(s, 1).hand.find(Boolean);
  s = okey.discardTile(s, 1, thrown);
  s = okey.claimDiscard(s, 3, 25);
  s = okey.drawTile(s, 2, player(s, 1).discardPile.at(-1), 25);
  assert.isOk(tileIn(s, 2, thrown.id));
  assert.isEmpty(okey.claimants(s));
  s = okey.discardTile(s, 2, player(s, 2).hand.find(Boolean));
  assert.isEmpty(player(s, 3).inbox);
  assertAllTiles(s);
});

test("a claimant who left the table before the discard doesn't get it", () => {
  let s = okey.startGame(seated(4));
  s = okey.discardTile(s, 1, player(s, 1).hand.find(Boolean));
  s = okey.drawTile(s, 2, s.drawPile.at(-1), 25);
  s = okey.claimDiscard(s, 3, 25);
  s = okey.claimDiscard(s, 4, 25);
  assert.deepEqual(
    okey.claimants(s).map((p) => p.id),
    [3, 4],
  );
  s = {
    ...s,
    players: s.players.map((p) => (p.id === 3 ? { ...p, user: null } : p)),
  };
  s = okey.discardTile(s, 2, player(s, 2).hand.find(Boolean), afterWait(s));
  assert.isEmpty(player(s, 3).inbox ?? []);
  assert.equal(player(s, 4).inbox.length, 2);
});

test("at most 3 out-of-turn takes per player per round", () => {
  let s = okey.startGame(seated(3));
  s = okey.discardTile(s, 1, player(s, 1).hand.find(Boolean));
  s = okey.drawTile(s, 2, s.drawPile.at(-1), 25);
  s = { ...s, takes: { 3: AMERICANO.maxTakes } };
  assert.equal(okey.claimDiscard(s, 3, 25), "You can take 3 a round");
});

test("the player whose turn it is takes the discard first, closing the offer", () => {
  let s = okey.startGame(seated(3));
  s = okey.discardTile(s, 1, player(s, 1).hand.find(Boolean));
  s = okey.drawTile(s, 2, player(s, 1).discardPile.at(-1), 25);
  assert.equal(okey.claimDiscard(s, 3, 25), "Nothing to take right now");
});

test("from round 6, a real tile swaps out a table okey, which can open the same turn", () => {
  // okey is blue1 (both copies); P1 already has two melds with an okey each
  const kutWithOkey = ["red5-1", "blue5-1", "yellow5-0", "blue1-0"];
  const seriWithOkey = ["red3-1", "blue1-1", "red5-0"];
  const filler = ["yellow2-0", "yellow4-0", "yellow6-0", "yellow8-0"];
  let s = okey.startGame(seated(2), {
    okeyTile: "blue13-1",
    hands: [
      [
        ...filler,
        "black2-0",
        "black6-0",
        "black8-0",
        "black12-0",
        "red12-0",
      ].concat([
        "blue12-0",
        "blue7-0",
        "red8-0",
        "red10-0",
        "blue3-0",
        "black3-0",
      ]),
      [...["red9-0", "blue9-0", "black9-0", "black5-0", "red4-0"]]
        .concat(["yellow12-0", "yellow13-0", "red13-0", "black13-0", "blue6-0"])
        .concat(["blue10-0", "blue11-0", "black7-0", "red2-0"]),
    ],
  });
  const table = (ids) =>
    ids.map((id) => ({
      ...game.tiles.find((x) => x.id === id),
      source: "table",
      hidden: false,
    }));
  const onTable = [...kutWithOkey, ...seriWithOkey];
  s = {
    ...s,
    drawPile: s.drawPile.filter((x) => !onTable.includes(x.id)),
    melds: [
      { type: "kut", owner: 1, tiles: table(kutWithOkey) },
      { type: "seri", owner: 1, tiles: table(seriWithOkey) },
    ],
  };
  s = okey.discardTile(s, 1, tileIn(s, 1, "yellow2-0"));
  s = game.drawTile(s, 2, s.drawPile.at(-1), 20);

  assert.match(
    okey.swapOkey({ ...s, round: 5 }, 2, "black5-0", 0),
    /from round 6/,
  );
  s = { ...s, round: 6 }; // 4'lü küt
  const threeKut = {
    type: "kut",
    owner: 1,
    tiles: table(["red5-1", "blue5-1", "blue1-0"]),
  };
  assert.match(
    okey.playOnMeld({ ...s, melds: [threeKut] }, 2, "black5-0", 0),
    /all four/,
  );
  s = okey.playOnMeld(s, 2, "black5-0", 0);
  assert.deepEqual(ids(s.melds[0].tiles).sort(), [
    "black5-0",
    "blue5-1",
    "red5-1",
    "yellow5-0",
  ]);
  assert.isOk(tileIn(s, 2, "blue1-0"));

  s = okey.openHand(s, 2, [["red9-0", "blue9-0", "black9-0", "blue1-0"]]);
  assert.isTrue(s.opened[2]);

  // red4 could also be added to 3-okey-5, but dropping it swaps the okey out
  s = okey.playOnMeld(s, 2, "red4-0", 1);
  assert.deepEqual(ids(s.melds[1].tiles), ["red3-1", "red4-0", "red5-0"]);
  assert.isOk(tileIn(s, 2, "blue1-1"));
  assertAllTiles(s);
});

// okey is blue1, standing for the yellow 3 in yellow 1-2-okey-4 on the
// table; it's P2's turn and they've drawn (the top of the pile, or `draw`)
function okeyOnTable(round, draw) {
  const seri = ["yellow1-0", "yellow2-0", "blue1-0", "yellow4-0"];
  let s = okey.startGame(seated(2), {
    okeyTile: "blue13-1",
    hands: [
      [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        .map((r) => `red${r}-0`)
        .concat(["black2-0", "black3-0", "black4-0", "black5-0"]),
      ["yellow3-0", "yellow5-0", "black7-0", "black8-0", "black9-0"].concat(
        [2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => `red${r}-1`),
      ),
    ],
  });
  const onTable = seri.map((id) => ({
    ...game.tiles.find((x) => x.id === id),
    source: "table",
    hidden: false,
  }));
  s = {
    ...s,
    round,
    drawPile: s.drawPile.filter((x) => !seri.includes(x.id)),
    melds: [{ type: "seri", owner: 1, tiles: onTable }],
  };
  s = okey.discardTile(s, 1, tileIn(s, 1, "black5-0"));
  const tile = s.drawPile.find((x) => x.id === draw) ?? s.drawPile.at(-1);
  return [game.drawTile(s, 2, tile, 20), seri];
}

test("a table okey keeps its place: only the tile it stands for takes it", () => {
  let [s] = okeyOnTable(3);
  // before opening, round 3: the yellow 3 can't take it, nor push it to 5
  assert.match(okey.playOnMeld(s, 2, "yellow3-0", 0), /from round 6/);

  s = { ...s, opened: { 2: true } };
  s = okey.playOnMeld(s, 2, "yellow5-0", 0);
  assert.deepEqual(ids(s.melds[0].tiles), [
    ...["yellow1-0", "yellow2-0", "blue1-0", "yellow4-0", "yellow5-0"],
  ]);
  // opened: any round, the yellow 3 takes the okey
  s = okey.playOnMeld(s, 2, "yellow3-0", 0);
  assert.deepEqual(ids(s.melds[0].tiles), [
    ...["yellow1-0", "yellow2-0", "yellow3-0", "yellow4-0", "yellow5-0"],
  ]);
  assert.isOk(tileIn(s, 2, "blue1-0"));
  assertAllTiles(s);
});

// a tile as it lies on the table or a pile
const lying = (id, source) => ({
  ...game.tiles.find((x) => x.id === id),
  source,
  hidden: false,
});
// the okey is blue1; on the table, one seri `meld`
function seriOnTable(meld) {
  const [s] = okeyOnTable(3);
  const tiles = meld.map((id) => lying(id, "table"));
  return { ...s, melds: [{ type: "seri", owner: 1, tiles }] };
}

test("a catch counts what could go on the table as it lies", () => {
  // P1 has just thrown `id`; P2 tries to catch it
  const catchOf = (meld, id) => {
    const s = seriOnTable(meld);
    const players = s.players.map((p) =>
      p.id === 1 ? { ...p, discardPile: [lying(id, "discard-1")] } : p,
    );
    // thrown by hand: judged by the table as it lies, as a game from before
    // that kept no record of it at the throw
    const thrown = { ...s, players, lastDiscard: id, discardFits: undefined };
    const next = okey.catchDiscard(thrown, 2);
    return typeof next === "string" ? next : player(next, 2).caught;
  };
  const no = "That tile didn't fit a meld when it was thrown";
  const sixTo9 = ["black6-1", "black7-1", "black8-1", "blue1-1"];
  // the 4 fits only with the okey moved from the 9 to the 5
  assert.equal(catchOf(sixTo9, "black4-1"), no);
  assert.deepEqual(catchOf(sixTo9, "black5-1"), ["black5-1"]);
  assert.deepEqual(catchOf(sixTo9, "black10-1"), ["black10-1"]);
  // the tile the okey stands for could take its place
  assert.deepEqual(catchOf(sixTo9, "black9-1"), ["black9-1"]);

  // a 1 after 13 doesn't count (a game started when Americano allowed it)
  assert.equal(
    catchOf(["black11-1", "black12-1", "black13-1"], "black1-1"),
    no,
  );
  assert.equal(catchOf(["black12-1", "black13-1", "blue1-1"], "black1-1"), no);
  assert.deepEqual(catchOf(["black2-1", "black3-1", "black4-1"], "black1-1"), [
    "black1-1",
  ]);
});

test("Americano runs stop at 13: no 12-13-1, to open or to add", () => {
  const black = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((r) => `black${r}-0`);
  let s = okey.startGame(seated(2), {
    okeyTile: "blue13-1",
    hands: [
      ["red11-0", "red12-0", "red13-0", "red1-0", ...black],
      [...Array.from({ length: 13 }, (_, i) => `yellow${i + 1}-0`), "blue2-0"],
    ],
  });
  s = { ...s, round: 2 }; // 3'lü seri
  assert.isString(okey.openHand(s, 1, [["red12-0", "red13-0", "red1-0"]]));
  s = okey.openHand(s, 1, [["red11-0", "red12-0", "red13-0"]]);
  assert.deepEqual(ids(s.melds[0].tiles), ["red11-0", "red12-0", "red13-0"]);

  let t = seriOnTable(["black11-1", "black12-1", "black13-1"]);
  t = {
    ...t,
    opened: { 2: true },
    players: t.players.map((p) =>
      p.id === 2
        ? { ...p, hand: [lying("black1-1", "hand-2"), ...p.hand.slice(1)] }
        : p,
    ),
  };
  assert.isString(okey.playOnMeld(t, 2, "black1-1", 0));
});

test("a tile goes on either end of a seri with a table okey in it", () => {
  let s = seriOnTable(["black6-1", "black7-1", "black8-1", "blue1-1"]);
  s = {
    ...s,
    opened: { 2: true },
    players: s.players.map((p) =>
      p.id === 2
        ? { ...p, hand: [lying("black5-1", "hand-2"), ...p.hand.slice(1)] }
        : p,
    ),
  };
  s = okey.playOnMeld(s, 2, "black5-1", 0);
  assert.deepEqual(ids(s.melds[0].tiles), [
    ...["black5-1", "black6-1", "black7-1", "black8-1", "blue1-1"],
  ]);
});

test("an okey added to a seri goes on the end it's dropped on, if it fits there", () => {
  // P2 has opened and holds the other okey, blue1-1
  const addOkey = (meld, atEnd) => {
    let s = seriOnTable(meld);
    s = {
      ...s,
      opened: { 2: true },
      players: s.players.map((p) =>
        p.id === 2
          ? { ...p, hand: [lying("blue1-1", "hand-2"), ...p.hand.slice(1)] }
          : p,
      ),
    };
    s = okey.playOnMeld(s, 2, "blue1-1", 0, atEnd);
    const i = s.melds[0].tiles.findIndex((x) => x.id === "blue1-1");
    return okeyStandsFor(s.melds[0], i, s.okeyTile).rank;
  };
  const sixTo8 = ["black6-1", "black7-1", "black8-1"];
  assert.equal(addOkey(sixTo8, false), 5);
  assert.equal(addOkey(sixTo8, true), 9);
  // no 14: the low end is all that's left
  assert.equal(addOkey(["black11-1", "black12-1", "black13-1"], true), 10);
});

test("opening with 4-5-okey off the rack lays the okey as the 6", () => {
  let [s] = okeyOnTable(2); // 3'lü seri
  s = { ...s, melds: [] };
  // P2 gets the other okey, blue1-1, unless they just drew it
  const wild = s.drawPile.find((x) => x.id === "blue1-1");
  if (wild) {
    s = game.drawTile(
      { ...s, drawn: false },
      2,
      wild,
      player(s, 2).hand.indexOf(null),
    );
  }
  // picked in rack order: red4, red5, okey
  s = okey.openHand(s, 2, [["red4-1", "red5-1", "blue1-1"]]);
  assert.deepEqual(ids(s.melds[0].tiles), ["red4-1", "red5-1", "blue1-1"]);
  assert.equal(okeyStandsFor(s.melds[0], 2, s.okeyTile).rank, 6);
});

test("an okey taken before opening (round 6+) means opening that turn, or putting it back", () => {
  let [s, seri] = okeyOnTable(6);
  s = okey.playOnMeld(s, 2, "yellow3-0", 0);
  assert.isOk(tileIn(s, 2, "blue1-0"));
  assert.deepInclude(turn(s), [2, "swapped", "yellow3-0"]);
  assert.match(
    okey.discardTile(s, 2, tileIn(s, 2, "black7-0")),
    /open your hand, or put the okey back/,
  );
  s = okey.playOnMeld(s, 2, "blue1-0", 0);
  assert.deepEqual(ids(s.melds[0].tiles), seri);
  assert.isOk(tileIn(s, 2, "yellow3-0"));
  assert.notDeepInclude(turn(s), [2, "swapped", "yellow3-0"]); // taken back
  s = okey.discardTile(s, 2, tileIn(s, 2, "black7-0"));
  assert.equal(s.currentPlayer, 1);
  assertAllTiles(s);
});

test("two okeys taken before opening both go back before the discard", () => {
  let [s, seri] = okeyOnTable(6, "black10-1");
  // the other okey, standing for the yellow 5 in yellow 4-okey-6
  const seri2 = ["yellow4-1", "blue1-1", "yellow6-0"];
  s = {
    ...s,
    drawPile: s.drawPile.filter((x) => !seri2.includes(x.id)),
    melds: [
      ...s.melds,
      { type: "seri", owner: 1, tiles: seri2.map((id) => lying(id, "table")) },
    ],
  };
  s = okey.playOnMeld(s, 2, "yellow3-0", 0);
  s = okey.playOnMeld(s, 2, "yellow5-0", 1);
  assert.isOk(tileIn(s, 2, "blue1-0"));
  assert.isOk(tileIn(s, 2, "blue1-1"));
  // one back isn't enough
  s = okey.playOnMeld(s, 2, "blue1-1", 1);
  assert.deepEqual(ids(s.melds[1].tiles), seri2);
  assert.match(
    okey.discardTile(s, 2, tileIn(s, 2, "black7-0")),
    /open your hand, or put the okey back/,
  );
  s = okey.playOnMeld(s, 2, "blue1-0", 0);
  assert.deepEqual(ids(s.melds[0].tiles), seri);
  assert.deepEqual(turn(s), []);
  s = okey.discardTile(s, 2, tileIn(s, 2, "black7-0"));
  assert.equal(s.currentPlayer, 1);
  assertAllTiles(s);
});

test("a game can be set up at any round, with totals and a starter", () => {
  const s = okey.setUp(seated(3), 7, { 1: 115, 2: "74", 3: 58 }, 3);
  assert.equal(s.round, 7);
  assert.equal(s.gameState, "play");
  assert.equal(s.currentPlayer, 3);
  assert.equal(player(s, 3).hand.filter(Boolean).length, 15);
  assert.deepEqual(
    s.players.map((p) => sum(s.scores[p.id])),
    [115, 74, 58],
  );
  assert.equal(s.scores[1][5], 115); // the row before round 7
  assertAllTiles(s);
  assert.match(okey.setUp(seated(1), 3, {}, 1), /not enough players/);
});

test("nobody waits when no one else could take the discard", () => {
  let s = okey.startGame(seated(2));
  s = okey.discardTile(s, 1, player(s, 1).hand.find(Boolean));
  s = okey.drawTile(s, 2, s.drawPile.at(-1), 25, 1000);
  s = okey.discardTile(s, 2, player(s, 2).hand.find(Boolean), 1000);
  assert.equal(s.currentPlayer, 1);
});

test("a discard that fits a table meld can be caught: +20, and nobody takes it", () => {
  let s = okey.startGame(seated(3), deal);
  s = okey.openHand(s, 1, [kut10]);
  s = okey.discardTile(s, 1, tileIn(s, 1, "red10-0")); // fits küt 10
  assert.equal(okey.catchDiscard(s, 1), "That's your own tile");

  s = okey.catchDiscard(s, 3);
  assert.deepEqual(player(s, 3).caught, ["red10-0"]);
  assert.equal(okey.catchDiscard(s, 2), "Already caught");
  const caughtTile = player(s, 1).discardPile.at(-1);
  assert.equal(okey.drawTile(s, 2, caughtTile, 25), "That tile was caught");
  s = okey.drawTile(s, 2, s.drawPile.at(-1), 25);
  assert.isNull(s.offer);

  s = okey.discardTile(s, 2, tileIn(s, 2, "red11-0"));
  assert.equal(
    okey.catchDiscard(s, 3),
    "That tile didn't fit a meld when it was thrown",
  );

  while (s.gameState === "play") {
    const p = s.currentPlayer;
    if (!s.drawn) s = okey.drawTile(s, p, s.drawPile.at(-1), 25);
    s = okey.discardTile(s, p, player(s, p).hand.find(Boolean), Infinity);
  }
  const hand = player(s, 1).hand.filter(Boolean);
  const inHand = sum(
    hand.map((x) => (isOkey(x, s.okeyTile) ? 25 : rankOf(x, s.okeyTile))),
  );
  assert.equal(s.scores[1][0], inHand + AMERICANO.catchPenalty);
});

test("a claim waits in the slot it was dropped on, and can be taken back", () => {
  let s = okey.startGame(seated(3));
  s = okey.discardTile(s, 1, player(s, 1).hand.find(Boolean));
  const offered = player(s, 1).discardPile.at(-1);
  assert.equal(s.lastDiscard, offered.id);
  s = okey.drawTile(s, 2, s.drawPile.at(-1), 25);

  s = okey.claimDiscard(s, 3, 20);
  assert.deepEqual(player(s, 3).claim, { id: s.offer.id, slot: 20 });
  s = okey.claimDiscard(s, 3, null);
  assert.isEmpty(okey.claimants(s));

  s = okey.claimDiscard(s, 3, 22);
  s = okey.discardTile(s, 2, player(s, 2).hand.find(Boolean), afterWait(s));
  s = okey.collectInbox(s, 3);
  assert.equal(player(s, 3).hand[22].id, offered.id);
  assertAllTiles(s);
});

test("El aç with nothing picked: the round's melds out of the whole rack, okeys last", () => {
  const hand = ["blue1-0", ...deal.hands[0].slice(0, -1)];
  let s = okey.startGame(seated(2), { ...deal, hands: [hand, p2Hand] });
  s = okey.openAll(s, 1);
  assert.deepEqual(
    s.melds.map((m) => ids(m.tiles)),
    [kut5],
  );
  assert.isOk(tileIn(s, 1, "blue1-0"));
  // pairs are opened with only when picked
  const round = AMERICANO.rounds.findIndex((r) => r.name === "4 çift") + 1;
  s = { ...okey.startGame(seated(2), deal), round };
  assert.equal(okey.openAll(s, 1), "Pick the pairs to open with");
  // but only once it's your turn and you've drawn
  assert.equal(okey.openAll(s, 2), "Not your turn");
  s = okey.discardTile(s, 1, tileIn(s, 1, "yellow13-0"));
  assert.equal(okey.openAll(s, 2), "Draw a tile first");
});

test("El aç's first press picks the round's melds it finds", () => {
  const s = okey.startGame(seated(2), deal);
  assert.sameMembers(okey.meldsToLay(s, 1), kut5);
});

test("4 çift: open with four pairs, then lay pairs, sets and runs", () => {
  const round = AMERICANO.rounds.findIndex((r) => r.name === "4 çift") + 1;
  assert.equal(round, AMERICANO.rounds.length - 1); // just before Elden
  const pairs = [
    ...["red5-0", "red5-1", "black9-0", "black9-1"],
    ...["yellow2-0", "yellow2-1", "red6-0", "red6-1"],
  ];
  const kut4 = ["red4-0", "black4-0", "yellow4-0"];
  const pair7 = ["black7-0", "black7-1"];
  let s = okey.startGame(seated(2), {
    okeyTile: "blue13-1",
    hands: [[...pairs, ...kut4, ...pair7, "yellow10-0", "red1-0"], p2Hand],
  });
  s = { ...s, round };
  assert.match(okey.openHand(s, 1, [kut4]), /Open with exactly: 4 çift/);
  assert.match(okey.openHand(s, 1, [pairs.slice(0, 6)]), /Open with exactly/);
  s = okey.openHand(s, 1, [[...pairs, "yellow10-0"]]);
  assert.deepEqual(
    s.melds.map((m) => m.type),
    ["pair", "pair", "pair", "pair"],
  );
  assert.isOk(tileIn(s, 1, "yellow10-0"));
  assert.isNotOk(s.openedWithPairs?.[1]); // nothing doubles in Americano
  // from the next turn, a pair and a küt in one go
  s = okey.layMelds({ ...s, justOpened: null }, 1, [[...pair7, ...kut4]]);
  assert.deepEqual(
    s.melds.slice(4).map((m) => [m.type, ids(m.tiles)]),
    [
      ["pair", pair7],
      ["kut", kut4],
    ],
  );
  assertAllTiles(s);
});

test("picked tiles that open do, the others stay on the rack", () => {
  let s = okey.startGame(seated(2), deal); // round 1: 3'lü küt
  s = okey.openHand(s, 1, [[...kut5, "red10-0"]]);
  assert.deepEqual(
    s.melds.map((m) => ids(m.tiles)),
    [kut5],
  );
  assert.isOk(tileIn(s, 1, "red10-0"));
  assertAllTiles(s);

  // round 3, 3'lü küt + 3'lü seri, out of eight picked tiles
  s = { ...okey.startGame(seated(2), deal), round: 3 };
  s = okey.openHand(s, 1, [[...seri789, "yellow13-0", ...kut5, "red10-0"]]);
  assert.deepEqual(
    s.melds.map((m) => ids(m.tiles)),
    [seri789, kut5],
  );
  assert.isOk(tileIn(s, 1, "yellow13-0"));
  assert.isOk(tileIn(s, 1, "red10-0"));
  // still not enough without them
  s = { ...okey.startGame(seated(2), deal), round: 3 };
  assert.match(
    okey.openHand(s, 1, [[...seri789, "yellow13-0", "red10-0"]]),
    /Open with exactly/,
  );
});

test("picked tiles open and lay down wherever they sit on the rack", () => {
  let s = okey.startGame(seated(2), deal);
  s = { ...s, round: 3 }; // 3'lü küt + 3'lü seri, picked mixed together
  const mixed = ["red7-0", "blue5-0", "red9-0", "red5-0", "red8-0", "black5-0"];
  assert.match(
    okey.openHand(s, 1, [[...mixed.slice(0, 5), "yellow13-0"]]),
    /Open with exactly/,
  );
  s = okey.openHand(s, 1, [mixed]);
  assert.deepEqual(
    s.melds.map((m) => [m.type, ids(m.tiles)]),
    [
      ["seri", ["red7-0", "red8-0", "red9-0"]],
      ["kut", ["blue5-0", "red5-0", "black5-0"]],
    ],
  );

  // next turn: two melds picked in one go
  s = okey.discardTile(s, 1, tileIn(s, 1, "yellow13-0"));
  s = game.drawTile(s, 2, s.drawPile.at(-1), 20);
  s = game.discardTile(s, 2, tileIn(s, 2, "red11-0"));
  s = game.drawTile(s, 1, s.drawPile.at(-1), 20);
  s = okey.layMelds(s, 1, [
    ["black3-0", "blue10-0", "black2-0", "yellow10-0", "black4-0", "black10-0"],
  ]);
  assert.deepEqual(
    s.melds.slice(2).map((m) => m.type),
    ["seri", "kut"],
  );
});

test("a discard that fits only melds laid after it can't be caught", () => {
  const swap = (hand, from, to) => hand.map((x) => (x === from ? to : x));
  const kut7 = ["red7-1", "blue7-1", "black7-1"];
  let s = okey.startGame(seated(3), {
    ...deal,
    hands: [
      swap(deal.hands[0], "yellow11-0", "yellow7-1"),
      p2Hand.map(
        (x) =>
          ({ "blue6-0": kut7[0], "blue7-0": kut7[1], "blue8-0": kut7[2] })[x] ??
          x,
      ),
    ],
  });
  s = okey.discardTile(s, 1, tileIn(s, 1, "yellow7-1"));
  s = okey.drawTile(s, 2, s.drawPile.at(-1), 25);
  s = okey.openHand(s, 2, [kut7]); // yellow 7 fits it now
  assert.equal(
    okey.catchDiscard(s, 3),
    "That tile didn't fit a meld when it was thrown",
  );
});

test("catching the tile on offer drops the claims on it", () => {
  let s = okey.startGame(seated(3), deal);
  s = okey.openHand(s, 1, [kut10]);
  s = okey.discardTile(s, 1, tileIn(s, 1, "red10-0")); // fits küt 10
  s = okey.drawTile(s, 2, s.drawPile.at(-1), 25);
  s = okey.claimDiscard(s, 3, 25);
  assert.lengthOf(okey.claimants(s), 1);
  s = okey.catchDiscard(s, 2);
  assert.isEmpty(okey.claimants(s));
});
