import { createContext, useState } from "react";
import _, { cloneDeep } from "lodash";
import { colors, ranks } from "./constants";
import { checkFinished } from "./checkFinish";

const maxHandSize = 26;
const startingPlayer = 1;

export const OkeyContext = createContext({});

function removeItem(array, tile) {
  const fromIndex = array.findIndex((h) => h?.id === tile.id);
  console.log("removeItem: ", fromIndex);
  const newArray = [...array]; // Create a new array using the spread operator

  // Swap the items in the new array
  newArray[fromIndex] = null;

  return newArray;
}

function swapItems(array, fromIndex, toIndex) {
  console.log("swapItems: ", fromIndex, toIndex);
  const newArray = [...array]; // Create a new array using the spread operator

  // Swap the items in the new array
  [newArray[fromIndex], newArray[toIndex]] = [
    newArray[toIndex],
    newArray[fromIndex],
  ];

  return newArray;
}

function insertItem(array, toIndex, item) {
  console.log("insertItem: ", toIndex, item);
  const newArray = [...array]; // Create a new array using the spread operator

  // Swap the items in the new array
  newArray[toIndex] = item;

  return newArray;
}

function arrayRotate(arr, reverse) {
  if (reverse) arr.unshift(arr.pop());
  else arr.push(arr.shift());
  return arr;
}

const DEBUG = true;

export function OkeyProvider({ children }) {
  const [okeyState, setOkeyState] = useState(() => {
    const me = startingPlayer;
    const drawPile = [];
    // create the tiles
    for (let i = 0; i < 2; i++) {
      colors.forEach((color) =>
        ranks.forEach((rank) =>
          drawPile.push({
            color,
            rank,
            id: `${color + rank}-${i}`,
            // hidden: true,
            source: "draw-pile",
          })
        )
      );
    }
    function dealHand(player) {
      // Create a new array with 3 randomly selected elements
      const sampledArray = (DEBUG ? _.take : _.sampleSize)(
        drawPile,
        player === startingPlayer ? 15 : 14
      ).map((tile) => {
        if (me === player) {
          return { ...tile, hidden: false, source: `hand-${player}` };
        }
        return { ...tile, source: `hand-${player}` };
      });

      // Remove the selected elements from the original array
      _.pullAll(drawPile, sampledArray);
      return sampledArray.concat(
        Array(maxHandSize - sampledArray.length).fill(null)
      );
    }
    function pickOkeyTile() {
      const okeyTile = _.sample(drawPile);
      _.pull(drawPile, okeyTile);
      return okeyTile;
    }
    return {
      me,
      drawPile: _.shuffle(drawPile).map((t) => ({ ...t, hidden: true })),
      okeyTile: pickOkeyTile(),
      currentPlayer: startingPlayer,
      winner: null,
      players: [
        {
          id: 1,
          hand: dealHand(1),
          discardPile: [],
        },
        {
          id: 2,
          hand: dealHand(2),
          discardPile: [],
        },
        {
          id: 3,
          hand: dealHand(3),
          discardPile: [],
        },
        {
          id: 4,
          hand: dealHand(4),
          discardPile: [],
        },
      ],
    };
  });

  const nextDrawTile = okeyState.drawPile[okeyState.drawPile.length - 1];

  const isMyTurn = () => okeyState.currentPlayer === okeyState.me;
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
      console.log("Not your turn");
      return;
    }
    if (!canDrawTile(player)) {
      console.log("Can't draw more tiles");
      return;
    }
    setOkeyState((oldState) => {
      const newState = cloneDeep(oldState);
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
      return newState;
    });
  };
  const swapTile = (player, tile, toIndex) => {
    console.log("tile.source: ", tile.source);
    if (tile.source !== `hand-${okeyState.me}`) {
      console.log("Can't move other players tiles");
      return;
    }
    setOkeyState((oldState) => {
      const newState = cloneDeep(oldState);
      const myPlayer = newState.players.find((p) => p.id === player);
      const oldIndex = myPlayer.hand.findIndex((t) => t?.id === tile.id);
      myPlayer.hand = swapItems(myPlayer.hand, oldIndex, toIndex);
      return newState;
    });
  };
  const discardTile = (player, tile) => {
    if (!isMyTurn()) {
      console.log("Not your turn");
      return;
    }
    if (!canDiscardTile(player)) {
      console.log("Can't discard before drawing");
      return;
    }
    if (!tile.source.includes("hand")) {
      console.log("Invalid discard source");
      return;
    }
    setOkeyState((oldState) => {
      const newState = cloneDeep(oldState);
      const myPlayer = newState.players.find((p) => p.id === player);
      myPlayer.hand = removeItem(myPlayer.hand, tile);
      myPlayer.discardPile = [
        ...myPlayer.discardPile,
        { ...tile, source: `discard-${player}` },
      ];
      newState.currentPlayer = Math.max((oldState.currentPlayer + 1) % 5, 1);
      // for debugging
      newState.me = newState.currentPlayer;
      arrayRotate(newState.players);
      return newState;
    });
  };
  const finishGame = (tile) => {
    if (!isMyTurn()) {
      console.log("Not your turn");
      return;
    }
    if (!canDiscardTile(okeyState.me)) {
      console.log("Can't discard before drawing");
      return;
    }
    if (tile.source !== `hand-${okeyState.me}`) {
      console.log("Can't move other players tiles");
      return;
    }
    const discardIndex = myHand(okeyState.me).findIndex(
      (h) => h?.id === tile.id
    );
    const hand = [...myHand(okeyState.me)];
    hand[discardIndex] = null;

    const finished = checkFinished(hand);
    if (finished) {
      console.log(`${okeyState.me} wins!`);
      setOkeyState((state) => ({ ...state, winner: okeyState.me }));
    }
  };

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
      }}
    >
      {children}
    </OkeyContext.Provider>
  );
}
