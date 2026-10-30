import { assert, test } from "vitest";
import * as game from "./game";
import * as americano from "./americano";
import {
  AMERICANO,
  CLASSIC,
  ONE_O_ONE,
  PRESETS,
  invalid,
  modern,
  roundName,
} from "./rulesets";

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

const elden = (n) =>
  Array.from({ length: n }, () => ({ name: "Elden", melds: null }));

test("the presets can be played, and Americano's rounds are named by their melds", () => {
  for (const r of PRESETS) assert.isUndefined(invalid(r), r.name);
  assert.deepEqual(
    AMERICANO.rounds.map((r) => roundName(r.melds)),
    AMERICANO.rounds.map((r) => r.name),
  );
  assert.equal(roundName([["seri", 6]]), "6'lı seri");
  assert.equal(roundName([["seri", 9]]), "9'lu seri");
});

test("a ruleset that would break a game isn't played", () => {
  const no = (change, base = AMERICANO) => invalid({ ...base, ...change });
  assert.equal(no({ name: " " }), "Give the rules a name");
  assert.equal(no({ seats: 9 }), "2 to 8 players");
  assert.equal(no({ tileSets: 5 }), "1 to 4 sets of tiles");
  assert.equal(no({ seats: 8 }), "Not enough tiles for those hands");
  assert.isUndefined(no({ seats: 8, tileSets: 4 }));
  assert.equal(no({ seats: 5 }, ONE_O_ONE), "Not enough tiles for those hands");
  assert.equal(no({ rowSlots: 10 }), "Make the rack's rows longer");
  assert.equal(no({ maxTakes: null }), "Fill in every number");
  assert.equal(no({ rounds: [] }), "1 to 50 rounds");
  assert.equal(no({ okeySwapFromRound: 0 }), "Fill in every number");
  const opening = (o) => ({ rounds: [{ name: "", opening: o }] });
  assert.equal(
    no(opening({ points: 101, pairs: 11 }), ONE_O_ONE),
    "Round 1 asks for more than a hand holds",
  );
  assert.equal(
    no(opening({ points: null, pairs: 5 }), ONE_O_ONE),
    "Fill in every number",
  );
  const big = {
    name: "",
    melds: [
      ["seri", 13],
      ["kut", 3],
    ],
  };
  assert.equal(
    no({ rounds: [...elden(2), big] }),
    "Round 3 asks for more than a hand holds",
  );
  assert.equal(
    no({ rounds: [{ name: "", melds: [["kut", 5]] }] }),
    "Round 1 asks for more than a hand holds",
  );
  assert.isUndefined(invalid({ ...CLASSIC, seats: 5 }));
});

test("classic is one hand; a pile that runs out is shuffled in, or the hand dealt again", () => {
  assert.equal(
    americano.startGame(seated(5), undefined, CLASSIC).message,
    "Up to 4 players with these rules",
  );
  let s = americano.startGame(seated(4), undefined, CLASSIC);
  const hand = (p) => s.players.find((x) => x.id === p).hand;
  while (s.drawPile.length || s.currentPlayer === 1) {
    const p = s.currentPlayer;
    if (!s.drawn) s = americano.drawTile(s, p, s.drawPile.at(-1), 27);
    s = americano.discardTile(s, p, hand(p).find(Boolean));
  }
  // it waits for the player whose turn it is
  assert.equal(s.gameState, "play");
  const p = s.currentPlayer;
  assert.isUndefined(americano.endPile(s, (p % 4) + 1));
  assert.isAbove(game.shuffleDiscards(s, p).drawPile.length, 0);
  const over = americano.endPile(s, p);
  assert.isTrue(over.replay);
  assert.equal(over.message, "Round 1: no tiles left, dealt again");
  // without reshuffling, the round ends with the pile
  s = americano.startGame(seated(4), undefined, {
    ...CLASSIC,
    reshuffle: false,
  });
  while (s.gameState === "play") {
    const p = s.currentPlayer;
    if (!s.drawn) s = americano.drawTile(s, p, s.drawPile.at(-1), 27);
    s = americano.discardTile(s, p, hand(p).find(Boolean));
  }
  assert.equal(s.gameState, "roundEnd");
});

test("older rules read as they're played now", () => {
  // a game from before rulesets, and classic before it had rounds
  assert.deepEqual(modern(null), CLASSIC);
  assert.deepEqual(
    modern({ id: "classic", name: "Okey", handSize: 14 }),
    CLASSIC,
  );
  // a whole game's points opening is each round's; its pile and finish
  // went by 101's then
  const { rounds, ...old101 } = ONE_O_ONE;
  const was = modern({
    ...old101,
    finishDoubled: undefined,
    pileOutCounts: undefined,
    opening: { points: 101, pairs: 5 },
    rounds: rounds.map((_, i) => ({ name: `${i + 1}` })),
  });
  assert.deepEqual(was.rounds, rounds);
  assert.isTrue(was.finishDoubled);
  assert.isFalse(was.pileOutCounts);
  // Americano's pile scored
  const { pileOutCounts, ...oldAmericano } = AMERICANO;
  assert.isTrue(pileOutCounts);
  assert.isTrue(modern(oldAmericano).pileOutCounts);
  for (const r of PRESETS) assert.deepEqual(modern(r), r);
});

test("eight play with four sets of tiles, every tile dealt once", () => {
  const rules = { ...AMERICANO, seats: 8, tileSets: 4 };
  const s = americano.startGame(seated(8), undefined, rules);
  assert.equal(s.gameState, "play");
  assert.equal(s.players.length, 8);
  assert.deepEqual(
    s.players.map((p) => p.hand.filter(Boolean).length),
    [15, 14, 14, 14, 14, 14, 14, 14],
  );
  const ids = [
    ...s.drawPile,
    s.okeyTile,
    ...s.players.flatMap((p) => p.hand.filter(Boolean)),
  ].map((t) => t.id);
  assert.equal(ids.length, 4 * 53);
  assert.equal(new Set(ids).size, 4 * 53);
  // the next round deals from four sets again
  const next = americano.nextRound(americano.redealRound(s));
  assert.equal(next.drawPile.length, s.drawPile.length);
  // and a table of eight shows every seat once they're all taken
  assert.lengthOf(game.tableSeats(seated(8).players), 8);
  assert.lengthOf(game.tableSeats(seated(5).players), 6);
});

test("finishing from the hand over several hands is scored", () => {
  const winning = [
    ...["red1-0", "red2-0", "red3-0", "red4-0", null],
    ...["blue5-0", "blue6-0", "blue7-0", null],
    ...["black9-0", "black10-0", "black11-0", "black12-0", null],
    ...["red8-0", "black8-0", "blue8-0", null],
    "yellow2-0",
  ];
  const other = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
    .map((r) => `yellow${r}-0`)
    .concat(["red9-0", "red10-0", "red11-0"]);
  const rules = {
    ...CLASSIC,
    id: "x",
    name: "Okey × 3",
    rounds: elden(3),
    finishScore: -20,
    okeyInHandScore: 25,
  };
  assert.isUndefined(invalid(rules));
  let s = americano.startGame(
    seated(2),
    { okeyTile: "blue13-1", hands: [winning, other] },
    rules,
  );
  const last = s.players[0].hand.find((t) => t?.id === "yellow2-0");
  s = americano.finishGame(s, 1, last);
  assert.equal(s.gameState, "roundEnd");
  assert.deepEqual(s.scores, { 1: [-20], 2: [118] });
  // classic's one hand is just won
  s = americano.startGame(
    seated(2),
    { okeyTile: "blue13-1", hands: [winning, other] },
    CLASSIC,
  );
  s = americano.finishGame(s, 1, last);
  assert.equal(s.gameState, "finish");
  assert.equal(s.message, "P1 wins!");
});
