import { createContext, useState } from "react";
import _ from "lodash";
import { colors, ranks } from "./constants";

export const OkeyContext = createContext({});

const maxHandSize = 26;
const startingPlayer = 4;

export function OkeyProvider({ children }) {
  const [okeyState, setOkeyState] = useState(() => {
    const drawPile = [];
    // create the tiles
    for (let i = 0; i < 2; i++) {
      colors.forEach((color) =>
        ranks.forEach((rank) =>
          drawPile.push({
            color,
            rank,
            id: `${color + rank}-${i}`,
            // hidden: false,
          })
        )
      );
    }
    function dealHand(player) {
      // Create a new array with 3 randomly selected elements
      const sampledArray = _.sampleSize(
        drawPile,
        player === startingPlayer ? 15 : 14
      );

      // Remove the selected elements from the original array
      _.pullAll(drawPile, sampledArray);
      return sampledArray.concat(
        Array(maxHandSize - sampledArray.length).fill(null)
      );
    }
    return {
      drawPile,
      nextPlayer: 1,
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

  const updateOkeyState = (newState) => {
    setOkeyState((prevState) => ({ ...prevState, ...newState }));
  };

  const resetOkeyState = () => {
    setOkeyState({
      /* your initial state */
    });
  };

  const nextDrawTile = okeyState.drawPile[okeyState.drawPile - 1];

  return (
    <OkeyContext.Provider
      value={{ okeyState, updateOkeyState, resetOkeyState, nextDrawTile }}
    >
      {children}
    </OkeyContext.Provider>
  );
}
