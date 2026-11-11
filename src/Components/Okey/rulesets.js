import { sum } from "lodash";

// Rulesets: a game's rounds, numbers and switches, stored in its state
// (`rules`), so a game keeps the rules it was started with. The three here
// are the presets; the editor (GameSettings.jsx) makes others from them,
// kept on the device that made them or kept from a game played with them.
// Each round opens its own way: with `melds` (Americano's), with an
// `opening` of points or pairs (101's), or neither, finished from the hand
// (Elden, classic).

// a round that opens with sets and runs worth `points`, or `pairs` pairs
export const pointsRound = (opening) => ({
  name: `${opening.points}`,
  opening,
});

// Every setting a ruleset has, each preset's unless it says otherwise:
// every switch off, the score sheet Americano's. A new setting gets a key
// here; a line in GameSettings.jsx's groups saying in full what it does (no
// tooltips: the text is the explanation), with its Turkish, under the switch
// it hangs on, and in "The table" if the deal or the seats are laid out by
// it (those can't change mid-game); and a check in `invalid` when a bad
// value would break the rules at every table playing it.
// No setting scores the gösterge: it scores nothing in any game, 101 as the
// PDF has it (a -101 for showing its twin was invented, and taken out) and
// classic too, though many tables play gösterme (the user's call); it's
// never a pair either.
export const DEFAULTS = {
  seats: 4,
  tileSets: 2,
  handSize: 14, // the starter gets one more
  rowSlots: 13, // a rack row
  rounds: [{ name: "Elden", melds: null }],
  partners: false,
  doubling: false,
  finishDoubled: false,
  outOfTurnTakes: false,
  maxTakes: 3, // out-of-turn takes a player has a round
  claimWaitSeconds: 8,
  takeMustBeUsed: false,
  buildWhenOpening: false,
  swapOkeys: false,
  okeySwapFromRound: null, // a table okey taken only once you've opened
  catchUntilDraw: false,
  catchWaitSeconds: 6, // before the next player may take the discard
  takeCaught: false,
  peekPairRounds: false,
  peekWithPairs: false,
  pairsForAll: false,
  pairsAddMax: 0, // no limit
  finishInOne: false,
  // katlamalı, the table's to tick: an opening with points beats the
  // highest so far that hand (not in the PDF; not `doubling`, its score
  // multipliers)
  raiseOpening: false,
  reshuffle: false,
  pileOutCounts: false,
  notOpenedHand: false,
  notOpenedCounts: false,
  wrapRuns: false,
  // the score sheet: lowest total after the last round wins
  finishScore: -20,
  notOpenedScore: 100,
  okeyInHandScore: 25,
  // discarding a tile that fits a table meld (işler taş): whoever catches
  // it adds this to the discarder's round score
  catchPenalty: 20,
  okeyDiscardPenalty: 0,
  returnPenalty: 0,
  // bots (bot.js): times in 100 one misses a good move
  botMistakes: 0,
  botCatches: 30, // times in 100 one catches a tile it could
};

// Classic: one hand, finished from the hand; a pile that runs out is
// shuffled in again, or the hand dealt again
export const CLASSIC = {
  ...DEFAULTS,
  id: "classic",
  name: "Okey",
  wrapRuns: true, // 12-13-1 is a run
  reshuffle: true, // the discards make a new pile
};

// Americano: 13 rounds, each with its own opening (el açma) requirement.
export const AMERICANO = {
  ...DEFAULTS,
  id: "americano",
  name: "Americano",
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
  outOfTurnTakes: true, // anyone may claim the discard (maxTakes a round)
  swapOkeys: true, // a table okey can be traded for the tile it stands for
  // from this round on, before opening too
  okeySwapFromRound: 6,
  doubling: true, // the okey thrown last doubles the others' scores
  pileOutCounts: true, // a pile that runs out ends the round, scored
  // the pair round's discards can be looked through: the user's house rule
  peekPairRounds: true,
};

// 101 Okey, as pagat.com has it (pagat.com/rummy/okey101.html), with the
// Eşli 101 Turnuvası's rules on top (medya.barobirlik.org.tr/barowebsite/
// uploads/52/kural1.pdf): open with sets and runs worth 101 or more at face
// value, or with 5 pairs; the lowest total after 11 hands wins. Partners
// (eşli) are the table's to tick.
export const ONE_O_ONE = {
  ...DEFAULTS,
  id: "101",
  name: "101",
  handSize: 21,
  rowSlots: 15, // a rack row: 22 tiles want more room than 13
  // the same opening every hand
  rounds: Array(11).fill(pointsRound({ points: 101, pairs: 5 })),
  // a pairs opener scores double, and lays only pairs (or adds to the
  // table's sets and runs); a win with pairs, in one go or by discarding
  // the okey doubles every score, the finisher's too, each (a player who
  // didn't open pays at most twice notOpenedScore)
  doubling: true,
  finishDoubled: true,
  finishScore: -101,
  notOpenedScore: 202,
  notOpenedCounts: true, // and the okeys held, doubled too
  okeyInHandScore: 101,
  // işler taş, caught with the Catch button until the next discard, as in
  // Americano (the PDF: until the next player draws; the user's call)
  catchPenalty: 101,
  // and, caught, the next player can still take it (the user's call;
  // Americano's can't)
  takeCaught: true,
  okeyDiscardPenalty: 101, // discarding the okey, unless it's your last tile
  // the previous discard can be taken only to use it in a meld that turn,
  // or put back for this
  takeMustBeUsed: true,
  returnPenalty: 101,
  pairsAddMax: 2, // tiles a pairs opener adds to sets and runs a turn
  pairsForAll: true, // once someone opens with pairs, everyone lays pairs
  // and anyone can look through the discards (the user's call: the PDF
  // lets only the pairs opener)
  peekWithPairs: true,
  finishInOne: true, // open all but one tile at once and finish, under 101 too
  pileOutCounts: true, // a pile that runs out ends the hand, scored as usual
  // a table okey goes to whoever holds its tile, once they've opened
  swapOkeys: true,
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

// Rack rows of `slots` hold the most a hand can: the hand, a draw and two
// tiles a take, with a gap to spare
export const rowFits = (r, slots) =>
  whole(slots, 2, 20) &&
  r.handSize + 2 + (r.outOfTurnTakes ? 2 * r.maxTakes : 0) <= 2 * slots;

// What keeps a ruleset made in the editor from being played, or nothing:
// the rules read it without checking, at every table it's played at.
export function invalid(r) {
  const { seats, handSize, rowSlots, tileSets } = r;
  if (!r.name?.trim()) return "Give the rules a name";
  if (!whole(seats, 2, 8)) return "2 to 8 players";
  if (!whole(tileSets, 1, 4)) return "1 to 4 sets of tiles";
  // every hand, the starter's extra tile and the indicator, of 53 a set
  if (!whole(handSize, 2) || seats * handSize + 2 > 53 * tileSets) {
    return "Not enough tiles for those hands";
  }
  if (r.outOfTurnTakes && !whole(r.maxTakes, 1)) return "Fill in every number";
  if (!rowFits(r, rowSlots)) return "Make the rack's rows longer";
  if (!whole(r.rounds?.length, 1, 50)) return "1 to 50 rounds";
  const from = r.okeySwapFromRound;
  if (from != null && !whole(from, 1)) return "Fill in every number";
  const open = r.rounds.map((round) => round.opening).filter(Boolean);
  if (open.some(({ points, pairs }) => !whole(points, 1) || !whole(pairs, 1))) {
    return "Fill in every number";
  }
  const bad = r.rounds.findIndex(({ melds, opening }) =>
    opening
      ? opening.pairs * 2 > handSize
      : melds &&
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
    // made before a setting was: as if it had it off
    return (JSON.parse(localStorage.getItem(KEPT)) ?? []).map((r) => ({
      ...DEFAULTS,
      ...r,
    }));
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
