import { assert, test } from "vitest";
import { sum } from "lodash";
import * as americano from "./americano";
import * as game from "./game";
import { isOkey, meldOrder, rankOf } from "./melds";
import { createTile } from "./utils";

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
    1: [americano.FINISH_SCORE],
    2: [americano.NOT_OPENED_SCORE],
  });

  s = americano.nextRound(s);
  assert.equal(s.round, 2);
  assert.equal(s.gameState, "play");
  assert.equal(s.currentPlayer, 2); // the starter rotates
  assert.deepEqual(s.melds, []);
  assert.deepEqual(s.opened, {});
  assert.deepEqual(s.takes, {});
  assertAllTiles(s);
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
  for (const p of s.players) {
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
  assert.equal(s.scores[1][11], americano.FINISH_SCORE);
  assert.equal(s.scores[2][11], p2Sum);
  assert.equal(s.message, `P2 wins with ${p2Sum}`); // 220 for P1
});

test("out of turn: earliest claimant after the current player gets the discard + 1", () => {
  let s = americano.startGame(seated(4));
  const thrown = player(s, 1).hand.find(Boolean);
  s = americano.discardTile(s, 1, thrown);
  assert.equal(americano.claimDiscard(s, 3), "Nothing to take right now");

  s = americano.drawTile(s, 2, s.drawPile.at(-1), 25); // P2 passes on it
  assert.equal(americano.claimDiscard(s, 1), "That's your own tile");
  assert.equal(americano.claimDiscard(s, 2), "You already drew this turn");
  s = americano.claimDiscard(s, 4);
  s = americano.claimDiscard(s, 3);
  const pile = s.drawPile.length;
  s = americano.discardTile(s, 2, player(s, 2).hand.find(Boolean));

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

test("a claimant who left the table before the discard doesn't get it", () => {
  let s = americano.startGame(seated(4));
  s = americano.discardTile(s, 1, player(s, 1).hand.find(Boolean));
  s = americano.drawTile(s, 2, s.drawPile.at(-1), 25);
  s = americano.claimDiscard(s, 3);
  s = americano.claimDiscard(s, 4);
  assert.deepEqual(
    americano.claimants(s).map((p) => p.id),
    [3, 4],
  );
  s = {
    ...s,
    players: s.players.map((p) => (p.id === 3 ? { ...p, user: null } : p)),
  };
  s = americano.discardTile(s, 2, player(s, 2).hand.find(Boolean));
  assert.isEmpty(player(s, 3).inbox ?? []);
  assert.equal(player(s, 4).inbox.length, 2);
});

test("at most 3 out-of-turn takes per player per round", () => {
  let s = americano.startGame(seated(3));
  s = americano.discardTile(s, 1, player(s, 1).hand.find(Boolean));
  s = americano.drawTile(s, 2, s.drawPile.at(-1), 25);
  s = { ...s, takes: { 3: americano.MAX_TAKES } };
  assert.equal(americano.claimDiscard(s, 3), "You can take 3 a round");
});

test("the player whose turn it is takes the discard first, closing the offer", () => {
  let s = americano.startGame(seated(3));
  s = americano.discardTile(s, 1, player(s, 1).hand.find(Boolean));
  s = americano.drawTile(s, 2, player(s, 1).discardPile.at(-1), 25);
  assert.equal(americano.claimDiscard(s, 3), "Nothing to take right now");
});

test("from round 6, a real tile swaps out a table okey, which can open the same turn", () => {
  // okey is blue1 (both copies); P1 already has two melds with an okey each
  const kutWithOkey = ["red5-1", "blue5-1", "blue1-0"];
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
  s = americano.playOnMeld(s, 2, "black5-0", 0);
  assert.deepEqual(ids(s.melds[0].tiles).sort(), [
    "black5-0",
    "blue5-1",
    "red5-1",
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
