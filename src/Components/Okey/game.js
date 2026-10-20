import _, { cloneDeep } from "lodash";
import { colors, ranks } from "./constants";
import { checkFinished } from "./checkFinish";
import { createTile, maxHandSize } from "./utils";

// Game rules as pure functions: (state, player, ...args) => new state,
// an error string to show the player, or undefined for "nothing changed".

function removeItem(array, tile) {
  const newArray = [...array];
  const fromIndex = newArray.findIndex((h) => h?.id === tile.id);
  newArray[fromIndex] = null;

  return newArray;
}

function swapItems(array, fromIndex, toIndex) {
  const newArray = [...array];
  [newArray[fromIndex], newArray[toIndex]] = [
    newArray[toIndex],
    newArray[fromIndex],
  ];

  return newArray;
}

function insertItem(array, toIndex, item) {
  const newArray = [...array];
  if (newArray[toIndex] === null) {
    // if the target is null just insert
    newArray[toIndex] = item;
    return newArray;
  }

  // Find the first null index after target
  const rightNull = newArray.indexOf(null, toIndex);
  const leftNull = newArray.lastIndexOf(null, toIndex);
  const firstNull = newArray.indexOf(null);

  // If no null is found on the right or left insert at the first available place
  if (rightNull === -1 && leftNull === -1) {
    newArray[firstNull] = item;
    return newArray;
  }

  if (rightNull !== -1) {
    // Shift the objects to the right
    for (let i = rightNull; i > toIndex; i--) {
      newArray[i] = newArray[i - 1];
    }

    // Insert the new object
    newArray[toIndex] = item;

    return newArray;
  }

  if (leftNull !== -1) {
    // Shift the objects to the left
    for (let i = leftNull; i < toIndex; i++) {
      newArray[i] = newArray[i + 1];
    }

    // Insert the new object
    newArray[toIndex] = item;

    return newArray;
  }

  return newArray;
}

const handTile = (tile, player) => ({
  ...tile,
  hidden: false,
  source: `hand-${player}`,
});

// ids: optional fixed hand (tile ids, null for a gap) instead of a random one
function dealHand(drawPile, player, count, ids) {
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

  return hand.concat(Array(maxHandSize - hand.length).fill(null));
}

// a fake okey can't be the indicator: there's no rank to count up from
export function pickOkeyTile(drawPile, id) {
  const okeyTile = id
    ? drawPile.find((t) => t.id === id)
    : _.sample(drawPile.filter((t) => t.rank !== "👌"));
  return { ...okeyTile, hidden: false };
}

export const tiles = [];
// create the tiles
for (let i = 0; i < 2; i++) {
  colors.forEach((color) =>
    ranks.forEach((rank) => tiles.push(createTile(color, rank, i))),
  );
  tiles.push(createTile("yellow", "👌", i));
}

export const shuffledPile = () =>
  _.shuffle(tiles).map((t) => ({ ...t, hidden: true }));

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
  ],
  message: "",
};

// Every seat, the empty ones too: a started game keeps only the seats that
// were taken, and between games and rounds anyone can sit down again.
export const allSeats = (players) =>
  initialState.players.map(
    (empty) => players.find((p) => p.id === empty.id) ?? empty,
  );

function getNextPlayer(players, currentPlayer) {
  const previousIndex = players.findIndex((p) => p.id === currentPlayer);
  const nextIndex = (previousIndex + 1) % players.length;

  // Find the next element greater than 5 after the previous element
  return players[nextIndex];
}

function getPreviousPlayer(players, currentPlayer) {
  const previousIndex = players.findIndex((p) => p.id === currentPlayer);
  const numPlayers = players.length;
  let previousPlayerIndex;

  if (previousIndex === 0) {
    previousPlayerIndex = numPlayers - 1; // Wrap around to the last player
  } else {
    previousPlayerIndex = (previousIndex - 1) % numPlayers;
  }

  return players[previousPlayerIndex];
}

const handOf = (state, player) =>
  state.players.find((p) => p.id === player)?.hand || [];

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
    message: "",
    drawPile: drawPile.filter((t) => !taken.has(t.id)),
  };
}

export function startGame(state, deal) {
  const players = state.players.filter((p) => p.user !== null);
  if (players.length < 2) {
    return { ...state, message: "not enough players to start the game" };
  }
  return dealRound({ ...cloneDeep(state), players }, state.drawPile, deal);
}

const roundOver = (state) => state.gameState !== "play" && "The round is over";

export function drawTile(state, player, tile, toIndex) {
  if (roundOver(state)) return roundOver(state);
  if (state.currentPlayer !== player) return "Not your turn";
  if (state.drawn) return "Can't draw more tiles";
  if (
    tile.source.includes("discard") &&
    tile.source !== `discard-${getPreviousPlayer(state.players, player).id}`
  ) {
    return "Can't draw this tile";
  }
  const newState = cloneDeep(state);
  const myPlayer = newState.players.find((p) => p.id === player);
  if (!myPlayer) return;

  myPlayer.hand = insertItem(myPlayer.hand, toIndex, handTile(tile, player));
  newState.drawn = true;

  if (tile.source === "draw-pile") {
    newState.drawPile = newState.drawPile.filter((t) => t.id !== tile.id);
  } else {
    const sourcePlayer = newState.players.find(
      (p) => p.id === Number(tile.source.split("-")[1]),
    );
    if (sourcePlayer) {
      sourcePlayer.discardPile = sourcePlayer.discardPile.filter(
        (t) => t.id !== tile.id,
      );
    }
  }
  return newState;
}

export function swapTile(state, player, tile, toIndex) {
  if (roundOver(state)) return roundOver(state);
  if (tile.source !== `hand-${player}`) return "Can't move other players tiles";
  const newState = cloneDeep(state);
  const myPlayer = newState.players.find((p) => p.id === player);
  if (!myPlayer) return;

  const oldIndex = myPlayer.hand.findIndex((t) => t?.id === tile.id);
  myPlayer.hand = swapItems(myPlayer.hand, oldIndex, toIndex);
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

// Moves several picked tiles at once: they land side by side, in rack order,
// from toIndex on (within one row when they fit), and tiles already in
// those slots take the picked tiles' old ones, like a single tile's swap.
export function moveTiles(state, player, ids, toIndex) {
  if (roundOver(state)) return roundOver(state);
  const newState = cloneDeep(state);
  const myPlayer = newState.players.find((p) => p.id === player);
  if (!myPlayer) return;
  const hand = [...myPlayer.hand];
  const from = hand.flatMap((t, i) => (t && ids.includes(t.id) ? [i] : []));
  if (!from.length) return;
  const rowStart = toIndex - (toIndex % 13);
  const start =
    from.length <= 13
      ? Math.min(toIndex, rowStart + 13 - from.length)
      : Math.min(toIndex, hand.length - from.length);
  const to = from.map((_, j) => start + j);

  const moving = from.map((i) => hand[i]);
  from.forEach((i) => (hand[i] = null));
  const displaced = to.map((i) => hand[i]).filter(Boolean);
  to.forEach((i, j) => (hand[i] = moving[j]));
  const vacated = from.filter((i) => !to.includes(i));
  displaced.forEach((t, j) => (hand[vacated[j]] = t));
  myPlayer.hand = hand;
  return newState;
}

export function discardTile(state, player, tile) {
  if (roundOver(state)) return roundOver(state);
  if (state.currentPlayer !== player) return "Not your turn";
  if (!state.drawn) return "Can't discard before drawing";
  if (tile.source !== `hand-${player}`) return "Invalid discard source";
  const newState = cloneDeep(state);
  const myPlayer = newState.players.find((p) => p.id === player);
  if (!myPlayer) return;

  myPlayer.hand = removeItem(myPlayer.hand, tile);
  myPlayer.discardPile = [
    ...myPlayer.discardPile,
    { ...tile, source: `discard-${player}`, hidden: false },
  ];
  newState.currentPlayer = getNextPlayer(
    newState.players,
    newState.currentPlayer,
  ).id;
  newState.drawn = false;
  newState.lastDiscard = tile.id; // shown apart from the rest of the pile
  return newState;
}

export function finishGame(state, player, tile) {
  if (roundOver(state)) return roundOver(state);
  if (state.currentPlayer !== player) return "Not your turn";
  if (!state.drawn) return "Can't discard before drawing";
  if (tile.source !== `hand-${player}`) return "Can't move other players tiles";
  const hand = cloneDeep(handOf(state, player));
  const discardIndex = hand.findIndex((h) => h?.id === tile.id);
  if (discardIndex === -1) return;

  hand[discardIndex] = null;

  if (!checkFinished(hand, state.okeyTile)) return;

  const newState = cloneDeep(state);
  // the tile thrown to finish lies in the middle
  newState.players.find((p) => p.id === player).hand = hand;
  newState.finishTile = { ...tile, source: "finish", hidden: false };
  for (const p of newState.players) {
    if (p.hand) {
      p.hand = p.hand.map((h) => (h ? { ...h, hidden: false } : null));
    }
  }

  const winner = newState.players.find((p) => p.id === newState.currentPlayer);
  const winnerName = winner?.user?.name || "Player";

  return {
    ...newState,
    message: `${winnerName} wins!`,
    gameState: "finish",
  };
}
