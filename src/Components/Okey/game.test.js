import { assert, test } from "vitest";
import * as Y from "yjs";
import * as game from "./game";
import * as americano from "./americano";
import { readState, replaceState, writeState } from "./sync";
import { AMERICANO } from "./rulesets";

// unshuffled table with the first `count` seats taken
function seated(count) {
  return {
    ...game.initialState,
    drawPile: game.tiles.map((t) => ({ ...t, hidden: true })),
    players: game.initialState.players.map((p) =>
      p.id <= count
        ? { ...p, user: { id: `u${p.id}`, name: `P${p.id}` }, userKey: p.id }
        : p,
    ),
  };
}

const player = (s, id) => s.players.find((p) => p.id === id);
const tileIn = (s, id, tileId) =>
  player(s, id).hand.find((t) => t?.id === tileId);
const count = (s, id) => player(s, id).hand.filter(Boolean).length;

function assertAllTiles(s) {
  const ids = [
    ...s.drawPile,
    s.okeyTile,
    s.finishTile,
    ...s.players.flatMap((p) => [...p.hand, ...p.discardPile]),
  ]
    .filter(Boolean)
    .map((t) => t.id);
  assert.equal(ids.length, 106);
  assert.equal(new Set(ids).size, 106);
}

test("scripted 2 player game: discard, take discard, draw, finish", () => {
  const winningHand = [
    ...["red1-0", "red2-0", "red3-0", "red4-0", null],
    ...["blue5-0", "blue6-0", "blue7-0", null],
    ...["black9-0", "black10-0", "black11-0", "black12-0", null],
    ...["red8-0", "black8-0", "blue8-0", null],
  ];
  const p2Hand = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
    .map((r) => `yellow${r}-0`)
    .concat(["red9-0", "red10-0", "red11-0"]);

  let s = game.startGame(seated(2), {
    okeyTile: "blue13-1", // okey is blue1, not in anyone's hand
    hands: [[...winningHand, "yellow2-0"], p2Hand],
  });
  assert.equal(s.gameState, "play");
  assert.equal(s.currentPlayer, 1);
  assert.equal(count(s, 1), 15);
  assert.equal(count(s, 2), 14);
  assertAllTiles(s);

  const top = s.drawPile.at(-1);
  assert.equal(game.drawTile(s, 2, top, 20), "Not your turn");
  assert.equal(game.drawTile(s, 1, top, 20), "Can't draw more tiles");

  s = game.discardTile(s, 1, tileIn(s, 1, "yellow2-0"));
  assert.equal(s.currentPlayer, 2);
  assert.equal(
    game.discardTile(s, 2, tileIn(s, 2, "red9-0")),
    "Can't discard before drawing",
  );

  s = game.drawTile(s, 2, player(s, 1).discardPile.at(-1), 20);
  assert.equal(count(s, 2), 15);
  assert.equal(player(s, 1).discardPile.length, 0);
  s = game.discardTile(s, 2, tileIn(s, 2, "red9-0"));
  assert.equal(s.currentPlayer, 1);

  const drawn = s.drawPile.at(-1);
  s = game.drawTile(s, 1, drawn, 25);
  assertAllTiles(s);
  // throwing a tile the winning layout needs doesn't finish
  assert.isUndefined(game.finishGame(s, 1, tileIn(s, 1, "red1-0")));

  s = game.finishGame(s, 1, tileIn(s, 1, drawn.id));
  assert.equal(s.gameState, "finish");
  assert.equal(s.message, "P1 wins!");
  assert.equal(game.drawTile(s, 2, s.drawPile.at(-1), 20), "The round is over");
});

test("a fake okey is never the indicator", () => {
  const fakes = game.tiles.filter((t) => t.rank === "👌");
  const real = game.tiles.find((t) => t.rank === 7);
  for (let i = 0; i < 20; i++) {
    assert.equal(game.pickOkeyTile([...fakes, real]).id, real.id);
  }
});

test("only the previous player's discard can be taken", () => {
  let s = game.startGame(seated(3));
  s = game.discardTile(s, 1, player(s, 1).hand.find(Boolean));
  s = game.drawTile(s, 2, s.drawPile.at(-1), 25);
  s = game.discardTile(s, 2, player(s, 2).hand.find(Boolean));

  assert.equal(
    game.drawTile(s, 3, player(s, 1).discardPile[0], 25),
    "Can't draw this tile",
  );
  const taken = game.drawTile(s, 3, player(s, 2).discardPile[0], 25);
  assert.equal(count(taken, 3), 15);
  assertAllTiles(taken);
});

test("4 players can draw the whole pile without losing a tile", () => {
  let s = game.startGame(seated(4));
  s = game.discardTile(s, 1, player(s, 1).hand.find(Boolean));
  while (s.drawPile.length) {
    const p = s.currentPlayer;
    s = game.drawTile(s, p, s.drawPile.at(-1), player(s, p).hand.indexOf(null));
    s = game.discardTile(s, p, player(s, p).hand.find(Boolean));
  }
  assert.equal(s.gameState, "play");
  assertAllTiles(s);
});

test("a loaded game seats whoever sits there now", () => {
  const saved = game.startGame(seated(2));
  const tonight = {
    ...game.initialState,
    players: game.initialState.players.map((p) =>
      p.id === 1 ? { ...p, user: { id: "x", name: "Ayşe" }, userKey: 9 } : p,
    ),
  };
  const s = game.restore(saved, tonight);
  assert.equal(player(s, 1).user.name, "Ayşe");
  assert.equal(player(s, 1).userKey, 9);
  assert.isNull(player(s, 2).user);
  assert.deepEqual(player(s, 1).hand, player(saved, 1).hand);
});

test("a save code hides the state and loads it back", async () => {
  const s = game.startGame(seated(4));
  const code = await game.encodeSave(s);
  assert.match(code, /^[A-Za-z0-9+/=]+$/); // no JSON, no tile ids
  assert.isBelow(code.length, JSON.stringify(s).length / 5);
  assert.deepEqual(await game.decodeSave(code), s);
  assert.isNull(await game.decodeSave("hello"));
  assert.isNull(await game.decodeSave(JSON.stringify(s)));
});

test("picked tiles move together, side by side in rack order", () => {
  let s = game.startGame(seated(2));
  const hand = () => player(s, 1).hand;
  const at = (i) => hand()[i]?.id;
  const [a, b, c] = [hand()[0], hand()[4], hand()[9]].map((t) => t.id);
  const inTheWay = [at(14), at(15)];

  s = game.moveTiles(s, 1, [c, a, b], 14);
  assert.deepEqual([at(14), at(15), at(16)], [a, b, c]);
  // what sat in 14 and 15 took the picked tiles' old slots
  assert.sameMembers(
    inTheWay.filter(Boolean),
    [at(0), at(4), at(9)].filter(Boolean),
  );
  assertAllTiles(s);

  // dropped near the end of a row, the group stays in that row
  s = game.moveTiles(s, 1, [a, b, c], 12);
  assert.deepEqual([at(10), at(11), at(12)], [a, b, c]);
  assertAllTiles(s);
});

// two peers that start in sync; sync() swaps what each wrote since
function twoPeers(state) {
  const [a, b] = [new Y.Doc(), new Y.Doc()];
  const sync = () => {
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
  };
  const [mapA, mapB] = [a.getMap("okey-state"), b.getMap("okey-state")];
  writeState(mapA, undefined, state);
  sync();
  return { mapA, mapB, sync };
}

test("moves two players make at the same moment both survive sync", () => {
  const { mapA, mapB, sync } = twoPeers(game.startGame(seated(2)));

  // P1 discards on one peer while P2 tidies their rack on the other
  const s = readState(mapA);
  const p1Tile = player(s, 1).hand.find(Boolean);
  const p2Tile = player(s, 2).hand.find(Boolean);
  writeState(mapA, s, game.discardTile(s, 1, p1Tile));
  writeState(mapB, s, game.swapTile(s, 2, p2Tile, 25));
  sync();

  for (const merged of [readState(mapA), readState(mapB)]) {
    assert.equal(merged.currentPlayer, 2);
    assert.equal(player(merged, 1).discardPile[0].id, p1Tile.id);
    assert.equal(player(merged, 2).hand[25].id, p2Tile.id);
    assertAllTiles(merged);
  }
});

test("a seat change during a draw can't duplicate the drawn tile", () => {
  const start = game.startGame(seated(3));
  const { mapA, mapB, sync } = twoPeers(
    game.discardTile(start, 1, player(start, 1).hand.find(Boolean)),
  );

  // P2 draws on one peer while the other unseats P3 (stand / disconnect)
  const s = readState(mapA);
  writeState(mapA, s, game.drawTile(s, 2, s.drawPile.at(-1), 25));
  writeState(mapB, s, {
    ...s,
    players: s.players.map((p) => (p.id === 3 ? { ...p, user: null } : p)),
    message: "P3 left",
  });
  sync();

  for (const merged of [readState(mapA), readState(mapB)]) {
    assertAllTiles(merged);
    assert.equal(count(merged, 2), 15);
    assert.equal(merged.currentPlayer, 2);
    assert.isNull(player(merged, 3).user);
  }
});

test("a reset racing a move replaces the game whole", () => {
  const { mapA, mapB, sync } = twoPeers(game.startGame(seated(2)));

  const s = readState(mapA);
  writeState(mapA, s, game.discardTile(s, 1, player(s, 1).hand.find(Boolean)));
  replaceState(mapB, seated(2));
  sync();

  for (const merged of [readState(mapA), readState(mapB)]) {
    assert.equal(merged.gameState, "start");
    assertAllTiles(merged);
  }
});

test("a rejoining player who sits before syncing can't reset the game", () => {
  // which of two concurrent writes to a key wins depends on the clientIDs
  for (const [tableId, phoneId] of [
    [1, 2],
    [2, 1],
  ]) {
    const [table, phone] = [new Y.Doc(), new Y.Doc()];
    table.clientID = tableId;
    phone.clientID = phoneId;
    const [mapT, mapP] = [
      table.getMap("okey-state"),
      phone.getMap("okey-state"),
    ];
    writeState(mapT, undefined, seated(2));
    replaceState(mapT, game.startGame(readState(mapT)));

    // the phone reloaded: its doc is empty, so it shows an empty table
    const empty = readState(mapP);
    writeState(mapP, empty, {
      ...game.initialState,
      players: seated(1).players,
    });
    Y.applyUpdate(phone, Y.encodeStateAsUpdate(table));
    Y.applyUpdate(table, Y.encodeStateAsUpdate(phone));

    for (const merged of [readState(mapT), readState(mapP)]) {
      assert.equal(merged.gameState, "play");
      assertAllTiles(merged);
    }
  }
});

test("a claim made while the current player moves survives sync", () => {
  let start = americano.startGame(seated(3));
  start = americano.discardTile(start, 1, player(start, 1).hand.find(Boolean));
  start = americano.drawTile(start, 2, start.drawPile.at(-1), 25);
  const { mapA, mapB, sync } = twoPeers(start);

  // P2 tidies their rack on one peer while P3 claims on the other
  const s = readState(mapA);
  writeState(mapA, s, game.swapTile(s, 2, player(s, 2).hand.find(Boolean), 24));
  writeState(mapB, s, americano.claimDiscard(s, 3, 25));
  sync();

  const merged = readState(mapA);
  assert.equal(player(merged, 3).claim.id, merged.offer.id);
  const done = americano.discardTile(
    merged,
    2,
    player(merged, 2).hand.find(Boolean),
    merged.offer.at + AMERICANO.claimWaitSeconds * 1000,
  );
  assert.equal(player(done, 3).inbox.length, 2);
});

test("a game keeps its ruleset, synced and saved", async () => {
  const s = americano.startGame(seated(2));
  assert.deepEqual(s.rules, AMERICANO);
  const map = new Y.Doc().getMap("okey-state");
  replaceState(map, s);
  assert.deepEqual(readState(map).rules, AMERICANO);
  assert.notProperty(map.get(`${map.get("deal")}/turn`), "rules");

  const loaded = await game.decodeSave(await game.encodeSave(s));
  assert.deepEqual(loaded.rules, AMERICANO);
  assert.equal(
    americano.discardTile(loaded, 1, player(loaded, 1).hand.find(Boolean))
      .currentPlayer,
    2,
  );
  const classic = await game.decodeSave(await game.encodeSave(seated(2)));
  assert.notProperty(classic, "rules");
});
