import { assert, test } from "vitest";
import * as game from "./game";
import * as americano from "./americano";
import {
  AMERICANO,
  CLASSIC,
  ONE_O_ONE,
  PRESETS,
  invalid,
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
  assert.equal(
    no({ opening: { points: 101, pairs: 11 } }, ONE_O_ONE),
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
  // classic has no rounds to check
  assert.isUndefined(invalid({ ...CLASSIC, seats: 5 }));
});

test("classic is a ruleset: one unscored hand, up to its seats", () => {
  assert.equal(
    game.startGame({ ...seated(5), rules: CLASSIC }).message,
    "Up to 4 players with these rules",
  );
  const s = game.startGame({ ...seated(4), rules: CLASSIC });
  assert.equal(s.gameState, "play");
  assert.isFalse(game.hasRounds(s));
  // a game from before rulesets has none, and plays the same
  assert.isFalse(game.hasRounds(game.startGame(seated(4))));
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
  assert.isTrue(game.hasRounds(s));
  const last = s.players[0].hand.find((t) => t?.id === "yellow2-0");
  s = americano.finishGame(s, 1, last);
  assert.equal(s.gameState, "roundEnd");
  assert.deepEqual(s.scores, { 1: [-20], 2: [118] });
});
