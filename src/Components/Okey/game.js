import _, { cloneDeep } from "lodash";
import { colors, ranks } from "./constants";
import { checkFinished } from "./checkFinish";
import { createTile } from "./utils";

// Game rules as pure functions: (state, player, ...args) => new state,
// an error string to show the player, or undefined for "nothing changed".

function removeItem(array, tile) {
  const newArray = [...array];
  const fromIndex = newArray.findIndex((h) => h?.id === tile.id);
  newArray[fromIndex] = null;

  return newArray;
}

// Tiles dropped on a rack slot, moved along the rack or new to it (a draw):
// they land side by side in rack order, the one under the finger (`held`)
// on the slot it was dropped on, all in that slot's row. The tiles in their
// way slide aside into the row's nearest gaps; back towards the slots the
// moved tiles left in this row when those have room, so a group being
// reordered closes up behind them instead of running into the next one. A
// row too full to make room: what's in the way takes the moved tiles' old
// slots, or the first gaps.
export function placeTiles(hand, row, tiles, toIndex, held = tiles[0]?.id) {
  const h = Array.from(
    { length: Math.max(hand.length, 2 * row) },
    (_, i) => hand[i] ?? null,
  );
  const ids = tiles.map((t) => t.id);
  const from = h.flatMap((t, i) => (t && ids.includes(t.id) ? [i] : []));
  const moving = [
    ...from.map((i) => h[i]),
    ...tiles.filter((t) => !h.some((x) => x?.id === t.id)),
  ];
  from.forEach((i) => (h[i] = null));
  const k = moving.length;
  const rowStart = toIndex - (toIndex % row);
  const [lo, hi] = k <= row ? [rowStart, rowStart + row] : [0, h.length];
  const offset = Math.max(
    0,
    moving.findIndex((t) => t.id === held),
  );
  const start = Math.min(Math.max(toIndex - offset, lo), hi - k);
  const to = moving.map((_, j) => start + j);
  const room = k <= row && makeRoom(h, lo, hi, start, k, from);
  const out = room || h;
  const inWay = room ? [] : to.map((i) => h[i]).filter(Boolean);
  to.forEach((i, j) => (out[i] = moving[j]));
  const vacated = from.filter((i) => !to.includes(i));
  for (const t of inWay) out[vacated.shift() ?? out.indexOf(null)] = t;
  return out;
}

// the hand with slots start..start+k-1 of the row [lo, hi) emptied: the
// tiles there pushed out to either side, each side's tiles sliding into its
// nearest gaps; null when the row has no room
function makeRoom(h, lo, hi, start, k, from) {
  const end = start + k;
  const inWay = h.slice(start, end).filter(Boolean);
  const was = new Map(h.map((t, i) => [t?.id, i]));
  const back = from.find((i) => i >= lo && i < hi);
  let best;
  // the first m tiles in the way go out the left side, the rest the right
  for (let m = 0; m <= inWay.length; m++) {
    const left = squeeze(
      [...h.slice(lo, start), ...inWay.slice(0, m)],
      m,
      true,
    );
    const right = squeeze(
      [...inWay.slice(m), ...h.slice(end, hi)],
      inWay.length - m,
      false,
    );
    if (!left || !right) continue;
    const row = [...left, ...Array(k).fill(null), ...right];
    const slid = row.reduce(
      (n, t, j) => n + (t ? Math.abs(lo + j - was.get(t.id)) : 0),
      0,
    );
    const away =
      back !== undefined && m !== (back < start ? inWay.length : 0) ? 1 : 0;
    if (!best || away < best.away || (away === best.away && slid < best.slid))
      best = { row, slid, away };
  }
  if (!best) return null;
  const out = [...h];
  out.splice(lo, hi - lo, ...best.row);
  return out;
}

// part of a row with n tiles pushed in from one end (`atEnd`: its right
// end): the n gaps nearest that end close up; null without n gaps
function squeeze(part, n, atEnd) {
  const p = atEnd ? [...part].reverse() : [...part];
  for (let i = 0; n > 0 && i < p.length;) {
    if (p[i] === null) {
      p.splice(i, 1);
      n--;
    } else i++;
  }
  if (n) return null;
  return atEnd ? p.reverse() : p;
}

const handTile = (tile, player) => ({
  ...tile,
  hidden: false,
  source: `hand-${player}`,
});

// slots a rack row has: the ruleset's, or 13
export const rowOf = (state) => state.rules?.rowSlots ?? 13;

// ids: optional fixed hand (tile ids, null for a gap) instead of a random
// one; `slots`: the rack's, both rows
function dealHand(drawPile, player, count, ids, slots) {
  const hand = ids
    ? ids.map(
        (id) =>
          id &&
          handTile(
            drawPile.find((t) => t.id === id),
            player,
          ),
      )
    : _.sampleSize(drawPile, count).map((tile) => handTile(tile, player));

  return hand.concat(Array(slots - hand.length).fill(null));
}

// a fake okey can't be the indicator: there's no rank to count up from
export function pickOkeyTile(drawPile, id) {
  const okeyTile = id
    ? drawPile.find((t) => t.id === id)
    : _.sample(drawPile.filter((t) => t.rank !== "👌"));
  return { ...okeyTile, hidden: false };
}

// The tiles of `sets` sets, two unless a ruleset says (up to four, for
// eight players): each a tile of every colour and rank and a fake okey,
// the copy in its id (red7-0, red7-1…)
export const tileSet = (sets = 2) =>
  Array.from({ length: sets }, (_, i) => [
    ...colors.flatMap((color) =>
      ranks.map((rank) => createTile(color, rank, i)),
    ),
    createTile("yellow", "👌", i),
  ]).flat();
export const tiles = tileSet();

// sets of tiles a game is played with
export const setsOf = (state) => state.rules?.tileSets ?? 2;

export const shuffledPile = (sets = 2) =>
  _.shuffle(tileSet(sets)).map((t) => ({ ...t, hidden: true }));

export const initialState = {
  gameState: "start",
  drawPile: shuffledPile(),
  okeyTile: null,
  currentPlayer: null,
  players: [
    {
      id: 1,
      user: null,
      userKey: null,
      hand: [],
      discardPile: [],
    },
    {
      id: 2,
      user: null,
      userKey: null,
      hand: [],
      discardPile: [],
    },
    {
      id: 3,
      user: null,
      userKey: null,
      hand: [],
      discardPile: [],
    },
    {
      id: 4,
      user: null,
      userKey: null,
      hand: [],
      discardPile: [],
    },
    // more (rulesets.js), up to eight: any game refuses to start with more
    // than its ruleset seats
    {
      id: 5,
      user: null,
      userKey: null,
      hand: [],
      discardPile: [],
    },
    {
      id: 6,
      user: null,
      userKey: null,
      hand: [],
      discardPile: [],
    },
    {
      id: 7,
      user: null,
      userKey: null,
      hand: [],
      discardPile: [],
    },
    {
      id: 8,
      user: null,
      userKey: null,
      hand: [],
      discardPile: [],
    },
  ],
  message: "",
};

// the most players a game takes: four, or what its ruleset seats
export const seatsOf = (state) => state.rules?.seats ?? 4;

// Every seat, the empty ones too: a started game keeps only the seats that
// were taken, and between games and rounds anyone can sit down again (in
// the first `count` of them, during a game).
export const allSeats = (players, count = initialState.players.length) =>
  initialState.players
    .slice(0, count)
    .map((empty) => players.find((p) => p.id === empty.id) ?? empty);

// The seats at the table: an empty seat past the fourth shows only once
// every seat before it is taken, so four play at the table they always had
// and a bigger one grows a seat at a time.
export const tableSeats = (players) =>
  players.filter(
    (p) =>
      p.id < 5 ||
      p.user ||
      p.away ||
      p.hand.length ||
      players.every((o) => o.id >= p.id || o.user),
  );

// the player `step` places round the table from `player` (1 next, -1 before)
const along = (players, player, step) =>
  players[
    (players.findIndex((p) => p.id === player) + step + players.length) %
      players.length
  ];
const next = (players, player) => along(players, player, 1);
export const previous = (players, player) => along(players, player, -1);
// across the table: a partner, when four play in pairs
export const partner = (players, player) => along(players, player, 2);

export const seat = (state, player) =>
  state.players.find((p) => p.id === player);

// What the player whose turn it is has done this turn, so the round's end
// can show how it finished: [{ by, move, tiles: [ids] }], move one of
// took (the discard), opened, laid, added, swapped (for a table okey),
// finished. The turn passing empties it; drawing from the pile isn't shown.
export function logMove(s, by, move, tiles) {
  const entry = { by, move, tiles: tiles.map((t) => t.id) };
  s.turnMoves = [...(s.turnMoves ?? []), entry];
}

// a move taken back (an okey or a discard put back)
export function unlog(s, move, tileId) {
  s.turnMoves = (s.turnMoves ?? []).filter(
    (m) => m.move !== move || m.tiles[0] !== tileId,
  );
}

// a tile on a player's discard pile
export const onPile = (tile, player) => ({
  ...tile,
  source: `discard-${player}`,
  hidden: false,
});

// Deals every seat from drawPile: the ruleset's hand size (14 without one),
// one more for the starter, who moves first.
// deal: optional { okeyTile: id, hands: [[id | null, ...], ...] } in seat
// order, to start from a known position instead of a random one
export function dealRound(state, drawPile, deal, starter = 0) {
  const okeyTile = pickOkeyTile(drawPile, deal?.okeyTile);
  const taken = new Set([okeyTile.id]);
  const size = state.rules?.handSize ?? 14;
  const players = state.players.map((p, i) => {
    const hand = dealHand(
      drawPile.filter((t) => !taken.has(t.id)),
      p.id,
      i === starter ? size + 1 : size,
      deal?.hands?.[i],
      2 * rowOf(state),
    );
    hand.forEach((t) => t && taken.add(t.id));
    return { ...p, hand, discardPile: [], inbox: [], claim: null, caught: [] };
  });

  return {
    ...state,
    gameState: "play",
    players,
    okeyTile,
    currentPlayer: players[starter].id,
    drawn: true,
    lastDiscard: null,
    finishTile: null,
    turnMoves: [],
    message: "",
    drawPile: drawPile.filter((t) => !taken.has(t.id)),
  };
}

export function startGame(state, deal) {
  const players = state.players.filter((p) => p.user !== null);
  if (players.length < 2) {
    return { ...state, message: "not enough players to start the game" };
  }
  if (players.length > seatsOf(state)) {
    return {
      ...state,
      message: `Up to ${seatsOf(state)} players with these rules`,
    };
  }
  // the game's own id, kept through its rounds and saves (TableMenu.jsx)
  const gameId = Math.random().toString(36).slice(2);
  // the lobby's pile, unless the rules play another number of sets
  const sets = setsOf(state);
  const pile =
    state.drawPile.length === tileSet(sets).length
      ? state.drawPile
      : shuffledPile(sets);
  return dealRound({ ...cloneDeep(state), players, gameId }, pile, deal);
}

export const roundOver = (state) =>
  state.gameState !== "play" && "The round is over";
// the round has ended (not one that hasn't started yet)
export const ended = (state) =>
  ["finish", "roundEnd"].includes(state.gameState);

export function drawTile(state, player, tile, toIndex) {
  if (roundOver(state)) return roundOver(state);
  if (state.currentPlayer !== player) return "Not your turn";
  if (state.drawn) return "Can't draw more tiles";
  if (
    tile.source.includes("discard") &&
    tile.source !== `discard-${previous(state.players, player).id}`
  ) {
    return "Can't draw this tile";
  }
  const newState = cloneDeep(state);
  const myPlayer = seat(newState, player);
  if (!myPlayer) return;

  myPlayer.hand = placeTiles(
    myPlayer.hand,
    rowOf(state),
    [handTile(tile, player)],
    toIndex,
  );
  newState.drawn = true;
  if (tile.source.startsWith("discard"))
    logMove(newState, player, "took", [tile]);

  if (tile.source === "draw-pile") {
    newState.drawPile = newState.drawPile.filter((t) => t.id !== tile.id);
  } else {
    const sourcePlayer = seat(newState, Number(tile.source.split("-")[1]));
    if (sourcePlayer) {
      sourcePlayer.discardPile = sourcePlayer.discardPile.filter(
        (t) => t.id !== tile.id,
      );
    }
  }
  return newState;
}

// A saved game loaded at today's table: each seat goes to whoever sits in
// it now (logins differ from night to night).
export function restore(saved, now) {
  return {
    ...saved,
    players: saved.players.map((p) => {
      const sitting = now.players.find((x) => x.id === p.id);
      return {
        ...p,
        user: sitting?.user ?? null,
        userKey: sitting?.userKey ?? null,
      };
    }),
  };
}

// A save code: the state deflated and base64'd, so nobody reads the hands
// at a glance or edits their own. Deflating also makes it ~10x shorter.
// ponytail: obfuscation, not encryption; anyone who knows deflate can open
// it, and every phone at the table holds the whole state anyway
export async function encodeSave(state) {
  const deflated = new Blob([JSON.stringify(state)])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(deflated).arrayBuffer());
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
}

// the state in a save code, or null if it isn't one
export async function decodeSave(code) {
  try {
    const bytes = Uint8Array.from(atob(code), (c) => c.charCodeAt(0));
    const inflated = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    const state = JSON.parse(await new Response(inflated).text());
    return state?.players ? state : null;
  } catch {
    return null;
  }
}

// Moves tiles along the player's rack (placeTiles): one, or the picked
// ones together, `held` the one under the finger.
export function moveTiles(state, player, ids, toIndex, held) {
  if (roundOver(state)) return roundOver(state);
  const newState = cloneDeep(state);
  const myPlayer = seat(newState, player);
  if (!myPlayer) return;
  const tiles = myPlayer.hand.filter((t) => t && ids.includes(t.id));
  if (!tiles.length) return;
  myPlayer.hand = placeTiles(myPlayer.hand, rowOf(state), tiles, toIndex, held);
  return newState;
}

export function discardTile(state, player, tile) {
  if (roundOver(state)) return roundOver(state);
  if (state.currentPlayer !== player) return "Not your turn";
  if (!state.drawn) return "Can't discard before drawing";
  if (tile.source !== `hand-${player}`) return "Invalid discard source";
  const newState = cloneDeep(state);
  const myPlayer = seat(newState, player);
  if (!myPlayer) return;

  myPlayer.hand = removeItem(myPlayer.hand, tile);
  myPlayer.discardPile = [...myPlayer.discardPile, onPile(tile, player)];
  newState.currentPlayer = next(newState.players, newState.currentPlayer).id;
  newState.drawn = false;
  newState.lastDiscard = tile.id; // shown apart from the rest of the pile
  newState.turnMoves = [];
  return newState;
}

// The pile ran out, in a ruleset that reshuffles: before drawing, the
// player whose turn it is shuffles every discard into a new pile and plays
// on, or ends the round (americano.endPile).
export const pileOut = (state, player) =>
  state.gameState === "play" &&
  state.currentPlayer === player &&
  !state.drawn &&
  !state.drawPile.length;

export function shuffleDiscards(state, player) {
  if (!pileOut(state, player)) return;
  const s = cloneDeep(state);
  s.drawPile = _.shuffle(s.players.flatMap((p) => p.discardPile)).map((t) => ({
    ...t,
    source: "draw-pile",
    hidden: true,
  }));
  for (const p of s.players) p.discardPile = [];
  s.lastDiscard = null;
  return s;
}

// every hand shows face up once the round is over, tiles flipped in play too
export function showHands(s) {
  for (const p of s.players) {
    p.hand = p.hand?.map((t) => t && { ...t, hidden: false });
  }
}

// the tile thrown to finish lies in the middle, and the hands show
export function finish(s, player, tile) {
  s.finishTile = { ...tile, source: "finish", hidden: false };
  logMove(s, player, "finished", [tile]);
  showHands(s);
}

export function finishGame(state, player, tile) {
  if (roundOver(state)) return roundOver(state);
  if (state.currentPlayer !== player) return "Not your turn";
  if (!state.drawn) return "Can't discard before drawing";
  if (tile.source !== `hand-${player}`) return "Can't move other players tiles";
  const hand = cloneDeep(seat(state, player)?.hand ?? []);
  const discardIndex = hand.findIndex((h) => h?.id === tile.id);
  if (discardIndex === -1) return;

  hand[discardIndex] = null;

  if (!checkFinished(hand, state.okeyTile, state.rules?.wrapRuns ?? true)) {
    return "That hand doesn't finish";
  }

  const newState = cloneDeep(state);
  seat(newState, player).hand = hand;
  finish(newState, player, tile);

  const winner = seat(newState, newState.currentPlayer);
  const winnerName = winner?.user?.name || "Player";

  return {
    ...newState,
    message: `${winnerName} wins!`,
    gameState: "finish",
  };
}
