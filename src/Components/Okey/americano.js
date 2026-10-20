import { cloneDeep, sum } from "lodash";
import * as game from "./game";
import {
  colorOf,
  isOkey,
  meldOrder,
  okeyStandsFor,
  rankOf,
  splitMelds,
} from "./melds";
import { AMERICANO } from "./rulesets";

// Americano: 13 rounds, each with its own opening (el açma) requirement;
// 101 Okey: open with 101 points or 5 pairs. Same shape as game.js:
// (state, player, ...args) => new state | message. The numbers and
// switches come from the game's ruleset (state.rules, rulesets.js).

const { seat, roundOver } = game;
const tableTile = (tile) => ({ ...tile, source: "table", hidden: false });
const isElden = (state) => state.rules.rounds[state.round - 1].melds === null;
const wrap = (state) => state.rules.wrapRuns;
const pairsOf = (tiles) => Array(tiles.length / 2).fill(["pair", 2]);

export function startGame(state, deal, rules = AMERICANO) {
  const s = game.startGame({ ...state, rules }, deal);
  if (s.gameState !== "play") return s;
  return {
    ...s,
    round: 1,
    scores: {},
    melds: [],
    opened: {},
    openedWithPairs: {},
    justOpened: null,
    offer: null,
    takes: {},
    penalties: {},
    replay: false,
    tookDiscard: null,
    tookOkey: null,
  };
}

// Deals every seat in the game, sat in or not: its player can sit back down
// (a phone that slept) or a friend take over, and the seat is scored either
// way. A seat freed from the menu (left) is out until someone sits in it.
// Someone who sits in a new seat starts level with whoever is losing.
export function nextRound(state, deal) {
  if (state.gameState !== "roundEnd") return;
  const players = state.players.filter(
    (p) => p.user || (state.scores[p.id] && !p.left),
  );
  if (players.length < 2) return "not enough players to start the game";
  const totals = players
    .filter((p) => state.scores[p.id])
    .map((p) => sum(state.scores[p.id]));
  const worst = totals.length ? Math.max(...totals) : 0;
  const scores = { ...state.scores };
  for (const p of players) {
    if (!scores[p.id])
      scores[p.id] = [...Array(state.round - 1).fill(null), worst];
  }
  // a 101 hand nobody finished is dealt again by the same player
  const round = state.replay ? state.round : state.round + 1;
  return game.dealRound(
    {
      ...state,
      players,
      scores,
      round,
      melds: [],
      opened: {},
      openedWithPairs: {},
      justOpened: null,
      offer: null,
      takes: {},
      penalties: {},
      replay: false,
    },
    game.shuffledPile(),
    deal,
    (round - 1) % players.length,
  );
}

// Picks a game up from anywhere: a fresh deal at `round`, with each seated
// player's total so far (in the row before that round) and `starter` to
// play first.
export function setUp(state, round, totals, starter, rules = AMERICANO) {
  const s = startGame(state, undefined, rules);
  if (s.gameState !== "play") return s.message;
  const carried = (id) =>
    round > 1 ? [...Array(round - 2).fill(null), Number(totals[id]) || 0] : [];
  return game.dealRound(
    {
      ...s,
      round,
      scores: Object.fromEntries(s.players.map((p) => [p.id, carried(p.id)])),
    },
    game.shuffledPile(),
    undefined,
    Math.max(
      0,
      s.players.findIndex((p) => p.id === starter),
    ),
  );
}

const KEEP = "Keep a tile to discard";

// Takes the groups (arrays of tile ids) out of the player's hand on their
// turn. Returns [newState, groups of tiles] or a message.
function takeFromHand(state, player, groups) {
  if (roundOver(state)) return roundOver(state);
  if (state.currentPlayer !== player) return "Not your turn";
  if (!state.drawn) return "Draw a tile first";
  const ids = groups.flat();
  const hand = seat(state, player).hand;
  if (
    !ids.length ||
    new Set(ids).size !== ids.length ||
    !ids.every((id) => hand.some((t) => t?.id === id))
  ) {
    return "Select tiles from your rack";
  }
  if (hand.filter(Boolean).length - ids.length < 1) return KEEP;
  const s = cloneDeep(state);
  const me = seat(s, player);
  const tiles = groups.map((g) =>
    g.map((id) => hand.find((t) => t?.id === id)),
  );
  me.hand = me.hand.map((t) => (t && ids.includes(t.id) ? null : t));
  return [s, tiles];
}

function canBuild(state, player) {
  if (isElden(state)) return "No laying down this round: finish from your hand";
  if (!state.opened[player]) return "Open your hand first";
  if (state.justOpened === player && !state.rules.buildWhenOpening) {
    return "You can lay more from next turn";
  }
}

// A meld's points: each tile at face value, an okey as the tile it stands
// for where it sits
const points = (meld, ind) =>
  sum(
    meld.tiles.map((t, i) =>
      isOkey(t, ind) ? okeyStandsFor(meld, i, ind).rank : rankOf(t, ind),
    ),
  );

// The sets and runs a row of picked tiles makes as it lies on the rack (an
// okey counts where it stands), the most points it can; a tile that fits
// none stays on the rack.
function asLaid(row, ind) {
  const best = [{ total: 0, melds: [] }]; // for the row up to each tile
  row.forEach((_, i) => {
    const keep = (j, total, melds) => {
      if (!best[j] || total > best[j].total) best[j] = { total, melds };
    };
    keep(i + 1, best[i].total, best[i].melds); // tile i stays
    for (let j = i + 3; j <= row.length; j++) {
      const g = row.slice(i, j);
      const seri = meldOrder(g, "seri", ind, false);
      const kut = !seri && meldOrder(g, "kut", ind);
      const meld = seri
        ? { type: "seri", tiles: seri }
        : kut && { type: "kut", tiles: kut };
      if (meld) {
        keep(j, best[i].total + points(meld, ind), [...best[i].melds, meld]);
      }
    }
  });
  return best[row.length];
}

// 101's opening: sets and runs as laid out on the rack (a gap or a tile
// left out separates them, and an okey counts where it stands) worth
// `points`, or `pairs` pairs or more anywhere on the rack; picked tiles
// that make neither stay on the rack. Returns [melds, with pairs] or null.
function openingOf(state, player, ids) {
  const { okeyTile: ind, rules } = state;
  const hand = seat(state, player).hand;
  const at = ids
    .map((id) => hand.findIndex((t) => t?.id === id))
    .sort((a, b) => a - b);
  const groups = [];
  at.forEach((i, k) => {
    if (k === 0 || i !== at[k - 1] + 1 || i === 13) groups.push([]);
    groups.at(-1).push(hand[i]);
  });
  const laid = groups.map((g) => asLaid(g, ind));
  if (sum(laid.map((l) => l.total)) >= rules.opening.points) {
    return [laid.flatMap((l) => l.melds), false];
  }
  // as many pairs as there are
  const tiles = groups.flat();
  for (let n = Math.floor(tiles.length / 2); n >= rules.opening.pairs; n--) {
    const pairs = splitMelds(
      tiles,
      ind,
      Array(n).fill(["pair", 2]),
      false,
      true,
    );
    if (pairs) return [pairs, true];
  }
  return null;
}

export function openHand(state, player, groups) {
  const { rules } = state;
  const required = rules.rounds[state.round - 1].melds;
  if (required === null) {
    return "No opening this round: finish from your hand";
  }
  if (state.opened[player]) return "You've already opened";
  const picked = takeFromHand(state, player, groups);
  if (typeof picked === "string" && picked !== KEEP) return picked;
  const hand = seat(state, player).hand;
  const tiles = groups.flat().map((id) => hand.find((t) => t?.id === id));

  // Americano: the required melds, out of the picked tiles wherever they sit
  // on the rack; picked tiles left over stay on the rack
  const [melds, pairs] = rules.opening
    ? (openingOf(state, player, groups.flat()) ?? [])
    : [splitMelds(tiles, state.okeyTile, required, wrap(state), true), false];
  if (!melds) {
    return rules.opening
      ? `Open with ${rules.opening.points}+ or ${rules.opening.pairs} pairs`
      : `Open with exactly: ${rules.rounds[state.round - 1].name}`;
  }
  const taken = takeFromHand(state, player, [
    melds.flatMap((m) => m.tiles.map((t) => t.id)),
  ]);
  if (typeof taken === "string") return taken;
  const [s] = taken;
  lay(s, player, melds, groups.flat());
  game.logMove(
    s,
    player,
    "opened",
    melds.flatMap((m) => m.tiles),
  );
  s.opened = { ...s.opened, [player]: true };
  if (pairs) s.openedWithPairs = { ...s.openedWithPairs, [player]: true };
  s.justOpened = player;
  return s;
}

// puts the new melds on the table, in the order their tiles were picked
function lay(s, player, melds, ids) {
  const first = (m) => Math.min(...m.tiles.map((t) => ids.indexOf(t.id)));
  const table = [...melds]
    .sort((a, b) => first(a) - first(b))
    .map(({ type, tiles }) => ({
      type,
      owner: player,
      tiles: tiles.map(tableTile),
    }));
  s.melds = [...s.melds, ...table];
}

export function layMelds(state, player, groups) {
  const blocked = canBuild(state, player);
  if (blocked) return blocked;
  const taken = takeFromHand(state, player, groups);
  if (typeof taken === "string") return taken;
  const [s, tiles] = taken;

  // whoever opened with pairs (101) lays only pairs (and adds to sets and
  // runs); the others lay pairs only in a round that opens with them
  const flat = tiles.flat();
  if (s.openedWithPairs?.[player]) {
    const pairs =
      flat.length % 2 === 0 && splitMelds(flat, s.okeyTile, pairsOf(flat));
    if (!pairs)
      return "You opened with pairs: lay pairs, or add to sets and runs";
    lay(s, player, pairs, groups.flat());
    game.logMove(s, player, "laid", flat);
    return s;
  }
  const pairs = s.rules.rounds[s.round - 1].melds?.some(
    ([type]) => type === "pair",
  );
  const melds = splitMelds(flat, s.okeyTile, undefined, wrap(s), false, pairs);
  if (!melds) {
    return pairs
      ? "That's not a pair, küt or seri"
      : "That's not a küt or a seri";
  }
  lay(s, player, melds, groups.flat());
  game.logMove(s, player, "laid", flat);
  return s;
}

export function addToMeld(state, player, tileId, meldIndex) {
  const blocked = canBuild(state, player);
  if (blocked) return blocked;
  const meld = state.melds[meldIndex];
  if (!meld) return;
  const taken = takeFromHand(state, player, [[tileId]]);
  if (typeof taken === "string") return taken;
  const [s, [[tile]]] = taken;

  const ordered = withTile(s, meld, tile);
  if (!ordered) return "That tile doesn't fit there";
  s.melds[meldIndex] = { ...meld, tiles: ordered.map(tableTile) };
  game.logMove(s, player, "added", [tile]);
  return s;
}

// The meld with the tile added, in order, or null. A seri keeps its order,
// so the tile goes on one end, and a table okey keeps the rank it stands
// for; the tile it stands for swaps it out instead (swapOkey).
function withTile(state, meld, tile, wrapRuns = wrap(state)) {
  const ind = state.okeyTile;
  const okeyRanks = (tiles) =>
    tiles.flatMap((t, i) =>
      isOkey(t, ind) ? [okeyStandsFor({ ...meld, tiles }, i, ind).rank] : [],
    );
  const ends =
    meld.type === "seri"
      ? [
          [tile, ...meld.tiles],
          [...meld.tiles, tile],
        ]
      : [[...meld.tiles, tile]];
  for (const tiles of ends) {
    const ordered = meldOrder(tiles, meld.type, ind, wrapRuns);
    const moved =
      ordered &&
      meld.type === "seri" &&
      !okeyRanks(meld.tiles).every((r) => okeyRanks(ordered).includes(r));
    if (ordered && !moved) return ordered;
  }
  return null;
}

// where in the meld a table okey stands for this tile, or -1
function okeyFor(meld, tile, ind) {
  if (isOkey(tile, ind)) return -1;
  return meld.tiles.findIndex((t, j) => {
    if (!isOkey(t, ind)) return false;
    const { rank, colors } = okeyStandsFor(meld, j, ind);
    return rankOf(tile, ind) === rank && colors.includes(colorOf(tile, ind));
  });
}

// Trades the real tile a table okey stands for (okeyStandsFor) for that
// okey, which goes to the hand. Once you've opened, any round; before that,
// from the ruleset's okeySwapFromRound and only to open with it the same
// turn (or put it back). A küt gives its okey up only with all four colours
// there.
const NO_OKEY = "No okey there that tile can replace";

export function swapOkey(state, player, tileId, meldIndex) {
  if (roundOver(state)) return roundOver(state);
  if (state.currentPlayer !== player) return "Not your turn";
  if (!state.drawn) return "Draw a tile first";
  const meld = state.melds[meldIndex];
  const tile = seat(state, player).hand.find((t) => t?.id === tileId);
  if (!meld || !tile) return;
  if (!state.rules.swapOkeys) return NO_OKEY;
  const i = okeyFor(meld, tile, state.okeyTile);
  if (i === -1) return NO_OKEY;
  if (meld.type === "kut" && meld.tiles.length < 4) {
    return "Complete all four of the küt to take its okey";
  }
  const opened = state.opened[player];
  const from = state.rules.okeySwapFromRound;
  if (!opened && state.round < from) {
    return `Before opening, okeys can be taken from round ${from}`;
  }

  const s = cloneDeep(state);
  const okey = { ...meld.tiles[i], source: `hand-${player}`, hidden: false };
  s.melds[meldIndex].tiles[i] = tableTile(tile);
  const me = seat(s, player);
  me.hand = me.hand.map((t) => (t?.id === tileId ? okey : t));
  if (!opened) s.tookOkey = { player, meld: meldIndex, tileId };
  game.logMove(s, player, "swapped", [tile]);
  return s;
}

// an okey taken before opening goes back where it came from, the real tile
// back to the hand, if you can't open with it after all
function putOkeyBack(state, player, tileId, meldIndex) {
  const took = state.tookOkey;
  const okey = seat(state, player).hand.find((t) => t?.id === tileId);
  if (
    took?.player !== player ||
    took.meld !== meldIndex ||
    state.opened[player] ||
    !okey ||
    !isOkey(okey, state.okeyTile)
  ) {
    return;
  }
  const s = cloneDeep(state);
  const tiles = s.melds[meldIndex].tiles;
  const i = tiles.findIndex((t) => t.id === took.tileId);
  const real = { ...tiles[i], source: `hand-${player}` };
  tiles[i] = tableTile(okey);
  const me = seat(s, player);
  me.hand = me.hand.map((t) => (t?.id === tileId ? real : t));
  s.tookOkey = null;
  game.unlog(s, "swapped", took.tileId);
  return s;
}

// A tile dropped on a meld: swap out an okey if it can (that's why you'd
// drop the exact tile an okey stands for), otherwise add it.
export function playOnMeld(state, player, tileId, meldIndex) {
  const back = putOkeyBack(state, player, tileId, meldIndex);
  if (back) return back;
  const swap = swapOkey(state, player, tileId, meldIndex);
  if (swap && typeof swap !== "string") return swap;
  const add = addToMeld(state, player, tileId, meldIndex);
  // the tile is the one an okey stands for: say why it can't swap
  return typeof add === "string" && typeof swap === "string" && swap !== NO_OKEY
    ? swap
    : add;
}

// Taking a discard out of turn: the player whose turn it is may take the
// previous discard as their draw. If they draw from the pile instead, the
// discard is on offer to everyone else until they discard; the claimant
// earliest in turn order after them gets it plus a penalty tile from the pile.
export function drawTile(state, player, tile, toIndex, now = Date.now()) {
  if (isCaught(state, tile.id)) return "That tile was caught";
  const s = game.drawTile(state, player, tile, toIndex);
  if (!s || typeof s === "string") return s;
  // 101: a discard taken must go into a meld before this turn's discard
  if (state.rules.takeMustBeUsed && tile.source.startsWith("discard-")) {
    s.tookDiscard = {
      player,
      tileId: tile.id,
      from: Number(tile.source.split("-")[1]),
    };
  }
  if (!state.rules.outOfTurnTakes) return s;
  const from = game.previous(s.players, player);
  const top = from.discardPile.at(-1);
  s.offer =
    tile.source === "draw-pile" && top && !isCaught(s, top.id)
      ? { id: offerId(s), from: from.id, tileId: top.id, at: now }
      : null;
  return s;
}

// one id per discard, so a claim made before the draw matches its offer
const offerId = (s) => `${s.round}.${s.discards ?? 0}`;

// The discard the others can claim: the offer once the player whose turn it
// is draws from the pile; before that, the previous discard they could still
// take themselves, so a claim can wait for it (and lapses if they take it).
export function upForClaim(state) {
  if (!state.rules?.outOfTurnTakes) return null;
  if (state.offer) return state.offer;
  if (state.gameState !== "play" || state.drawn) return null;
  const from = game.previous(state.players, state.currentPlayer);
  const top = from.discardPile.at(-1);
  return top && top.id === state.lastDiscard && !isCaught(state, top.id)
    ? { id: offerId(state), from: from.id, tileId: top.id }
    : null;
}

// Out-of-turn take: the player drags the discard up for claim (upForClaim,
// even before the current player draws) onto an empty slot of their rack,
// where it waits as a ghost until the current player discards.
// Claims are per player (their own sync key), so claiming never collides
// with the current move. slot null takes the claim back.
export function claimDiscard(state, player, slot = null) {
  const offer = upForClaim(state);
  if (slot === null) {
    if (!seat(state, player)?.claim) return;
    const s = cloneDeep(state);
    seat(s, player).claim = null;
    return s;
  }
  if (state.gameState !== "play" || !offer) return "Nothing to take right now";
  if (player === state.currentPlayer) return "You already drew this turn";
  if (player === offer.from) return "That's your own tile";
  const { maxTakes } = state.rules;
  if ((state.takes?.[player] ?? 0) >= maxTakes) {
    return `You can take ${maxTakes} a round`;
  }
  if (seat(state, offer.from).discardPile.at(-1)?.id !== offer.tileId) {
    return "Nothing to take right now";
  }
  if (isCaught(state, offer.tileId)) return "That tile was caught";
  if (!state.drawPile.length) return "No tiles left for the extra draw";
  const hand = seat(state, player).hand;
  const s = cloneDeep(state);
  seat(s, player).claim = {
    id: offer.id,
    slot: hand[slot] ? hand.indexOf(null) : slot,
  };
  return s;
}

// Hands are only written by their owner, so won tiles wait in an inbox until
// the owner's client moves them onto the rack.
export function collectInbox(state, player) {
  if (!seat(state, player)?.inbox?.length) return;
  const s = cloneDeep(state);
  const me = seat(s, player);
  me.hand = intoHand(me.hand, me.inbox);
  me.inbox = [];
  return s;
}

// a won discard goes to the slot its ghost was in, if that's still free
function intoHand(hand, tiles) {
  const h = [...hand];
  for (const { slot, ...t } of tiles) {
    const i = slot !== undefined && h[slot] === null ? slot : h.indexOf(null);
    h[i === -1 ? h.length : i] = t;
  }
  return h;
}

// Who has claimed the discard on offer, first in line first: turn order
// after the player whose turn it is. Claims made before the draw stay
// hidden until then, so they can't sway the current player's choice.
export function claimants(state, current = state.currentPlayer) {
  const { offer, players } = state;
  if (!offer || isCaught(state, offer.tileId)) return [];
  const n = players.length;
  const start = players.findIndex((p) => p.id === current);
  return Array.from(
    { length: n - 1 },
    (_, k) => players[(start + 1 + k) % n],
  ).filter((p) => p.user && p.id !== offer.from && p.claim?.id === offer.id);
}

function resolveOffer(s, current) {
  const { offer } = s;
  const [winner] = claimants(s, current);
  s.offer = null;
  if (!winner || !s.drawPile.length || isCaught(s, offer.tileId)) return;
  const from = seat(s, offer.from);
  if (from.discardPile.at(-1)?.id !== offer.tileId) return;
  const won = [
    { ...from.discardPile.at(-1), slot: winner.claim.slot },
    s.drawPile.at(-1),
  ];
  from.discardPile = from.discardPile.slice(0, -1);
  s.drawPile = s.drawPile.slice(0, -1);
  s.takes = { ...s.takes, [winner.id]: (s.takes?.[winner.id] ?? 0) + 1 };
  winner.inbox = [
    ...(winner.inbox ?? []),
    ...won.map((t) => ({ ...t, hidden: false, source: `hand-${winner.id}` })),
  ];
}

// Rounds 1–11 end when someone discards their last tile, or the pile runs out
// (then everyone, opened or not, scores what's left in their hand).
// someone besides the discarder could still take the tile on offer
function claimable(state, player) {
  const { offer } = state;
  return (
    offer &&
    state.drawPile.length > 0 &&
    !isCaught(state, offer.tileId) &&
    state.players.some(
      (p) =>
        p.user &&
        p.id !== player &&
        p.id !== offer.from &&
        (state.takes?.[p.id] ?? 0) < state.rules.maxTakes,
    )
  );
}

// seconds the others still have to take the discard on offer before the
// player may discard: 0 once it's over, for their last tile, or when nobody
// else could take it
export function claimWait(state, player, now = Date.now()) {
  const last = seat(state, player)?.hand.filter(Boolean).length === 1;
  const wait =
    state.offer && state.rules.claimWaitSeconds - (now - state.offer.at) / 1000;
  return !last && wait > 0 && claimable(state, player) ? wait : 0;
}

const LAST = "Throw your last tile to the middle to finish";
const onlyTile = (state, player) =>
  seat(state, player)?.hand.filter(Boolean).length === 1;

// The last tile never goes on a pile: it's thrown to the middle to finish
// (finishGame), as in Elden, so every round ends the same way
export function discardTile(state, player, tile, now = Date.now()) {
  if (state.currentPlayer === player && onlyTile(state, player)) return LAST;
  return throwTile(state, player, tile, now);
}

function throwTile(state, player, tile, now = Date.now()) {
  const wait = claimWait(state, player, now);
  if (wait) return `Give the others ${Math.ceil(wait)}s to take the discard`;
  if (state.tookOkey?.player === player && !state.opened[player]) {
    return "You took an okey: open your hand, or put the okey back";
  }
  const took = state.tookDiscard;
  if (
    took?.player === player &&
    seat(state, player).hand.some((t) => t?.id === took.tileId)
  ) {
    return "Use the tile you took from the discard, or put it back";
  }
  const s = game.discardTile(state, player, tile);
  if (!s || typeof s === "string") return s;
  s.justOpened = null;
  s.tookOkey = null;
  s.tookDiscard = null;
  s.discards = (s.discards ?? 0) + 1;
  if (!seat(s, player).hand.some(Boolean)) {
    // the finishing tile lies in the middle, not on the pile
    seat(s, player).discardPile.pop();
    s.lastDiscard = null;
    // the finisher's turn: the discard emptied it for the next one
    s.turnMoves = state.turnMoves;
    game.finish(s, player, tile);
    return endRound(s, player, tile);
  }
  if (s.rules.okeyDiscardPenalty && isOkey(tile, s.okeyTile)) {
    s.penalties = {
      ...s.penalties,
      [player]: (s.penalties?.[player] ?? 0) + s.rules.okeyDiscardPenalty,
    };
  }
  resolveOffer(s, player);
  if (!s.drawPile.length) return endRound(s, null);
  return s;
}

const isCaught = (state, tileId) =>
  state.players.some((p) => p.caught?.includes(tileId));

// 101: a discard taken that can't be used goes back on its pile, and the
// player draws from the pile instead
export function returnDiscard(state, player) {
  const took = state.tookDiscard;
  const tile = seat(state, player)?.hand.find((t) => t?.id === took?.tileId);
  if (took?.player !== player || !tile) return;
  const s = cloneDeep(state);
  const me = seat(s, player);
  me.hand = me.hand.map((t) => (t?.id === tile.id ? null : t));
  const from = seat(s, took.from);
  from.discardPile = [...from.discardPile, game.onPile(tile, from.id)];
  s.lastDiscard = tile.id;
  s.drawn = false;
  s.tookDiscard = null;
  game.unlog(s, "took", tile.id);
  return s;
}

// The latest discard, while it's still on top of its pile, can be caught by
// anyone else if it fits a meld on the table.
export function catchDiscard(state, player) {
  if (roundOver(state)) return roundOver(state);
  const from = state.players.find((p) =>
    p.discardPile.some((t) => t.id === state.lastDiscard),
  );
  const tile = from?.discardPile.at(-1);
  if (!tile || tile.id !== state.lastDiscard) return "Nothing to catch";
  if (from.id === player) return "That's your own tile";
  if (isCaught(state, tile.id)) return "Already caught";
  // it could go on the table as it is: added without moving an okey, or in
  // place of the okey that stands for it; a 1 after 13 doesn't count
  const ind = state.okeyTile;
  const fits = state.melds.some((m) => {
    const j = okeyFor(m, tile, ind);
    const after13 = m.type === "seri" && j > 0 && rankOf(tile, ind) === 1;
    return withTile(state, m, tile, false) || (j >= 0 && !after13);
  });
  if (!fits) return "That tile doesn't fit a meld on the table";
  const s = cloneDeep(state);
  const me = seat(s, player);
  me.caught = [...(me.caught ?? []), tile.id];
  s.message = `${me.user?.name} caught ${from.user?.name}'s tile: +${s.rules.catchPenalty}`;
  return s;
}

// The tile thrown to the middle finishes: the last one, once the rest are
// laid down, or in Elden the whole hand at once, like the normal game
export function finishGame(state, player, tile) {
  if (!isElden(state)) {
    if (state.currentPlayer !== player) return "Not your turn";
    if (!onlyTile(state, player)) {
      return "Lay down your tiles, then throw the last one to the middle";
    }
    return throwTile(state, player, tile);
  }
  const s = game.finishGame(state, player, tile);
  if (!s || typeof s === "string") return s;
  return endRound(s, player);
}

function handScore(hand, { okeyTile, rules }) {
  return sum(
    hand
      .filter(Boolean)
      .map((t) =>
        isOkey(t, okeyTile) ? rules.okeyInHandScore : rankOf(t, okeyTile),
      ),
  );
}

// `last`: the finisher's last discard
function endRound(state, finisher, last) {
  const s = cloneDeep(state);
  const { rules } = s;
  const i = s.round - 1;
  const caught = s.players.flatMap((p) => p.caught ?? []);
  const pairs = (id) => !!s.openedWithPairs?.[id];
  // 101: a win with pairs, or with the okey as the last discard, doubles
  // every score; both quadruple it
  const times = !rules.opening
    ? 1
    : (pairs(finisher) ? 2 : 1) * (last && isOkey(last, s.okeyTile) ? 2 : 1);
  // 101: a hand nobody finishes scores only the okeys held, and is dealt
  // again by the same player; penalties during play stand either way
  const voided = rules.opening && !finisher;
  for (const p of s.players) {
    p.hand = intoHand(p.hand, p.inbox ?? []);
    p.inbox = [];
    const okeys = p.hand.filter((t) => t && isOkey(t, s.okeyTile)).length;
    const score =
      (voided
        ? rules.okeyInHandScore * okeys
        : p.id === finisher
          ? rules.finishScore * times
          : finisher && !isElden(s) && !s.opened[p.id]
            ? rules.notOpenedScore * Math.min(times, 2)
            : handScore(p.hand, s) * (pairs(p.id) ? 2 : 1) * times) +
      rules.catchPenalty *
        p.discardPile.filter((t) => caught.includes(t.id)).length +
      (s.penalties?.[p.id] ?? 0);
    // a hand dealt again adds to the same line
    s.scores[p.id] = s.scores[p.id] ?? [];
    s.scores[p.id][i] = (s.scores[p.id][i] ?? 0) + score;
  }
  game.showHands(s);
  const name = (id) => seat(s, id)?.user?.name ?? "Player";

  if (s.round < rules.rounds.length || voided) {
    return {
      ...s,
      players: game.allSeats(s.players), // free seats to sit in
      gameState: "roundEnd",
      replay: voided,
      message: finisher
        ? `${name(finisher)} finished round ${s.round}`
        : voided
          ? `Round ${s.round}: no tiles left, dealt again`
          : `Round ${s.round}: no tiles left`,
    };
  }
  const total = (p) => sum(s.scores[p.id]);
  const winner = s.players.reduce((a, b) => (total(b) < total(a) ? b : a));
  return {
    ...s,
    gameState: "finish",
    message: `${name(winner.id)} wins with ${total(winner)}`,
  };
}
