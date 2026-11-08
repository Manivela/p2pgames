import { assert, test } from "vitest";
import * as Y from "yjs";
import * as game from "./game";
import * as okey from "./okey";
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
  assert.deepEqual(s.turnMoves, [
    { by: 2, move: "took", tiles: ["yellow2-0"] },
  ]);
  assert.equal(player(s, 1).discardPile.length, 0);
  s = game.discardTile(s, 2, tileIn(s, 2, "red9-0"));
  assert.equal(s.currentPlayer, 1);

  const drawn = s.drawPile.at(-1);
  s = game.drawTile(s, 1, drawn, 25);
  assertAllTiles(s);
  // throwing a tile the winning layout needs doesn't finish
  assert.equal(
    game.finishGame(s, 1, tileIn(s, 1, "red1-0")),
    "That hand doesn't finish",
  );

  s = game.finishGame(s, 1, tileIn(s, 1, drawn.id));
  assert.equal(s.gameState, "finish");
  assert.equal(s.message, "P1 wins!");
  // drawn from the pile, so the finish is all the round's end shows
  assert.deepEqual(s.turnMoves, [
    { by: 1, move: "finished", tiles: [drawn.id] },
  ]);
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

  // the pile ran out on seat 2's turn: they shuffle the discards, or end it
  assert.equal(s.currentPlayer, 2);
  assert.isUndefined(game.shuffleDiscards(s, 3));
  const shuffled = game.shuffleDiscards(s, 2);
  assert.equal(shuffled.drawPile.length, 49);
  assert.isTrue(shuffled.drawPile.every((t) => t.hidden));
  assert.isTrue(shuffled.players.every((p) => !p.discardPile.length));
  assertAllTiles(shuffled);
  const top = shuffled.drawPile.at(-1);
  assert.ok(tileIn(game.drawTile(shuffled, 2, top, 25), 2, top.id));
  assert.isFalse(game.pileOut(shuffled, 2)); // there's a pile again
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
  const s = okey.startGame(seated(4));
  const code = await game.encodeSave(s);
  assert.match(code, /^[A-Za-z0-9+/=]+$/); // no JSON, no tile ids
  // deflated, about a fifth of the JSON (4.9 to 5.2 over random deals)
  assert.isBelow(code.length, JSON.stringify(s).length / 4);
  assert.deepEqual(await game.decodeSave(code), s);
  assert.isNull(await game.decodeSave("hello"));
  assert.isNull(await game.decodeSave(JSON.stringify(s)));
});

// a rack row from a picture: letters are tiles, _ a gap
const rack = (row) =>
  [...row].map((c) => (c === "_" ? null : { id: c, source: "hand-1" }));
const picture = (hand) => hand.map((t) => t?.id ?? "_").join("");
const place = (row, ids, at, held) =>
  picture(
    game
      .placeTiles(
        rack(row),
        row.length / 2,
        [...ids].map((id) => ({ id, source: "hand-1" })),
        at,
        held,
      )
      .slice(0, row.length / 2),
  );

test("a tile dropped on a rack slot pushes what's there aside", () => {
  // two rows of 8; only the top one matters here
  const top = (row) => row + "_".repeat(8);
  // dropped on B, it lands there; B and C slide right into the nearest gap
  assert.equal(place(top("_AB_C__D"), "X", 2), "_AXBC__D");
  // the nearest gap is on the left
  assert.equal(place(top("AB_CDEF_"), "X", 4), "ABCDXEF_");
  // tied: to the right
  assert.equal(place(top("_ABC_DE_"), "X", 2), "_AXBCDE_");
  // never into the other row: the gap to the left is used
  assert.equal(place(top("_ABCDEFG"), "X", 6), "ABCDEFXG");
});

test("a tile moved within its group closes the gap it left", () => {
  const top = (row) => row + "_".repeat(8);
  // A to D's slot: B C D close up behind it, the gap before F stays
  assert.equal(place(top("_ABCD_FG"), "A", 4), "_BCDA_FG");
  // D to B's slot: B C move right into D's old slot
  assert.equal(place(top("_ABCD_FG"), "D", 2), "_ADBC_FG");
  // onto itself: nothing moves
  assert.equal(place(top("_ABCD_FG"), "C", 3), "_ABCD_FG");
});

test("picked tiles land together around the one held", () => {
  const top = (row) => row + "_".repeat(8);
  // X Y held by Y, dropped on slot 4: X on 3, Y on 4, C D slide right
  assert.equal(place(top("_ABCD___"), "XY", 4, "Y"), "_ABXYCD_");
  // the tiles in the way part to both sides when that slides fewer
  assert.equal(place(top("__ABCD__"), "XY", 3), "_ABXYCD_");
  // dropped near the end of the row, they stay in it
  assert.equal(place(top("A_______"), "XYZ", 7), "A____XYZ");
  // from this row: the group closes up towards where they were
  assert.equal(place(top("XY_ABCD_"), "XY", 4, "X"), "_ABCXYD_");
  // the gap between them comes along; a tile between them doesn't
  assert.equal(place(top("X_Y_____"), "XY", 4, "X"), "____X_Y_");
  assert.equal(place(top("XAY_____"), "XY", 5, "X"), "_A___XY_");
  // no room for the gap: side by side
  assert.equal(place("ABCDEF__" + "X_Y_____", "XY", 6, "X"), "ABCDEFXY");
});

test("a full row swaps instead", () => {
  // X from the bottom row onto a full top row: B takes X's old slot
  const hand = rack("ABCD" + "X___");
  const moved = game.placeTiles(hand, 4, [hand[4]], 1);
  assert.equal(picture(moved), "AXCD" + "B___");
  // a new tile: what's in the way takes the first gap
  const drawn = game.placeTiles(hand, 4, [{ id: "N" }], 1);
  assert.equal(picture(drawn), "ANCD" + "XB__");
});

test("picked tiles move together through the rules", () => {
  let s = game.startGame(seated(2));
  const hand = () => player(s, 1).hand;
  const at = (i) => hand()[i]?.id;
  const [a, b, c] = [hand()[0], hand()[4], hand()[9]].map((t) => t.id);

  // held by b, dropped on 20: a b c on 19 20 21
  s = game.moveTiles(s, 1, [c, a, b], 20, b);
  assert.deepEqual([at(19), at(20), at(21)], [a, b, c]);
  assertAllTiles(s);

  // a drawn tile dropped on a tile lands there; that one slides aside in
  // its row
  s = game.discardTile(s, 1, hand().find(Boolean));
  const theirs = () => player(s, 2).hand;
  const bottom = () => theirs().slice(13).filter(Boolean).length;
  const [before, drawn] = [bottom(), s.drawPile.at(-1).id];
  assert.isNotNull(theirs()[13]);
  s = game.drawTile(s, 2, s.drawPile.at(-1), 13);
  assert.equal(theirs()[13].id, drawn);
  assert.equal(bottom(), before + 1);
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
  writeState(mapB, s, game.moveTiles(s, 2, [p2Tile.id], 25));
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
  let start = okey.startGame(seated(3));
  start = okey.discardTile(start, 1, player(start, 1).hand.find(Boolean));
  start = okey.drawTile(start, 2, start.drawPile.at(-1), 25);
  const { mapA, mapB, sync } = twoPeers(start);

  // P2 tidies their rack on one peer while P3 claims on the other
  const s = readState(mapA);
  writeState(
    mapA,
    s,
    game.moveTiles(s, 2, [player(s, 2).hand.find(Boolean).id], 24),
  );
  writeState(mapB, s, okey.claimDiscard(s, 3, 25));
  sync();

  const merged = readState(mapA);
  assert.equal(player(merged, 3).claim.id, merged.offer.id);
  const done = okey.discardTile(
    merged,
    2,
    player(merged, 2).hand.find(Boolean),
    merged.offer.at + AMERICANO.claimWaitSeconds * 1000,
  );
  assert.equal(player(done, 3).inbox.length, 2);
});

test("a game keeps its ruleset, synced and saved", async () => {
  const s = okey.startGame(seated(2));
  assert.deepEqual(s.rules, AMERICANO);
  const map = new Y.Doc().getMap("okey-state");
  replaceState(map, s);
  assert.deepEqual(readState(map).rules, AMERICANO);
  assert.notProperty(map.get(`${map.get("deal")}/turn`), "rules");

  const loaded = await game.decodeSave(await game.encodeSave(s));
  assert.deepEqual(loaded.rules, AMERICANO);
  assert.equal(
    okey.discardTile(loaded, 1, player(loaded, 1).hand.find(Boolean))
      .currentPlayer,
    2,
  );
  // an older build's, not played in rounds, isn't loaded
  assert.isNull(await game.decodeSave(await game.encodeSave(seated(2))));
});

test("a hand laid out on longer or shorter rack rows keeps its tiles and groups", () => {
  const rows = (text) =>
    text.split(" ").map((id) => (id === "_" ? null : { id }));
  const ids = (hand) => hand.map((t) => t?.id ?? "_").join(" ");
  // 9 a row; longer, the gaps come at each row's end, and shorter again
  // they go
  const hand = rows("a b c _ d e _ _ f _ _ _ g _ _ _ _ _");
  const long = game.resizeRows(hand, 9, 11);
  assert.equal(ids(long), "a b c _ d e _ _ f _ _ _ _ _ g _ _ _ _ _ _ _");
  assert.equal(ids(game.resizeRows(long, 11, 9)), ids(hand));
  // a row with no gap at its end: one of two side by side goes first,
  // then the one between two groups
  const gaps = rows("a _ _ b _ c _ _ _ _ _ _");
  assert.equal(ids(game.resizeRows(gaps, 6, 5)), "a _ b _ c _ _ _ _ _");
  assert.equal(ids(game.resizeRows(gaps, 6, 4)), "a _ b c _ _ _ _");
  // a row of more tiles than the new one holds: its last goes to the last
  // free slot
  const full = rows("a b c d e f _ _");
  assert.equal(ids(game.resizeRows(full, 4, 3)), "a b c e f d");
});

test("your own rack rows, set mid-round, lay out only your hand, and sync", () => {
  let s = okey.startGame(seated(2));
  const before = player(s, 1).hand.filter(Boolean).length;
  // Americano's hand, a draw and three takes: rows of 11 at least
  assert.equal(game.setRow(s, 1, 10), "Make the rack's rows longer");
  s = game.setRow(s, 1, 11);
  assert.equal(game.rowOf(s, 1), 11);
  assert.equal(game.rowOf(s, 2), 13);
  assert.equal(player(s, 1).hand.length, 22);
  assert.equal(count(s, 1), before);
  assertAllTiles(s);
  // a move reads your rows: slot 11 starts the bottom one
  const first = player(s, 1).hand.find(Boolean);
  const moved = game.moveTiles(s, 1, [first.id], 11);
  assert.equal(player(moved, 1).hand[11].id, first.id);
  // synced in its own key, not the seats someone else may be writing
  const map = new Y.Doc().getMap("okey-state");
  replaceState(map, s);
  assert.equal(readState(map).players[0].rowSlots, 11);
  assert.notProperty(map.get(`${map.get("deal")}/seats`)[0], "rowSlots");
  assert.notProperty(readState(map).players[1], "rowSlots");
  // back to the table's
  s = game.setRow(s, 1, null);
  assert.notProperty(player(s, 1), "rowSlots");
  assert.equal(player(s, 1).hand.length, 26);
  assert.equal(count(s, 1), before);
});
