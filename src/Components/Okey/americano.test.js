import { assert, test } from "vitest";
import { sum } from "lodash";
import * as americano from "./americano";
import * as game from "./game";
import { isOkey, meldOrder, okeyStandsFor, rankOf } from "./melds";
import { createTile } from "./utils";
import { AMERICANO } from "./rulesets";

const indicator = createTile("blue", 13, 1); // okey is blue1, fake okey = blue1
const t = (color, rank, i = 0) => createTile(color, rank, i);
const ids = (tiles) => tiles && tiles.map((x) => x.id);

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

function assertAllTiles(s) {
  const all = [
    ...s.drawPile,
    s.okeyTile,
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

test("round 1: open exactly, lay and add later, finish by discarding the last tile", () => {
  let s = americano.startGame(seated(2), deal);
  assert.equal(s.round, 1);
  assert.equal(s.currentPlayer, 1);
  assertAllTiles(s);

  assert.equal(
    americano.openHand(s, 1, [seri234]),
    "Open with exactly: 3'lü küt",
  );
  s = americano.openHand(s, 1, [kut5]);
  assert.isTrue(s.opened[1]);
  assert.equal(s.melds.length, 1);
  assert.equal(
    americano.layMelds(s, 1, [seri789]),
    "You can lay more from next turn",
  );
  s = americano.discardTile(s, 1, tileIn(s, 1, "yellow13-0"));

  assert.equal(americano.layMelds(s, 2, [["blue2-0"]]), "Open your hand first");
  s = game.drawTile(s, 2, s.drawPile.at(-1), 20);
  s = americano.discardTile(s, 2, tileIn(s, 2, "yellow5-0"));

  s = game.drawTile(s, 1, player(s, 2).discardPile.at(-1), 20);
  s = americano.addToMeld(s, 1, "yellow5-0", 0);
  assert.equal(s.melds[0].tiles.length, 4);
  assert.equal(
    americano.addToMeld(s, 1, "red10-0", 0),
    "That tile doesn't fit there",
  );
  s = americano.layMelds(s, 1, [seri789, seri234, kut10]);
  s = americano.addToMeld(s, 1, "red10-0", 1);
  assert.deepEqual(ids(s.melds[1].tiles), [...seri789, "red10-0"]);
  assert.equal(
    americano.layMelds(s, 1, [["yellow11-0"]]),
    "Keep a tile to discard",
  );
  assertAllTiles(s);

  s = americano.discardTile(s, 1, tileIn(s, 1, "yellow11-0"));
  assert.equal(s.gameState, "roundEnd");
  assert.deepEqual(s.scores, {
    1: [AMERICANO.finishScore],
    2: [AMERICANO.notOpenedScore],
  });

  assert.equal(s.players.length, 4); // free seats to sit in

  s = americano.nextRound(s);
  assert.equal(s.round, 2);
  assert.equal(s.gameState, "play");
  assert.equal(s.players.length, 2);
  assert.equal(s.currentPlayer, 2); // the starter rotates
  assert.deepEqual(s.melds, []);
  assert.deepEqual(s.opened, {});
  assert.deepEqual(s.takes, {});
  assertAllTiles(s);
});

test("between rounds seats can be freed and taken", () => {
  const sit = (s, id, name) => ({
    ...s,
    players: s.players.map((p) =>
      p.id === id ? { ...p, user: name && { id: name, name }, userKey: id } : p,
    ),
  });
  let s = {
    ...americano.startGame(seated(3)),
    gameState: "roundEnd",
    round: 2,
    scores: { 1: [10, 5], 2: [30, 12], 3: [-20, 40] },
  };
  s = { ...s, players: game.allSeats(s.players) };
  s = sit(s, 3, null); // P3's phone slept
  s = sit(s, 4, "Deniz");
  // P2 was freed from the menu
  s = sit(s, 2, null);
  s.players = s.players.map((p) => (p.id === 2 ? { ...p, left: true } : p));

  s = americano.nextRound(s);
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
  while (s.gameState === "play") {
    const p = s.currentPlayer;
    if (!s.drawn) s = game.drawTile(s, p, s.drawPile.at(-1), 25);
    s = americano.discardTile(s, p, player(s, p).hand.find(Boolean));
  }
  assert.equal(s.scores[3].length, 3);
});

test("a round isn't dealt to a table of one", () => {
  const s = {
    ...americano.startGame(seated(2)),
    gameState: "roundEnd",
    round: 2,
    scores: { 1: [10, 5], 2: [30, 12] },
  };
  // P2 was freed from the menu
  s.players = s.players.map((p) =>
    p.id === 2 ? { ...p, user: null, left: true } : p,
  );
  assert.equal(americano.nextRound(s), "not enough players to start the game");
});

test("two-meld openings match in either order, okey included", () => {
  let s = americano.startGame(seated(2), deal);
  s = { ...s, round: 3 }; // 3'lü küt + 3'lü seri
  const withOkey = ["red7-0", "red8-0"];
  s = game.discardTile(s, 1, tileIn(s, 1, "yellow13-0"));
  s = game.drawTile(s, 2, s.drawPile.at(-1), 20);
  s = game.discardTile(s, 2, tileIn(s, 2, "red11-0"));
  const okey = s.drawPile.find((x) => x.id === "blue1-0");
  s = game.drawTile(s, 1, okey, 20);

  s = americano.openHand(s, 1, [[...withOkey, "blue1-0"], kut5]);
  assert.deepEqual(
    s.melds.map((m) => m.type),
    ["seri", "kut"],
  );
});

test("the round ends with no finisher when the pile runs out", () => {
  let s = americano.startGame(seated(3));
  while (s.gameState === "play") {
    const p = s.currentPlayer;
    if (!s.drawn) s = game.drawTile(s, p, s.drawPile.at(-1), 25);
    s = americano.discardTile(s, p, player(s, p).hand.find(Boolean));
  }
  assert.equal(s.gameState, "roundEnd");
  assert.equal(s.message, "Round 1: no tiles left");
  // no finisher, so nobody gets the never-opened 100: everyone scores their hand
  for (const p of s.players.filter((x) => x.user)) {
    const hand = p.hand.filter(Boolean);
    const expected = sum(
      hand.map((x) => (isOkey(x, s.okeyTile) ? 25 : rankOf(x, s.okeyTile))),
    );
    assert.deepEqual(s.scores[p.id], [expected]);
  }
});

test("Elden: no opening, finish from hand, lowest total wins the game", () => {
  const winningHand = [
    ...["red1-0", "red2-0", "red3-0", "red4-0", null],
    ...["blue5-0", "blue6-0", "blue7-0", null],
    ...["black9-0", "black10-0", "black11-0", "black12-0", null],
    ...["red8-0", "black8-0", "blue8-0", null],
  ];
  let s = americano.startGame(seated(2), {
    okeyTile: "blue13-1",
    hands: [[...winningHand, "yellow2-0"], p2Hand],
  });
  assert.equal(
    americano.finishGame(s, 1, tileIn(s, 1, "yellow2-0")),
    "Finish by laying down your tiles and discarding the last one",
  );

  s = {
    ...s,
    round: 12,
    scores: { 1: Array(11).fill(20), 2: Array(11).fill(0) },
  };
  assert.match(americano.openHand(s, 1, [kut5]), /No opening/);
  s = americano.finishGame(s, 1, tileIn(s, 1, "yellow2-0"));

  const p2Sum = sum(
    player(s, 2)
      .hand.filter(Boolean)
      .map((x) => x.rank),
  );
  assert.equal(s.gameState, "finish");
  assert.equal(s.scores[1][11], AMERICANO.finishScore);
  assert.equal(s.scores[2][11], p2Sum);
  assert.equal(s.message, `P2 wins with ${p2Sum}`); // 220 for P1
});

test("the others' time to take a discard before the next one", () => {
  let s = americano.startGame(seated(4));
  s = americano.discardTile(s, 1, player(s, 1).hand.find(Boolean));
  s = americano.drawTile(s, 2, s.drawPile.at(-1), 25);
  const soon = s.offer.at + 1000;
  assert.equal(americano.claimWait(s, 2, soon), 7);
  assert.equal(americano.claimWait(s, 2, afterWait(s)), 0);
  // nobody else could take it
  assert.equal(
    americano.claimWait({ ...s, takes: { 3: 3, 4: 3 } }, 2, soon),
    0,
  );
  // a last tile goes at once
  const players = s.players.map((p) =>
    p.id === 2 ? { ...p, hand: [p.hand.find(Boolean)] } : p,
  );
  assert.equal(americano.claimWait({ ...s, players }, 2, soon), 0);
});

test("out of turn: earliest claimant after the current player gets the discard + 1", () => {
  let s = americano.startGame(seated(4));
  const thrown = player(s, 1).hand.find(Boolean);
  s = americano.discardTile(s, 1, thrown);
  // P3 asks before P2 has even drawn: the claim waits for the offer,
  // hidden from P2 until they've drawn
  s = americano.claimDiscard(s, 3, 25);
  assert.isOk(player(s, 3).claim);
  assert.isEmpty(americano.claimants(s));

  s = americano.drawTile(s, 2, s.drawPile.at(-1), 25); // P2 passes on it
  assert.equal(americano.claimDiscard(s, 1, 25), "That's your own tile");
  assert.equal(americano.claimDiscard(s, 2, 25), "You already drew this turn");
  assert.deepEqual(ids(americano.claimants(s)), [3]);
  s = americano.claimDiscard(s, 4, 25);
  const pile = s.drawPile.length;
  const tile = player(s, 2).hand.find(Boolean);
  assert.equal(
    americano.discardTile(s, 2, tile, s.offer.at + 1000),
    "Give the others 7s to take the discard",
  );
  s = americano.discardTile(s, 2, tile, afterWait(s));

  assert.equal(player(s, 3).inbox[0].id, thrown.id); // P3 comes before P4
  assert.equal(player(s, 3).inbox.length, 2);
  assert.deepEqual(s.takes, { 3: 1 });
  assert.isEmpty(player(s, 4).inbox ?? []);
  assert.equal(player(s, 1).discardPile.length, 0);
  assert.equal(s.drawPile.length, pile - 1);
  assertAllTiles(s);

  const before = player(s, 3).hand.filter(Boolean).length;
  s = americano.collectInbox(s, 3);
  assert.equal(player(s, 3).hand.filter(Boolean).length, before + 2);
  assert.isEmpty(player(s, 3).inbox);
  assertAllTiles(s);
});

test("a claim made before the draw lapses if the current player takes the tile", () => {
  let s = americano.startGame(seated(3));
  const thrown = player(s, 1).hand.find(Boolean);
  s = americano.discardTile(s, 1, thrown);
  s = americano.claimDiscard(s, 3, 25);
  s = americano.drawTile(s, 2, player(s, 1).discardPile.at(-1), 25);
  assert.isOk(tileIn(s, 2, thrown.id));
  assert.isEmpty(americano.claimants(s));
  s = americano.discardTile(s, 2, player(s, 2).hand.find(Boolean));
  assert.isEmpty(player(s, 3).inbox);
  assertAllTiles(s);
});

test("a claimant who left the table before the discard doesn't get it", () => {
  let s = americano.startGame(seated(4));
  s = americano.discardTile(s, 1, player(s, 1).hand.find(Boolean));
  s = americano.drawTile(s, 2, s.drawPile.at(-1), 25);
  s = americano.claimDiscard(s, 3, 25);
  s = americano.claimDiscard(s, 4, 25);
  assert.deepEqual(
    americano.claimants(s).map((p) => p.id),
    [3, 4],
  );
  s = {
    ...s,
    players: s.players.map((p) => (p.id === 3 ? { ...p, user: null } : p)),
  };
  s = americano.discardTile(
    s,
    2,
    player(s, 2).hand.find(Boolean),
    afterWait(s),
  );
  assert.isEmpty(player(s, 3).inbox ?? []);
  assert.equal(player(s, 4).inbox.length, 2);
});

test("at most 3 out-of-turn takes per player per round", () => {
  let s = americano.startGame(seated(3));
  s = americano.discardTile(s, 1, player(s, 1).hand.find(Boolean));
  s = americano.drawTile(s, 2, s.drawPile.at(-1), 25);
  s = { ...s, takes: { 3: AMERICANO.maxTakes } };
  assert.equal(americano.claimDiscard(s, 3, 25), "You can take 3 a round");
});

test("the player whose turn it is takes the discard first, closing the offer", () => {
  let s = americano.startGame(seated(3));
  s = americano.discardTile(s, 1, player(s, 1).hand.find(Boolean));
  s = americano.drawTile(s, 2, player(s, 1).discardPile.at(-1), 25);
  assert.equal(americano.claimDiscard(s, 3, 25), "Nothing to take right now");
});

test("from round 6, a real tile swaps out a table okey, which can open the same turn", () => {
  // okey is blue1 (both copies); P1 already has two melds with an okey each
  const kutWithOkey = ["red5-1", "blue5-1", "yellow5-0", "blue1-0"];
  const seriWithOkey = ["red3-1", "blue1-1", "red5-0"];
  const filler = ["yellow2-0", "yellow4-0", "yellow6-0", "yellow8-0"];
  let s = americano.startGame(seated(2), {
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
  s = americano.discardTile(s, 1, tileIn(s, 1, "yellow2-0"));
  s = game.drawTile(s, 2, s.drawPile.at(-1), 20);

  assert.match(
    americano.swapOkey({ ...s, round: 5 }, 2, "black5-0", 0),
    /from round 6/,
  );
  s = { ...s, round: 6 }; // 4'lü küt
  const threeKut = {
    type: "kut",
    owner: 1,
    tiles: table(["red5-1", "blue5-1", "blue1-0"]),
  };
  assert.match(
    americano.playOnMeld({ ...s, melds: [threeKut] }, 2, "black5-0", 0),
    /all four/,
  );
  s = americano.playOnMeld(s, 2, "black5-0", 0);
  assert.deepEqual(ids(s.melds[0].tiles).sort(), [
    "black5-0",
    "blue5-1",
    "red5-1",
    "yellow5-0",
  ]);
  assert.isOk(tileIn(s, 2, "blue1-0"));

  s = americano.openHand(s, 2, [["red9-0", "blue9-0", "black9-0", "blue1-0"]]);
  assert.isTrue(s.opened[2]);

  // red4 could also be added to 3-okey-5, but dropping it swaps the okey out
  s = americano.playOnMeld(s, 2, "red4-0", 1);
  assert.deepEqual(ids(s.melds[1].tiles), ["red3-1", "red4-0", "red5-0"]);
  assert.isOk(tileIn(s, 2, "blue1-1"));
  assertAllTiles(s);
});

// okey is blue1, standing for the yellow 3 in yellow 1-2-okey-4 on the
// table; it's P2's turn and they've drawn
function okeyOnTable(round) {
  const seri = ["yellow1-0", "yellow2-0", "blue1-0", "yellow4-0"];
  let s = americano.startGame(seated(2), {
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
  s = americano.discardTile(s, 1, tileIn(s, 1, "black5-0"));
  return [game.drawTile(s, 2, s.drawPile.at(-1), 20), seri];
}

test("a table okey keeps its place: only the tile it stands for takes it", () => {
  let [s] = okeyOnTable(3);
  // before opening, round 3: the yellow 3 can't take it, nor push it to 5
  assert.match(americano.playOnMeld(s, 2, "yellow3-0", 0), /from round 6/);

  s = { ...s, opened: { 2: true } };
  s = americano.playOnMeld(s, 2, "yellow5-0", 0);
  assert.deepEqual(ids(s.melds[0].tiles), [
    ...["yellow1-0", "yellow2-0", "blue1-0", "yellow4-0", "yellow5-0"],
  ]);
  // opened: any round, the yellow 3 takes the okey
  s = americano.playOnMeld(s, 2, "yellow3-0", 0);
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
    const next = americano.catchDiscard({ ...s, players, lastDiscard: id }, 2);
    return typeof next === "string" ? next : player(next, 2).caught;
  };
  const no = "That tile doesn't fit a meld on the table";
  const sixTo9 = ["black6-1", "black7-1", "black8-1", "blue1-1"];
  // the 4 fits only with the okey moved from the 9 to the 5
  assert.equal(catchOf(sixTo9, "black4-1"), no);
  assert.deepEqual(catchOf(sixTo9, "black5-1"), ["black5-1"]);
  assert.deepEqual(catchOf(sixTo9, "black10-1"), ["black10-1"]);
  // the tile the okey stands for could take its place
  assert.deepEqual(catchOf(sixTo9, "black9-1"), ["black9-1"]);

  // a 1 after 13 doesn't count, though Americano lets you lay it there
  assert.equal(
    catchOf(["black11-1", "black12-1", "black13-1"], "black1-1"),
    no,
  );
  assert.equal(catchOf(["black12-1", "black13-1", "blue1-1"], "black1-1"), no);
  assert.deepEqual(catchOf(["black2-1", "black3-1", "black4-1"], "black1-1"), [
    "black1-1",
  ]);
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
  s = americano.playOnMeld(s, 2, "black5-1", 0);
  assert.deepEqual(ids(s.melds[0].tiles), [
    ...["black5-1", "black6-1", "black7-1", "black8-1", "blue1-1"],
  ]);
});

test("opening with 4-5-okey off the rack lays the okey as the 6", () => {
  let [s] = okeyOnTable(2); // 3'lü seri
  s = { ...s, melds: [] };
  // P2 gets the other okey, blue1-1, unless they just drew it
  const okey = s.drawPile.find((x) => x.id === "blue1-1");
  if (okey) {
    s = game.drawTile(
      { ...s, drawn: false },
      2,
      okey,
      player(s, 2).hand.indexOf(null),
    );
  }
  // picked in rack order: red4, red5, okey
  s = americano.openHand(s, 2, [["red4-1", "red5-1", "blue1-1"]]);
  assert.deepEqual(ids(s.melds[0].tiles), ["red4-1", "red5-1", "blue1-1"]);
  assert.equal(okeyStandsFor(s.melds[0], 2, s.okeyTile).rank, 6);
});

test("an okey taken before opening (round 6+) means opening that turn, or putting it back", () => {
  let [s, seri] = okeyOnTable(6);
  s = americano.playOnMeld(s, 2, "yellow3-0", 0);
  assert.isOk(tileIn(s, 2, "blue1-0"));
  assert.match(
    americano.discardTile(s, 2, tileIn(s, 2, "black7-0")),
    /open your hand, or put the okey back/,
  );
  s = americano.playOnMeld(s, 2, "blue1-0", 0);
  assert.deepEqual(ids(s.melds[0].tiles), seri);
  assert.isOk(tileIn(s, 2, "yellow3-0"));
  s = americano.discardTile(s, 2, tileIn(s, 2, "black7-0"));
  assert.equal(s.currentPlayer, 1);
  assertAllTiles(s);
});

test("a game can be set up at any round, with totals and a starter", () => {
  const s = americano.setUp(seated(3), 7, { 1: 115, 2: "74", 3: 58 }, 3);
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
  assert.match(americano.setUp(seated(1), 3, {}, 1), /not enough players/);
});

test("nobody waits when no one else could take the discard", () => {
  let s = americano.startGame(seated(2));
  s = americano.discardTile(s, 1, player(s, 1).hand.find(Boolean));
  s = americano.drawTile(s, 2, s.drawPile.at(-1), 25, 1000);
  s = americano.discardTile(s, 2, player(s, 2).hand.find(Boolean), 1000);
  assert.equal(s.currentPlayer, 1);
});

test("a discard that fits a table meld can be caught: +20, and nobody takes it", () => {
  let s = americano.startGame(seated(3), deal);
  s = americano.openHand(s, 1, [kut10]);
  s = americano.discardTile(s, 1, tileIn(s, 1, "red10-0")); // fits küt 10
  assert.equal(americano.catchDiscard(s, 1), "That's your own tile");

  s = americano.catchDiscard(s, 3);
  assert.deepEqual(player(s, 3).caught, ["red10-0"]);
  assert.equal(americano.catchDiscard(s, 2), "Already caught");
  const caughtTile = player(s, 1).discardPile.at(-1);
  assert.equal(
    americano.drawTile(s, 2, caughtTile, 25),
    "That tile was caught",
  );
  s = americano.drawTile(s, 2, s.drawPile.at(-1), 25);
  assert.isNull(s.offer);

  s = americano.discardTile(s, 2, tileIn(s, 2, "red11-0"));
  assert.equal(
    americano.catchDiscard(s, 3),
    "That tile doesn't fit a meld on the table",
  );

  while (s.gameState === "play") {
    const p = s.currentPlayer;
    if (!s.drawn) s = americano.drawTile(s, p, s.drawPile.at(-1), 25);
    s = americano.discardTile(s, p, player(s, p).hand.find(Boolean), Infinity);
  }
  const hand = player(s, 1).hand.filter(Boolean);
  const inHand = sum(
    hand.map((x) => (isOkey(x, s.okeyTile) ? 25 : rankOf(x, s.okeyTile))),
  );
  assert.equal(s.scores[1][0], inHand + AMERICANO.catchPenalty);
});

test("a claim waits in the slot it was dropped on, and can be taken back", () => {
  let s = americano.startGame(seated(3));
  s = americano.discardTile(s, 1, player(s, 1).hand.find(Boolean));
  const offered = player(s, 1).discardPile.at(-1);
  assert.equal(s.lastDiscard, offered.id);
  s = americano.drawTile(s, 2, s.drawPile.at(-1), 25);

  s = americano.claimDiscard(s, 3, 20);
  assert.deepEqual(player(s, 3).claim, { id: s.offer.id, slot: 20 });
  s = americano.claimDiscard(s, 3, null);
  assert.isEmpty(americano.claimants(s));

  s = americano.claimDiscard(s, 3, 22);
  s = americano.discardTile(
    s,
    2,
    player(s, 2).hand.find(Boolean),
    afterWait(s),
  );
  s = americano.collectInbox(s, 3);
  assert.equal(player(s, 3).hand[22].id, offered.id);
  assertAllTiles(s);
});

test("picked tiles open and lay down wherever they sit on the rack", () => {
  let s = americano.startGame(seated(2), deal);
  s = { ...s, round: 3 }; // 3'lü küt + 3'lü seri, picked mixed together
  const mixed = ["red7-0", "blue5-0", "red9-0", "red5-0", "red8-0", "black5-0"];
  assert.match(
    americano.openHand(s, 1, [[...mixed.slice(0, 5), "yellow13-0"]]),
    /Open with exactly/,
  );
  s = americano.openHand(s, 1, [mixed]);
  assert.deepEqual(
    s.melds.map((m) => [m.type, ids(m.tiles)]),
    [
      ["seri", ["red7-0", "red8-0", "red9-0"]],
      ["kut", ["blue5-0", "red5-0", "black5-0"]],
    ],
  );

  // next turn: two melds picked in one go
  s = americano.discardTile(s, 1, tileIn(s, 1, "yellow13-0"));
  s = game.drawTile(s, 2, s.drawPile.at(-1), 20);
  s = game.discardTile(s, 2, tileIn(s, 2, "red11-0"));
  s = game.drawTile(s, 1, s.drawPile.at(-1), 20);
  s = americano.layMelds(s, 1, [
    ["black3-0", "blue10-0", "black2-0", "yellow10-0", "black4-0", "black10-0"],
  ]);
  assert.deepEqual(
    s.melds.slice(2).map((m) => m.type),
    ["seri", "kut"],
  );
});

test("catching the tile on offer drops the claims on it", () => {
  let s = americano.startGame(seated(3), deal);
  s = americano.openHand(s, 1, [kut10]);
  s = americano.discardTile(s, 1, tileIn(s, 1, "red10-0")); // fits küt 10
  s = americano.drawTile(s, 2, s.drawPile.at(-1), 25);
  s = americano.claimDiscard(s, 3, 25);
  assert.lengthOf(americano.claimants(s), 1);
  s = americano.catchDiscard(s, 2);
  assert.isEmpty(americano.claimants(s));
});
