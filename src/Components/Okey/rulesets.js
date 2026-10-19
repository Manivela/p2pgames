// Rulesets: a game's numbers and switches, stored in its state (`rules`),
// so a game keeps the rules it was started with. A classic game has none.

// Americano: 12 rounds, each with its own opening (el açma) requirement.
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
};
