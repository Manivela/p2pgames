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

// Americano: 12 rounds, each with its own opening (el açma) requirement.
// Same shape as game.js: (state, player, ...args) => new state | message.

// Score sheet values; lowest total after the 12 rounds wins.
export const FINISH_SCORE = -20; // shown as a line on the sheet
export const NOT_OPENED_SCORE = 100;
export const OKEY_IN_HAND_SCORE = 25;
// out-of-turn takes allowed per player per round
export const MAX_TAKES = 3;
// from this round on, a real tile can take an okey's place in a table meld
export const OKEY_SWAP_FROM_ROUND = 6;
// after drawing from the pile, the others get this long to take the discard
export const CLAIM_WAIT_SECONDS = 8;
// discarding a tile that fits a table meld (işler taş): whoever catches it
// adds this to the discarder's round score, and nobody can take the tile
export const CATCH_PENALTY = 20;

// The opening must be exactly these melds, [type, size] each.
// Elden has no opening: you finish with your whole hand in one go.
export const rounds = [
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
];

const seat = (state, player) => state.players.find((p) => p.id === player);
const tableTile = (tile) => ({ ...tile, source: "table", hidden: false });
const isElden = (state) => !rounds[state.round - 1].melds;

export function startGame(state, deal) {
  const s = game.startGame(state, deal);
  if (s.gameState !== "play") return s;
  return {
    ...s,
    mode: "americano",
    round: 1,
    scores: {},
    melds: [],
    opened: {},
    justOpened: null,
    takes: {},
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
  const worst = Math.max(
    ...players
      .filter((p) => state.scores[p.id])
      .map((p) => sum(state.scores[p.id])),
  );
  const scores = { ...state.scores };
  for (const p of players) {
    if (!scores[p.id])
      scores[p.id] = [...Array(state.round - 1).fill(null), worst];
  }
  const round = state.round + 1;
  return game.dealRound(
    {
      ...state,
      players,
      scores,
      round,
      melds: [],
      opened: {},
      justOpened: null,
      offer: null,
      takes: {},
    },
    game.shuffledPile(),
    deal,
    (round - 1) % players.length,
  );
}

// Picks a game up from anywhere: a fresh deal at `round`, with each seated
// player's total so far (in the row before that round) and `starter` to
// play first.
export function setUp(state, round, totals, starter) {
  const s = startGame(state);
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

// Takes the groups (arrays of tile ids) out of the player's hand on their
// turn. Returns [newState, groups of tiles] or a message.
function takeFromHand(state, player, groups) {
  if (state.gameState !== "play") return "The round is over";
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
  if (hand.filter(Boolean).length - ids.length < 1) {
    return "Keep a tile to discard";
  }
  const s = cloneDeep(state);
  const me = seat(s, player);
  const tiles = groups.map((g) =>
    g.map((id) => hand.find((t) => t?.id === id)),
  );
  me.hand = me.hand.map((t) => (t && ids.includes(t.id) ? null : t));
  return [s, tiles];
}

function canBuild(state, player) {
  if (isElden(state)) return "No laying down in the Elden round";
  if (!state.opened[player]) return "Open your hand first";
  if (state.justOpened === player) return "You can lay more from next turn";
}

export function openHand(state, player, groups) {
  const required = rounds[state.round - 1].melds;
  if (!required) return "No opening in the Elden round: finish from your hand";
  if (state.opened[player]) return "You've already opened";
  const taken = takeFromHand(state, player, groups);
  if (typeof taken === "string") return taken;
  const [s, tiles] = taken;

  // the picked tiles, wherever they sit on the rack, make exactly the
  // required melds
  const melds = splitMelds(tiles.flat(), s.okeyTile, required);
  if (!melds) return `Open with exactly: ${rounds[state.round - 1].name}`;
  lay(s, player, melds, groups.flat());
  s.opened = { ...s.opened, [player]: true };
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

  const melds = splitMelds(tiles.flat(), s.okeyTile);
  if (!melds) return "That's not a küt or a seri";
  lay(s, player, melds, groups.flat());
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

  const ordered = meldOrder([...meld.tiles, tile], meld.type, s.okeyTile);
  // a table okey keeps the rank it stands for; the tile it stands for
  // swaps it out instead (swapOkey)
  const okeyRanks = (tiles) =>
    tiles.flatMap((t, i) =>
      isOkey(t, s.okeyTile)
        ? [okeyStandsFor({ ...meld, tiles }, i, s.okeyTile).rank]
        : [],
    );
  const moved =
    ordered &&
    meld.type === "seri" &&
    !okeyRanks(meld.tiles).every((r) => okeyRanks(ordered).includes(r));
  if (!ordered || moved) return "That tile doesn't fit there";
  s.melds[meldIndex] = { ...meld, tiles: ordered.map(tableTile) };
  return s;
}

// Trades the real tile a table okey stands for (okeyStandsFor) for that
// okey, which goes to the hand. Once you've opened, any round; before that,
// from OKEY_SWAP_FROM_ROUND and only to open with it the same turn (or put
// it back). A küt gives its okey up only with all four colours there.
const NO_OKEY = "No okey there that tile can replace";

export function swapOkey(state, player, tileId, meldIndex) {
  if (state.gameState !== "play") return "The round is over";
  if (state.currentPlayer !== player) return "Not your turn";
  if (!state.drawn) return "Draw a tile first";
  const meld = state.melds[meldIndex];
  const tile = seat(state, player).hand.find((t) => t?.id === tileId);
  if (!meld || !tile) return;
  const ind = state.okeyTile;
  const i = isOkey(tile, ind)
    ? -1
    : meld.tiles.findIndex((t, j) => {
        if (!isOkey(t, ind)) return false;
        const { rank, colors } = okeyStandsFor(meld, j, ind);
        return (
          rankOf(tile, ind) === rank && colors.includes(colorOf(tile, ind))
        );
      });
  if (i === -1) return NO_OKEY;
  if (meld.type === "kut" && meld.tiles.length < 4) {
    return "Complete all four of the küt to take its okey";
  }
  const opened = state.opened[player];
  if (!opened && state.round < OKEY_SWAP_FROM_ROUND) {
    return `Before opening, okeys can be taken from round ${OKEY_SWAP_FROM_ROUND}`;
  }

  const s = cloneDeep(state);
  const okey = { ...meld.tiles[i], source: `hand-${player}`, hidden: false };
  s.melds[meldIndex].tiles[i] = tableTile(tile);
  const me = seat(s, player);
  me.hand = me.hand.map((t) => (t?.id === tileId ? okey : t));
  if (!opened) s.tookOkey = { player, meld: meldIndex, tileId };
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
  const i = s.players.findIndex((p) => p.id === player);
  const from = s.players[(i + s.players.length - 1) % s.players.length];
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
  if (state.offer) return state.offer;
  if (state.mode !== "americano" || state.gameState !== "play" || state.drawn) {
    return null;
  }
  const n = state.players.length;
  const i = state.players.findIndex((p) => p.id === state.currentPlayer);
  const from = state.players[(i + n - 1) % n];
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
  if ((state.takes?.[player] ?? 0) >= MAX_TAKES) {
    return `You can take ${MAX_TAKES} a round`;
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
        (state.takes?.[p.id] ?? 0) < MAX_TAKES,
    )
  );
}

export function discardTile(state, player, tile, now = Date.now()) {
  const last = seat(state, player)?.hand.filter(Boolean).length === 1;
  const wait =
    state.offer && CLAIM_WAIT_SECONDS - (now - state.offer.at) / 1000;
  if (!last && wait > 0 && claimable(state, player)) {
    return `Give the others ${Math.ceil(wait)}s to take the discard`;
  }
  if (state.tookOkey?.player === player && !state.opened[player]) {
    return "You took an okey: open your hand, or put the okey back";
  }
  const s = game.discardTile(state, player, tile);
  if (!s || typeof s === "string") return s;
  s.justOpened = null;
  s.tookOkey = null;
  s.discards = (s.discards ?? 0) + 1;
  if (!seat(s, player).hand.some(Boolean)) return endRound(s, player);
  resolveOffer(s, player);
  if (!s.drawPile.length) return endRound(s, null);
  return s;
}

const isCaught = (state, tileId) =>
  state.players.some((p) => p.caught?.includes(tileId));

// The latest discard, while it's still on top of its pile, can be caught by
// anyone else if it fits a meld on the table.
export function catchDiscard(state, player) {
  if (state.gameState !== "play") return "The round is over";
  const from = state.players.find((p) =>
    p.discardPile.some((t) => t.id === state.lastDiscard),
  );
  const tile = from?.discardPile.at(-1);
  if (!tile || tile.id !== state.lastDiscard) return "Nothing to catch";
  if (from.id === player) return "That's your own tile";
  if (isCaught(state, tile.id)) return "Already caught";
  const fits = state.melds.some((m) =>
    meldOrder([...m.tiles, tile], m.type, state.okeyTile),
  );
  if (!fits) return "That tile doesn't fit a meld on the table";
  const s = cloneDeep(state);
  const me = seat(s, player);
  me.caught = [...(me.caught ?? []), tile.id];
  s.message = `${me.user?.name} caught ${from.user?.name}'s tile: +${CATCH_PENALTY}`;
  return s;
}

// Elden: finish the whole hand at once, like the normal game
export function finishGame(state, player, tile) {
  if (!isElden(state)) {
    return "Finish by laying down your tiles and discarding the last one";
  }
  const s = game.finishGame(state, player, tile);
  if (!s || typeof s === "string") return s;
  return endRound(s, player);
}

function handScore(hand, indicator) {
  return sum(
    hand
      .filter(Boolean)
      .map((t) =>
        isOkey(t, indicator) ? OKEY_IN_HAND_SCORE : rankOf(t, indicator),
      ),
  );
}

function endRound(state, finisher) {
  const s = cloneDeep(state);
  const i = s.round - 1;
  const caught = s.players.flatMap((p) => p.caught ?? []);
  for (const p of s.players) {
    p.hand = intoHand(p.hand, p.inbox ?? []);
    p.inbox = [];
    s.scores[p.id] = s.scores[p.id] ?? [];
    s.scores[p.id][i] =
      p.id === finisher
        ? FINISH_SCORE
        : finisher && !isElden(s) && !s.opened[p.id]
          ? NOT_OPENED_SCORE
          : handScore(p.hand, s.okeyTile);
    s.scores[p.id][i] +=
      CATCH_PENALTY * p.discardPile.filter((t) => caught.includes(t.id)).length;
    p.hand = p.hand.map((t) => t && { ...t, hidden: false });
  }
  const name = (id) => seat(s, id)?.user?.name ?? "Player";

  if (s.round < rounds.length) {
    return {
      ...s,
      players: game.allSeats(s.players), // free seats to sit in
      gameState: "roundEnd",
      message: finisher
        ? `${name(finisher)} finished round ${s.round}`
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
