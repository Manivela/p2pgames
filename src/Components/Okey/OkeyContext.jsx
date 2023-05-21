import { createContext } from "react";
import _, { cloneDeep } from "lodash";
import { useMap } from "@joebobmiles/y-react";
import { toast } from "react-hot-toast";
import { colors, ranks } from "./constants";
import { checkFinished } from "./checkFinish";
import { useAuthStore } from "../../hooks/useStore";

export const maxHandSize = 26;

export const OkeyContext = createContext({});

function removeItem(array, tile) {
  const fromIndex = array.findIndex((h) => h?.id === tile.id);
  const newArray = [...array]; // Create a new array using the spread operator

  // Swap the items in the new array
  newArray[fromIndex] = null;

  return newArray;
}

function swapItems(array, fromIndex, toIndex) {
  const newArray = [...array]; // Create a new array using the spread operator

  // Swap the items in the new array
  [newArray[fromIndex], newArray[toIndex]] = [
    newArray[toIndex],
    newArray[fromIndex],
  ];

  return newArray;
}

function insertItem(array, toIndex, item) {
  const newArray = [...array]; // Create a new array using the spread operator

  // Swap the items in the new array
  newArray[toIndex] = item;

  return newArray;
}

const DEBUG = false;

export const createTile = (color, rank, i) => ({
  color,
  rank,
  id: `${color + rank}-${i}`,
  // hidden: true,
  source: "draw-pile",
});

function dealHand(drawPile, player, index) {
  // Create a new array with 3 randomly selected elements
  const sampledArray = (DEBUG ? _.take : _.sampleSize)(
    drawPile,
    index === 0 ? 15 : 14
  ).map((tile) => ({ ...tile, hidden: false, source: `hand-${player}` }));

  // Remove the selected elements from the original array
  _.pullAll(drawPile, sampledArray);
  return sampledArray.concat(
    Array(maxHandSize - sampledArray.length).fill(null)
  );
}
function pickOkeyTile(drawPile) {
  const okeyTile = _.sample(drawPile);
  _.pull(drawPile, okeyTile);
  return { ...okeyTile, hidden: false };
}
const tiles = [];
// create the tiles
for (let i = 0; i < 2; i++) {
  colors.forEach((color) =>
    ranks.forEach((rank) => tiles.push(createTile(color, rank, i)))
  );
}
const initialState = {
  gameState: "start",
  drawPile: _.shuffle(tiles).map((t) => ({ ...t, hidden: true })),
  okeyTile: null,
  currentPlayer: null,
  players: [
    {
      id: 1,
      user: null,
      hand: [],
      discardPile: [],
    },
    {
      id: 2,
      user: null,
      hand: [],
      discardPile: [],
    },
    {
      id: 3,
      user: null,
      hand: [],
      discardPile: [],
    },
    {
      id: 4,
      user: null,
      hand: [],
      discardPile: [],
    },
  ],
  message: "",
};

function getNextPlayer(players, currentPlayer) {
  const previousIndex = players.findIndex((p) => p.id === currentPlayer);
  const nextIndex = (previousIndex + 1) % players.length;

  // Find the next element greater than 5 after the previous element
  return players[nextIndex];
}

export function OkeyProvider({ children }) {
  const [currentUser] = useAuthStore((state) => [state.currentUser]);
  const ymap = useMap("okey-state");
  let okeyState = ymap.get("game-state");
  const setOkeyState = (value) =>
    ymap.set("game-state", { message: "", ...value });
  if (okeyState === undefined) {
    setOkeyState(initialState);
    okeyState = initialState;
  }
  const nextDrawTile = okeyState.drawPile[okeyState.drawPile.length - 1];

  const me = okeyState.players.find((p) => p.user?.id === currentUser.id)?.id;
  const isMyTurn = () => okeyState.currentPlayer === me;
  const myHand = (player) =>
    okeyState.players.find((p) => p.id === player).hand;
  const canDrawTile = (player) =>
    myHand(player).filter((t) => t !== null).length < 15;
  const canDiscardTile = (player) =>
    myHand(player).filter((t) => t !== null).length === 15;
  const myDiscardPile = (player) =>
    okeyState.players.find((p) => p.id === player).discardPile;
  const drawTile = (player, tile, toIndex) => {
    if (!isMyTurn()) {
      toast("Not your turn");
      return;
    }
    if (!canDrawTile(player)) {
      toast("Can't draw more tiles");
      return;
    }
    const newState = cloneDeep(okeyState);
    const myPlayer = newState.players.find((p) => p.id === player);
    myPlayer.hand = insertItem(myPlayer.hand, toIndex, {
      ...tile,
      source: `hand-${player}`,
      hidden: false,
    });
    if (tile.source === "draw-pile") {
      newState.drawPile = newState.drawPile.filter((t) => t.id !== tile.id);
    } else {
      const sourcePlayer = newState.players.find(
        (p) => p.id === Number(tile.source.split("-")[1])
      );
      sourcePlayer.discardPile = sourcePlayer.discardPile.filter(
        (t) => t.id !== tile.id
      );
    }
    setOkeyState(newState);
  };
  const swapTile = (player, tile, toIndex) => {
    if (tile.source !== `hand-${me}`) {
      toast("Can't move other players tiles");
      return;
    }
    const newState = cloneDeep(okeyState);
    const myPlayer = newState.players.find((p) => p.id === player);
    const oldIndex = myPlayer.hand.findIndex((t) => t?.id === tile.id);
    myPlayer.hand = swapItems(myPlayer.hand, oldIndex, toIndex);
    setOkeyState(newState);
  };
  const discardTile = (player, tile) => {
    if (!isMyTurn()) {
      toast("Not your turn");
      return;
    }
    if (!canDiscardTile(player)) {
      toast("Can't discard before drawing");
      return;
    }
    if (!tile.source.includes("hand")) {
      toast("Invalid discard source");
      return;
    }
    const newState = cloneDeep(okeyState);
    const myPlayer = newState.players.find((p) => p.id === player);
    myPlayer.hand = removeItem(myPlayer.hand, tile);
    myPlayer.discardPile = [
      ...myPlayer.discardPile,
      { ...tile, source: `discard-${player}` },
    ];
    newState.currentPlayer = getNextPlayer(
      newState.players,
      newState.currentPlayer
    ).id;
    setOkeyState(newState);
  };
  const finishGame = (tile) => {
    if (!isMyTurn()) {
      toast("Not your turn");
      return;
    }
    if (!canDiscardTile(me)) {
      toast("Can't discard before drawing");
      return;
    }
    if (tile.source !== `hand-${me}`) {
      toast("Can't move other players tiles");
      return;
    }
    const discardIndex = myHand(me).findIndex((h) => h?.id === tile.id);
    const hand = [...myHand(me)];
    hand[discardIndex] = null;

    const finished = checkFinished(hand, okeyState.okeyTile);
    if (finished) {
      setOkeyState({
        ...okeyState,
        message: `player ${me} wins!`,
      });
    }
  };

  const startGame = () => {
    const drawPile = okeyState.drawPile;
    const filteredPlayers = okeyState.players.filter((p) => p.user !== null);
    if (filteredPlayers.length < 2) {
      setOkeyState({
        ...okeyState,
        message: "not enough players to start the game",
      });
    }
    const newPlayers = [...filteredPlayers].map((p, index) => ({
      ...p,
      hand: dealHand(drawPile, p.id, index),
    }));

    setOkeyState({
      ...okeyState,
      gameState: "play",
      players: newPlayers,
      okeyTile: pickOkeyTile(drawPile),
      currentPlayer: newPlayers[0].id,
    });
  };

  const resetGame = () => {
    setOkeyState(initialState);
  };

  const sit = (player) => {
    const newPlayers = [...okeyState.players];
    const seat = newPlayers.find((p) => p.id === player);
    seat.user = currentUser;
    setOkeyState({
      ...okeyState,
      players: newPlayers,
    });
  };

  const isAlreadySitting = okeyState.players.find(
    (p) => p.user?.id === currentUser.id
  );

  const stand = (player) => {
    const newPlayers = [...okeyState.players];
    const seat = newPlayers.find((p) => p.id === player);
    seat.user = null;
    setOkeyState({
      ...okeyState,
      players: newPlayers,
      message: `${currentUser.name} left`,
    });
  };

  const myIndex = okeyState.players.findIndex(
    (p) => p.user?.id === currentUser.id
  );

  return (
    <OkeyContext.Provider
      value={{
        okeyState,
        nextDrawTile,
        isMyTurn,
        myHand,
        myDiscardPile,
        discardTile,
        swapTile,
        drawTile,
        finishGame,
        startGame,
        sit,
        stand,
        isAlreadySitting,
        myIndex,
        resetGame,
        me,
        currentUser,
      }}
    >
      {children}
    </OkeyContext.Provider>
  );
}
