import { cloneDeep, maxBy, minBy, sortBy, sum } from "lodash";
import * as game from "./game";
import * as americano from "./americano";
import { colorOf, isOkey, rankOf } from "./melds";
import { colorMap } from "./constants";

// A bot: a seat whose user is { bot: true }, played by the page whose
// userKey it holds (OkeyContext), one move a step through the same rules as
// everyone, as a player who knows them: it takes the discard when it makes
// more melds (out of turn only for a new meld, as that costs a tile from
// the pile; in 101 only one it can use this turn), takes a table okey for
// its tile once opened, or before when that opens its hand, opens (101 with
// pairs when the points aren't there), lays and adds what it can, catches
// a tile thrown that fits the table (botCatches times in 100, decided once
// a tile: it's no hawk), shows the gösterge when it pays,
// finishes, and otherwise throws the tile that helps it least.
//
// It can slip: each chance it gets (a discard to take, a claim, a catch, an
// okey, an opening, the gösterge, the best tile to throw) it misses the
// rules' botMistakes times in 100, decided once per chance so a second look
// doesn't undo it. A game from before the setting: never (NaN).
const mistakesOf = (state) => state.rules.botMistakes / 100;

// the same answer for the same chance: a hash of what it is, 0 to 1
function chance(...key) {
  let h = 2166136261;
  for (const c of key.join("|")) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return (h >>> 0) / 2 ** 32;
}
const slips = (state, mistakes, ...key) =>
  chance(state.gameId, state.round, state.discards ?? 0, ...key) < mistakes;

// sits a bot in an empty seat, or in place of one who's gone (away), whose
// player sits back down when they're back; `runner` is the page playing it
export function seatBot(state, player, runner) {
  const seat = game.seat(state, player);
  if (!seat || seat.user) return;
  const s = cloneDeep(state);
  Object.assign(game.seat(s, player), {
    user: {
      id: `bot-${player}-${runner}`,
      name: `🤖 Bot ${player}`,
      bot: true,
    },
    userKey: runner,
  });
  return s;
}

const keyOf = (t, ind) => `${colorOf(t, ind)}|${rankOf(t, ind)}`;
const choose = (arr, k) =>
  k === 0
    ? [[]]
    : arr.flatMap((x, i) =>
        choose(arr.slice(i + 1), k - 1).map((c) => [x, ...c]),
      );

// Every meld the tiles could make, as the tile kinds it takes (colour|rank)
// and how many okeys: küts of 3–4 colours, seris of 3–13 in a row (12-13-1
// with `wrap`), okeys filling in for at most `okeys` tiles
function shapes(counts, okeys, wrap) {
  const out = [];
  const colors = [...new Set(Object.keys(counts).map((k) => k.split("|")[0]))];
  for (let rank = 1; rank <= 13; rank++) {
    const have = colors.filter((c) => counts[`${c}|${rank}`]);
    for (let mask = 1; mask < 1 << have.length; mask++) {
      const kinds = have
        .filter((_, i) => mask & (1 << i))
        .map((c) => `${c}|${rank}`);
      for (let j = 0; j <= okeys && kinds.length + j <= 4; j++) {
        if (kinds.length + j >= 3) {
          out.push({
            type: "kut",
            kinds,
            okeys: j,
            points: rank * (kinds.length + j),
          });
        }
      }
    }
  }
  const top = wrap ? 14 : 13;
  for (const c of colors) {
    for (let from = 1; from <= top - 2; from++) {
      for (let to = from + 2; to <= Math.min(top, from + 12); to++) {
        const ranks = Array.from({ length: to - from + 1 }, (_, i) => from + i);
        const kind = (r) => `${c}|${r === 14 ? 1 : r}`;
        const missing = ranks.filter((r) => !counts[kind(r)]);
        if (missing.length > okeys || missing.length === ranks.length) continue;
        // the tiles there, or an okey in place of some (kept for a küt)
        const held = ranks.filter((r) => counts[kind(r)]);
        const spare = okeys - missing.length;
        for (let m = 0; m <= Math.min(spare, held.length - 1); m++) {
          for (const swapped of choose(held, m)) {
            const used = held.filter((r) => !swapped.includes(r));
            const j = ranks.length - used.length;
            out.push({
              type: "seri",
              kinds: used.map(kind),
              okeys: j,
              ranks,
              used,
              points: sum(ranks.map((r) => (r === 14 ? 1 : r))),
            });
          }
        }
      }
    }
  }
  return out;
}

// The most tiles (or, by "points", the most points) in disjoint melds:
// { melds: [{ type, tiles }] in rack order, rest, covered, points }. The
// okeys stand where they're put, so a seri's are already in place.
export function bestMelds(tiles, ind, wrap, by = "tiles") {
  const okey = (t) => isOkey(t, ind);
  const counts = {};
  for (const t of tiles.filter((t) => !okey(t))) {
    counts[keyOf(t, ind)] = (counts[keyOf(t, ind)] ?? 0) + 1;
  }
  const okeys = tiles.filter(okey).length;
  const all = shapes(counts, okeys, wrap);
  const better = (a, b) =>
    by === "points"
      ? a.points - b.points || a.covered - b.covered
      : a.covered - b.covered || a.points - b.points;
  const memo = new Map();
  // the best from what's left: the first kind left in one of its melds, or
  // one of it left over
  function search(left, okeysLeft) {
    const first = Object.keys(left).find((k) => left[k]);
    if (!first) return { picks: [], covered: 0, points: 0 };
    const id = `${okeysLeft};${Object.entries(left)
      .filter(([, n]) => n)
      .map(([k, n]) => `${k}${n}`)
      .join()}`;
    if (memo.has(id)) return memo.get(id);
    let best = search({ ...left, [first]: left[first] - 1 }, okeysLeft);
    for (const shape of all) {
      if (!shape.kinds.includes(first) || shape.okeys > okeysLeft) continue;
      if (!shape.kinds.every((k) => left[k])) continue;
      const next = { ...left };
      for (const k of shape.kinds) next[k]--;
      const rest = search(next, okeysLeft - shape.okeys);
      const option = {
        picks: [shape, ...rest.picks],
        covered: rest.covered + shape.kinds.length + shape.okeys,
        points: rest.points + shape.points,
      };
      if (better(option, best) > 0) best = option;
    }
    memo.set(id, best);
    return best;
  }
  const found = search(counts, okeys);
  // back to the tiles themselves
  const pool = [...tiles];
  const take = (pred) => pool.splice(pool.findIndex(pred), 1)[0];
  const melds = found.picks.map((shape) => {
    if (shape.type === "kut") {
      return {
        type: "kut",
        tiles: [
          ...shape.kinds.map((k) =>
            take((t) => !okey(t) && keyOf(t, ind) === k),
          ),
          ...Array.from({ length: shape.okeys }, () => take(okey)),
        ],
      };
    }
    const c = shape.kinds[0].split("|")[0];
    return {
      type: "seri",
      tiles: shape.ranks.map((r) =>
        shape.used.includes(r)
          ? take(
              (t) => !okey(t) && keyOf(t, ind) === `${c}|${r === 14 ? 1 : r}`,
            )
          : take(okey),
      ),
    };
  });
  return { melds, rest: pool, covered: found.covered, points: found.points };
}

const hand = (state, player) => game.seat(state, player).hand.filter(Boolean);
const wrap = (state) => state.rules.wrapRuns;
const ok = (s) => (s && typeof s !== "string" ? s : null);

// The rack laid out as the melds, a gap after each and none across a row's
// end, then the rest: the rules that read the rack as it lies (101's
// opening, a finish from the hand) see the melds. Null if they don't fit.
function arrange(state, player, melds, rest) {
  const row = game.rowOf(state);
  const slots = Array(2 * row).fill(null);
  let i = 0;
  for (const { tiles } of melds) {
    if ((i % row) + tiles.length > row) i = Math.ceil(i / row) * row;
    if (i + tiles.length > 2 * row) return null;
    tiles.forEach((t, k) => (slots[i + k] = t));
    i += tiles.length;
    if (i % row) i++;
  }
  for (const t of rest) {
    const j = slots.indexOf(null, Math.min(i, 2 * row - 1));
    const at = j === -1 ? slots.indexOf(null) : j;
    if (at === -1) return null;
    slots[at] = t;
  }
  const s = cloneDeep(state);
  game.seat(s, player).hand = slots;
  return s;
}

// The copies of each kind still out of sight, as a player who remembers
// sees the table: all but those in their hand, the melds laid, every
// discard and the indicator (okeys are wild, of no kind)
function unseen(state, player) {
  const ind = state.okeyTile;
  const seen = {};
  for (const t of [
    ...hand(state, player),
    ...state.melds.flatMap((m) => m.tiles),
    ...state.players.flatMap((p) => p.discardPile),
    ind,
  ]) {
    if (!isOkey(t, ind)) seen[keyOf(t, ind)] = (seen[keyOf(t, ind)] ?? 0) + 1;
  }
  return (kind) => Math.max(0, state.rules.tileSets - (seen[kind] ?? 0));
}

// A tile's waits: the tiles it could make a meld with (same rank in another
// colour, or its colour within two), each while a tile that would make it
// three is still out of sight. A wait whose tiles are all out is dead,
// worth no more than a loose tile, so it's broken up. (Weighing waits by
// how many tiles are left played no better against bots that didn't.)
function live(t, tiles, state, left) {
  const ind = state.okeyTile;
  const [c, r] = [colorOf(t, ind), rankOf(t, ind)];
  const share = (kinds) => (kinds.some((k) => left(k) > 0) ? 1 : 0);
  const waits = (u) => {
    const [uc, ur] = [colorOf(u, ind), rankOf(u, ind)];
    if (ur === r) {
      if (uc === c) return 0;
      return share(
        Object.values(colorMap)
          .filter((x) => x !== c && x !== uc)
          .map((x) => `${x}|${r}`),
      );
    }
    const [lo, hi] = [Math.min(r, ur), Math.max(r, ur)];
    if (uc !== c || hi - lo > 2) return 0;
    if (hi - lo === 2) return share([`${c}|${lo + 1}`]);
    const ends = [lo - 1, hi + 1 === 14 && wrap(state) ? 1 : hi + 1];
    return share(ends.filter((x) => x >= 1 && x <= 13).map((x) => `${c}|${x}`));
  };
  return sum(tiles.filter((u) => u !== t && !isOkey(u, ind)).map(waits));
}

// a round opened with pairs (Americano's 4 çift) this bot hasn't opened:
// twins are what it keeps
const pairing = (state, player) =>
  americano.pairRound(state) && !state.opened?.[player];
const twinned = (t, tiles, ind) =>
  tiles.some(
    (u) => u !== t && !isOkey(u, ind) && keyOf(u, ind) === keyOf(t, ind),
  );

// What a partner is worth against a tile's points, when throwing: while
// the hand would count only once opened, everything; once it counts (or in
// a hand finished from the rack), less the nearer the round's end, as the
// pile runs down or someone gets close to finishing (how many tiles each
// holds is there for all to see)
function partnerWorth(state, player) {
  const counts =
    americano.isElden(state) ||
    state.opened?.[player] ||
    state.rules.notOpenedHand;
  if (!counts) return 100;
  const fewest = Math.min(
    ...state.players
      .filter((p) => p.id !== player)
      .map((p) => p.hand.filter(Boolean).length),
  );
  return 2 + Math.min(state.drawPile.length / 6, fewest);
}

// the tile that helps least: outside the best melds (without a twin, when
// pairing), with the deadest waits (live; pairing, its twin's copies out of
// sight), the highest first (partnerWorth); never an okey while there's
// another, nor a tile that fits a meld on the table (işler taş: caught, it
// costs catchPenalty) while there's another loose one
function worst(state, player, mistakes) {
  const tiles = hand(state, player);
  const ind = state.okeyTile;
  const plain = tiles.filter((t) => !isOkey(t, ind));
  if (!plain.length) return tiles[0];
  const worth = partnerWorth(state, player);
  const left = unseen(state, player);
  const waits = pairing(state, player)
    ? (t) => (left(keyOf(t, ind)) > 0 ? 1 : 0)
    : (t) => live(t, tiles, state, left);
  const score = (t) => waits(t) * worth - rankOf(t, ind);
  // a slip: the next best, the table not minded
  const slip = slips(state, mistakes, player, "throw");
  const least = (pool) => {
    if (slip) return sortBy(pool, score)[1] ?? pool[0];
    const safe = pool.filter((t) => !americano.fitsTable(state, t));
    return minBy(safe.length ? safe : pool, score);
  };
  if (pairing(state, player)) {
    const single = plain.filter((t) => !twinned(t, tiles, ind));
    return least(single.length ? single : plain);
  }
  const { rest } = bestMelds(tiles, ind, wrap(state));
  let pool = rest.filter((t) => !isOkey(t, ind));
  if (!pool.length) {
    // every tile in a meld: one the melds miss least
    const without = (t) =>
      bestMelds(
        tiles.filter((u) => u !== t),
        ind,
        wrap(state),
      ).covered;
    const most = without(maxBy(plain, without));
    pool = plain.filter((t) => without(t) === most);
  }
  return least(pool);
}

// how many more tiles `tile` puts in melds (a twin, when pairing, as a
// new meld of two)
function gain(state, player, tile) {
  const tiles = hand(state, player);
  const ind = state.okeyTile;
  if (pairing(state, player)) return twinned(tile, tiles, ind) ? 2 : 0;
  return (
    bestMelds([...tiles, tile], ind, wrap(state)).covered -
    bestMelds(tiles, ind, wrap(state)).covered
  );
}

// 101: a discard taken goes into a meld this turn, laid (opened) or opened
// with
function usable(state, player, tile) {
  const tiles = [...hand(state, player), tile];
  const has = ({ melds }) => melds.some((m) => m.tiles.includes(tile));
  if (state.opened?.[player]) {
    return has(bestMelds(tiles, state.okeyTile, wrap(state)));
  }
  if (!americano.roundOf(state).opening) return false;
  const best = bestMelds(tiles, state.okeyTile, wrap(state), "points");
  return best.points >= americano.pointsToOpen(state) && has(best);
}

// 101: the discard just taken leaves the hand as the turn plays on (no
// slips), not put back: one that's put back would be taken again, +101 a
// time (usable() can say yes to a meld a pairs opener can't lay)
function uses(state, player, now) {
  const id = state.tookDiscard.tileId;
  let s = state;
  for (let i = 0; s?.drawn && i < 30; i++) {
    if (!hand(s, player).some((t) => t.id === id)) return true;
    s = ok(step(s, player, now, 0));
  }
  return false;
}

function draw(state, player, now, mistakes) {
  const slot = Math.max(0, game.seat(state, player).hand.indexOf(null));
  const top = game.previous(state.players, player).discardPile.at(-1);
  const wanted =
    top &&
    (state.rules.takeMustBeUsed
      ? usable(state, player, top)
      : gain(state, player, top) > 0);
  if (wanted && !slips(state, mistakes, player, "take")) {
    const took = ok(americano.drawTile(state, player, top, slot, now));
    if (took && (!state.rules.takeMustBeUsed || uses(took, player, now))) {
      return took;
    }
  }
  return americano.drawTile(state, player, state.drawPile.at(-1), slot, now);
}

// Out of turn, the discard up for claim (americano.claimDiscard), when it
// makes a new meld: a take costs a tile from the pile, so one that only
// lengthens a meld isn't worth it. Undefined when it lets it go or has
// already claimed it.
export function claim(state, player, mistakes = mistakesOf(state)) {
  const offer = americano.upForClaim(state);
  const seat = game.seat(state, player);
  if (!offer || seat.claim?.id === offer.id) return;
  if (player === state.currentPlayer || player === offer.from) return;
  if ((state.takes?.[player] ?? 0) >= state.rules.maxTakes) return;
  const tile = game.seat(state, offer.from).discardPile.at(-1);
  if (tile?.id !== offer.tileId || gain(state, player, tile) < 2) return;
  if (slips(state, mistakes, player, "claim", offer.id)) return;
  return ok(americano.claimDiscard(state, player, seat.hand.indexOf(null)));
}

// Out of turn too: the tile just thrown, when it fits the table (işler
// taş), caught, its thrower paying for it (americano.catchDiscard)
export function catchTile(state, player, mistakes = mistakesOf(state)) {
  if (state.gameState !== "play" || !state.discardFits) return;
  if (state.players.some((p) => p.caught?.includes(state.lastDiscard))) return;
  const { gameId, round, discards, lastDiscard, rules } = state;
  const odds = chance(gameId, round, discards ?? 0, player, "eye", lastDiscard);
  if (!(odds < rules.botCatches / 100)) return;
  if (slips(state, mistakes, player, "catch", state.lastDiscard)) return;
  return ok(americano.catchDiscard(state, player));
}

function open(state, player) {
  const { melds, opening } = americano.roundOf(state);
  const all = hand(state, player).map((t) => t.id);
  if (melds?.some(([type]) => type === "pair")) {
    return americano.openHand(state, player, [all], true);
  }
  if (melds) return americano.openAll(state, player);
  if (!opening) return;
  const best = bestMelds(
    hand(state, player),
    state.okeyTile,
    wrap(state),
    "points",
  );
  // 101: the points, or as many pairs as it takes
  if (best.points < americano.pointsToOpen(state)) {
    const ind = state.okeyTile;
    const twins = hand(state, player).filter(
      (t) => !isOkey(t, ind) && twinned(t, hand(state, player), ind),
    );
    if (twins.length / 2 < opening.pairs) return;
    return americano.openHand(state, player, [all], true);
  }
  const s = arrange(state, player, best.melds, best.rest);
  const ids = best.melds.flatMap((m) => m.tiles.map((t) => t.id));
  return s && americano.openHand(s, player, [ids], false);
}

// Before opening, a table okey for the tile it stands for, when the okey
// then opens the hand (an okey taken must open it or go back); once
// opened, add() trades one as it goes (americano.playOnMeld)
function takeOkey(state, player) {
  for (let i = 0; i < state.melds.length; i++) {
    for (const t of hand(state, player)) {
      const s = ok(americano.swapOkey(state, player, t.id, i));
      if (s && ok(open(s, player))) return s;
    }
  }
}

// 101's gösterge, when it scores for the bot (a minus)
function showIndicator(state, player) {
  if (!(state.rules.indicatorScore < 0) || state.indicatorShown) return;
  const kind = state.okeyTile.id.split("-")[0];
  const twin = hand(state, player).find((t) => t.id.split("-")[0] === kind);
  return twin && americano.showIndicator(state, player, twin.id);
}

// sets and runs from the rack, keeping a tile to finish with
function lay(state, player) {
  if (state.openedWithPairs?.[player]) return layPairs(state, player);
  const { melds, rest } = bestMelds(
    hand(state, player),
    state.okeyTile,
    wrap(state),
  );
  const laid = rest.length ? melds : melds.slice(0, -1);
  if (!laid.length) return;
  return americano.layMelds(
    state,
    player,
    laid.map((m) => m.tiles.map((t) => t.id)),
  );
}

// opened with pairs: more pairs, which is all such a player lays
function layPairs(state, player) {
  const tiles = hand(state, player).filter((t) => !isOkey(t, state.okeyTile));
  const pairs = [];
  const left = [...tiles];
  while (left.length) {
    const t = left.shift();
    const i = left.findIndex(
      (u) => keyOf(u, state.okeyTile) === keyOf(t, state.okeyTile),
    );
    if (i >= 0) pairs.push([t.id, left.splice(i, 1)[0].id]);
  }
  const all = pairs.length * 2 === hand(state, player).length;
  const laid = all ? pairs.slice(0, -1) : pairs;
  return laid.length ? americano.layMelds(state, player, laid) : undefined;
}

// a tile onto a meld on the table, at either end
function add(state, player) {
  const ind = state.okeyTile;
  for (const t of hand(state, player).filter((t) => !isOkey(t, ind))) {
    for (let i = 0; i < state.melds.length; i++) {
      for (const atEnd of [true, false]) {
        const s = ok(americano.playOnMeld(state, player, t.id, i, atEnd));
        if (s) return s;
      }
    }
  }
}

// its okeys onto the table's melds once all it holds but one tile are
// okeys: the last one then finishes (add() keeps okeys for its own melds,
// and so kept one till someone else won, okeyInHandScore)
function addOkey(state, player) {
  const ind = state.okeyTile;
  const tiles = hand(state, player);
  const okeys = tiles.filter((t) => isOkey(t, ind));
  if (!okeys.length || tiles.length < 2 || tiles.length - okeys.length > 1) {
    return;
  }
  for (let i = 0; i < state.melds.length; i++) {
    for (const atEnd of [true, false]) {
      const s = ok(americano.playOnMeld(state, player, okeys[0].id, i, atEnd));
      if (s) return s;
    }
  }
}

// A finish from the hand (Elden): every tile but one in melds, laid out on
// the rack, and that one thrown to the middle
function finishFromHand(state, player) {
  if (!americano.isElden(state)) return;
  const best = bestMelds(hand(state, player), state.okeyTile, wrap(state));
  if (best.rest.length !== 1) return;
  const s = arrange(state, player, best.melds, best.rest);
  return s && americano.finishGame(s, player, best.rest[0]);
}

// The rack as a player keeps it, laid out as the turn ends: the melds it
// has, a gap after each, then the rest by colour and number, so the hands
// shown at the round's end read as it saw them
function tidy(state, player) {
  const ind = state.okeyTile;
  const { melds, rest } = bestMelds(hand(state, player), ind, wrap(state));
  const sorted = sortBy(rest, [
    (t) => isOkey(t, ind),
    (t) => colorOf(t, ind),
    (t) => rankOf(t, ind),
  ]);
  return arrange(state, player, melds, sorted) ?? state;
}

const throwTile = (state, player, now, mistakes) =>
  americano.discardTile(state, player, worst(state, player, mistakes), now);

// One move of the bot whose turn it is, through the rules: a new state, or
// a message (nothing it may do yet: the others' time to take the discard).
// `mistakes`: how often it slips (the rules' botMistakes; 0 plays its
// best).
export function step(
  state,
  player,
  now = Date.now(),
  mistakes = mistakesOf(state),
) {
  if (state.gameState !== "play" || state.currentPlayer !== player) return;
  if (game.pileOut(state, player)) return game.shuffleDiscards(state, player);
  const slip = (what) => slips(state, mistakes, player, what);
  const shown = !slip("gösterge") && ok(showIndicator(state, player));
  if (shown) return shown;
  if (!state.drawn) return draw(state, player, now, mistakes);
  const tiles = hand(state, player);
  const opened = state.opened?.[player];
  // a discard taken to open with (101) opens: the same slip each time it's
  // taken would put it back, +101, and take it again, on and on
  const took =
    state.rules.takeMustBeUsed && state.tookDiscard?.player === player;
  const opening =
    !americano.isElden(state) && !opened && (took || !slip("open"));
  return (
    ok(finishFromHand(state, player)) ||
    (opening && ok(open(state, player))) ||
    (opening && ok(takeOkey(state, player))) ||
    (opened && ok(lay(state, player))) ||
    (opened && ok(add(state, player))) ||
    (tiles.length === 1 && ok(americano.finishGame(state, player, tiles[0]))) ||
    (opened && ok(addOkey(state, player))) ||
    // 101: a discard it took and couldn't use goes back
    (took && ok(americano.returnDiscard(state, player))) ||
    throwTile(tidy(state, player), player, now, mistakes)
  );
}
