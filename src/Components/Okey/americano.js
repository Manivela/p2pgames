import { cloneDeep, max, sum } from "lodash";
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

// Every game, played in rounds, each opening (el açma) its own way: with
// the melds it asks for (Americano's), with points or pairs (101's), or
// not at all, finished from the hand (Elden, classic). Same shape as
// game.js: (state, player, ...args) => new state | message. The numbers
// and switches come from the game's ruleset (state.rules, rulesets.js).

const { seat, roundOver } = game;
const tableTile = (tile) => ({ ...tile, source: "table", hidden: false });
export const roundOf = (state) => state.rules.rounds[state.round - 1];
// a round finished from the hand: nothing is laid down
export const isElden = (state) =>
  !roundOf(state).melds && !roundOf(state).opening;
const wrap = (state) => state.rules.wrapRuns;
const pairsOf = (tiles) => Array(tiles.length / 2).fill(["pair", 2]);
// a round that opens with pairs (Americano's 4 çift)
export const pairRound = (state) =>
  !!state.rules?.rounds?.[state.round - 1]?.melds?.some(
    ([type]) => type === "pair",
  );

export function startGame(state, deal, rules = AMERICANO) {
  if (rules.partners && state.players.filter((p) => p.user).length !== 4) {
    return { ...state, message: "Partners take four players" };
  }
  const s = game.startGame({ ...state, rules }, deal);
  if (s.gameState !== "play") return s;
  return {
    ...s,
    round: 1,
    scores: {},
    melds: [],
    opened: {},
    openedWithPairs: {},
    highestOpening: 0,
    justOpened: null,
    offer: null,
    takes: {},
    penalties: {},
    replay: false,
    tookDiscard: null,
    tookOkey: null,
    discards: 0,
    indicatorShown: null,
  };
}

// The round void, back to before it was dealt (its penalties too): seats can
// be freed and taken, and Next Round deals it again, from the same seat
export function redealRound(state) {
  if (roundOver(state)) return roundOver(state);
  return {
    ...state,
    players: game.allSeats(state.players, game.seatsOf(state)).map((p) => ({
      ...p,
      hand: [],
      discardPile: [],
      inbox: [],
      claim: null,
      caught: [],
    })),
    melds: [],
    turnMoves: [],
    finishTile: null,
    offer: null,
    drawPile: game.shuffledPile(game.setsOf(state)),
    okeyTile: null,
    gameState: "roundEnd",
    replay: true,
    message: `Round ${state.round}: dealt again`,
  };
}

// Standing up from a seat: empty, and out of the deals until someone sits
// in it, its scores kept. Mid-round its hand stays in the round, for a
// friend to sit down to.
export function standUp(state, player) {
  if (!seat(state, player)) return;
  const s = cloneDeep(state);
  const leaver = seat(s, player);
  s.message = `${leaver.user?.name ?? "Someone"} left`;
  leaver.user = null;
  leaver.userKey = null;
  delete leaver.away; // nobody sits back down in it by themselves
  return s;
}

// A seat freed from the menu, or its player leaving the round: stood up
// from, and mid-round out of the round too, its tiles off the table and the
// turn passing on if it was theirs, so nobody waits on it.
export function freeSeat(state, player) {
  const s = standUp(state, player);
  if (!s || state.gameState !== "play") return s;
  if (state.rules.partners) return "Partners take four players";
  if (state.players.length < 3) return "A round takes two players";
  if (s.currentPlayer === player) {
    s.currentPlayer = game.next(s.players, player).id;
    s.drawn = false;
    s.turnMoves = [];
    s.justOpened = null;
    s.tookOkey = null;
    s.offer = null;
  }
  if (s.offer?.from === player) s.offer = null;
  if (s.tookDiscard?.player === player || s.tookDiscard?.from === player) {
    s.tookDiscard = null;
  }
  s.players = s.players.filter((p) => p.id !== player);
  return s;
}

// Deals every seat sat in, and every seat whose player dropped out (away):
// they can sit back down (a phone that slept) or a friend take over, and
// the seat is scored either way. A seat back after rounds without it has
// each one it missed written as that round's worst, so sitting out never
// pays; someone who sits in a new seat starts level with whoever is losing.
export function nextRound(state, deal) {
  if (state.gameState !== "roundEnd") return;
  const players = state.players.filter((p) => p.user || p.away);
  if (players.length < 2) return "not enough players to start the game";
  // a hand nobody finished is dealt again by the same player
  const round = state.replay ? state.round : state.round + 1;
  const scores = { ...state.scores };
  const worstOf = (i) =>
    max(Object.values(state.scores).map((line) => line[i]));
  for (const p of players) {
    const line = [...(scores[p.id] ?? [])];
    // from its first score to the rounds played before this deal
    const first = line.findIndex((v) => v != null);
    for (let i = first + 1; first >= 0 && i < round - 1; i++) {
      const paid = worstOf(i);
      if (line[i] == null && paid != null) line[i] = paid;
    }
    if (first >= 0) scores[p.id] = line;
  }
  const totals = players
    .filter((p) => scores[p.id])
    .map((p) => sum(scores[p.id]));
  const worst = totals.length ? Math.max(...totals) : 0;
  for (const p of players) {
    if (!scores[p.id])
      scores[p.id] = [...Array(state.round - 1).fill(null), worst];
  }
  return game.dealRound(
    {
      ...state,
      players,
      scores,
      round,
      melds: [],
      opened: {},
      openedWithPairs: {},
      highestOpening: 0,
      justOpened: null,
      offer: null,
      takes: {},
      penalties: {},
      replay: false,
      discards: 0,
      indicatorShown: null,
    },
    game.shuffledPile(game.setsOf(state)),
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
    game.shuffledPile(game.setsOf(s)),
    undefined,
    Math.max(
      0,
      s.players.findIndex((p) => p.id === starter),
    ),
  );
}

const KEEP = "Keep a tile to discard";

// a penalty during play, on top of the hand's score at its end
function penalize(s, player, points) {
  s.penalties = {
    ...s.penalties,
    [player]: (s.penalties?.[player] ?? 0) + points,
  };
}

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

// the tiles side by side on a rack, group by group: an empty slot or a
// row's end (every `row` slots) separates them
export function groupsOf(slots, row) {
  const groups = [];
  slots.forEach((t, i) => {
    if (!t) return;
    if (i % row === 0 || !slots[i - 1]) groups.push([]);
    groups.at(-1).push(t);
  });
  return groups;
}

// 101: what the sets and runs as they lie on a player's rack are worth, as
// the opening counts them
export const rackPoints = (state, player) =>
  sum(
    groupsOf(seat(state, player)?.hand ?? [], game.rowOf(state)).map(
      (g) => asLaid(g, state.okeyTile).total,
    ),
  );

// 101's opening: sets and runs as laid out on the rack (a gap or a tile
// left out separates them, and an okey counts where it stands) worth
// `points`, or (withPairs) `pairs` pairs or more anywhere on the rack;
// picked tiles that make neither stay on the rack. Returns [melds, with
// pairs] or null.
// What opening with points takes this round: its points, or with
// katlamalı (raiseOpening) more than the highest opening so far
export const pointsToOpen = (state) =>
  Math.max(
    roundOf(state).opening.points,
    state.rules.raiseOpening ? (state.highestOpening ?? 0) + 1 : 0,
  );

function openingOf(state, player, ids, withPairs) {
  const { okeyTile: ind, rules } = state;
  const { opening } = roundOf(state);
  const hand = seat(state, player).hand;
  const groups = groupsOf(
    hand.map((t) => (ids.includes(t?.id) ? t : null)),
    game.rowOf(state),
  );
  const laid = groups.map((g) => asLaid(g, ind));
  const melds = laid.flatMap((l) => l.melds);
  // all but the tile to finish with opens under the points too (finishInOne)
  const allButOne =
    rules.finishInOne &&
    sum(melds.map((m) => m.tiles.length)) === hand.filter(Boolean).length - 1;
  const total = sum(laid.map((l) => l.total));
  if (total >= pointsToOpen(state) || allButOne) return [melds, false, total];
  if (!withPairs) return null;
  // as many pairs as there are
  const tiles = groups.flat();
  for (let n = Math.floor(tiles.length / 2); n >= opening.pairs; n--) {
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

// withPairs false (openAll): sets and runs only, pairs are picked by hand
export function openHand(state, player, groups, withPairs = true) {
  const { melds: required, opening } = roundOf(state);
  if (isElden(state)) return "No opening this round: finish from your hand";
  if (state.opened[player]) return "You've already opened";
  if (!withPairs && required?.some(([type]) => type === "pair")) {
    return "Pick the pairs to open with";
  }
  const picked = takeFromHand(state, player, groups);
  if (typeof picked === "string" && picked !== KEEP) return picked;
  const hand = seat(state, player).hand;
  const tiles = groups.flat().map((id) => hand.find((t) => t?.id === id));

  // the required melds, out of the picked tiles wherever they sit on the
  // rack; picked tiles left over stay on the rack
  const [melds, pairs, total = 0] = opening
    ? (openingOf(state, player, groups.flat(), withPairs) ?? [])
    : [splitMelds(tiles, state.okeyTile, required, wrap(state), true), false];
  if (!melds) {
    return opening
      ? `Open with ${pointsToOpen(state)}+ or ${opening.pairs} pairs`
      : `Open with exactly: ${roundOf(state).name}`;
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
  s.highestOpening = Math.max(s.highestOpening ?? 0, total);
  s.justOpened = player;
  return s;
}

// El aç pressed twice with nothing picked: the sets and runs the whole
// rack opens with, the okeys tried last so a meld without one goes first
export function openAll(state, player) {
  const tiles = seat(state, player).hand.filter(Boolean);
  const okey = (t) => isOkey(t, state.okeyTile);
  const ids = [...tiles.filter((t) => !okey(t)), ...tiles.filter(okey)];
  return openHand(state, player, [ids.map((t) => t.id)], false);
}

// What El aç picks on its first press, to be seen before it's laid: the
// opening openAll would make (on your turn or not), or once opened the
// sets and runs as they lie on the rack. Pairs are picked by hand only.
export function meldsToLay(state, player) {
  const hand = seat(state, player)?.hand ?? [];
  if (state.gameState !== "play" || state.openedWithPairs?.[player]) return [];
  if (state.opened[player]) {
    return groupsOf(hand, game.rowOf(state))
      .flatMap((g) => asLaid(g, state.okeyTile).melds)
      .flatMap((m) => m.tiles.map((t) => t.id));
  }
  const s = openAll({ ...state, currentPlayer: player, drawn: true }, player);
  if (!s || typeof s === "string") return [];
  const kept = seat(s, player).hand.map((t) => t?.id);
  return hand.filter((t) => t && !kept.includes(t.id)).map((t) => t.id);
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
  // runs); the others lay pairs in a round that opens with them, or in 101
  // once someone has opened with pairs (pairsForAll)
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
  const pairs =
    pairRound(s) ||
    (s.rules.pairsForAll && Object.values(s.openedWithPairs).some(Boolean));
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

// atEnd: dropped on the meld's right half, so an okey added to a seri goes
// on its high end (the low end otherwise, or wherever it fits)
export function addToMeld(state, player, tileId, meldIndex, atEnd = false) {
  const blocked = canBuild(state, player);
  if (blocked) return blocked;
  // 101: a pairs opener adds at most pairsAddMax tiles a turn
  const max = state.rules.pairsAddMax;
  const added = (state.turnMoves ?? []).filter(
    (m) => m.by === player && m.move === "added",
  ).length;
  if (max && state.openedWithPairs?.[player] && added >= max) {
    return `You opened with pairs: ${max} tiles a turn`;
  }
  const meld = state.melds[meldIndex];
  if (!meld) return;
  const taken = takeFromHand(state, player, [[tileId]]);
  if (typeof taken === "string") return taken;
  const [s, [[tile]]] = taken;

  const ordered = withTile(s, meld, tile, wrap(s), atEnd);
  if (!ordered) return "That tile doesn't fit there";
  s.melds[meldIndex] = { ...meld, tiles: ordered.map(tableTile) };
  game.logMove(s, player, "added", [tile]);
  return s;
}

// The meld with the tile added, in order, or null. A seri keeps its order,
// so the tile goes on one end (the high end first when `atEnd`), and a
// table okey keeps the rank it stands for; the tile it stands for swaps it
// out instead (swapOkey).
function withTile(state, meld, tile, wrapRuns = wrap(state), atEnd = false) {
  const ind = state.okeyTile;
  const okeyRanks = (tiles) =>
    tiles.flatMap((t, i) =>
      isOkey(t, ind) ? [okeyStandsFor({ ...meld, tiles }, i, ind).rank] : [],
    );
  const low = [tile, ...meld.tiles];
  const high = [...meld.tiles, tile];
  const ends =
    meld.type !== "seri" ? [high] : atEnd ? [high, low] : [low, high];
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
  // null (101): only once you've opened
  if (!opened && from == null) return "Open your hand first";
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
export function playOnMeld(state, player, tileId, meldIndex, atEnd) {
  const back = putOkeyBack(state, player, tileId, meldIndex);
  if (back) return back;
  const swap = swapOkey(state, player, tileId, meldIndex);
  if (swap && typeof swap !== "string") return swap;
  const add = addToMeld(state, player, tileId, meldIndex, atEnd);
  // the tile is the one an okey stands for: say why it can't swap
  return typeof add === "string" && typeof swap === "string" && swap !== NO_OKEY
    ? swap
    : add;
}

// Taking a discard out of turn: the player whose turn it is may take the
// previous discard as their draw. If they draw from the pile instead, the
// discard is on offer to everyone else until they discard; the claimant
// earliest in turn order after them gets it plus a penalty tile from the pile.
// Their time to take it (claimWait) runs from when the turn reached the
// player, `turnStart` on their own clock: a late draw doesn't make them wait.
export function drawTile(
  state,
  player,
  tile,
  toIndex,
  now = Date.now(),
  turnStart = now,
) {
  const caught = isCaught(state, tile.id);
  if (caught && !state.rules.takeCaught) return "That tile was caught";
  const s = game.drawTile(state, player, tile, toIndex);
  if (!s || typeof s === "string") return s;
  // 101: a caught tile taken off its pile still costs whoever threw it
  if (caught) {
    penalize(s, Number(tile.source.split("-")[1]), state.rules.catchPenalty);
  }
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
      ? {
          id: offerId(s),
          from: from.id,
          tileId: top.id,
          at: Math.min(now, turnStart),
        }
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
    // opened this turn: the discard cleared justOpened
    return endRound(s, player, tile, state.justOpened === player);
  }
  if (s.rules.okeyDiscardPenalty && isOkey(tile, s.okeyTile)) {
    penalize(s, player, s.rules.okeyDiscardPenalty);
  }
  // whether it can be caught, by the table as it lies now (catchDiscard)
  s.discardFits = fitsTable(s, tile);
  resolveOffer(s, player);
  // the pile ran out: the round ends, or the next player shuffles the
  // discards into a new one (game.shuffleDiscards) or calls it (endPile)
  if (!s.drawPile.length && !s.rules.reshuffle) return endRound(s, null);
  return s;
}

export function endPile(state, player) {
  if (!game.pileOut(state, player)) return;
  return endRound(state, null);
}

const isCaught = (state, tileId) =>
  state.players.some((p) => p.caught?.includes(tileId));

// what a player owes for this hand before it's scored: their tiles caught
// on their pile, and the penalties during play (an okey thrown, a caught
// tile taken off the pile, a discard put back, the gösterge's minus); shown
// on the score sheet as it happens, added to the hand's score at its end
export function penaltiesSoFar(state, player) {
  const caught = state.players.flatMap((p) => p.caught ?? []);
  const pile = seat(state, player)?.discardPile ?? [];
  return (
    state.rules.catchPenalty *
      pile.filter((t) => caught.includes(t.id)).length +
    (state.penalties?.[player] ?? 0)
  );
}

// 101: a discard taken that can't be used goes back on its pile, and the
// player draws from the pile instead (for returnPenalty, if the rules ask)
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
  // back on the pile, a caught tile counts there again
  if (isCaught(s, tile.id)) penalize(s, from.id, -s.rules.catchPenalty);
  const cost = s.rules.returnPenalty;
  if (cost) {
    penalize(s, player, cost);
    s.message = `${me.user?.name} put the tile back: +${cost}`;
  }
  return s;
}

// 101's gösterge (the user's, not the PDF's): the indicator's twin, shown
// on your first turn of a hand, scores indicatorScore once
export function showIndicator(state, player, tileId) {
  const score = state.rules.indicatorScore;
  if (!score) return;
  if (roundOver(state)) return roundOver(state);
  if (state.currentPlayer !== player) return "Not your turn";
  if (state.indicatorShown) return "The indicator's been shown";
  // a turn ends with a discard: the first lap is the first n of them
  if ((state.discards ?? 0) >= state.players.length) {
    return "Only on your first turn";
  }
  const kind = (id) => id.split("-")[0];
  const tile = seat(state, player).hand.find((t) => t?.id === tileId);
  if (!tile || kind(tile.id) !== kind(state.okeyTile.id)) {
    return "That's not the indicator's twin";
  }
  const s = cloneDeep(state);
  s.indicatorShown = player;
  penalize(s, player, score);
  s.message = `${seat(s, player).user?.name} showed the indicator: ${score}`;
  return s;
}

// Why `player` can't catch `from`'s discard, if they can't: it's anyone
// else's to catch, in 101 not their partner's, and only until the next
// player draws (catchUntilDraw)
export function cantCatch(state, player, from) {
  if (player === from) return "That's your own tile";
  if (state.rules.partners && game.partner(state.players, from).id === player) {
    return "That's your partner's tile";
  }
  if (state.rules.catchUntilDraw && state.drawn) return "Too late to catch it";
}

// `tile` could go on the table as it is: added without moving an okey, or in
// place of the okey that stands for it; a 1 after 13 doesn't count
function fitsTable(state, tile) {
  const ind = state.okeyTile;
  return state.melds.some((m) => {
    const j = okeyFor(m, tile, ind);
    const after13 = m.type === "seri" && j > 0 && rankOf(tile, ind) === 1;
    return withTile(state, m, tile, false) || (j >= 0 && !after13);
  });
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
  const no = cantCatch(state, player, from.id);
  if (no) return no;
  if (isCaught(state, tile.id)) return "Already caught";
  // 101: a thrown okey already cost okeyDiscardPenalty
  if (state.rules.okeyDiscardPenalty && isOkey(tile, state.okeyTile)) {
    return "The okey's penalty is already written";
  }
  // the table as it lay when the tile was thrown: melds laid since (the
  // next player opening) don't count; a game from before kept no record
  if (!(state.discardFits ?? fitsTable(state, tile))) {
    return "That tile didn't fit a meld when it was thrown";
  }
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
  return endRound(s, player, tile);
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

// `last`: the finisher's last discard; `inOne`: they opened this turn
function endRound(state, finisher, last, inOne = false) {
  const s = cloneDeep(state);
  const { rules } = s;
  const i = s.round - 1;
  const pairs = (id) => !!s.openedWithPairs?.[id];
  // doubling: the okey as the last discard doubles every score, the
  // finisher's only with finishDoubled; so does a win with pairs, or opened
  // and finished in one go while nobody else had opened (finishInOne), each
  const alone =
    rules.finishInOne &&
    inOne &&
    Object.keys(s.opened).every((id) => Number(id) === finisher);
  const times = !rules.doubling
    ? 1
    : (pairs(finisher) ? 2 : 1) *
      (last && isOkey(last, s.okeyTile) ? 2 : 1) *
      (alone ? 2 : 1);
  // a hand nobody finishes scores only the okeys held, and is dealt again
  // by the same player, unless it's scored as usual (pileOutCounts), then
  // only when everyone opened with pairs: nobody could finish
  const voided =
    !finisher && (!rules.pileOutCounts || s.players.every((p) => pairs(p.id)));
  // pairs: the finisher's partner pays nothing for their hand
  const mate = rules.partners && finisher && game.partner(s.players, finisher);
  for (const p of s.players) {
    p.hand = intoHand(p.hand, p.inbox ?? []);
    p.inbox = [];
    const okeys = p.hand.filter((t) => t && isOkey(t, s.okeyTile)).length;
    const notOpened = rules.notOpenedCounts
      ? (rules.notOpenedScore + rules.okeyInHandScore * okeys) * times
      : rules.notOpenedScore * Math.min(times, 2);
    const hand = voided
      ? rules.okeyInHandScore * okeys
      : p.id === finisher
        ? rules.finishScore * (rules.finishDoubled ? times : 1)
        : p.id === mate?.id
          ? 0
          : !isElden(s) && !s.opened[p.id] && !rules.notOpenedHand
            ? notOpened
            : handScore(p.hand, s) *
              (pairs(p.id) && rules.doubling ? 2 : 1) *
              times;
    const score = hand + penaltiesSoFar(s, p.id);
    // a hand dealt again adds to the same line
    s.scores[p.id] = s.scores[p.id] ?? [];
    s.scores[p.id][i] = (s.scores[p.id][i] ?? 0) + score;
  }
  game.showHands(s);
  const name = (id) => seat(s, id)?.user?.name ?? "Player";

  if (s.round < rules.rounds.length || voided) {
    return {
      ...s,
      players: game.allSeats(s.players, game.seatsOf(s)), // free seats to sit in
      gameState: "roundEnd",
      replay: voided,
      message: finisher
        ? `${name(finisher)} finished round ${s.round}${times > 1 ? ` ×${times}` : ""}`
        : voided
          ? `Round ${s.round}: no tiles left, dealt again`
          : `Round ${s.round}: no tiles left`,
    };
  }
  // in pairs, a team's total is both partners'
  const total = (p) =>
    sum(s.scores[p.id]) +
    (rules.partners ? sum(s.scores[game.partner(s.players, p.id).id]) : 0);
  const winner = s.players.reduce((a, b) => (total(b) < total(a) ? b : a));
  const who = rules.partners
    ? `${name(winner.id)} & ${name(game.partner(s.players, winner.id).id)}`
    : name(winner.id);
  return {
    ...s,
    gameState: "finish",
    // a game of one hand is just won
    message: `${who} ${rules.partners ? "win" : "wins"}${
      rules.rounds.length > 1 ? ` with ${total(winner)}` : "!"
    }`,
  };
}
