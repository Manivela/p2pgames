import { cloneDeep, maxBy, minBy, sum } from "lodash";
import * as game from "./game";
import * as americano from "./americano";
import { colorOf, isOkey, rankOf } from "./melds";

// A bot: a seat whose user is { bot: true }, played by the page whose
// userKey it holds (OkeyContext), one move a step through the same rules as
// everyone. It plays plainly: takes the discard when it makes more melds
// (out of turn only for a new meld, as that costs a tile from the pile),
// opens, lays and adds what it can, finishes, and otherwise throws the tile
// that helps it least. It doesn't catch, show the indicator, or open 101
// with pairs.

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

// what a tile could still make a meld with: same rank in other colours,
// or its colour within two
function partners(t, tiles, ind) {
  return tiles.filter(
    (u) =>
      u !== t &&
      !isOkey(u, ind) &&
      (rankOf(u, ind) === rankOf(t, ind)
        ? colorOf(u, ind) !== colorOf(t, ind)
        : colorOf(u, ind) === colorOf(t, ind) &&
          Math.abs(rankOf(u, ind) - rankOf(t, ind)) <= 2),
  ).length;
}

// a round opened with pairs (Americano's 4 çift) this bot hasn't opened:
// twins are what it keeps
const pairing = (state, player) =>
  americano.pairRound(state) && !state.opened?.[player];
const twinned = (t, tiles, ind) =>
  tiles.some(
    (u) => u !== t && !isOkey(u, ind) && keyOf(u, ind) === keyOf(t, ind),
  );

// the tile that helps least: outside the best melds (without a twin, when
// pairing), with the fewest partners, the highest first; never an okey
// while there's another
function worst(state, player) {
  const tiles = hand(state, player);
  const ind = state.okeyTile;
  const plain = tiles.filter((t) => !isOkey(t, ind));
  if (!plain.length) return tiles[0];
  const least = (pool) =>
    minBy(pool, (t) => partners(t, tiles, ind) * 100 - rankOf(t, ind));
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

function draw(state, player, now) {
  const slot = Math.max(0, game.seat(state, player).hand.indexOf(null));
  const top = game.previous(state.players, player).discardPile.at(-1);
  if (top && !state.rules.takeMustBeUsed && gain(state, player, top) > 0) {
    const took = ok(americano.drawTile(state, player, top, slot, now));
    if (took) return took;
  }
  return americano.drawTile(state, player, state.drawPile.at(-1), slot, now);
}

// Out of turn, the discard up for claim (americano.claimDiscard), when it
// makes a new meld: a take costs a tile from the pile, so one that only
// lengthens a meld isn't worth it. Undefined when it lets it go or has
// already claimed it.
export function claim(state, player) {
  const offer = americano.upForClaim(state);
  const seat = game.seat(state, player);
  if (!offer || seat.claim?.id === offer.id) return;
  if (player === state.currentPlayer || player === offer.from) return;
  if ((state.takes?.[player] ?? 0) >= state.rules.maxTakes) return;
  const tile = game.seat(state, offer.from).discardPile.at(-1);
  if (tile?.id !== offer.tileId || gain(state, player, tile) < 2) return;
  return ok(americano.claimDiscard(state, player, seat.hand.indexOf(null)));
}

function open(state, player) {
  const { melds, opening } = americano.roundOf(state);
  if (melds?.some(([type]) => type === "pair")) {
    const ids = hand(state, player).map((t) => t.id);
    return americano.openHand(state, player, [ids], true);
  }
  if (melds) return americano.openAll(state, player);
  const best = bestMelds(
    hand(state, player),
    state.okeyTile,
    wrap(state),
    "points",
  );
  if (best.points < americano.pointsToOpen(state) || !opening) return;
  const s = arrange(state, player, best.melds, best.rest);
  const ids = best.melds.flatMap((m) => m.tiles.map((t) => t.id));
  return s && americano.openHand(s, player, [ids], false);
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

// A finish from the hand (Elden): every tile but one in melds, laid out on
// the rack, and that one thrown to the middle
function finishFromHand(state, player) {
  if (!americano.isElden(state)) return;
  const best = bestMelds(hand(state, player), state.okeyTile, wrap(state));
  if (best.rest.length !== 1) return;
  const s = arrange(state, player, best.melds, best.rest);
  return s && americano.finishGame(s, player, best.rest[0]);
}

// One move of the bot whose turn it is, through the rules: a new state, or
// a message (nothing it may do yet: the others' time to take the discard)
export function step(state, player, now = Date.now()) {
  if (state.gameState !== "play" || state.currentPlayer !== player) return;
  if (game.pileOut(state, player)) return game.shuffleDiscards(state, player);
  if (!state.drawn) return draw(state, player, now);
  const tiles = hand(state, player);
  const opened = state.opened?.[player];
  return (
    ok(finishFromHand(state, player)) ||
    (!americano.isElden(state) && !opened && ok(open(state, player))) ||
    (opened && ok(lay(state, player))) ||
    (opened && ok(add(state, player))) ||
    (tiles.length === 1 && ok(americano.finishGame(state, player, tiles[0]))) ||
    americano.discardTile(state, player, worst(state, player), now)
  );
}
