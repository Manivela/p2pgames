import { cloneDeep, sum } from "lodash";
import * as game from "./game";
import { isOkey, meldOrder, rankOf } from "./melds";

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

export function nextRound(state, deal) {
  if (state.gameState !== "roundEnd") return;
  const round = state.round + 1;
  return game.dealRound(
    {
      ...state,
      round,
      melds: [],
      opened: {},
      justOpened: null,
      offer: null,
      takes: {},
    },
    game.shuffledPile(),
    deal,
    (round - 1) % state.players.length,
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

  // groups match the required melds one to one, in either order
  const orders =
    required.length === 2
      ? [
          [0, 1],
          [1, 0],
        ]
      : [[0]];
  const melds =
    tiles.length === required.length &&
    orders
      .map((order) =>
        tiles.map((group, i) => {
          const [type, size] = required[order[i]];
          const ordered =
            group.length === size && meldOrder(group, type, s.okeyTile);
          return (
            ordered && { type, owner: player, tiles: ordered.map(tableTile) }
          );
        }),
      )
      .find((m) => m.every(Boolean));
  if (!melds) return `Open with exactly: ${rounds[state.round - 1].name}`;

  s.melds = [...s.melds, ...melds];
  s.opened = { ...s.opened, [player]: true };
  s.justOpened = player;
  return s;
}

export function layMelds(state, player, groups) {
  const blocked = canBuild(state, player);
  if (blocked) return blocked;
  const taken = takeFromHand(state, player, groups);
  if (typeof taken === "string") return taken;
  const [s, tiles] = taken;

  // ponytail: a group that is both (e.g. 5 + two okeys) is laid as a seri
  const melds = tiles.map((group) => {
    for (const type of ["seri", "kut"]) {
      const ordered = meldOrder(group, type, s.okeyTile);
      if (ordered)
        return { type, owner: player, tiles: ordered.map(tableTile) };
    }
  });
  if (!melds.every(Boolean)) return "That's not a küt or a seri";
  s.melds = [...s.melds, ...melds];
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
  if (!ordered) return "That tile doesn't fit there";
  s.melds[meldIndex] = { ...meld, tiles: ordered.map(tableTile) };
  return s;
}

// Trades a real tile from the hand for an okey in a table meld that it can
// stand in for; the okey goes to the hand (e.g. to open with, same turn).
export function swapOkey(state, player, tileId, meldIndex) {
  if (state.round < OKEY_SWAP_FROM_ROUND) {
    return `Okeys can be swapped from round ${OKEY_SWAP_FROM_ROUND}`;
  }
  if (state.gameState !== "play") return "The round is over";
  if (state.currentPlayer !== player) return "Not your turn";
  if (!state.drawn) return "Draw a tile first";
  const meld = state.melds[meldIndex];
  const tile = seat(state, player).hand.find((t) => t?.id === tileId);
  if (!meld || !tile) return;
  const ind = state.okeyTile;
  const swapped = (i) => meld.tiles.map((t, j) => (j === i ? tile : t));
  const i = isOkey(tile, ind)
    ? -1
    : meld.tiles.findIndex(
        (t, j) => isOkey(t, ind) && meldOrder(swapped(j), meld.type, ind),
      );
  if (i === -1) return "No okey there that tile can replace";

  const s = cloneDeep(state);
  const okey = { ...meld.tiles[i], source: `hand-${player}`, hidden: false };
  s.melds[meldIndex] = {
    ...meld,
    tiles: meldOrder(swapped(i), meld.type, ind).map(tableTile),
  };
  const me = seat(s, player);
  me.hand = me.hand.map((t) => (t?.id === tileId ? okey : t));
  return s;
}

// A tile dropped on a meld: swap out an okey if it can (that's why you'd
// drop the exact tile an okey stands for), otherwise add it.
export function playOnMeld(state, player, tileId, meldIndex) {
  const s = swapOkey(state, player, tileId, meldIndex);
  return s && typeof s !== "string"
    ? s
    : addToMeld(state, player, tileId, meldIndex);
}

// Taking a discard out of turn: the player whose turn it is may take the
// previous discard as their draw. If they draw from the pile instead, the
// discard is on offer to everyone else until they discard; the claimant
// earliest in turn order after them gets it plus a penalty tile from the pile.
export function drawTile(state, player, tile, toIndex) {
  const s = game.drawTile(state, player, tile, toIndex);
  if (!s || typeof s === "string") return s;
  const i = s.players.findIndex((p) => p.id === player);
  const from = s.players[(i + s.players.length - 1) % s.players.length];
  const top = from.discardPile.at(-1);
  s.offers = (s.offers ?? 0) + 1;
  s.offer =
    tile.source === "draw-pile" && top
      ? { id: `${s.round}.${s.offers}`, from: from.id, tileId: top.id }
      : null;
  return s;
}

// Toggles the player's claim on the tile on offer. Claims are per player
// (their own sync key), so claiming never collides with the current move.
export function claimDiscard(state, player) {
  const { offer } = state;
  if (state.gameState !== "play" || !offer) return "Nothing to take right now";
  if (player === state.currentPlayer) return "You already drew this turn";
  if (player === offer.from) return "That's your own tile";
  if ((state.takes?.[player] ?? 0) >= MAX_TAKES) {
    return `You can take ${MAX_TAKES} a round`;
  }
  if (seat(state, offer.from).discardPile.at(-1)?.id !== offer.tileId) {
    return "Nothing to take right now";
  }
  if (!state.drawPile.length) return "No tiles left for the extra draw";
  const s = cloneDeep(state);
  const me = seat(s, player);
  me.claim = me.claim === offer.id ? null : offer.id;
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

function intoHand(hand, tiles) {
  const h = [...hand];
  for (const t of tiles) {
    const i = h.indexOf(null);
    h[i === -1 ? h.length : i] = t;
  }
  return h;
}

// Who has claimed the discard on offer, first in line first: turn order
// after the player whose turn it is.
export function claimants(state, current = state.currentPlayer) {
  const { offer, players } = state;
  if (!offer) return [];
  const n = players.length;
  const start = players.findIndex((p) => p.id === current);
  return Array.from(
    { length: n - 1 },
    (_, k) => players[(start + 1 + k) % n],
  ).filter((p) => p.user && p.id !== offer.from && p.claim === offer.id);
}

function resolveOffer(s, current) {
  const { offer } = s;
  const [winner] = claimants(s, current);
  s.offer = null;
  if (!winner || !s.drawPile.length) return;
  const from = seat(s, offer.from);
  if (from.discardPile.at(-1)?.id !== offer.tileId) return;
  const won = [from.discardPile.at(-1), s.drawPile.at(-1)];
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
export function discardTile(state, player, tile) {
  const s = game.discardTile(state, player, tile);
  if (!s || typeof s === "string") return s;
  s.justOpened = null;
  if (!seat(s, player).hand.some(Boolean)) return endRound(s, player);
  resolveOffer(s, player);
  if (!s.drawPile.length) return endRound(s, null);
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
    p.hand = p.hand.map((t) => t && { ...t, hidden: false });
  }
  const name = (id) => seat(s, id)?.user?.name ?? "Player";

  if (s.round < rounds.length) {
    return {
      ...s,
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
