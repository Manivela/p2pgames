import { sum } from "lodash";

// Rulesets: a game's numbers and switches, stored in its state (`rules`),
// so a game keeps the rules it was started with. The three here are the
// presets; the editor (GameSettings.jsx) makes others from them, kept on the
// device that made them or kept from a game played with them.

// Classic: one hand, finished from the hand, unscored; a pile that runs out
// is shuffled in again or ends the game. A ruleset without rounds plays it
// (game.js), as does a game from before rulesets, which has none.
export const CLASSIC = {
  id: "classic",
  name: "Okey",
  handSize: 14,
  rowSlots: 13,
  seats: 4,
  wrapRuns: true, // 12-13-1 is a run
};

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
  // score sheet values; lowest total after the last round wins; the okey
  // thrown as the last tile doubles everyone else's
  finishScore: -20, // shown as a line on the sheet
  notOpenedScore: 100,
  okeyInHandScore: 25,
  // out-of-turn takes allowed per player per round
  maxTakes: 3,
  // from this round on, a real tile can take an okey's place in a table meld
  okeySwapFromRound: 6,
  // a fifth player can sit in (14 × 5 + 1 dealt leaves 34 in the pile)
  seats: 5,
  // the others get this long to take the discard, from when the turn reached
  // the player who drew from the pile instead
  claimWaitSeconds: 8,
  // discarding a tile that fits a table meld (işler taş): whoever catches it
  // adds this to the discarder's round score, and nobody can take the tile
  catchPenalty: 20,
  wrapRuns: false, // runs stop at 13: 12-13-1 is classic only
  outOfTurnTakes: true, // anyone may claim the discard (maxTakes a round)
  swapOkeys: true, // a table okey can be traded for the tile it stands for
  buildWhenOpening: false, // lay more and add to melds only from next turn
  doubling: true, // the okey thrown last doubles the others' scores
};

// 101 Okey, as pagat.com has it (pagat.com/rummy/okey101.html): open with
// sets and runs worth 101 or more at face value, or with 5 pairs; the
// lowest total after 11 hands wins.
export const ONE_O_ONE = {
  id: "101",
  name: "101",
  handSize: 21,
  rowSlots: 15, // a rack row: 22 tiles want more room than 13
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
  // Eşli 101 Turnuvası's rules (medya.barobirlik.org.tr/barowebsite/uploads/
  // 52/kural1.pdf), on top of pagat's: a game started before keeps pagat's
  returnPenalty: 101, // taking the discard and putting it back
  catchUntilDraw: true, // a discard is caught before the next player draws
  takeCaught: true, // and, caught, the next player can still take it
  pairsAddMax: 2, // tiles a pairs opener adds to sets and runs a turn
  pairsForAll: true, // once someone opens with pairs, everyone lays pairs
  finishInOne: true, // open all but one tile at once and finish, under 101 too
  pileOutCounts: true, // a pile that runs out ends the hand, scored as usual
  notOpenedCounts: true, // not opening: 202 and the okeys held, doubled too
  // the table's choices when it starts: four in pairs across the table, the
  // finisher's partner paying nothing; doubling (katlamalı) a win with the
  // okey, with pairs or in one go, and a pairs opener's own score
  partners: false,
  doubling: false,
  // gösterge, which the PDF leaves out: the indicator's twin dropped on it
  // on your first turn takes this off your hand's score
  indicatorScore: -101,
  // a table okey goes to whoever holds its tile, once they've opened
  swapOkeys: true,
  okeySwapFromRound: null,
  buildWhenOpening: true,
};

export const PRESETS = [CLASSIC, AMERICANO, ONE_O_ONE];

// Turkish "3'lü", "5'li", "6'lı", "9'lu": by how the number ends
const SUFFIX = ["lu", "li", "li", "lü", "lü", "li", "lı", "li", "li", "lu"];
const KIND = { kut: "küt", seri: "seri" };

// a round's name from the melds that open it, as Americano's read
// ("2 × 3'lü küt", "3'lü küt + 3'lü seri", "4 çift"); Elden without any
export function roundName(melds) {
  const runs = [];
  for (const [type, size] of melds ?? []) {
    const last = runs.at(-1);
    if (last?.type === type && last.size === size) last.n++;
    else runs.push({ type, size, n: 1 });
  }
  return (
    runs
      .map(({ type, size, n }) =>
        type === "pair"
          ? `${n} çift`
          : `${n > 1 ? `${n} × ` : ""}${size}'${SUFFIX[size % 10]} ${KIND[type]}`,
      )
      .join(" + ") || "Elden"
  );
}

// the sizes a meld an opening asks for can be: a küt has four colours
export const SIZES = { kut: [3, 4], seri: [3, 13], pair: [2, 2] };
const whole = (n, lo, hi = Infinity) =>
  Number.isInteger(n) && n >= lo && n <= hi;

// What keeps a ruleset made in the editor from being played, or nothing:
// the rules read it without checking, at every table it's played at.
export function invalid(r) {
  // what game.js reads when a ruleset has none
  const { seats = 4, handSize = 14, rowSlots = 13, tileSets = 2 } = r;
  if (!r.name?.trim()) return "Give the rules a name";
  if (!whole(seats, 2, 8)) return "2 to 8 players";
  if (!whole(tileSets, 1, 4)) return "1 to 4 sets of tiles";
  // every hand, the starter's extra tile and the indicator, of 53 a set
  if (!whole(handSize, 2) || seats * handSize + 2 > 53 * tileSets) {
    return "Not enough tiles for those hands";
  }
  if (r.outOfTurnTakes && !whole(r.maxTakes, 1)) return "Fill in every number";
  // the hand, a draw and two tiles a take, with a gap to spare
  const most = handSize + 2 + (r.outOfTurnTakes ? 2 * r.maxTakes : 0);
  if (!whole(rowSlots, 2, 20) || most > 2 * rowSlots) {
    return "Make the rack's rows longer";
  }
  if (!r.rounds) return; // classic: one hand
  if (!whole(r.rounds.length, 1, 50)) return "1 to 50 rounds";
  const from = r.okeySwapFromRound;
  if (from != null && !whole(from, 1)) return "Fill in every number";
  if (r.opening) {
    const { points, pairs } = r.opening;
    if (!whole(points, 1) || !whole(pairs, 1, handSize / 2)) {
      return "Fill in every number";
    }
    return;
  }
  const bad = r.rounds.findIndex(
    ({ melds }) =>
      melds &&
      (!melds.length ||
        melds.some(
          ([type, size]) => !SIZES[type] || !whole(size, ...SIZES[type]),
        ) ||
        sum(melds.map(([, size]) => size)) > handSize),
  );
  if (bad >= 0) return `Round ${bad + 1} asks for more than a hand holds`;
}

// rulesets kept on this device (localStorage), in the order they were made
const KEPT = "okey-rulesets";
export function keptRulesets() {
  try {
    return JSON.parse(localStorage.getItem(KEPT)) ?? [];
  } catch {
    return [];
  }
}
function keep(list) {
  try {
    localStorage.setItem(KEPT, JSON.stringify(list));
  } catch {
    // blocked: not kept
  }
}
// a ruleset kept, or one of the same id replaced
export function keepRuleset(rules) {
  const list = keptRulesets();
  const i = list.findIndex((r) => r.id === rules.id);
  keep(i < 0 ? [...list, rules] : list.map((r, j) => (j === i ? rules : r)));
}
export const dropRuleset = (id) =>
  keep(keptRulesets().filter((r) => r.id !== id));
export const allRulesets = () => [...PRESETS, ...keptRulesets()];
