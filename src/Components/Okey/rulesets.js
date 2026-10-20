// Rulesets: a game's numbers and switches, stored in its state (`rules`),
// so a game keeps the rules it was started with. A classic game has none.

// Americano: 13 rounds, each with its own opening (el açma) requirement.
export const AMERICANO = {
  id: "americano",
  name: "Americano",
  handSize: 14, // the starter gets one more
  // The opening must be exactly these melds, [type, size] each.
  // Elden has no opening: you finish with your whole hand in one go.
  rounds: [
    { name: "3'lü küt", melds: [["kut", 3]] },
    { name: "3'lü seri", melds: [["seri", 3]] },
    {
      name: "3'lü küt + 3'lü seri",
      melds: [
        ["kut", 3],
        ["seri", 3],
      ],
    },
    {
      name: "2 × 3'lü küt",
      melds: [
        ["kut", 3],
        ["kut", 3],
      ],
    },
    {
      name: "2 × 3'lü seri",
      melds: [
        ["seri", 3],
        ["seri", 3],
      ],
    },
    { name: "4'lü küt", melds: [["kut", 4]] },
    { name: "4'lü seri", melds: [["seri", 4]] },
    {
      name: "4'lü küt + 4'lü seri",
      melds: [
        ["kut", 4],
        ["seri", 4],
      ],
    },
    {
      name: "2 × 4'lü küt",
      melds: [
        ["kut", 4],
        ["kut", 4],
      ],
    },
    {
      name: "2 × 4'lü seri",
      melds: [
        ["seri", 4],
        ["seri", 4],
      ],
    },
    { name: "5'li seri", melds: [["seri", 5]] },
    // once opened with pairs, more pairs as well as sets and runs
    {
      name: "4 çift",
      melds: [
        ["pair", 2],
        ["pair", 2],
        ["pair", 2],
        ["pair", 2],
      ],
    },
    { name: "Elden", melds: null },
  ],
  // score sheet values; lowest total after the last round wins
  finishScore: -20, // shown as a line on the sheet
  notOpenedScore: 100,
  okeyInHandScore: 25,
  // out-of-turn takes allowed per player per round
  maxTakes: 3,
  // from this round on, a real tile can take an okey's place in a table meld
  okeySwapFromRound: 6,
  // after drawing from the pile, the others get this long to take the discard
  claimWaitSeconds: 8,
  // discarding a tile that fits a table meld (işler taş): whoever catches it
  // adds this to the discarder's round score, and nobody can take the tile
  catchPenalty: 20,
  wrapRuns: true, // 12-13-1 is a run
  outOfTurnTakes: true, // anyone may claim the discard (maxTakes a round)
  swapOkeys: true, // a table okey can be traded for the tile it stands for
  buildWhenOpening: false, // lay more and add to melds only from next turn
};

// 101 Okey, as pagat.com has it (pagat.com/rummy/okey101.html): open with
// sets and runs worth 101 or more at face value, or with 5 pairs; the
// lowest total after 11 hands wins.
export const ONE_O_ONE = {
  id: "101",
  name: "101",
  handSize: 21,
  // the same opening every hand
  rounds: Array.from({ length: 11 }, (_, i) => ({ name: `${i + 1}` })),
  opening: { points: 101, pairs: 5 },
  // a pairs opener scores double, and lays only pairs (or adds to the
  // table's sets and runs); a win with pairs or by discarding the okey
  // doubles every score, both together quadruple it (a player who didn't
  // open pays at most twice notOpenedScore)
  finishScore: -101,
  notOpenedScore: 202,
  okeyInHandScore: 101,
  catchPenalty: 101, // işler taş, caught with the Catch button
  okeyDiscardPenalty: 101, // discarding the okey, unless it's your last tile
  wrapRuns: false, // 1-2-3 only, never 12-13-1
  outOfTurnTakes: false,
  // the previous discard can be taken only to use it in a meld that turn
  takeMustBeUsed: true,
  swapOkeys: false, // a table okey stays where it is
  buildWhenOpening: true,
};
